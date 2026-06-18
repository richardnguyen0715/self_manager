"use client";

import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import {
  ChevronRight,
  Plus,
  MoreHorizontal,
  CheckSquare,
  Link2,
  ChevronDown,
  User,
  Calendar,
  Zap,
  Flag,
  Layers,
  AlertCircle,
  Loader2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  useWorkItem,
  useSetWorkItemStatus,
  useCreateWorkItemSubtask,
  useUpdateWorkItemSubtask,
  useDeleteWorkItemSubtask,
  useUpdateWorkItem,
  useSetWorkItemPoints,
  useEpic,
  useSprint,
} from "@/features/agile";
import { WorkItemTypeBadge } from "@/features/agile/components/WorkItemTypeBadge";
import { useBoardStore } from "../store";
import { boardKeys } from "../hooks/useSprintBoard";
import type { WorkItemStatus, WorkItemSubtask, Priority } from "@/types";
import { useAuthStore } from "@/stores";
import { useQueryClient } from "@tanstack/react-query";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUSES: { value: WorkItemStatus; label: string; dotClass: string; btnClass: string }[] =
  [
    {
      value: "backlog",
      label: "Backlog",
      dotClass: "bg-slate-400",
      btnClass:
        "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    },
    {
      value: "todo",
      label: "To Do",
      dotClass: "bg-violet-500",
      btnClass:
        "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800",
    },
    {
      value: "in_progress",
      label: "In Progress",
      dotClass: "bg-sky-500",
      btnClass:
        "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800",
    },
    {
      value: "review",
      label: "In Review",
      dotClass: "bg-amber-500",
      btnClass:
        "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
    },
    {
      value: "done",
      label: "Done",
      dotClass: "bg-emerald-500",
      btnClass:
        "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
    },
  ];

function getStatusConf(status: WorkItemStatus) {
  return STATUSES.find((s) => s.value === status) ?? STATUSES[0];
}

// ─── Priority config ──────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<Priority, string> = {
  critical: "text-red-600 dark:text-red-400",
  high: "text-orange-600 dark:text-orange-400",
  medium: "text-yellow-600 dark:text-yellow-600",
  low: "text-blue-600 dark:text-blue-400",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

// ─── Story point options ──────────────────────────────────────────────────────

const STORY_POINTS = [null, 1, 3, 5, 8] as const;

// ─── Subtask row ──────────────────────────────────────────────────────────────

function SubtaskRow({
  subtask,
  workItemId,
}: {
  subtask: WorkItemSubtask;
  workItemId: string;
}) {
  const update = useUpdateWorkItemSubtask(workItemId, subtask.id);
  const remove = useDeleteWorkItemSubtask(workItemId);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(subtask.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function handleToggle() {
    update.mutate({ is_done: !subtask.is_done });
  }

  function handleSave() {
    if (title.trim() && title !== subtask.title) {
      update.mutate({ title: title.trim() });
    }
    setEditing(false);
  }

  return (
    <tr className="group border-b border-border last:border-0">
      <td className="py-2 pl-2 pr-1 w-6">
        <button
          type="button"
          onClick={handleToggle}
          disabled={update.isPending}
          className={cn(
            "h-4 w-4 rounded border border-input flex items-center justify-center shrink-0 transition-colors",
            subtask.is_done
              ? "bg-emerald-500 border-emerald-500 text-white"
              : "hover:border-primary",
          )}
          aria-label={subtask.is_done ? "Mark incomplete" : "Mark done"}
        >
          {subtask.is_done && <Check className="h-2.5 w-2.5" />}
        </button>
      </td>
      <td className="py-2 px-2 text-sm">
        {editing ? (
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setTitle(subtask.title);
                setEditing(false);
              }
            }}
            className="w-full bg-transparent border-b border-primary outline-none text-sm"
          />
        ) : (
          <span
            className={cn(
              "cursor-text",
              subtask.is_done && "line-through text-muted-foreground",
            )}
            onClick={() => setEditing(true)}
          >
            {subtask.title}
          </span>
        )}
      </td>
      <td className="py-2 px-2 text-right">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100"
          onClick={() => {
            if (confirm("Delete this subtask?")) remove.mutate(subtask.id);
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      </td>
    </tr>
  );
}

// ─── Details rail row ─────────────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="w-28 shrink-0 text-xs text-muted-foreground pt-0.5">{label}</span>
      <div className="flex-1 text-sm">{children}</div>
    </div>
  );
}

// ─── Main sheet ───────────────────────────────────────────────────────────────

interface WorkItemDetailSheetProps {
  /** The board's active sprint id — used to refresh board after mutations */
  sprintId: string;
}

export function WorkItemDetailSheet({ sprintId }: WorkItemDetailSheetProps) {
  const { openItemId, closeItemDetail } = useBoardStore();
  const workItemId = openItemId ?? "";
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const { data: workItem, isLoading, isError } = useWorkItem(workItemId);
  const setStatus = useSetWorkItemStatus(workItemId);
  const setPoints = useSetWorkItemPoints(workItemId);
  const updateItem = useUpdateWorkItem(workItemId);
  const createSubtask = useCreateWorkItemSubtask(workItemId);

  const { data: epic } = useEpic(workItem?.epic_id ?? "");
  const { data: sprint } = useSprint(workItem?.sprint_id ?? "");

  const [activityTab, setActivityTab] = useState<"all" | "comments" | "history" | "worklog">(
    "all",
  );
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const subtaskInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAddingSubtask) subtaskInputRef.current?.focus();
  }, [isAddingSubtask]);

  if (!openItemId) return null;

  if (isLoading) {
    return (
      <SheetWrapper onClose={closeItemDetail}>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </SheetWrapper>
    );
  }

  if (isError || !workItem) {
    return (
      <SheetWrapper onClose={closeItemDetail}>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
          <AlertCircle className="h-6 w-6" />
          <p className="text-sm">Work item not found.</p>
          <Button variant="ghost" size="sm" onClick={closeItemDetail}>
            Close
          </Button>
        </div>
      </SheetWrapper>
    );
  }

  const subtasks = workItem.subtasks ?? [];
  const doneCount = subtasks.filter((s) => s.is_done).length;
  const totalCount = subtasks.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const currentStatus = getStatusConf(workItem.status);

  function handleTitleSave() {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== workItem!.title) {
      updateItem.mutate({ title: trimmed });
    }
    setEditingTitle(false);
  }

  function handleDescriptionSave() {
    const trimmed = descriptionDraft.trim() || null;
    if (trimmed !== workItem!.description) {
      updateItem.mutate({ description: trimmed });
    }
    setEditingDescription(false);
  }

  function handleAddSubtask() {
    const trimmed = newSubtaskTitle.trim();
    if (!trimmed) return;
    createSubtask.mutate(
      { title: trimmed },
      {
        onSuccess: () => {
          setNewSubtaskTitle("");
          setIsAddingSubtask(false);
          qc.invalidateQueries({ queryKey: boardKeys.sprintItems(sprintId) });
        },
      },
    );
  }

  return (
    <SheetWrapper onClose={closeItemDetail}>
      {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 shrink-0">
        {epic ? (
          <>
            <Layers className="h-3 w-3" />
            <span className="hover:text-foreground transition-colors cursor-default">{epic.title}</span>
            <ChevronRight className="h-3 w-3" />
          </>
        ) : (
          <>
            <span>Work Items</span>
            <ChevronRight className="h-3 w-3" />
          </>
        )}
        <WorkItemTypeBadge type={workItem.type} />
        <span className="font-medium text-foreground truncate max-w-[12rem]">
          {workItem.title}
        </span>
      </div>

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 gap-5">
        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div className="flex flex-1 min-w-0 flex-col">
          <ScrollArea className="flex-1">
            <div className="space-y-5 pr-3">
              {/* Title + action toolbar */}
              <div className="space-y-2">
                {editingTitle ? (
                  <input
                    autoFocus
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleTitleSave();
                      if (e.key === "Escape") setEditingTitle(false);
                    }}
                    className="w-full text-xl font-bold bg-transparent border-b-2 border-primary outline-none"
                  />
                ) : (
                  <h1
                    className="text-xl font-bold leading-tight cursor-text hover:text-muted-foreground/80 transition-colors"
                    onClick={() => {
                      setTitleDraft(workItem.title);
                      setEditingTitle(true);
                    }}
                  >
                    {workItem.title}
                  </h1>
                )}

                {/* + and ... menus */}
                <div className="flex items-center gap-1.5">
                  <DropdownMenuPrimitive.Root>
                    <DropdownMenuPrimitive.Trigger asChild>
                      <Button variant="outline" size="icon" className="h-7 w-7">
                        <Plus className="h-3.5 w-3.5" />
                        <span className="sr-only">Create</span>
                      </Button>
                    </DropdownMenuPrimitive.Trigger>
                    <DropdownMenuPrimitive.Portal>
                      <DropdownMenuPrimitive.Content
                        sideOffset={4}
                        align="start"
                        className="z-50 min-w-[11rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                      >
                        <DropdownMenuPrimitive.Item
                          onSelect={() => setIsAddingSubtask(true)}
                          className="flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                        >
                          <CheckSquare className="h-3.5 w-3.5" />
                          Create subtask
                        </DropdownMenuPrimitive.Item>
                        <DropdownMenuPrimitive.Item
                          className="flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Link work item
                        </DropdownMenuPrimitive.Item>
                      </DropdownMenuPrimitive.Content>
                    </DropdownMenuPrimitive.Portal>
                  </DropdownMenuPrimitive.Root>

                  <DropdownMenuPrimitive.Root>
                    <DropdownMenuPrimitive.Trigger asChild>
                      <Button variant="outline" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                        <span className="sr-only">More</span>
                      </Button>
                    </DropdownMenuPrimitive.Trigger>
                    <DropdownMenuPrimitive.Portal>
                      <DropdownMenuPrimitive.Content
                        sideOffset={4}
                        align="start"
                        className="z-50 min-w-[11rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                      >
                        <DropdownMenuPrimitive.Item
                          onSelect={() => {
                            setTitleDraft(workItem.title);
                            setEditingTitle(true);
                          }}
                          className="flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit title
                        </DropdownMenuPrimitive.Item>
                      </DropdownMenuPrimitive.Content>
                    </DropdownMenuPrimitive.Portal>
                  </DropdownMenuPrimitive.Root>
                </div>
              </div>

              <Separator />

              {/* Description */}
              <div className="space-y-1.5">
                <h2 className="text-sm font-semibold">Description</h2>
                {editingDescription ? (
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      value={descriptionDraft}
                      onChange={(e) => setDescriptionDraft(e.target.value)}
                      rows={4}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
                      placeholder="Add a description..."
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleDescriptionSave}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingDescription(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "min-h-[2.5rem] cursor-text rounded-md px-0 py-1 text-sm transition-colors hover:bg-accent/40",
                      !workItem.description && "text-muted-foreground",
                    )}
                    onClick={() => {
                      setDescriptionDraft(workItem.description ?? "");
                      setEditingDescription(true);
                    }}
                  >
                    {workItem.description || "Add a description..."}
                  </div>
                )}
              </div>

              <Separator />

              {/* Subtasks */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Subtasks</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setIsAddingSubtask(true)}
                    aria-label="Add subtask"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {progressPct}% Done
                  </span>
                </div>

                {/* Subtask table */}
                {(subtasks.length > 0 || isAddingSubtask) && (
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 text-xs text-muted-foreground">
                          <th className="w-6 py-1.5 pl-2" />
                          <th className="py-1.5 px-2 text-left font-medium">Work</th>
                          <th className="py-1.5 px-2 w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {subtasks.map((subtask) => (
                          <SubtaskRow
                            key={subtask.id}
                            subtask={subtask}
                            workItemId={workItemId}
                          />
                        ))}
                        {isAddingSubtask && (
                          <tr className="border-b border-border last:border-0">
                            <td className="py-2 pl-2 pr-1 w-6">
                              <div className="h-4 w-4 rounded border border-input" />
                            </td>
                            <td className="py-2 px-2" colSpan={2}>
                              <input
                                ref={subtaskInputRef}
                                value={newSubtaskTitle}
                                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleAddSubtask();
                                  if (e.key === "Escape") {
                                    setIsAddingSubtask(false);
                                    setNewSubtaskTitle("");
                                  }
                                }}
                                placeholder="Subtask title…"
                                className="w-full bg-transparent outline-none text-sm"
                              />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    {isAddingSubtask && (
                      <div className="flex gap-2 px-3 py-2 bg-muted/30">
                        <Button
                          size="sm"
                          onClick={handleAddSubtask}
                          disabled={createSubtask.isPending || !newSubtaskTitle.trim()}
                        >
                          {createSubtask.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Add"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setIsAddingSubtask(false);
                            setNewSubtaskTitle("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {subtasks.length === 0 && !isAddingSubtask && (
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setIsAddingSubtask(true)}
                  >
                    Add subtask...
                  </button>
                )}
              </div>

              <Separator />

              {/* Linked work items (UI placeholder — link endpoint not yet wired) */}
              <div className="space-y-1.5">
                <h2 className="text-sm font-semibold">Linked work items</h2>
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Add linked work item
                </button>
              </div>

              <Separator />

              {/* Activity */}
              <div className="space-y-3">
                <h2 className="text-sm font-semibold">Activity</h2>

                {/* Tabs */}
                <div className="flex items-center gap-0 border-b border-border">
                  {(
                    [
                      ["all", "All"],
                      ["comments", "Comments"],
                      ["history", "History"],
                      ["worklog", "Work log"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setActivityTab(value)}
                      className={cn(
                        "px-3 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                        activityTab === value
                          ? "border-primary text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Comment box */}
                <div className="flex items-start gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-primary-foreground">
                      {user?.display_name?.[0]?.toUpperCase() ?? "U"}
                    </span>
                  </div>
                  <div className="flex-1 rounded-md border border-input px-3 py-2 text-sm text-muted-foreground min-h-[2.5rem] cursor-text hover:border-ring transition-colors">
                    Add a comment...
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* ── Right rail ──────────────────────────────────────────────────── */}
        <div className="w-64 shrink-0 flex flex-col gap-3">
          {/* Status dropdown */}
          <DropdownMenuPrimitive.Root>
            <DropdownMenuPrimitive.Trigger asChild>
              <Button
                className={cn(
                  "w-full justify-between gap-1.5 font-semibold border",
                  currentStatus.btnClass,
                )}
              >
                {currentStatus.label}
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuPrimitive.Trigger>
            <DropdownMenuPrimitive.Portal>
              <DropdownMenuPrimitive.Content
                align="end"
                sideOffset={4}
                className="z-50 min-w-[10rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
              >
                {STATUSES.map((s) => (
                  <DropdownMenuPrimitive.Item
                    key={s.value}
                    onSelect={() => {
                      if (s.value !== workItem.status) {
                        setStatus.mutate(
                          { status: s.value },
                          {
                            onSuccess: () => {
                              qc.invalidateQueries({
                                queryKey: boardKeys.sprintItems(sprintId),
                              });
                            },
                          },
                        );
                      }
                    }}
                    className={cn(
                      "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent",
                      workItem.status === s.value && "font-semibold",
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full", s.dotClass)} />
                    {s.label}
                    {workItem.status === s.value && (
                      <Check className="h-3 w-3 ml-auto" />
                    )}
                  </DropdownMenuPrimitive.Item>
                ))}
              </DropdownMenuPrimitive.Content>
            </DropdownMenuPrimitive.Portal>
          </DropdownMenuPrimitive.Root>

          {/* Details panel */}
          <div className="rounded-lg border bg-card flex-1 overflow-hidden">
            <div className="px-3 py-2.5 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold">Details</h3>
            </div>
            <div className="px-3 py-1 divide-y divide-border">
              {/* Assignee */}
              <DetailRow label="Assignee">
                <div className="flex items-center gap-1.5">
                  <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-sm">{user?.display_name ?? "Unassigned"}</span>
                </div>
              </DetailRow>

              {/* Priority */}
              <DetailRow label="Priority">
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-medium",
                    PRIORITY_COLORS[workItem.priority],
                  )}
                >
                  <Flag className="h-3.5 w-3.5" />
                  {PRIORITY_LABELS[workItem.priority]}
                </span>
              </DetailRow>

              {/* Parent (epic) */}
              <DetailRow label="Parent">
                {epic ? (
                  <span className="flex items-center gap-1.5 text-sm text-primary">
                    <Layers className="h-3.5 w-3.5" />
                    {epic.title}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">None</span>
                )}
              </DetailRow>

              {/* Due date */}
              <DetailRow label="Due date">
                {workItem.due_date ? (
                  <span className="flex items-center gap-1.5 text-sm">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    {format(new Date(workItem.due_date), "MMM d, yyyy")}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">None</span>
                )}
              </DetailRow>

              {/* Labels */}
              <DetailRow label="Labels">
                <span className="text-muted-foreground text-sm">None</span>
              </DetailRow>

              {/* Start date */}
              <DetailRow label="Start date">
                <span className="text-muted-foreground text-sm">None</span>
              </DetailRow>

              {/* Sprint */}
              <DetailRow label="Sprint">
                {sprint ? (
                  <span className="text-sm text-primary flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" />
                    {sprint.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">Backlog</span>
                )}
              </DetailRow>

              {/* Story point estimate */}
              <DetailRow label="Story points">
                <DropdownMenuPrimitive.Root>
                  <DropdownMenuPrimitive.Trigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
                    >
                      {workItem.story_points != null ? (
                        <Badge variant="outline" className="h-5 px-1.5 text-xs">
                          {workItem.story_points}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Unestimated</span>
                      )}
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </button>
                  </DropdownMenuPrimitive.Trigger>
                  <DropdownMenuPrimitive.Portal>
                    <DropdownMenuPrimitive.Content
                      align="start"
                      sideOffset={4}
                      className="z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 shadow-md"
                    >
                      {STORY_POINTS.map((pt) => (
                        <DropdownMenuPrimitive.Item
                          key={pt ?? "null"}
                          onSelect={() =>
                            setPoints.mutate(
                              { story_points: pt ?? null },
                              {
                                onSuccess: () => {
                                  qc.invalidateQueries({
                                    queryKey: boardKeys.sprintItems(sprintId),
                                  });
                                },
                              },
                            )
                          }
                          className="flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                        >
                          {pt == null ? "Unestimated" : pt}
                          {workItem.story_points === pt && (
                            <Check className="h-3 w-3 ml-auto" />
                          )}
                        </DropdownMenuPrimitive.Item>
                      ))}
                    </DropdownMenuPrimitive.Content>
                  </DropdownMenuPrimitive.Portal>
                </DropdownMenuPrimitive.Root>
              </DetailRow>

              {/* Reporter */}
              <DetailRow label="Reporter">
                <div className="flex items-center gap-1.5">
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-[9px] font-bold text-primary-foreground">
                      {user?.display_name?.[0]?.toUpperCase() ?? "U"}
                    </span>
                  </div>
                  <span className="text-sm">{user?.display_name ?? "You"}</span>
                </div>
              </DetailRow>
            </div>

            {/* Timestamps */}
            <div className="px-3 py-2.5 border-t text-xs text-muted-foreground space-y-0.5">
              <p>
                Created {format(new Date(workItem.created_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
              <p>
                Updated {format(new Date(workItem.updated_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </SheetWrapper>
  );
}

// ─── Sheet wrapper (slide-over panel) ────────────────────────────────────────

function SheetWrapper({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 dark:bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative ml-auto flex flex-col w-full max-w-3xl bg-background border-l shadow-2xl h-full overflow-hidden">
        {/* Close button */}
        <div className="absolute top-3 right-3 z-10">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-6 pt-12 min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}
