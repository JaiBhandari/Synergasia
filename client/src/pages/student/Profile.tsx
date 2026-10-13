import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Mail, Lock, Save, Eye, EyeOff, BookOpen, ChevronDown, Bell, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { subscribeToPushNotifications, unsubscribeFromPushNotifications } from "@/lib/pushNotifications";
import type { Student, User as UserType, StudentProfile, ProfileField } from "@shared/schema";
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

export default function StudentProfile() {
  const { user } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [localFieldValues, setLocalFieldValues] = useState<Record<number, string>>({});
  const [savingSections, setSavingSections] = useState<Set<string>>(new Set());
  const [savedSections, setSavedSections] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(user?.pushNotificationsEnabled ?? true);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Show loading if user is not available yet
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

  const { data: student } = useQuery<Student>({
    queryKey: ["/api/me/student"],
    queryFn: async () => {
      const response = await fetch("/api/me/student", {
        credentials: "include",
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
  });

  const { data: profile } = useQuery<StudentProfile[]>({
    queryKey: [`/api/students/${student?.id}/profile`],
    enabled: !!student?.id,
  });

  const { data: profileFields } = useQuery<ProfileField[]>({
    queryKey: ["/api/profile-fields"],
  });

  // Fetch categories dynamically
  const { data: categories, isLoading: categoriesLoading } = useQuery<any[]>({
    queryKey: ["/api/profile-field-categories"],
  });

  const { data: counselor } = useQuery<any>({
    queryKey: ["/api/me/counselor"],
    enabled: !!student?.counselorId,
  });

  // Initialize and sync local field values with database profile
  useEffect(() => {
    if (profile && Array.isArray(profile)) {
      setLocalFieldValues(prev => {
        // Keep any fields that are currently being edited (have local changes)
        // but update/add fields that match the database
        const newValues: Record<number, string> = {};
        
        profile.forEach((p) => {
          // If we have a local value that's different from the saved value,
          // keep the local value (user might still be typing)
          if (prev[p.fieldId] !== undefined && prev[p.fieldId] !== p.value) {
            newValues[p.fieldId] = prev[p.fieldId];
          } else if (p.value) {
            // Otherwise use the database value
            newValues[p.fieldId] = p.value;
          }
        });
        
        return newValues;
      });
    }
  }, [profile]);


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

  // Update form when user data changes
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
        email: user.email, // Keep existing email
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

  const saveSectionMutation = useMutation({
    mutationFn: async ({ categoryValue, fields }: { categoryValue: string; fields: { fieldId: number; value: string }[] }) => {
      if (!student?.id) throw new Error("Student not found");
      await apiRequest(`/api/students/${student.id}/profile/batch`, "PUT", { fields });
      return categoryValue;
    },
    onSuccess: (categoryValue) => {
      if (student?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/students/${student.id}/profile`] });
      }
      // Show "Saved ✓" badge for 3 seconds
      setSavedSections(prev => new Set([...prev, categoryValue]));
      setTimeout(() => {
        setSavedSections(prev => {
          const next = new Set(prev);
          next.delete(categoryValue);
          return next;
        });
      }, 3000);
      toast({ title: "Saved", description: "Changes saved successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const confirmFieldMutation = useMutation({
    mutationFn: async (fieldId: number) => {
      if (!student?.id) throw new Error("Student not found");
      await apiRequest(`/api/students/${student.id}/profile/${fieldId}/confirm`, "PUT", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students", student?.id, "profile"] });
      toast({
        title: "Success",
        description: "Field confirmed successfully. This field can no longer be edited.",
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

  const onPasswordSubmit = (data: z.infer<typeof passwordSchema>) => {
    updatePasswordMutation.mutate(data);
  };

  const onBasicInfoSubmit = (data: z.infer<typeof basicInfoSchema>) => {
    updateBasicInfoMutation.mutate(data);
  };

  const handleFieldUpdate = useCallback((fieldId: number, value: string) => {
    // Update local state immediately for smooth UI
    setLocalFieldValues(prev => ({ ...prev, [fieldId]: value }));
  }, []);

  const isFieldDirty = useCallback((fieldId: number) => {
    if (localFieldValues[fieldId] === undefined) return false;
    const savedValue = profile?.find((p) => p.fieldId === fieldId)?.value || "";
    return localFieldValues[fieldId] !== savedValue;
  }, [localFieldValues, profile]);

  // Group profile fields by category using categoryId
  const groupedFields = profileFields && Array.isArray(profileFields) && categories
    ? profileFields.reduce((acc: Record<string, ProfileField[]>, field) => {
        // Find the category for this field
        const category = categories.find((cat: any) => cat.id === field.categoryId);
        if (category) {
          if (!acc[category.value]) {
            acc[category.value] = [];
          }
          acc[category.value].push(field);
        }
        return acc;
      }, {})
    : {};

  const isSectionDirty = useCallback((categoryValue: string) => {
    const fields = groupedFields?.[categoryValue] || [];
    return fields.some(f => isFieldDirty(f.id));
  }, [groupedFields, isFieldDirty]);

  const saveSectionFields = useCallback(async (categoryValue: string) => {
    const fields = groupedFields?.[categoryValue] || [];
    const dirtyFields = fields
      .filter(f => isFieldDirty(f.id))
      .map(f => ({ fieldId: f.id, value: localFieldValues[f.id] }));
    if (dirtyFields.length === 0) return;
    setSavingSections(prev => new Set([...prev, categoryValue]));
    try {
      await saveSectionMutation.mutateAsync({ categoryValue, fields: dirtyFields });
    } finally {
      setSavingSections(prev => {
        const next = new Set(prev);
        next.delete(categoryValue);
        return next;
      });
    }
  }, [groupedFields, isFieldDirty, localFieldValues, saveSectionMutation]);

  const handleTabChange = useCallback((newCategory: string) => {
    if (newCategory === activeCategory) return;
    if (isSectionDirty(activeCategory)) {
      setPendingTab(newCategory);
      setShowUnsavedDialog(true);
    } else {
      setActiveCategory(newCategory);
    }
  }, [activeCategory, isSectionDirty]);

  const handleUnsavedSave = useCallback(async () => {
    if (!pendingTab) return;
    await saveSectionFields(activeCategory);
    setActiveCategory(pendingTab);
    setPendingTab(null);
    setShowUnsavedDialog(false);
  }, [activeCategory, pendingTab, saveSectionFields]);

  const handleUnsavedDiscard = useCallback(() => {
    if (!pendingTab) return;
    const fields = groupedFields?.[activeCategory] || [];
    setLocalFieldValues(prev => {
      const next = { ...prev };
      fields.forEach(f => {
        const savedValue = profile?.find(p => p.fieldId === f.id)?.value || "";
        next[f.id] = savedValue;
      });
      return next;
    });
    setActiveCategory(pendingTab);
    setPendingTab(null);
    setShowUnsavedDialog(false);
  }, [activeCategory, pendingTab, groupedFields, profile]);

  // Get current values for fields - prioritize local state for smooth typing
  const getFieldValue = (fieldId: number) => {
    // Use local value if it exists (user is typing)
    if (localFieldValues[fieldId] !== undefined) {
      return localFieldValues[fieldId];
    }
    // Fall back to saved database value
    if (!profile || !Array.isArray(profile)) return "";
    const profileField = profile.find((p) => p.fieldId === fieldId);
    return profileField?.value || "";
  };

  // Check if field is confirmed
  const isFieldConfirmed = (fieldId: number) => {
    if (!profile || !Array.isArray(profile)) return false;
    const profileField = profile.find((p) => p.fieldId === fieldId);
    return profileField?.isConfirmed || false;
  };

  const handleConfirmField = (fieldId: number) => {
    confirmFieldMutation.mutate(fieldId);
  };

  // Calculate completion for each category
  const getCategoryCompletion = (categoryFields: ProfileField[]) => {
    const total = categoryFields.length;
    const completed = categoryFields.filter(field => {
      const value = getFieldValue(field.id);
      return field.isRequired ? value.trim() : true;
    }).length;
    return total > 0 ? Math.round((completed / total) * 100) : 100;
  };

  // Create categories array from API data only (no fallback to default categories)
  const dynamicCategories = categories && categories.length > 0 
    ? categories.map((category: any) => ({
        value: category.value,
        label: category.name,
        icon: User // Default icon for all categories
      }))
    : [];

  // Initialize active category when categories load
  useEffect(() => {
    if (dynamicCategories.length > 0 && !activeCategory) {
      setActiveCategory(dynamicCategories[0].value);
    }
  }, [dynamicCategories, activeCategory]);

  // Split categories into visible tabs and dropdown items
  const shouldUseDropdown = dynamicCategories.length > 4;
  const visibleTabs = shouldUseDropdown ? dynamicCategories.slice(0, 3) : dynamicCategories;
  const dropdownItems = shouldUseDropdown ? dynamicCategories.slice(3) : [];
  
  // Check if active category is in dropdown
  const activeInDropdown = shouldUseDropdown && dropdownItems.some(cat => cat.value === activeCategory);
  const activeCategoryLabel = dynamicCategories.find(cat => cat.value === activeCategory)?.label || "";

  const renderField = (field: ProfileField) => {
    const value = getFieldValue(field.id);
    const isEditable = field.isEditable;
    const isConfirmed = isFieldConfirmed(field.id);
    
    // Only show fields as uneditable if they are marked uneditable by admin AND confirmed
    // OR if they are marked as completely uneditable by admin (regardless of confirmation)
    if (!isEditable && isConfirmed) {
      return (
        <div key={field.id} className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              {field.fieldLabel}
              {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
              Confirmed
            </Badge>
          </div>
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-600">
            {value || "Not set"}
          </div>
        </div>
      );
    }

    switch (field.fieldType) {
      case "textarea":
        return (
          <div key={field.id} className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              {field.fieldLabel}
              {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <Textarea
              value={value}
              onChange={(e) => handleFieldUpdate(field.id, e.target.value)}
              placeholder={`Enter ${field.fieldLabel.toLowerCase()}`}
              rows={3}
            />
            {value && !isEditable && (
              <Button
                type="button"
                onClick={() => handleConfirmField(field.id)}
                disabled={confirmFieldMutation.isPending}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                Confirm Field
              </Button>
            )}
          </div>
        );

      case "select":
        return (
          <div key={field.id} className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              {field.fieldLabel}
              {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <Select value={value} onValueChange={(val) => {
              handleFieldUpdate(field.id, val);
            }}>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${field.fieldLabel.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {(field.options as string[])?.map((option: string) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {value && !isEditable && (
              <Button
                type="button"
                onClick={() => handleConfirmField(field.id)}
                disabled={confirmFieldMutation.isPending}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                Confirm Field
              </Button>
            )}
          </div>
        );

      default:
        return (
          <div key={field.id} className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              {field.fieldLabel}
              {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <Input
              type={field.fieldType}
              value={value}
              onChange={(e) => handleFieldUpdate(field.id, e.target.value)}
              placeholder={`Enter ${field.fieldLabel.toLowerCase()}`}
            />
            {value && !isEditable && (
              <Button
                type="button"
                onClick={() => handleConfirmField(field.id)}
                disabled={confirmFieldMutation.isPending}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                Confirm Field
              </Button>
            )}
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-600">Complete your profile to help counselors assist you better</p>
      </div>

      {/* Show loading state while categories are being fetched */}
      {categoriesLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading categories...</p>
        </div>
      ) : dynamicCategories.length === 0 ? (
        /* Show message when no categories are configured */
        <Card>
          <CardContent className="text-center py-12">
            <User className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">No Profile Categories Available</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Your administrator hasn't set up any profile categories yet. Please contact your administrator to configure profile fields for students.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeCategory} onValueChange={handleTabChange} className="space-y-6">
          <div className={`flex w-full rounded-lg bg-muted p-1 text-muted-foreground ${
            shouldUseDropdown ? 'justify-between' : 'justify-center'
          }`}>
            {/* Visible tabs */}
            <div className={`grid ${
              visibleTabs.length === 1 ? 'grid-cols-1' :
              visibleTabs.length === 2 ? 'grid-cols-2' :
              'grid-cols-3'
            } ${shouldUseDropdown ? 'flex-1' : 'w-full'}`}>
              {visibleTabs.map((category: any) => (
                <button
                  key={category.value}
                  onClick={() => handleTabChange(category.value)}
                  className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                    activeCategory === category.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'hover:bg-background/50'
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>
            
            {/* More dropdown */}
            {shouldUseDropdown && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ml-1 ${
                      activeInDropdown
                        ? 'bg-background text-foreground shadow-sm'
                        : 'hover:bg-background/50'
                    }`}
                  >
                    {activeInDropdown ? activeCategoryLabel : 'More'}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {dropdownItems.map((category: any) => (
                    <DropdownMenuItem
                      key={category.value}
                      onClick={() => handleTabChange(category.value)}
                      className={activeCategory === category.value ? 'bg-accent' : ''}
                    >
                      {category.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Dynamic Category Content */}
          {dynamicCategories.map((category) => (
            <TabsContent key={category.value} value={category.value} className="space-y-6">
              {/* Basic Information Card - only show for first category */}
              {category.value === dynamicCategories[0]?.value && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <User className="h-5 w-5" />
                      <span>Basic Information</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Read-only fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Student ID</label>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-900 font-mono">STU-{student?.adminStudentId}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Email</label>
                        <div className="flex items-center space-x-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-900">{user.email || "Not provided"}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Assigned Counselor</label>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-900">
                            {counselor 
                              ? `${counselor.firstName || ""} ${counselor.lastName || ""}`.trim() || counselor.email || "Counselor" 
                              : "No counselor assigned"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Profile Status</label>
                        <div className="flex items-center space-x-2">
                          <BookOpen className="h-4 w-4 text-gray-400" />
                          <Badge 
                            variant={
                              student?.profileStatus === "complete" 
                                ? "default" 
                                : student?.profileStatus === "in_progress" 
                                ? "secondary" 
                                : "outline"
                            }
                            data-testid="badge-profile-status"
                          >
                            {student?.profileStatus === "complete" 
                              ? "Complete" 
                              : student?.profileStatus === "in_progress" 
                              ? "In Progress" 
                              : "Incomplete"}
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Password</label>
                        <div className="flex items-center space-x-2">
                          <Lock className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">••••••••</span>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setShowPassword(!showPassword)}
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Editable Basic Information Form */}
                    <div className="border-t pt-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Update Your Information</h3>
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
                                    <Input {...field} placeholder="Enter your first name" data-testid="input-first-name" />
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
                                    <Input {...field} placeholder="Enter your last name" data-testid="input-last-name" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={basicInfoForm.control}
                            name="phoneNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone Number</FormLabel>
                                <FormControl>
                                  <Input {...field} type="tel" placeholder="e.g., +1 234 567 8900" data-testid="input-phone-number" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <Button 
                            type="submit" 
                            disabled={updateBasicInfoMutation.isPending}
                            className="w-full md:w-auto"
                            data-testid="button-save-basic-info"
                          >
                            {updateBasicInfoMutation.isPending ? (
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
                    </div>

                    {showPassword && (
                      <Card className="border-orange-200 bg-orange-50">
                        <CardHeader>
                          <CardTitle className="text-lg">Update Password</CardTitle>
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
                                      <Input type="password" placeholder="Enter new password" {...field} />
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
                                      <Input type="password" placeholder="Confirm new password" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              
                              <div className="flex space-x-3">
                                <Button 
                                  type="button" 
                                  variant="outline"
                                  onClick={() => setShowPassword(false)}
                                >
                                  Cancel
                                </Button>
                                <Button 
                                  type="submit"
                                  disabled={updatePasswordMutation.isPending}
                                >
                                  {updatePasswordMutation.isPending ? "Updating..." : "Update Password"}
                                </Button>
                              </div>
                            </form>
                          </Form>
                        </CardContent>
                      </Card>
                    )}

                    <div className="border-t pt-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <Bell className="h-5 w-5 text-gray-700" />
                            <label className="text-base font-medium text-gray-900">Push Notifications</label>
                          </div>
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
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Category Fields Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <User className="h-5 w-5" />
                      <span>{category.label}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      {groupedFields?.[category.value] && (
                        <div className="flex items-center space-x-2">
                          <Progress 
                            value={getCategoryCompletion(groupedFields[category.value])} 
                            className="w-24 h-2" 
                          />
                          <span className="text-sm text-gray-500">
                            {getCategoryCompletion(groupedFields[category.value])}%
                          </span>
                        </div>
                      )}
                      {savedSections.has(category.value) && !isSectionDirty(category.value) && (
                        <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Saved
                        </span>
                      )}
                      {isSectionDirty(category.value) && (
                        <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
                      )}
                      {groupedFields?.[category.value] && (
                        <Button
                          size="sm"
                          onClick={() => saveSectionFields(category.value)}
                          disabled={savingSections.has(category.value) || !isSectionDirty(category.value)}
                        >
                          <Save className="w-3 h-3 mr-1" />
                          {savingSections.has(category.value) ? "Saving..." : "Save"}
                        </Button>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {groupedFields?.[category.value] ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {groupedFields[category.value].map(renderField)}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <User className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No fields configured</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Your administrator hasn't set up fields for this category yet.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      <AlertDialog open={showUnsavedDialog} onOpenChange={(open) => { setShowUnsavedDialog(open); if (!open) setPendingTab(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in this section. Would you like to save them before switching tabs, or discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingTab(null); setShowUnsavedDialog(false); }}>
              Stay
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnsavedDiscard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard
            </AlertDialogAction>
            <AlertDialogAction onClick={handleUnsavedSave}>
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
