import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calendar as CalendarIcon,
  CalendarDays,
  Plus,
  ChevronDown,
  ChevronRight,
  Clock,
  AlertTriangle,
  GraduationCap,
  DollarSign,
  FileText,
  Home,
  Users,
  Globe,
  Edit,
  Trash2,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { format, formatDistanceToNow, isAfter, isBefore, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import type { UniversityDate, UniversityDateCategory } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

// Date categories with proper typing
export const DATE_CATEGORY_GROUPS = {
  "Application Deadlines": {
    icon: GraduationCap,
    color: "blue" as const,
    categories: ["early_admissions", "regular_admissions", "rolling_admissions", "transfer_admissions"] as const,
    dateTypes: {
      early_admissions: [
        "Early Action (EA) Application Opens",
        "Early Action Deadline", 
        "Early Action Decision Release",
        "Restrictive/Single-Choice Early Action",
        "Early Decision I Application Opens",
        "Early Decision I Deadline",
        "Early Decision I Decision Release", 
        "Early Decision II Deadline",
        "Early Decision II Decision Release"
      ] as const,
      regular_admissions: [
        "Regular Decision Application Opens",
        "Regular Decision Deadline",
        "Regular Decision Decision Release"
      ] as const,
      rolling_admissions: [
        "Application Opens",
        "Priority Deadline(s)",
        "Final Deadline"
      ] as const,
      transfer_admissions: [
        "Transfer Application Opens",
        "Transfer Application Deadline(s)",
        "Transfer Decision Release"
      ] as const
    }
  },
  "Financial Aid Deadlines": {
    icon: DollarSign,
    color: "green" as const,
    categories: ["financial_aid"] as const,
    dateTypes: {
      financial_aid: [
        "FAFSA Opens",
        "CSS Profile Opens", 
        "Priority Financial Aid Deadline",
        "Scholarship Deadlines",
        "International Aid Deadlines"
      ] as const
    }
  },
  "Academic Calendar": {
    icon: CalendarDays,
    color: "purple" as const,
    categories: ["academic_calendar"] as const,
    dateTypes: {
      academic_calendar: [
        "Fall Semester Start Date",
        "Spring Semester Start Date", 
        "Summer Session Start Date",
        "Fall Registration Opens",
        "Spring Registration Opens",
        "Add/Drop Deadline",
        "Withdrawal Deadline",
        "Final Exams Period"
      ] as const
    }
  },
  "Housing & Orientation": {
    icon: Home,
    color: "orange" as const,
    categories: ["enrollment_next_steps"] as const,
    dateTypes: {
      enrollment_next_steps: [
        "Admitted Student Reply Date",
        "Housing Application Deadline", 
        "Orientation Dates",
        "Move-in Dates",
        "Welcome Week Events"
      ] as const
    }
  },
  "Testing & Admission Requirements": {
    icon: FileText,
    color: "red" as const,
    categories: ["supporting_materials"] as const,
    dateTypes: {
      supporting_materials: [
        "Test Score Submission Deadline",
        "Recommendation Letter Deadline",
        "Portfolio/Audition Deadline",
        "Honors College Deadline",
        "Interview Deadlines"
      ] as const
    }
  },
  "Special Programs": {
    icon: Users,
    color: "indigo" as const,
    categories: ["special_programs"] as const,
    dateTypes: {
      special_programs: [
        "Honors Program Application Deadline",
        "Study Abroad Application Deadline",
        "Research Program Deadline",
        "Co-op Program Deadline",
        "Internship Program Deadline"
      ] as const
    }
  },
  "International Student Deadlines": {
    icon: Globe,
    color: "teal" as const,
    categories: ["international_deadlines"] as const,
    dateTypes: {
      international_deadlines: [
        "TOEFL/IELTS Score Deadline",
        "International Transcript Deadline",
        "Financial Documentation Deadline",
        "Visa Application Deadline",
        "I-20 Request Deadline"
      ] as const
    }
  }
} as const;

// Form validation schema
const dateFormSchema = z.object({
  category: z.string().min(1, "Category is required"),
  label: z.string().min(1, "Date type is required"),
  dueDate: z.date({
    required_error: "Due date is required",
  }),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof dateFormSchema>;

interface DateManagementProps {
  universityId: number;
}

export default function DateManagement({ universityId }: DateManagementProps) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["Application Deadlines"]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingDate, setEditingDate] = useState<UniversityDate | null>(null);
  const [deletingDate, setDeletingDate] = useState<UniversityDate | null>(null);
  const [preselectedGroup, setPreselectedGroup] = useState<string>("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: dates, isLoading, error } = useQuery<UniversityDate[]>({
    queryKey: ["/api/universities", universityId, "dates"],
    enabled: !!universityId,
  });

  const canEdit = user?.role === "admin" || user?.role === "counselor";

  const form = useForm<FormData>({
    resolver: zodResolver(dateFormSchema),
    defaultValues: {
      category: "",
      label: "",
      dueDate: new Date(),
      notes: "",
    },
  });

  const selectedCategory = form.watch("category");

  // Create date mutation
  const createDate = useMutation({
    mutationFn: async (data: FormData) => {
      const requestData = {
        category: data.category as UniversityDateCategory,
        label: data.label,
        dueDate: data.dueDate.toISOString(),
        notes: data.notes,
      };
      
      await apiRequest(`/api/universities/${universityId}/dates`, "POST", requestData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/universities", universityId, "dates"] });
      toast({
        title: "Success",
        description: "Date added successfully.",
      });
      setIsAddDialogOpen(false);
      setEditingDate(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add date.",
        variant: "destructive",
      });
    },
  });

  // Update date mutation
  const updateDate = useMutation({
    mutationFn: async (data: FormData) => {
      if (!editingDate) throw new Error("No editing date");
      
      const requestData = {
        category: data.category as UniversityDateCategory,
        label: data.label,
        dueDate: data.dueDate.toISOString(),
        notes: data.notes,
      };
      
      await apiRequest(`/api/universities/${universityId}/dates/${editingDate.id}`, "PUT", requestData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/universities", universityId, "dates"] });
      toast({
        title: "Success",
        description: "Date updated successfully.",
      });
      setEditingDate(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update date.",
        variant: "destructive",
      });
    },
  });

  // Delete date mutation
  const deleteDate = useMutation({
    mutationFn: async (dateId: number) => {
      await apiRequest(`/api/universities/${universityId}/dates/${dateId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/universities", universityId, "dates"] });
      toast({
        title: "Success",
        description: "Date deleted successfully.",
      });
      setDeletingDate(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete date.",
        variant: "destructive",
      });
    },
  });

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupName) 
        ? prev.filter(g => g !== groupName)
        : [...prev, groupName]
    );
  };

  const getGroupDates = (groupName: string) => {
    const group = DATE_CATEGORY_GROUPS[groupName as keyof typeof DATE_CATEGORY_GROUPS];
    if (!dates || !group) return [];
    
    return dates.filter(date => (group.categories as readonly string[]).includes(date.category));
  };

  const getTotalDatesCount = () => dates?.length || 0;
  const getUpcomingDatesCount = () => {
    const now = new Date();
    return dates?.filter(date => new Date(date.dueDate) > now).length || 0;
  };

  const getDateStatus = (date: UniversityDate) => {
    const now = new Date();
    const dueDate = new Date(date.dueDate);
    const threeDaysFromNow = addDays(now, 3);

    if (isBefore(dueDate, now)) {
      return { status: "passed", color: "gray", icon: CheckCircle2 };
    } else if (isBefore(dueDate, threeDaysFromNow)) {
      return { status: "urgent", color: "red", icon: AlertTriangle };
    } else {
      return { status: "upcoming", color: "blue", icon: Clock };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    
    return {
      formatted: format(date, "MMM d, yyyy"),
      relative: formatDistanceToNow(date, { addSuffix: true }),
      time: format(date, "h:mm a")
    };
  };

  const handleSubmit = (data: FormData) => {
    if (editingDate) {
      updateDate.mutate(data);
    } else {
      createDate.mutate(data);
    }
  };

  const openAddDialog = (groupName?: string) => {
    setPreselectedGroup(groupName || "");
    setIsAddDialogOpen(true);
    
    if (groupName) {
      const group = DATE_CATEGORY_GROUPS[groupName as keyof typeof DATE_CATEGORY_GROUPS];
      if (group && group.categories.length > 0) {
        form.setValue("category", group.categories[0]);
      }
    }
  };

  const openEditDialog = (date: UniversityDate) => {
    setEditingDate(date);
    form.reset({
      category: date.category,
      label: date.label,
      dueDate: new Date(date.dueDate),
      notes: date.notes || "",
    });
  };

  // Get available date types for the selected category
  const getAvailableDateTypes = (): readonly string[] => {
    if (!selectedCategory) return [];
    
    for (const [groupName, groupConfig] of Object.entries(DATE_CATEGORY_GROUPS)) {
      if ((groupConfig.categories as readonly string[]).includes(selectedCategory)) {
        return (groupConfig.dateTypes as any)[selectedCategory] || [];
      }
    }
    return [];
  };

  if (isLoading) {
    return (
      <Card data-testid="date-management-loading">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="date-management-error">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center text-center py-8">
            <div className="space-y-2">
              <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
              <p className="text-sm text-gray-600">Failed to load university dates</p>
              <p className="text-xs text-gray-500">Please try refreshing the page</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="date-management-container">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Important Dates
            </CardTitle>
            <div className="flex gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <CalendarDays className="w-4 h-4" />
                {getTotalDatesCount()} total dates
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {getUpcomingDatesCount()} upcoming
              </span>
            </div>
          </div>
          {canEdit && (
            <Button 
              onClick={() => openAddDialog()}
              size="sm"
              data-testid="button-add-date"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Date
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-4">
            {Object.entries(DATE_CATEGORY_GROUPS).map(([groupName, groupConfig]) => {
              const groupDates = getGroupDates(groupName);
              const isExpanded = expandedGroups.includes(groupName);
              const Icon = groupConfig.icon;
              
              return (
                <div key={groupName} className="border rounded-lg">
                  <button
                    onClick={() => toggleGroup(groupName)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    data-testid={`button-toggle-${groupName.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 text-${groupConfig.color}-600`} />
                      <span className="font-medium">{groupName}</span>
                      <Badge 
                        variant="secondary" 
                        className={`text-${groupConfig.color}-700 bg-${groupConfig.color}-100`}
                      >
                        {groupDates.length} dates
                      </Badge>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  
                  {isExpanded && (
                    <div className="border-t bg-gray-50/50 p-4 space-y-4">
                      {/* Existing Dates */}
                      {groupDates.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-medium text-sm text-gray-700 uppercase tracking-wide">
                            Scheduled Dates
                          </h4>
                          {groupDates
                            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                            .map((date) => {
                              const dateInfo = formatDate(date.dueDate.toString());
                              const status = getDateStatus(date);
                              const StatusIcon = status.icon;

                              return (
                                <div 
                                  key={date.id} 
                                  className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow"
                                  data-testid={`date-item-${date.id}`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-2">
                                        <StatusIcon className={`w-4 h-4 text-${status.color}-600`} />
                                        <span className="font-medium text-gray-900">{date.label}</span>
                                        <Badge 
                                          variant="secondary" 
                                          className={`text-${status.color}-700 bg-${status.color}-100`}
                                        >
                                          {status.status}
                                        </Badge>
                                      </div>
                                      
                                      <div className="space-y-1 text-sm text-gray-600">
                                        <div className="flex items-center gap-2">
                                          <CalendarIcon className="w-3 h-3" />
                                          <span>{dateInfo.formatted}</span>
                                          <span className="text-gray-500">({dateInfo.relative})</span>
                                        </div>
                                        
                                        {date.notes && (
                                          <p className="text-gray-700 mt-2">{date.notes}</p>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {canEdit && (
                                      <div className="flex items-center gap-1 ml-4">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => openEditDialog(date)}
                                          data-testid={`button-edit-date-${date.id}`}
                                        >
                                          <Edit className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => setDeletingDate(date)}
                                          data-testid={`button-delete-date-${date.id}`}
                                        >
                                          <Trash2 className="w-3 h-3 text-red-600" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}

                      {/* Add Date Button */}
                      {canEdit && (
                        <>
                          {groupDates.length > 0 && <Separator />}
                          <div className="text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAddDialog(groupName)}
                              data-testid={`button-add-date-${groupName.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Add Date to {groupName}
                            </Button>
                          </div>
                        </>
                      )}

                      {/* Empty State */}
                      {groupDates.length === 0 && (
                        <div className="text-center py-8">
                          <CalendarIcon className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                          <p className="text-sm text-gray-600 mb-3">No dates added for this category</p>
                          {canEdit && (
                            <Button
                              size="sm"
                              onClick={() => openAddDialog(groupName)}
                              data-testid={`button-add-first-${groupName.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Add Date
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            
            {getTotalDatesCount() === 0 && (
              <div className="text-center py-12" data-testid="empty-state">
                <CalendarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No dates added yet</h3>
                <p className="text-gray-600 mb-4">
                  Start by adding important deadlines and dates for this university.
                </p>
                {canEdit && (
                  <Button 
                    onClick={() => openAddDialog()}
                    data-testid="button-add-first-date"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Date
                  </Button>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen || !!editingDate} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setEditingDate(null);
          form.reset();
        }
      }}>
        <DialogContent className="max-w-md" data-testid="add-edit-date-dialog">
          <DialogHeader>
            <DialogTitle>
              {editingDate ? "Edit Date" : "Add New Date"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {/* Category Selection */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-category">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(DATE_CATEGORY_GROUPS).map(([groupName, groupConfig]) => (
                          <div key={groupName}>
                            <div className="px-2 py-1.5 text-sm font-medium text-gray-500 bg-gray-50">
                              {groupName}
                            </div>
                            {groupConfig.categories.map((category) => (
                              <SelectItem 
                                key={category} 
                                value={category}
                                data-testid={`select-category-${category}`}
                              >
                                {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date Type/Label Selection */}
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date Type</FormLabel>
                    {selectedCategory ? (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-date-type">
                            <SelectValue placeholder="Select a date type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {getAvailableDateTypes().map((type) => (
                            <SelectItem 
                              key={type} 
                              value={type}
                              data-testid={`select-date-type-${type.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              {type}
                            </SelectItem>
                          ))}
                          <SelectItem value="custom" data-testid="select-date-type-custom">
                            Custom (enter below)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <FormControl>
                        <Input
                          placeholder="Enter custom date type"
                          {...field}
                          data-testid="input-custom-date-type"
                        />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Custom label input when "custom" is selected */}
              {form.watch("label") === "custom" && selectedCategory && (
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field: customField }) => (
                    <FormItem>
                      <FormLabel>Custom Date Type</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter custom date type name"
                          value={customField.value === "custom" ? "" : customField.value}
                          onChange={(e) => customField.onChange(e.target.value)}
                          data-testid="input-custom-label"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Due Date */}
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="button-select-date"
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add any additional notes or details..."
                        className="min-h-[80px]"
                        {...field}
                        data-testid="textarea-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingDate(null);
                    form.reset();
                  }}
                  disabled={createDate.isPending || updateDate.isPending}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createDate.isPending || updateDate.isPending}
                  data-testid="button-save"
                >
                  {(createDate.isPending || updateDate.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingDate ? "Update Date" : "Add Date"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingDate} onOpenChange={() => setDeletingDate(null)}>
        <AlertDialogContent data-testid="delete-date-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Date</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingDate?.label}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingDate && deleteDate.mutate(deletingDate.id)}
              disabled={deleteDate.isPending}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              {deleteDate.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}