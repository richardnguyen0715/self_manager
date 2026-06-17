"use client";

import { format } from "date-fns";
import { CheckCircle2, Circle, Flame, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DashboardHabit } from "@/types";
import { useLogHabit } from "../hooks/useLogHabit";
import { useDashboardUIStore } from "../store";

interface HabitItemProps {
  habit: DashboardHabit;
}

export function HabitItem({ habit }: HabitItemProps) {
  const { mutate: logHabit } = useLogHabit();
  const { pendingHabitIds } = useDashboardUIStore();
  const isPending = pendingHabitIds.has(habit.id);
  const completedToday = habit.completed;
  const today = format(new Date(), "yyyy-MM-dd");

  const handleToggle = () => {
    if (completedToday || isPending) return;
    logHabit({
      habit_id: habit.id,
      date: today,
      value: habit.logged_value ?? habit.target_value,
    });
  };

  // Resolve icon: use emoji icon if set, otherwise a default
  const iconDisplay = habit.icon ?? "✓";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent/50",
        completedToday && "opacity-60",
      )}
    >
      {/* Habit color dot + icon */}
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
        style={{ backgroundColor: habit.color ?? "hsl(var(--muted))" }}
        aria-hidden="true"
      >
        {iconDisplay}
      </div>

      {/* Label */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm text-foreground",
            completedToday && "line-through",
          )}
        >
          {habit.name}
        </p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {habit.current_streak > 0 && (
            <span className="flex items-center gap-0.5 text-orange-500">
              <Flame className="h-3 w-3" />
              {habit.current_streak}d
            </span>
          )}
          {habit.habit_type !== "check" && habit.target_value != null && (
            <span>
              Target: {habit.target_value}
            </span>
          )}
        </div>
      </div>

      {/* Complete toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={handleToggle}
        disabled={completedToday || isPending}
        aria-label={completedToday ? "Habit completed" : "Mark habit done"}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : completedToday ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
