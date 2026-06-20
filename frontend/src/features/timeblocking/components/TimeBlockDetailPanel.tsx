"use client";

import { X, Clock, Link as LinkIcon, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatTime, formatDate } from "@/lib/utils";
import type { TimeBlock } from "@/types";
import { useDeleteTimeBlock } from "../hooks/useTimeBlocks";
import { useTimeBlockingStore } from "../timeblocking.store";
import { FocusLaunchButton } from "./FocusSessionPanel";
import { useConfirm } from "@/components/ui/confirm-dialog";

// ─── Props ────────────────────────────────────────────────────────────────────

interface TimeBlockDetailPanelProps {
  block: TimeBlock;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TimeBlockDetailPanel({ block }: TimeBlockDetailPanelProps) {
  const { openEditor, setSelectedBlockId } = useTimeBlockingStore();
  const deleteBlock = useDeleteTimeBlock();
  const confirm = useConfirm();

  const durationMin = Math.round(
    (new Date(block.end_time).getTime() - new Date(block.start_time).getTime()) /
      60000,
  );

  async function handleDelete() {
    if (
      !(await confirm({
        title: `Delete "${block.title}"?`,
        description: "This cannot be undone.",
        confirmText: "Delete",
        destructive: true,
      }))
    )
      return;
    deleteBlock.mutate(block.id, {
      onSuccess: () => setSelectedBlockId(null),
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <span className="text-sm font-semibold">Block details</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => openEditor(block)}
            aria-label="Edit block"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={deleteBlock.isPending}
            aria-label="Delete block"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSelectedBlockId(null)}
            aria-label="Close detail panel"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        {/* Title */}
        <h2 className="text-base font-semibold leading-snug">{block.title}</h2>

        <Separator />

        {/* Time */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Time
          </p>
          <div className="flex items-center gap-1.5 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>
              {formatTime(block.start_time)} – {formatTime(block.end_time)}
            </span>
            <span className="text-muted-foreground text-xs">
              ({durationMin}m)
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDate(block.start_time)}
          </p>
        </div>

        {/* Actual times (if the session has started) */}
        {(block.actual_start != null || block.actual_end != null) && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Actual times
            </p>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                {block.actual_start ? formatTime(block.actual_start) : "—"}
                {" – "}
                {block.actual_end ? formatTime(block.actual_end) : "ongoing"}
              </span>
            </div>
          </div>
        )}

        {/* Linked task */}
        {block.task_id && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Linked task
            </p>
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground truncate">
                Task ID: {block.task_id}
              </p>
            </div>
          </div>
        )}

        {/* Color swatch */}
        {block.color && (
          <div className="flex items-center gap-2">
            <span
              className="h-4 w-4 rounded-full border"
              style={{ backgroundColor: block.color }}
            />
            <span className="text-xs text-muted-foreground">{block.color}</span>
          </div>
        )}

        <Separator />

        {/* Focus session launcher */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Focus session
          </p>
          <FocusLaunchButton
            timeBlockId={block.id}
            taskId={block.task_id}
          />
        </div>
      </div>
    </div>
  );
}
