"use client";

import { useState } from "react";
import { Loader2, X, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useSprintUIStore } from "../store";
import { useCompleteSprint, useSprintDetail } from "../hooks/useSprints";

export function CompleteSprintDialog() {
  const { isCompleteDialogOpen, completingSprintId, closeDialog } =
    useSprintUIStore();

  const { data: sprint } = useSprintDetail(completingSprintId ?? "");
  const complete = useCompleteSprint();
  const [summary, setSummary] = useState("");

  async function handleComplete() {
    if (!completingSprintId) return;
    await complete.mutateAsync({
      id: completingSprintId,
      summary: summary.trim() || undefined,
    });
    setSummary("");
    closeDialog();
  }

  if (!completingSprintId) return null;

  const openItems =
    sprint && sprint.committed_count > 0
      ? sprint.committed_count - sprint.done_count
      : 0;

  return (
    <Dialog
      open={isCompleteDialogOpen}
      onOpenChange={(open) => !open && closeDialog()}
    >
      <DialogContent className="w-[95vw] max-w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Complete Sprint
          </DialogTitle>
          <DialogDescription>
            Completing &ldquo;{sprint?.name ?? "..."}&rdquo; will auto-generate a
            sprint review. Any incomplete items will remain as is.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {openItems > 0 && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              {openItems} work item{openItems !== 1 ? "s" : ""} still open — they
              will remain in the backlog or sprint.
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="complete-summary">Sprint summary (optional)</Label>
            <textarea
              id="complete-summary"
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="What did the team accomplish this sprint?"
              className={cn(
                "flex w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
            />
          </div>

          {complete.error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 flex items-start gap-2">
              <X className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">
                {complete.error.message}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={closeDialog}
            disabled={complete.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleComplete}
            disabled={complete.isPending}
          >
            {complete.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Completing...
              </>
            ) : (
              "Complete sprint"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
