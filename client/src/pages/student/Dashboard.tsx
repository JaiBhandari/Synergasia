import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { User, Calendar, University, CheckCircle, Clock, AlertTriangle, Mail, Phone, UserCheck } from "lucide-react";
import { Link } from "wouter";
import MessagesPanel from "@/components/MessagesPanel";

export default function StudentDashboard() {
  const { user } = useAuth();
  
  const { data: userData } = useQuery({
    queryKey: ["/api/auth/user"],
  }) as { data: any };

  const { data: student } = useQuery({
    queryKey: ["/api/me/student"],
    enabled: userData?.role === 'student'
  }) as { data: any };

  const { data: tasks = [] } = useQuery({
    queryKey: ["/api/tasks"],
    enabled: userData?.role === 'student'
  }) as { data: any[] };

  const { data: profile = [] } = useQuery({
    queryKey: [`/api/students/${student?.id}/profile`],
    enabled: !!student?.id,
  }) as { data: any[] };

  const { data: activities = [] } = useQuery({
    queryKey: [`/api/students/${student?.id}/activities`],
    enabled: !!student?.id,
  }) as { data: any[] };

  const { data: counselor } = useQuery({
    queryKey: ["/api/me/counselor"],
    enabled: userData?.role === 'student'
  }) as { data: any };

  const tasksData = tasks;
  const profileData = profile;
  const activitiesCount = Array.isArray(activities) ? activities.length : 0;

  const pendingTasks = Array.isArray(tasksData) ? tasksData.filter((t: any) => t.status === 'pending').length : 0;
  const completedTasks = Array.isArray(tasksData) ? tasksData.filter((t: any) => t.status === 'complete').length : 0;
  const overdueTasks = Array.isArray(tasksData) ? tasksData.filter((t: any) => 
    t.status !== 'complete' && t.dueDate && new Date(t.dueDate) < new Date()
  ).length : 0;

  const totalFields = Array.isArray(profileData) ? profileData.length : 0;
  const completedFields = Array.isArray(profileData) ? profileData.filter((p: any) => p.value && p.value.trim()).length : 0;
  const profileCompletion = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "complete":
        return <Badge className="font-ui bg-[hsl(145,30%,88%)] text-[hsl(145,40%,30%)]">Complete</Badge>;
      case "in_progress":
        return <Badge className="font-ui bg-[hsl(40,60%,88%)] text-[hsl(40,60%,30%)]">In Progress</Badge>;
      default:
        return <Badge className="font-ui bg-[hsl(0,50%,92%)] text-[hsl(0,50%,35%)]">Incomplete</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold text-foreground">Welcome, {userData?.firstName || 'Student'}!</h1>
        <p className="font-ui text-muted-foreground mt-1">Track your progress and manage your academic journey.</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Link href="/student/profile">
          <Card className="cursor-pointer hover:shadow-elevated transition-all duration-200 section-sky">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-ui text-sm font-medium text-muted-foreground">Profile Completion</p>
                  <p className="font-heading text-3xl font-bold text-foreground mt-1">{profileCompletion}%</p>
                </div>
                <div className="w-12 h-12 bg-[hsl(200,45%,80%)] rounded-xl flex items-center justify-center">
                  <User className="text-[hsl(200,55%,35%)] h-6 w-6" />
                </div>
              </div>
              <div className="mt-3">
                <Progress value={profileCompletion} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/student/tasks?status=pending">
          <Card className="cursor-pointer hover:shadow-elevated transition-all duration-200 section-peach">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-ui text-sm font-medium text-muted-foreground">Pending Tasks</p>
                  <p className="font-heading text-3xl font-bold text-foreground mt-1">{pendingTasks}</p>
                </div>
                <div className="w-12 h-12 bg-[hsl(25,50%,82%)] rounded-xl flex items-center justify-center">
                  <Clock className="text-[hsl(25,55%,40%)] h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/student/activities">
          <Card className="cursor-pointer hover:shadow-elevated transition-all duration-200 section-lavender">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-ui text-sm font-medium text-muted-foreground">Activities</p>
                  <p className="font-heading text-3xl font-bold text-foreground mt-1">{activitiesCount}</p>
                </div>
                <div className="w-12 h-12 bg-[hsl(270,30%,82%)] rounded-xl flex items-center justify-center">
                  <University className="text-[hsl(270,35%,45%)] h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/student/tasks?status=complete">
          <Card className="cursor-pointer hover:shadow-elevated transition-all duration-200 section-sage">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-ui text-sm font-medium text-muted-foreground">Completed</p>
                  <p className="font-heading text-3xl font-bold text-foreground mt-1">{completedTasks}</p>
                </div>
                <div className="w-12 h-12 bg-[hsl(145,30%,78%)] rounded-xl flex items-center justify-center">
                  <CheckCircle className="text-[hsl(145,40%,35%)] h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Profile Status */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center justify-between">
            Profile Status
            <Link href="/student/profile">
              <Button variant="outline" size="sm" className="font-ui">View Profile</Button>
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              {getStatusBadge(student?.profileStatus || "incomplete") as React.ReactNode}
              <span className="font-ui text-muted-foreground">
                {completedFields} of {totalFields} fields completed
              </span>
            </div>
            <span className="font-heading text-2xl font-bold text-foreground">{profileCompletion}%</span>
          </div>
          <Progress value={profileCompletion} className="h-3" />
          <p className="font-ui text-sm text-muted-foreground mt-3">
            Complete your profile to help counselors better assist you.
          </p>
        </CardContent>
      </Card>

      {/* Counselor Information and Messages */}
      {counselor && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="counselor-messages-section">
          {/* Counselor Information */}
          <Card className="section-cream" data-testid="counselor-info-card">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-terracotta" />
                Your Counselor
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="w-11 h-11 bg-[#141413] rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="h-5 w-5 text-[hsl(40,33%,97%)]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-ui font-semibold text-foreground" data-testid="counselor-name">
                      {counselor.firstName} {counselor.lastName}
                    </h3>
                    {counselor.specialization && (
                      <p className="font-ui text-sm text-muted-foreground mt-1" data-testid="counselor-specialization">
                        {counselor.specialization}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a 
                      href={`mailto:${counselor.email}`} 
                      className="font-ui text-sm text-terracotta hover:underline"
                      data-testid="counselor-email"
                    >
                      {counselor.email}
                    </a>
                  </div>
                  
                  {counselor.phoneNumber && (
                    <div className="flex items-center space-x-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a 
                        href={`tel:${counselor.phoneNumber}`} 
                        className="font-ui text-sm text-foreground"
                        data-testid="counselor-phone"
                      >
                        {counselor.phoneNumber}
                      </a>
                    </div>
                  )}
                  
                  {counselor.contactEmail && counselor.contactEmail !== counselor.email && (
                    <div className="flex items-center space-x-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a 
                        href={`mailto:${counselor.contactEmail}`} 
                        className="font-ui text-sm text-terracotta hover:underline"
                        data-testid="counselor-contact-email"
                      >
                        {counselor.contactEmail} (Secondary)
                      </a>
                    </div>
                  )}
                </div>
                
                {counselor.bio && (
                  <div className="pt-3 border-t border-border/50">
                    <p className="font-ui text-sm text-muted-foreground" data-testid="counselor-bio">
                      {counselor.bio}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Messages Panel */}
          <MessagesPanel 
            counselorId={counselor.userId}
            counselorName={`${counselor.firstName} ${counselor.lastName}`}
          />
        </div>
      )}

      {/* Recent Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Recent Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.isArray(tasksData) && tasksData.slice(0, 5).map((task: any) => {
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'complete';
              return (
                <div key={task.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      task.status === 'complete' ? 'section-sage' : 
                      isOverdue ? 'bg-[hsl(0,50%,92%)]' : 'section-peach'
                    }`}>
                      {task.status === 'complete' ? (
                        <CheckCircle className="h-5 w-5 text-[hsl(145,40%,35%)]" />
                      ) : isOverdue ? (
                        <AlertTriangle className="h-5 w-5 text-[hsl(0,50%,45%)]" />
                      ) : (
                        <Clock className="h-5 w-5 text-[hsl(25,55%,40%)]" />
                      )}
                    </div>
                    <div>
                      <p className="font-ui font-medium text-foreground">{task.title}</p>
                      <p className="font-ui text-sm text-muted-foreground">{task.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge 
                      className={`font-ui ${
                        task.status === 'complete' ? 'bg-[hsl(145,30%,88%)] text-[hsl(145,40%,30%)]' :
                        isOverdue ? 'bg-[hsl(0,50%,92%)] text-[hsl(0,50%,35%)]' : 'bg-[hsl(40,60%,88%)] text-[hsl(40,60%,30%)]'
                      }`}
                    >
                      {task.status === 'complete' ? 'Complete' :
                       isOverdue ? 'Overdue' : 'Pending'}
                    </Badge>
                    {task.dueDate && (
                      <span className={`font-ui text-sm ${isOverdue ? 'text-[hsl(0,50%,45%)]' : 'text-muted-foreground'}`}>
                        Due: {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            
            {(!Array.isArray(tasksData) || tasksData.length === 0) && (
              <div className="text-center py-8">
                <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground/40" />
                <h3 className="mt-3 font-ui font-medium text-foreground">No tasks assigned</h3>
                <p className="mt-1 font-ui text-sm text-muted-foreground">
                  Tasks from your counselor will appear here.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/student/profile">
          <Card className="hover:shadow-elevated transition-all duration-200 cursor-pointer section-sky">
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 mx-auto bg-[hsl(200,45%,80%)] rounded-2xl flex items-center justify-center mb-4">
                <User className="h-7 w-7 text-[hsl(200,55%,35%)]" />
              </div>
              <h3 className="font-heading font-semibold text-foreground mb-2">Update Profile</h3>
              <p className="font-ui text-sm text-muted-foreground">Complete your academic and personal information</p>
            </CardContent>
          </Card>
        </Link>
        
        <Link href="/student/universities">
          <Card className="hover:shadow-elevated transition-all duration-200 cursor-pointer section-lavender">
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 mx-auto bg-[hsl(270,30%,82%)] rounded-2xl flex items-center justify-center mb-4">
                <University className="h-7 w-7 text-[hsl(270,35%,45%)]" />
              </div>
              <h3 className="font-heading font-semibold text-foreground mb-2">Explore Universities</h3>
              <p className="font-ui text-sm text-muted-foreground">Research and add universities to your list</p>
            </CardContent>
          </Card>
        </Link>
        
        <Link href="/student/planner">
          <Card className="hover:shadow-elevated transition-all duration-200 cursor-pointer section-sage">
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 mx-auto bg-[hsl(145,30%,78%)] rounded-2xl flex items-center justify-center mb-4">
                <Calendar className="h-7 w-7 text-[hsl(145,40%,35%)]" />
              </div>
              <h3 className="font-heading font-semibold text-foreground mb-2">Plan Schedule</h3>
              <p className="font-ui text-sm text-muted-foreground">Manage your tasks and upcoming events</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
