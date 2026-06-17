"use client";

import { Timer, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useFocusStats } from "../hooks/useFocusStats";

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function FocusStatsPanel() {
  const { data: stats, isLoading } = useFocusStats();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Focus Statistics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sessions today */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
            <Target className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Sessions today</p>
            {isLoading ? (
              <div className="h-5 w-20 animate-pulse rounded bg-muted" />
            ) : (
              <p className="text-sm font-semibold">
                {stats?.sessions_today ?? 0}
                <span className="ml-1 font-normal text-muted-foreground">
                  session{stats?.sessions_today !== 1 ? "s" : ""}
                </span>
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Focus minutes today */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
            <Timer className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Focus time today</p>
            {isLoading ? (
              <div className="h-5 w-20 animate-pulse rounded bg-muted" />
            ) : (
              <p className="text-sm font-semibold">
                {stats?.focus_minutes_today != null && stats.focus_minutes_today > 0
                  ? formatMinutes(stats.focus_minutes_today)
                  : "0m"}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
