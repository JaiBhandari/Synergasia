import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Grid, List, Plus } from "lucide-react";

interface UniversityFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  onAddUniversity?: () => void;
  role: "admin" | "counselor" | "student";
  totalCount: number;
}

export default function UniversityFilters({
  searchTerm,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onAddUniversity,
  role,
  totalCount,
}: UniversityFiltersProps) {
  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="space-y-4 p-6">
        {/* Top row: Search and Add University */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search universities by name or location..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
              data-testid="search-universities-input"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">View:</span>
              <div className="flex border border-gray-200 rounded-md">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onViewModeChange("grid")}
                  className={`rounded-r-none ${
                    viewMode === "grid" 
                      ? "bg-primary-600 text-white hover:bg-primary-700" 
                      : "hover:bg-gray-100"
                  }`}
                  data-testid="view-grid-button"
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onViewModeChange("list")}
                  className={`rounded-l-none border-l border-gray-200 ${
                    viewMode === "list" 
                      ? "bg-primary-600 text-white hover:bg-primary-700" 
                      : "hover:bg-gray-100"
                  }`}
                  data-testid="view-list-button"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {role === "admin" && onAddUniversity && (
              <Button
                onClick={onAddUniversity}
                data-testid="add-university-button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add University
              </Button>
            )}
          </div>
        </div>

        {/* Results summary */}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div data-testid="results-summary">
            Showing {totalCount} {totalCount === 1 ? "university" : "universities"}
            {searchTerm && ` matching "${searchTerm}"`}
          </div>
        </div>
      </div>
    </div>
  );
}
