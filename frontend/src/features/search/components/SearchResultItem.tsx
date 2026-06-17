"use client";

import { useRouter } from "next/navigation";
import {
  CheckSquare,
  FolderOpen,
  Activity,
  AlertCircle,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  Minus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import type { SearchResult, SearchResultTask } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

// ─── Priority icon + colour ────────────────────────────────────────────────────

function PriorityIndicator({ priority }: { priority: SearchResultTask["priority"] }) {
  const map = {
    critical: { icon: AlertCircle, className: "text-red-500" },
    high: { icon: ArrowUp, className: "text-orange-500" },
    medium: { icon: ArrowRight, className: "text-yellow-500" },
    low: { icon: ArrowDown, className: "text-blue-500" },
  } as const;

  const entry = map[priority as keyof typeof map];
  const Icon = entry?.icon ?? Minus;
  const className = entry?.className ?? "text-muted-foreground";

  return <Icon className={cn("h-3.5 w-3.5 shrink-0", className)} aria-hidden />;
}

// ─── Kind icon + label ─────────────────────────────────────────────────────────

const KIND_META = {
  task: { icon: CheckSquare, label: "Task", color: "text-blue-600 dark:text-blue-400" },
  project: { icon: FolderOpen, label: "Project", color: "text-violet-600 dark:text-violet-400" },
  habit: { icon: Activity, label: "Habit", color: "text-pink-600 dark:text-pink-400" },
} as const;

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0 shrink-0">
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

// ─── Display title (tasks use `title`; projects and habits use `name`) ─────────

function getDisplayTitle(result: SearchResult): string {
  if (result.kind === "task") return result.title;
  return result.name;
}

// ─── Sub-text builders ─────────────────────────────────────────────────────────

function buildSubText(result: SearchResult): string | null {
  switch (result.kind) {
    case "task":
      return result.due_date ? `due ${formatDate(result.due_date)}` : null;
    case "project":
      return result.deadline ? `deadline ${formatDate(result.deadline)}` : null;
    case "habit":
      return result.archived ? "Archived" : null;
  }
}

// ─── Navigation helpers ────────────────────────────────────────────────────────

function getHref(result: SearchResult): string {
  switch (result.kind) {
    case "task":
      return `/tasks?id=${result.id}`;
    case "project":
      return `/goals?project=${result.id}`;
    case "habit":
      return `/habits?id=${result.id}`;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SearchResultItemProps {
  result: SearchResult;
  /** Called after navigation so the parent (command palette) can close. */
  onNavigate?: () => void;
  className?: string;
}

export function SearchResultItem({
  result,
  onNavigate,
  className,
}: SearchResultItemProps) {
  const router = useRouter();
  const meta = KIND_META[result.kind];
  const KindIcon = meta.icon;
  const displayTitle = getDisplayTitle(result);
  const subText = buildSubText(result);
  const href = getHref(result);

  function handleClick() {
    router.push(href);
    onNavigate?.();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  }

  return (
    <div
      role="option"
      tabIndex={0}
      aria-selected={false}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5",
        "transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
        className,
      )}
    >
      {/* Kind icon */}
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted",
          meta.color,
        )}
        aria-hidden
      >
        <KindIcon className="h-3.5 w-3.5" />
      </span>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {result.kind === "task" && (
            <PriorityIndicator priority={result.priority} />
          )}
          <span className="truncate text-sm font-medium text-foreground leading-tight">
            {displayTitle}
          </span>
          {(result.kind === "task" || result.kind === "project") && (
            <StatusBadge status={result.status} />
          )}
        </div>
        {subText && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {subText}
          </p>
        )}
      </div>

      {/* Kind label chip */}
      <span
        className={cn(
          "hidden shrink-0 text-[10px] font-medium sm:block",
          meta.color,
        )}
      >
        {meta.label}
      </span>
    </div>
  );
}
