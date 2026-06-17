"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import type { DashboardEvent } from "@/types";
import { CalendarEventItem } from "./CalendarEventItem";

interface TodayEventsPanelProps {
  events: DashboardEvent[];
}

export function TodayEventsPanel({ events }: TodayEventsPanelProps) {
  // Sort by start time ascending
  const sorted = [...events].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  );

  return (
    <div className="flex flex-col gap-2">
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No events today</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[400px]">
          <div className="flex flex-col gap-0.5">
            {sorted.map((e) => (
              <CalendarEventItem key={e.id} event={e} />
            ))}
          </div>
        </ScrollArea>
      )}

      <div className="flex justify-end pt-1">
        <Button variant="ghost" size="sm" asChild className="gap-1 text-xs text-muted-foreground">
          <Link href="/calendar">
            Open calendar
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
