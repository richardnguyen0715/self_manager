"use client";

import Link from "next/link";
import { ArrowRight, InboxIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { DashboardTask } from "@/types";
import { TodayTaskItem } from "./TodayTaskItem";
import { QuickCreateTaskForm } from "./QuickCreateTaskForm";

interface TodayTasksPanelProps {
  tasks: DashboardTask[];
}

export function TodayTasksPanel({ tasks }: TodayTasksPanelProps) {
  const pending = tasks.filter(
    (t) => t.status !== "completed" && t.status !== "archived",
  );
  const completed = tasks.filter((t) => t.status === "completed");

  return (
    <div className="flex flex-col gap-2">
      {/* Quick-create */}
      <QuickCreateTaskForm />

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <InboxIcon className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No tasks due today</p>
          <p className="text-xs text-muted-foreground/60">
            Add a task above or go to Tasks to plan your day.
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-[360px]">
          <div className="flex flex-col gap-0.5">
            {pending.map((task) => (
              <TodayTaskItem key={task.id} task={task} />
            ))}

            {completed.length > 0 && (
              <>
                <Separator className="my-2" />
                <p className="px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Completed ({completed.length})
                </p>
                {completed.map((task) => (
                  <TodayTaskItem key={task.id} task={task} />
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      )}

      <div className="flex justify-end pt-1">
        <Button variant="ghost" size="sm" asChild className="gap-1 text-xs text-muted-foreground">
          <Link href="/tasks">
            All tasks
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
