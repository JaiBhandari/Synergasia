import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Eye, MessageSquare, Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";
import TaskForm from "./TaskForm";
import MessageDialog from "@/components/MessageDialog";

export default function CounselorStudents() {
  const [searchTerm, setSearchTerm] = useState("");
  const [, setLocation] = useLocation();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [selectedMessageStudent, setSelectedMessageStudent] = useState<{
    id: number;
    userId: string;
    name: string;
  } | null>(null);

  const { data: students, isLoading } = useQuery({
    queryKey: ["/api/students", searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      
      const response = await fetch(`/api/students?${params.toString()}`, {
        credentials: "include",
      });
      
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    staleTime: 3 * 60 * 1000, // 3 minutes - longer for search results
    gcTime: 8 * 60 * 1000, // Keep in cache for 8 minutes
  });

  const { data: tasks } = useQuery({
    queryKey: ["/api/tasks"],
    queryFn: async () => {
      const response = await fetch("/api/tasks", {
        credentials: "include",
      });
      
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - tasks change more frequently
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

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

  const getPendingTasksCount = (studentId: number) => {
    if (!tasks) return 0;
    return tasks.filter((task: any) => 
      task.studentId === studentId && 
      (task.status === 'pending' || task.status === 'in_progress')
    ).length;
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
          <h1 className="text-3xl font-bold text-gray-900">My Students</h1>
          <p className="text-gray-600">Monitor and assist your assigned students</p>
        </div>
      </div>

      {/* Search Bar */}
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

      {/* Students Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Student</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Email</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Profile Status</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Last Activity</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Pending Tasks</th>
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
                    <td className="py-4 px-6" data-testid={`pending-tasks-${student.id}`}>
                      <Badge variant="outline">
                        {getPendingTasksCount(student.id)} pending
                      </Badge>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          title="View Profile"
                          onClick={() => {
                            console.log("View button clicked for student adminStudentId:", student.adminStudentId);
                            console.log("Navigating to:", `/counselor/students/${student.adminStudentId}`);
                            setLocation(`/counselor/students/${student.adminStudentId}`);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        <Dialog open={taskDialogOpen && selectedStudentId === student.id} onOpenChange={(open) => {
                          setTaskDialogOpen(open);
                          if (!open) setSelectedStudentId(null);
                        }}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              title="Add Task"
                              onClick={() => {
                                setSelectedStudentId(student.id);
                                setTaskDialogOpen(true);
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Assign Task to {student.user?.firstName} {student.user?.lastName}</DialogTitle>
                            </DialogHeader>
                            <TaskForm 
                              studentId={student.id}
                              onSuccess={() => {
                                setTaskDialogOpen(false);
                                setSelectedStudentId(null);
                              }}
                            />
                          </DialogContent>
                        </Dialog>
                        
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          title="Send Message"
                          onClick={() => {
                            setSelectedMessageStudent({
                              id: student.adminStudentId,
                              userId: student.userId,
                              name: `${student.user?.firstName || ''} ${student.user?.lastName || ''}`.trim()
                            });
                            setMessageDialogOpen(true);
                          }}
                          data-testid={`button-message-${student.adminStudentId}`}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {students?.length === 0 && (
              <div className="text-center py-12">
                <Search className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No students found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm ? "Try adjusting your search criteria." : "No students are assigned to you yet."}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-gray-900">{students?.length || 0}</div>
            <div className="text-sm text-gray-500">Total Students</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-green-600">
              {students?.filter((s: any) => s.profileStatus === 'complete').length || 0}
            </div>
            <div className="text-sm text-gray-500">Complete Profiles</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-red-600">
              {students?.filter((s: any) => s.profileStatus === 'incomplete').length || 0}
            </div>
            <div className="text-sm text-gray-500">Incomplete Profiles</div>
          </CardContent>
        </Card>
      </div>

      {/* Message Dialog */}
      {selectedMessageStudent && (
        <MessageDialog
          open={messageDialogOpen}
          onOpenChange={setMessageDialogOpen}
          studentId={selectedMessageStudent.id}
          studentName={selectedMessageStudent.name}
          studentUserId={selectedMessageStudent.userId}
        />
      )}
    </div>
  );
}