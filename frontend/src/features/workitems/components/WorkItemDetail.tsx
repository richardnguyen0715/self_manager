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
  Globe,
  Paperclip,
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
  Trash2,
  Download,
  SquareKanban,
  MessageSquare,
  Clock,
  History,
  FileIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  useWorkItem,
  useSetWorkItemStatus,
  useSetWorkItemPoints,
  useCreateWorkItemSubtask,
  useUpdateWorkItemSubtask,
  useDeleteWorkItemSubtask,
  useUpdateWorkItem,
  useDeleteWorkItem,
  useEpicById,
  useSprintById,
  useWorkItemLinks,
  useAddWorkItemLink,
  useDeleteWorkItemLink,
  useWebLinks,
  useAddWebLink,
  useDeleteWebLink,
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
  useWorkItems,
} from "../hooks/useWorkItems";
import { WorkItemTypeBadge } from "./WorkItemTypeBadge";
import { WORK_ITEM_STATUS_CONFIG } from "./WorkItemStatusBadge";
import { PRIORITY_CONFIG } from "./WorkItemPriorityBadge";
import type { WorkItemStatus, WorkItemSubtask } from "@/types";
import type { WorkItemLink, WorkItemWebLink, WorkItemAttachment } from "../types";
import { useAuthStore } from "@/stores";
import { useEpics } from "@/features/agile/hooks/useEpics";
import { useSprintsList } from "@/features/sprints/hooks/useSprints";

const NEXT_PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES = Object.entries(WORK_ITEM_STATUS_CONFIG).map(
  ([value, cfg]) => ({
    value: value as WorkItemStatus,
    label: cfg.label,
    badgeClass: cfg.badgeClass,
    dotClass: cfg.dotClass,
  }),
);

const STORY_POINTS = [null, 1, 3, 5, 8] as const;

// ─── Linked work item picker ───────────────────────────────────────────────────

interface LinkPickerProps {
  workItemId: string;
  onClose: () => void;
}

function LinkPicker({ workItemId, onClose }: LinkPickerProps) {
  const [search, setSearch] = useState("");
  const addLink = useAddWorkItemLink(workItemId);
  const { data: list } = useWorkItems({ search: search || undefined, limit: 20 });
  const items = list?.data ?? [];

  function handlePick(targetId: string) {
    addLink.mutate(
      { target_work_item_id: targetId, link_type: "relates_to" },
      { onSuccess: onClose },
    );
  }

  return (
    <div className="rounded-md border bg-popover shadow-md p-3 space-y-2 w-full sm:w-72">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Link work item</span>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>
      <input
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search work items..."
        className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="max-h-48 overflow-y-auto space-y-0.5">
        {items.filter((i) => i.id !== workItemId).map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={addLink.isPending}
            onClick={() => handlePick(item.id)}
            className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors truncate"
          >
            {item.title}
          </button>
        ))}
        {items.filter((i) => i.id !== workItemId).length === 0 && (
          <p className="text-xs text-muted-foreground px-2 py-1">
            No work items found.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Linked item row ──────────────────────────────────────────────────────────

interface LinkedItemRowProps {
  link: WorkItemLink;
  workItemId: string;
}

function LinkedItemRow({ link, workItemId }: LinkedItemRowProps) {
  const remove = useDeleteWorkItemLink(workItemId);
  return (
    <div className="group flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
      <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="flex-1 text-sm truncate">{link.target_title}</span>
      <span className="text-xs text-muted-foreground shrink-0">{link.link_type.replace(/_/g, " ")}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={() => remove.mutate(link.id)}
        disabled={remove.isPending}
        aria-label="Remove link"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ─── Web link row ─────────────────────────────────────────────────────────────

interface WebLinkRowProps {
  link: WorkItemWebLink;
  workItemId: string;
}

function WebLinkRow({ link, workItemId }: WebLinkRowProps) {
  const remove = useDeleteWebLink(workItemId);
  return (
    <div className="group flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
      <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 text-sm text-primary hover:underline truncate"
      >
        {link.title || link.url}
      </a>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={() => remove.mutate(link.id)}
        disabled={remove.isPending}
        aria-label="Remove web link"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ─── Attachment row ───────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AttachmentRowProps {
  attachment: WorkItemAttachment;
  workItemId: string;
}

function AttachmentRow({ attachment, workItemId }: AttachmentRowProps) {
  const remove = useDeleteAttachment(workItemId);
  const isImage = attachment.mime_type?.startsWith("image/") ?? false;
  const fileUrl = NEXT_PUBLIC_API_URL + attachment.url;

  return (
    <div className="group flex items-start gap-2 py-2 border-b border-border/50 last:border-0">
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
        {isImage ? (
          <img
            src={fileUrl}
            alt={attachment.filename}
            className="h-14 w-14 rounded object-cover border border-border hover:opacity-80 transition-opacity"
          />
        ) : (
          <div className="h-10 w-10 rounded border border-border flex items-center justify-center bg-muted hover:bg-accent transition-colors">
            <FileIcon className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </a>
      <div className="flex-1 min-w-0">
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm truncate font-medium text-primary hover:underline block"
        >
          {attachment.filename}
        </a>
        {attachment.size_bytes != null && (
          <p className="text-xs text-muted-foreground">{formatBytes(attachment.size_bytes)}</p>
        )}
      </div>
      <a
        href={fileUrl}
        download={attachment.filename}
        className="h-6 w-6 inline-flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1 text-muted-foreground hover:bg-accent"
        aria-label="Download attachment"
      >
        <Download className="h-3.5 w-3.5" />
      </a>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1"
        onClick={() => remove.mutate(attachment.id)}
        disabled={remove.isPending}
        aria-label="Remove attachment"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

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
    const trimmed = title.trim();
    if (trimmed && trimmed !== subtask.title) {
      update.mutate({ title: trimmed });
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
      {/* Checkbox */}
      <td className="py-2 pl-3 pr-1 w-7">
        <button
          type="button"
          onClick={handleToggle}
          disabled={update.isPending}
          className={cn(
            "h-4 w-4 rounded border border-input flex items-center justify-center shrink-0 transition-colors",
            subtask.is_done
              ? "bg-emerald-500 border-emerald-500 text-white"
              : "hover:border-primary",
            update.isPending && "opacity-50 cursor-not-allowed",
          )}
          aria-label={subtask.is_done ? "Mark incomplete" : "Mark done"}
        >
          {subtask.is_done && <Check className="h-2.5 w-2.5" />}
        </button>
      </td>

      {/* Title */}
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
            role="button"
            tabIndex={0}
            onClick={() => setEditing(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setEditing(true);
              }
            }}
            className={cn(
              "cursor-text",
              subtask.is_done && "line-through text-muted-foreground",
            )}
          >
            {subtask.title}
          </span>
        )}
      </td>

      {/* Delete action */}
      <td className="py-2 px-2 text-right w-8">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => {
            if (confirm("Delete this subtask?")) remove.mutate(subtask.id);
          }}
          aria-label="Delete subtask"
        >
          <X className="h-3 w-3" />
        </Button>
      </td>
    </tr>
  );
}

// ─── Detail rail row ──────────────────────────────────────────────────────────

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
      <span className="w-28 shrink-0 text-xs text-muted-foreground leading-5 pt-0.5">
        {label}
      </span>
      <div className="flex-1 min-w-0 text-sm">{children}</div>
    </div>
  );
}

// ─── Activity tabs ────────────────────────────────────────────────────────────

type ActivityTab = "all" | "comments" | "history" | "worklog";

const ACTIVITY_TABS: { value: ActivityTab; label: string; icon: React.ComponentType<{ className?: string }> }[] =
  [
    { value: "all", label: "All", icon: SquareKanban },
    { value: "comments", label: "Comments", icon: MessageSquare },
    { value: "history", label: "History", icon: History },
    { value: "worklog", label: "Work log", icon: Clock },
  ];

// ─── Main component ───────────────────────────────────────────────────────────

interface WorkItemDetailProps {
  workItemId: string;
}

export function WorkItemDetail({ workItemId }: WorkItemDetailProps) {
  const router = useRouter();
  const { user } = useAuthStore();

  // ── Data ──
  const { data: workItem, isLoading, isError } = useWorkItem(workItemId);
  const setStatus = useSetWorkItemStatus(workItemId);
  const setPoints = useSetWorkItemPoints(workItemId);
  const updateItem = useUpdateWorkItem(workItemId);
  const deleteItem = useDeleteWorkItem();
  const createSubtask = useCreateWorkItemSubtask(workItemId);

  const { data: epic } = useEpicById(workItem?.epic_id ?? "");
  const { data: sprint } = useSprintById(workItem?.sprint_id ?? "");
  const epicOptions = useEpics().data?.data ?? [];
  const sprintOptions = useSprintsList().data?.data ?? [];

  // ── Links / web-links / attachments data ──
  const { data: linkedItemsData } = useWorkItemLinks(workItemId);
  const { data: webLinksData } = useWebLinks(workItemId);
  const { data: attachmentsData } = useAttachments(workItemId);
  const uploadAttachment = useUploadAttachment(workItemId);
  const addWebLink = useAddWebLink(workItemId);

  // ── UI state ──
  const [activityTab, setActivityTab] = useState<ActivityTab>("all");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const subtaskInputRef = useRef<HTMLInputElement>(null);

  // ── Links / web-links / attachments UI state ──
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [showAddWebLink, setShowAddWebLink] = useState(false);
  const [webLinkUrl, setWebLinkUrl] = useState("");
  const [webLinkTitle, setWebLinkTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const linkedItems = linkedItemsData ?? [];
  const webLinks = webLinksData ?? [];
  const attachments = attachmentsData ?? [];

  useEffect(() => {
    if (isAddingSubtask) subtaskInputRef.current?.focus();
  }, [isAddingSubtask]);

  // ── Loading / error ──────────────────────────────────────────────────────────
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

  // ── Derived values ──────────────────────────────────────────────────────────
  const subtasks = workItem.subtasks ?? [];
  const doneCount = subtasks.filter((s) => s.is_done).length;
  const totalCount = subtasks.length;
  const progressPct =
    totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const currentStatusCfg =
    WORK_ITEM_STATUS_CONFIG[workItem.status] ?? WORK_ITEM_STATUS_CONFIG.backlog;
  const currentPriorityCfg =
    PRIORITY_CONFIG[workItem.priority] ?? PRIORITY_CONFIG.medium;

  // ── Handlers ────────────────────────────────────────────────────────────────
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

  function handleDelete() {
    if (confirm(`Delete "${workItem!.title}"? This cannot be undone.`)) {
      deleteItem.mutate(workItem!.id, {
        onSuccess: () => router.push("/work-items"),
      });
    }
  }

  function handleAddWebLink() {
    const url = webLinkUrl.trim();
    if (!url) return;
    addWebLink.mutate(
      { url, title: webLinkTitle.trim() || undefined },
      {
        onSuccess: () => {
          setWebLinkUrl("");
          setWebLinkTitle("");
          setShowAddWebLink(false);
        },
      },
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    uploadAttachment.mutate(fd, {
      onSuccess: () => {
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex lg:h-full lg:min-h-0 flex-col">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4 flex-wrap">
        <button
          type="button"
          className="hover:text-foreground transition-colors"
          onClick={() => router.push("/work-items")}
        >
          Work Items
        </button>
        {epic && (
          <>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <button
              type="button"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => router.push(`/work-items?epic_id=${epic.id}`)}
            >
              <Layers className="h-3 w-3" />
              <span className="truncate max-w-[12rem]">{epic.title}</span>
            </button>
          </>
        )}
        <ChevronRight className="h-3 w-3 shrink-0" />
        <WorkItemTypeBadge type={workItem.type} showLabel />
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row lg:flex-1 lg:min-h-0 gap-6">
        {/* ── Left column ─────────────────────────────────────────────── */}
        <ScrollArea className="lg:flex-1 min-w-0">
          <div className="space-y-6 pr-0 lg:pr-4 pb-6">
            {/* Title + action buttons */}
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
                  className="w-full text-2xl font-bold bg-transparent border-b-2 border-primary outline-none leading-tight"
                />
              ) : (
                <h1
                  role="button"
                  tabIndex={0}
                  className="text-2xl font-bold leading-tight cursor-text hover:opacity-80 transition-opacity"
                  onClick={() => {
                    setTitleDraft(workItem.title);
                    setEditingTitle(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setTitleDraft(workItem.title);
                      setEditingTitle(true);
                    }
                  }}
                >
                  {workItem.title}
                </h1>
              )}

              {/* + and ... toolbar */}
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
                      className="z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
                    >
                      <DropdownMenuPrimitive.Item
                        onSelect={() => setIsAddingSubtask(true)}
                        className="flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                      >
                        <CheckSquare className="h-3.5 w-3.5" />
                        Create subtask
                      </DropdownMenuPrimitive.Item>
                      <DropdownMenuPrimitive.Item
                        onSelect={() => setShowLinkPicker(true)}
                        className="flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        Link work item
                      </DropdownMenuPrimitive.Item>
                      <DropdownMenuPrimitive.Item
                        onSelect={() => setShowAddWebLink(true)}
                        className="flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        Add web link
                      </DropdownMenuPrimitive.Item>
                      <DropdownMenuPrimitive.Item
                        onSelect={() => fileInputRef.current?.click()}
                        className="flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        Add attachment
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
                      className="z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
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
                      <DropdownMenuPrimitive.Separator className="my-1 h-px bg-border" />
                      <DropdownMenuPrimitive.Item
                        onSelect={handleDelete}
                        className="flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-destructive/10 focus:text-destructive text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
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
                    placeholder="Add a description..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
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
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "min-h-[3rem] cursor-text rounded-md px-1 py-1 text-sm transition-colors hover:bg-accent/40 whitespace-pre-wrap",
                    !workItem.description && "text-muted-foreground italic",
                  )}
                  onClick={() => {
                    setDescriptionDraft(workItem.description ?? "");
                    setEditingDescription(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setDescriptionDraft(workItem.description ?? "");
                      setEditingDescription(true);
                    }
                  }}
                >
                  {workItem.description || "Add a description..."}
                </div>
              )}
            </div>

            <Separator />

            {/* Subtasks */}
            <div className="space-y-3">
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
                <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                    aria-hidden="true"
                  />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap w-16 text-right">
                  {progressPct}% Done
                </span>
              </div>

              {/* Subtask table */}
              {(subtasks.length > 0 || isAddingSubtask) && (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-xs text-muted-foreground">
                        <th className="w-7 py-2 pl-3" aria-hidden="true" />
                        <th className="py-2 px-2 text-left font-medium">
                          Work
                        </th>
                        <th className="py-2 px-2 w-8" aria-hidden="true" />
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
                        <tr className="border-t border-border">
                          <td className="py-2 pl-3 pr-1 w-7">
                            <div className="h-4 w-4 rounded border border-input" />
                          </td>
                          <td className="py-2 px-2" colSpan={2}>
                            <input
                              ref={subtaskInputRef}
                              value={newSubtaskTitle}
                              onChange={(e) =>
                                setNewSubtaskTitle(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleAddSubtask();
                                if (e.key === "Escape") {
                                  setIsAddingSubtask(false);
                                  setNewSubtaskTitle("");
                                }
                              }}
                              placeholder="Subtask title..."
                              className="w-full bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                            />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {isAddingSubtask && (
                    <div className="flex gap-2 px-3 py-2 bg-muted/30 border-t border-border">
                      <Button
                        size="sm"
                        onClick={handleAddSubtask}
                        disabled={
                          createSubtask.isPending || !newSubtaskTitle.trim()
                        }
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

            {/* Linked work items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Linked work items</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowLinkPicker((v) => !v)}
                  aria-label="Add linked work item"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {showLinkPicker && (
                <LinkPicker
                  workItemId={workItemId}
                  onClose={() => setShowLinkPicker(false)}
                />
              )}

              {linkedItems.length > 0 ? (
                <div className="rounded-md border overflow-hidden">
                  {linkedItems.map((link) => (
                    <LinkedItemRow
                      key={link.id}
                      link={link}
                      workItemId={workItemId}
                    />
                  ))}
                </div>
              ) : (
                !showLinkPicker && (
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowLinkPicker(true)}
                  >
                    <span className="flex items-center gap-1.5">
                      <Link2 className="h-3.5 w-3.5" />
                      Add linked work item
                    </span>
                  </button>
                )
              )}
            </div>

            <Separator />

            {/* Web links */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Web links</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowAddWebLink((v) => !v)}
                  aria-label="Add web link"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {showAddWebLink && (
                <div className="rounded-md border p-3 space-y-2">
                  <input
                    autoFocus
                    value={webLinkUrl}
                    onChange={(e) => setWebLinkUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddWebLink();
                      if (e.key === "Escape") setShowAddWebLink(false);
                    }}
                    placeholder="https://..."
                    className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    value={webLinkTitle}
                    onChange={(e) => setWebLinkTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddWebLink();
                      if (e.key === "Escape") setShowAddWebLink(false);
                    }}
                    placeholder="Title (optional)"
                    className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleAddWebLink}
                      disabled={addWebLink.isPending || !webLinkUrl.trim()}
                    >
                      {addWebLink.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Add"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowAddWebLink(false);
                        setWebLinkUrl("");
                        setWebLinkTitle("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {webLinks.length > 0 ? (
                <div className="rounded-md border overflow-hidden px-3">
                  {webLinks.map((link) => (
                    <WebLinkRow
                      key={link.id}
                      link={link}
                      workItemId={workItemId}
                    />
                  ))}
                </div>
              ) : (
                !showAddWebLink && (
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowAddWebLink(true)}
                  >
                    <span className="flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5" />
                      Add web link
                    </span>
                  </button>
                )
              )}
            </div>

            <Separator />

            {/* Attachments */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Attachments</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Add attachment"
                  disabled={uploadAttachment.isPending}
                >
                  {uploadAttachment.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>

              {/* hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,*/*"
                className="sr-only"
                onChange={handleFileChange}
              />

              {attachments.length > 0 ? (
                <div className="rounded-md border overflow-hidden px-3">
                  {attachments.map((att) => (
                    <AttachmentRow
                      key={att.id}
                      attachment={att}
                      workItemId={workItemId}
                    />
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" />
                    Add attachment
                  </span>
                </button>
              )}
            </div>

            <Separator />

            {/* Activity */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Activity</h2>

              {/* Tab bar */}
              <div
                className="flex items-center gap-0 border-b border-border"
                role="tablist"
              >
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

              {/* Comment composer */}
              <div className="flex items-start gap-3">
                <div
                  className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-semibold text-primary"
                  aria-hidden="true"
                >
                  {user?.display_name?.[0]?.toUpperCase() ?? "U"}
                </div>
                <div className="flex-1">
                  {commentDraft ? (
                    <div className="space-y-2">
                      <textarea
                        autoFocus
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        rows={3}
                        placeholder="Add a comment..."
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none placeholder:text-muted-foreground"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          disabled
                          title="Comment feature — coming soon"
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setCommentDraft("")}
                        >
                          Cancel
                        </Button>
                        <span className="text-xs text-muted-foreground ml-auto">
                          Press M to comment
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setCommentDraft(" ")}
                      onKeyDown={(e) => {
                        if (e.key === "m" || e.key === "Enter") {
                          setCommentDraft(" ");
                        }
                      }}
                      className="rounded-md border border-input px-3 py-2 text-sm text-muted-foreground min-h-[2.5rem] cursor-text hover:border-ring transition-colors"
                    >
                      Add a comment...
                    </div>
                  )}
                </div>
              </div>

              {/* Activity tab content — history/worklog placeholders */}
              {(activityTab === "history" || activityTab === "worklog") && (
                <p className="text-sm text-muted-foreground py-2">
                  {activityTab === "history"
                    ? "No history recorded yet."
                    : "No work log entries yet."}
                </p>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* ── Right rail ──────────────────────────────────────────────── */}
        <div className="w-full lg:w-72 lg:shrink-0 space-y-4">
          {/* Status dropdown */}
          <DropdownMenuPrimitive.Root>
            <DropdownMenuPrimitive.Trigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "gap-2 font-semibold w-full justify-between border-transparent",
                  currentStatusCfg.badgeClass,
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      currentStatusCfg.dotClass,
                    )}
                    aria-hidden="true"
                  />
                  {currentStatusCfg.label}
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-70 shrink-0" />
              </Button>
            </DropdownMenuPrimitive.Trigger>
            <DropdownMenuPrimitive.Portal>
              <DropdownMenuPrimitive.Content
                align="end"
                sideOffset={4}
                className="z-50 min-w-[11rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
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
                      className={cn("h-2 w-2 rounded-full", s.dotClass)}
                      aria-hidden="true"
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

          {/* Details panel */}
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold">Details</h3>
            </div>

            <div className="px-4 py-1">
              {/* Assignee */}
              <DetailRow label="Assignee">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <User className="h-3 w-3 text-primary" />
                  </div>
                  <span>{user?.display_name ?? "Unassigned"}</span>
                </div>
              </DetailRow>

              {/* Priority — inline editable dropdown */}
              <DetailRow label="Priority">
                <DropdownMenuPrimitive.Root>
                  <DropdownMenuPrimitive.Trigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex items-center gap-1.5 font-medium hover:opacity-80 transition-opacity",
                        currentPriorityCfg.className,
                      )}
                    >
                      <Flag className="h-3.5 w-3.5 shrink-0" />
                      {currentPriorityCfg.label}
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </button>
                  </DropdownMenuPrimitive.Trigger>
                  <DropdownMenuPrimitive.Portal>
                    <DropdownMenuPrimitive.Content
                      align="start"
                      sideOffset={4}
                      className="z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
                    >
                      {(["critical", "high", "medium", "low"] as const).map(
                        (p) => (
                          <DropdownMenuPrimitive.Item
                            key={p}
                            onSelect={() => updateItem.mutate({ priority: p })}
                            className={cn(
                              "flex cursor-default select-none items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent",
                              PRIORITY_CONFIG[p].className,
                            )}
                          >
                            <Flag className="h-3.5 w-3.5 shrink-0" />
                            {PRIORITY_CONFIG[p].label}
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

              {/* Parent (epic) — inline editable dropdown */}
              <DetailRow label="Parent">
                <DropdownMenuPrimitive.Root>
                  <DropdownMenuPrimitive.Trigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 hover:text-primary transition-colors max-w-full"
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
                        onSelect={() => updateItem.mutate({ epic_id: null })}
                        className="flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                      >
                        None
                        {!workItem.epic_id && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuPrimitive.Item>
                      {epicOptions.map((e) => (
                        <DropdownMenuPrimitive.Item
                          key={e.id}
                          onSelect={() => updateItem.mutate({ epic_id: e.id })}
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

              {/* Due date — inline editable */}
              <DetailRow label="Due date">
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-primary transition-colors">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {workItem.due_date ? (
                    format(new Date(workItem.due_date), "MMM d, yyyy")
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                  <input
                    type="date"
                    value={workItem.due_date?.slice(0, 10) ?? ""}
                    onChange={(e) =>
                      updateItem.mutate({
                        due_date: e.target.value
                          ? `${e.target.value}T00:00:00Z`
                          : null,
                      })
                    }
                    className="sr-only"
                  />
                </label>
              </DetailRow>

              {/* Labels — placeholder */}
              <DetailRow label="Labels">
                <span className="text-muted-foreground">None</span>
              </DetailRow>

              {/* Start date — not in work_item contract field, shown as placeholder */}
              <DetailRow label="Start date">
                <span className="text-muted-foreground">None</span>
              </DetailRow>

              {/* Sprint — inline editable dropdown */}
              <DetailRow label="Sprint">
                <DropdownMenuPrimitive.Root>
                  <DropdownMenuPrimitive.Trigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 hover:text-primary transition-colors max-w-full"
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
                        onSelect={() => updateItem.mutate({ sprint_id: null })}
                        className="flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                      >
                        Backlog
                        {!workItem.sprint_id && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuPrimitive.Item>
                      {sprintOptions.map((sp) => (
                        <DropdownMenuPrimitive.Item
                          key={sp.id}
                          onSelect={() => updateItem.mutate({ sprint_id: sp.id })}
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

              {/* Story points — inline editable dropdown */}
              <DetailRow label="Story points">
                <DropdownMenuPrimitive.Root>
                  <DropdownMenuPrimitive.Trigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 hover:text-primary transition-colors"
                    >
                      <span className="tabular-nums">
                        {workItem.story_points != null
                          ? workItem.story_points
                          : "None"}
                      </span>
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </button>
                  </DropdownMenuPrimitive.Trigger>
                  <DropdownMenuPrimitive.Portal>
                    <DropdownMenuPrimitive.Content
                      align="start"
                      sideOffset={4}
                      className="z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
                    >
                      {STORY_POINTS.map((pt) => (
                        <DropdownMenuPrimitive.Item
                          key={pt ?? "null"}
                          onSelect={() =>
                            setPoints.mutate({ story_points: pt })
                          }
                          className="flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                        >
                          {pt == null ? "None" : pt}
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
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-primary-foreground">
                      {user?.display_name?.[0]?.toUpperCase() ?? "U"}
                    </span>
                  </div>
                  <span>{user?.display_name ?? "You"}</span>
                </div>
              </DetailRow>
            </div>

            {/* Footer timestamps */}
            <div className="px-4 py-3 border-t text-xs text-muted-foreground space-y-0.5">
              <p>
                Created{" "}
                {format(
                  new Date(workItem.created_at),
                  "MMM d, yyyy 'at' h:mm a",
                )}
              </p>
              <p>
                Updated{" "}
                {format(
                  new Date(workItem.updated_at),
                  "MMM d, yyyy 'at' h:mm a",
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
