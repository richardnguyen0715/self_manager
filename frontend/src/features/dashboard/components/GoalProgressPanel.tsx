"use client";

import Link from "next/link";
import { Target, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GoalProgress } from "@/types";

interface GoalProgressPanelProps {
  goals: GoalProgress[];
}

function GoalProgressRow({ goal }: { goal: GoalProgress }) {
  const pct = Math.min(100, Math.max(0, Math.round(goal.completion_rate * 100)));
  const color =
    pct >= 80
      ? "bg-emerald-500"
      : pct >= 40
        ? "bg-primary"
        : "bg-amber-500";

  return (
    <div className="space-y-1.5 py-2 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium truncate leading-snug">{goal.title}</p>
        <span className="text-xs tabular-nums text-muted-foreground shrink-0">
          {pct}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function GoalProgressPanel({ goals }: GoalProgressPanelProps) {
  const list = goals ?? [];

  return (
    <Card>
      <CardHeader className="pb-2 pt-5 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          Goal Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <p className="text-xs text-muted-foreground">No goals yet</p>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/goals">Create a goal</Link>
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {list.map((g) => (
              <GoalProgressRow key={g.goal_id} goal={g} />
            ))}
          </div>
        )}
        {list.length > 0 && (
          <div className="flex justify-end pt-3">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="gap-1 text-xs text-muted-foreground h-7"
            >
              <Link href="/goals">
                All goals
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
