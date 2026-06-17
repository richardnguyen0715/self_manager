"use client";

import Link from "next/link";
import { ArrowRight, Smile } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import type { DashboardHabit } from "@/types";
import { HabitItem } from "./HabitItem";

interface TodayHabitsPanelProps {
  habits: DashboardHabit[];
}

export function TodayHabitsPanel({ habits }: TodayHabitsPanelProps) {
  const pending = habits.filter((h) => !h.completed);
  const done = habits.filter((h) => h.completed);
  const completedCount = done.length;

  return (
    <div className="flex flex-col gap-2">
      {habits.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <Smile className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No habits scheduled today</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[400px]">
          <div className="flex flex-col gap-0.5">
            {pending.map((h) => (
              <HabitItem key={h.id} habit={h} />
            ))}
            {done.map((h) => (
              <HabitItem key={h.id} habit={h} />
            ))}
          </div>
        </ScrollArea>
      )}

      {habits.length > 0 && (
        <p className="px-3 text-xs text-muted-foreground">
          {completedCount}/{habits.length} habits completed
        </p>
      )}

      <div className="flex justify-end pt-1">
        <Button variant="ghost" size="sm" asChild className="gap-1 text-xs text-muted-foreground">
          <Link href="/habits">
            All habits
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
