import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, User, GraduationCap, Activity, Target, Clock, Mail, Phone, BookOpen, Key, Building2, Globe } from "lucide-react";
import { formatDate } from "@/lib/utils";
import ActivityLocker from "@/components/ActivityLocker";

export default function ViewStudent() {
  const { id } = useParams();
  const [location, setLocation] = useLocation();
  
  // Extract adminStudentId from location if useParams doesn't work
  const adminStudentId = id || location.split('/').pop();

  const { data: student, isLoading: studentLoading } = useQuery<any>({
    queryKey: [`/api/students/by-admin-id/${adminStudentId}`],
    enabled: !!adminStudentId,
  });

  const { data: profileFields = [] } = useQuery({
    queryKey: ["/api/profile-fields"],
  });

  const { data: studentProfile = [] } = useQuery<any[]>({
    queryKey: [`/api/students/by-admin-id/${adminStudentId}/profile`],
    enabled: !!adminStudentId,
  });

  const { data: universities = [], isLoading: universitiesLoading } = useQuery<any[]>({
    queryKey: [`/api/students/by-admin-id/${adminStudentId}/universities`],
    enabled: !!adminStudentId,
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

  if (!student) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Student Not Found</h2>
          <Button onClick={() => setLocation("/admin/students")}>
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

  const renderFieldValue = (field: any) => {
    const value = getProfileFieldValue(field.id);
    
    if (!value) {
      return <span className="text-gray-400 italic">Not provided</span>;
    }

    // Handle objects properly
    if (typeof value === "object" && value !== null) {
      // Try to extract meaningful data from objects
      if (value.hasOwnProperty('label')) {
        return <span className="text-gray-900">{value.label}</span>;
      } else if (value.hasOwnProperty('value')) {
        return <span className="text-gray-900">{value.value}</span>;
      } else if (value.hasOwnProperty('name')) {
        return <span className="text-gray-900">{value.name}</span>;
      } else if (Array.isArray(value)) {
        return <span className="text-gray-900">{value.join(', ')}</span>;
      } else {
        // If it's an object we can't parse, try JSON.stringify as fallback
        try {
          const jsonString = JSON.stringify(value);
          return <span className="text-gray-600 font-mono text-sm">{jsonString}</span>;
        } catch (e) {
          return <span className="text-gray-400 italic">Invalid value format</span>;
        }
      }
    }

    // Handle different field types for non-object values
    switch (field.fieldType) {
      case "select":
        return <span className="text-gray-900">{String(value)}</span>;
        
      case "textarea":
        return (
          <div className="text-gray-900 whitespace-pre-wrap">
            {String(value)}
          </div>
        );
        
      default:
        // For text, email, number, date, etc.
        return <span className="text-gray-900">{String(value)}</span>;
    }
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

  const profileFieldsByCategory = Array.isArray(profileFields) ? profileFields.reduce((acc: any, field: any) => {
    // Handle category properly - it might be an object with a value property
    let category = field.category;
    if (category && typeof category === 'object' && category.value) {
      category = category.value;
    } else if (!category || typeof category === 'object') {
      category = "other";
    }
    
    if (!acc[category]) acc[category] = [];
    acc[category].push(field);
    return acc;
  }, {}) : {};

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => setLocation("/admin/students")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Students
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Student Profile</h1>
            <p className="text-gray-600">
              Student ID: STU-{student.adminStudentId} • Created: {formatDate(student.createdAt)}
            </p>
          </div>
        </div>
        <Button onClick={() => setLocation(`/admin/students/edit/${student.adminStudentId}`)}>
          <Edit className="w-4 h-4 mr-2" />
          Edit Profile
        </Button>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Profile Information</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="universities">Universities</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Student ID</label>
              <p className="text-gray-900 font-mono">STU-{student.adminStudentId}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <p className="text-gray-900">
                {student.user?.firstName ? 
                  `${student.user.firstName} ${student.user.lastName || ""}`.trim() : 
                  "No name provided"
                }
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <p className="text-gray-900">{student.user?.email || "No email provided"}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Counselor</label>
              <p className="text-gray-900">
                {student.counselor ? (() => {
                  const fullName = `${student.counselor.user?.firstName || ""} ${student.counselor.user?.lastName || ""}`.trim();
                  return fullName || student.counselor.user?.email || "Unknown counselor";
                })() : "No counselor assigned"}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Profile Status</label>
              {getStatusBadge(student.profileStatus)}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Member Since</label>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <p className="text-gray-900">{formatDate(student.createdAt)}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-gray-400" />
                <p className="text-gray-600 text-sm">Password is securely stored (hashed)</p>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                You can change the student's password in the Edit Profile section
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Profile Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Profile Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  {Object.keys(profileFieldsByCategory).length}
                </p>
                <p className="text-sm text-blue-800">Categories</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">
                  {Array.isArray(studentProfile) ? studentProfile.length : 0}
                </p>
                <p className="text-sm text-green-800">Fields Completed</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Recent Activity</h4>
              <p className="text-sm text-gray-600">
                Last updated: {student.profileLastUpdated ? formatDate(student.profileLastUpdated) : "Never"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Profile Fields by Category */}
        {Object.entries(profileFieldsByCategory).map(([category, fields]) => (
          <Card key={category} className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 capitalize">
                {category === "main_profile" && <User className="w-5 h-5" />}
                {category === "academics" && <GraduationCap className="w-5 h-5" />}
                {category === "supercurricular" && <Activity className="w-5 h-5" />}
                {category === "extracurricular" && <Target className="w-5 h-5" />}
                {category.replace("_", " ")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(fields as any[]).map((field: any) => (
                  <div key={field.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.fieldName}
                    </label>
                    <div className="p-3 bg-gray-50 rounded-md">
                      {renderFieldValue(field)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
          </div>
        </TabsContent>

        <TabsContent value="activities" className="space-y-6">
          <ActivityLocker 
            studentId={student.id} 
            isReadOnly={true} 
            userRole="admin" 
          />
        </TabsContent>

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