import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Eye, Edit, Trash2, Filter } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { formatDate } from "@/lib/utils";

const addStudentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  counselorId: z.number().min(1, "Counselor is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function AdminStudents() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCounselor, setSelectedCounselor] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<any>(null);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all students without search parameters
  const { data: allStudents, isLoading } = useQuery({
    queryKey: ["/api/students"],
  });

  // Client-side filtering to prevent refresh
  const students = useMemo(() => {
    if (!allStudents || !Array.isArray(allStudents)) return [];
    
    return allStudents.filter((student: any) => {
      const matchesSearch = !searchTerm || 
        student.user?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.user?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.user?.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCounselor = !selectedCounselor || selectedCounselor === "all" ||
        student.counselorId?.toString() === selectedCounselor;
      
      return matchesSearch && matchesCounselor;
    });
  }, [allStudents, searchTerm, selectedCounselor]);

  const { data: counselors = [] } = useQuery({
    queryKey: ["/api/counselors"],
    queryFn: async () => {
      const response = await fetch("/api/counselors", {
        credentials: "include",
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
  });

  // Fetch all tasks to calculate pending tasks per student
  const { data: allTasks = [] } = useQuery({
    queryKey: ["/api/tasks"],
  });

  const form = useForm<z.infer<typeof addStudentSchema>>({
    resolver: zodResolver(addStudentSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      counselorId: undefined,
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addStudentSchema>) => {
      const [firstName, ...lastNameParts] = data.name.split(" ");
      const lastName = lastNameParts.join(" ");
      
      // Create the user account with student role and counselor assignment
      await apiRequest("/api/users", "POST", {
        email: data.email.toLowerCase().trim(),
        firstName,
        lastName,
        role: "student",
        password: data.password,
        counselorId: data.counselorId,
      });
    },
    onSuccess: () => {
      // Invalidate all student queries regardless of additional parameters (like searchTerm)
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/students"
      });
      setIsAddModalOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Student created successfully",
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

  const deleteStudentMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/students/${id}`, "DELETE");
    },
    onSuccess: () => {
      // Invalidate all student queries regardless of additional parameters (like searchTerm)
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/students"
      });
      setDeleteDialogOpen(false);
      setStudentToDelete(null);
      toast({
        title: "Success",
        description: "Student deleted successfully",
      });
    },
    onError: (error) => {
      setDeleteDialogOpen(false);
      setStudentToDelete(null);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteStudent = (student: any) => {
    setStudentToDelete(student);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteStudent = () => {
    if (studentToDelete) {
      deleteStudentMutation.mutate(studentToDelete.adminStudentId);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "complete":
        return <Badge className="bg-green-100 text-green-800">Complete</Badge>;
      case "in_progress":
        return <Badge className="bg-yellow-100 text-yellow-800">In Progress</Badge>;
      default:
        return <Badge className="bg-red-100 text-red-800">Incomplete</Badge>;
    }
  };

  const onSubmit = (data: z.infer<typeof addStudentSchema>) => {
    createUserMutation.mutate(data);
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
          <h1 className="text-3xl font-bold text-gray-900">Student Management</h1>
          <p className="text-gray-600">Manage student accounts and profiles</p>
        </div>
        
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary-500 hover:bg-primary-600">
              <Plus className="mr-2 h-4 w-4" />
              Add Student
            </Button>
          </DialogTrigger>
          
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
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
                        <Input placeholder="Enter student's full name" {...field} />
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
                        <Input type="email" placeholder="student@example.com" {...field} />
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
                      <FormLabel>Assigned Counselor *</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a counselor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {counselors.map((counselor: any) => (
                            <SelectItem key={counselor.id} value={counselor.id.toString()}>
                              {counselor.user?.firstName} {counselor.user?.lastName}
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
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Password *</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter initial password" {...field} />
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
                    disabled={createUserMutation.isPending}
                  >
                    {createUserMutation.isPending ? "Adding..." : "Add Student"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-80"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Select value={selectedCounselor} onValueChange={setSelectedCounselor}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Counselors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Counselors</SelectItem>
              {counselors.map((counselor: any) => (
                <SelectItem key={counselor.id} value={counselor.id.toString()}>
                  {counselor.user?.firstName} {counselor.user?.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Students Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Student</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Email</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Pending Tasks</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Profile Status</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Last Activity</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {students?.map((student: any) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {student.user?.firstName?.[0]}{student.user?.lastName?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {student.user?.firstName} {student.user?.lastName}
                          </p>
                          <p className="text-sm text-gray-500">ID: STU-{student.adminStudentId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-gray-900">{student.user?.email}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm font-medium text-gray-900" data-testid={`pending-tasks-${student.id}`}>
                        {(allTasks as any[])?.filter((task: any) => task.studentId === student.id && task.status === 'pending').length || 0} pending
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {getStatusBadge(student.profileStatus)}
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-500">
                        {student.lastActivity 
                          ? formatDate(student.lastActivity)
                          : "Never"
                        }
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setLocation(`/admin/students/view/${student.adminStudentId}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setLocation(`/admin/students/edit/${student.adminStudentId}`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteStudent(student)}
                          data-testid={`delete-student-${student.adminStudentId}`}
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
        if (!open) setStudentToDelete(null);
      }}>
        <AlertDialogContent data-testid="delete-student-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="delete-student-dialog-title">
              Delete Student
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="delete-student-dialog-description">
              Are you sure you want to delete{" "}
              <span className="font-semibold">
                {studentToDelete?.user?.firstName} {studentToDelete?.user?.lastName}
              </span>
              ? This action cannot be undone and will permanently remove the student's account and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-student">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteStudent}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              disabled={deleteStudentMutation.isPending}
              data-testid="confirm-delete-student"
            >
              {deleteStudentMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
