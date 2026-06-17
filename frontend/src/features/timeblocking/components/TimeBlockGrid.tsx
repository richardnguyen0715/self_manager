"use client";

import { useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/utils";
import type { TimeBlockSummary } from "@/types";
import { TimeBlockCard } from "./TimeBlockCard";
import { useTimeBlockingStore } from "../timeblocking.store";

// ─── Layout constants ─────────────────────────────────────────────────────────

/** Pixel height for one hour row. */
const PX_PER_HOUR = 72;
const PX_PER_MINUTE = PX_PER_HOUR / 60;

/** Hours shown in the grid (0–23). */
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minutesFromMidnight(isoDatetime: string): number {
  const d = new Date(isoDatetime);
  return d.getHours() * 60 + d.getMinutes();
}

function toLocalISOString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

/**
 * Snap minutes to nearest 15-minute boundary.
 */
function snapTo15(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TimeBlockGridProps {
  /** All blocks for the displayed day. */
  blocks: TimeBlockSummary[];
  /** YYYY-MM-DD of the day being shown. */
  date: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TimeBlockGrid({ blocks, date }: TimeBlockGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartMinute = useRef<number>(0);

  const { setDraftBlock, draftBlock, openEditor } = useTimeBlockingStore();

  // ── Drag-to-create ──────────────────────────────────────────────────────────

  const getMinuteFromY = useCallback((clientY: number): number => {
    if (!gridRef.current) return 0;
    const rect = gridRef.current.getBoundingClientRect();
    const relativeY = clientY - rect.top + gridRef.current.scrollTop;
    const raw = relativeY / PX_PER_MINUTE;
    return Math.max(0, Math.min(1440, snapTo15(raw)));
  }, []);

  const minuteToIso = useCallback(
    (minutes: number): string => {
      const [year, month, day] = date.split("-").map(Number);
      const d = new Date(year, month - 1, day, Math.floor(minutes / 60), minutes % 60);
      return toLocalISOString(d);
    },
    [date],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only on the grid background, not on a card
      if ((e.target as HTMLElement).closest("[data-timeblock-card]")) return;
      if (e.button !== 0) return;

      const startMin = getMinuteFromY(e.clientY);
      dragStartY.current = e.clientY;
      dragStartMinute.current = startMin;

      setDraftBlock({
        title: "New block",
        task_id: null,
        start_time: minuteToIso(startMin),
        end_time: minuteToIso(startMin + 60),
      });
    },
    [getMinuteFromY, minuteToIso, setDraftBlock],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (dragStartY.current === null || !draftBlock) return;

      const currentMin = getMinuteFromY(e.clientY);
      const startMin = dragStartMinute.current;
      const endMin = Math.max(startMin + 15, currentMin);

      setDraftBlock({
        ...draftBlock,
        start_time: minuteToIso(startMin),
        end_time: minuteToIso(endMin),
      });
    },
    [draftBlock, getMinuteFromY, minuteToIso, setDraftBlock],
  );

  const handleMouseUp = useCallback(() => {
    if (dragStartY.current === null || !draftBlock) return;
    dragStartY.current = null;

    // Open editor pre-filled with draft
    openEditor(undefined);
    // Store already has the draft; editor reads it
  }, [draftBlock, openEditor]);

  // ── Current-time indicator ──────────────────────────────────────────────────

  const nowMinutes = (() => {
    const now = new Date();
    const today = new Date().toISOString().split("T")[0];
    if (date !== today) return null;
    return now.getHours() * 60 + now.getMinutes();
  })();

  // ── Position blocks ─────────────────────────────────────────────────────────

  const positionedBlocks = blocks.map((b) => {
    const startMin = minutesFromMidnight(b.start_time);
    const endMin = minutesFromMidnight(b.end_time);
    return {
      block: b,
      top: startMin * PX_PER_MINUTE,
      height: Math.max((endMin - startMin) * PX_PER_MINUTE, 20),
    };
  });

  // Position draft block
  const draftTop = draftBlock
    ? minutesFromMidnight(draftBlock.start_time) * PX_PER_MINUTE
    : 0;
  const draftHeight = draftBlock
    ? Math.max(
        (minutesFromMidnight(draftBlock.end_time) -
          minutesFromMidnight(draftBlock.start_time)) *
          PX_PER_MINUTE,
        20,
      )
    : 0;
  const draftDurationMin = draftBlock
    ? Math.round(
        (new Date(draftBlock.end_time).getTime() -
          new Date(draftBlock.start_time).getTime()) /
          60000,
      )
    : 0;

  return (
    <div className="flex overflow-auto h-full" style={{ maxHeight: "calc(100vh - 180px)" }}>
      {/* Hour labels column */}
      <div className="sticky left-0 z-10 w-14 shrink-0 bg-background border-r select-none">
        {HOURS.map((h) => (
          <div
            key={h}
            className="relative flex items-start justify-end pr-2"
            style={{ height: PX_PER_HOUR }}
          >
            <span className="text-[10px] text-muted-foreground leading-none -translate-y-1/2">
              {h === 0
                ? "12 AM"
                : h < 12
                ? `${h} AM`
                : h === 12
                ? "12 PM"
                : `${h - 12} PM`}
            </span>
          </div>
        ))}
      </div>

      {/* Grid body */}
      <div
        ref={gridRef}
        className="relative flex-1 cursor-crosshair"
        style={{ height: 24 * PX_PER_HOUR }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Hour grid lines */}
        {HOURS.map((h) => (
          <div
            key={h}
            className="absolute left-0 right-0 border-t border-border/50"
            style={{ top: h * PX_PER_HOUR }}
          />
        ))}

        {/* 30-minute grid lines */}
        {HOURS.map((h) => (
          <div
            key={`${h}-half`}
            className="absolute left-0 right-0 border-t border-border/20 border-dashed"
            style={{ top: h * PX_PER_HOUR + PX_PER_HOUR / 2 }}
          />
        ))}

        {/* Current time indicator */}
        {nowMinutes !== null && (
          <div
            className="absolute left-0 right-0 z-20 pointer-events-none"
            style={{ top: nowMinutes * PX_PER_MINUTE }}
          >
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-red-500 -ml-1" />
              <div className="flex-1 border-t-2 border-red-500" />
            </div>
          </div>
        )}

        {/* Time block cards */}
        {positionedBlocks.map(({ block, top, height }) => (
          <div key={block.id} data-timeblock-card="true" className="absolute left-2 right-2">
            <TimeBlockCard block={block} top={top} height={height} />
          </div>
        ))}

        {/* Draft block (drag preview) */}
        {draftBlock && (
          <div
            className="absolute left-2 right-2 rounded-md border-l-4 border-blue-500 bg-blue-100/70 dark:bg-blue-900/30 px-2 py-1 pointer-events-none opacity-80"
            style={{ top: draftTop, height: Math.max(draftHeight, 20) }}
          >
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
              {draftDurationMin > 0 ? `${draftDurationMin}m` : "New block"}
            </span>
            <div className="text-[10px] text-blue-600 dark:text-blue-400">
              {formatTime(draftBlock.start_time)} – {formatTime(draftBlock.end_time)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
