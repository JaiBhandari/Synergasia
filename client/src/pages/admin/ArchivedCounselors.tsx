import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Archive, RotateCcw, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import RestoreDialog from "@/components/RestoreDialog";
import type { Counselor, User } from "@shared/schema";

type ArchivedCounselorRow = Counselor & {
  user?: User;
  deletedByUser?: { firstName?: string; lastName?: string; role?: string } | null;
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

export default function ArchivedCounselors() {
  const [searchTerm, setSearchTerm] = useState("");
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [counselorToRestore, setCounselorToRestore] = useState<ArchivedCounselorRow | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: allArchivedCounselors,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({ queryKey: ["/api/counselors/archived"] });

  const archivedCounselors = useMemo(() => {
    if (!allArchivedCounselors || !Array.isArray(allArchivedCounselors)) return [];
    return (allArchivedCounselors as ArchivedCounselorRow[]).filter((counselor) => {
      return !searchTerm ||
        counselor.user?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        counselor.user?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        counselor.specialization?.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [allArchivedCounselors, searchTerm]);

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

  const handleRestoreCounselor = (counselor: ArchivedCounselorRow) => {
    setCounselorToRestore(counselor);
    setRestoreDialogOpen(true);
  };

  const confirmRestoreCounselor = (email: string) => {
    if (counselorToRestore) {
      restoreCounselorMutation.mutate({ adminCounselorId: counselorToRestore.adminCounselorId, email });
    }
  };

  if (isError) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <h3 className="text-lg font-medium">Error Loading Data</h3>
            <p className="text-sm mt-2">{(error as any)?.message || "Failed to load archived counselors"}</p>
          </div>
          <Button onClick={() => refetch()} variant="outline" data-testid="button-retry-counselors">Retry</Button>
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
            <h1 className="text-3xl font-bold text-gray-900">Archived Counselors</h1>
            <p className="text-gray-600">View and restore deleted counselor accounts</p>
          </div>
        </div>
        <Badge variant="outline" className="text-gray-600">
          <Users className="h-4 w-4 mr-1" />
          {archivedCounselors?.length || 0} archived
        </Badge>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search archived counselors..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 w-80"
          data-testid="input-search-archived-counselors"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {archivedCounselors?.length === 0 ? (
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
                        <DeletedByCell deletedByUser={counselor.deletedByUser} />
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

      <RestoreDialog
        open={restoreDialogOpen}
        onOpenChange={(open) => {
          setRestoreDialogOpen(open);
          if (!open) setCounselorToRestore(null);
        }}
        onConfirm={confirmRestoreCounselor}
        isLoading={restoreCounselorMutation.isPending}
        title="Restore Counselor"
        description="To restore this counselor, please confirm their original email address. This will reactivate their account with all previous data."
        itemName={counselorToRestore ? `${counselorToRestore.user?.firstName} ${counselorToRestore.user?.lastName}` : ""}
        itemType="counselor"
      />
    </div>
  );
}
