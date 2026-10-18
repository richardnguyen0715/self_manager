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
import {
  useCompleteSprint,
  useSprintDetail,
  useSprintsList,
} from "../hooks/useSprints";
import type { UnfinishedItemsAction } from "../types";

export function CompleteSprintDialog() {
  const { isCompleteDialogOpen, completingSprintId, closeDialog } =
    useSprintUIStore();

  const { data: sprint } = useSprintDetail(completingSprintId ?? "");
  const { data: plannedList } = useSprintsList({ status: "planned" });
  const complete = useCompleteSprint();
  const [summary, setSummary] = useState("");
  const [unfinished, setUnfinished] = useState<UnfinishedItemsAction>("backlog");
  const [pickedNextSprintId, setPickedNextSprintId] = useState("");

  const plannedSprints = (plannedList?.data ?? []).filter(
    (s) => s.id !== completingSprintId,
  );
  const nextSprintId =
    pickedNextSprintId && plannedSprints.some((s) => s.id === pickedNextSprintId)
      ? pickedNextSprintId
      : (plannedSprints[0]?.id ?? "");
  const canMoveToNext = plannedSprints.length > 0;

  async function handleComplete() {
    if (!completingSprintId) return;
    await complete.mutateAsync({
      id: completingSprintId,
      summary: summary.trim() || undefined,
      unfinished: openItems > 0 ? unfinished : "keep",
      nextSprintId,
    });
    setSummary("");
    closeDialog();
  }

  if (!completingSprintId) return null;

  // committed_count / done_count come from the sprint detail payload.
  const openItems =
    sprint && sprint.committed_count > 0
      ? sprint.committed_count - sprint.done_count
      : 0;

  const submitBlocked =
    complete.isPending || (unfinished === "next_sprint" && !nextSprintId);

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
            sprint review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {openItems > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium mb-2">
                {openItems} unfinished item{openItems !== 1 ? "s" : ""}
              </legend>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="unfinished-action"
                  value="backlog"
                  checked={unfinished === "backlog"}
                  onChange={() => setUnfinished("backlog")}
                  className="h-4 w-4"
                />
                Move to backlog
              </label>

              <label
                className={cn(
                  "flex items-center gap-2 text-sm",
                  canMoveToNext ? "cursor-pointer" : "opacity-50",
                )}
              >
                <input
                  type="radio"
                  name="unfinished-action"
                  value="next_sprint"
                  checked={unfinished === "next_sprint"}
                  disabled={!canMoveToNext}
                  onChange={() => setUnfinished("next_sprint")}
                  className="h-4 w-4"
                />
                Move to sprint
                <select
                  aria-label="Next sprint"
                  value={nextSprintId}
                  disabled={!canMoveToNext || unfinished !== "next_sprint"}
                  onChange={(e) => {
                    setPickedNextSprintId(e.target.value);
                    setUnfinished("next_sprint");
                  }}
                  className="ml-1 flex-1 min-w-0 rounded-md border border-input bg-transparent px-2 py-1 text-sm disabled:opacity-60"
                >
                  {plannedSprints.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              {!canMoveToNext && (
                <p className="text-xs text-muted-foreground pl-6">
                  No planned sprint available.
                </p>
              )}

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="unfinished-action"
                  value="keep"
                  checked={unfinished === "keep"}
                  onChange={() => setUnfinished("keep")}
                  className="h-4 w-4"
                />
                Keep in this sprint
              </label>
            </fieldset>
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
          <Button onClick={handleComplete} disabled={submitBlocked}>
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
