import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Clock, CheckCircle, RotateCcw, Users } from "lucide-react";
import { Link } from "wouter";
import type { Student, Task } from "@shared/schema";

export default function CounselorDashboard() {
  const { user } = useAuth();
  
  const { data: students } = useQuery<Student[]>({
    queryKey: ["/api/students"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: tasks } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    staleTime: 0, // Always fetch fresh data for real-time updates
    gcTime: 5 * 60 * 1000,
  });

  const totalTasks = tasks?.length || 0;
  const pendingTasks = tasks?.filter((t: any) => t.status === 'pending').length || 0;
  const inProgressTasks = tasks?.filter((t: any) => t.status === 'in_progress').length || 0;
  const completeTasks = tasks?.filter((t: any) => t.status === 'complete').length || 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="font-ui text-muted-foreground mt-1">Welcome back, {user?.firstName}! Here's your overview.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Link href="/counselor/tasks">
          <Card className="cursor-pointer hover:shadow-elevated transition-all duration-200 section-sky" data-testid="card-total-tasks">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-ui text-sm font-medium text-muted-foreground">Total Tasks</p>
                  <p className="font-heading text-3xl font-bold text-foreground mt-1">{totalTasks}</p>
                </div>
                <div className="w-12 h-12 bg-[hsl(200,45%,80%)] rounded-xl flex items-center justify-center">
                  <Target className="text-[hsl(200,55%,35%)] h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/counselor/tasks?status=pending">
          <Card className="cursor-pointer hover:shadow-elevated transition-all duration-200 section-peach" data-testid="card-pending-tasks">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-ui text-sm font-medium text-muted-foreground">Pending</p>
                  <p className="font-heading text-3xl font-bold text-foreground mt-1">{pendingTasks}</p>
                </div>
                <div className="w-12 h-12 bg-[hsl(25,50%,82%)] rounded-xl flex items-center justify-center">
                  <Clock className="text-[hsl(25,55%,40%)] h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/counselor/tasks?status=in_progress">
          <Card className="cursor-pointer hover:shadow-elevated transition-all duration-200 section-lavender" data-testid="card-in-progress-tasks">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-ui text-sm font-medium text-muted-foreground">In Progress</p>
                  <p className="font-heading text-3xl font-bold text-foreground mt-1">{inProgressTasks}</p>
                </div>
                <div className="w-12 h-12 bg-[hsl(270,30%,82%)] rounded-xl flex items-center justify-center">
                  <RotateCcw className="text-[hsl(270,35%,45%)] h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/counselor/tasks?status=complete">
          <Card className="cursor-pointer hover:shadow-elevated transition-all duration-200 section-sage" data-testid="card-completed-tasks">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-ui text-sm font-medium text-muted-foreground">Completed</p>
                  <p className="font-heading text-3xl font-bold text-foreground mt-1">{completeTasks}</p>
                </div>
                <div className="w-12 h-12 bg-[hsl(145,30%,78%)] rounded-xl flex items-center justify-center">
                  <CheckCircle className="text-[hsl(145,40%,35%)] h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Students */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Recent Student Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {students?.slice(0, 5).map((student: any) => (
              <div key={student.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-[#141413] rounded-full flex items-center justify-center">
                    <span className="text-[hsl(40,33%,97%)] font-ui text-sm font-medium">
                      {student.user?.firstName?.[0]}{student.user?.lastName?.[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-ui font-medium text-foreground">
                      {student.user?.firstName} {student.user?.lastName}
                    </p>
                    <p className="font-ui text-sm text-muted-foreground">{student.user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Badge 
                    className={`font-ui ${
                      student.profileStatus === 'complete' 
                        ? 'bg-[hsl(145,30%,88%)] text-[hsl(145,40%,30%)]'
                        : student.profileStatus === 'in_progress'
                        ? 'bg-[hsl(40,60%,88%)] text-[hsl(40,60%,30%)]'
                        : 'bg-[hsl(0,50%,92%)] text-[hsl(0,50%,35%)]'
                    }`}
                  >
                    {student.profileStatus === 'complete' && 'Complete'}
                    {student.profileStatus === 'in_progress' && 'In Progress'}
                    {student.profileStatus === 'incomplete' && 'Incomplete'}
                  </Badge>
                  <span className="font-ui text-sm text-muted-foreground">
                    {student.lastActivity 
                      ? new Date(student.lastActivity).toLocaleDateString()
                      : "No activity"
                    }
                  </span>
                </div>
              </div>
            ))}
            
            {(!students || students.length === 0) && (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-muted-foreground/40" />
                <h3 className="mt-3 font-ui font-medium text-foreground">No students assigned</h3>
                <p className="mt-1 font-ui text-sm text-muted-foreground">
                  Students will appear here once assigned to you.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Upcoming Task Deadlines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tasks?.filter((t: any) => t.status !== 'complete' && t.dueDate)
              .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
              .slice(0, 5)
              .map((task: any) => {
                const isOverdue = new Date(task.dueDate) < new Date();
                return (
                  <div key={task.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                    <div>
                      <p className="font-ui font-medium text-foreground">{task.title}</p>
                      <p className="font-ui text-sm text-muted-foreground">{task.description}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge 
                        className={`font-ui ${isOverdue ? 'bg-[hsl(0,50%,92%)] text-[hsl(0,50%,35%)]' : 'bg-[hsl(200,40%,90%)] text-[hsl(200,50%,35%)]'}`}
                      >
                        {isOverdue ? 'Overdue' : 'Pending'}
                      </Badge>
                      <span className={`font-ui text-sm ${isOverdue ? 'text-[hsl(0,50%,45%)]' : 'text-muted-foreground'}`}>
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            
            {(!tasks || tasks.filter((t: any) => t.status !== 'complete' && t.dueDate).length === 0) && (
              <div className="text-center py-8">
                <Clock className="mx-auto h-12 w-12 text-muted-foreground/40" />
                <h3 className="mt-3 font-ui font-medium text-foreground">No upcoming deadlines</h3>
                <p className="mt-1 font-ui text-sm text-muted-foreground">
                  Task deadlines will appear here.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
