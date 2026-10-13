import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Users, UserPlus, Building2, MoreHorizontal, Trash2, Edit2, Eye } from "lucide-react";
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

interface AdminStats {
  totalAdmins: number;
  totalCounselors: number;
  totalStudents: number;
}

interface Admin {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isDeleted: boolean;
  createdAt: string;
  counselorCount?: number;
  studentCount?: number;
}

export default function DeveloperDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);

  const { data: admins = [], isLoading } = useQuery<Admin[]>({
    queryKey: ["/api/developer/admins"],
  });

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["/api/developer/stats"],
  });

  const createAdminMutation = useMutation({
    mutationFn: (data: CreateAdminForm) => apiRequest("/api/developer/admins", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/admins"] });
      queryClient.invalidateQueries({ queryKey: ["/api/developer/stats"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/developer/stats"] });
      toast({ title: "Success", description: "Admin deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete admin",
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

  const editAdminMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditAdminForm }) => 
      apiRequest(`/api/developer/admins/${id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/admins"] });
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

  const onSubmit = (data: CreateAdminForm) => {
    createAdminMutation.mutate(data);
  };

  const onEditSubmit = (data: EditAdminForm) => {
    if (selectedAdmin) {
      editAdminMutation.mutate({ id: selectedAdmin.id, data });
    }
  };

  const handleViewAdmin = (admin: Admin) => {
    setSelectedAdmin(admin);
    setIsViewDialogOpen(true);
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

  const handleDeleteAdmin = (adminId: string, adminName: string) => {
    if (confirm(`Are you sure you want to delete admin "${adminName}"? This will also delete all their counselors and students.`)) {
      deleteAdminMutation.mutate(adminId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Developer Dashboard</h1>
          <p className="font-ui text-muted-foreground mt-1">Manage all counseling firm administrators and system-wide settings.</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Create Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading">Create New Admin</DialogTitle>
              <DialogDescription className="font-ui">
                Create a new administrator account for a counseling firm.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-ui">Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="admin@example.com" />
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
                      <FormLabel className="font-ui">First Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="John" />
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
                      <FormLabel className="font-ui">Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Doe" />
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
                      <FormLabel className="font-ui">Password</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="Minimum 6 characters" />
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
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createAdminMutation.isPending}>
                    {createAdminMutation.isPending ? "Creating..." : "Create Admin"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="section-sky">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-ui text-sm font-medium text-muted-foreground">Total Admins</p>
                <p className="font-heading text-3xl font-bold text-foreground mt-1">{stats?.totalAdmins || 0}</p>
              </div>
              <div className="w-12 h-12 bg-[hsl(200,45%,80%)] rounded-xl flex items-center justify-center">
                <Users className="h-6 w-6 text-[hsl(200,55%,35%)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="section-sage">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-ui text-sm font-medium text-muted-foreground">Total Counselors</p>
                <p className="font-heading text-3xl font-bold text-foreground mt-1">{stats?.totalCounselors || 0}</p>
              </div>
              <div className="w-12 h-12 bg-[hsl(145,30%,78%)] rounded-xl flex items-center justify-center">
                <Building2 className="h-6 w-6 text-[hsl(145,40%,35%)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="section-lavender">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-ui text-sm font-medium text-muted-foreground">Total Students</p>
                <p className="font-heading text-3xl font-bold text-foreground mt-1">{stats?.totalStudents || 0}</p>
              </div>
              <div className="w-12 h-12 bg-[hsl(270,30%,82%)] rounded-xl flex items-center justify-center">
                <Users className="h-6 w-6 text-[hsl(270,35%,45%)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="section-peach">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-ui text-sm font-medium text-muted-foreground">Active Firms</p>
                <p className="font-heading text-3xl font-bold text-foreground mt-1">{admins.length}</p>
              </div>
              <div className="w-12 h-12 bg-[hsl(25,50%,82%)] rounded-xl flex items-center justify-center">
                <Building2 className="h-6 w-6 text-[hsl(25,55%,40%)]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admins List */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Counseling Firm Administrators</CardTitle>
        </CardHeader>
        <CardContent>
          {admins.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="font-heading text-lg font-medium text-foreground mb-2">No administrators yet</h3>
              <p className="font-ui text-muted-foreground mb-4">
                Create your first admin to start managing counseling firms.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {admins.map((admin) => (
                <div key={admin.id} className="flex items-center justify-between p-4 border border-border/60 rounded-xl section-cream">
                  <div className="flex items-center space-x-4">
                    <div className="w-11 h-11 bg-[#141413] rounded-full flex items-center justify-center">
                      <span className="text-[hsl(40,33%,97%)] font-ui font-medium">
                        {admin.firstName?.[0]}{admin.lastName?.[0]}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-ui font-semibold text-foreground">
                        {admin.firstName} {admin.lastName}
                      </h3>
                      <p className="font-ui text-sm text-muted-foreground">{admin.email}</p>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="font-ui text-xs text-muted-foreground">
                          {admin.counselorCount || 0} counselors
                        </span>
                        <span className="font-ui text-xs text-muted-foreground">
                          {admin.studentCount || 0} students
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge variant={admin.isDeleted ? "destructive" : "success"}>
                      {admin.isDeleted ? "Inactive" : "Active"}
                    </Badge>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewAdmin(admin)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditAdmin(admin)}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteAdmin(admin.id, `${admin.firstName} ${admin.lastName}`)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Admin
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Admin Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Edit Admin</DialogTitle>
            <DialogDescription className="font-ui">
              Update administrator account information.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-ui">Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="admin@example.com" />
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
                    <FormLabel className="font-ui">First Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="John" />
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
                    <FormLabel className="font-ui">Last Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Doe" />
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
                    <FormLabel className="font-ui">New Password (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" placeholder="Leave blank to keep current password" />
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
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={editAdminMutation.isPending}>
                  {editAdminMutation.isPending ? "Updating..." : "Update Admin"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Admin Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Admin Details</DialogTitle>
            <DialogDescription className="font-ui">
              View detailed information about this administrator.
            </DialogDescription>
          </DialogHeader>
          {selectedAdmin && (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-[#141413] rounded-full flex items-center justify-center">
                  <span className="text-[hsl(40,33%,97%)] font-ui font-medium text-xl">
                    {selectedAdmin.firstName?.[0]}{selectedAdmin.lastName?.[0]}
                  </span>
                </div>
                <div>
                  <h3 className="font-heading text-lg font-semibold text-foreground">
                    {selectedAdmin.firstName} {selectedAdmin.lastName}
                  </h3>
                  <p className="font-ui text-sm text-muted-foreground">{selectedAdmin.email}</p>
                  <Badge variant={selectedAdmin.isDeleted ? "destructive" : "success"} className="mt-1">
                    {selectedAdmin.isDeleted ? "Inactive" : "Active"}
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <Card className="section-sky">
                  <CardContent className="p-4">
                    <div className="text-center">
                      <p className="font-heading text-2xl font-bold text-[hsl(200,55%,35%)]">{selectedAdmin.counselorCount || 0}</p>
                      <p className="font-body text-sm text-muted-foreground">Counselors</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="section-sage">
                  <CardContent className="p-4">
                    <div className="text-center">
                      <p className="font-heading text-2xl font-bold text-[hsl(145,40%,35%)]">{selectedAdmin.studentCount || 0}</p>
                      <p className="font-body text-sm text-muted-foreground">Students</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                <Label className="font-ui">Account Information</Label>
                <div className="section-cream p-4 rounded-xl space-y-2">
                  <div className="flex justify-between">
                    <span className="font-body text-sm text-muted-foreground">Admin ID:</span>
                    <span className="font-ui text-sm font-mono">{selectedAdmin.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-body text-sm text-muted-foreground">Created:</span>
                    <span className="font-ui text-sm">{new Date(selectedAdmin.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-body text-sm text-muted-foreground">Role:</span>
                    <span className="font-ui text-sm capitalize">{selectedAdmin.role}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                  Close
                </Button>
                <Button onClick={() => {
                  setIsViewDialogOpen(false);
                  handleEditAdmin(selectedAdmin);
                }}>
                  Edit Admin
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
