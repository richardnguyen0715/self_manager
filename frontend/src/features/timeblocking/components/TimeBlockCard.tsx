"use client";

import { useState } from "react";
import {
  Clock,
  Pencil,
  Trash2,
  Play,
  Link as LinkIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TimeBlockSummary } from "@/types";
import { useDeleteTimeBlock } from "../hooks/useTimeBlocks";
import { useTimeBlockingStore } from "../timeblocking.store";

// ─── Props ────────────────────────────────────────────────────────────────────

interface TimeBlockCardProps {
  block: TimeBlockSummary;
  /** Top offset in pixels relative to the grid container */
  top: number;
  /** Height in pixels */
  height: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function blockColor(block: TimeBlockSummary): string {
  if (block.color) return "";
  return "bg-blue-50 border-blue-400 dark:bg-blue-900/20 dark:border-blue-500";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TimeBlockCard({ block, top, height }: TimeBlockCardProps) {
  const [hovered, setHovered] = useState(false);

  const { setSelectedBlockId } = useTimeBlockingStore();
  const deleteBlock = useDeleteTimeBlock();

  const compact = height < 48; // not enough room to show detail rows

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation();
    // Select the block — the detail panel will load the full TimeBlock and offer edit
    setSelectedBlockId(block.id);
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (confirm(`Delete "${block.title}"?`)) {
      deleteBlock.mutate(block.id);
    }
  }

  function handleStartFocus(e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedBlockId(block.id);
  }

  const style: React.CSSProperties = {
    top,
    height: Math.max(height, 20),
    ...(block.color
      ? { backgroundColor: `${block.color}20`, borderLeftColor: block.color }
      : {}),
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Time block: ${block.title}`}
      className={cn(
        "absolute left-0 right-1 rounded-md border-l-4 px-2 py-1 cursor-pointer select-none",
        "transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        blockColor(block),
      )}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setSelectedBlockId(block.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setSelectedBlockId(block.id);
      }}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-1">
        <span className="text-xs font-semibold leading-tight line-clamp-2 flex-1">
          {block.title}
        </span>

        {/* Action buttons - visible on hover */}
        {hovered && (
          <div className="flex items-center gap-0.5 shrink-0 -mt-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={handleStartFocus}
                >
                  <Play className="h-3 w-3 text-blue-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Start focus session</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={handleEdit}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Edit</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={handleDelete}
                  disabled={deleteBlock.isPending}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Delete</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Detail rows – hidden when card is too short */}
      {!compact && (
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Clock className="h-2.5 w-2.5" />
            {formatTime(block.start_time)} – {formatTime(block.end_time)}
          </span>

          {block.task_id && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <LinkIcon className="h-2.5 w-2.5 shrink-0" />
              linked
            </span>
          )}
        </div>
      )}
    </div>
  );
}
