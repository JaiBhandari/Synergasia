import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save, User, Users, Clock, Key } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";

const editCounselorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  phoneNumber: z.string().optional(),
  specialization: z.string().optional(),
  bio: z.string().optional(),
});

const passwordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type EditCounselorForm = z.infer<typeof editCounselorSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function EditCounselor() {
  const { id } = useParams();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Extract adminCounselorId from location if useParams doesn't work
  const adminCounselorId = id || location.split('/').pop();

  const { data: counselor, isLoading: counselorLoading } = useQuery<any>({
    queryKey: [`/api/counselors/by-admin-id/${adminCounselorId}`],
    enabled: !!adminCounselorId,
  });

  const { data: students = [] } = useQuery<any[]>({
    queryKey: ["/api/students"],
  });

  const form = useForm<EditCounselorForm>({
    resolver: zodResolver(editCounselorSchema),
    defaultValues: {
      name: "",
      email: "",
      phoneNumber: "",
      specialization: "",
      bio: "",
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
    if (counselor) {
      form.reset({
        name: counselor.user?.firstName ? `${counselor.user.firstName} ${counselor.user.lastName || ""}`.trim() : "",
        email: counselor.user?.email || "",
        phoneNumber: counselor.user?.phoneNumber || "",
        specialization: counselor.specialization || "",
        bio: counselor.bio || "",
      });
    }
  }, [counselor, form]);

  const updateCounselorMutation = useMutation({
    mutationFn: async (data: EditCounselorForm) => {
      if (!adminCounselorId || !counselor?.id) {
        throw new Error("Counselor ID is required");
      }
      
      // Split data into user and counselor updates
      const userUpdates = {
        firstName: data.name.split(' ')[0] || '',
        lastName: data.name.split(' ').slice(1).join(' ') || '',
        email: data.email,
        phoneNumber: data.phoneNumber || '',
      };
      
      const counselorUpdates = {
        specialization: data.specialization || '',
        bio: data.bio || '',
      };
      
      // Update user data first
      await apiRequest(`/api/users/${counselor.userId}`, "PATCH", userUpdates);
      
      // Then update counselor data
      return await apiRequest("/api/counselors/" + counselor.adminCounselorId, "PATCH", counselorUpdates);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Counselor updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/counselors"] });
      queryClient.invalidateQueries({ queryKey: [`/api/counselors/by-admin-id/${adminCounselorId}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update counselor",
        variant: "destructive",
      });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (data: PasswordForm) => {
      if (!counselor?.id) {
        throw new Error("Counselor ID is required");
      }
      return await apiRequest(`/api/counselors/${counselor.id}/password`, "PUT", {
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

  const onSubmit = (data: EditCounselorForm) => {
    updateCounselorMutation.mutate(data);
  };

  const onPasswordSubmit = (data: PasswordForm) => {
    updatePasswordMutation.mutate(data);
  };

  if (counselorLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!counselor) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Counselor Not Found</h2>
          <Button onClick={() => setLocation("/admin/counselors")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Counselors
          </Button>
        </div>
      </div>
    );
  }

  // Get students assigned to this counselor
  const assignedStudents = Array.isArray(students) ? students.filter((student: any) => student.counselor?.adminCounselorId === parseInt(adminCounselorId!)) : [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => setLocation("/admin/counselors")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Counselors
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Counselor</h1>
            <p className="text-gray-600">
              Counselor ID: COUN-{counselor.adminCounselorId} • Created: {formatDate(counselor.createdAt)}
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
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                  name="specialization"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Specialization</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Academic Planning, Career Guidance" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Brief description about the counselor's background and experience"
                          rows={4}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={updateCounselorMutation.isPending}
                  className="w-full"
                >
                  {updateCounselorMutation.isPending ? (
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

        {/* Assigned Students */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Assigned Students ({assignedStudents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assignedStudents.length === 0 ? (
              <p className="text-gray-500 italic">No students assigned to this counselor</p>
            ) : (
              <div className="space-y-3">
                {assignedStudents.map((student: any) => (
                  <div key={student.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">
                        {student.user?.firstName ? 
                          `${student.user.firstName} ${student.user.lastName || ""}`.trim() : 
                          student.user?.email || `Student ${student.id}`
                        }
                      </p>
                      <p className="text-sm text-gray-600">{student.user?.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          student.profileStatus === "complete" 
                            ? "bg-green-100 text-green-800"
                            : student.profileStatus === "in_progress"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}>
                          {student.profileStatus}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(student.createdAt)}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation(`/admin/students/edit/${student.adminStudentId}`)}
                    >
                      Edit
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}