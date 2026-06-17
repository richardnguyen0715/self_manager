"use client";

import { Clock, Play, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/utils";
import type { TimeBlockSummary } from "@/types";
import { useDeleteTimeBlock } from "../hooks/useTimeBlocks";
import { useTimeBlockingStore } from "../timeblocking.store";

interface TimeBlockListProps {
  blocks: TimeBlockSummary[];
}

/**
 * Compact list view of time blocks for a given day.
 * Used as a sidebar complement to the grid.
 */
export function TimeBlockList({ blocks }: TimeBlockListProps) {
  const { setSelectedBlockId } = useTimeBlockingStore();
  const deleteBlock = useDeleteTimeBlock();

  if (blocks.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No blocks for this day. Drag on the grid or click + to create one.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {blocks.map((block) => {
        const durationMin = Math.round(
          (new Date(block.end_time).getTime() -
            new Date(block.start_time).getTime()) /
            60000,
        );

        return (
          <li
            key={block.id}
            className={cn(
              "group flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer",
              "hover:bg-accent/50 transition-colors",
            )}
            onClick={() => setSelectedBlockId(block.id)}
          >
            {/* Color indicator */}
            <span
              className="shrink-0 h-3 w-3 rounded-full border"
              style={block.color ? { backgroundColor: block.color } : {}}
            />

            {/* Title + meta */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{block.title}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" />
                  {formatTime(block.start_time)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  · {durationMin}m
                </span>
              </div>
            </div>

            {/* Actions - show on hover */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBlockId(block.id);
                    }}
                  >
                    <Play className="h-3 w-3 text-blue-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Focus</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Select block; edit from detail panel (which has full TimeBlock)
                      setSelectedBlockId(block.id);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Edit</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${block.title}"?`)) {
                        deleteBlock.mutate(block.id);
                      }
                    }}
                    disabled={deleteBlock.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Delete</TooltipContent>
              </Tooltip>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
