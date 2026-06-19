"use client";

import { useState, useCallback } from "react";
import { Search, X, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFocusStore } from "../store";
import { useActiveTasks } from "../hooks/useLinkedTasks";
import type { TaskListItem } from "@/types";

const PRIORITY_LABEL: Record<TaskListItem["priority"], string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function TaskLinker() {
  const linkedTask = useFocusStore((s) => s.linkedTask);
  const phase = useFocusStore((s) => s.phase);
  const linkTask = useFocusStore((s) => s.linkTask);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: tasks = [], isLoading } = useActiveTasks(search || undefined);

  const isDisabled = phase === "work" || phase === "break";

  const handleSelect = useCallback(
    (task: TaskListItem) => {
      linkTask(task);
      setOpen(false);
      setSearch("");
    },
    [linkTask],
  );

  const handleClear = useCallback(() => {
    linkTask(null);
  }, [linkTask]);

  return (
    <>
      {linkedTask ? (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate font-medium">{linkedTask.title}</span>
          <Badge
            variant={linkedTask.priority as "critical" | "high" | "medium" | "low"}
            className="shrink-0 text-xs"
          >
            {PRIORITY_LABEL[linkedTask.priority]}
          </Badge>
          {!isDisabled && (
            <button
              onClick={handleClear}
              className="ml-1 rounded-sm opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Remove linked task"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-muted-foreground"
          disabled={isDisabled}
          onClick={() => setOpen(true)}
        >
          <Link2 className="h-4 w-4" />
          Link a task
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-w-sm sm:w-full">
          <DialogHeader>
            <DialogTitle>Link a task</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {isLoading && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Loading...
              </p>
            )}
            {!isLoading && tasks.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No active tasks found.
              </p>
            )}
            {tasks.map((task) => (
              <button
                key={task.id}
                onClick={() => handleSelect(task)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors",
                  "hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                )}
              >
                <span className="flex-1 font-medium leading-snug">
                  {task.title}
                </span>
                <Badge
                  variant={task.priority as "critical" | "high" | "medium" | "low"}
                  className="shrink-0 text-xs"
                >
                  {PRIORITY_LABEL[task.priority]}
                </Badge>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
