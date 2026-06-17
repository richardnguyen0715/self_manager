"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Habit } from "@/types";
import { useLogHabit, useHabitLogs, todayISODate } from "../hooks/useHabits";
import { useHabitsStore } from "../store/habits.store";
import { cn } from "@/lib/utils";

interface HabitLogDialogProps {
  open: boolean;
  habit: Habit;
}

export function HabitLogDialog({ open, habit }: HabitLogDialogProps) {
  const { closeModal } = useHabitsStore();
  const logMutation = useLogHabit(habit.id);

  const today = useMemo(() => todayISODate(), []);

  // Fetch a 1-day range to check if already logged today
  const { data: logs = [] } = useHabitLogs(habit.id, today, today, open);
  const todayLog = logs.find((l) => l.log_date === today) ?? null;

  const [value, setValue] = useState<string>(
    () => String(todayLog?.value ?? ""),
  );
  const [note, setNote] = useState<string>(todayLog?.note ?? "");

  const alreadyCompleted = todayLog?.completed === true;

  async function handleLog(asCompleted: boolean) {
    // Backend requires `value` (number). For check habits, send 1 for done / 0
    // for skipped. For count/duration, use the entered value or 0.
    const numericValue =
      habit.habit_type !== "check" && value !== ""
        ? Number(value)
        : asCompleted
        ? 1
        : 0;

    await logMutation.mutateAsync({
      log_date: today,
      value: numericValue,
      note: note.trim() || null,
    });

    closeModal();
  }

  const isPending = logMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeModal()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {habit.color && (
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: habit.color }}
              />
            )}
            {habit.name}
          </DialogTitle>
          <DialogDescription>
            {alreadyCompleted
              ? "Already logged today — update your log below."
              : "Log your progress for today."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Count / duration value input */}
          {habit.habit_type !== "check" && (
            <div className="space-y-1.5">
              <Label htmlFor="log-value">
                {habit.habit_type === "duration" ? "Duration (mins)" : "Count"}
                {habit.target_value > 0 ? ` / target: ${habit.target_value}` : ""}
              </Label>
              <Input
                id="log-value"
                type="number"
                min={0}
                placeholder={
                  habit.habit_type === "duration"
                    ? "Minutes completed"
                    : "How many?"
                }
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          )}

          {/* Progress bar when target set */}
          {habit.habit_type !== "check" && habit.target_value > 0 && value !== "" && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{value}</span>
                <span>
                  {Math.min(
                    Math.round((Number(value) / habit.target_value) * 100),
                    100,
                  )}
                  % of target
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min((Number(value) / habit.target_value) * 100, 100)}%`,
                    backgroundColor: habit.color ?? "hsl(var(--primary))",
                  }}
                />
              </div>
            </div>
          )}

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="log-note">Note (optional)</Label>
            <Input
              id="log-note"
              placeholder="How did it go?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {habit.habit_type === "check" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => handleLog(false)}
              disabled={isPending}
              className={cn(
                "flex-1",
                todayLog?.completed === false && "border-destructive text-destructive",
              )}
            >
              {isPending ? "Saving…" : "Mark skipped"}
            </Button>
          )}
          <Button
            type="button"
            onClick={() => handleLog(true)}
            disabled={isPending}
            className="flex-1"
            style={
              habit.color
                ? { backgroundColor: habit.color, borderColor: habit.color }
                : undefined
            }
          >
            {isPending
              ? "Saving…"
              : alreadyCompleted
              ? "Update log"
              : habit.habit_type === "check"
              ? "Mark done"
              : "Save log"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
