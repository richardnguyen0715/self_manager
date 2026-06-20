"use client";

import { useMemo } from "react";
import {
  CheckSquare,
  Repeat2,
  CalendarDays,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardResponse } from "@/types";
import type { DashboardPanel } from "../types";
import { useDashboardUIStore } from "../store";
import { TodayTasksPanel } from "./TodayTasksPanel";
import { TodayHabitsPanel } from "./TodayHabitsPanel";
import { TodayEventsPanel } from "./TodayEventsPanel";
import { TodayTimeBlocksPanel } from "./TodayTimeBlocksPanel";

interface TabConfig {
  id: DashboardPanel;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

interface TodayPanelProps {
  summary: DashboardResponse;
}

export function TodayPanel({ summary }: TodayPanelProps) {
  const { activePanel, setActivePanel } = useDashboardUIStore();

  const tasks = summary.tasks ?? [];
  const habits = summary.habits ?? [];
  const events = summary.events ?? [];
  const timeBlocks = summary.time_blocks ?? [];

  const tabs: TabConfig[] = useMemo(
    () => [
      {
        id: "tasks",
        label: "Tasks",
        icon: CheckSquare,
        count: tasks.filter(
          (t) => t.status !== "completed" && t.status !== "archived",
        ).length,
      },
      {
        id: "habits",
        label: "Habits",
        icon: Repeat2,
        count: habits.length,
      },
      {
        id: "events",
        label: "Events",
        icon: CalendarDays,
        count: events.length,
      },
      {
        id: "time-blocks",
        label: "Time Blocks",
        icon: Clock,
        count: timeBlocks.length,
      },
    ],
    [tasks, habits, events, timeBlocks],
  );

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3 pt-5">
        <CardTitle className="text-base font-semibold">Today</CardTitle>
      </CardHeader>

      {/* Tab bar */}
      <div
        className="flex gap-1 overflow-x-auto border-b px-4 pb-0 [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Today panel sections"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activePanel === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => setActivePanel(tab.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 px-2.5 py-2.5 text-sm font-medium transition-colors sm:px-3",
                "text-muted-foreground hover:text-foreground",
                isActive &&
                  "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:rounded-full after:bg-primary",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={cn(
                    "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <CardContent className="flex-1 pt-4">
        <div
          role="tabpanel"
          id={`panel-tasks`}
          aria-labelledby="tab-tasks"
          hidden={activePanel !== "tasks"}
        >
          {activePanel === "tasks" && (
            <TodayTasksPanel tasks={tasks} />
          )}
        </div>

        <div
          role="tabpanel"
          id="panel-habits"
          aria-labelledby="tab-habits"
          hidden={activePanel !== "habits"}
        >
          {activePanel === "habits" && (
            <TodayHabitsPanel habits={habits} />
          )}
        </div>

        <div
          role="tabpanel"
          id="panel-events"
          aria-labelledby="tab-events"
          hidden={activePanel !== "events"}
        >
          {activePanel === "events" && (
            <TodayEventsPanel events={events} />
          )}
        </div>

        <div
          role="tabpanel"
          id="panel-time-blocks"
          aria-labelledby="tab-time-blocks"
          hidden={activePanel !== "time-blocks"}
        >
          {activePanel === "time-blocks" && (
            <TodayTimeBlocksPanel blocks={timeBlocks} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
