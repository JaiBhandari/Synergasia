import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

const addUniversitySchema = z.object({
  name: z.string().min(1, "University name is required"),
  website: z.string().optional(),
  overallRanking: z.coerce.number().min(1, "Ranking must be 1 or greater").optional().nullable(),
  subjectRankings: z.string().optional(), // Will be converted to array on submit
  courseLink: z.string().optional(),
  location: z.string().optional(),
  cityDescription: z.string().optional(),
  campusSetting: z.string().optional(),
  academicGrade: z.string().optional(),
  safetyGrade: z.string().optional(),
  tuitionFee: z.string().optional(),
  totalCostOfAttendance: z.string().optional(),
  admissionRate: z.string().optional(),
  intlUndergrad: z.string().optional(),
  intlTotal: z.string().optional(),
  additionalAcademicRequirements: z.string().optional(),
  financialAidInfo: z.string().optional(),
  coopInternshipPrograms: z.string().optional(),
  additionalRemarks: z.string().optional(),
});

type AddUniversityForm = z.infer<typeof addUniversitySchema>;

interface AddUniversityDialogProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function AddUniversityDialog({ 
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange
}: AddUniversityDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const open = controlledOpen ?? internalOpen;
  const onOpenChange = controlledOnOpenChange ?? setInternalOpen;

  const form = useForm<AddUniversityForm>({
    resolver: zodResolver(addUniversitySchema),
    defaultValues: {
      name: "",
      website: "",
      overallRanking: undefined,
      subjectRankings: "",
      courseLink: "",
      location: "",
      cityDescription: "",
      campusSetting: "",
      academicGrade: "",
      safetyGrade: "",
      tuitionFee: "",
      totalCostOfAttendance: "",
      admissionRate: "",
      intlUndergrad: "",
      intlTotal: "",
      additionalAcademicRequirements: "",
      financialAidInfo: "",
      coopInternshipPrograms: "",
      additionalRemarks: "",
    },
  });

  const createUniversityMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/universities", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/universities"] });
      toast({
        title: "Success",
        description: "University added successfully",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) return;
      toast({
        title: "Error",
        description: error.message || "Failed to add university",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AddUniversityForm) => {
    // Convert subject rankings string to array
    const subjectRankingsArray = data.subjectRankings 
      ? data.subjectRankings.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const submitData = {
      ...data,
      subjectRankings: subjectRankingsArray.length > 0 ? subjectRankingsArray : null,
      overallRanking: data.overallRanking || null,
    };

    createUniversityMutation.mutate(submitData);
  };

  const dialogContent = (
    <DialogContent className="max-w-3xl max-h-[90vh]">
      <DialogHeader>
        <DialogTitle>Add University</DialogTitle>
      </DialogHeader>
      
      <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>
              
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>University Name <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="Enter university name" {...field} data-testid="input-university-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} data-testid="input-website" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="City, State/Country" {...field} data-testid="input-location" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="campusSetting"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Campus Setting</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Urban, Suburban, Rural" {...field} data-testid="input-campus-setting" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cityDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Describe the city and surrounding area..." {...field} data-testid="input-city-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Rankings & Academic */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">Rankings & Academic Information</h3>
              
              <FormField
                control={form.control}
                name="overallRanking"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Overall Ranking</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="e.g., 50" 
                        {...field} 
                        value={field.value ?? ""} 
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-ranking" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subjectRankings"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject Rankings</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter comma-separated subject rankings (e.g., Computer Science: #5, Engineering: #10)" 
                        {...field} 
                        data-testid="input-subject-rankings"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="academicGrade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Academic Grade</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., A+, A, B+" {...field} data-testid="input-academic-grade" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="safetyGrade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Safety Grade</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., A+, A, B+" {...field} data-testid="input-safety-grade" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="courseLink"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course Link</FormLabel>
                    <FormControl>
                      <Input placeholder="URL to course catalog" {...field} data-testid="input-course-link" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Financial Information */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">Financial Information</h3>
              
              <FormField
                control={form.control}
                name="tuitionFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tuition Fee</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., $50,000/year" {...field} data-testid="input-tuition-fee" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="totalCostOfAttendance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Cost of Attendance</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., $70,000/year" {...field} data-testid="input-total-cost" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="financialAidInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Financial Aid Information</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Details about financial aid, scholarships, etc." {...field} data-testid="input-financial-aid" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Admissions */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">Admissions Information</h3>
              
              <FormField
                control={form.control}
                name="admissionRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admission Rate</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 15%, 20%" {...field} data-testid="input-admission-rate" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="additionalAcademicRequirements"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Academic Requirements</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any specific academic requirements for admission..." {...field} data-testid="input-academic-requirements" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* International Students */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">International Students</h3>
              
              <FormField
                control={form.control}
                name="intlUndergrad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>% International Undergrad</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 12%" {...field} data-testid="input-intl-undergrad" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="intlTotal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>% International Total</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 18%" {...field} data-testid="input-intl-total" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Programs & Other */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">Programs & Other Information</h3>
              
              <FormField
                control={form.control}
                name="coopInternshipPrograms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Co-op/Internship Programs</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Details about co-op and internship opportunities..." {...field} data-testid="input-coop-internship" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="additionalRemarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Remarks</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any additional information..." {...field} data-testid="input-additional-remarks" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createUniversityMutation.isPending}
                data-testid="button-submit"
              >
                {createUniversityMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Add University
              </Button>
            </div>
          </form>
        </Form>
      </ScrollArea>
    </DialogContent>
  );

  if (children) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {dialogContent}
    </Dialog>
  );
}
