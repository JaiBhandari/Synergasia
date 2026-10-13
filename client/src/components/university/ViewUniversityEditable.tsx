import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, 
  Edit,
  Save,
  X,
  ExternalLink, 
  MapPin, 
  Trophy, 
  Building, 
  DollarSign, 
  GraduationCap
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import type { University as UniversityType } from "@shared/schema";

interface ViewUniversityEditableProps {
  universityId?: string;
}

const editUniversitySchema = z.object({
  name: z.string().min(1, "University name is required"),
  website: z.string().optional(),
  location: z.string().optional(),
  overallRanking: z.coerce.number().optional().nullable(),
  subjectRankings: z.string().optional(),
  courseLink: z.string().optional(),
  campusSetting: z.string().optional(),
  cityDescription: z.string().optional(),
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

type EditUniversityForm = z.infer<typeof editUniversitySchema>;

export default function ViewUniversityEditable({ universityId }: ViewUniversityEditableProps) {
  const [location, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const backUrl = user?.role === 'counselor' ? '/counselor/universities' : '/admin/universities';

  const { data: universities, isLoading } = useQuery<UniversityType[]>({
    queryKey: ["/api/universities"],
  });

  const university = universities?.find(u => u.id === Number(universityId));

  const form = useForm<EditUniversityForm>({
    resolver: zodResolver(editUniversitySchema),
    values: university ? {
      name: university.name || "",
      website: university.website || "",
      location: university.location || "",
      overallRanking: university.overallRanking || undefined,
      subjectRankings: university.subjectRankings?.join(', ') || "",
      courseLink: university.courseLink || "",
      campusSetting: university.campusSetting || "",
      cityDescription: university.cityDescription || "",
      academicGrade: university.academicGrade || "",
      safetyGrade: university.safetyGrade || "",
      tuitionFee: university.tuitionFee || "",
      totalCostOfAttendance: university.totalCostOfAttendance || "",
      admissionRate: university.admissionRate || "",
      intlUndergrad: university.intlUndergrad || "",
      intlTotal: university.intlTotal || "",
      additionalAcademicRequirements: university.additionalAcademicRequirements || "",
      financialAidInfo: university.financialAidInfo || "",
      coopInternshipPrograms: university.coopInternshipPrograms || "",
      additionalRemarks: university.additionalRemarks || "",
    } : undefined,
  });

  const updateUniversityMutation = useMutation({
    mutationFn: async (data: EditUniversityForm) => {
      const submitData = {
        ...data,
        subjectRankings: data.subjectRankings 
          ? data.subjectRankings.split(',').map(s => s.trim()).filter(Boolean)
          : null,
        overallRanking: data.overallRanking || null,
      };
      await apiRequest(`/api/universities/${universityId}`, "PUT", submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/universities"] });
      toast({
        title: "Success",
        description: "University updated successfully",
      });
      setIsEditing(false);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) return;
      toast({
        title: "Error",
        description: error.message || "Failed to update university",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditUniversityForm) => {
    updateUniversityMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!university) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">University not found</p>
        <Button onClick={() => setLocation(backUrl)} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Universities
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => setLocation(backUrl)}>
              Universities
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink>{university.name}</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{university.name}</h1>
          <div className="flex items-center gap-2 mt-2 text-gray-600">
            {university.location && (
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <span>{university.location}</span>
              </div>
            )}
            {university.overallRanking && (
              <div className="flex items-center gap-1 ml-4">
                <Trophy className="w-4 h-4" />
                <span>Rank #{university.overallRanking}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsEditing(false);
                  form.reset();
                }}
                disabled={updateUniversityMutation.isPending}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button 
                onClick={form.handleSubmit(onSubmit)}
                disabled={updateUniversityMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {updateUniversityMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setLocation(backUrl)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={() => setIsEditing(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </>
          )}
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-250px)]">
        <Form {...form}>
          <form className="space-y-6 pr-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>University Name <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!isEditing} data-testid="input-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={!isEditing} data-testid="input-location" />
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
                          <Input {...field} disabled={!isEditing} data-testid="input-campus-setting" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={!isEditing} data-testid="input-website" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="cityDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} disabled={!isEditing} data-testid="input-city-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Academic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5" />
                  Academic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="overallRanking"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Overall Ranking</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            disabled={!isEditing} 
                            data-testid="input-ranking" 
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
                          <Input {...field} disabled={!isEditing} data-testid="input-academic-grade" />
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
                          <Input {...field} disabled={!isEditing} data-testid="input-safety-grade" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="admissionRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Admission Rate</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={!isEditing} data-testid="input-admission-rate" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="courseLink"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Course Link</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={!isEditing} data-testid="input-course-link" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="subjectRankings"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject Rankings</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          disabled={!isEditing} 
                          placeholder="Enter comma-separated rankings (e.g., Computer Science: #5, Engineering: #10)"
                          data-testid="input-subject-rankings" 
                        />
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
                        <Textarea {...field} disabled={!isEditing} data-testid="input-academic-requirements" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Financial Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Financial Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tuitionFee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tuition Fee</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={!isEditing} data-testid="input-tuition-fee" />
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
                          <Input {...field} disabled={!isEditing} data-testid="input-total-cost" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="financialAidInfo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Financial Aid Information</FormLabel>
                      <FormControl>
                        <Textarea {...field} disabled={!isEditing} data-testid="input-financial-aid" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* International Students */}
            <Card>
              <CardHeader>
                <CardTitle>International Students</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="intlUndergrad"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>% International Undergrad</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={!isEditing} data-testid="input-intl-undergrad" />
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
                          <Input {...field} disabled={!isEditing} data-testid="input-intl-total" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Programs & Other */}
            <Card>
              <CardHeader>
                <CardTitle>Programs & Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="coopInternshipPrograms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Co-op/Internship Programs</FormLabel>
                      <FormControl>
                        <Textarea {...field} disabled={!isEditing} data-testid="input-coop-internship" />
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
                        <Textarea {...field} disabled={!isEditing} data-testid="input-additional-remarks" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </form>
        </Form>
      </ScrollArea>
    </div>
  );
}
