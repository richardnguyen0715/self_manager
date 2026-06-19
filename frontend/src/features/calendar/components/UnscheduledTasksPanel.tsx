"use client";

import { useState } from "react";
import { GripVertical, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { TaskListItem } from "@/types";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useUnscheduledTasks } from "../hooks/useCalendarTasks";

// ─── Draggable Task Row ───────────────────────────────────────────────────────

interface DraggableTaskRowProps {
  task: TaskListItem;
}

function DraggableTaskRow({ task }: DraggableTaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task-drag-${task.id}`,
    data: { type: "task", task },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? "grabbing" : "grab",
  };

  const priorityVariantMap = {
    critical: "critical",
    high: "high",
    medium: "medium",
    low: "low",
  } as const;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent group select-none",
        "transition-colors",
      )}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground shrink-0 group-hover:text-foreground" />
      <span className="flex-1 truncate text-xs">{task.title}</span>
      <Badge
        variant={priorityVariantMap[task.priority]}
        className="text-[10px] px-1.5 py-0 shrink-0"
      >
        {task.priority[0].toUpperCase()}
      </Badge>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function UnscheduledTasksPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const { data: tasks, isLoading } = useUnscheduledTasks();

  return (
    <div className="w-full lg:w-52 shrink-0 border-t lg:border-t-0 lg:border-l flex flex-col bg-background">
      {/* Panel header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-1 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors border-b select-none"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        Unscheduled
        {!isLoading && tasks && (
          <span className="ml-auto text-muted-foreground">
            {tasks.length}
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto px-1 py-1 max-h-48 lg:max-h-none">
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && (!tasks || tasks.length === 0) && (
            <p className="text-xs text-muted-foreground text-center py-4 px-2">
              All tasks are scheduled.
            </p>
          )}

          {tasks?.map((task) => (
            <DraggableTaskRow key={task.id} task={task} />
          ))}
        </div>
      )}

      {!collapsed && (
        <p className="text-[10px] text-muted-foreground px-3 py-2 border-t hidden lg:block">
          Drag a task onto the calendar to create a time block.
        </p>
      )}
    </div>
  );
}
