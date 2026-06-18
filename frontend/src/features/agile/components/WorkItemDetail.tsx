"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Tag,
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
  useEpic,
  useSprint,
} from "@/features/agile";
import { WorkItemTypeBadge } from "./WorkItemTypeBadge";
import type { WorkItemStatus, WorkItemSubtask } from "@/types";
import { useAuthStore } from "@/stores";

// ─── Status dropdown config ───────────────────────────────────────────────────

const STATUSES: { value: WorkItemStatus; label: string; className: string }[] = [
  {
    value: "backlog",
    label: "Backlog",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  {
    value: "todo",
    label: "To Do",
    className: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  },
  {
    value: "in_progress",
    label: "In Progress",
    className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  },
  {
    value: "review",
    label: "In Review",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  {
    value: "done",
    label: "Done",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
];

function getStatusConfig(status: WorkItemStatus) {
  return STATUSES.find((s) => s.value === status) ?? STATUSES[0];
}

// ─── Priority config ──────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-600 dark:text-red-400",
  high: "text-orange-600 dark:text-orange-400",
  medium: "text-yellow-600 dark:text-yellow-600",
  low: "text-blue-600 dark:text-blue-400",
};

// ─── Story point options ──────────────────────────────────────────────────────

const STORY_POINTS = [null, 1, 3, 5, 8] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SubtaskRowProps {
  subtask: WorkItemSubtask;
  workItemId: string;
}

function SubtaskRow({ subtask, workItemId }: SubtaskRowProps) {
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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setTitle(subtask.title);
      setEditing(false);
    }
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
      <td className="py-2 px-2 text-sm flex-1">
        {editing ? (
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
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

// ─── Details rail item ─────────────────────────────────────────────────────────

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="w-28 shrink-0 text-xs text-muted-foreground pt-0.5">
        {label}
      </span>
      <div className="flex-1 text-sm">{children}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface WorkItemDetailProps {
  workItemId: string;
}

export function WorkItemDetail({ workItemId }: WorkItemDetailProps) {
  const router = useRouter();
  const { user } = useAuthStore();

  const { data: workItem, isLoading, isError } = useWorkItem(workItemId);
  const setStatus = useSetWorkItemStatus(workItemId);
  const updateItem = useUpdateWorkItem(workItemId);
  const createSubtask = useCreateWorkItemSubtask(workItemId);

  const { data: epic } = useEpic(workItem?.epic_id ?? "");
  const { data: sprint } = useSprint(workItem?.sprint_id ?? "");

  const [activityTab, setActivityTab] = useState<
    "all" | "comments" | "history" | "worklog"
  >("all");
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

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !workItem) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
        <AlertCircle className="h-6 w-6" />
        <p className="text-sm">Work item not found.</p>
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          Go back
        </Button>
      </div>
    );
  }

  const subtasks = workItem.subtasks ?? [];
  const doneCount = subtasks.filter((s) => s.is_done).length;
  const totalCount = subtasks.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const currentStatus = getStatusConfig(workItem.status);

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
        },
      },
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
        <button
          type="button"
          className="hover:text-foreground transition-colors"
          onClick={() => router.push("/work-items")}
        >
          Work Items
        </button>
        {epic && (
          <>
            <ChevronRight className="h-3 w-3" />
            <button
              type="button"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => router.push(`/work-items?epic_id=${epic.id}`)}
            >
              <Layers className="h-3 w-3" />
              {epic.title}
            </button>
          </>
        )}
        <ChevronRight className="h-3 w-3" />
        <WorkItemTypeBadge type={workItem.type} />
        <span className="font-medium text-foreground truncate max-w-xs">
          {workItem.title}
        </span>
      </div>

      {/* ── Two-column layout ──────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 gap-6">
        {/* ── Left column ─────────────────────────────────────────────── */}
        <div className="flex flex-1 min-w-0 flex-col gap-6">
          <ScrollArea className="flex-1">
            <div className="space-y-6 pr-4">
              {/* Title + action buttons */}
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  {editingTitle ? (
                    <div className="flex-1 flex items-start gap-2">
                      <input
                        autoFocus
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        onBlur={handleTitleSave}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleTitleSave();
                          if (e.key === "Escape") setEditingTitle(false);
                        }}
                        className="flex-1 text-2xl font-bold bg-transparent border-b-2 border-primary outline-none"
                      />
                    </div>
                  ) : (
                    <h1
                      className="flex-1 text-2xl font-bold leading-tight cursor-text hover:text-muted-foreground/80 transition-colors"
                      onClick={() => {
                        setTitleDraft(workItem.title);
                        setEditingTitle(true);
                      }}
                    >
                      {workItem.title}
                    </h1>
                  )}
                </div>

                {/* Action toolbar: + and ... menus */}
                <div className="flex items-center gap-2">
                  {/* + menu */}
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

                  {/* ... menu */}
                  <DropdownMenuPrimitive.Root>
                    <DropdownMenuPrimitive.Trigger asChild>
                      <Button variant="outline" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                        <span className="sr-only">More actions</span>
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
              <div className="space-y-2">
                <h2 className="text-sm font-semibold">Description</h2>
                {editingDescription ? (
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      value={descriptionDraft}
                      onChange={(e) => setDescriptionDraft(e.target.value)}
                      rows={5}
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
                  <h2 className="text-sm font-semibold">
                    Subtasks
                  </h2>
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

              {/* Linked work items (placeholder) */}
              <div className="space-y-2">
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
                <div className="flex items-center gap-1 border-b border-border">
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
                <div className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="rounded-md border border-input px-3 py-2 text-sm text-muted-foreground min-h-[2.5rem] cursor-text hover:border-ring transition-colors">
                      Add a comment...
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* ── Right rail ──────────────────────────────────────────────── */}
        <div className="w-72 shrink-0">
          {/* Status dropdown */}
          <div className="mb-4">
            <DropdownMenuPrimitive.Root>
              <DropdownMenuPrimitive.Trigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "gap-1.5 font-semibold w-full justify-between",
                    currentStatus.className,
                    "border-transparent",
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
                          setStatus.mutate({ status: s.value });
                        }
                      }}
                      className={cn(
                        "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent",
                        workItem.status === s.value && "font-semibold",
                      )}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          s.value === "done" && "bg-emerald-500",
                          s.value === "in_progress" && "bg-sky-500",
                          s.value === "review" && "bg-amber-500",
                          s.value === "todo" && "bg-violet-500",
                          s.value === "backlog" && "bg-slate-400",
                        )}
                      />
                      {s.label}
                      {workItem.status === s.value && (
                        <Check className="h-3 w-3 ml-auto" />
                      )}
                    </DropdownMenuPrimitive.Item>
                  ))}
                </DropdownMenuPrimitive.Content>
              </DropdownMenuPrimitive.Portal>
            </DropdownMenuPrimitive.Root>
          </div>

          {/* Details panel */}
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">Details</h3>
            </div>
            <div className="px-4 py-2 divide-y divide-border">
              {/* Assignee */}
              <DetailRow label="Assignee">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-sm">
                    {user?.display_name ?? "Unassigned"}
                  </span>
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
                  {PRIORITY_LABELS[workItem.priority] ?? workItem.priority}
                </span>
              </DetailRow>

              {/* Parent (epic) */}
              <DetailRow label="Parent">
                {epic ? (
                  <button
                    type="button"
                    onClick={() => router.push(`/work-items?epic_id=${epic.id}`)}
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    {epic.title}
                  </button>
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

              {/* Labels (placeholder) */}
              <DetailRow label="Labels">
                <span className="text-muted-foreground text-sm">None</span>
              </DetailRow>

              {/* Start date (not in model — kept as UI placeholder) */}
              <DetailRow label="Start date">
                <span className="text-muted-foreground text-sm">None</span>
              </DetailRow>

              {/* Sprint */}
              <DetailRow label="Sprint">
                {sprint ? (
                  <button
                    type="button"
                    onClick={() => router.push(`/sprints/${sprint.id}`)}
                    className="text-sm text-primary hover:underline flex items-center gap-1.5"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    {sprint.name}
                  </button>
                ) : (
                  <span className="text-muted-foreground text-sm">Backlog</span>
                )}
              </DetailRow>

              {/* Story points */}
              <DetailRow label="Story points">
                <DropdownMenuPrimitive.Root>
                  <DropdownMenuPrimitive.Trigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
                    >
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                      {workItem.story_points != null
                        ? workItem.story_points
                        : "Unestimated"}
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
                          onSelect={() => {
                            // parent component can wire useSetWorkItemPoints here
                            // kept as placeholder — full implementation in screen agents
                          }}
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
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-[9px] font-bold text-primary-foreground">
                      {user?.display_name?.[0]?.toUpperCase() ?? "U"}
                    </span>
                  </div>
                  <span className="text-sm">
                    {user?.display_name ?? "You"}
                  </span>
                </div>
              </DetailRow>
            </div>

            {/* Footer timestamps */}
            <div className="px-4 py-3 border-t text-xs text-muted-foreground space-y-0.5">
              <p>
                Created{" "}
                {format(new Date(workItem.created_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
              <p>
                Updated{" "}
                {format(new Date(workItem.updated_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
