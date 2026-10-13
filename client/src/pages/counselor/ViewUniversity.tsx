import ViewUniversityEditable from "@/components/university/ViewUniversityEditable";

interface ViewUniversityProps {
  universityId?: string;
}

export default function ViewUniversity({ universityId }: ViewUniversityProps) {
  return <ViewUniversityEditable universityId={universityId} />;
}