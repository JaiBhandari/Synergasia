import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserPlus, MoreHorizontal, Trash2, Edit2, Eye, Search, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const createAdminSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const editAdminSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  password: z.string().optional(),
});

type CreateAdminForm = z.infer<typeof createAdminSchema>;
type EditAdminForm = z.infer<typeof editAdminSchema>;

// Admin type definition
type Admin = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  isDeleted: boolean;
  deletedAt?: string;
  counselorCount: number;
  studentCount: number;
};

export default function AdminManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [adminToDelete, setAdminToDelete] = useState<Admin | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("active");

  const { data: admins = [], isLoading } = useQuery<Admin[]>({
    queryKey: ["/api/developer/admins"],
  });

  const { data: deletedAdmins = [], isLoading: isLoadingDeleted } = useQuery<Admin[]>({
    queryKey: ["/api/developer/deleted-admins"],
  });

  const createAdminMutation = useMutation({
    mutationFn: (data: CreateAdminForm) => apiRequest("/api/developer/admins", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/admins"] });
      queryClient.invalidateQueries({ queryKey: ["/api/developer/deleted-admins"] });
      setIsCreateDialogOpen(false);
      toast({ title: "Success", description: "Admin created successfully" });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create admin",
        variant: "destructive",
      });
    },
  });

  const deleteAdminMutation = useMutation({
    mutationFn: (adminId: string) => apiRequest(`/api/developer/admins/${adminId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/admins"] });
      queryClient.invalidateQueries({ queryKey: ["/api/developer/deleted-admins"] });
      setDeleteDialogOpen(false);
      setAdminToDelete(null);
      toast({ title: "Success", description: "Admin deleted successfully" });
    },
    onError: (error: any) => {
      setDeleteDialogOpen(false);
      setAdminToDelete(null);
      toast({
        title: "Error",
        description: error.message || "Failed to delete admin",
        variant: "destructive",
      });
    },
  });

  const editAdminMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditAdminForm }) => 
      apiRequest(`/api/developer/admins/${id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/admins"] });
      queryClient.invalidateQueries({ queryKey: ["/api/developer/deleted-admins"] });
      setIsEditDialogOpen(false);
      setSelectedAdmin(null);
      toast({ title: "Success", description: "Admin updated successfully" });
      editForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update admin",
        variant: "destructive",
      });
    },
  });

  const form = useForm<CreateAdminForm>({
    resolver: zodResolver(createAdminSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      password: "",
    },
  });

  const editForm = useForm<EditAdminForm>({
    resolver: zodResolver(editAdminSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      password: "",
    },
  });

  const onSubmit = (data: CreateAdminForm) => {
    createAdminMutation.mutate(data);
  };

  const onEditSubmit = (data: EditAdminForm) => {
    if (selectedAdmin) {
      editAdminMutation.mutate({ id: selectedAdmin.id, data });
    }
  };

  const handleEditAdmin = (admin: Admin) => {
    setSelectedAdmin(admin);
    editForm.reset({
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      password: "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteAdmin = (admin: Admin) => {
    setAdminToDelete(admin);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteAdmin = () => {
    if (adminToDelete) {
      deleteAdminMutation.mutate(adminToDelete.id);
    }
  };

  const filterAdmins = (adminList: Admin[]) => adminList.filter((admin) =>
    admin.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAdmins = filterAdmins(admins);
  const filteredDeletedAdmins = filterAdmins(deletedAdmins);

  // Helper function to render active admin cards
  const renderActiveAdminCard = (admin: Admin) => (
    <div key={admin.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg" data-testid={`admin-card-${admin.id}`}>
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
          <span className="text-primary-600 font-medium text-lg">
            {admin.firstName?.[0]}{admin.lastName?.[0]}
          </span>
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 text-lg" data-testid={`admin-name-${admin.id}`}>
            {admin.firstName} {admin.lastName}
          </h3>
          <p className="text-sm text-gray-500" data-testid={`admin-email-${admin.id}`}>{admin.email}</p>
          <div className="flex items-center space-x-4 mt-2">
            <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded" data-testid={`counselor-count-${admin.id}`}>
              {admin.counselorCount || 0} counselors
            </span>
            <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded" data-testid={`student-count-${admin.id}`}>
              {admin.studentCount || 0} students
            </span>
            <span className="text-xs text-gray-400" data-testid={`admin-created-${admin.id}`}>
              Created: {new Date(admin.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <Badge variant={admin.isDeleted ? "destructive" : "default"} data-testid={`admin-status-${admin.id}`}>
          {admin.isDeleted ? "Inactive" : "Active"}
        </Badge>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" data-testid={`admin-actions-${admin.id}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem data-testid={`view-admin-${admin.id}`}>
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleEditAdmin(admin)} data-testid={`edit-admin-${admin.id}`}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Admin
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => handleDeleteAdmin(admin)}
              data-testid={`delete-admin-${admin.id}`}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Admin
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  // Helper function to render deleted admin cards
  const renderDeletedAdminCard = (admin: Admin) => (
    <div key={admin.id} className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50/30" data-testid={`deleted-admin-card-${admin.id}`}>
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
          <span className="text-red-600 font-medium text-lg">
            {admin.firstName?.[0]}{admin.lastName?.[0]}
          </span>
        </div>
        <div>
          <h3 className="font-semibold text-gray-700 text-lg" data-testid={`deleted-admin-name-${admin.id}`}>
            {admin.firstName} {admin.lastName}
          </h3>
          <p className="text-sm text-gray-500" data-testid={`deleted-admin-email-${admin.id}`}>{admin.email}</p>
          <div className="flex items-center space-x-4 mt-2">
            <span className="text-sm text-red-600 bg-red-100 px-2 py-1 rounded" data-testid={`deleted-counselor-count-${admin.id}`}>
              {admin.counselorCount || 0} counselors (archived)
            </span>
            <span className="text-sm text-red-600 bg-red-100 px-2 py-1 rounded" data-testid={`deleted-student-count-${admin.id}`}>
              {admin.studentCount || 0} students (archived)
            </span>
          </div>
          <div className="flex items-center space-x-4 mt-1">
            <span className="text-xs text-gray-400" data-testid={`deleted-admin-created-${admin.id}`}>
              Created: {new Date(admin.createdAt).toLocaleDateString()}
            </span>
            {admin.deletedAt && (
              <span className="text-xs text-red-500" data-testid={`deleted-admin-deleted-${admin.id}`}>
                <Clock className="h-3 w-3 inline mr-1" />
                Deleted: {new Date(admin.deletedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <Badge variant="destructive" data-testid={`deleted-admin-status-${admin.id}`}>
          Deleted
        </Badge>
      </div>
    </div>
  );

  if (isLoading || isLoadingDeleted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Management</h1>
          <p className="text-gray-600">Create and manage counseling firm administrators.</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="create-admin-button">
              <UserPlus className="h-4 w-4 mr-2" />
              Create Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Admin</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="admin@example.com" data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="John" data-testid="input-firstName" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Doe" data-testid="input-lastName" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="Minimum 6 characters" data-testid="input-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel-create"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createAdminMutation.isPending} data-testid="button-submit-create">
                    {createAdminMutation.isPending ? "Creating..." : "Create Admin"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search admins by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="search-admins"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Active and Deleted Admins */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" data-testid="admin-tabs">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active" data-testid="tab-active-admins">
            Active Admins ({filteredAdmins.length})
          </TabsTrigger>
          <TabsTrigger value="deleted" data-testid="tab-deleted-admins">
            Deleted Admins ({filteredDeletedAdmins.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Active Counseling Firm Administrators</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredAdmins.length === 0 ? (
                <div className="text-center py-12" data-testid="empty-active-admins">
                  <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchTerm ? 'No active admins found' : 'No active administrators yet'}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm 
                      ? 'Try adjusting your search terms.' 
                      : 'Create your first admin to start managing counseling firms.'
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-4" data-testid="active-admins-list">
                  {filteredAdmins.map(renderActiveAdminCard)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="deleted" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Deleted Counseling Firm Administrators</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredDeletedAdmins.length === 0 ? (
                <div className="text-center py-12" data-testid="empty-deleted-admins">
                  <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchTerm ? 'No deleted admins found' : 'No deleted administrators'}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm 
                      ? 'Try adjusting your search terms.' 
                      : 'Deleted admins will appear here for reference.'
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-4" data-testid="deleted-admins-list">
                  {filteredDeletedAdmins.map(renderDeletedAdminCard)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Admin Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Admin</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="admin@example.com" data-testid="edit-input-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="John" data-testid="edit-input-firstName" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Doe" data-testid="edit-input-lastName" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" placeholder="Leave blank to keep current password" data-testid="edit-input-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={editAdminMutation.isPending} data-testid="button-submit-edit">
                  {editAdminMutation.isPending ? "Updating..." : "Update Admin"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) setAdminToDelete(null);
      }}>
        <AlertDialogContent data-testid="delete-admin-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="delete-admin-dialog-title">
              Delete Admin
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="delete-admin-dialog-description">
              Are you sure you want to delete{" "}
              <span className="font-semibold">
                {adminToDelete?.firstName} {adminToDelete?.lastName}
              </span>
              ? This action cannot be undone and will permanently remove the admin's account and all associated counselors and students.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-admin">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAdmin}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              disabled={deleteAdminMutation.isPending}
              data-testid="confirm-delete-admin"
            >
              {deleteAdminMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}