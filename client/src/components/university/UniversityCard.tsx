import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { Building2, MapPin, ExternalLink, Eye, Edit, Trash2, Plus, Minus, Trophy, DollarSign, Users, UserPlus } from "lucide-react";

interface UniversityCardProps {
  university: {
    id: number;
    name: string;
    location?: string;
    overallRanking?: number;
    campusSetting?: string;
    tuitionFee?: string;
    admissionRate?: string;
    website?: string;
    category?: "safety" | "target" | "reach";
  };
  role: "admin" | "counselor" | "student";
  onViewDetails?: (university: any) => void;
  onEdit?: (university: any) => void;
  onDelete?: (universityId: number) => void;
  onAddToList?: (universityId: number) => void;
  onRemoveFromList?: (universityId: number) => void;
  onAssignToStudent?: (university: any) => void;
  isInMyList?: boolean;
  className?: string;
}

export default function UniversityCard({
  university,
  role,
  onViewDetails,
  onEdit,
  onDelete,
  onAddToList,
  onRemoveFromList,
  onAssignToStudent,
  isInMyList = false,
  className = "",
}: UniversityCardProps) {
  const [location, setLocation] = useLocation();
  
  const handleWebsiteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (university.website) {
      window.open(university.website.startsWith('http') ? university.website : `https://${university.website}`, '_blank');
    }
  };

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onViewDetails) {
      onViewDetails(university);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(university);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(university.id);
    }
  };

  const handleAddToList = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddToList) onAddToList(university.id);
  };

  const handleRemoveFromList = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemoveFromList) onRemoveFromList(university.id);
  };

  const handleAssignToStudent = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAssignToStudent) {
      onAssignToStudent(university);
    }
  };

  return (
    <Card 
      className={`group hover:shadow-soft transition-all duration-200 cursor-pointer border-gray-200 hover:border-blue-300 h-full ${className}`} 
      onClick={handleViewDetails}
    >
      <CardContent className="p-5 flex flex-col h-full">
        {/* Header with Icon and Actions */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2.5 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shrink-0">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 leading-tight mb-1.5 group-hover:text-blue-600 transition-colors" data-testid="text-university-name">
                {university.name}
              </h3>
              
              {/* Location */}
              {university.location && (
                <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-2" data-testid="text-location">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  <span>{university.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 ml-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleViewDetails}
              className="h-8 w-8 p-0"
              data-testid="view-details-button"
            >
              <Eye className="w-4 h-4" />
            </Button>

            {(role === "admin" || role === "counselor") && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAssignToStudent}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 w-8 p-0"
                  data-testid="assign-to-student-button"
                  title="Assign to Student"
                >
                  <UserPlus className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEdit}
                  className="h-8 w-8 p-0"
                  data-testid="edit-university-button"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </>
            )}

            {role === "admin" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                data-testid="delete-university-button"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Key Information Grid - grows to fill available space */}
        <div className="space-y-2 flex-grow">
          {/* Category Badge (for student's My Universities) */}
          {university.category && (
            <div className="flex items-center gap-2 mb-2">
              <Badge 
                className={`${
                  university.category === 'safety' 
                    ? 'bg-green-100 text-green-800 border-green-200' 
                    : university.category === 'target'
                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                    : 'bg-orange-100 text-orange-800 border-orange-200'
                } hover:opacity-90 font-medium`}
                data-testid="text-category"
              >
                {university.category === 'safety' ? '🎯 Safety' : university.category === 'target' ? '🎓 Target' : '🚀 Reach'}
              </Badge>
            </div>
          )}

          {university.overallRanking && (
            <div className="flex items-center gap-2" data-testid="text-ranking">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 rounded-lg border border-amber-100">
                <Trophy className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-sm font-medium text-amber-900">Rank #{university.overallRanking}</span>
              </div>
              {university.campusSetting && (
                <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100 font-normal" data-testid="text-setting">
                  {university.campusSetting}
                </Badge>
              )}
            </div>
          )}

          {!university.overallRanking && university.campusSetting && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100 font-normal" data-testid="text-setting">
                {university.campusSetting}
              </Badge>
            </div>
          )}

          {/* Financial & Admission Info */}
          <div className="grid grid-cols-2 gap-2">
            {university.tuitionFee && (
              <div className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg" data-testid="text-tuition">
                <DollarSign className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs text-gray-500 mb-0.5">Tuition</div>
                  <div className="text-sm font-medium text-gray-900 truncate">{university.tuitionFee}</div>
                </div>
              </div>
            )}

            {university.admissionRate && (
              <div className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg" data-testid="text-admission-rate">
                <Users className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs text-gray-500 mb-0.5">Admission</div>
                  <div className="text-sm font-medium text-gray-900 truncate">{university.admissionRate}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer with Website Link - stays at bottom */}
        {university.website && (
          <div className="pt-3 border-t border-gray-100 mt-4">
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto text-blue-600 hover:text-blue-700 text-sm font-medium"
              onClick={handleWebsiteClick}
              data-testid="link-website"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Visit Website
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
