import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Calendar, Clock, CheckCircle, Circle, AlertCircle, Check, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function StudentTasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Read URL parameters on component mount to set initial filter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const statusParam = urlParams.get('status');
    if (statusParam && ['pending', 'in_progress', 'complete', 'overdue'].includes(statusParam)) {
      setFilterStatus(statusParam);
    }
  }, []);

  const { data: student } = useQuery({
    queryKey: ["/api/me/student"],
    queryFn: async () => {
      const response = await fetch("/api/me/student", {
        credentials: "include",
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["/api/tasks"],
    queryFn: async () => {
      const response = await fetch(`/api/tasks${student?.id ? `?studentId=${student.id}` : ''}`, {
        credentials: "include",
        cache: "no-store", // Bypass HTTP cache to ensure fresh data
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    enabled: !!student?.id,
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest(`/api/tasks/${id}/status`, "PUT", { status });
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      const queryKey = ["/api/tasks"];
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData(queryKey);

      // Optimistically update to the new value
      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData || !Array.isArray(oldData)) {
          return oldData;
        }
        
        return oldData.map((task: any) => 
          task.id === variables.id ? { ...task, status: variables.status } : task
        );
      });

      // Return a context object with the snapshotted value
      return { previousTasks };
    },
    onError: (error, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      const queryKey = ["/api/tasks"];
      if (context?.previousTasks) {
        queryClient.setQueryData(queryKey, context.previousTasks);
      }
      
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
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Task status updated successfully",
      });
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      const queryKey = ["/api/tasks"];
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const handleTaskStatusChange = (taskId: number, newStatus: string) => {
    updateTaskMutation.mutate({ id: taskId, status: newStatus });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'pending':
        return <Circle className="h-4 w-4 text-gray-400" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getFilteredTasks = () => {
    if (!tasks) return [];
    
    let filteredTasks = [...tasks];
    
    switch (filterStatus) {
      case 'all':
        break;
      case 'pending':
        filteredTasks = filteredTasks.filter((task: any) => task.status === 'pending');
        break;
      case 'in_progress':
        filteredTasks = filteredTasks.filter((task: any) => task.status === 'in_progress');
        break;
      case 'complete':
        filteredTasks = filteredTasks.filter((task: any) => task.status === 'complete');
        break;
      case 'overdue':
        filteredTasks = filteredTasks.filter((task: any) => 
          task.dueDate && 
          new Date(task.dueDate) < new Date() && 
          task.status !== 'complete'
        );
        break;
      default:
        break;
    }
    
    return filteredTasks;
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
          <h1 className="text-3xl font-bold text-gray-900">My Tasks</h1>
          <p className="text-gray-600">Track your assigned tasks and deadlines</p>
        </div>
      </div>

      {/* Tasks Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Tasks</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="text-total-tasks">{tasks?.length || 0}</p>
              </div>
              <Target className="h-8 w-8 text-primary-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-600" data-testid="text-pending-tasks">
                  {tasks?.filter((task: any) => task.status === 'pending').length || 0}
                </p>
              </div>
              <Circle className="h-8 w-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="text-in-progress-tasks">
                  {tasks?.filter((task: any) => task.status === 'in_progress').length || 0}
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-completed-tasks">
                  {tasks?.filter((task: any) => task.status === 'complete').length || 0}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Controls */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border">
        <div className="flex items-center space-x-3">
          <Filter className="h-5 w-5 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filter tasks:</span>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48" data-testid="select-task-filter">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="filter-all">All Tasks</SelectItem>
              <SelectItem value="pending" data-testid="filter-pending">Pending</SelectItem>
              <SelectItem value="in_progress" data-testid="filter-in-progress">In Progress</SelectItem>
              <SelectItem value="complete" data-testid="filter-complete">Completed</SelectItem>
              <SelectItem value="overdue" data-testid="filter-overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-gray-500">
          Showing {getFilteredTasks().length} of {tasks?.length || 0} tasks
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-4">
        {tasks?.length > 0 ? (
          <>
            {/* Display filtered tasks */}
            {(showAllTasks ? getFilteredTasks() : getFilteredTasks().slice(0, 5)).map((task: any) => (
              <Card key={task.id} className="hover:shadow-lg transition-shadow" data-testid={`card-task-${task.id}`}>
                <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="mt-1">
                      {getStatusIcon(task.status)}
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-2" data-testid={`text-task-title-${task.id}`}>{task.title}</h3>
                      
                      {task.description && (
                        <p className="text-gray-600 mb-3">{task.description}</p>
                      )}
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        {task.dueDate && (
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />
                            <span>Due: {formatDate(task.dueDate)}</span>
                          </div>
                        )}
                        
                        {task.priority && (
                          <Badge className={getPriorityColor(task.priority)}>
                            {task.priority} priority
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end space-y-2">
                    <Badge className={getStatusColor(task.status)} data-testid={`badge-task-status-${task.id}`}>
                      {task.status.replace('_', ' ')}
                    </Badge>
                    
                    {/* Task Action Buttons for Students */}
                    <div className="flex space-x-2">
                      {task.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTaskStatusChange(task.id, 'in_progress')}
                          disabled={updateTaskMutation.isPending}
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                          data-testid={`button-start-task-${task.id}`}
                        >
                          <Clock className="h-4 w-4 mr-1" />
                          Start Task
                        </Button>
                      )}
                      
                      {(task.status === 'pending' || task.status === 'in_progress') && (
                        <Button
                          size="sm"
                          onClick={() => handleTaskStatusChange(task.id, 'complete')}
                          disabled={updateTaskMutation.isPending}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          data-testid={`button-complete-task-${task.id}`}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Complete
                        </Button>
                      )}
                      
                      {task.status === 'complete' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTaskStatusChange(task.id, 'in_progress')}
                          disabled={updateTaskMutation.isPending}
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                          data-testid={`button-reopen-task-${task.id}`}
                        >
                          <Clock className="h-4 w-4 mr-1" />
                          Reopen
                        </Button>
                      )}
                    </div>
                    
                    {task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'complete' && (
                      <div className="flex items-center space-x-1 text-red-500 text-sm">
                        <AlertCircle className="h-4 w-4" />
                        <span>Overdue</span>
                      </div>
                    )}
                  </div>
                </div>
                </CardContent>
              </Card>
            ))}
            
            {/* Show View Old Tasks button if there are more than 5 filtered tasks */}
            {getFilteredTasks().length > 5 && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAllTasks(!showAllTasks)}
                  className="flex items-center space-x-2"
                  data-testid="button-show-all-tasks"
                >
                  {showAllTasks ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      <span>Show Recent Tasks Only</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      <span>View Old Tasks ({getFilteredTasks().length - 5} more)</span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Target className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks assigned</h3>
              <p className="text-gray-500">
                Your counselor hasn't assigned any tasks yet. Check back later!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}