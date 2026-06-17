"use client";

import {
  ChevronRight,
  FolderOpen,
  Folder,
  CheckCircle2,
  Circle,
  Plus,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate, isOverdue } from "@/lib/utils";
import type { Goal, GoalProjectSummary, TaskListItem, TaskStatus } from "@/types";
import { useGoalProjects, useProjectTasks } from "../hooks/useGoals";
import { useGoalsStore } from "../store/goals.store";
import { GoalProgressBar } from "./GoalProgressBar";

// ─── Task Row ──────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: TaskListItem;
}

function TaskRow({ task }: TaskRowProps) {
  const isCompleted =
    task.status === "completed" || task.status === "archived";
  const overdueFlag = isOverdue(task.due_date) && !isCompleted;

  const PRIORITY_DOT: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    low: "bg-blue-400",
  };

  return (
    <li className="flex items-center gap-2 py-1 px-2 rounded hover:bg-accent/40 transition-colors group">
      {/* Completion icon */}
      {isCompleted ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}

      {/* Priority dot */}
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          PRIORITY_DOT[task.priority] ?? "bg-muted",
        )}
        title={`Priority: ${task.priority}`}
      />

      {/* Title */}
      <span
        className={cn(
          "flex-1 text-sm truncate",
          isCompleted && "line-through text-muted-foreground",
        )}
      >
        {task.title}
      </span>

      {/* Due date */}
      {task.due_date && (
        <span
          className={cn(
            "text-xs tabular-nums shrink-0",
            overdueFlag
              ? "text-destructive font-medium"
              : "text-muted-foreground",
          )}
        >
          {formatDate(task.due_date)}
        </span>
      )}
    </li>
  );
}

// ─── Project Row ───────────────────────────────────────────────────────────────

interface ProjectRowProps {
  project: GoalProjectSummary;
  goalId: string;
}

function ProjectRow({ project, goalId: _goalId }: ProjectRowProps) {
  const { expandedProjects, toggleProjectExpanded } = useGoalsStore();
  const isExpanded = Boolean(expandedProjects[project.id]);

  const { data: tasks = [], isLoading, isError } = useProjectTasks(
    project.id,
    isExpanded,
  );

  const completedTasks = tasks.filter(
    (t) => t.status === "completed",
  ).length;

  // Progress: if no tasks fetched yet, use the project's summary fields
  const totalFromSummary = project.progress.total_tasks;
  const completedFromSummary = project.progress.completed_tasks;
  const progressPct =
    isExpanded && tasks.length > 0
      ? Math.round((completedTasks / tasks.length) * 100)
      : totalFromSummary > 0
        ? Math.round((completedFromSummary / totalFromSummary) * 100)
        : 0;

  const displayTotal = isExpanded && tasks.length > 0
    ? tasks.length
    : totalFromSummary;
  const displayCompleted = isExpanded && tasks.length > 0
    ? completedTasks
    : completedFromSummary;

  return (
    <li>
      {/* Project header */}
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-accent/50 transition-colors cursor-pointer group"
        onClick={() => toggleProjectExpanded(project.id)}
        role="button"
        aria-expanded={isExpanded}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleProjectExpanded(project.id);
          }
        }}
      >
        {/* Expand chevron */}
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            isExpanded && "rotate-90",
          )}
        />

        {/* Folder icon */}
        {isExpanded ? (
          <FolderOpen
            className="h-4 w-4 shrink-0"
            style={{ color: project.color ?? undefined }}
          />
        ) : (
          <Folder
            className="h-4 w-4 shrink-0"
            style={{ color: project.color ?? undefined }}
          />
        )}

        {/* Name */}
        <span className="flex-1 text-sm font-medium truncate">
          {project.name}
        </span>

        {/* Task count */}
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {displayCompleted}/{displayTotal}
        </span>

        {/* Mini progress bar */}
        <div className="w-20 shrink-0">
          <GoalProgressBar value={progressPct} showLabel={false} size="sm" />
        </div>

        {/* Deadline */}
        {project.deadline && (
          <span
            className={cn(
              "text-xs tabular-nums shrink-0",
              isOverdue(project.deadline) && project.status !== "completed"
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {formatDate(project.deadline)}
          </span>
        )}
      </div>

      {/* Expanded task list */}
      {isExpanded && (
        <div className="ml-5 border-l border-border pl-3 mt-0.5 mb-1">
          {isLoading && (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading tasks…
            </div>
          )}
          {isError && (
            <div className="flex items-center gap-2 py-2 text-sm text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              Failed to load tasks
            </div>
          )}
          {!isLoading && !isError && tasks.length === 0 && (
            <p className="py-2 text-xs text-muted-foreground italic">
              No tasks yet in this project.
            </p>
          )}
          {tasks.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface GoalTreeViewProps {
  goal: Goal;
  onAddProject: (goalId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GoalTreeView({ goal, onAddProject }: GoalTreeViewProps) {
  const { data: projects = [], isLoading, isError } = useGoalProjects(goal.id);

  return (
    <div className="mt-2">
      {isLoading && (
        <div className="flex items-center gap-2 py-2 pl-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading projects…
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 py-2 pl-2 text-sm text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          Failed to load projects
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {projects.length === 0 ? (
            <p className="py-2 pl-2 text-xs text-muted-foreground italic">
              No projects attached to this goal yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {projects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  goalId={goal.id}
                />
              ))}
            </ul>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="mt-1 ml-1 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onAddProject(goal.id);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add project
          </Button>
        </>
      )}
    </div>
  );
}
