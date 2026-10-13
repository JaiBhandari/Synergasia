import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, User, GraduationCap, Activity, Target, Clock, Mail, Phone, BookOpen, Edit, Key, Building2, Globe } from "lucide-react";
import ActivityLocker from "@/components/ActivityLocker";
import { formatDate } from "@/lib/utils";

interface Student {
  id: number;
  adminStudentId: number;
  profileStatus: string;
  lastActivity?: string;
  createdAt?: string;
  user?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  counselor?: {
    user?: {
      firstName?: string;
      lastName?: string;
      email?: string;
    };
  };
}

interface ProfileField {
  id: number;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  category: string;
  isRequired: boolean;
  isEditable: boolean;
  options?: any;
  description?: string;
}

interface CounselorViewStudentProps {
  studentId?: string;
}

export default function CounselorViewStudent({ studentId }: CounselorViewStudentProps) {
  const id = studentId;
  const [location, setLocation] = useLocation();

  const { data: student, isLoading: studentLoading, error } = useQuery<Student>({
    queryKey: ["/api/students", id],
    enabled: !!id,
    queryFn: async () => {
      const response = await fetch(`/api/students/${id}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
  });

  const { data: profileFields = [] } = useQuery<ProfileField[]>({
    queryKey: ["/api/profile-fields"],
  });

  const { data: studentProfile = [] } = useQuery({
    queryKey: ["/api/students", id, "profile"],
    enabled: !!id,
    queryFn: async () => {
      const response = await fetch(`/api/students/${id}/profile`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.statusText}`);
      }
      return response.json();
    },
  });

  const { data: universities = [], isLoading: universitiesLoading } = useQuery<any[]>({
    queryKey: [`/api/students/${id}/universities`],
    enabled: !!id,
  });


  if (studentLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Student</h2>
          <p className="text-gray-600 mb-4">{error.toString()}</p>
          <Button onClick={() => setLocation("/counselor/students")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Students
          </Button>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Student Not Found</h2>
          <Button onClick={() => setLocation("/counselor/students")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Students
          </Button>
        </div>
      </div>
    );
  }

  const getProfileFieldValue = (fieldId: number) => {
    if (!Array.isArray(studentProfile)) return "";
    const profileEntry = studentProfile.find((p: any) => p.fieldId === fieldId);
    return profileEntry?.value || "";
  };

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

  const profileFieldsByCategory = profileFields.reduce((acc: Record<string, ProfileField[]>, field: ProfileField) => {
    // Handle category properly - it might be an object with a value property
    const category = (field.category && typeof field.category === 'object' && (field.category as any).value) 
      ? (field.category as any).value 
      : field.category || "other";
    
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(field);
    return acc;
  }, {} as Record<string, ProfileField[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation("/counselor/students")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Students
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {student.user?.firstName} {student.user?.lastName}
            </h1>
            <p className="text-gray-600">Student ID: STU-{student.adminStudentId} • {student.user?.email}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setLocation(`/counselor/students/edit/${student.adminStudentId}`)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
          {getStatusBadge(student.profileStatus)}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="universities">Universities</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="w-5 h-5 mr-2" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">Full Name</label>
                  <p className="text-gray-900">{student.user?.firstName} {student.user?.lastName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-gray-900">{student.user?.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Student ID</label>
                  <p className="text-gray-900">STU-{student.adminStudentId}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Profile Status</label>
                  <div className="mt-1">{getStatusBadge(student.profileStatus)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Last Activity</label>
                  <p className="text-gray-900">
                    {student.lastActivity 
                      ? formatDate(student.lastActivity) 
                      : "No recent activity"
                    }
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Joined</label>
                  <p className="text-gray-900">
                    {student.createdAt ? formatDate(student.createdAt) : "Unknown"}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">Password</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Key className="w-4 h-4 text-gray-400" />
                    <p className="text-gray-600 text-sm">Password is securely stored (hashed)</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Contact an administrator to reset the student's password if needed
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dynamic Profile Fields by Category */}
          {Object.entries(profileFieldsByCategory).map(([category, fields]: [string, ProfileField[]]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  {category === 'academics' && <GraduationCap className="w-5 h-5 mr-2" />}
                  {category === 'extracurricular' && <Activity className="w-5 h-5 mr-2" />}
                  {category === 'supercurricular' && <Target className="w-5 h-5 mr-2" />}
                  {category === 'main_profile' && <User className="w-5 h-5 mr-2" />}
                  {category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {fields.map((field: ProfileField) => {
                    const value = getProfileFieldValue(field.id);
                    return (
                      <div key={field.id}>
                        <label className="text-sm font-medium text-gray-500">
                          {field.fieldLabel}
                          {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <p className="text-gray-900 mt-1">
                          {value || <span className="text-gray-400 italic">Not provided</span>}
                        </p>
                        {field.description && (
                          <p className="text-xs text-gray-500 mt-1">{field.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Activities Tab */}
        <TabsContent value="activities">
          <ActivityLocker 
            studentId={student.id} 
            isReadOnly={true} 
            userRole="counselor" 
          />
        </TabsContent>

        {/* Universities Tab */}
        <TabsContent value="universities" className="space-y-6">
          {universitiesLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p>Loading universities...</p>
            </div>
          ) : universities.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Building2 className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No Universities Assigned</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    This student hasn't been assigned any universities yet.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Universities grouped by category */}
              {['reach', 'target', 'safety'].map((category) => {
                const categoryUniversities = universities.filter(
                  (uni: any) => uni.category === category
                );
                
                if (categoryUniversities.length === 0) return null;

                return (
                  <Card key={category}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 capitalize">
                        {category === 'reach' && <Target className="w-5 h-5 text-orange-500" />}
                        {category === 'target' && <Target className="w-5 h-5 text-blue-500" />}
                        {category === 'safety' && <Target className="w-5 h-5 text-green-500" />}
                        <span>{category} Universities</span>
                        <Badge 
                          variant="secondary" 
                          className={`ml-2 ${
                            category === 'reach' ? 'bg-orange-100 text-orange-800' :
                            category === 'target' ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                          }`}
                        >
                          {categoryUniversities.length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {categoryUniversities.map((uni: any) => (
                          <div 
                            key={uni.id} 
                            className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                            data-testid={`university-card-${uni.id}`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between">
                                <h4 className="font-semibold text-gray-900 flex-1" data-testid={`text-university-name-${uni.id}`}>
                                  {uni.university?.name || uni.name || "Unknown University"}
                                </h4>
                              </div>
                              
                              {uni.university?.location && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <GraduationCap className="w-4 h-4" />
                                  <span data-testid={`text-location-${uni.id}`}>{uni.university.location}</span>
                                </div>
                              )}

                              {uni.university?.website && (
                                <div className="flex items-center gap-2 text-sm text-blue-600">
                                  <Globe className="w-4 h-4" />
                                  <a 
                                    href={uni.university.website} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="hover:underline"
                                    data-testid={`link-website-${uni.id}`}
                                  >
                                    Visit Website
                                  </a>
                                </div>
                              )}

                              {uni.university?.overallRanking && (
                                <div className="text-sm text-gray-600">
                                  <span className="font-medium">Ranking:</span> #{uni.university.overallRanking}
                                </div>
                              )}

                              {uni.university?.admissionRate && (
                                <div className="text-sm text-gray-600">
                                  <span className="font-medium">Admission Rate:</span> {uni.university.admissionRate}
                                </div>
                              )}

                              {uni.addedAt && (
                                <div className="text-xs text-gray-500 pt-2 border-t">
                                  Added: {formatDate(uni.addedAt)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}