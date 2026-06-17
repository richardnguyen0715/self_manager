"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDeleteGoal } from "../hooks/useGoals";

interface DeleteGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goalId: string | null;
  goalTitle?: string;
}

export function DeleteGoalDialog({
  open,
  onOpenChange,
  goalId,
  goalTitle,
}: DeleteGoalDialogProps) {
  const deleteGoal = useDeleteGoal();

  const handleDelete = async () => {
    if (!goalId) return;
    try {
      await deleteGoal.mutateAsync(goalId);
      onOpenChange(false);
    } catch {
      // Error surfaced via mutation state
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Goal</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <strong>{goalTitle ?? "this goal"}</strong>? This action cannot be
            undone. Projects and tasks linked to this goal will not be deleted
            but will be detached.
          </DialogDescription>
        </DialogHeader>

        {deleteGoal.error && (
          <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
            {deleteGoal.error.message}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteGoal.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteGoal.isPending}
          >
            {deleteGoal.isPending ? "Deleting…" : "Delete Goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
