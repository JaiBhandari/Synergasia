import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

interface AssignUniversityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  universityId: number;
  universityName: string;
}

export default function AssignUniversityDialog({ 
  open, 
  onOpenChange, 
  universityId, 
  universityName 
}: AssignUniversityDialogProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("target");
  const { toast } = useToast();

  // Fetch students
  const { data: students = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/students"],
    enabled: open,
  });

  // Mutation to assign university to student
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStudentId) {
        throw new Error("Please select a student");
      }
      
      return await apiRequest(
        `/api/students/${selectedStudentId}/universities`,
        "POST",
        { 
          universityId, 
          category: selectedCategory 
        }
      );
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `${universityName} has been added to the student's list as ${selectedCategory}.`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/students/${selectedStudentId}/universities`] });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to assign university to student.",
      });
    },
  });

  const handleClose = () => {
    setSelectedStudentId("");
    setSelectedCategory("target");
    onOpenChange(false);
  };

  const handleAssign = () => {
    assignMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign University to Student</DialogTitle>
          <DialogDescription>
            Add <strong>{universityName}</strong> to a student's university list
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Student Selector */}
          <div className="space-y-2">
            <Label htmlFor="student">Select Student</Label>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="ml-2 text-sm text-gray-500">Loading students...</span>
              </div>
            ) : (
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger id="student" data-testid="select-student">
                  <SelectValue placeholder="Choose a student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem 
                      key={student.id} 
                      value={student.adminStudentId.toString()}
                      data-testid={`student-option-${student.adminStudentId}`}
                    >
                      {student.user?.firstName} {student.user?.lastName} (ID: {student.adminStudentId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Category/Rating Selector */}
          <div className="space-y-2">
            <Label htmlFor="category">University Category</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger id="category" data-testid="select-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="safety" data-testid="category-safety">
                  Safety - High chance of acceptance
                </SelectItem>
                <SelectItem value="target" data-testid="category-target">
                  Target - Moderate chance of acceptance
                </SelectItem>
                <SelectItem value="reach" data-testid="category-reach">
                  Reach - Lower chance of acceptance
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={assignMutation.isPending}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleAssign}
            disabled={!selectedStudentId || assignMutation.isPending}
            data-testid="button-assign"
          >
            {assignMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              "Assign University"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
