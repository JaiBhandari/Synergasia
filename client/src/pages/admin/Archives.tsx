import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Archive, RotateCcw, Users, Filter, Layers } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import RestoreDialog from "@/components/RestoreDialog";
import type { Counselor, Student, User } from "@shared/schema";

type ArchivedStudentRow = Student & { user?: User; deletedByUser?: { firstName?: string; lastName?: string; role?: string } | null };
type ArchivedCounselorRow = Counselor & { user?: User; deletedByUser?: { firstName?: string; lastName?: string; role?: string } | null };
type CounselorWithUser = Counselor & { user?: User };
type ArchivedField = { id: number; fieldName: string; fieldLabel: string; fieldType: string; isRequired: boolean; deletedAt?: string };
type ArchivedCategory = {
  id: number; name: string; value: string; deletedAt?: string;
  deletedByUser?: { firstName?: string; lastName?: string; role?: string } | null;
  fields: ArchivedField[];
};

function DeletedByCell({ deletedByUser }: { deletedByUser?: { firstName?: string; lastName?: string; role?: string } | null }) {
  if (!deletedByUser) {
    return <span className="text-gray-400 italic text-sm">Unknown</span>;
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-gray-700">
        {deletedByUser.firstName} {deletedByUser.lastName}
      </span>
      {deletedByUser.role && (
        <Badge variant="outline" className="w-fit text-xs capitalize text-gray-500 border-gray-300">
          {deletedByUser.role}
        </Badge>
      )}
    </div>
  );
}

export default function Archives() {
  const [activeTab, setActiveTab] = useState("students");
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [counselorSearchTerm, setCounselorSearchTerm] = useState("");
  const [selectedCounselor, setSelectedCounselor] = useState("");
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [studentToRestore, setStudentToRestore] = useState<ArchivedStudentRow | null>(null);
  const [counselorToRestore, setCounselorToRestore] = useState<ArchivedCounselorRow | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: allArchivedStudents, isLoading: studentsLoading } = useQuery({ queryKey: ["/api/students/archived"] });
  const { data: allArchivedCounselors, isLoading: counselorsLoading } = useQuery({ queryKey: ["/api/counselors/archived"] });
  const { data: archivedProfileFields = [], isLoading: fieldsLoading } = useQuery({ queryKey: ["/api/profile-field-categories/archived"] });

  const { data: counselors = [] } = useQuery({
    queryKey: ["/api/counselors"],
    queryFn: async () => {
      const response = await fetch("/api/counselors", { credentials: "include" });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
  }) as { data: CounselorWithUser[] };

  const archivedStudents = useMemo(() => {
    if (!allArchivedStudents || !Array.isArray(allArchivedStudents)) return [];
    return (allArchivedStudents as ArchivedStudentRow[]).filter((student) => {
      const matchesSearch = !studentSearchTerm ||
        student.user?.firstName?.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
        student.user?.lastName?.toLowerCase().includes(studentSearchTerm.toLowerCase());
      const matchesCounselor = !selectedCounselor || selectedCounselor === "all" ||
        student.counselorId?.toString() === selectedCounselor;
      return matchesSearch && matchesCounselor;
    });
  }, [allArchivedStudents, studentSearchTerm, selectedCounselor]);

  const archivedCounselors = useMemo(() => {
    if (!allArchivedCounselors || !Array.isArray(allArchivedCounselors)) return [];
    return (allArchivedCounselors as ArchivedCounselorRow[]).filter((counselor) => {
      return !counselorSearchTerm ||
        counselor.user?.firstName?.toLowerCase().includes(counselorSearchTerm.toLowerCase()) ||
        counselor.user?.lastName?.toLowerCase().includes(counselorSearchTerm.toLowerCase()) ||
        counselor.specialization?.toLowerCase().includes(counselorSearchTerm.toLowerCase());
    });
  }, [allArchivedCounselors, counselorSearchTerm]);

  const restoreStudentMutation = useMutation({
    mutationFn: async ({ adminStudentId, email }: { adminStudentId: number; email: string }) => {
      await apiRequest(`/api/students/admin/${adminStudentId}/restore`, "PUT", { email });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students/archived"] });
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      setRestoreDialogOpen(false);
      setStudentToRestore(null);
      toast({ title: "Success", description: "Student restored successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to restore student", variant: "destructive" });
    },
  });

  const restoreCounselorMutation = useMutation({
    mutationFn: async ({ adminCounselorId, email }: { adminCounselorId: number; email: string }) => {
      await apiRequest(`/api/counselors/admin/${adminCounselorId}/restore`, "PUT", { email });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/counselors/archived"] });
      queryClient.invalidateQueries({ queryKey: ["/api/counselors"] });
      setRestoreDialogOpen(false);
      setCounselorToRestore(null);
      toast({ title: "Success", description: "Counselor restored successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to restore counselor", variant: "destructive" });
    },
  });

  const handleRestoreStudent = (student: ArchivedStudentRow) => {
    setStudentToRestore(student);
    setCounselorToRestore(null);
    setRestoreDialogOpen(true);
  };

  const handleRestoreCounselor = (counselor: ArchivedCounselorRow) => {
    setCounselorToRestore(counselor);
    setStudentToRestore(null);
    setRestoreDialogOpen(true);
  };

  const confirmRestore = (email: string) => {
    if (studentToRestore) {
      restoreStudentMutation.mutate({ adminStudentId: studentToRestore.adminStudentId, email });
    } else if (counselorToRestore) {
      restoreCounselorMutation.mutate({ adminCounselorId: counselorToRestore.adminCounselorId, email });
    }
  };

  const totalArchived = (archivedStudents?.length || 0) + (archivedCounselors?.length || 0) + ((archivedProfileFields as ArchivedCategory[])?.length || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Archive className="h-8 w-8 text-gray-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Archives</h1>
            <p className="text-gray-600">Audit trail for all archived records</p>
          </div>
        </div>
        <Badge variant="outline" className="text-gray-600">
          <Users className="h-4 w-4 mr-1" />
          {totalArchived} total archived
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="students" data-testid="tab-archived-students">
            Students ({archivedStudents?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="counselors" data-testid="tab-archived-counselors">
            Counselors ({archivedCounselors?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="profile-fields" data-testid="tab-archived-profile-fields">
            Profile Fields ({(archivedProfileFields as ArchivedCategory[])?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Students Tab */}
        <TabsContent value="students" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search archived students..."
                value={studentSearchTerm}
                onChange={(e) => setStudentSearchTerm(e.target.value)}
                className="pl-10 w-80"
                data-testid="input-search-archived-students"
              />
            </div>
            <div className="flex items-center space-x-3">
              <Select value={selectedCounselor} onValueChange={setSelectedCounselor}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Counselors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Counselors</SelectItem>
                  {counselors.map((counselor) => (
                    <SelectItem key={counselor.id} value={counselor.id.toString()}>
                      {counselor.user?.firstName} {counselor.user?.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {studentsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                </div>
              ) : archivedStudents?.length === 0 ? (
                <div className="text-center py-12">
                  <Archive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Archived Students</h3>
                  <p className="text-gray-500">There are no archived students to display.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-4 px-6 font-semibold text-gray-900">Student</th>
                        <th className="text-left py-4 px-6 font-semibold text-gray-900">Counselor</th>
                        <th className="text-left py-4 px-6 font-semibold text-gray-900">Archived On</th>
                        <th className="text-left py-4 px-6 font-semibold text-gray-900">Archived By</th>
                        <th className="text-left py-4 px-6 font-semibold text-gray-900">Last Activity</th>
                        <th className="text-right py-4 px-6 font-semibold text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {archivedStudents?.map((student) => {
                        const counselor = counselors.find((c) => c.id === student.counselorId);
                        return (
                          <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                            <td className="py-4 px-6">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gradient-to-r from-gray-400 to-gray-600 rounded-full flex items-center justify-center">
                                  <span className="text-white font-medium text-sm">
                                    {student.user?.firstName?.[0]}{student.user?.lastName?.[0]}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium text-gray-700">
                                    {student.user?.firstName} {student.user?.lastName}
                                  </p>
                                  <p className="text-sm text-gray-400 italic">Email removed</p>
                                  <p className="text-xs text-gray-400">ID: STU-{student.adminStudentId}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              {counselor ? (
                                <span className="text-gray-600">{counselor.user?.firstName} {counselor.user?.lastName}</span>
                              ) : (
                                <span className="text-gray-400 italic">No counselor assigned</span>
                              )}
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm text-red-600">
                                {student.user?.deletedAt ? formatDate(student.user.deletedAt) : "Unknown"}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <DeletedByCell deletedByUser={(student as any).deletedByUser} />
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm text-gray-500">
                                {student.lastActivity ? formatDate(student.lastActivity) : "No activity"}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <Button
                                variant="outline" size="sm"
                                onClick={() => handleRestoreStudent(student)}
                                className="text-green-600 hover:text-green-700 border-green-200 hover:border-green-300"
                                data-testid={`button-restore-student-${student.adminStudentId}`}
                              >
                                <RotateCcw className="h-4 w-4 mr-1" />
                                Restore
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Counselors Tab */}
        <TabsContent value="counselors" className="space-y-4 mt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search archived counselors..."
              value={counselorSearchTerm}
              onChange={(e) => setCounselorSearchTerm(e.target.value)}
              className="pl-10 w-80"
              data-testid="input-search-archived-counselors"
            />
          </div>

          <Card>
            <CardContent className="p-0">
              {counselorsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                </div>
              ) : archivedCounselors?.length === 0 ? (
                <div className="text-center py-12">
                  <Archive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Archived Counselors</h3>
                  <p className="text-gray-500">There are no archived counselors to display.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-4 px-6 font-semibold text-gray-900">Counselor</th>
                        <th className="text-left py-4 px-6 font-semibold text-gray-900">Specialization</th>
                        <th className="text-left py-4 px-6 font-semibold text-gray-900">Archived On</th>
                        <th className="text-left py-4 px-6 font-semibold text-gray-900">Archived By</th>
                        <th className="text-left py-4 px-6 font-semibold text-gray-900">Join Date</th>
                        <th className="text-right py-4 px-6 font-semibold text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {archivedCounselors?.map((counselor) => (
                        <tr key={counselor.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gradient-to-r from-gray-400 to-gray-600 rounded-full flex items-center justify-center">
                                <span className="text-white font-medium text-sm">
                                  {counselor.user?.firstName?.[0]}{counselor.user?.lastName?.[0]}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-700">
                                  {counselor.user?.firstName} {counselor.user?.lastName}
                                </p>
                                <p className="text-sm text-gray-400 italic">Email removed</p>
                                <p className="text-xs text-gray-400">ID: COUN-{counselor.adminCounselorId}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-gray-600">{counselor.specialization || "Not specified"}</span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-sm text-red-600">
                              {counselor.user?.deletedAt ? formatDate(counselor.user.deletedAt) : "Unknown"}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <DeletedByCell deletedByUser={(counselor as any).deletedByUser} />
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-sm text-gray-500">{formatDate(counselor.createdAt)}</span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <Button
                              variant="outline" size="sm"
                              onClick={() => handleRestoreCounselor(counselor)}
                              className="text-green-600 hover:text-green-700 border-green-200 hover:border-green-300"
                              data-testid={`button-restore-counselor-${counselor.adminCounselorId}`}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Restore
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile Fields Tab */}
        <TabsContent value="profile-fields" className="space-y-4 mt-6">
          {fieldsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
          ) : (archivedProfileFields as ArchivedCategory[])?.length === 0 ? (
            <div className="text-center py-12">
              <Layers className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Archived Profile Fields</h3>
              <p className="text-gray-500">Profile field categories that have been archived will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(archivedProfileFields as ArchivedCategory[]).map((category) => (
                <Card key={category.id} className="border border-gray-200">
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 rounded-t-xl">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-gray-500" />
                          <h3 className="font-semibold text-gray-900">{category.name}</h3>
                          <Badge variant="outline" className="text-xs text-gray-500">
                            {category.fields?.length || 0} field{category.fields?.length !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">Value: {category.value}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-red-600">
                          Archived: {category.deletedAt ? formatDate(category.deletedAt) : "Unknown"}
                        </p>
                        <div className="mt-1 flex justify-end">
                          <DeletedByCell deletedByUser={category.deletedByUser} />
                        </div>
                      </div>
                    </div>
                  </div>
                  {category.fields && category.fields.length > 0 ? (
                    <CardContent className="p-0">
                      <table className="w-full">
                        <thead className="border-b border-gray-100">
                          <tr>
                            <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">Field Label</th>
                            <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">Field Name</th>
                            <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                            <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">Required</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {category.fields.map((field) => (
                            <tr key={field.id} className="hover:bg-gray-50">
                              <td className="py-3 px-6 text-sm text-gray-700">{field.fieldLabel}</td>
                              <td className="py-3 px-6 text-sm text-gray-500 font-mono">{field.fieldName}</td>
                              <td className="py-3 px-6">
                                <Badge variant="outline" className="text-xs capitalize">{field.fieldType}</Badge>
                              </td>
                              <td className="py-3 px-6">
                                {field.isRequired ? (
                                  <Badge className="text-xs bg-red-100 text-red-700 border-red-200">Required</Badge>
                                ) : (
                                  <span className="text-xs text-gray-400">Optional</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  ) : (
                    <CardContent className="py-4 px-6">
                      <p className="text-sm text-gray-400 italic">No fields were in this category</p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <RestoreDialog
        open={restoreDialogOpen}
        onOpenChange={(open) => {
          setRestoreDialogOpen(open);
          if (!open) { setStudentToRestore(null); setCounselorToRestore(null); }
        }}
        onConfirm={confirmRestore}
        isLoading={restoreStudentMutation.isPending || restoreCounselorMutation.isPending}
        title={studentToRestore ? "Restore Student" : "Restore Counselor"}
        description={`To restore this ${studentToRestore ? "student" : "counselor"}, please confirm their original email address. This will reactivate their account with all previous data.`}
        itemName={
          studentToRestore
            ? `${studentToRestore.user?.firstName} ${studentToRestore.user?.lastName}`
            : counselorToRestore
            ? `${counselorToRestore.user?.firstName} ${counselorToRestore.user?.lastName}`
            : ""
        }
        itemType={studentToRestore ? "student" : "counselor"}
      />
    </div>
  );
}
