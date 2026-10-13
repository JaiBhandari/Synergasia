import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle, UserCheck, Clock } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface Activity {
  type: string;
  message: string;
  detail: string;
  time: string;
  icon: any;
  color: string;
}

export default function AdminDashboard() {
  const { data: students } = useQuery({
    queryKey: ["/api/students"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: counselors } = useQuery({
    queryKey: ["/api/counselors"],
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const { data: tasks } = useQuery({
    queryKey: ["/api/tasks"],
    staleTime: 0, // Always fetch fresh data for real-time updates
    gcTime: 5 * 60 * 1000,
  });

  const studentsArray = Array.isArray(students) ? students : [];
  const counselorsArray = Array.isArray(counselors) ? counselors : [];
  const tasksArray = Array.isArray(tasks) ? tasks : [];

  const totalStudents = studentsArray.length;
  const completeProfiles = studentsArray.filter((s: any) => s.profileStatus === 'complete').length;
  const inProgressProfiles = studentsArray.filter((s: any) => s.profileStatus === 'in_progress').length;
  const incompleteProfiles = studentsArray.filter((s: any) => s.profileStatus === 'incomplete').length;
  const activeCounselors = counselorsArray.length;
  const pendingTasks = tasksArray.filter((t: any) => t.status === 'pending').length;
  const completedTasks = tasksArray.filter((t: any) => t.status === 'complete').length;
  const inProgressTasks = tasksArray.filter((t: any) => t.status === 'in_progress').length;

  const profileCompletionRate = totalStudents > 0 ? Math.round((completeProfiles / totalStudents) * 100) : 0;

  const getRecentActivities = (): Activity[] => {
    const activities: Activity[] = [];
    
    if (studentsArray.length > 0) {
      const recentStudents = [...studentsArray]
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 3);
      
      recentStudents.forEach((student: any) => {
        activities.push({
          type: 'student_registered',
          message: `New student registered`,
          detail: `${student.user?.firstName || 'Student'} ${student.user?.lastName || ''} joined the system`,
          time: student.createdAt,
          icon: Users,
          color: 'sky'
        });
      });
    }

    if (studentsArray.length > 0) {
      const recentCompletions = studentsArray
        .filter((s: any) => s.profileStatus === 'complete')
        .sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
        .slice(0, 2);
      
      recentCompletions.forEach((student: any) => {
        activities.push({
          type: 'profile_completed',
          message: `Profile completed`,
          detail: `${student.user?.firstName || 'Student'} ${student.user?.lastName || ''} completed their profile`,
          time: student.updatedAt || student.createdAt,
          icon: CheckCircle,
          color: 'sage'
        });
      });
    }

    if (tasksArray.length > 0) {
      const recentTasks = [...tasksArray]
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 2);
      
      recentTasks.forEach((task: any) => {
        activities.push({
          type: 'task_created',
          message: `New task assigned`,
          detail: `"${task.title}" assigned to student`,
          time: task.createdAt,
          icon: Clock,
          color: 'peach'
        });
      });
    }

    return activities
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 5);
  };

  const recentActivities = getRecentActivities();

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} days ago`;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold text-foreground">Dashboard Overview</h1>
        <p className="font-ui text-muted-foreground mt-1">Monitor system statistics and activity</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="section-sky">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-ui text-sm font-medium text-muted-foreground">Total Students</p>
                <p className="font-heading text-3xl font-bold text-foreground mt-1">{totalStudents}</p>
              </div>
              <div className="w-12 h-12 bg-[hsl(200,45%,80%)] rounded-xl flex items-center justify-center">
                <Users className="text-[hsl(200,55%,35%)] h-6 w-6" />
              </div>
            </div>
            <div className="mt-4">
              <p className="font-ui text-sm text-muted-foreground">
                {incompleteProfiles} incomplete · {inProgressProfiles} in progress
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="section-sage">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-ui text-sm font-medium text-muted-foreground">Complete Profiles</p>
                <p className="font-heading text-3xl font-bold text-foreground mt-1">{completeProfiles}</p>
              </div>
              <div className="w-12 h-12 bg-[hsl(145,30%,78%)] rounded-xl flex items-center justify-center">
                <CheckCircle className="text-[hsl(145,40%,35%)] h-6 w-6" />
              </div>
            </div>
            <div className="mt-4">
              <p className="font-ui text-sm text-muted-foreground">
                {profileCompletionRate}% completion rate
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="section-peach">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-ui text-sm font-medium text-muted-foreground">Active Counselors</p>
                <p className="font-heading text-3xl font-bold text-foreground mt-1">{activeCounselors}</p>
              </div>
              <div className="w-12 h-12 bg-[hsl(25,50%,82%)] rounded-xl flex items-center justify-center">
                <UserCheck className="text-[hsl(25,55%,40%)] h-6 w-6" />
              </div>
            </div>
            <div className="mt-4">
              <p className="font-ui text-sm text-muted-foreground">
                {activeCounselors > 0 ? 'All counselors active' : 'No counselors'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="section-lavender">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-ui text-sm font-medium text-muted-foreground">Pending Tasks</p>
                <p className="font-heading text-3xl font-bold text-foreground mt-1">{pendingTasks}</p>
              </div>
              <div className="w-12 h-12 bg-[hsl(270,30%,82%)] rounded-xl flex items-center justify-center">
                <Clock className="text-[hsl(270,35%,45%)] h-6 w-6" />
              </div>
            </div>
            <div className="mt-4">
              <p className="font-ui text-sm text-muted-foreground">
                {completedTasks} completed · {inProgressTasks} in progress
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivities.length === 0 ? (
              <div className="text-center py-8">
                <p className="font-ui text-muted-foreground">No recent activity to display</p>
                <p className="font-ui text-sm text-muted-foreground mt-1">Activities will appear here as users interact with the system</p>
              </div>
            ) : (
              recentActivities.map((activity, index) => {
                const IconComponent = activity.icon;
                const colorClasses = {
                  sky: 'section-sky',
                  sage: 'section-sage',
                  peach: 'section-peach',
                  lavender: 'section-lavender'
                };
                const iconColorClasses = {
                  sky: 'text-[hsl(200,55%,35%)]',
                  sage: 'text-[hsl(145,40%,35%)]',
                  peach: 'text-[hsl(25,55%,40%)]',
                  lavender: 'text-[hsl(270,35%,45%)]'
                };
                
                return (
                  <div key={index} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClasses[activity.color as keyof typeof colorClasses] || 'section-cream'}`}>
                        <IconComponent className={`h-5 w-5 ${iconColorClasses[activity.color as keyof typeof iconColorClasses] || 'text-foreground'}`} />
                      </div>
                      <div>
                        <p className="font-ui font-medium text-foreground">{activity.message}</p>
                        <p className="font-ui text-sm text-muted-foreground">{activity.detail}</p>
                      </div>
                    </div>
                    <span className="font-ui text-sm text-muted-foreground">{getRelativeTime(activity.time)}</span>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
