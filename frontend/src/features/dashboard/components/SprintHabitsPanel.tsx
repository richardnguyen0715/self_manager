"use client";

import Link from "next/link";
import { ArrowRight, Repeat2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DashboardHabit } from "@/types";

interface HabitRowProps {
  habit: DashboardHabit;
}

function HabitRow({ habit }: HabitRowProps) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      {/* Completion indicator */}
      <span
        className={cn(
          "h-4 w-4 rounded-full shrink-0 flex items-center justify-center border-2",
          habit.completed
            ? "bg-emerald-500 border-emerald-500"
            : "border-muted-foreground/30",
        )}
        aria-label={habit.completed ? "Completed" : "Pending"}
      >
        {habit.completed && (
          <svg
            className="h-2 w-2 text-white"
            viewBox="0 0 10 8"
            fill="none"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>

      {/* Name + streak */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm leading-snug truncate",
            habit.completed && "text-muted-foreground line-through",
          )}
        >
          {habit.name}
        </p>
        {habit.current_streak > 0 && (
          <p className="text-[10px] text-orange-500 font-medium">
            🔥 {habit.current_streak}d streak
          </p>
        )}
      </div>

      {/* Color dot from habit */}
      {habit.color && (
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: habit.color }}
        />
      )}
    </div>
  );
}

interface SprintHabitsPanelProps {
  habits: DashboardHabit[];
}

export function SprintHabitsPanel({ habits }: SprintHabitsPanelProps) {
  const list = habits ?? [];
  const completedCount = list.filter((h) => h.completed).length;

  // Show pending first, then completed
  const sorted = [...list].sort((a, b) => {
    if (a.completed === b.completed) return 0;
    return a.completed ? 1 : -1;
  });

  return (
    <Card>
      <CardHeader className="pb-2 pt-5 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Repeat2 className="h-4 w-4 text-violet-500" />
            Habits
          </CardTitle>
          {list.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {completedCount}/{list.length}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <Repeat2 className="h-6 w-6 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No habits today</p>
          </div>
        ) : (
          <>
            {/* Mini progress bar */}
            {list.length > 0 && (
              <div className="mb-3 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${Math.round((completedCount / list.length) * 100)}%`,
                  }}
                />
              </div>
            )}
            <div>
              {sorted.map((h) => (
                <HabitRow key={h.id} habit={h} />
              ))}
            </div>
          </>
        )}

        <div className="flex justify-end pt-3">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="gap-1 text-xs text-muted-foreground h-7"
          >
            <Link href="/habits">
              All habits
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
