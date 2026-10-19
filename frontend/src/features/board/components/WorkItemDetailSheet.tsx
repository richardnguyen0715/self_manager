"use client";

import { useState, useRef, useEffect, createContext, useContext } from "react";
import { format, formatDistanceToNow } from "date-fns";
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
  Send,
  Trash2,
  MessageSquare,
  History,
  Clock,
  SquareKanban,
  GitBranch,
  Github,
  Tag,
  Pin,
  ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  DescriptionPreview,
  TiptapDescriptionEditor,
} from "@/features/workitems/components/TiptapDescriptionEditor";
import { BacklinksList } from "@/features/mentions";
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
import { useEpics } from "@/features/agile/hooks/useEpics";
import { useSprintsList } from "@/features/sprints/hooks/useSprints";
import { EstimatePicker, useEstimateSystemIdForProject } from "@/features/estimate";
import {
  useWorkItemComments,
  useWorkItemActivity,
  useCreateWorkItemComment,
  useDeleteWorkItemComment,
} from "@/features/workitems/hooks/useWorkItems";
import type { WorkItemActivity } from "@/types";
import { WorkItemTypeBadge } from "@/features/agile/components/WorkItemTypeBadge";
import { useBoardStore } from "../store";
import { boardKeys } from "../hooks/useSprintBoard";
import type {
  WorkItemStatus,
  WorkItemSubtask,
  WorkItemComment,
  Priority,
  WorkItemType,
} from "@/types";
import { WORK_ITEM_TYPES } from "@/types";
import { WORK_ITEM_TYPE_META } from "@/features/workitems/work-item-type-config";
import { useAuthStore } from "@/stores";
import { useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { PropertiesPanel } from "@/features/custom-properties";

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

// ─── Activity tabs ────────────────────────────────────────────────────────────

type ActivityTab = "all" | "comments" | "history" | "worklog";

const ACTIVITY_TABS: { value: ActivityTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "all", label: "All", icon: SquareKanban },
  { value: "comments", label: "Comments", icon: MessageSquare },
  { value: "history", label: "History", icon: History },
  { value: "worklog", label: "Work log", icon: Clock },
];

// ─── Inline text editor ───────────────────────────────────────────────────────

interface InlineTextEditorProps {
  value: string;
  placeholder?: string;
  icon?: React.ReactNode;
  onSave: (value: string) => void;
}

function InlineTextEditor({ value, placeholder, icon, onSave }: InlineTextEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  function handleSave() {
    if (draft !== value) onSave(draft.trim());
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        {icon}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-b border-primary outline-none text-sm placeholder:text-muted-foreground/60"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="flex items-center gap-1.5 hover:text-primary transition-colors text-left w-full"
      onClick={() => { setDraft(value); setEditing(true); }}
    >
      {icon}
      {value ? (
        <span className="text-sm truncate">{value}</span>
      ) : (
        <span className="text-sm text-muted-foreground">{placeholder ?? "None"}</span>
      )}
      <Pencil className="h-3 w-3 ml-auto opacity-0 text-muted-foreground shrink-0" />
    </button>
  );
}

// ─── Date field (opens native picker reliably) ───────────────────────────────

interface DateFieldProps {
  value: string | null;
  onChange: (iso: string | null) => void;
}

function DateField({ value, onChange }: DateFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const el = inputRef.current;
    if (!el) return;
    // showPicker is the reliable cross-browser way to pop the calendar.
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  }

  return (
    <button
      type="button"
      onClick={openPicker}
      className="relative flex items-center gap-1.5 text-sm cursor-pointer hover:text-primary transition-colors text-left"
    >
      <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      {value ? (
        format(new Date(value), "MMM d, yyyy")
      ) : (
        <span className="text-muted-foreground">None</span>
      )}
      <input
        ref={inputRef}
        type="date"
        value={value?.slice(0, 10) ?? ""}
        onChange={(e) =>
          onChange(e.target.value ? `${e.target.value}T00:00:00Z` : null)
        }
        // Kept in-flow but visually collapsed; showPicker() is triggered by the
        // wrapping button so the whole row is clickable.
        className="absolute bottom-0 left-0 h-0 w-0 opacity-0 pointer-events-none"
        tabIndex={-1}
        aria-hidden="true"
      />
    </button>
  );
}

// ─── GitHub PR editor (link when URL) ────────────────────────────────────────

interface GithubPrEditorProps {
  value: string;
  onSave: (value: string) => void;
  onMutateSuccess?: () => void;
}

function GithubPrEditor({ value, onSave }: GithubPrEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  function handleSave() {
    if (draft !== value) onSave(draft.trim());
    setEditing(false);
  }

  const isUrl = value.startsWith("http://") || value.startsWith("https://");

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Github className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
          }}
          placeholder="PR URL or number"
          className="flex-1 bg-transparent border-b border-primary outline-none text-sm placeholder:text-muted-foreground/60"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Github className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      {value ? (
        isUrl ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline truncate flex-1"
          >
            {value}
          </a>
        ) : (
          <span className="text-sm truncate flex-1">{value}</span>
        )
      ) : (
        <span className="text-sm text-muted-foreground">None</span>
      )}
      <button
        type="button"
        onClick={() => { setDraft(value); setEditing(true); }}
        className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
        aria-label="Edit GitHub PR"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── Labels chip editor ───────────────────────────────────────────────────────

interface LabelsEditorProps {
  labels: string[];
  onSave: (labels: string[]) => void;
}

function LabelsEditor({ labels, onSave }: LabelsEditorProps) {
  const [inputValue, setInputValue] = useState("");

  function addLabel() {
    const trimmed = inputValue.trim();
    if (!trimmed || labels.includes(trimmed)) {
      setInputValue("");
      return;
    }
    onSave([...labels, trimmed]);
    setInputValue("");
  }

  function removeLabel(label: string) {
    onSave(labels.filter((l) => l !== label));
  }

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {labels.map((label) => (
        <span
          key={label}
          className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary border border-primary/20"
        >
          <Tag className="h-2.5 w-2.5 shrink-0" />
          {label}
          <button
            type="button"
            onClick={() => removeLabel(label)}
            className="ml-0.5 hover:text-destructive transition-colors"
            aria-label={`Remove ${label}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addLabel();
          }
          if (e.key === "Backspace" && !inputValue && labels.length > 0) {
            removeLabel(labels[labels.length - 1]);
          }
        }}
        onBlur={addLabel}
        placeholder={labels.length === 0 ? "Add label..." : "+"}
        className="flex-1 min-w-[4rem] bg-transparent outline-none text-sm placeholder:text-muted-foreground/60"
      />
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
  const update = useUpdateWorkItemSubtask(workItemId, subtask.id);
  const remove = useDeleteWorkItemSubtask(workItemId);
  const confirm = useConfirm();
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
          onClick={async () => {
            if (
              await confirm({
                title: "Delete this subtask?",
                description: "This cannot be undone.",
                confirmText: "Delete",
                destructive: true,
              })
            )
              remove.mutate(subtask.id);
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      </td>
    </tr>
  );
}

// ─── Pin context (pin Details fields onto the board card) ─────────────────────

interface PinContextValue {
  pinnedFields: string[];
  togglePin: (fieldKey: string) => void;
}

const PinContext = createContext<PinContextValue | null>(null);

// ─── Details rail row ─────────────────────────────────────────────────────────

function DetailRow({
  label,
  fieldKey,
  children,
}: {
  label: string;
  /** When set, a pin toggle is shown that pins this field to the board card. */
  fieldKey?: string;
  children: React.ReactNode;
}) {
  const pinCtx = useContext(PinContext);
  const isPinned = !!fieldKey && !!pinCtx?.pinnedFields.includes(fieldKey);

  return (
    <div className="group/detail flex items-start gap-3 py-2.5">
      <span className="w-24 shrink-0 text-xs text-muted-foreground pt-0.5">{label}</span>
      <div className="flex-1 min-w-0 text-sm">{children}</div>
      {fieldKey && pinCtx && (
        <button
          type="button"
          onClick={() => pinCtx.togglePin(fieldKey)}
          title={isPinned ? "Unpin from card" : "Pin to card"}
          aria-label={isPinned ? "Unpin from card" : "Pin to card"}
          className={cn(
            "mt-0.5 shrink-0 rounded p-0.5 transition-all",
            isPinned
              ? "text-primary"
              : "text-muted-foreground/50 opacity-0 group-hover/detail:opacity-100 hover:text-foreground",
          )}
        >
          <Pin className={cn("h-3.5 w-3.5", isPinned && "fill-current")} />
        </button>
      )}
    </div>
  );
}

// ─── Comment item ─────────────────────────────────────────────────────────────

function CommentItem({
  comment,
  currentUserId,
  workItemId,
}: {
  comment: WorkItemComment;
  currentUserId: string | undefined;
  workItemId: string;
}) {
  const deleteComment = useDeleteWorkItemComment(workItemId);
  const [deleting, setDeleting] = useState(false);
  const isOwn = currentUserId === comment.user_id;

  function handleDelete() {
    setDeleting(true);
    deleteComment.mutate(comment.id, { onSettled: () => setDeleting(false) });
  }

  return (
    <div className="group relative flex gap-2.5 py-3 border-b border-border/50 last:border-0">
      <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-[10px] font-bold text-primary">
        {isOwn ? (
          <User className="h-3.5 w-3.5 text-primary" />
        ) : (
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">{isOwn ? "You" : "Team member"}</span>
          <span
            className="text-xs text-muted-foreground"
            title={format(new Date(comment.created_at), "MMM d, yyyy 'at' h:mm a")}
          >
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm whitespace-pre-wrap break-words">{comment.body}</p>
      </div>
      {isOwn && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-2.5 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Delete comment"
        >
          {deleting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
          )}
        </Button>
      )}
    </div>
  );
}

// ─── Comment compose box ──────────────────────────────────────────────────────

function CommentCompose({
  workItemId,
  userInitial,
}: {
  workItemId: string;
  userInitial: string;
}) {
  const createComment = useCreateWorkItemComment(workItemId);
  const [body, setBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [body]);

  function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed || createComment.isPending) return;
    createComment.mutate({ body: trimmed }, { onSuccess: () => setBody("") });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex items-start gap-2.5">
      <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0 text-[9px] font-bold text-primary-foreground">
        {userInitial}
      </div>
      <div className="flex-1 space-y-2">
        <div className="rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring overflow-hidden">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment… (Cmd+Enter to post)"
            rows={body ? 3 : 1}
            className="w-full resize-none bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[2.5rem] max-h-40"
            disabled={createComment.isPending}
          />
          {body.trim() && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-border/50 bg-muted/30">
              <span className="text-xs text-muted-foreground">Cmd+Enter to post</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setBody("")}
                  className="h-7"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={createComment.isPending || !body.trim()}
                  className="h-7 gap-1.5"
                >
                  {createComment.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  Post
                </Button>
              </div>
            </div>
          )}
        </div>
        {createComment.isError && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Failed to post comment. Please try again.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Activity row ─────────────────────────────────────────────────────────────

const ACTIVITY_FIELD_LABELS: Record<string, string> = {
  created: "created this work item",
  status: "Status",
  priority: "Priority",
  title: "Title",
  due_date: "Due date",
  start_date: "Start date",
  story_points: "Story points",
  sprint: "Sprint",
  parent: "Parent",
};

function ActivityRow({ entry }: { entry: WorkItemActivity }) {
  const label = ACTIVITY_FIELD_LABELS[entry.field] ?? entry.field;
  const when = formatDistanceToNow(new Date(entry.created_at), { addSuffix: true });
  return (
    <div className="flex gap-2.5 py-2 border-b border-border/50 last:border-0 text-sm">
      <History className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        {entry.field === "created" ? (
          <span>{label}</span>
        ) : (
          <span>
            <span className="font-medium">{label}</span>{" "}
            {entry.old_value ? (
              <>
                changed from{" "}
                <span className="text-muted-foreground line-through">{entry.old_value}</span>{" "}
                to <span className="font-medium">{entry.new_value ?? "None"}</span>
              </>
            ) : (
              <>set to <span className="font-medium">{entry.new_value ?? "None"}</span></>
            )}
          </span>
        )}
        <div className="text-xs text-muted-foreground">{when}</div>
      </div>
    </div>
  );
}

// ─── Main sheet ───────────────────────────────────────────────────────────────

interface WorkItemDetailSheetProps {
  /** The board's active sprint id — used to refresh board after mutations */
  sprintId: string;
}

export function WorkItemDetailSheet({ sprintId: _sprintId }: WorkItemDetailSheetProps) {
  const { openItemId, closeItemDetail } = useBoardStore();
  const workItemId = openItemId ?? "";
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const router = useRouter();

  const { data: workItem, isLoading, isError } = useWorkItem(workItemId);
  const setStatus = useSetWorkItemStatus(workItemId);
  const setPoints = useSetWorkItemPoints(workItemId);
  const estimateSystemId = useEstimateSystemIdForProject(workItem?.project_id);
  const updateItem = useUpdateWorkItem(workItemId);
  const createSubtask = useCreateWorkItemSubtask(workItemId);

  const { data: epic } = useEpic(workItem?.epic_id ?? "");
  const { data: sprint } = useSprint(workItem?.sprint_id ?? "");
  const epicOptions = useEpics().data?.data ?? [];
  const sprintOptions = useSprintsList().data?.data ?? [];

  // Comments
  const { data: commentsData, isLoading: commentsLoading } = useWorkItemComments(workItemId);
  const comments = commentsData ?? [];
  const { data: activityData } = useWorkItemActivity(workItemId);
  const activity = activityData ?? [];

  const [activityTab, setActivityTab] = useState<ActivityTab>("all");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
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
  const userInitial = user?.display_name?.[0]?.toUpperCase() ?? "U";

  // Pin / unpin a Details field to the board card.
  const pinnedFields = workItem.pinned_fields ?? [];
  function togglePin(fieldKey: string) {
    const next = pinnedFields.includes(fieldKey)
      ? pinnedFields.filter((k) => k !== fieldKey)
      : [...pinnedFields, fieldKey];
    updateItem.mutate(
      { pinned_fields: next },
      { onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.all }) },
    );
  }

  function handleTitleSave() {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== workItem!.title) {
      updateItem.mutate({ title: trimmed });
    }
    setEditingTitle(false);
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
          qc.invalidateQueries({ queryKey: boardKeys.all });
        },
      },
    );
  }

  const showComments = activityTab === "all" || activityTab === "comments";

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
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 gap-5">
        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div className="flex flex-1 min-w-0 flex-col">
          <ScrollArea className="flex-1">
            <div className="space-y-5 lg:pr-3">
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

                  {/* Open this work item on the full Work Items page */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5"
                    onClick={() => {
                      closeItemDetail();
                      router.push(`/work-items/${workItemId}`);
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open in Work Items
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Description */}
              <div className="space-y-1.5">
                <h2 className="text-sm font-semibold">Description</h2>
                {editingDescription ? (
                  <TiptapDescriptionEditor
                    value={workItem.description}
                    onSave={(html) => {
                      const next = html || null;
                      if (next !== workItem!.description) {
                        updateItem.mutate({ description: next });
                      }
                      setEditingDescription(false);
                    }}
                    onCancel={() => setEditingDescription(false)}
                    sourceId={workItem.id}
                  />
                ) : (
                  <div
                    className="min-h-[2.5rem] cursor-text rounded-md px-0 py-1 transition-colors hover:bg-accent/40"
                    onClick={() => setEditingDescription(true)}
                  >
                    <DescriptionPreview value={workItem.description} />
                  </div>
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

              {/* ── Activity ──────────────────────────────────────────────── */}
              <div className="space-y-3">
                <h2 className="text-sm font-semibold">Activity</h2>

                {/* Tab bar */}
                <div className="flex items-center gap-0 border-b border-border" role="tablist">
                  {ACTIVITY_TABS.map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      role="tab"
                      aria-selected={activityTab === tab.value}
                      onClick={() => setActivityTab(tab.value)}
                      className={cn(
                        "px-3 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                        activityTab === tab.value
                          ? "border-primary text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Comments: shown for "all" and "comments" tabs */}
                {showComments && (
                  <div className="space-y-3">
                    {/* Compose box */}
                    <CommentCompose workItemId={workItemId} userInitial={userInitial} />

                    {/* Comment list */}
                    {commentsLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : comments.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                        <MessageSquare className="h-6 w-6 opacity-40" />
                        <p className="font-medium">No comments yet</p>
                        <p className="text-xs">Be the first to leave a comment.</p>
                      </div>
                    ) : (
                      <div>
                        {comments.map((comment) => (
                          <CommentItem
                            key={comment.id}
                            comment={comment}
                            currentUserId={user?.id}
                            workItemId={workItemId}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* History tab — recorded field changes */}
                {activityTab === "history" && (
                  activity.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                      <History className="h-6 w-6 opacity-40" />
                      <p className="font-medium">No history yet</p>
                      <p className="text-xs">Field changes will appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activity.map((a) => (
                        <ActivityRow key={a.id} entry={a} />
                      ))}
                    </div>
                  )
                )}

                {/* Work log tab — empty state */}
                {activityTab === "worklog" && (
                  <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                    <Clock className="h-6 w-6 opacity-40" />
                    <p className="font-medium">No work log entries yet</p>
                    <p className="text-xs">Logged time entries will appear here.</p>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* ── Right rail ──────────────────────────────────────────────────── */}
        <div className="w-full lg:w-80 xl:w-96 lg:shrink-0 flex flex-col gap-3">
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
                                queryKey: boardKeys.all,
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
            <PinContext.Provider value={{ pinnedFields, togglePin }}>
            <div className="px-3 py-1 divide-y divide-border">
              {/* Type — editable */}
              <DetailRow label="Type" fieldKey="type">
                <DropdownMenuPrimitive.Root>
                  <DropdownMenuPrimitive.Trigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex items-center gap-1.5 text-sm font-medium hover:opacity-80 transition-opacity",
                        WORK_ITEM_TYPE_META[workItem.type]?.text,
                      )}
                    >
                      <WorkItemTypeBadge type={workItem.type} />
                      {WORK_ITEM_TYPE_META[workItem.type]?.label ?? workItem.type}
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </button>
                  </DropdownMenuPrimitive.Trigger>
                  <DropdownMenuPrimitive.Portal>
                    <DropdownMenuPrimitive.Content
                      align="start"
                      sideOffset={4}
                      className="z-50 max-h-72 overflow-y-auto min-w-[10rem] rounded-md border bg-popover p-1 shadow-md"
                    >
                      {WORK_ITEM_TYPES.map((t) => (
                        <DropdownMenuPrimitive.Item
                          key={t}
                          onSelect={() =>
                            updateItem.mutate(
                              { type: t },
                              {
                                onSuccess: () =>
                                  qc.invalidateQueries({ queryKey: boardKeys.all }),
                              },
                            )
                          }
                          className={cn(
                            "flex cursor-default select-none items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent",
                            WORK_ITEM_TYPE_META[t].text,
                          )}
                        >
                          <WorkItemTypeBadge type={t} />
                          {WORK_ITEM_TYPE_META[t].label}
                          {workItem.type === t && <Check className="h-3 w-3 ml-auto" />}
                        </DropdownMenuPrimitive.Item>
                      ))}
                    </DropdownMenuPrimitive.Content>
                  </DropdownMenuPrimitive.Portal>
                </DropdownMenuPrimitive.Root>
              </DetailRow>

              {/* Assignee */}
              <DetailRow label="Assignee" fieldKey="assignee">
                <div className="flex items-center gap-1.5">
                  <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-sm">{user?.display_name ?? "Unassigned"}</span>
                </div>
              </DetailRow>

              {/* Priority — editable */}
              <DetailRow label="Priority" fieldKey="priority">
                <DropdownMenuPrimitive.Root>
                  <DropdownMenuPrimitive.Trigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex items-center gap-1.5 text-sm font-medium hover:opacity-80 transition-opacity",
                        PRIORITY_COLORS[workItem.priority],
                      )}
                    >
                      <Flag className="h-3.5 w-3.5" />
                      {PRIORITY_LABELS[workItem.priority]}
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </button>
                  </DropdownMenuPrimitive.Trigger>
                  <DropdownMenuPrimitive.Portal>
                    <DropdownMenuPrimitive.Content
                      align="start"
                      sideOffset={4}
                      className="z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 shadow-md"
                    >
                      {(["critical", "high", "medium", "low"] as Priority[]).map(
                        (p) => (
                          <DropdownMenuPrimitive.Item
                            key={p}
                            onSelect={() =>
                              updateItem.mutate(
                                { priority: p },
                                {
                                  onSuccess: () =>
                                    qc.invalidateQueries({ queryKey: boardKeys.all }),
                                },
                              )
                            }
                            className={cn(
                              "flex cursor-default select-none items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent",
                              PRIORITY_COLORS[p],
                            )}
                          >
                            <Flag className="h-3.5 w-3.5" />
                            {PRIORITY_LABELS[p]}
                            {workItem.priority === p && (
                              <Check className="h-3 w-3 ml-auto" />
                            )}
                          </DropdownMenuPrimitive.Item>
                        ),
                      )}
                    </DropdownMenuPrimitive.Content>
                  </DropdownMenuPrimitive.Portal>
                </DropdownMenuPrimitive.Root>
              </DetailRow>

              {/* Parent (epic) — editable dropdown */}
              <DetailRow label="Parent" fieldKey="parent">
                <DropdownMenuPrimitive.Root>
                  <DropdownMenuPrimitive.Trigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors max-w-full"
                    >
                      <Layers className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{epic ? epic.title : "None"}</span>
                      <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
                    </button>
                  </DropdownMenuPrimitive.Trigger>
                  <DropdownMenuPrimitive.Portal>
                    <DropdownMenuPrimitive.Content
                      align="start"
                      sideOffset={4}
                      className="z-50 max-h-64 min-w-[10rem] overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
                    >
                      <DropdownMenuPrimitive.Item
                        onSelect={() =>
                          updateItem.mutate(
                            { epic_id: null },
                            { onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.all }) },
                          )
                        }
                        className="flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                      >
                        None
                        {!workItem.epic_id && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuPrimitive.Item>
                      {epicOptions.map((e) => (
                        <DropdownMenuPrimitive.Item
                          key={e.id}
                          onSelect={() =>
                            updateItem.mutate(
                              { epic_id: e.id },
                              { onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.all }) },
                            )
                          }
                          className="flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                        >
                          <span className="truncate">{e.title}</span>
                          {workItem.epic_id === e.id && (
                            <Check className="h-3 w-3 ml-auto shrink-0" />
                          )}
                        </DropdownMenuPrimitive.Item>
                      ))}
                    </DropdownMenuPrimitive.Content>
                  </DropdownMenuPrimitive.Portal>
                </DropdownMenuPrimitive.Root>
              </DetailRow>

              {/* Due date — editable */}
              <DetailRow label="Due date" fieldKey="due_date">
                <DateField
                  value={workItem.due_date ?? null}
                  onChange={(due_date) =>
                    updateItem.mutate(
                      { due_date },
                      { onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.all }) },
                    )
                  }
                />
              </DetailRow>

              {/* Labels — chip input */}
              <DetailRow label="Labels" fieldKey="labels">
                <LabelsEditor
                  labels={workItem.labels ?? []}
                  onSave={(labels) =>
                    updateItem.mutate(
                      { labels },
                      { onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.all }) },
                    )
                  }
                />
              </DetailRow>

              {/* Start date — editable */}
              <DetailRow label="Start date" fieldKey="start_date">
                <DateField
                  value={workItem.start_date ?? null}
                  onChange={(start_date) =>
                    updateItem.mutate(
                      { start_date },
                      { onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.all }) },
                    )
                  }
                />
              </DetailRow>

              {/* Sprint — editable dropdown */}
              <DetailRow label="Sprint" fieldKey="sprint">
                <DropdownMenuPrimitive.Root>
                  <DropdownMenuPrimitive.Trigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors max-w-full"
                    >
                      <Zap className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{sprint ? sprint.name : "Backlog"}</span>
                      <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
                    </button>
                  </DropdownMenuPrimitive.Trigger>
                  <DropdownMenuPrimitive.Portal>
                    <DropdownMenuPrimitive.Content
                      align="start"
                      sideOffset={4}
                      className="z-50 max-h-64 min-w-[10rem] overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
                    >
                      <DropdownMenuPrimitive.Item
                        onSelect={() =>
                          updateItem.mutate(
                            { sprint_id: null },
                            { onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.all }) },
                          )
                        }
                        className="flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                      >
                        Backlog
                        {!workItem.sprint_id && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuPrimitive.Item>
                      {sprintOptions.map((sp) => (
                        <DropdownMenuPrimitive.Item
                          key={sp.id}
                          onSelect={() =>
                            updateItem.mutate(
                              { sprint_id: sp.id },
                              { onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.all }) },
                            )
                          }
                          className="flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                        >
                          <span className="truncate">{sp.name}</span>
                          {workItem.sprint_id === sp.id && (
                            <Check className="h-3 w-3 ml-auto shrink-0" />
                          )}
                        </DropdownMenuPrimitive.Item>
                      ))}
                    </DropdownMenuPrimitive.Content>
                  </DropdownMenuPrimitive.Portal>
                </DropdownMenuPrimitive.Root>
              </DetailRow>

              {/* Story point estimate — scale of the item's project estimate system */}
              <DetailRow label="Story points" fieldKey="story_points">
                <EstimatePicker
                  compact
                  systemId={estimateSystemId}
                  value={workItem.story_points}
                  disabled={setPoints.isPending}
                  onChange={(pt) =>
                    setPoints.mutate(
                      { story_points: pt },
                      {
                        onSuccess: () => {
                          qc.invalidateQueries({
                            queryKey: boardKeys.all,
                          });
                        },
                      },
                    )
                  }
                />
              </DetailRow>

              {/* GitHub repo — inline text input */}
              <DetailRow label="GitHub repo" fieldKey="github_repo">
                <InlineTextEditor
                  value={workItem.github_repo ?? ""}
                  placeholder="owner/repo"
                  icon={<Github className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  onSave={(val) =>
                    updateItem.mutate(
                      { github_repo: val || null },
                      { onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.all }) },
                    )
                  }
                />
              </DetailRow>

              {/* GitHub branch — inline text input */}
              <DetailRow label="GitHub branch" fieldKey="github_branch">
                <InlineTextEditor
                  value={workItem.github_branch ?? ""}
                  placeholder="branch-name"
                  icon={<GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  onSave={(val) =>
                    updateItem.mutate(
                      { github_branch: val || null },
                      { onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.all }) },
                    )
                  }
                />
              </DetailRow>

              {/* GitHub PR — inline text/link */}
              <DetailRow label="GitHub PR" fieldKey="github_pr">
                <GithubPrEditor
                  value={workItem.github_pr ?? ""}
                  onSave={(val) =>
                    updateItem.mutate(
                      { github_pr: val || null },
                      { onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.all }) },
                    )
                  }
                />
              </DetailRow>

              {/* Reporter */}
              <DetailRow label="Reporter" fieldKey="reporter">
                <div className="flex items-center gap-1.5">
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-[9px] font-bold text-primary-foreground">
                      {userInitial}
                    </span>
                  </div>
                  <span className="text-sm">{user?.display_name ?? "You"}</span>
                </div>
              </DetailRow>
            </div>
            </PinContext.Provider>

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
  // Resizable width — persisted across opens (desktop only; mobile is always full-width).
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 920;
    const saved = Number(localStorage.getItem("mml_sheet_width"));
    return saved >= 480 ? saved : 920;
  });
  const dragging = useRef(false);
  // Track the most recent width in a ref so the mouseup handler can save it
  // without needing `width` in the dependency array (which would re-add/remove
  // the listener on every resize step).
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return;
      const newWidth = Math.min(
        Math.max(window.innerWidth - e.clientX, 480),
        Math.min(1200, window.innerWidth - 80),
      );
      setWidth(newWidth);
    }
    function onUp() {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.userSelect = "";
        localStorage.setItem("mml_sheet_width", String(widthRef.current));
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []); // empty dep array — handlers read state via refs

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 dark:bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel
           - Mobile (< sm): full viewport width.
           - Desktop (sm+): explicit pixel width driven by the resize state,
             capped at 100vw so it never overflows.  Using an explicit `width`
             (not just maxWidth) is what makes the panel visibly grow/shrink
             as the user drags the left edge.
      */}
      <div
        className="relative ml-auto flex flex-col bg-background border-l shadow-2xl h-full overflow-hidden
                   w-full sm:w-auto"
        style={{
          // On sm+ this explicit width overrides the `w-auto` baseline and
          // allows drag-resizing.  On mobile the `w-full` class wins because
          // the inline style is overridden by the responsive class in Tailwind
          // (sm breakpoint media query has higher specificity than inline style
          // in most browsers, but we guard it via the isMobile check below).
          ...(typeof window !== "undefined" && window.innerWidth >= 640
            ? { width: `${width}px`, maxWidth: "100vw" }
            : {}),
        }}
      >
        {/* Resize handle — left edge, desktop only.
            w-2 (8 px) makes it noticeably easier to grab than the original w-1.5. */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            dragging.current = true;
            document.body.style.userSelect = "none";
          }}
          className="group/resize absolute left-0 top-0 h-full w-3 cursor-ew-resize z-30
                     hidden sm:flex items-center justify-center"
          aria-label="Resize panel"
          role="separator"
          aria-orientation="vertical"
          title="Drag to resize"
        >
          {/* Persistent thin rail + grip so it's discoverable */}
          <span className="absolute inset-y-0 left-0 w-px bg-border group-hover/resize:bg-primary/50 transition-colors" />
          <span className="h-8 w-1 rounded-full bg-border group-hover/resize:bg-primary/60 transition-colors" />
        </div>

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
        <div className="flex flex-1 flex-col p-4 sm:p-6 pt-12 min-h-0 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
