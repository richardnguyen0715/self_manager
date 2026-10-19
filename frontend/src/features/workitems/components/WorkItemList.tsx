"use client";

import { EstimateBadge } from "@/features/estimate";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { format, isPast, isToday } from "date-fns";
import {
  Plus,
  SquareKanban,
  Loader2,
  AlertCircle,
  Search,
  X,
  Calendar,
  Trash2,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Flag,
  Tag,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type {
  WorkItemListItem,
  WorkItemType,
  WorkItemStatus,
  Priority,
  Sprint,
} from "@/types";
import { WORK_ITEM_TYPES } from "@/types";
import { WORK_ITEM_TYPE_META } from "../work-item-type-config";
import {
  useWorkItems,
  useDeleteWorkItem,
  useBulkUpdateWorkItems,
  useSetWorkItemStatus,
  useUpdateWorkItem,
} from "../hooks/useWorkItems";
import type { BulkWorkItemPatch, BulkWorkItemPayload } from "../types";
import { useSprintsList } from "@/features/sprints/hooks/useSprints";
import {
  useWorkItemUIStore,
  useWorkItemDisplayStore,
  type WorkItemGroupBy,
  type WorkItemOrderBy,
  type WorkItemOrderDir,
  type WorkItemDisplayProperties,
} from "../store";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useProjectStore } from "@/stores";
import { WorkItemStatusBadge, WORK_ITEM_STATUS_CONFIG } from "./WorkItemStatusBadge";
import { WorkItemTypeBadge } from "./WorkItemTypeBadge";
import { WorkItemPriorityBadge, PRIORITY_CONFIG } from "./WorkItemPriorityBadge";
import { CreateWorkItemDialog } from "./CreateWorkItemDialog";
import { SavedViewsBar } from "@/features/saved-views/components/SavedViewsBar";
import { ItemKeyChip } from "@/components/ui/item-key-chip";

// ─── Filter bar selects ────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: WorkItemType | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  ...WORK_ITEM_TYPES.map((t) => ({ value: t, label: WORK_ITEM_TYPE_META[t].label })),
];

const STATUS_OPTIONS: { value: WorkItemStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "In Review" },
  { value: "done", label: "Done" },
];

const PRIORITY_OPTIONS: { value: Priority | "all"; label: string }[] = [
  { value: "all", label: "All priorities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

// ─── Inline select ─────────────────────────────────────────────────────────────

function FilterSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─── Display options (group / order / properties) ─────────────────────────────

const GROUP_BY_OPTIONS: { value: WorkItemGroupBy; label: string }[] = [
  { value: "none", label: "None" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "type", label: "Type" },
];

const ORDER_BY_OPTIONS: { value: WorkItemOrderBy; label: string }[] = [
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "priority", label: "Priority" },
  { value: "due_date", label: "Due date" },
  { value: "title", label: "Title" },
];

const PROPERTY_OPTIONS: { key: keyof WorkItemDisplayProperties; label: string }[] = [
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "points", label: "Points" },
  { key: "due", label: "Due" },
];

const STATUS_CHOICES = STATUS_OPTIONS.filter(
  (o): o is { value: WorkItemStatus; label: string } => o.value !== "all",
);
const PRIORITY_CHOICES = PRIORITY_OPTIONS.filter(
  (o): o is { value: Priority; label: string } => o.value !== "all",
);

const PRIORITY_RANK: Record<Priority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/** Client-side ordering. Stable; items without a due date always sort last. */
function sortItems(
  items: WorkItemListItem[],
  orderBy: WorkItemOrderBy,
  dir: WorkItemOrderDir,
): WorkItemListItem[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    if (orderBy === "due_date") {
      if (!a.due_date || !b.due_date) return a.due_date ? -1 : b.due_date ? 1 : 0;
      return sign * (Date.parse(a.due_date) - Date.parse(b.due_date));
    }
    let cmp: number;
    switch (orderBy) {
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
      case "priority":
        cmp = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        break;
      case "updated":
        cmp = Date.parse(a.updated_at) - Date.parse(b.updated_at);
        break;
      default:
        cmp = Date.parse(a.created_at) - Date.parse(b.created_at);
    }
    return sign * cmp;
  });
}

interface ItemGroup {
  key: string;
  label: string;
  items: WorkItemListItem[];
}

/** Partition already-ordered items into groups; empty groups are omitted. */
function groupItems(
  items: WorkItemListItem[],
  groupBy: WorkItemGroupBy,
): ItemGroup[] {
  if (groupBy === "none") return [{ key: "all", label: "", items }];

  const keyOf = (i: WorkItemListItem): string =>
    groupBy === "status" ? i.status : groupBy === "priority" ? i.priority : i.type;
  const labelOf = (k: string): string =>
    groupBy === "status"
      ? WORK_ITEM_STATUS_CONFIG[k as WorkItemStatus].label
      : groupBy === "priority"
        ? PRIORITY_CONFIG[k as Priority].label
        : WORK_ITEM_TYPE_META[k as WorkItemType].label;
  const orderedKeys: string[] =
    groupBy === "status"
      ? STATUS_CHOICES.map((o) => o.value)
      : groupBy === "priority"
        ? PRIORITY_CHOICES.map((o) => o.value)
        : [...WORK_ITEM_TYPES];

  const buckets = new Map<string, WorkItemListItem[]>();
  for (const item of items) {
    const k = keyOf(item);
    const bucket = buckets.get(k);
    if (bucket) bucket.push(item);
    else buckets.set(k, [item]);
  }

  return orderedKeys
    .filter((k) => buckets.has(k))
    .map((k) => ({
      key: `${groupBy}:${k}`,
      label: labelOf(k),
      items: buckets.get(k) ?? [],
    }));
}

/**
 * Small popover with a type-to-filter list. Used for inline status / priority
 * editing in a row. Enter picks the highlighted option, Esc closes (Radix).
 * Radix flips the panel upward when there is no room below.
 */
function InlineOptionPicker<T extends string>({
  value,
  options,
  onSelect,
  disabled,
  ariaLabel,
  triggerClassName,
  children,
}: {
  value: T;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  onSelect: (v: T) => void;
  disabled?: boolean;
  ariaLabel: string;
  triggerClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const needle = query.trim().toLowerCase();
  const filtered = options.filter((o) => o.label.toLowerCase().includes(needle));

  function choose(v: T) {
    setOpen(false);
    if (v !== value) onSelect(v);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = filtered[active] ?? filtered[0];
      if (pick) choose(pick.value);
    }
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuery("");
          setActive(0);
        }
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex shrink-0 rounded-md transition-opacity hover:opacity-80 disabled:cursor-default disabled:opacity-60",
            triggerClassName,
          )}
        >
          {children}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          avoidCollisions
          onClick={(e) => e.stopPropagation()}
          className="z-50 w-52 rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none"
        >
          <Input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Filter..."
            className="h-8 text-sm"
          />
          <div role="listbox" className="mt-1 max-h-64 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No matches
              </div>
            )}
            {filtered.map((o, i) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o.value)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                  i === active && "bg-accent text-accent-foreground",
                  o.value === value && "font-medium",
                )}
              >
                {o.icon}
                {o.label}
              </button>
            ))}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** "Display" button + panel: group by, order by (with direction), properties. */
function DisplayMenu() {
  const groupBy = useWorkItemDisplayStore((s) => s.groupBy);
  const orderBy = useWorkItemDisplayStore((s) => s.orderBy);
  const orderDir = useWorkItemDisplayStore((s) => s.orderDir);
  const properties = useWorkItemDisplayStore((s) => s.properties);
  const setDisplay = useWorkItemDisplayStore((s) => s.setDisplay);
  const [open, setOpen] = useState(false);

  function toggleProperty(key: keyof WorkItemDisplayProperties) {
    setDisplay({ properties: { ...properties, [key]: !properties[key] } });
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Display
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className="z-50 w-72 space-y-3 rounded-md border bg-popover p-3 text-popover-foreground shadow-md outline-none"
        >
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Group by</span>
            <FilterSelect<WorkItemGroupBy>
              value={groupBy}
              onChange={(v) => setDisplay({ groupBy: v })}
              options={GROUP_BY_OPTIONS}
            />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Order by</span>
            <div className="flex items-center gap-2">
              <FilterSelect<WorkItemOrderBy>
                value={orderBy}
                onChange={(v) => setDisplay({ orderBy: v })}
                options={ORDER_BY_OPTIONS}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2"
                aria-label={orderDir === "asc" ? "Ascending" : "Descending"}
                onClick={() =>
                  setDisplay({ orderDir: orderDir === "asc" ? "desc" : "asc" })
                }
              >
                {orderDir === "asc" ? (
                  <ArrowUp className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDown className="h-3.5 w-3.5" />
                )}
                {orderDir === "asc" ? "Asc" : "Desc"}
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Properties</span>
            <div className="flex flex-wrap gap-1.5">
              {PROPERTY_OPTIONS.map((p) => {
                const on = properties[p.key];
                return (
                  <button
                    key={p.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleProperty(p.key)}
                    className={cn(
                      "h-7 rounded-full border px-3 text-xs font-medium transition-colors",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

// ─── Empty / error states ──────────────────────────────────────────────────────

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  const { openCreateDialog, resetFilters } = useWorkItemUIStore();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <SquareKanban className="h-10 w-10 text-muted-foreground/50 mb-3" />
      <p className="text-sm font-medium">
        {hasFilters ? "No work items match your filters" : "No work items yet"}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {hasFilters
          ? "Try adjusting the filters or search query."
          : "Create your first work item to get started."}
      </p>
      {hasFilters ? (
        <Button
          variant="outline"
          size="sm"
          onClick={resetFilters}
          className="mt-4"
        >
          Clear filters
        </Button>
      ) : (
        <Button size="sm" onClick={openCreateDialog} className="mt-4 gap-1.5">
          <Plus className="h-4 w-4" />
          Create work item
        </Button>
      )}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <AlertCircle className="h-10 w-10 text-destructive/60 mb-3" />
      <p className="text-sm font-medium text-destructive">
        Failed to load work items
      </p>
      <p className="text-xs text-muted-foreground mt-1">{message}</p>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
      <span className="h-4 w-4 rounded bg-muted shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 bg-muted rounded w-1/2" />
      </div>
      <div className="h-5 w-16 bg-muted rounded hidden sm:block" />
      <div className="h-5 w-14 bg-muted rounded hidden md:block" />
      <div className="h-5 w-8 bg-muted rounded hidden md:block" />
    </div>
  );
}

// ─── Bulk actions ─────────────────────────────────────────────────────────────

const BACKLOG_CHOICE = "__backlog__";

/** Dropdown used by the bulk action bar. Options are plain value/label pairs. */
function BulkMenu({
  label,
  options,
  disabled,
  onSelect,
}: {
  label: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-8 gap-1"
        >
          {label}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          side="top"
          align="center"
          sideOffset={8}
          className="z-50 max-h-72 min-w-[10rem] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {options.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              Nothing to choose
            </div>
          )}
          {options.map((o) => (
            <DropdownMenuPrimitive.Item
              key={o.value}
              onSelect={() => onSelect(o.value)}
              className="flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground"
            >
              {o.label}
            </DropdownMenuPrimitive.Item>
          ))}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}

/** Floating bar shown while one or more rows are selected. */
function BulkActionBar({
  count,
  disabled,
  error,
  sprints,
  onPatch,
  onDelete,
  onClear,
}: {
  count: number;
  disabled: boolean;
  error: string | null;
  sprints: Sprint[];
  onPatch: (patch: BulkWorkItemPatch) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const [labelOpen, setLabelOpen] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");

  function closeLabel() {
    setLabelOpen(false);
    setLabelDraft("");
  }

  function submitLabel(e: React.FormEvent) {
    e.preventDefault();
    const label = labelDraft.trim();
    if (!label) return;
    onPatch({ add_labels: [label] });
    closeLabel();
  }

  const statusChoices = STATUS_OPTIONS.filter((o) => o.value !== "all");
  const typeChoices = TYPE_OPTIONS.filter((o) => o.value !== "all");
  const priorityChoices = PRIORITY_OPTIONS.filter((o) => o.value !== "all");

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-lg"
    >
      <span className="text-sm font-medium tabular-nums">{count} selected</span>
      <span className="h-5 w-px bg-border" aria-hidden />

      <BulkMenu
        label="Status"
        disabled={disabled}
        options={statusChoices}
        onSelect={(v) => onPatch({ status: v as WorkItemStatus })}
      />
      <BulkMenu
        label="Priority"
        disabled={disabled}
        options={priorityChoices}
        onSelect={(v) => onPatch({ priority: v as Priority })}
      />
      <BulkMenu
        label="Type"
        disabled={disabled}
        options={typeChoices}
        onSelect={(v) => onPatch({ type: v as WorkItemType })}
      />
      <BulkMenu
        label="Move to sprint"
        disabled={disabled}
        options={[
          { value: BACKLOG_CHOICE, label: "Backlog (no sprint)" },
          ...sprints.map((s) => ({ value: s.id, label: s.name })),
        ]}
        onSelect={(v) =>
          v === BACKLOG_CHOICE
            ? onPatch({ clear_sprint: true })
            : onPatch({ sprint_id: v })
        }
      />

      {labelOpen ? (
        <form onSubmit={submitLabel} className="flex items-center gap-1">
          <Input
            autoFocus
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                closeLabel();
              }
            }}
            placeholder="Label name"
            maxLength={50}
            className="h-8 w-36 text-sm"
          />
          <Button
            type="submit"
            size="sm"
            className="h-8"
            disabled={disabled || !labelDraft.trim()}
          >
            Add
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={closeLabel}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          disabled={disabled}
          onClick={() => setLabelOpen(true)}
        >
          <Tag className="h-3.5 w-3.5" />
          Add label
        </Button>
      )}

      <Button
        variant="destructive"
        size="sm"
        className="h-8 gap-1.5"
        disabled={disabled}
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </Button>
      <Button variant="ghost" size="sm" className="h-8" onClick={onClear}>
        Clear
      </Button>

      {error && (
        <p role="alert" className="basis-full text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Row──────────────────────────────────────────────────────────────────────

function WorkItemRow({
  item,
  index,
  selected,
  onToggleSelect,
  properties,
}: {
  item: WorkItemListItem;
  index: number;
  selected: boolean;
  onToggleSelect: (index: number, shiftKey: boolean) => void;
  properties: WorkItemDisplayProperties;
}) {
  const deleteItem = useDeleteWorkItem();
  const setStatus = useSetWorkItemStatus(item.id);
  const updateItem = useUpdateWorkItem(item.id);
  const confirm = useConfirm();

  const hasSubtasks = (item.subtask_count ?? 0) > 0;

  const dueMeta = item.due_date
    ? (() => {
        const d = new Date(item.due_date);
        const overdue = isPast(d) && !isToday(d);
        const today = isToday(d);
        return {
          label: today ? "Today" : format(d, "MMM d"),
          overdue,
          today,
        };
      })()
    : null;

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

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors border-b border-border/50 last:border-0",
        selected && "bg-accent/30",
      )}
    >
      {/* Row selection (shift-click selects a range) */}
      <input
        type="checkbox"
        aria-label={`Select ${item.title}`}
        checked={selected}
        onChange={() => {}}
        onClick={(e) => onToggleSelect(index, e.shiftKey)}
        className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
      />

      {/* Type icon */}
      <WorkItemTypeBadge type={item.type} className="shrink-0" />

      {/* Title */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/work-items/${item.id}`}
          className="text-sm font-medium hover:text-primary transition-colors truncate block"
        >
          <ItemKeyChip itemKey={item.key} className="mr-1.5 align-middle" />
          {item.title}
        </Link>
        {hasSubtasks && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {item.done_subtask_count ?? 0}/{item.subtask_count} subtasks
          </span>
        )}
      </div>

      {/* Status (click to change inline) */}
      {properties.status && (
        <InlineOptionPicker<WorkItemStatus>
          value={item.status}
          ariaLabel={`Change status of ${item.title}`}
          triggerClassName="hidden sm:inline-flex"
          disabled={setStatus.isPending}
          options={STATUS_CHOICES.map((o) => ({
            value: o.value,
            label: o.label,
            icon: (
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full shrink-0",
                  WORK_ITEM_STATUS_CONFIG[o.value].dotClass,
                )}
                aria-hidden="true"
              />
            ),
          }))}
          onSelect={(status) => setStatus.mutate({ status })}
        >
          <WorkItemStatusBadge status={item.status} />
        </InlineOptionPicker>
      )}

      {/* Priority (click to change inline) */}
      {properties.priority && (
        <InlineOptionPicker<Priority>
          value={item.priority}
          ariaLabel={`Change priority of ${item.title}`}
          triggerClassName="hidden md:inline-flex"
          disabled={updateItem.isPending}
          options={PRIORITY_CHOICES.map((o) => ({
            value: o.value,
            label: o.label,
            icon: (
              <Flag
                className={cn("h-3.5 w-3.5 shrink-0", PRIORITY_CONFIG[o.value].className)}
                aria-hidden="true"
              />
            ),
          }))}
          onSelect={(priority) => updateItem.mutate({ priority })}
        >
          <WorkItemPriorityBadge priority={item.priority} showLabel={false} />
        </InlineOptionPicker>
      )}

      {/* Story points */}
      {properties.points && (
        <span className="text-xs tabular-nums text-muted-foreground w-8 text-center shrink-0 hidden md:block">
          <EstimateBadge projectId={item.project_id} value={item.story_points} />
        </span>
      )}

      {/* Due date */}
      {!properties.due ? null : dueMeta ? (
        <span
          className={cn(
            "hidden sm:inline-flex items-center gap-1 text-xs shrink-0",
            dueMeta.overdue
              ? "text-red-600 dark:text-red-400 font-medium"
              : dueMeta.today
                ? "text-amber-600 dark:text-amber-400 font-medium"
                : "text-muted-foreground",
          )}
        >
          <Calendar className="h-3 w-3" />
          {dueMeta.label}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground w-14 text-right shrink-0 hidden sm:block whitespace-nowrap">
          Set date
        </span>
      )}

      {/* Actions menu (hover) */}
      <DropdownMenuPrimitive.Root>
        <DropdownMenuPrimitive.Trigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100"
            onClick={(e) => e.preventDefault()}
            aria-label="Work item actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuPrimitive.Trigger>
        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-[10rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
          >
            <DropdownMenuPrimitive.Item asChild>
              <Link
                href={`/work-items/${item.id}`}
                className="flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none gap-2 focus:bg-accent focus:text-accent-foreground"
              >
                Open
              </Link>
            </DropdownMenuPrimitive.Item>
            <DropdownMenuPrimitive.Separator className="my-1 h-px bg-border" />
            <DropdownMenuPrimitive.Item
              onSelect={handleDelete}
              className="flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none gap-2 focus:bg-destructive/10 focus:text-destructive text-destructive"
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

// ─── Main list ────────────────────────────────────────────────────────────────

export function WorkItemList() {
  const { filters, openCreateDialog, setFilter, resetFilters } =
    useWorkItemUIStore();
  const { currentProjectId } = useProjectStore();

  const [searchValue, setSearchValue] = useState(filters.search ?? "");
  // Search commits 300ms after typing stops, or immediately on Enter.
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedSearchRef = useRef(filters.search ?? "");

  const groupBy = useWorkItemDisplayStore((s) => s.groupBy);
  const orderBy = useWorkItemDisplayStore((s) => s.orderBy);
  const orderDir = useWorkItemDisplayStore((s) => s.orderDir);
  const properties = useWorkItemDisplayStore((s) => s.properties);

  const { data, isLoading, isError, error, isFetching } = useWorkItems({
    status: filters.status !== "all" ? filters.status : undefined,
    type: filters.type !== "all" ? filters.type : undefined,
    priority: filters.priority !== "all" ? filters.priority : undefined,
    search: filters.search || undefined,
    project_id: currentProjectId ?? undefined,
  });

  const rawItems = useMemo<WorkItemListItem[]>(() => data?.data ?? [], [data]);
  // Display order (client-side). `items` is the flat visible order used for
  // selection; `groups` only partitions it for rendering.
  const items = useMemo(
    () => sortItems(rawItems, orderBy, orderDir),
    [rawItems, orderBy, orderDir],
  );
  const groups = useMemo(() => groupItems(items, groupBy), [items, groupBy]);
  const indexById = useMemo(
    () => new Map(items.map((i, n) => [i.id, n])),
    [items],
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    {},
  );
  const total = data?.total ?? 0;

  // Pick up external filter changes (saved view applied, filters reset).
  useEffect(() => {
    const next = filters.search ?? "";
    if (next !== committedSearchRef.current) {
      committedSearchRef.current = next;
      setSearchValue(next);
    }
  }, [filters.search]);

  useEffect(
    () => () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    },
    [],
  );

  function commitSearch(value: string) {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    committedSearchRef.current = value;
    setFilter("search", value);
  }

  function handleSearchChange(value: string) {
    setSearchValue(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      searchTimerRef.current = null;
      commitSearch(value);
    }, 300);
  }

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // ── Bulk selection ──────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkError, setBulkError] = useState<string | null>(null);
  const anchorRef = useRef<number | null>(null);
  const headerCheckRef = useRef<HTMLInputElement>(null);
  const bulk = useBulkUpdateWorkItems();
  const confirm = useConfirm();
  const { data: sprintData } = useSprintsList(
    { project_id: currentProjectId },
    { limit: 100 },
  );
  const activeSprints = (sprintData?.data ?? []).filter(
    (s) => s.status !== "completed",
  );

  // Drop selections that are no longer visible (filter/search/refetch changes).
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(items.map((i) => i.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const selectedCount = selectedIds.size;
  const allVisibleSelected =
    items.length > 0 && items.every((i) => selectedIds.has(i.id));

  useEffect(() => {
    if (headerCheckRef.current) {
      headerCheckRef.current.indeterminate =
        selectedCount > 0 && !allVisibleSelected;
    }
  }, [selectedCount, allVisibleSelected]);

  // Escape clears the selection (ignored while typing or when a dialog/menu is open).
  useEffect(() => {
    if (selectedCount === 0) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;
      setSelectedIds(new Set());
      setBulkError(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedCount]);

  function toggleRow(index: number, shiftKey: boolean) {
    const anchor = anchorRef.current;
    if (shiftKey && anchor !== null && anchor < items.length) {
      const lo = Math.min(anchor, index);
      const hi = Math.max(anchor, index);
      const rangeIds = items.slice(lo, hi + 1).map((i) => i.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        rangeIds.forEach((id) => next.add(id));
        return next;
      });
    } else {
      const id = items[index].id;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
    anchorRef.current = index;
  }

  function toggleAllVisible() {
    setSelectedIds(
      allVisibleSelected ? new Set() : new Set(items.map((i) => i.id)),
    );
    anchorRef.current = null;
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setBulkError(null);
    anchorRef.current = null;
  }

  function runBulk(payload: BulkWorkItemPayload, onDone?: () => void) {
    setBulkError(null);
    bulk.mutate(payload, {
      onSuccess: () => onDone?.(),
      onError: (err) =>
        setBulkError(err instanceof Error ? err.message : "Bulk action failed"),
    });
  }

  function applyPatch(patch: BulkWorkItemPatch) {
    runBulk({ ids: Array.from(selectedIds), action: "update", patch });
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (
      !(await confirm({
        title: `Delete ${ids.length} work item${ids.length === 1 ? "" : "s"}?`,
        description: "They will be moved to the trash.",
        confirmText: "Delete",
        destructive: true,
      }))
    )
      return;
    runBulk({ ids, action: "delete" }, clearSelection);
  }

  const hasActiveFilters =
    filters.status !== "all" ||
    filters.type !== "all" ||
    filters.priority !== "all" ||
    Boolean(filters.search);

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      commitSearch(searchValue);
    }
  }

  function clearSearch() {
    setSearchValue("");
    commitSearch("");
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Work Items</h1>
          {total > 0 && (
            <span className="text-sm text-muted-foreground tabular-nums">
              ({total})
            </span>
          )}
          {isFetching && !isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <Button onClick={openCreateDialog} size="sm" className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New work item</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      {/* Saved views */}
      <SavedViewsBar />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Search */}
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search titles..."
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="h-8 pl-8 pr-7 w-full sm:w-48 text-sm"
          />
          {searchValue && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <FilterSelect<WorkItemType | "all">
          value={filters.type ?? "all"}
          onChange={(v) => setFilter("type", v)}
          options={TYPE_OPTIONS}
        />
        <FilterSelect<WorkItemStatus | "all">
          value={filters.status ?? "all"}
          onChange={(v) => setFilter("status", v)}
          options={STATUS_OPTIONS}
        />
        <FilterSelect<Priority | "all">
          value={filters.priority ?? "all"}
          onChange={(v) => setFilter("priority", v)}
          options={PRIORITY_OPTIONS}
        />

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}

        <div className="ml-auto">
          <DisplayMenu />
        </div>
      </div>

      <Separator className="mb-3" />

      {/* Table header */}
      {!isLoading && !isError && items.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-1.5 text-xs font-medium text-muted-foreground border-b border-border bg-muted/30 rounded-t-md">
          <input
            ref={headerCheckRef}
            type="checkbox"
            aria-label="Select all visible work items"
            checked={allVisibleSelected}
            onChange={toggleAllVisible}
            className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
          />
          <span className="flex-1">Title</span>
          {properties.status && (
            <span className="w-20 hidden sm:block">Status</span>
          )}
          {properties.priority && (
            <span className="w-8 hidden md:block text-center">Pri.</span>
          )}
          {properties.points && (
            <span className="w-8 hidden md:block text-center">Pts</span>
          )}
          {properties.due && (
            <span className="w-14 text-right hidden sm:block">Due</span>
          )}
          <span className="w-7 shrink-0" />
        </div>
      )}

      {/* List */}
      <div
        className={cn(
          "flex-1 overflow-hidden rounded-md border bg-card",
          "flex flex-col",
          items.length > 0 && "rounded-t-none border-t-0",
        )}
      >
        {isError ? (
          <ErrorState
            message={
              error instanceof Error ? error.message : "Unknown error occurred"
            }
          />
        ) : isLoading ? (
          <div className="divide-y divide-border/50">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState hasFilters={hasActiveFilters} />
        ) : (
          <ScrollArea className="flex-1">
            <div className="py-1">
              {groups.map((group) => {
                const collapsed = Boolean(collapsedGroups[group.key]);
                return (
                  <div key={group.key}>
                    {groupBy !== "none" && (
                      <button
                        type="button"
                        aria-expanded={!collapsed}
                        onClick={() => toggleGroup(group.key)}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-semibold text-muted-foreground hover:bg-accent/30 transition-colors"
                      >
                        <ChevronRight
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 transition-transform",
                            !collapsed && "rotate-90",
                          )}
                        />
                        <span className="text-foreground">{group.label}</span>
                        <span className="tabular-nums">· {group.items.length}</span>
                      </button>
                    )}
                    {!collapsed &&
                      group.items.map((item) => (
                        <WorkItemRow
                          key={item.id}
                          item={item}
                          index={indexById.get(item.id) ?? 0}
                          selected={selectedIds.has(item.id)}
                          onToggleSelect={toggleRow}
                          properties={properties}
                        />
                      ))}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <BulkActionBar
          count={selectedCount}
          disabled={bulk.isPending}
          error={bulkError}
          sprints={activeSprints}
          onPatch={applyPatch}
          onDelete={handleBulkDelete}
          onClear={clearSelection}
        />
      )}

      {/* Create dialog */}
      <CreateWorkItemDialog />
    </div>
  );
}
