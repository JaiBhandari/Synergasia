import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  ExternalLink, 
  University, 
  MapPin, 
  Building, 
  DollarSign, 
  GraduationCap,
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  XCircle,
  Loader2,
  Calendar
} from "lucide-react";
import type { University as UniversityType, UniversityDate } from "@shared/schema";
import { format } from "date-fns";

interface ViewUniversityProps {
  universityId?: string;
}

const getStatusBadge = (status: string = "pending", progress?: number, issues?: string) => {
  switch (status) {
    case "complete":
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200" data-testid="status-complete">
          <CheckCircle className="w-3 h-3 mr-1" />
          Complete
        </Badge>
      );
    case "processing":
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200" data-testid="status-processing">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Processing {progress ? `${progress}%` : ''}
        </Badge>
      );
    case "incomplete":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200" data-testid="status-incomplete">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Incomplete
        </Badge>
      );
    case "error":
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200" data-testid="status-error">
          <XCircle className="w-3 h-3 mr-1" />
          Error
        </Badge>
      );
    default:
      return (
        <Badge className="bg-gray-100 text-gray-800 border-gray-200" data-testid="status-pending">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
  }
};

export default function ViewUniversity({ universityId }: ViewUniversityProps) {
  const [location, setLocation] = useLocation();

  // Extract university ID from URL if not provided as prop
  const id = universityId || location.split('/').pop();

  const { data: university, isLoading, error } = useQuery<UniversityType>({
    queryKey: ["/api/universities", id],
    enabled: !!id,
  });

  const { data: dates = [] } = useQuery<UniversityDate[]>({
    queryKey: ["/api/universities", id, "dates"],
    enabled: !!id,
  });

  const handleWebsiteClick = () => {
    if (university?.website) {
      const url = university.website.startsWith('http') ? university.website : `https://${university.website}`;
      window.open(url, '_blank');
    }
  };

  const getBackRoute = () => {
    // Determine back route based on current location
    if (location.includes('/student/')) {
      return '/student/universities';
    }
    // Default fallback for shared component usage
    return '/universities';
  };

  const getBreadcrumbRoute = () => {
    if (location.includes('/student/')) {
      return '/student/universities';
    }
    return '/universities';
  };

  // Helper function to check if a field is selected
  const isFieldSelected = (fieldKey: string) => {
    if (!university?.selectedAIFields || university.selectedAIFields.length === 0) {
      // If no fields are selected, show all fields (backwards compatibility)
      return true;
    }
    return university.selectedAIFields.includes(fieldKey);
  };

  // Helper function to check if a date category is selected
  const isDateCategorySelected = (category: string) => {
    if (!university?.selectedDateCategories || university.selectedDateCategories.length === 0) {
      // If no categories are selected, show all categories (backwards compatibility)
      return true;
    }
    return university.selectedDateCategories.includes(category);
  };

  // Helper function to check if a date is valid
  const isValidDate = (dateString: any): boolean => {
    if (!dateString) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  };

  // Group dates by category
  const datesByCategory = dates.reduce((acc, date) => {
    if (!acc[date.category]) {
      acc[date.category] = [];
    }
    acc[date.category].push(date);
    return acc;
  }, {} as Record<string, UniversityDate[]>);

  // Category labels
  const categoryLabels: Record<string, string> = {
    early_admissions: "Early Admissions",
    regular_admissions: "Regular Admissions",
    rolling_admissions: "Rolling Admissions",
    transfer_admissions: "Transfer Admissions",
    financial_aid: "Financial Aid & Scholarships",
    supporting_materials: "Supporting Materials",
    enrollment_next_steps: "Enrollment & Next Steps",
    academic_calendar: "Academic Calendar",
    special_programs: "Special Programs",
    international_deadlines: "International Deadlines"
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !university) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">University Not Found</h2>
        <p className="text-gray-600 mb-4">The university you're looking for doesn't exist or you don't have access to it.</p>
        <Button onClick={() => setLocation(getBackRoute())} data-testid="back-to-universities">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Universities
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumb data-testid="breadcrumb-nav">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink 
              href={getBreadcrumbRoute()}
              onClick={(e) => {
                e.preventDefault();
                setLocation(getBreadcrumbRoute());
              }}
              data-testid="breadcrumb-universities"
            >
              Universities
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <span className="font-medium" data-testid="breadcrumb-current">{university.name}</span>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation(getBackRoute())}
              data-testid="back-button"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <University className="text-primary-600 text-xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="university-name">
                {university.name}
              </h1>
              {university.location && (
                <div className="flex items-center text-gray-500 mt-1">
                  <MapPin className="w-4 h-4 mr-1" />
                  <span data-testid="university-location">{university.location}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {getStatusBadge(university.aiStatus || undefined, university.aiProgress || undefined, university.aiIssues || undefined)}
            
            {university.website && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleWebsiteClick}
                data-testid="visit-website-button"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Visit Website
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Basic Information Section */}
        <Card data-testid="basic-info-section">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building className="w-5 h-5 text-primary-600" />
              <span>Basic Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">University Name</label>
                <div className="p-2 min-h-[40px] flex items-center text-sm" data-testid="display-name">
                  {university.name || "Not specified"}
                </div>
              </div>

              {isFieldSelected("location") && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Location</label>
                  <div className="p-2 min-h-[40px] flex items-center text-sm" data-testid="display-location">
                    {university.location || "Not specified"}
                  </div>
                </div>
              )}

              {isFieldSelected("overallRanking") && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Overall Ranking</label>
                  <div className="p-2 min-h-[40px] flex items-center text-sm" data-testid="display-ranking">
                    {university.overallRanking ? `#${university.overallRanking}` : "Not specified"}
                  </div>
                </div>
              )}

              {isFieldSelected("campusSetting") && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Campus Setting</label>
                  <div className="p-2 min-h-[40px] flex items-center text-sm" data-testid="display-campus-setting">
                    {university.campusSetting || "Not specified"}
                  </div>
                </div>
              )}
            </div>

            {isFieldSelected("subjectRankings") && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Subject Rankings</label>
                <div className="p-2 min-h-[60px] text-sm" data-testid="display-subject-rankings">
                  {university.subjectRankings?.join(", ") || "Not specified"}
                </div>
              </div>
            )}

            {isFieldSelected("cityDescription") && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">City Description</label>
                <div className="p-2 min-h-[60px] text-sm" data-testid="display-city-description">
                  {university.cityDescription || "Not specified"}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Academic & Campus Life Section */}
        {(isFieldSelected("academicGrade") || isFieldSelected("safetyGrade") || isFieldSelected("admissionRate") || isFieldSelected("satRange") || isFieldSelected("coopInternshipPrograms")) && (
          <Card data-testid="academic-section">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <GraduationCap className="w-5 h-5 text-primary-600" />
                <span>Academic & Campus Life</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isFieldSelected("academicGrade") && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Academic Grade</label>
                    <div className="p-2 min-h-[40px] flex items-center text-sm" data-testid="display-academic-grade">
                      {university.academicGrade || "Not specified"}
                    </div>
                  </div>
                )}

                {isFieldSelected("safetyGrade") && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Safety Grade</label>
                    <div className="p-2 min-h-[40px] flex items-center text-sm" data-testid="display-safety-grade">
                      {university.safetyGrade || "Not specified"}
                    </div>
                  </div>
                )}

                {isFieldSelected("admissionRate") && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Admission Rate</label>
                    <div className="p-2 min-h-[40px] flex items-center text-sm" data-testid="display-admission-rate">
                      {university.admissionRate || "Not specified"}
                    </div>
                  </div>
                )}

                {isFieldSelected("satRange") && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">SAT Range</label>
                    <div className="p-2 min-h-[40px] flex items-center text-sm" data-testid="display-sat-range">
                      {university.satRange || "Not specified"}
                    </div>
                  </div>
                )}
              </div>

              {isFieldSelected("coopInternshipPrograms") && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Co-op/Internship Programs</label>
                  <div className="p-2 min-h-[60px] text-sm" data-testid="display-coop-programs">
                    {university.coopInternshipPrograms || "Not specified"}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Financial Information Section */}
        {(isFieldSelected("tuitionFee") || isFieldSelected("totalCostOfAttendance") || isFieldSelected("financialAidInfo")) && (
          <Card data-testid="financial-section">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-primary-600" />
                <span>Financial Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isFieldSelected("tuitionFee") && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Tuition Fee</label>
                    <div className="p-2 min-h-[40px] flex items-center text-sm" data-testid="display-tuition-fee">
                      {university.tuitionFee || "Not specified"}
                    </div>
                  </div>
                )}

                {isFieldSelected("totalCostOfAttendance") && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Total Cost of Attendance</label>
                    <div className="p-2 min-h-[40px] flex items-center text-sm" data-testid="display-total-cost">
                      {university.totalCostOfAttendance || "Not specified"}
                    </div>
                  </div>
                )}
              </div>

              {isFieldSelected("financialAidInfo") && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Financial Aid Information</label>
                  <div className="p-2 min-h-[60px] text-sm" data-testid="display-financial-aid">
                    {university.financialAidInfo || "Not specified"}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Additional Information Section */}
        {(isFieldSelected("courseLink") || isFieldSelected("intlUndergrad") || isFieldSelected("intlTotal") || isFieldSelected("additionalRemarks") || university.website) && (
          <Card data-testid="additional-section">
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {university.website && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Website</label>
                    <div className="p-2 min-h-[40px] flex items-center text-sm" data-testid="display-website">
                      <a 
                        href={university.website.startsWith('http') ? university.website : `https://${university.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {university.website}
                      </a>
                    </div>
                  </div>
                )}

                {isFieldSelected("courseLink") && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Course Catalog Link</label>
                    <div className="p-2 min-h-[40px] flex items-center text-sm" data-testid="display-course-link">
                      {university.courseLink ? (
                        <a 
                          href={university.courseLink.startsWith('http') ? university.courseLink : `https://${university.courseLink}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {university.courseLink}
                        </a>
                      ) : (
                        "Not specified"
                      )}
                    </div>
                  </div>
                )}

                {isFieldSelected("intlUndergrad") && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">International Undergraduate Info</label>
                    <div className="p-2 min-h-[40px] flex items-center text-sm" data-testid="display-intl-undergrad">
                      {university.intlUndergrad || "Not specified"}
                    </div>
                  </div>
                )}

                {isFieldSelected("intlTotal") && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Total International Students</label>
                    <div className="p-2 min-h-[40px] flex items-center text-sm" data-testid="display-intl-total">
                      {university.intlTotal || "Not specified"}
                    </div>
                  </div>
                )}
              </div>

              {isFieldSelected("additionalRemarks") && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Additional Remarks</label>
                  <div className="p-2 min-h-[60px] text-sm" data-testid="display-additional-remarks">
                    {university.additionalRemarks || "Not specified"}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Important Dates Section */}
        {dates.length > 0 && Object.keys(datesByCategory).some(category => isDateCategorySelected(category)) && (
          <Card data-testid="dates-section">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-primary-600" />
                <span>Important Dates</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(datesByCategory)
                  .filter(([category]) => isDateCategorySelected(category))
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([category, categoryDates]) => (
                    <div key={category} data-testid={`dates-category-${category}`}>
                      <h4 className="text-md font-semibold text-gray-900 mb-3">
                        {categoryLabels[category] || category}
                      </h4>
                      <div className="space-y-2">
                        {categoryDates
                          .filter(date => isValidDate(date.dueDate))
                          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                          .map((date) => (
                            <div 
                              key={date.id} 
                              className="flex justify-between items-start p-3 bg-gray-50 rounded-lg"
                              data-testid={`date-${date.id}`}
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {date.label}
                                </p>
                                {date.notes && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    {date.notes}
                                  </p>
                                )}
                              </div>
                              <div className="ml-4 text-right">
                                <p className="text-sm font-semibold text-primary-600">
                                  {format(new Date(date.dueDate), "MMM d, yyyy")}
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}