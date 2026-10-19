"use client";

import { useState, useRef, useEffect } from "react";
import {
  X,
  Plus,
  MoreHorizontal,
  CheckSquare,
  Square,
  Trash2,
  ChevronDown,
  CalendarDays,
  Zap,
  User,
  Tag,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type {
  WorkItem,
  WorkItemSubtask,
  WorkItemStatus,
} from "@/types";
import {
  useWorkItem,
  useWorkItemSubtasks,
  useCreateWorkItemSubtask,
  useUpdateWorkItemSubtask,
  useDeleteWorkItemSubtask,
  useSetWorkItemStatus,
  useUpdateWorkItem,
  useEpic,
} from "../hooks/useHierarchy";
import { WorkItemStatusBadge, WORK_ITEM_STATUS_OPTIONS } from "./WorkItemStatusBadge";
import { PriorityBadge } from "./PriorityBadge";
import { WorkItemTypeBadge } from "./WorkItemTypeBadge";
import { PropertiesPanel } from "@/features/custom-properties";
import { EstimateBadge } from "@/features/estimate";
import { BacklinksList } from "@/features/mentions";

// ─── Status dropdown ───────────────────────────────────────────────────────────

function StatusDropdown({
  status,
  onStatusChange,
  isPending,
}: {
  status: WorkItemStatus;
  onStatusChange: (s: WorkItemStatus) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
          "bg-primary text-primary-foreground border-primary hover:bg-primary/90",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {WORK_ITEM_STATUS_OPTIONS.find((o) => o.value === status)?.label ??
          status}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-44 rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="p-1 flex flex-col gap-0.5">
            {WORK_ITEM_STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onStatusChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left",
                  opt.value === status && "font-semibold",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Subtask row ──────────────────────────────────────────────────────────────

function SubtaskRow({
  subtask,
  workItemId,
}: {
  subtask: WorkItemSubtask;
  workItemId: string;
}) {
  const updateSubtask = useUpdateWorkItemSubtask(workItemId);
  const deleteSubtask = useDeleteWorkItemSubtask(workItemId);

  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/40 group/row">
      <td className="py-2 pl-2 pr-1 w-8">
        <button
          type="button"
          disabled={updateSubtask.isPending}
          onClick={() =>
            updateSubtask.mutate({
              subtaskId: subtask.id,
              is_done: !subtask.is_done,
            })
          }
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={subtask.is_done ? "Mark incomplete" : "Mark complete"}
        >
          {subtask.is_done ? (
            <CheckSquare className="h-4 w-4 text-primary" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>
      </td>
      <td className="py-2 px-2 flex-1">
        <span
          className={cn(
            "text-sm",
            subtask.is_done && "line-through text-muted-foreground",
          )}
        >
          {subtask.title}
        </span>
      </td>
      <td className="py-2 pr-2 w-8">
        <button
          type="button"
          onClick={() => deleteSubtask.mutate(subtask.id)}
          disabled={deleteSubtask.isPending}
          className="opacity-0 group-hover/row:opacity-100 text-muted-foreground hover:text-destructive transition-all"
          aria-label="Delete subtask"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

// ─── Subtasks section ──────────────────────────────────────────────────────────

function SubtasksSection({ workItem }: { workItem: WorkItem }) {
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: subtasks } = useWorkItemSubtasks(workItem.id, true);
  const createSubtask = useCreateWorkItemSubtask(workItem.id);

  const allSubtasks = subtasks ?? workItem.subtasks ?? [];
  const doneCount = allSubtasks.filter((s) => s.is_done).length;
  const total = allSubtasks.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  useEffect(() => {
    if (adding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [adding]);

  async function handleAddSubtask() {
    const title = newTitle.trim();
    if (!title) return;
    await createSubtask.mutateAsync({ title });
    setNewTitle("");
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Subtasks</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setAdding(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {pct}% Done
        </span>
      </div>

      {/* Table */}
      {allSubtasks.length > 0 && (
        <div className="border rounded-md overflow-hidden mb-2">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="py-1.5 pl-2 pr-1 w-8" />
                <th className="py-1.5 px-2 text-left text-xs font-medium text-muted-foreground">
                  Work
                </th>
                <th className="py-1.5 pr-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {allSubtasks.map((subtask) => (
                <SubtaskRow
                  key={subtask.id}
                  subtask={subtask}
                  workItemId={workItem.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add subtask input */}
      {adding && (
        <div className="flex items-center gap-2 mt-1">
          <input
            ref={inputRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddSubtask();
              if (e.key === "Escape") {
                setAdding(false);
                setNewTitle("");
              }
            }}
            placeholder="Subtask title..."
            className="flex-1 h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button
            size="sm"
            className="h-8"
            onClick={handleAddSubtask}
            disabled={createSubtask.isPending || !newTitle.trim()}
          >
            {createSubtask.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Add"
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => {
              setAdding(false);
              setNewTitle("");
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      {!adding && allSubtasks.length === 0 && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Create a subtask
        </button>
      )}
    </div>
  );
}

// ─── Activity section ──────────────────────────────────────────────────────────

type ActivityTab = "all" | "comments" | "history" | "work_log";

function ActivitySection() {
  const [activeTab, setActiveTab] = useState<ActivityTab>("comments");
  const [comment, setComment] = useState("");

  const TABS: { value: ActivityTab; label: string }[] = [
    { value: "all", label: "All" },
    { value: "comments", label: "Comments" },
    { value: "history", label: "History" },
    { value: "work_log", label: "Work log" },
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3">Activity</h3>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium -mb-px border-b-2 transition-colors",
              activeTab === tab.value
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Comment box */}
      <div className="flex items-start gap-3">
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <User className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
            className="flex w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {comment.trim() && (
            <div className="flex items-center gap-2 mt-2">
              <Button size="sm" className="h-7">
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                onClick={() => setComment("")}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Details rail ──────────────────────────────────────────────────────────────

interface EpicStatusInfo {
  epicTitle: string;
}

function DetailsRail({
  workItem,
  epicInfo,
}: {
  workItem: WorkItem;
  epicInfo: EpicStatusInfo | null;
}) {

  const detailRows: { label: string; content: React.ReactNode }[] = [
    {
      label: "Assignee",
      content: (
        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" />
          Unassigned
        </span>
      ),
    },
    {
      label: "Priority",
      content: <PriorityBadge priority={workItem.priority} />,
    },
    {
      label: "Parent (Epic)",
      content: epicInfo ? (
        <span className="text-sm font-medium">{epicInfo.epicTitle}</span>
      ) : (
        <span className="text-sm text-muted-foreground">None</span>
      ),
    },
    {
      label: "Due date",
      content: workItem.due_date ? (
        <span className="inline-flex items-center gap-1.5 text-sm">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          {new Date(workItem.due_date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">None</span>
      ),
    },
    {
      label: "Labels",
      content: <span className="text-sm text-muted-foreground">None</span>,
    },
    {
      label: "Start date",
      content: <span className="text-sm text-muted-foreground">None</span>,
    },
    {
      label: "Sprint",
      content: workItem.sprint_id ? (
        <span className="text-sm font-medium text-primary">
          Sprint active
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">No sprint</span>
      ),
    },
    {
      label: "Story point estimate",
      content:
        workItem.story_points != null ? (
          <Badge variant="outline" className="text-xs">
            <EstimateBadge projectId={workItem.project_id} value={workItem.story_points} />
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">None</span>
        ),
    },
    {
      label: "Reporter",
      content: (
        <span className="text-sm flex items-center gap-1.5">
          <span className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-[10px] text-primary-foreground font-bold shrink-0">
            U
          </span>
          You
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Details</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <Tag className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {detailRows.map((row) => (
          <div key={row.label} className="grid grid-cols-[120px_1fr] gap-2 items-start">
            <span className="text-xs text-muted-foreground pt-0.5">
              {row.label}
            </span>
            <div>{row.content}</div>
          </div>
        ))}
      </div>

      <Separator className="my-4" />

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <span>
          Created{" "}
          {new Date(workItem.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <span>
          Updated{" "}
          {new Date(workItem.updated_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}

// ─── Quick actions menu ────────────────────────────────────────────────────────

function QuickActionsMenu({
  workItem,
  onCreateSubtask,
}: {
  workItem: WorkItem;
  onCreateSubtask: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => setOpen((o) => !o)}
        aria-label="More actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-52 rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="p-1 flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => {
                onCreateSubtask();
                setOpen(false);
              }}
              className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
            >
              <Plus className="h-3.5 w-3.5" />
              Create subtask
            </button>
            <button
              type="button"
              className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left text-muted-foreground"
            >
              <Zap className="h-3.5 w-3.5" />
              Link work item
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main WorkItemDetail ───────────────────────────────────────────────────────

interface WorkItemDetailProps {
  workItemId: string;
  onClose: () => void;
}

export function WorkItemDetail({ workItemId, onClose }: WorkItemDetailProps) {
  const { data: workItem, isLoading, isError } = useWorkItem(workItemId);
  const { data: epic } = useEpic(workItem?.epic_id ?? "");
  const setStatus = useSetWorkItemStatus();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const updateWorkItem = useUpdateWorkItem();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !workItem) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <p className="text-sm text-destructive">Failed to load work item.</p>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  const epicInfo =
    epic
      ? { epicTitle: epic.title }
      : null;

  async function handleTitleSave() {
    if (!workItem) return;
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== workItem.title) {
      await updateWorkItem.mutateAsync({ id: workItem.id, title: trimmed });
    }
    setEditingTitle(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 px-4 md:px-6 py-3 border-b flex-wrap">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 truncate">
          {epicInfo && (
            <>
              <span className="truncate">{epicInfo.epicTitle}</span>
              <span>/</span>
            </>
          )}
          <WorkItemTypeBadge type={workItem.type} showLabel />
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 shrink-0">
          <StatusDropdown
            status={workItem.status}
            onStatusChange={(s) =>
              setStatus.mutate({ id: workItem.id, status: s })
            }
            isPending={setStatus.isPending}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Left column */}
        <ScrollArea className="flex-1">
          <div className="px-4 md:px-6 py-5 space-y-6">
            {/* Title */}
            <div>
              {editingTitle ? (
                <input
                  autoFocus
                  className="w-full text-xl font-bold bg-transparent border-b-2 border-primary outline-none pb-1"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTitleSave();
                    if (e.key === "Escape") setEditingTitle(false);
                  }}
                />
              ) : (
                <h2
                  className="text-xl font-bold cursor-text hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
                  onClick={() => {
                    setTitleDraft(workItem.title);
                    setEditingTitle(true);
                  }}
                >
                  {workItem.title}
                </h2>
              )}

              {/* Quick action buttons */}
              <div className="flex items-center gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() =>
                    document
                      .getElementById(`wi-add-subtask-${workItem.id}`)
                      ?.click()
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <QuickActionsMenu
                  workItem={workItem}
                  onCreateSubtask={() =>
                    document
                      .getElementById(`wi-add-subtask-${workItem.id}`)
                      ?.click()
                  }
                />
              </div>
            </div>

            <Separator />

            {/* Description */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Description</h3>
              {workItem.description ? (
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {workItem.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Add a description...
                </p>
              )}
              <BacklinksList targetType="work_item" targetId={workItem.id} />
            </div>

            {/* Custom properties (renders nothing without a project or properties) */}
            <PropertiesPanel
              workItemId={workItem.id}
              projectId={workItem.project_id}
            />

            <Separator />

            {/* Subtasks */}
            <div>
              {/* Hidden trigger for subtask add */}
              <button
                id={`wi-add-subtask-${workItem.id}`}
                type="button"
                className="sr-only"
              />
              <SubtasksSection workItem={workItem} />
            </div>

            <Separator />

            {/* Linked work items */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Linked work items</h3>
              <p className="text-sm text-muted-foreground">
                Add linked work item
              </p>
            </div>

            <Separator />

            {/* Activity */}
            <ActivitySection />
          </div>
        </ScrollArea>

        {/* Right Details rail */}
        <div className="w-full lg:w-64 xl:w-72 shrink-0 border-t lg:border-t-0 lg:border-l overflow-y-auto">
          <div className="px-4 py-5">
            <DetailsRail workItem={workItem} epicInfo={epicInfo} />
          </div>
        </div>
      </div>
    </div>
  );
}
