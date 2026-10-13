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
import { ArrowLeft, Save, User, GraduationCap, Activity, Target, Lock, CheckCircle, Key } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

const editStudentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  phoneNumber: z.string().optional(),
  counselorId: z.union([z.number(), z.null()]).optional(),
  profileStatus: z.enum(["incomplete", "in_progress", "complete"]),
});

const passwordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type EditStudentForm = z.infer<typeof editStudentSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function EditStudent() {
  const { id } = useParams();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  
  // Extract adminStudentId from location if useParams doesn't work
  const adminStudentId = id || location.split('/').pop();

  const { data: student, isLoading: studentLoading } = useQuery<any>({
    queryKey: [`/api/students/by-admin-id/${adminStudentId}`],
    enabled: !!adminStudentId,
  });

  const { data: counselors = [] } = useQuery<any[]>({
    queryKey: ["/api/counselors"],
  });

  const { data: profileFields = [] } = useQuery<any[]>({
    queryKey: ["/api/profile-fields"],
  });

  const { data: studentProfile = [] } = useQuery<any[]>({
    queryKey: [`/api/students/by-admin-id/${adminStudentId}/profile`],
    enabled: !!adminStudentId,
  });

  const form = useForm<EditStudentForm>({
    resolver: zodResolver(editStudentSchema),
    defaultValues: {
      name: "",
      email: "",
      phoneNumber: "",
      counselorId: null,
      profileStatus: "incomplete",
    },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (student) {
      form.reset({
        name: student.user?.firstName ? `${student.user.firstName} ${student.user.lastName || ""}`.trim() : "",
        email: student.user?.email || "",
        phoneNumber: student.user?.phoneNumber || "",
        counselorId: student.counselorId || null,
        profileStatus: student.profileStatus || "incomplete",
      });
    }
  }, [student, form]);

  const updateStudentMutation = useMutation({
    mutationFn: async (data: EditStudentForm) => {
      if (!adminStudentId || !student?.id) {
        throw new Error("Student ID is required");
      }
      console.log("Updating student:", student.adminStudentId, "with data:", data);
      return await apiRequest("/api/students/" + student.adminStudentId, "PATCH", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Student updated successfully",
      });
      // Invalidate all student queries regardless of additional parameters (like searchTerm)
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/students"
      });
      // Also invalidate the specific detail query for this student
      queryClient.invalidateQueries({ queryKey: [`/api/students/by-admin-id/${adminStudentId}`] });
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
      if (!student?.id) {
        throw new Error("Student ID is required");
      }
      return await apiRequest(`/api/students/by-admin-id/${student.adminStudentId}/profile`, "PUT", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/students/by-admin-id/${adminStudentId}/profile`] });
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

  const updatePasswordMutation = useMutation({
    mutationFn: async (data: PasswordForm) => {
      if (!student?.id) {
        throw new Error("Student ID is required");
      }
      return await apiRequest(`/api/students/by-admin-id/${student.adminStudentId}/password`, "PUT", {
        password: data.password,
      });
    },
    onSuccess: () => {
      passwordForm.reset();
      toast({
        title: "Success",
        description: "Password updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditStudentForm) => {
    console.log("Form submitted with data:", data);
    console.log("Form errors:", form.formState.errors);
    updateStudentMutation.mutate(data);
  };

  const handleProfileFieldUpdate = (fieldId: number, value: string) => {
    updateProfileMutation.mutate({ fieldId, value });
  };

  const onPasswordSubmit = (data: PasswordForm) => {
    updatePasswordMutation.mutate(data);
  };

  const getProfileFieldValue = (fieldId: number) => {
    const profileEntry = studentProfile.find((p: any) => p.fieldId === fieldId);
    return profileEntry?.value || "";
  };

  const isFieldConfirmed = (fieldId: number) => {
    const profileEntry = studentProfile.find((p: any) => p.fieldId === fieldId);
    return profileEntry?.isConfirmed || false;
  };

  // Helper function to determine if a field should be editable based on user role
  const canEditField = (field: any) => {
    // Admins and counselors can edit all fields regardless of confirmation status or editability
    if (user?.role === 'admin' || user?.role === 'counselor') {
      return true;
    }
    
    // For students, check if field is confirmed or not editable
    if (user?.role === 'student') {
      const profileEntry = studentProfile.find((p: any) => p.fieldId === field.id);
      const isConfirmed = profileEntry?.isConfirmed || false;
      return field.isEditable && !isConfirmed;
    }
    
    // Default to not editable if no role or unknown role
    return false;
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
          <Button onClick={() => setLocation("/admin/students")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Students
          </Button>
        </div>
      </div>
    );
  }

  const profileFieldsByCategory = profileFields.reduce((acc: any, field: any) => {
    const category = field.category || "other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(field);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => setLocation("/admin/students")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Students
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Student</h1>
            <p className="text-gray-600">
              Student ID: STU-{student.adminStudentId} • Created: {formatDate(student.createdAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Row 1: Basic Information and Password Management */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Student ID</label>
                  <p className="text-gray-900 font-mono bg-gray-50 px-3 py-2 rounded border">STU-{student.adminStudentId}</p>
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input {...field} type="tel" placeholder="e.g., +1 234 567 8900" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="counselorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned Counselor</FormLabel>
                      <Select
                        value={field.value?.toString() || "none"}
                        onValueChange={(value) => field.onChange(value === "none" ? null : parseInt(value))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select counselor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No counselor assigned</SelectItem>
                          {counselors.map((counselor: any) => (
                            <SelectItem key={counselor.id} value={counselor.id.toString()}>
                              {counselor.user?.firstName ? 
                                `${counselor.user.firstName} ${counselor.user.lastName || ""}`.trim() : 
                                counselor.user?.email || `Counselor ${counselor.adminCounselorId}`
                              }
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
                  onClick={() => console.log("Button clicked, form valid:", form.formState.isValid)}
                  data-testid="button-save-changes"
                >
                  {updateStudentMutation.isPending ? (
                    "Saving..."
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Password Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Password Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="Enter new password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="Confirm new password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={updatePasswordMutation.isPending}
                  className="w-full"
                  data-testid="button-set-password"
                >
                  {updatePasswordMutation.isPending ? (
                    "Updating..."
                  ) : (
                    <>
                      <Key className="w-4 h-4 mr-2" />
                      Set New Password
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        </div>

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
                {(fields as any[]).map((field: any) => {
                  const fieldValue = getProfileFieldValue(field.id);
                  
                  return (
                  <div key={field.id}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        {field.fieldName}
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
                      <Input
                        type={field.fieldType === "number" ? "number" : field.fieldType === "email" ? "email" : field.fieldType === "date" ? "date" : "text"}
                        defaultValue={getProfileFieldValue(field.id)}
                        onBlur={(e) => handleProfileFieldUpdate(field.id, e.target.value)}
                        placeholder={field.placeholder || ""}
                      />
                    )}
                    {field.fieldType === "textarea" && (
                      <Textarea
                        defaultValue={getProfileFieldValue(field.id)}
                        onBlur={(e) => handleProfileFieldUpdate(field.id, e.target.value)}
                        placeholder={field.placeholder || ""}
                        rows={3}
                      />
                    )}
                    {field.fieldType === "select" && field.options && (
                      <Select
                        value={getProfileFieldValue(field.id)}
                        onValueChange={(value) => handleProfileFieldUpdate(field.id, value)}
                      >
                        <SelectTrigger>
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
                    )}
                    {!field.fieldType && (
                      <Input
                        defaultValue={getProfileFieldValue(field.id)}
                        onBlur={(e) => handleProfileFieldUpdate(field.id, e.target.value)}
                        placeholder={field.placeholder || ""}
                      />
                    )}
                  </div>
                )})}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}