import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Mail, Lock, Save, Eye, EyeOff, Bell, Briefcase } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { subscribeToPushNotifications, unsubscribeFromPushNotifications } from "@/lib/pushNotifications";
import type { Counselor } from "@shared/schema";

const passwordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const basicInfoSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  phoneNumber: z.string().optional(),
});

const counselorInfoSchema = z.object({
  contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  specialization: z.string().optional(),
  bio: z.string().optional(),
});

export default function CounselorProfile() {
  const { user } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(user?.pushNotificationsEnabled ?? true);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: counselorProfile, isLoading: counselorLoading } = useQuery<Counselor>({
    queryKey: ["/api/counselor/profile"],
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const basicInfoForm = useForm<z.infer<typeof basicInfoSchema>>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      phoneNumber: user?.phoneNumber || "",
    },
  });

  const counselorInfoForm = useForm<z.infer<typeof counselorInfoSchema>>({
    resolver: zodResolver(counselorInfoSchema),
    defaultValues: {
      contactEmail: counselorProfile?.contactEmail || "",
      specialization: counselorProfile?.specialization || "",
      bio: counselorProfile?.bio || "",
    },
  });

  useEffect(() => {
    if (user) {
      basicInfoForm.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        phoneNumber: user.phoneNumber || "",
      });
      setPushNotificationsEnabled(user.pushNotificationsEnabled ?? true);
    }
  }, [user, basicInfoForm]);

  useEffect(() => {
    if (counselorProfile) {
      counselorInfoForm.reset({
        contactEmail: counselorProfile.contactEmail || "",
        specialization: counselorProfile.specialization || "",
        bio: counselorProfile.bio || "",
      });
    }
  }, [counselorProfile, counselorInfoForm]);

  const updatePasswordMutation = useMutation({
    mutationFn: async (data: z.infer<typeof passwordSchema>) => {
      if (!user || !user.id) throw new Error("User not found");
      await apiRequest(`/api/users/${user.id}/password`, "PUT", {
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

  const updateBasicInfoMutation = useMutation({
    mutationFn: async (data: z.infer<typeof basicInfoSchema>) => {
      if (!user || !user.id) throw new Error("User not found");
      await apiRequest(`/api/users/${user.id}`, "PUT", {
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Success",
        description: "Basic information updated successfully",
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

  const updateCounselorInfoMutation = useMutation({
    mutationFn: async (data: z.infer<typeof counselorInfoSchema>) => {
      await apiRequest("/api/counselor/profile", "PUT", {
        contactEmail: data.contactEmail,
        specialization: data.specialization,
        bio: data.bio,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/counselor/profile"] });
      toast({
        title: "Success",
        description: "Professional information updated successfully",
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

  const updatePushNotificationMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (enabled) {
        const subscribed = await subscribeToPushNotifications();
        if (!subscribed) {
          throw new Error("Failed to subscribe to push notifications. Please check permissions.");
        }
      } else {
        await unsubscribeFromPushNotifications();
      }
      
      await apiRequest("/api/push/preference", "PUT", { enabled });
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setPushNotificationsEnabled(enabled);
      toast({
        title: "Success",
        description: enabled 
          ? "Push notifications enabled successfully" 
          : "Push notifications disabled successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setPushNotificationsEnabled(!pushNotificationsEnabled);
    },
  });

  const onPasswordSubmit = (data: z.infer<typeof passwordSchema>) => {
    updatePasswordMutation.mutate(data);
  };

  const onBasicInfoSubmit = (data: z.infer<typeof basicInfoSchema>) => {
    updateBasicInfoMutation.mutate(data);
  };

  const onCounselorInfoSubmit = (data: z.infer<typeof counselorInfoSchema>) => {
    updateCounselorInfoMutation.mutate(data);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900" data-testid="page-title">My Profile</h1>
        <p className="text-gray-600" data-testid="page-description">Manage your account settings and preferences</p>
      </div>

      <div className="space-y-6">
        <Card data-testid="card-basic-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...basicInfoForm}>
              <form onSubmit={basicInfoForm.handleSubmit(onBasicInfoSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={basicInfoForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter your first name"
                            data-testid="input-first-name"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={basicInfoForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter your last name"
                            data-testid="input-last-name"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Email Address
                    </label>
                    <Input 
                      value={user?.email || ""} 
                      disabled 
                      className="bg-gray-50 text-gray-500"
                      data-testid="input-email-readonly"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Email cannot be changed
                    </p>
                  </div>
                  <FormField
                    control={basicInfoForm.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter your phone number"
                            data-testid="input-phone-number"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <Button 
                    type="submit" 
                    disabled={updateBasicInfoMutation.isPending}
                    data-testid="button-save-basic-info"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {updateBasicInfoMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card data-testid="card-professional-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Professional Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            {counselorLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : (
              <Form {...counselorInfoForm}>
                <form onSubmit={counselorInfoForm.handleSubmit(onCounselorInfoSubmit)} className="space-y-4">
                  <FormField
                    control={counselorInfoForm.control}
                    name="contactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Email</FormLabel>
                        <FormControl>
                          <Input 
                            type="email"
                            placeholder="Enter your contact email"
                            data-testid="input-contact-email"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={counselorInfoForm.control}
                    name="specialization"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Specialization</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., College Admissions, Career Counseling"
                            data-testid="input-specialization"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={counselorInfoForm.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bio</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Tell us about yourself and your experience"
                            className="min-h-[100px]"
                            data-testid="textarea-bio"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end pt-4">
                    <Button 
                      type="submit" 
                      disabled={updateCounselorInfoMutation.isPending}
                      data-testid="button-save-counselor-info"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {updateCounselorInfoMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-security">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Security Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={passwordForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter new password"
                              data-testid="input-new-password"
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                              data-testid="button-toggle-password-visibility"
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
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
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Confirm new password"
                            data-testid="input-confirm-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Password Requirements:</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• At least 6 characters long</li>
                    <li>• Both passwords must match</li>
                  </ul>
                </div>

                <div className="flex justify-end pt-4">
                  <Button 
                    type="submit" 
                    disabled={updatePasswordMutation.isPending}
                    data-testid="button-update-password"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    {updatePasswordMutation.isPending ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card data-testid="card-notifications">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-base font-medium text-gray-900">Push Notifications</label>
                <p className="text-sm text-gray-600">
                  Receive notifications on your device when new updates are available
                </p>
              </div>
              <Switch
                checked={pushNotificationsEnabled}
                onCheckedChange={(checked) => {
                  setPushNotificationsEnabled(checked);
                  updatePushNotificationMutation.mutate(checked);
                }}
                disabled={updatePushNotificationMutation.isPending}
                data-testid="switch-push-notifications"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
