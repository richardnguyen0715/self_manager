"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  List,
  Grid3X3,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { TimeBlockSummary } from "@/types";
import { useTimeBlocks, useTimeBlock } from "../hooks/useTimeBlocks";
import { useTimeBlockingStore } from "../timeblocking.store";
import { TimeBlockGrid } from "./TimeBlockGrid";
import { TimeBlockList } from "./TimeBlockList";
import { TimeBlockEditor } from "./TimeBlockEditor";
import { FocusSessionPanel } from "./FocusSessionPanel";
import { TimeBlockDetailPanel } from "./TimeBlockDetailPanel";
import { DateNav } from "./DateNav";

// ─── Types ────────────────────────────────────────────────────────────────────

type Layout = "grid" | "list";

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div className="p-4 space-y-2 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-14 rounded-md bg-muted"
          style={{ opacity: 1 - i * 0.12 }}
        />
      ))}
    </div>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

interface StatsBarProps {
  total: number;
  totalMinutes: number;
}

function StatsBar({ total, totalMinutes }: StatsBarProps) {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  const timeLabel =
    totalMinutes === 0
      ? "0m"
      : hours > 0 && mins > 0
      ? `${hours}h ${mins}m`
      : hours > 0
      ? `${hours}h`
      : `${mins}m`;

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground select-none">
      <span>{total} blocks</span>
      <span>{timeLabel} scheduled</span>
    </div>
  );
}

// ─── Layout toggle sub-component ──────────────────────────────────────────────

interface LayoutToggleProps {
  layout: Layout;
  onChange: (l: Layout) => void;
}

function LayoutToggle({ layout, onChange }: LayoutToggleProps) {
  return (
    <div className="flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={layout === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => onChange("grid")}
            aria-label="Day grid view"
            aria-pressed={layout === "grid"}
          >
            <Grid3X3 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Day grid</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={layout === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => onChange("list")}
            aria-label="List view"
            aria-pressed={layout === "list"}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">List view</TooltipContent>
      </Tooltip>
    </div>
  );
}

// ─── Detail panel wrapper — fetches full TimeBlock by ID ─────────────────────

function DetailPanelLoader({ blockId }: { blockId: string }) {
  const { data, isLoading } = useTimeBlock(blockId);

  if (isLoading) {
    return (
      <aside className="w-72 shrink-0 rounded-lg border bg-card overflow-hidden flex flex-col">
        <div className="p-4 space-y-2 animate-pulse">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-1/2" />
          <div className="h-3 bg-muted rounded w-2/3" />
        </div>
      </aside>
    );
  }

  if (!data?.data) return null;

  return (
    <aside className="w-72 shrink-0 rounded-lg border bg-card overflow-hidden flex flex-col">
      <TimeBlockDetailPanel block={data.data} />
    </aside>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function TimeBlockingView() {
  const [layout, setLayout] = useState<Layout>("grid");

  const { selectedDate, selectedBlockId, openEditor } =
    useTimeBlockingStore();

  // Build from/to for the selected day (full day range in ISO8601)
  const from = `${selectedDate}T00:00:00.000Z`;
  const to = `${selectedDate}T23:59:59.999Z`;

  const { data, isLoading, isError, refetch, isFetching } = useTimeBlocks({
    from,
    to,
  });

  const blocks: TimeBlockSummary[] = data?.data?.items ?? [];

  // Aggregate stats
  const stats = useMemo<StatsBarProps>(() => {
    const totalMinutes = blocks.reduce((sum, b) => {
      const diffMs =
        new Date(b.end_time).getTime() - new Date(b.start_time).getTime();
      return sum + Math.round(diffMs / 60000);
    }, 0);
    return { total: blocks.length, totalMinutes };
  }, [blocks]);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* ── Top toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 shrink-0">
        <DateNav />

        <div className="flex items-center gap-2">
          <StatsBar {...stats} />

          <Separator orientation="vertical" className="h-5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => refetch()}
                disabled={isFetching}
                aria-label="Refresh blocks"
              >
                <RefreshCw
                  className={cn(
                    "h-3.5 w-3.5",
                    isFetching && "animate-spin",
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Refresh</TooltipContent>
          </Tooltip>

          <Button
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => openEditor(undefined)}
          >
            <Plus className="h-3.5 w-3.5" />
            New block
          </Button>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      {isError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Failed to load time blocks.</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 text-xs"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      {/* ── Body: main content + optional detail panel ───────────────────────── */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* Primary panel */}
        <div className="flex-1 flex flex-col min-w-0 rounded-lg border bg-card overflow-hidden">
          {/* Panel header with layout toggle */}
          <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </span>
            <LayoutToggle layout={layout} onChange={setLayout} />
          </div>

          {/* Loading / content */}
          <div className="flex-1 overflow-hidden">
            {isLoading ? (
              <GridSkeleton />
            ) : layout === "grid" ? (
              <TimeBlockGrid blocks={blocks} date={selectedDate} />
            ) : (
              <div className="overflow-auto h-full p-4">
                <TimeBlockList blocks={blocks} />
              </div>
            )}
          </div>
        </div>

        {/* Detail panel — fetches full TimeBlock when a summary is selected */}
        {selectedBlockId && (
          <DetailPanelLoader blockId={selectedBlockId} />
        )}
      </div>

      {/* ── Overlays ─────────────────────────────────────────────────────────── */}
      <TimeBlockEditor />
      <FocusSessionPanel />
    </div>
  );
}
