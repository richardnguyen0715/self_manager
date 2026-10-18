"use client";

/**
 * WorkItemRow — one row in a sprint or backlog section.
 * Matches the Jira backlog row: type icon | title | status pill | story pts | due date | actions.
 */

import { format, isPast, isToday } from "date-fns";
import {
  MoreHorizontal,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Calendar,
  GripVertical,
  FolderInput,
  Check,
} from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { useDraggable } from "@dnd-kit/core";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ItemKeyChip } from "@/components/ui/item-key-chip";
import { cn } from "@/lib/utils";
import type { WorkItemListItem, Sprint } from "@/types";
import { WorkItemTypeBadge } from "@/features/agile/components/WorkItemTypeBadge";
import { WorkItemStatusBadge } from "@/features/agile/components/WorkItemStatusBadge";
import {
  useMoveWorkItemToSprint,
  useMoveWorkItemToBacklog,
  useDeleteWorkItem,
  useUpdateWorkItem,
} from "@/features/agile";
import { useProjects } from "@/features/tasks/hooks/useProjects";
import { useConfirm } from "@/components/ui/confirm-dialog";

// ─── Priority dot ─────────────────────────────────────────────────────────────

const PRIORITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-400",
};

const PRIORITY_LABEL: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

// ─── Due date helper ──────────────────────────────────────────────────────────

function DueDateLabel({ dateStr }: { dateStr: string }) {
  const date = new Date(dateStr);
  const overdue = isPast(date) && !isToday(date);
  const today = isToday(date);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs tabular-nums whitespace-nowrap",
        overdue
          ? "text-red-600 dark:text-red-400 font-medium"
          : today
            ? "text-amber-600 dark:text-amber-400 font-medium"
            : "text-muted-foreground",
      )}
    >
      <Calendar className="h-3 w-3 shrink-0" />
      {today ? "Today" : format(date, "MMM d")}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface WorkItemRowProps {
  item: WorkItemListItem;
  /** If provided, row is inside a sprint section (shows "Move to Backlog" action) */
  sprintId?: string;
  /** All available sprints for "Move to Sprint" submenu */
  sprints?: Sprint[];
  /** Sprint id this item is currently in (for exclusion from move targets) */
  currentSprintId?: string | null;
}

export function WorkItemRow({
  item,
  sprintId,
  sprints = [],
  currentSprintId,
}: WorkItemRowProps) {
  const moveToSprint = useMoveWorkItemToSprint(item.id);
  const moveToBacklog = useMoveWorkItemToBacklog(item.id);
  const deleteItem = useDeleteWorkItem();
  const updateItem = useUpdateWorkItem(item.id);
  const { data: projects = [] } = useProjects();
  const confirm = useConfirm();

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { type: "backlog-item", itemId: item.id, fromSprintId: sprintId ?? null },
  });

  const isInSprint = Boolean(sprintId);

  // Sprints this item can be moved TO (exclude current)
  const movableTargets = sprints.filter(
    (s) => s.id !== currentSprintId && s.status !== "completed",
  );

  async function handleDelete() {
    if (
      !(await confirm({
        title: `Delete "${item.title}"?`,
        description: "This cannot be undone.",
        confirmText: "Delete",
        destructive: true,
      }))
    )
      return;
    deleteItem.mutate(item.id);
  }

  function handleAssignProject(projectId: string | null) {
    if ((item.project_id ?? null) === projectId) return; // no-op
    updateItem.mutate({ project_id: projectId });
  }

  const hasSubtasks = (item.subtask_count ?? 0) > 0;
  const subtaskPct =
    hasSubtasks
      ? Math.round(((item.done_subtask_count ?? 0) / item.subtask_count) * 100)
      : 0;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "group flex items-center gap-2 px-4 py-2 hover:bg-accent/40 transition-colors cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      {/* Drag handle (visual cue — whole row is draggable) */}
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />

      {/* Type icon */}
      <WorkItemTypeBadge type={item.type} className="shrink-0" />

      {/* Title — navigates to detail page */}
      <Link
        href={`/work-items/${item.id}`}
        draggable={false}
        className="flex-1 min-w-0 text-sm font-medium truncate hover:text-primary transition-colors"
        title={item.title}
      >
        <ItemKeyChip itemKey={item.key} className="mr-1.5 align-middle" />
        {item.title}
      </Link>

      {/* Subtask progress (if any) */}
      {hasSubtasks && (
        <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums whitespace-nowrap">
          {item.done_subtask_count ?? 0}/{item.subtask_count}
        </span>
      )}

      {/* Priority dot */}
      <span
        className={cn(
          "hidden sm:inline-block h-2 w-2 rounded-full shrink-0",
          PRIORITY_DOT[item.priority] ?? "bg-muted",
        )}
        title={PRIORITY_LABEL[item.priority]}
        aria-label={`Priority: ${PRIORITY_LABEL[item.priority]}`}
      />

      {/* Status */}
      <WorkItemStatusBadge status={item.status} />

      {/* Story points — hidden below md to match column header */}
      {item.story_points != null ? (
        <Badge variant="outline" className="text-xs tabular-nums shrink-0 hidden md:inline-flex">
          {item.story_points} pt
        </Badge>
      ) : (
        <span className="hidden md:inline text-xs text-muted-foreground w-8 text-center">—</span>
      )}

      {/* Due date — hidden below md to match column header */}
      {item.due_date ? (
        <span className="hidden md:inline">
          <DueDateLabel dateStr={item.due_date} />
        </span>
      ) : (
        <span className="hidden md:inline w-14" />
      )}

      {/* Actions menu */}
      <DropdownMenuPrimitive.Root>
        <DropdownMenuPrimitive.Trigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Row actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuPrimitive.Trigger>

        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            align="end"
            sideOffset={4}
            className={cn(
              "z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              "data-[side=bottom]:slide-in-from-top-2",
            )}
          >
            {/* Move to sprint (from backlog) */}
            {!isInSprint && movableTargets.length > 0 && (
              <DropdownMenuPrimitive.Sub>
                <DropdownMenuPrimitive.SubTrigger
                  className={cn(
                    "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
                    "focus:bg-accent focus:text-accent-foreground",
                  )}
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  Move to sprint
                </DropdownMenuPrimitive.SubTrigger>
                <DropdownMenuPrimitive.Portal>
                  <DropdownMenuPrimitive.SubContent
                    sideOffset={4}
                    className={cn(
                      "z-50 min-w-[11rem] overflow-hidden rounded-md border bg-popover p-1 shadow-md",
                      "data-[state=open]:animate-in data-[state=closed]:animate-out",
                      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                      "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                    )}
                  >
                    {movableTargets.map((s) => (
                      <DropdownMenuPrimitive.Item
                        key={s.id}
                        onSelect={() =>
                          moveToSprint.mutate({ sprint_id: s.id })
                        }
                        className={cn(
                          "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
                          "focus:bg-accent focus:text-accent-foreground",
                        )}
                      >
                        {s.name}
                        {s.status === "active" && (
                          <Badge
                            variant="secondary"
                            className="ml-auto text-[10px] px-1 py-0 h-4"
                          >
                            Active
                          </Badge>
                        )}
                      </DropdownMenuPrimitive.Item>
                    ))}
                  </DropdownMenuPrimitive.SubContent>
                </DropdownMenuPrimitive.Portal>
              </DropdownMenuPrimitive.Sub>
            )}

            {/* Move to backlog (from sprint) */}
            {isInSprint && (
              <DropdownMenuPrimitive.Item
                onSelect={() => moveToBacklog.mutate({})}
                className={cn(
                  "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
                  "focus:bg-accent focus:text-accent-foreground",
                )}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Move to Backlog
              </DropdownMenuPrimitive.Item>
            )}

            {/* Move to a different sprint (from sprint) */}
            {isInSprint && movableTargets.length > 0 && (
              <DropdownMenuPrimitive.Sub>
                <DropdownMenuPrimitive.SubTrigger
                  className={cn(
                    "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
                    "focus:bg-accent focus:text-accent-foreground",
                  )}
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  Move to sprint
                </DropdownMenuPrimitive.SubTrigger>
                <DropdownMenuPrimitive.Portal>
                  <DropdownMenuPrimitive.SubContent
                    sideOffset={4}
                    className={cn(
                      "z-50 min-w-[11rem] overflow-hidden rounded-md border bg-popover p-1 shadow-md",
                      "data-[state=open]:animate-in data-[state=closed]:animate-out",
                    )}
                  >
                    {movableTargets.map((s) => (
                      <DropdownMenuPrimitive.Item
                        key={s.id}
                        onSelect={() =>
                          moveToSprint.mutate({ sprint_id: s.id })
                        }
                        className={cn(
                          "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
                          "focus:bg-accent focus:text-accent-foreground",
                        )}
                      >
                        {s.name}
                      </DropdownMenuPrimitive.Item>
                    ))}
                  </DropdownMenuPrimitive.SubContent>
                </DropdownMenuPrimitive.Portal>
              </DropdownMenuPrimitive.Sub>
            )}

            {/* Assign to project */}
            <DropdownMenuPrimitive.Sub>
              <DropdownMenuPrimitive.SubTrigger
                className={cn(
                  "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
                  "focus:bg-accent focus:text-accent-foreground",
                )}
              >
                <FolderInput className="h-3.5 w-3.5" />
                Assign to project
              </DropdownMenuPrimitive.SubTrigger>
              <DropdownMenuPrimitive.Portal>
                <DropdownMenuPrimitive.SubContent
                  sideOffset={4}
                  className={cn(
                    "z-50 max-h-[18rem] min-w-[12rem] overflow-y-auto rounded-md border bg-popover p-1 shadow-md",
                    "data-[state=open]:animate-in data-[state=closed]:animate-out",
                    "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                    "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                  )}
                >
                  {/* No project (clear assignment) */}
                  <DropdownMenuPrimitive.Item
                    onSelect={() => handleAssignProject(null)}
                    className={cn(
                      "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
                      "focus:bg-accent focus:text-accent-foreground",
                    )}
                  >
                    <span className="flex h-3.5 w-3.5 items-center justify-center shrink-0">
                      {item.project_id == null && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="text-muted-foreground">No project</span>
                  </DropdownMenuPrimitive.Item>

                  {projects.length > 0 && (
                    <DropdownMenuPrimitive.Separator className="my-1 h-px bg-border" />
                  )}

                  {projects.map((p) => (
                    <DropdownMenuPrimitive.Item
                      key={p.id}
                      onSelect={() => handleAssignProject(p.id)}
                      className={cn(
                        "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
                        "focus:bg-accent focus:text-accent-foreground",
                      )}
                    >
                      <span className="flex h-3.5 w-3.5 items-center justify-center shrink-0">
                        {item.project_id === p.id && <Check className="h-3.5 w-3.5" />}
                      </span>
                      {p.color && (
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: p.color }}
                        />
                      )}
                      <span className="truncate">{p.name}</span>
                    </DropdownMenuPrimitive.Item>
                  ))}

                  {projects.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No projects yet.
                    </div>
                  )}
                </DropdownMenuPrimitive.SubContent>
              </DropdownMenuPrimitive.Portal>
            </DropdownMenuPrimitive.Sub>

            <DropdownMenuPrimitive.Separator className="my-1 h-px bg-border" />

            {/* Delete */}
            <DropdownMenuPrimitive.Item
              onSelect={handleDelete}
              className={cn(
                "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
                "focus:bg-destructive/10 focus:text-destructive text-destructive",
              )}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </DropdownMenuPrimitive.Item>
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    </div>
  );
}
