import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, Trophy, BookOpen, FlaskConical, Briefcase, GraduationCap, MessageSquare, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { formatDate } from "@/lib/utils";

const activityTypes = [
  { value: "competitions", label: "Competitions", icon: Trophy },
  { value: "projects", label: "Projects", icon: BookOpen },
  { value: "research", label: "Research", icon: FlaskConical },
  { value: "internships", label: "Internships", icon: Briefcase },
  { value: "online_courses", label: "Online Courses", icon: GraduationCap },
];

const activitySchema = z.object({
  type: z.enum(["competitions", "projects", "research", "internships", "online_courses"]),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  status: z.string().min(1, "Status is required"),
  achievements: z.string().optional(),
  skills: z.string().optional(),
  awards: z.string().optional(),
}).refine((data) => {
  // If endDate is provided, ensure it's not before startDate
  if (data.endDate && data.startDate) {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    return endDate >= startDate;
  }
  return true;
}, {
  message: "End date cannot be before start date",
  path: ["endDate"], // This will show the error on the endDate field
});

interface ActivityLockerProps {
  studentId: number;
  isReadOnly?: boolean;
  userRole?: string;
}

export default function ActivityLocker({ studentId, isReadOnly = false, userRole }: ActivityLockerProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<any>(null);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const { toast } = useToast();

  const form = useForm<z.infer<typeof activitySchema>>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      type: selectedType === "all" ? "competitions" : selectedType as any,
      title: "",
      description: "",
      startDate: "",
      endDate: "",
      status: "",
      achievements: "",
      skills: "",
      awards: "",
    },
  });

  const editForm = useForm<z.infer<typeof activitySchema>>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      type: "competitions",
      title: "",
      description: "",
      startDate: "",
      endDate: "",
      status: "",
      achievements: "",
      skills: "",
      awards: "",
    },
  });

  // Get the query client instance
  const queryClient = useQueryClient();

  // Fetch activities
  const { data: activities, isLoading, refetch } = useQuery({
    queryKey: [`/api/students/${studentId}/activities`],
    enabled: !!studentId,
    staleTime: 10000, // Cache for 10 seconds (architect recommended 5-15s)
  });

  const activitiesArray = activities ? (Array.isArray(activities) ? activities : []) : [];

  // Fetch activity feedback - prefetch it immediately without loading state
  const { data: activityFeedback, isLoading: isFeedbackLoading, refetch: refetchFeedback } = useQuery({
    queryKey: [`/api/activity-feedback/${selectedActivity?.id}`],
    enabled: !!selectedActivity?.id,
    staleTime: 15000, // Cache for 15 seconds (architect recommended 5-15s)
    gcTime: 30 * 1000, // Keep in cache for 30 seconds
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  const feedbackArray = activityFeedback ? (Array.isArray(activityFeedback) ? activityFeedback : []) : [];

  // Create activity mutation
  const createActivityMutation = useMutation({
    mutationFn: async (data: z.infer<typeof activitySchema>) => {
      const activityData = {
        ...data,
        startDate: data.startDate ? new Date(data.startDate).toISOString() : undefined,
        endDate: data.endDate ? new Date(data.endDate).toISOString() : undefined,
      };
      const response = await apiRequest("/api/activities", "POST", activityData);
      return response.json();
    },
    onSuccess: async (newActivity) => {
      const queryKey = [`/api/students/${studentId}/activities`];
      
      // Update cache with the new activity from server
      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData || !Array.isArray(oldData)) {
          return [newActivity];
        }
        
        // Check if activity already exists (avoid duplicates)
        const exists = oldData.some((activity: any) => activity.id === newActivity.id);
        if (exists) {
          return oldData;
        }
        
        return [newActivity, ...oldData];
      });
      
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey });
      
      setIsAddModalOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Activity added successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update activity mutation
  const updateActivityMutation = useMutation({
    mutationFn: async (data: { id: number; updates: z.infer<typeof activitySchema> }) => {
      const activityData = {
        ...data.updates,
        startDate: data.updates.startDate ? new Date(data.updates.startDate).toISOString() : undefined,
        endDate: data.updates.endDate ? new Date(data.updates.endDate).toISOString() : undefined,
      };
      const response = await apiRequest(`/api/activities/${data.id}`, "PUT", activityData);
      return response.json();
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      const queryKey = [`/api/students/${studentId}/activities`];
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousActivities = queryClient.getQueryData(queryKey);

      // Optimistically update to the new value - instant UI update
      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData || !Array.isArray(oldData)) {
          return oldData;
        }
        
        return oldData.map(activity => 
          activity.id === variables.id ? { ...activity, ...variables.updates } : activity
        );
      });

      return { previousActivities };
    },
    onError: (error, variables, context) => {
      // If the mutation fails, use the context to roll back
      const queryKey = [`/api/students/${studentId}/activities`];
      if (context?.previousActivities) {
        queryClient.setQueryData(queryKey, context.previousActivities);
      }
      
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: (updatedActivity, variables) => {
      // Update with actual server response
      const queryKey = [`/api/students/${studentId}/activities`];
      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData || !Array.isArray(oldData)) return oldData;
        return oldData.map(activity => 
          activity.id === variables.id ? updatedActivity : activity
        );
      });
      
      setIsEditModalOpen(false);
      setEditingActivity(null);
      editForm.reset();
      toast({
        title: "Success", 
        description: "Activity updated successfully",
      });
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      const queryKey = [`/api/students/${studentId}/activities`];
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Delete activity mutation
  const deleteActivityMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/activities/${id}`, "DELETE");
      return id;
    },
    onMutate: async (deletedId) => {
      // Cancel any outgoing refetches
      const queryKey = [`/api/students/${studentId}/activities`];
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousActivities = queryClient.getQueryData(queryKey);

      // Optimistically remove from UI immediately
      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData || !Array.isArray(oldData)) {
          return oldData;
        }
        
        return oldData.filter(activity => activity.id !== deletedId);
      });

      return { previousActivities };
    },
    onError: (error, variables, context) => {
      // Roll back on error
      const queryKey = [`/api/students/${studentId}/activities`];
      if (context?.previousActivities) {
        queryClient.setQueryData(queryKey, context.previousActivities);
      }
      
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Activity deleted successfully",
      });
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      const queryKey = [`/api/students/${studentId}/activities`];
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Add feedback mutation
  const addFeedbackMutation = useMutation({
    mutationFn: async (data: { activityId: number; feedback: string }) => {
      await apiRequest("/api/activity-feedback", "POST", data);
    },
    onSuccess: async () => {
      // Immediately invalidate and refetch the feedback data
      await queryClient.invalidateQueries({ 
        queryKey: [`/api/activity-feedback/${selectedActivity?.id}`],
        refetchType: 'active' // Force active refetch
      });
      // Also trigger manual refetch to ensure immediate update
      await refetchFeedback();
      toast({
        title: "Success",
        description: "Feedback added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof activitySchema>) => {
    createActivityMutation.mutate(data);
  };

  const onEditSubmit = (data: z.infer<typeof activitySchema>) => {
    if (editingActivity) {
      updateActivityMutation.mutate({ id: editingActivity.id, updates: data });
    }
  };

  const handleEditActivity = (activity: any) => {
    setEditingActivity(activity);
    editForm.reset({
      type: activity.type,
      title: activity.title,
      description: activity.description,
      startDate: new Date(activity.startDate).toISOString().split('T')[0],
      endDate: activity.endDate ? new Date(activity.endDate).toISOString().split('T')[0] : "",
      status: activity.status,
      achievements: activity.achievements || "",
      skills: activity.skills || "",
      awards: activity.awards || "",
    });
    setIsEditModalOpen(true);
  };

  const handleViewFeedback = (activity: any) => {
    setSelectedActivity(activity);
    setIsFeedbackModalOpen(true);
  };

  const filteredActivities = activitiesArray.filter((activity: any) => {
    // Filter by type
    const typeMatch = selectedType === "all" || activity.type === selectedType;
    
    // Filter by status
    const statusMatch = selectedStatus === "all" || activity.status === selectedStatus;
    
    // Filter by search query (search in title and description)
    const searchLower = searchQuery.toLowerCase();
    const searchMatch = !searchQuery || 
      activity.title.toLowerCase().includes(searchLower) ||
      activity.description.toLowerCase().includes(searchLower) ||
      (activity.achievements && activity.achievements.toLowerCase().includes(searchLower)) ||
      (activity.skills && activity.skills.toLowerCase().includes(searchLower)) ||
      (activity.awards && activity.awards.toLowerCase().includes(searchLower));
    
    return typeMatch && statusMatch && searchMatch;
  });

  const getActivityIcon = (type: string) => {
    const activityType = activityTypes.find(t => t.value === type);
    return activityType ? activityType.icon : BookOpen;
  };

  if (isLoading) {
    return <div className="p-6">Loading activities...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Activity Locker</h2>
          <p className="text-gray-600">
            {isReadOnly 
              ? "View student activities and provide feedback" 
              : "Manage your extracurricular activities, competitions, and achievements"
            }
          </p>
        </div>
        {!isReadOnly && (
          <Button 
            onClick={() => {
              // Reset form with current tab's category
              const defaultType = selectedType === "all" ? "competitions" : selectedType;
              form.reset({
                type: defaultType as any,
                title: "",
                description: "",
                startDate: "",
                endDate: "",
                status: "",
                achievements: "",
                skills: "",
                awards: "",
              });
              setIsAddModalOpen(true);
            }}
            className="bg-primary-500 hover:bg-primary-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Activity
          </Button>
        )}
      </div>

      {/* Search and Filter Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search activities by title, description, achievements, skills, or awards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Status Filter */}
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="planned">Planned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Clear Filters Button */}
          {(searchQuery || selectedStatus !== "all" || selectedType !== "all") && (
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setSelectedStatus("all");
                setSelectedType("all");
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
        
        {/* Results Count */}
        {(searchQuery || selectedStatus !== "all" || selectedType !== "all") && (
          <div className="text-sm text-gray-600">
            Showing {filteredActivities.length} of {activitiesArray.length} activities
          </div>
        )}
      </div>

      {/* Activity Type Filter */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setSelectedType("all")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            selectedType === "all"
              ? "bg-white text-primary-600 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          All Activities ({activitiesArray.length})
        </button>
        {activityTypes.map((type) => {
          const count = activitiesArray.filter((a: any) => a.type === type.value).length;
          return (
            <button
              key={type.value}
              onClick={() => setSelectedType(type.value)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedType === type.value
                  ? "bg-white text-primary-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {type.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Activities Grid */}
      {filteredActivities.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <BookOpen className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No activities found
          </h3>
          <p className="text-gray-600">
            {searchQuery || selectedStatus !== "all" || selectedType !== "all" 
              ? "Try adjusting your search or filters"
              : "Click 'Add Activity' to create your first activity"
            }
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredActivities.map((activity: any) => {
          const IconComponent = getActivityIcon(activity.type);
          return (
            <Card key={activity.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-primary-100 rounded-lg">
                      <IconComponent className="h-5 w-5 text-primary-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{activity.title}</CardTitle>
                      <Badge variant="outline" className="mt-1">
                        {activityTypes.find(t => t.value === activity.type)?.label}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-600 text-sm line-clamp-3">{activity.description}</p>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Start:</span>
                    <span className="font-medium">{formatDate(activity.startDate)}</span>
                  </div>
                  {activity.endDate && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">End:</span>
                      <span className="font-medium">{formatDate(activity.endDate)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Status:</span>
                    <Badge variant={activity.status === "completed" ? "default" : "secondary"}>
                      {activity.status}
                    </Badge>
                  </div>
                </div>

                {(activity.achievements || activity.awards) && (
                  <div className="pt-2 border-t">
                    {activity.achievements && (
                      <p className="text-sm text-gray-600">
                        <strong>Achievements:</strong> {activity.achievements}
                      </p>
                    )}
                    {activity.awards && (
                      <p className="text-sm text-gray-600 mt-1">
                        <strong>Awards:</strong> {activity.awards}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <div className="flex space-x-2">
                    {!isReadOnly && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditActivity(activity)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteActivityMutation.mutate(activity.id)}
                          disabled={deleteActivityMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </>
                    )}
                  </div>
                  {(isReadOnly || userRole === "counselor" || userRole === "admin") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewFeedback(activity)}
                    >
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Feedback
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      )}

      {/* Add Activity Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={(open) => {
        // Only allow closing through Cancel button or successful submission
        if (!open) return;
        setIsAddModalOpen(open);
      }}>
        <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Add New Activity</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Activity Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} key={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activityTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} key={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Activity Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Science Fair Competition" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe your activity, role, and responsibilities..."
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date (Optional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="achievements"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Achievements (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="What did you accomplish? What was the impact?"
                        rows={2}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="skills"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Skills Developed (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Leadership, Programming, Research" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="awards"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Awards/Recognition (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., First Place, Certificate of Excellence" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 bg-primary-500 hover:bg-primary-600"
                  disabled={createActivityMutation.isPending}
                >
                  {createActivityMutation.isPending ? "Adding..." : "Add Activity"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Activity Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={(open) => {
        // Only allow closing through Cancel button or successful submission
        if (!open) return;
        setIsEditModalOpen(open);
      }}>
        <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Edit Activity</DialogTitle>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Activity Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} key={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activityTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} key={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Activity Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Science Fair Competition" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe your activity, role, and responsibilities..."
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date (Optional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="achievements"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Achievements (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="What did you accomplish? What was the impact?"
                        rows={2}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="skills"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Skills Developed (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Leadership, Programming, Research" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="awards"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Awards/Recognition (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., First Place, Certificate of Excellence" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingActivity(null);
                    editForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 bg-primary-500 hover:bg-primary-600"
                  disabled={updateActivityMutation.isPending}
                >
                  {updateActivityMutation.isPending ? "Updating..." : "Update Activity"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Feedback Modal */}
      <Dialog open={isFeedbackModalOpen} onOpenChange={(open) => {
        // Only allow closing through explicit action
        if (!open) return;
        setIsFeedbackModalOpen(open);
      }}>
        <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Activity Feedback - {selectedActivity?.title}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Existing Feedback */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Previous Feedback</h4>
              {isFeedbackLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                </div>
              ) : feedbackArray.length > 0 ? (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {feedbackArray.map((feedback: any) => (
                    <div key={feedback.id} className="p-3 bg-gray-50 rounded-lg overflow-hidden">
                      <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                        <span className="font-medium text-sm text-gray-900 truncate max-w-[150px]">
                          {feedback.counselor?.user?.firstName} {feedback.counselor?.user?.lastName}
                        </span>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {formatDate(feedback.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 break-words whitespace-pre-wrap">{feedback.feedback}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No feedback yet</p>
              )}
            </div>

            {/* Add New Feedback (Counselors/Admins only) */}
            {(userRole === "counselor" || userRole === "admin") && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Add New Feedback</h4>
                  <Textarea 
                    placeholder="Provide constructive feedback on this activity..."
                    rows={3}
                    id="new-feedback"
                  />
                  <Button 
                    className="w-full bg-primary-500 hover:bg-primary-600"
                    onClick={() => {
                      const textarea = document.getElementById("new-feedback") as HTMLTextAreaElement;
                      if (textarea?.value.trim()) {
                        addFeedbackMutation.mutate({
                          activityId: selectedActivity.id,
                          feedback: textarea.value.trim(),
                        });
                        textarea.value = "";
                      }
                    }}
                    disabled={addFeedbackMutation.isPending}
                  >
                    {addFeedbackMutation.isPending ? "Adding..." : "Add Feedback"}
                  </Button>
                </div>
              </>
            )}
            
            {/* Close Button */}
            <div className="pt-4">
              <Button 
                variant="outline"
                className="w-full"
                onClick={() => setIsFeedbackModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}