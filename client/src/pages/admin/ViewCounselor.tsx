import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, User, Users, Clock, Mail, BookOpen, Target } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function ViewCounselor() {
  const { id } = useParams();
  const [location] = useLocation();
  const [, setLocation] = useLocation();

  // Extract adminCounselorId from location if useParams doesn't work
  const adminCounselorId = id || location.split('/').pop();

  const { data: counselor, isLoading: counselorLoading } = useQuery<any>({
    queryKey: [`/api/counselors/by-admin-id/${adminCounselorId}`],
    enabled: !!adminCounselorId,
  });

  const { data: students = [] } = useQuery<any[]>({
    queryKey: ["/api/students"],
  });

  if (counselorLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!counselor) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Counselor Not Found</h2>
          <Button onClick={() => setLocation("/admin/counselors")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Counselors
          </Button>
        </div>
      </div>
    );
  }

  // Get students assigned to this counselor
  const assignedStudents = Array.isArray(students) ? students.filter((student: any) => student.counselor?.adminCounselorId === parseInt(adminCounselorId!)) : [];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      complete: { color: "bg-green-100 text-green-800", label: "Complete" },
      in_progress: { color: "bg-yellow-100 text-yellow-800", label: "In Progress" },
      incomplete: { color: "bg-red-100 text-red-800", label: "Incomplete" }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.incomplete;
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => setLocation("/admin/counselors")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Counselors
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Counselor Profile</h1>
            <p className="text-gray-600">
              Counselor ID: COUN-{counselor.adminCounselorId} • Created: {formatDate(counselor.createdAt)}
            </p>
          </div>
        </div>
        <Button onClick={() => setLocation(`/admin/counselors/edit/${adminCounselorId}`)}>
          <Edit className="w-4 h-4 mr-2" />
          Edit Profile
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <p className="text-gray-900">
                {counselor.user?.firstName ? 
                  `${counselor.user.firstName} ${counselor.user.lastName || ""}`.trim() : 
                  "No name provided"
                }
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <p className="text-gray-900">{counselor.user?.email || "No email provided"}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-gray-400" />
                <p className="text-gray-900">{counselor.specialization || "No specialization specified"}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Member Since</label>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <p className="text-gray-900">{formatDate(counselor.createdAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  {assignedStudents.length}
                </p>
                <p className="text-sm text-blue-800">Assigned Students</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">
                  {assignedStudents.filter((s: any) => s.profileStatus === "complete").length}
                </p>
                <p className="text-sm text-green-800">Complete Profiles</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Activity Overview</h4>
              <p className="text-sm text-gray-600">
                Last updated: {counselor.user?.updatedAt ? formatDate(counselor.user.updatedAt) : "Never"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Bio */}
        {counselor.bio && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Bio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-gray-50 rounded-md">
                <p className="text-gray-900 whitespace-pre-wrap">{counselor.bio}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Assigned Students */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Assigned Students ({assignedStudents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assignedStudents.length === 0 ? (
              <p className="text-gray-500 italic text-center py-8">No students assigned to this counselor</p>
            ) : (
              <div className="space-y-3">
                {assignedStudents.map((student: any) => (
                  <div key={student.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {student.user?.firstName?.[0] || "S"}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {student.user?.firstName ? 
                              `${student.user.firstName} ${student.user.lastName || ""}`.trim() : 
                              student.user?.email || `Student ${student.id}`
                            }
                          </p>
                          <p className="text-sm text-gray-600">{student.user?.email}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {getStatusBadge(student.profileStatus)}
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(student.createdAt)}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLocation(`/admin/students/view/${student.adminStudentId}`)}
                        >
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLocation(`/admin/students/edit/${student.adminStudentId}`)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}