import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save, User, GraduationCap, Activity, Target, Lock, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

const editStudentSchema = z.object({
  profileStatus: z.enum(["incomplete", "in_progress", "complete"]),
});

type EditStudentForm = z.infer<typeof editStudentSchema>;

interface EditStudentProps {
  studentId?: string;
}

export default function CounselorEditStudent({ studentId }: EditStudentProps) {
  const id = studentId;
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [localFieldValues, setLocalFieldValues] = useState<Record<number, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<number, string>>({});

  const { data: student, isLoading: studentLoading } = useQuery<any>({
    queryKey: [`/api/students/${id}`],
    enabled: !!id,
  });

  const { data: profileFields = [] } = useQuery<any[]>({
    queryKey: ["/api/profile-fields"],
  });

  const { data: studentProfile = [] } = useQuery<any[]>({
    queryKey: [`/api/students/${id}/profile`],
    enabled: !!id,
  });

  const form = useForm<EditStudentForm>({
    resolver: zodResolver(editStudentSchema),
    defaultValues: {
      profileStatus: "incomplete",
    },
  });

  useEffect(() => {
    if (student) {
      form.reset({
        profileStatus: student.profileStatus || "incomplete",
      });
    }
  }, [student, form]);

  // Reset local state when switching to a different student.
  useEffect(() => {
    setLocalFieldValues({});
    setFieldErrors({});
  }, [id]);

  // Initialise controlled field values from the DB profile on load/refresh.
  // Only sets values that haven't been locally edited yet (undefined), so
  // in-progress edits are never overwritten by a background refetch.
  useEffect(() => {
    if (studentProfile && Array.isArray(studentProfile) && studentProfile.length > 0) {
      setLocalFieldValues(prev => {
        const next = { ...prev };
        studentProfile.forEach((p: any) => {
          if (next[p.fieldId] === undefined) {
            next[p.fieldId] = p.value || "";
          }
        });
        return next;
      });
    }
  }, [studentProfile]);

  const updateStudentMutation = useMutation({
    mutationFn: async (data: EditStudentForm) => {
      if (!id) {
        throw new Error("Student ID is required");
      }
      return await apiRequest("/api/students/" + id, "PATCH", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Student status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      queryClient.invalidateQueries({ queryKey: [`/api/students/${id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update student",
        variant: "destructive",
      });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { fieldId: number; value: string }) => {
      if (!id) {
        throw new Error("Student ID is required");
      }
      return await apiRequest(`/api/students/${id}/profile`, "PUT", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/students/${id}/profile`] });
      toast({
        title: "Success",
        description: "Profile field updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile field",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditStudentForm) => {
    updateStudentMutation.mutate(data);
  };

  // Update local state while the counselor is typing; clears any prior error.
  const handleProfileFieldChange = (fieldId: number, value: string) => {
    setLocalFieldValues(prev => ({ ...prev, [fieldId]: value }));
    if (fieldErrors[fieldId]) {
      setFieldErrors(prev => ({ ...prev, [fieldId]: "" }));
    }
  };

  // Called on blur (text/textarea) or onChange (select).
  // Validates required fields before calling the API.
  const handleProfileFieldUpdate = (fieldId: number, value: string) => {
    const field = profileFields.find((f: any) => f.id === fieldId);
    if (field?.isRequired && !value.trim()) {
      setFieldErrors(prev => ({
        ...prev,
        [fieldId]: "This field is required",
      }));
      toast({
        title: "Validation error",
        description: `${field.fieldLabel || field.fieldName} is required`,
        variant: "destructive",
      });
      return;
    }
    setFieldErrors(prev => ({ ...prev, [fieldId]: "" }));
    updateProfileMutation.mutate({ fieldId, value });
  };

  const getProfileFieldValue = (fieldId: number) => {
    return localFieldValues[fieldId] ?? "";
  };

  const isFieldConfirmed = (fieldId: number) => {
    const profileEntry = studentProfile.find((p: any) => p.fieldId === fieldId);
    return profileEntry?.isConfirmed || false;
  };

  if (studentLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Student Not Found</h2>
          <Button onClick={() => setLocation("/counselor/students")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Students
          </Button>
        </div>
      </div>
    );
  }

  const profileFieldsByCategory = profileFields.reduce((acc: any, field: any) => {
    const categoryName = field.category?.name || field.category || "other";
    if (!acc[categoryName]) acc[categoryName] = [];
    acc[categoryName].push(field);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => setLocation("/counselor/students")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Students
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Student Profile</h1>
            <p className="text-gray-600">
              {student.user?.firstName ? 
                `${student.user.firstName} ${student.user.lastName || ""}`.trim() : 
                student.user?.email || `Student ${student.id}`
              }
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Student Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student ID</label>
                <p className="text-gray-900 font-mono bg-gray-50 px-3 py-2 rounded border">STU-{student.adminStudentId}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded border">
                  {student.user?.firstName ? 
                    `${student.user.firstName} ${student.user.lastName || ""}`.trim() : 
                    "No name provided"
                  }
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded border">
                  {student.user?.email || "No email provided"}
                </p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="profileStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profile Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="incomplete">Incomplete</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="complete">Complete</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    disabled={updateStudentMutation.isPending}
                    className="w-full"
                    data-testid="button-update-status"
                  >
                    {updateStudentMutation.isPending ? (
                      "Saving..."
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Update Status
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </div>
          </CardContent>
        </Card>

        {/* Profile Fields */}
        <div className="space-y-6">
          {Object.entries(profileFieldsByCategory).map(([category, fields]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 capitalize">
                  {category === "main_profile" && <User className="w-5 h-5" />}
                  {category === "academics" && <GraduationCap className="w-5 h-5" />}
                  {category === "supercurricular" && <Activity className="w-5 h-5" />}
                  {category === "extracurricular" && <Target className="w-5 h-5" />}
                  {category.replace("_", " ")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(fields as any[]).map((field: any) => (
                  <div key={field.id}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        {field.fieldLabel || field.fieldName}
                        {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <div className="flex gap-1">
                        {isFieldConfirmed(field.id) && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Confirmed
                          </Badge>
                        )}
                        {!field.isEditable && (
                          <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                            <Lock className="w-3 h-3 mr-1" />
                            Protected
                          </Badge>
                        )}
                      </div>
                    </div>
                    {(field.fieldType === "text" || field.fieldType === "email" || field.fieldType === "number" || field.fieldType === "date") && (
                      <>
                        <Input
                          type={field.fieldType === "number" ? "number" : field.fieldType === "email" ? "email" : field.fieldType === "date" ? "date" : "text"}
                          value={getProfileFieldValue(field.id)}
                          onChange={(e) => handleProfileFieldChange(field.id, e.target.value)}
                          onBlur={(e) => handleProfileFieldUpdate(field.id, e.target.value)}
                          placeholder={field.placeholder || ""}
                          className={fieldErrors[field.id] ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                        {fieldErrors[field.id] && (
                          <p className="text-red-500 text-xs mt-1">{fieldErrors[field.id]}</p>
                        )}
                      </>
                    )}
                    {field.fieldType === "textarea" && (
                      <>
                        <Textarea
                          value={getProfileFieldValue(field.id)}
                          onChange={(e) => handleProfileFieldChange(field.id, e.target.value)}
                          onBlur={(e) => handleProfileFieldUpdate(field.id, e.target.value)}
                          placeholder={field.placeholder || ""}
                          rows={3}
                          className={fieldErrors[field.id] ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                        {fieldErrors[field.id] && (
                          <p className="text-red-500 text-xs mt-1">{fieldErrors[field.id]}</p>
                        )}
                      </>
                    )}
                    {field.fieldType === "select" && field.options && (
                      <>
                        <Select
                          value={getProfileFieldValue(field.id)}
                          onValueChange={(value) => {
                            handleProfileFieldChange(field.id, value);
                            handleProfileFieldUpdate(field.id, value);
                          }}
                        >
                          <SelectTrigger className={fieldErrors[field.id] ? "border-red-500" : ""}>
                            <SelectValue placeholder={field.placeholder || "Select option"} />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options.map((option: string) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fieldErrors[field.id] && (
                          <p className="text-red-500 text-xs mt-1">{fieldErrors[field.id]}</p>
                        )}
                      </>
                    )}
                    {!field.fieldType && (
                      <>
                        <Input
                          value={getProfileFieldValue(field.id)}
                          onChange={(e) => handleProfileFieldChange(field.id, e.target.value)}
                          onBlur={(e) => handleProfileFieldUpdate(field.id, e.target.value)}
                          placeholder={field.placeholder || ""}
                          className={fieldErrors[field.id] ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                        {fieldErrors[field.id] && (
                          <p className="text-red-500 text-xs mt-1">{fieldErrors[field.id]}</p>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
