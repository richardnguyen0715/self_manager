import { format } from "date-fns";
import { Clock, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardTimeBlock } from "@/types";

interface TimeBlockItemProps {
  block: DashboardTimeBlock;
}

export function TimeBlockItem({ block }: TimeBlockItemProps) {
  const start = new Date(block.start_time);
  const end = new Date(block.end_time);
  // A block is "completed" if actual focus minutes have been recorded
  const isCompleted =
    block.actual_focus_minutes != null && block.actual_focus_minutes > 0;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent/50",
        isCompleted && "opacity-60",
      )}
    >
      {/* Status icon */}
      <div className="mt-0.5 shrink-0 text-muted-foreground">
        {isCompleted ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm text-foreground",
            isCompleted && "line-through",
          )}
        >
          {block.title}
        </p>

        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(start, "h:mm a")} – {format(end, "h:mm a")}
          </span>
          <span>{block.estimated_minutes}m</span>
          {block.task_title && (
            <span className="truncate text-[11px] text-muted-foreground/70">
              {block.task_title}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
