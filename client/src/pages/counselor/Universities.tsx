import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import UniversityCard from "@/components/university/UniversityCard";
import UniversityFilters from "@/components/university/UniversityFilters";
import AddUniversityDialog from "@/components/university/AddUniversityDialog";
import AssignUniversityDialog from "@/components/university/AssignUniversityDialog";
import type { University } from "@shared/schema";

export default function UniversitiesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);
  const [assignUniversity, setAssignUniversity] = useState<University | null>(null);
  const [location, setLocation] = useLocation();
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: universities, isLoading } = useQuery<University[]>({
    queryKey: ["/api/universities"],
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // Filter and search logic
  const filteredUniversities = useMemo(() => {
    if (!universities) return [];

    return universities.filter((uni: University) => {
      const matchesSearch = uni.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (uni.location && uni.location.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return matchesSearch;
    });
  }, [universities, searchTerm]);

  const deleteUniversityMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/universities/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/universities"] });
      toast({
        title: "Success",
        description: "University deleted successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) return;
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Event handlers
  const handleAddUniversity = () => {
    setIsAddModalOpen(true);
  };

  const handleEditUniversity = (university: University) => {
    setLocation(`/counselor/universities/${university.id}`);
  };

  const handleDeleteUniversity = (universityId: number) => {
    if (confirm("Are you sure you want to delete this university? This action cannot be undone.")) {
      deleteUniversityMutation.mutate(universityId);
    }
  };

  const handleViewDetails = (university: University) => {
    setSelectedUniversity(university);
  };

  const handleAssignToStudent = (university: University) => {
    setAssignUniversity(university);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading universities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-10 bg-background pb-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Universities</h1>
          <p className="text-gray-600">Manage university information and data.</p>
        </div>

        {/* Filters and Controls */}
        <UniversityFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onAddUniversity={handleAddUniversity}
          role="counselor"
          totalCount={filteredUniversities.length}
        />
      </div>

      {/* Scrollable Universities Grid/List */}
      <ScrollArea className="flex-1">
        <div className={`${
          viewMode === "grid" 
            ? "grid gap-6" 
            : "space-y-4"
        }`} style={{
          gridTemplateColumns: viewMode === "grid" 
            ? "repeat(auto-fit, minmax(320px, 1fr))" 
            : undefined
        }}>
          {filteredUniversities.map((university) => (
            <UniversityCard
              key={university.id}
              university={university}
              role="counselor"
              onViewDetails={handleViewDetails}
              onEdit={handleEditUniversity}
              onDelete={handleDeleteUniversity}
              onAssignToStudent={handleAssignToStudent}
              className={viewMode === "list" ? "w-full" : ""}
            />
          ))}
        </div>

        {filteredUniversities.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No universities found matching your criteria.</p>
          </div>
        )}
      </ScrollArea>

      {/* Add University Dialog */}
      <AddUniversityDialog 
        open={isAddModalOpen} 
        onOpenChange={setIsAddModalOpen} 
      />

      {/* Assign University Dialog */}
      {assignUniversity && (
        <AssignUniversityDialog
          open={!!assignUniversity}
          onOpenChange={(open) => !open && setAssignUniversity(null)}
          universityId={assignUniversity.id}
          universityName={assignUniversity.name}
        />
      )}

      {/* View Details Dialog */}
      <Dialog open={!!selectedUniversity} onOpenChange={() => setSelectedUniversity(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedUniversity?.name}</DialogTitle>
          </DialogHeader>
          {selectedUniversity && (
            <ScrollArea className="max-h-[calc(90vh-120px)]">
              <div className="space-y-6 pr-6">
                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedUniversity.location && (
                      <div>
                        <h4 className="font-medium text-gray-700">Location</h4>
                        <p className="text-gray-600">{selectedUniversity.location}</p>
                      </div>
                    )}
                    {selectedUniversity.campusSetting && (
                      <div>
                        <h4 className="font-medium text-gray-700">Campus Setting</h4>
                        <p className="text-gray-600">{selectedUniversity.campusSetting}</p>
                      </div>
                    )}
                    {selectedUniversity.website && (
                      <div>
                        <h4 className="font-medium text-gray-700">Website</h4>
                        <a href={selectedUniversity.website.startsWith('http') ? selectedUniversity.website : `https://${selectedUniversity.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {selectedUniversity.website}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {selectedUniversity.cityDescription && (
                  <div>
                    <h4 className="font-medium text-gray-700">City Description</h4>
                    <p className="text-gray-600">{selectedUniversity.cityDescription}</p>
                  </div>
                )}

                {/* Rankings & Academic */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Rankings & Academic</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedUniversity.overallRanking && (
                      <div>
                        <h4 className="font-medium text-gray-700">Overall Ranking</h4>
                        <p className="text-gray-600">#{selectedUniversity.overallRanking}</p>
                      </div>
                    )}
                    {selectedUniversity.academicGrade && (
                      <div>
                        <h4 className="font-medium text-gray-700">Academic Grade</h4>
                        <p className="text-gray-600">{selectedUniversity.academicGrade}</p>
                      </div>
                    )}
                    {selectedUniversity.safetyGrade && (
                      <div>
                        <h4 className="font-medium text-gray-700">Safety Grade</h4>
                        <p className="text-gray-600">{selectedUniversity.safetyGrade}</p>
                      </div>
                    )}
                    {selectedUniversity.courseLink && (
                      <div>
                        <h4 className="font-medium text-gray-700">Course Link</h4>
                        <a href={selectedUniversity.courseLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          View Courses
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {selectedUniversity.subjectRankings && selectedUniversity.subjectRankings.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-700">Subject Rankings</h4>
                    <div className="mt-2 space-y-1">
                      {selectedUniversity.subjectRankings.map((ranking, index) => (
                        <p key={index} className="text-gray-600">{ranking}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Financial */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Financial Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedUniversity.tuitionFee && (
                      <div>
                        <h4 className="font-medium text-gray-700">Tuition Fee</h4>
                        <p className="text-gray-600">{selectedUniversity.tuitionFee}</p>
                      </div>
                    )}
                    {selectedUniversity.totalCostOfAttendance && (
                      <div>
                        <h4 className="font-medium text-gray-700">Total Cost</h4>
                        <p className="text-gray-600">{selectedUniversity.totalCostOfAttendance}</p>
                      </div>
                    )}
                  </div>
                </div>

                {selectedUniversity.financialAidInfo && (
                  <div>
                    <h4 className="font-medium text-gray-700">Financial Aid</h4>
                    <p className="text-gray-600">{selectedUniversity.financialAidInfo}</p>
                  </div>
                )}

                {/* Admissions */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Admissions</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedUniversity.admissionRate && (
                      <div>
                        <h4 className="font-medium text-gray-700">Admission Rate</h4>
                        <p className="text-gray-600">{selectedUniversity.admissionRate}</p>
                      </div>
                    )}
                  </div>
                </div>

                {selectedUniversity.additionalAcademicRequirements && (
                  <div>
                    <h4 className="font-medium text-gray-700">Additional Academic Requirements</h4>
                    <p className="text-gray-600">{selectedUniversity.additionalAcademicRequirements}</p>
                  </div>
                )}

                {/* International Students */}
                {(selectedUniversity.intlUndergrad || selectedUniversity.intlTotal) && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">International Students</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedUniversity.intlUndergrad && (
                        <div>
                          <h4 className="font-medium text-gray-700">International Undergrad %</h4>
                          <p className="text-gray-600">{selectedUniversity.intlUndergrad}</p>
                        </div>
                      )}
                      {selectedUniversity.intlTotal && (
                        <div>
                          <h4 className="font-medium text-gray-700">International Total %</h4>
                          <p className="text-gray-600">{selectedUniversity.intlTotal}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Programs */}
                {selectedUniversity.coopInternshipPrograms && (
                  <div>
                    <h4 className="font-medium text-gray-700">Co-op/Internship Programs</h4>
                    <p className="text-gray-600">{selectedUniversity.coopInternshipPrograms}</p>
                  </div>
                )}

                {/* Additional Remarks */}
                {selectedUniversity.additionalRemarks && (
                  <div>
                    <h4 className="font-medium text-gray-700">Additional Remarks</h4>
                    <p className="text-gray-600">{selectedUniversity.additionalRemarks}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
