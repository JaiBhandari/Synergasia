import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Archive, RotateCcw, Users, Filter } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import RestoreDialog from "@/components/RestoreDialog";
import type { Counselor, Student, User } from "@shared/schema";

type ArchivedStudentRow = Student & {
  user?: User;
  deletedByUser?: { firstName?: string; lastName?: string; role?: string } | null;
};

type CounselorWithUser = Counselor & { user?: User };

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

export default function ArchivedStudents() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCounselor, setSelectedCounselor] = useState("");
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [studentToRestore, setStudentToRestore] = useState<ArchivedStudentRow | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: allArchivedStudents,
    isLoading,
    isError: studentsError,
    error: studentsErrorData,
    refetch: refetchStudents
  } = useQuery({ queryKey: ["/api/students/archived"] });

  const {
    data: counselors = [],
    isError: counselorsError,
    error: counselorsErrorData,
    refetch: refetchCounselors
  } = useQuery({
    queryKey: ["/api/counselors"],
    queryFn: async () => {
      const response = await fetch("/api/counselors", { credentials: "include" });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
  }) as {
    data: CounselorWithUser[];
    isError: boolean;
    error: Error | null;
    refetch: () => void;
  };

  const archivedStudents = useMemo(() => {
    if (!allArchivedStudents || !Array.isArray(allArchivedStudents)) return [];
    return (allArchivedStudents as ArchivedStudentRow[]).filter((student) => {
      const matchesSearch = !searchTerm ||
        student.user?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.user?.lastName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCounselor = !selectedCounselor || selectedCounselor === "all" ||
        student.counselorId?.toString() === selectedCounselor;
      return matchesSearch && matchesCounselor;
    });
  }, [allArchivedStudents, searchTerm, selectedCounselor]);

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

  const handleRestoreStudent = (student: ArchivedStudentRow) => {
    setStudentToRestore(student);
    setRestoreDialogOpen(true);
  };

  const confirmRestoreStudent = (email: string) => {
    if (studentToRestore) {
      restoreStudentMutation.mutate({ adminStudentId: studentToRestore.adminStudentId, email });
    }
  };

  if (studentsError || counselorsError) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <h3 className="text-lg font-medium">Error Loading Data</h3>
            <p className="text-sm mt-2">
              {studentsError && (studentsErrorData as any)?.message}
              {counselorsError && (counselorsErrorData as any)?.message}
            </p>
          </div>
          <div className="space-x-2">
            {studentsError && (
              <Button onClick={() => refetchStudents()} variant="outline" data-testid="button-retry-students">
                Retry Students
              </Button>
            )}
            {counselorsError && (
              <Button onClick={() => refetchCounselors()} variant="outline" data-testid="button-retry-counselors">
                Retry Counselors
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Archive className="h-8 w-8 text-gray-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Archived Students</h1>
            <p className="text-gray-600">View and restore deleted student accounts</p>
          </div>
        </div>
        <Badge variant="outline" className="text-gray-600">
          <Users className="h-4 w-4 mr-1" />
          {archivedStudents?.length || 0} archived
        </Badge>
      </div>

      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search archived students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
          {archivedStudents?.length === 0 ? (
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
                          <DeletedByCell deletedByUser={student.deletedByUser} />
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

      <RestoreDialog
        open={restoreDialogOpen}
        onOpenChange={(open) => {
          setRestoreDialogOpen(open);
          if (!open) setStudentToRestore(null);
        }}
        onConfirm={confirmRestoreStudent}
        isLoading={restoreStudentMutation.isPending}
        title="Restore Student"
        description="To restore this student, please confirm their original email address. This will reactivate their account with all previous data."
        itemName={studentToRestore ? `${studentToRestore.user?.firstName} ${studentToRestore.user?.lastName}` : ""}
        itemType="student"
      />
    </div>
  );
}
