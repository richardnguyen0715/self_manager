import { Target, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GoalsEmptyStateProps {
  hasFilters: boolean;
  onCreateGoal: () => void;
}

export function GoalsEmptyState({
  hasFilters,
  onCreateGoal,
}: GoalsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="rounded-full bg-primary/10 p-5">
        <Target className="h-10 w-10 text-primary" />
      </div>

      {hasFilters ? (
        <>
          <h3 className="text-lg font-semibold">No goals match your filters</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Try adjusting your status filter or search query.
          </p>
        </>
      ) : (
        <>
          <h3 className="text-lg font-semibold">Set your first goal</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Goals sit above projects and tasks — define what you want to
            achieve, then break it down into projects and tasks.
          </p>
          <Button onClick={onCreateGoal} className="gap-2 mt-2">
            <Plus className="h-4 w-4" />
            Create Goal
          </Button>
        </>
      )}
    </div>
  );
}
