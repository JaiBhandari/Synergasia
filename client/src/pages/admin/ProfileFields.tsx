import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, Settings, Save, X, ChevronDown, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

// Reserved field names that cannot be used for dynamic fields
const RESERVED_FIELD_NAMES = [
  "student_id", "studentid", "id",
  "email", "email_address", "emailaddress", 
  "password", "pwd", "pass",
  // Additional system fields
  "user_id", "userid", "created_at", "updated_at", "deleted_at"
];

const addFieldSchema = z.object({
  categoryId: z.number().min(1, "Category is required"),
  fieldName: z.string()
    .min(1, "Field name is required")
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Field name must start with a letter or underscore and contain only letters, numbers, and underscores")
    .refine(
      (fieldName) => !RESERVED_FIELD_NAMES.includes(fieldName.toLowerCase()),
      {
        message: `Field name conflicts with system fields. Reserved names: ${RESERVED_FIELD_NAMES.join(", ")}`
      }
    ),
  fieldLabel: z.string().min(1, "Field label is required"),
  fieldType: z.enum(["text", "email", "number", "select", "textarea", "date"]),
  isRequired: z.boolean(),
  isEditable: z.boolean(),
  options: z.string().optional(),
});

const addCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100, "Category name too long"),
  value: z.string()
    .min(1, "Category value is required")
    .max(50, "Category value too long")
    .regex(/^[a-z_][a-z0-9_]*$/, "Category value must be lowercase with underscores only")
});

const fieldTypes = [
  { value: "text", label: "Text Input" },
  { value: "email", label: "Email Input" },
  { value: "number", label: "Number Input" },
  { value: "select", label: "Select Dropdown" },
  { value: "textarea", label: "Text Area" },
  { value: "date", label: "Date Input" },
];

export default function AdminProfileFields() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<any>(null);
  const [isCategoryManagementOpen, setIsCategoryManagementOpen] = useState(false);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch categories
  const { data: categories, isLoading: categoriesLoading } = useQuery<any[]>({
    queryKey: ["/api/profile-field-categories"],
  });

  // Set the first category as selected when categories load
  useEffect(() => {
    if (categories && categories.length > 0 && selectedCategoryId === null) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  // Fetch profile fields for selected category
  const selectedCategory = categories && Array.isArray(categories) ? categories.find((cat: any) => cat.id === selectedCategoryId) : null;
  
  const { data: profileFields, isLoading: fieldsLoading } = useQuery<any[]>({
    queryKey: ["/api/profile-fields", selectedCategory?.value],
    queryFn: async () => {
      if (!selectedCategory?.value) return [];
      
      const params = new URLSearchParams();
      params.append("category", selectedCategory.value);
      
      const response = await fetch(`/api/profile-fields?${params.toString()}`, {
        credentials: "include",
      });
      
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    enabled: !!selectedCategory?.value,
  });

  // Get all profile fields (not just current category) to check for duplicates
  const { data: allProfileFields } = useQuery<any[]>({
    queryKey: ["/api/profile-fields"],
  });

  // Create dynamic validation schema that includes checking existing fields
  const createDynamicFieldSchema = (existingFields: any[] = [], editingFieldId?: number) => {
    const existingFieldNames = existingFields
      .filter((field: any) => editingFieldId ? field.id !== editingFieldId : true)
      .map((field: any) => field.fieldName.toLowerCase());
    
    return addFieldSchema.extend({
      fieldName: z.string()
        .min(1, "Field name is required")
        .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Field name must start with a letter or underscore and contain only letters, numbers, and underscores")
        .refine(
          (fieldName) => !RESERVED_FIELD_NAMES.includes(fieldName.toLowerCase()),
          {
            message: `Field name conflicts with system fields. Avoid: ${RESERVED_FIELD_NAMES.join(", ")}`
          }
        )
        .refine(
          (fieldName) => !existingFieldNames.includes(fieldName.toLowerCase()),
          {
            message: "A field with this name already exists. Please choose a different name."
          }
        )
    });
  };

  // Use useMemo for dynamic schemas with proper dependencies
  const dynamicSchema = useMemo(
    () => createDynamicFieldSchema(allProfileFields || []),
    [allProfileFields]
  );
  
  const editDynamicSchema = useMemo(
    () => createDynamicFieldSchema(allProfileFields || [], editingField?.id),
    [allProfileFields, editingField?.id]
  );

  // Category validation schema with duplicate checking
  const createDynamicCategorySchema = (existingCategories: any[] = [], editingId?: number) => {
    const existingNames = existingCategories
      .filter((cat: any) => editingId ? cat.id !== editingId : true)
      .map((cat: any) => cat.name.toLowerCase());
    const existingValues = existingCategories
      .filter((cat: any) => editingId ? cat.id !== editingId : true)
      .map((cat: any) => cat.value.toLowerCase());
    
    return addCategorySchema.extend({
      name: z.string()
        .min(1, "Category name is required")
        .max(100, "Category name too long")
        .refine(
          (name) => !existingNames.includes(name.toLowerCase()),
          { message: "A category with this name already exists" }
        ),
      value: z.string()
        .min(1, "Category value is required")
        .max(50, "Category value too long")
        .regex(/^[a-z_][a-z0-9_]*$/, "Category value must be lowercase with underscores only")
        .refine(
          (value) => !existingValues.includes(value.toLowerCase()),
          { message: "A category with this value already exists" }
        )
    });
  };

  // Use useMemo for dynamic category schemas with proper dependencies
  const dynamicCategorySchema = useMemo(
    () => createDynamicCategorySchema(categories || []),
    [categories]
  );
  
  const editDynamicCategorySchema = useMemo(
    () => createDynamicCategorySchema(categories || [], editingCategory?.id),
    [categories, editingCategory?.id]
  );

  // Forms with dynamic resolver updates
  const form = useForm<z.infer<typeof addFieldSchema>>({
    resolver: zodResolver(dynamicSchema),
    defaultValues: {
      categoryId: selectedCategoryId || 0,
      fieldName: "",
      fieldLabel: "",
      fieldType: "text",
      isRequired: false,
      isEditable: true,
      options: "",
    },
  });

  const editForm = useForm<z.infer<typeof addFieldSchema>>({
    resolver: zodResolver(editDynamicSchema),
    defaultValues: {
      categoryId: 0,
      fieldName: "",
      fieldLabel: "",
      fieldType: "text",
      isRequired: false,
      isEditable: true,
      options: "",
    },
  });

  const categoryForm = useForm<z.infer<typeof addCategorySchema>>({
    resolver: zodResolver(dynamicCategorySchema),
    defaultValues: {
      name: "",
      value: "",
    },
  });

  const editCategoryForm = useForm<z.infer<typeof addCategorySchema>>({
    resolver: zodResolver(editDynamicCategorySchema),
    defaultValues: {
      name: "",
      value: "",
    },
  });

  // Update form resolvers when schemas change
  useEffect(() => {
    if (form && (form as any)._options) {
      form.clearErrors();
      // Reset resolver with new schema
      const newResolver = zodResolver(dynamicSchema);
      (form as any)._options.resolver = newResolver;
    }
  }, [dynamicSchema, form]);

  useEffect(() => {
    if (editForm && (editForm as any)._options) {
      editForm.clearErrors();
      // Reset resolver with new schema
      const newResolver = zodResolver(editDynamicSchema);
      (editForm as any)._options.resolver = newResolver;
    }
  }, [editDynamicSchema, editForm]);

  useEffect(() => {
    if (categoryForm && (categoryForm as any)._options) {
      categoryForm.clearErrors();
      // Reset resolver with new schema
      const newResolver = zodResolver(dynamicCategorySchema);
      (categoryForm as any)._options.resolver = newResolver;
    }
  }, [dynamicCategorySchema, categoryForm]);

  useEffect(() => {
    if (editCategoryForm && (editCategoryForm as any)._options) {
      editCategoryForm.clearErrors();
      // Reset resolver with new schema
      const newResolver = zodResolver(editDynamicCategorySchema);
      (editCategoryForm as any)._options.resolver = newResolver;
    }
  }, [editDynamicCategorySchema, editCategoryForm]);

  const fieldType = form.watch("fieldType");
  const editFieldType = editForm.watch("fieldType");

  // Profile Field Mutations
  const createFieldMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addFieldSchema>) => {
      const fieldData = {
        ...data,
        options: data.fieldType === "select" && data.options 
          ? data.options.split(",").map(opt => opt.trim()).filter(Boolean)
          : null,
      };
      
      await apiRequest("/api/profile-fields", "POST", fieldData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-fields"] });
      if (selectedCategory?.value) {
        queryClient.invalidateQueries({ queryKey: ["/api/profile-fields", selectedCategory.value] });
      }
      setIsAddModalOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Profile field created successfully",
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

  const updateFieldMutation = useMutation({
    mutationFn: async (data: { id: number; updates: z.infer<typeof addFieldSchema> }) => {
      const fieldData = {
        ...data.updates,
        options: data.updates.fieldType === "select" && data.updates.options 
          ? data.updates.options.split(",").map(opt => opt.trim()).filter(Boolean)
          : null,
      };
      
      await apiRequest(`/api/profile-fields/${data.id}`, "PUT", fieldData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-fields"] });
      if (selectedCategory?.value) {
        queryClient.invalidateQueries({ queryKey: ["/api/profile-fields", selectedCategory.value] });
      }
      setIsEditModalOpen(false);
      setEditingField(null);
      editForm.reset();
      toast({
        title: "Success",
        description: "Profile field updated successfully",
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

  const deleteFieldMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/profile-fields/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-fields"] });
      if (selectedCategory?.value) {
        queryClient.invalidateQueries({ queryKey: ["/api/profile-fields", selectedCategory.value] });
      }
      toast({
        title: "Success",
        description: "Profile field deleted successfully",
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

  // Category Mutations
  const createCategoryMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addCategorySchema>) => {
      await apiRequest("/api/profile-field-categories", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-field-categories"] });
      setIsAddCategoryModalOpen(false);
      categoryForm.reset();
      toast({
        title: "Success",
        description: "Category created successfully",
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

  const updateCategoryMutation = useMutation({
    mutationFn: async (data: { id: number; updates: z.infer<typeof addCategorySchema> }) => {
      await apiRequest(`/api/profile-field-categories/${data.id}`, "PUT", data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-field-categories"] });
      setEditingCategory(null);
      editCategoryForm.reset();
      toast({
        title: "Success",
        description: "Category updated successfully",
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

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/profile-field-categories/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-field-categories"] });
      setCategoryToDelete(null);
      // Auto-select next available category if current one was deleted
      if (selectedCategoryId === categoryToDelete?.id && categories && Array.isArray(categories)) {
        const remainingCategories = categories.filter((cat: any) => cat.id !== categoryToDelete.id);
        setSelectedCategoryId(remainingCategories.length > 0 ? remainingCategories[0].id : null);
      }
      toast({
        title: "Success",
        description: "Category deleted successfully",
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

  // Handlers
  const onSubmit = (data: z.infer<typeof addFieldSchema>) => {
    createFieldMutation.mutate(data);
  };

  const onEditSubmit = (data: z.infer<typeof addFieldSchema>) => {
    if (editingField) {
      updateFieldMutation.mutate({ id: editingField.id, updates: data });
    }
  };

  const onCategorySubmit = (data: z.infer<typeof addCategorySchema>) => {
    createCategoryMutation.mutate(data);
  };

  const onEditCategorySubmit = (data: z.infer<typeof addCategorySchema>) => {
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, updates: data });
    }
  };

  const handleEditField = (field: any) => {
    setEditingField(field);
    editForm.reset({
      categoryId: field.categoryId,
      fieldName: field.fieldName,
      fieldLabel: field.fieldLabel,
      fieldType: field.fieldType,
      isRequired: field.isRequired,
      isEditable: field.isEditable,
      options: field.options ? field.options.join(", ") : "",
    });
    setIsEditModalOpen(true);
  };

  const handleEditCategory = (category: any) => {
    setEditingCategory(category);
    editCategoryForm.reset({
      name: category.name,
      value: category.value,
    });
  };

  const handleDeleteCategory = (category: any) => {
    setCategoryToDelete(category);
  };

  const confirmDeleteCategory = () => {
    if (categoryToDelete) {
      deleteCategoryMutation.mutate(categoryToDelete.id);
    }
  };

  if (categoriesLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="loading-categories">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="profile-fields-management">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="page-title">Profile Fields Management</h1>
          <p className="text-gray-600" data-testid="page-description">Configure dynamic form fields for student profiles</p>
        </div>
        
        <div className="flex space-x-3">
          <Button 
            variant="outline" 
            onClick={() => setIsCategoryManagementOpen(true)}
            data-testid="button-manage-categories"
          >
            <Settings className="mr-2 h-4 w-4" />
            Manage Categories
          </Button>
          
          <Dialog open={isAddModalOpen} onOpenChange={(open) => {
            setIsAddModalOpen(open);
            if (open && selectedCategoryId) {
              form.reset({
                categoryId: selectedCategoryId,
                fieldName: "",
                fieldLabel: "",
                fieldType: "text",
                isRequired: false,
                isEditable: true,
                options: "",
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button 
                className="bg-primary-500 hover:bg-primary-600"
                disabled={!selectedCategoryId || createFieldMutation.isPending}
                data-testid="button-add-field"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Field
              </Button>
            </DialogTrigger>
            
            <DialogContent className="max-w-md" data-testid="modal-add-field">
              <DialogHeader>
                <DialogTitle>Add Profile Field</DialogTitle>
              </DialogHeader>
              
              {/* Validation Info */}
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-2">Field Name Guidelines:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Must start with a letter or underscore</li>
                    <li>Can contain letters, numbers, and underscores only</li>
                    <li>Cannot use reserved names: {RESERVED_FIELD_NAMES.slice(0, 5).join(", ")}, ...</li>
                    {allProfileFields && Array.isArray(allProfileFields) && allProfileFields.length > 0 && (
                      <li>Existing fields: {allProfileFields.map((f: any) => f.fieldName).slice(0, 3).join(", ")}{allProfileFields.length > 3 ? ", ..." : ""}</li>
                    )}
                  </ul>
                </div>
              </div>

              <Form {...form} key={`add-field-${selectedCategoryId}-${allProfileFields?.length || 0}`}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category *</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger data-testid="select-category-add">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories && Array.isArray(categories) ? categories.map((cat: any) => (
                              <SelectItem key={cat.id} value={cat.id.toString()}>
                                {cat.name}
                              </SelectItem>
                            )) : null}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="fieldName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Field Name *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., gpa, awards" 
                            {...field}
                            data-testid="input-field-name" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="fieldLabel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Field Label *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., GPA, Awards" 
                            {...field}
                            data-testid="input-field-label" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="fieldType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Field Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-field-type">
                              <SelectValue placeholder="Select field type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {fieldTypes.map((type) => (
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
                  
                  {fieldType === "select" && (
                    <FormField
                      control={form.control}
                      name="options"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Options (comma separated)</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Option 1, Option 2, Option 3" 
                              {...field}
                              data-testid="textarea-field-options" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  <div className="flex items-center justify-between">
                    <FormField
                      control={form.control}
                      name="isRequired"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-required"
                            />
                          </FormControl>
                          <FormLabel>Required Field</FormLabel>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="isEditable"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-editable"
                            />
                          </FormControl>
                          <FormLabel>Student Editable</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="flex space-x-3 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setIsAddModalOpen(false)}
                      disabled={createFieldMutation.isPending}
                      data-testid="button-cancel-field"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1 bg-primary-500 hover:bg-primary-600"
                      disabled={createFieldMutation.isPending}
                      data-testid="button-submit-field"
                    >
                      {createFieldMutation.isPending ? "Adding..." : "Add Field"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Category Management Modal */}
      <Dialog open={isCategoryManagementOpen} onOpenChange={setIsCategoryManagementOpen}>
        <DialogContent className="max-w-2xl" data-testid="modal-category-management">
          <DialogHeader>
            <DialogTitle>Category Management</DialogTitle>
          </DialogHeader>
          
          <div className="flex justify-end mb-4">
            <Dialog open={isAddCategoryModalOpen} onOpenChange={setIsAddCategoryModalOpen}>
              <DialogTrigger asChild>
                <Button 
                  size="sm" 
                  disabled={createCategoryMutation.isPending}
                  data-testid="button-add-category"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Category
                </Button>
              </DialogTrigger>
                
                <DialogContent className="max-w-md" data-testid="modal-add-category">
                  <DialogHeader>
                    <DialogTitle>Add Category</DialogTitle>
                  </DialogHeader>
                  
                  <Form {...categoryForm} key={`add-category-${categories?.length || 0}`}>
                    <form onSubmit={categoryForm.handleSubmit(onCategorySubmit)} className="space-y-4">
                      <FormField
                        control={categoryForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category Name *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="e.g., Extracurriculars" 
                                {...field}
                                data-testid="input-category-name" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={categoryForm.control}
                        name="value"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category Value *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="e.g., extracurriculars" 
                                {...field}
                                data-testid="input-category-value" 
                              />
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
                          onClick={() => setIsAddCategoryModalOpen(false)}
                          disabled={createCategoryMutation.isPending}
                          data-testid="button-cancel-category"
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          className="flex-1 bg-primary-500 hover:bg-primary-600"
                          disabled={createCategoryMutation.isPending}
                          data-testid="button-submit-category"
                        >
                          {createCategoryMutation.isPending ? "Creating..." : "Create Category"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {categories?.map((category: any) => (
              <div key={category.id} className="flex items-center justify-between p-4 border rounded-md" data-testid={`category-item-${category.id}`}>
                {editingCategory?.id === category.id ? (
                  <Form {...editCategoryForm} key={`edit-category-${editingCategory?.id}-${categories?.length || 0}`}>
                    <form onSubmit={editCategoryForm.handleSubmit(onEditCategorySubmit)} className="flex-1 flex items-center space-x-3">
                      <FormField
                        control={editCategoryForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input 
                                {...field}
                                data-testid={`input-edit-category-name-${category.id}`} 
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={editCategoryForm.control}
                        name="value"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input 
                                {...field}
                                data-testid={`input-edit-category-value-${category.id}`} 
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      <div className="flex space-x-2">
                        <Button 
                          type="submit" 
                          size="sm"
                          disabled={updateCategoryMutation.isPending}
                          data-testid={`button-save-category-${category.id}`}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button 
                          type="button" 
                          size="sm" 
                          variant="outline"
                          onClick={() => setEditingCategory(null)}
                          data-testid={`button-cancel-edit-category-${category.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </form>
                  </Form>
                ) : (
                  <>
                    <div className="flex-1">
                      <div className="font-medium" data-testid={`text-category-name-${category.id}`}>{category.name}</div>
                      <div className="text-sm text-gray-500" data-testid={`text-category-value-${category.id}`}>{category.value}</div>
                      {category.isDefault && (
                        <Badge variant="secondary" className="mt-1" data-testid={`badge-default-${category.id}`}>Default</Badge>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleEditCategory(category)}
                        data-testid={`button-edit-category-${category.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDeleteCategory(category)}
                        disabled={category.isDefault}
                        data-testid={`button-delete-category-${category.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation */}
      <AlertDialog open={!!categoryToDelete} onOpenChange={() => setCategoryToDelete(null)}>
        <AlertDialogContent data-testid="alert-delete-category">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the category "{categoryToDelete?.name}"? 
              This action cannot be undone and will also delete all fields in this category.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-category">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteCategory}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-category"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Field Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md" data-testid="modal-edit-field">
          <DialogHeader>
            <DialogTitle>Edit Profile Field</DialogTitle>
          </DialogHeader>
          
          {/* Validation Info */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-2">Field Name Guidelines:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Must start with a letter or underscore</li>
                <li>Can contain letters, numbers, and underscores only</li>
                <li>Cannot use reserved names: {RESERVED_FIELD_NAMES.slice(0, 5).join(", ")}, ...</li>
                {allProfileFields && allProfileFields.length > 0 && (
                  <li>Existing fields: {allProfileFields.filter((f: any) => f.id !== editingField?.id).map((f: any) => f.fieldName).slice(0, 3).join(", ")}{allProfileFields.length > 4 ? ", ..." : ""}</li>
                )}
              </ul>
            </div>
          </div>

          <Form {...editForm} key={`edit-field-${editingField?.id}-${allProfileFields?.length || 0}`}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger data-testid="select-category-edit">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories?.map((cat: any) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>
                            {cat.name}
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
                name="fieldName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Field Name (Internal)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., high_school_gpa" 
                        {...field}
                        data-testid="input-edit-field-name" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="fieldLabel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Field Label (Display)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., High School GPA" 
                        {...field}
                        data-testid="input-edit-field-label" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="fieldType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Field Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-field-type">
                          <SelectValue placeholder="Select field type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {fieldTypes.map((type) => (
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
              
              {editFieldType === "select" && (
                <FormField
                  control={editForm.control}
                  name="options"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Options (comma separated)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Option 1, Option 2, Option 3" 
                          {...field}
                          data-testid="textarea-edit-field-options" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <div className="flex items-center justify-between">
                <FormField
                  control={editForm.control}
                  name="isRequired"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-edit-required"
                        />
                      </FormControl>
                      <FormLabel>Required Field</FormLabel>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="isEditable"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-edit-editable"
                        />
                      </FormControl>
                      <FormLabel>Student Editable</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingField(null);
                    editForm.reset();
                  }}
                  data-testid="button-cancel-edit-field"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 bg-primary-500 hover:bg-primary-600"
                  disabled={updateFieldMutation.isPending}
                  data-testid="button-submit-edit-field"
                >
                  {updateFieldMutation.isPending ? "Updating..." : "Update Field"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Category Tabs */}
      {categories && categories.length > 0 ? (
        <div className="flex w-full space-x-1 bg-muted rounded-lg p-1" data-testid="category-tabs">
          {Array.isArray(categories) ? (() => {
            const maxDirectTabs = 5;
            const directTabs = categories.slice(0, maxDirectTabs);
            const moreTabs = categories.slice(maxDirectTabs);
            
            return (
              <>
                {directTabs.map((category: any) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategoryId(category.id)}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      selectedCategoryId === category.id
                        ? "bg-card text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`tab-category-${category.id}`}
                  >
                    {category.name}
                  </button>
                ))}
                
                {moreTabs.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-1 ${
                          moreTabs.some((cat: any) => selectedCategoryId === cat.id)
                            ? "bg-card text-primary shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        data-testid="tab-more-categories"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span>More</span>
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {moreTabs.map((category: any) => (
                        <DropdownMenuItem
                          key={category.id}
                          onClick={() => setSelectedCategoryId(category.id)}
                          className={`cursor-pointer ${
                            selectedCategoryId === category.id ? "bg-primary-50 text-primary" : ""
                          }`}
                          data-testid={`dropdown-category-${category.id}`}
                        >
                          {category.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            );
          })() : null}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500" data-testid="no-categories-message">
          <p>No categories available. Create some categories first.</p>
        </div>
      )}

      {/* Fields Table */}
      {selectedCategory ? (
        <Card data-testid="fields-table">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-4 px-6 font-semibold text-gray-900">Field</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-900">Type</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-900">Settings</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-900">Options</th>
                    <th className="text-right py-4 px-6 font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {fieldsLoading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto"></div>
                      </td>
                    </tr>
                  ) : profileFields && Array.isArray(profileFields) && profileFields.length > 0 ? (
                    profileFields.map((field: any) => (
                      <tr key={field.id} className="hover:bg-gray-50 transition-colors" data-testid={`field-row-${field.id}`}>
                        <td className="py-4 px-6">
                          <div>
                            <p className="font-medium text-gray-900" data-testid={`text-field-label-${field.id}`}>{field.fieldLabel}</p>
                            <p className="text-sm text-gray-500" data-testid={`text-field-name-${field.id}`}>{field.fieldName}</p>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <Badge variant="outline" data-testid={`badge-field-type-${field.id}`}>
                            {fieldTypes.find(t => t.value === field.fieldType)?.label}
                          </Badge>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex space-x-2">
                            {field.isRequired && (
                              <Badge className="bg-red-100 text-red-800" data-testid={`badge-required-${field.id}`}>Required</Badge>
                            )}
                            {field.isEditable && (
                              <Badge className="bg-green-100 text-green-800" data-testid={`badge-editable-${field.id}`}>Editable</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          {field.fieldType === "select" && field.options ? (
                            <div className="text-sm text-gray-600" data-testid={`text-field-options-${field.id}`}>
                              {Array.isArray(field.options) 
                                ? field.options.slice(0, 2).join(", ") + (field.options.length > 2 ? "..." : "")
                                : "No options"
                              }
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditField(field)}
                              disabled={updateFieldMutation.isPending || deleteFieldMutation.isPending}
                              data-testid={`button-edit-field-${field.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteFieldMutation.mutate(field.id)}
                              disabled={updateFieldMutation.isPending || deleteFieldMutation.isPending}
                              data-testid={`button-delete-field-${field.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-gray-500" data-testid="no-fields-message">
                        No fields in this category yet. Add some fields to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-8 text-gray-500" data-testid="select-category-message">
          <p>Select a category to view and manage its fields.</p>
        </div>
      )}
    </div>
  );
}