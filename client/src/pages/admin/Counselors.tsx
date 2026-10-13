import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Edit, Trash2, Mail, Eye } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";

const addCounselorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function AdminCounselors() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [counselorToDelete, setCounselorToDelete] = useState<any>(null);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: allCounselors, isLoading } = useQuery({
    queryKey: ["/api/counselors"],
  });

  // Client-side filtering to prevent refresh
  const counselors = useMemo(() => {
    if (!allCounselors || !Array.isArray(allCounselors)) return [];
    
    return allCounselors.filter((counselor: any) => {
      return !searchTerm || 
        counselor.user?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        counselor.user?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        counselor.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        counselor.specialization?.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [allCounselors, searchTerm]);

  const form = useForm<z.infer<typeof addCounselorSchema>>({
    resolver: zodResolver(addCounselorSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const createCounselorMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addCounselorSchema>) => {
      const [firstName, ...lastNameParts] = data.name.split(" ");
      const lastName = lastNameParts.join(" ");
      
      await apiRequest("/api/users", "POST", {
        email: data.email,
        firstName,
        lastName,
        role: "counselor",
        password: data.password,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/counselors"] });
      setIsAddModalOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Counselor created successfully",
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

  const deleteCounselorMutation = useMutation({
    mutationFn: async (adminCounselorId: number) => {
      await apiRequest(`/api/counselors/${adminCounselorId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/counselors"] });
      setDeleteDialogOpen(false);
      setCounselorToDelete(null);
      toast({
        title: "Success",
        description: "Counselor deleted successfully",
      });
    },
    onError: (error) => {
      setDeleteDialogOpen(false);
      setCounselorToDelete(null);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteCounselor = (counselor: any) => {
    setCounselorToDelete(counselor);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteCounselor = () => {
    if (counselorToDelete) {
      deleteCounselorMutation.mutate(counselorToDelete.adminCounselorId);
    }
  };

  const onSubmit = (data: z.infer<typeof addCounselorSchema>) => {
    createCounselorMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Counselor Management</h1>
          <p className="text-gray-600">Manage counselor accounts and assignments</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search counselors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-80"
            />
          </div>
        </div>
        
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary-500 hover:bg-primary-600">
              <Plus className="mr-2 h-4 w-4" />
              Add Counselor
            </Button>
          </DialogTrigger>
          
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Counselor</DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter counselor's full name" {...field} />
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
                      <FormLabel>Email Address *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="counselor@example.com" {...field} />
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
                      <FormLabel>Password *</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter password" {...field} />
                      </FormControl>
                      <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                        Requirement: 8+ chars, uppercase, lowercase, number, and special char.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex space-x-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setIsAddModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 bg-primary-500 hover:bg-primary-600"
                    disabled={createCounselorMutation.isPending}
                  >
                    {createCounselorMutation.isPending ? "Adding..." : "Add Counselor"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>



      {/* Counselors Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Counselor</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Email</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Students Assigned</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Join Date</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {Array.isArray(counselors) && counselors.map((counselor: any) => (
                  <tr key={counselor.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-teal-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {counselor.user?.firstName?.[0]}{counselor.user?.lastName?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {counselor.user?.firstName} {counselor.user?.lastName}
                          </p>
                          <p className="text-sm text-gray-500">ID: COUN-{counselor.adminCounselorId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-900">{counselor.user?.email}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {counselor.studentCount || 0} students
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-500">
                        {formatDate(counselor.createdAt)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setLocation(`/admin/counselors/view/${counselor.adminCounselorId}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setLocation(`/admin/counselors/edit/${counselor.adminCounselorId}`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteCounselor(counselor)}
                          disabled={(counselor.studentCount || 0) > 0}
                          className={`${(counselor.studentCount || 0) > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={(counselor.studentCount || 0) > 0 ? `Cannot delete - ${counselor.studentCount} student(s) assigned` : 'Delete counselor'}
                          data-testid={`delete-counselor-${counselor.adminCounselorId}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) setCounselorToDelete(null);
      }}>
        <AlertDialogContent data-testid="delete-counselor-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="delete-counselor-dialog-title">
              Delete Counselor
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="delete-counselor-dialog-description">
              {(counselorToDelete?.studentCount || 0) > 0 ? (
                <div className="space-y-2">
                  <p className="text-red-600 font-semibold">
                    Cannot delete this counselor - they have {counselorToDelete?.studentCount} student(s) assigned.
                  </p>
                  <p>Please unassign all students from{" "}
                    <span className="font-semibold">
                      {counselorToDelete?.user?.firstName} {counselorToDelete?.user?.lastName}
                    </span>
                    {" "}before attempting to delete their account.
                  </p>
                </div>
              ) : (
                <div>
                  Are you sure you want to delete{" "}
                  <span className="font-semibold">
                    {counselorToDelete?.user?.firstName} {counselorToDelete?.user?.lastName}
                  </span>
                  ? This action cannot be undone and will permanently remove the counselor's account and all associated data.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-counselor">
              {(counselorToDelete?.studentCount || 0) > 0 ? "Close" : "Cancel"}
            </AlertDialogCancel>
            {(counselorToDelete?.studentCount || 0) === 0 && (
              <AlertDialogAction
                onClick={confirmDeleteCounselor}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                disabled={deleteCounselorMutation.isPending}
                data-testid="confirm-delete-counselor"
              >
                {deleteCounselorMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
