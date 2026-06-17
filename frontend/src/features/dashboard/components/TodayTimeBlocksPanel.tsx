"use client";

import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import type { DashboardTimeBlock } from "@/types";
import { TimeBlockItem } from "./TimeBlockItem";

interface TodayTimeBlocksPanelProps {
  blocks: DashboardTimeBlock[];
}

export function TodayTimeBlocksPanel({ blocks }: TodayTimeBlocksPanelProps) {
  // Sort by start time ascending
  const sorted = [...blocks].sort(
    (a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  );

  return (
    <div className="flex flex-col gap-2">
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <Clock className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No time blocks scheduled</p>
          <p className="text-xs text-muted-foreground/60">
            Plan your day with time blocks.
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-[400px]">
          <div className="flex flex-col gap-0.5">
            {sorted.map((b) => (
              <TimeBlockItem key={b.id} block={b} />
            ))}
          </div>
        </ScrollArea>
      )}

      <div className="flex justify-end pt-1">
        <Button variant="ghost" size="sm" asChild className="gap-1 text-xs text-muted-foreground">
          <Link href="/timeblocking">
            Plan my day
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
