import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import UniversityCard from "@/components/university/UniversityCard";
import UniversityFilters from "@/components/university/UniversityFilters";
import type { University } from "@shared/schema";

export default function StudentUniversitiesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "my">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Get current student data
  const { data: student } = useQuery<{ id: number; adminStudentId: number }>({
    queryKey: ["/api/me/student"],
  });

  // Get all universities
  const { data: allUniversities, isLoading: isLoadingAll } = useQuery<University[]>({
    queryKey: ["/api/universities"],
  });

  // Get student's universities (added by counselor/admin)
  const { data: myUniversitiesData, isLoading: isLoadingMy } = useQuery<any[]>({
    queryKey: [`/api/students/${student?.adminStudentId}/universities`],
    enabled: !!student?.adminStudentId,
  });

  // Filter all universities
  const filteredAllUniversities = useMemo(() => {
    if (!allUniversities) return [];

    return allUniversities.filter((uni: University) => {
      const matchesSearch = uni.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (uni.location && uni.location.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return matchesSearch;
    });
  }, [allUniversities, searchTerm]);

  // Filter my universities
  const filteredMyUniversities = useMemo(() => {
    if (!myUniversitiesData) return [];

    return myUniversitiesData
      .filter((su: any) => {
        const uni = su.university;
        if (!uni) return false;
        
        const matchesSearch = uni.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             (uni.location && uni.location.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesCategory = categoryFilter === "all" || su.category === categoryFilter;
        
        return matchesSearch && matchesCategory;
      })
      .map((su: any) => ({
        ...su.university,
        category: su.category,
        studentUniversityId: su.id,
      }));
  }, [myUniversitiesData, searchTerm, categoryFilter]);

  const handleViewDetails = (university: University) => {
    setSelectedUniversity(university);
  };

  const isLoading = activeTab === "all" ? isLoadingAll : isLoadingMy;
  const currentUniversities = activeTab === "all" ? filteredAllUniversities : filteredMyUniversities;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Universities</h1>
          <p className="text-sm text-gray-500 mt-1">Manage university information and data.</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "all" | "my")} className="w-full">
        <div className="bg-white border-b border-gray-200 px-6">
          <TabsList className="bg-transparent border-b-0 h-auto p-0">
            <TabsTrigger
              value="all"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary-600 rounded-none pb-3 px-4"
              data-testid="tab-all-universities"
            >
              All Universities
              {allUniversities && (
                <Badge variant="secondary" className="ml-2">
                  {allUniversities.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="my"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary-600 rounded-none pb-3 px-4"
              data-testid="tab-my-universities"
            >
              My Universities
              {myUniversitiesData && Array.isArray(myUniversitiesData) && (
                <Badge variant="secondary" className="ml-2">
                  {myUniversitiesData.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Filters */}
        <UniversityFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          role="student"
          totalCount={currentUniversities.length}
        />

        {/* All Universities Tab */}
        <TabsContent value="all" className="mt-0">
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="p-6">
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
                </div>
              ) : currentUniversities.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No universities found</p>
                </div>
              ) : (
                <div className={viewMode === "grid" 
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" 
                  : "space-y-4"
                }>
                  {currentUniversities.map((university: any) => (
                    <UniversityCard
                      key={university.id}
                      university={university}
                      role="student"
                      onViewDetails={handleViewDetails}
                      className={viewMode === "list" ? "w-full" : ""}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* My Universities Tab */}
        <TabsContent value="my" className="mt-0">
          {/* Category Filter */}
          <div className="px-6 py-4 bg-white border-b">
            <div className="flex items-center gap-3">
              <label htmlFor="category-filter" className="text-sm font-medium text-gray-700">
                Filter by category:
              </label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger id="category-filter" className="w-48" data-testid="select-category-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="safety">Safety</SelectItem>
                  <SelectItem value="target">Target</SelectItem>
                  <SelectItem value="reach">Reach</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <ScrollArea className="h-[calc(100vh-340px)]">
            <div className="p-6">
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
                </div>
              ) : currentUniversities.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No universities added to your list yet</p>
                  <p className="text-sm text-gray-400 mt-2">Your counselor or admin can add universities for you</p>
                </div>
              ) : (
                <div className={viewMode === "grid" 
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" 
                  : "space-y-4"
                }>
                  {currentUniversities.map((university: any) => (
                    <UniversityCard
                      key={university.id}
                      university={university}
                      role="student"
                      onViewDetails={handleViewDetails}
                      className={viewMode === "list" ? "w-full" : ""}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* View Details Dialog */}
      <Dialog open={!!selectedUniversity} onOpenChange={() => setSelectedUniversity(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedUniversity?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh] pr-4">
            {selectedUniversity && (
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-4">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">University Name</p>
                      <p className="text-sm">{selectedUniversity.name || "Not specified"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Location</p>
                      <p className="text-sm">{selectedUniversity.location || "Not specified"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Overall Ranking</p>
                      <p className="text-sm">{selectedUniversity.overallRanking ? `#${selectedUniversity.overallRanking}` : "Not specified"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Campus Setting</p>
                      <p className="text-sm">{selectedUniversity.campusSetting || "Not specified"}</p>
                    </div>
                  </div>
                  {(selectedUniversity as any).subjectRankings && (selectedUniversity as any).subjectRankings.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-500 mb-1">Subject Rankings</p>
                      <p className="text-sm">{(selectedUniversity as any).subjectRankings.join(", ")}</p>
                    </div>
                  )}
                  {(selectedUniversity as any).cityDescription && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-500 mb-1">City Description</p>
                      <p className="text-sm">{(selectedUniversity as any).cityDescription}</p>
                    </div>
                  )}
                </div>

                {/* Academic & Campus Life */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-4">Academic & Campus Life</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Academic Grade</p>
                      <p className="text-sm">{(selectedUniversity as any).academicGrade || "Not specified"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Safety Grade</p>
                      <p className="text-sm">{(selectedUniversity as any).safetyGrade || "Not specified"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Admission Rate</p>
                      <p className="text-sm">{selectedUniversity.admissionRate || "Not specified"}</p>
                    </div>
                  </div>
                  {(selectedUniversity as any).additionalAcademicRequirements && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-500 mb-1">Additional Academic Requirements</p>
                      <p className="text-sm">{(selectedUniversity as any).additionalAcademicRequirements}</p>
                    </div>
                  )}
                  {(selectedUniversity as any).coopInternshipPrograms && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-500 mb-1">Co-op/Internship Programs</p>
                      <p className="text-sm">{(selectedUniversity as any).coopInternshipPrograms}</p>
                    </div>
                  )}
                </div>

                {/* Financial Information */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-4">Financial Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Tuition Fee</p>
                      <p className="text-sm">{selectedUniversity.tuitionFee || "Not specified"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Total Cost of Attendance</p>
                      <p className="text-sm">{(selectedUniversity as any).totalCostOfAttendance || "Not specified"}</p>
                    </div>
                  </div>
                  {(selectedUniversity as any).financialAidInfo && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-500 mb-1">Financial Aid Information</p>
                      <p className="text-sm">{(selectedUniversity as any).financialAidInfo}</p>
                    </div>
                  )}
                </div>

                {/* International Students */}
                {((selectedUniversity as any).intlUndergrad || (selectedUniversity as any).intlTotal) && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-4">International Students</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">International Undergraduate Info</p>
                        <p className="text-sm">{(selectedUniversity as any).intlUndergrad || "Not specified"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Total International Students</p>
                        <p className="text-sm">{(selectedUniversity as any).intlTotal || "Not specified"}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Additional Information */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-4">Additional Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedUniversity.website && (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Website</p>
                        <a
                          href={selectedUniversity.website.startsWith('http') ? selectedUniversity.website : `https://${selectedUniversity.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary-600 hover:underline break-all"
                        >
                          {selectedUniversity.website}
                        </a>
                      </div>
                    )}
                    {(selectedUniversity as any).courseLink && (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Course Catalog Link</p>
                        <a
                          href={(selectedUniversity as any).courseLink.startsWith('http') ? (selectedUniversity as any).courseLink : `https://${(selectedUniversity as any).courseLink}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary-600 hover:underline break-all"
                        >
                          {(selectedUniversity as any).courseLink}
                        </a>
                      </div>
                    )}
                  </div>
                  {(selectedUniversity as any).additionalRemarks && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-500 mb-1">Additional Remarks</p>
                      <p className="text-sm">{(selectedUniversity as any).additionalRemarks}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
