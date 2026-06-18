"use client";

import { useState, useMemo } from "react";
import {
  Loader2,
  AlertCircle,
  ClipboardCheck,
  ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { SprintStatus } from "@/types";
import { useSprintsForReview, useReviewSprint } from "../hooks/useReviews";
import { SprintReviewPanel } from "./SprintReviewPanel";
import { RetrospectivePanel } from "./RetrospectivePanel";
import { VelocityChart } from "./VelocityChart";
import type { ReviewTab } from "../types";

// ─── Status badge config ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<SprintStatus, { label: string; className: string }> = {
  active: {
    label: "Active",
    className:
      "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  planned: {
    label: "Planned",
    className:
      "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  },
  completed: {
    label: "Completed",
    className:
      "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
};

// ─── Sprint selector ──────────────────────────────────────────────────────────

interface SprintSelectorProps {
  selectedId: string;
  onChange: (id: string) => void;
}

function SprintSelector({ selectedId, onChange }: SprintSelectorProps) {
  const { data, isLoading } = useSprintsForReview();
  // Sort: active first, then planned, then completed (most recent first)
  const sprints = useMemo(() => {
    const all = data?.data ?? [];
    const order: SprintStatus[] = ["active", "planned", "completed"];
    return [...all].sort(
      (a, b) =>
        order.indexOf(a.status) - order.indexOf(b.status) ||
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
    );
  }, [data?.data]);

  const selected = sprints.find((s) => s.id === selectedId);

  return (
    <SelectPrimitive.Root value={selectedId} onValueChange={onChange}>
      <SelectPrimitive.Trigger
        className={cn(
          "flex h-9 w-full max-w-sm items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm gap-2",
          "focus:outline-none focus:ring-1 focus:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          isLoading && "opacity-60 pointer-events-none",
        )}
        aria-label="Select sprint"
      >
        <span className="truncate">
          {isLoading
            ? "Loading sprints…"
            : selected
              ? selected.name
              : "Select a sprint"}
        </span>
        <SelectPrimitive.Icon>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            "z-50 min-w-[18rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:translate-y-1",
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {sprints.length === 0 && !isLoading && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No sprints found.
              </div>
            )}
            {sprints.map((sprint) => {
              const cfg = STATUS_CONFIG[sprint.status];
              return (
                <SelectPrimitive.Item
                  key={sprint.id}
                  value={sprint.id}
                  className={cn(
                    "relative flex w-full cursor-default select-none items-center rounded-sm py-2 pl-8 pr-3 text-sm outline-none",
                    "focus:bg-accent focus:text-accent-foreground",
                  )}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check className="h-4 w-4" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <div className="flex items-center justify-between w-full gap-3 min-w-0">
                    <span className="truncate font-medium">{sprint.name}</span>
                    <Badge className={cn(cfg.className, "text-[10px] shrink-0")}>
                      {cfg.label}
                    </Badge>
                  </div>
                </SelectPrimitive.Item>
              );
            })}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

const TABS: { value: ReviewTab; label: string }[] = [
  { value: "review", label: "Sprint Review" },
  { value: "retrospective", label: "Retrospective" },
];

interface TabBarProps {
  active: ReviewTab;
  onChange: (tab: ReviewTab) => void;
}

function TabBar({ active, onChange }: TabBarProps) {
  return (
    <div className="border-b border-border flex gap-1" role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={active === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            active === tab.value
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Sprint meta header ───────────────────────────────────────────────────────

interface SprintMetaProps {
  sprintId: string;
}

function SprintMeta({ sprintId }: SprintMetaProps) {
  const { data: sprint, isLoading } = useReviewSprint(sprintId);

  if (isLoading) {
    return (
      <div className="h-8 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading sprint…</span>
      </div>
    );
  }

  if (!sprint) return null;

  const cfg = STATUS_CONFIG[sprint.status];

  return (
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="text-lg font-semibold">{sprint.name}</h2>
      <Badge className={cn(cfg.className, "text-xs")}>{cfg.label}</Badge>
      <span className="text-sm text-muted-foreground">
        {format(new Date(sprint.start_date), "MMM d")} –{" "}
        {format(new Date(sprint.end_date), "MMM d, yyyy")}
      </span>
      {sprint.goal_text && (
        <span className="text-sm text-muted-foreground italic">
          "{sprint.goal_text}"
        </span>
      )}
    </div>
  );
}

// ─── Main ReviewsView ─────────────────────────────────────────────────────────

/**
 * Top-level Reviews screen.
 *
 * Renders:
 *   1. Sprint selector dropdown (all sprints, sorted by status)
 *   2. Sprint meta header (name, status badge, date range)
 *   3. Tabbed content: Sprint Review | Retrospective
 *   4. Velocity history chart (bottom section)
 */
export function ReviewsView() {
  const { data: sprintList, isLoading: listLoading } = useSprintsForReview();

  // Default to first sprint (active or most recent)
  const sprints = sprintList?.data ?? [];
  const defaultId = sprints[0]?.id ?? "";

  const [selectedSprintId, setSelectedSprintId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ReviewTab>("review");

  // Once list loads, select the first sprint if nothing is selected
  const effectiveId = selectedSprintId || defaultId;

  // We need the sprint object to pass to panels
  const { data: sprint } = useReviewSprint(effectiveId);

  function handleSprintChange(id: string) {
    setSelectedSprintId(id);
    setActiveTab("review");
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
            Reviews
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sprint review and retrospective for each completed or active sprint.
          </p>
        </div>

        {/* Sprint selector */}
        <SprintSelector
          selectedId={effectiveId}
          onChange={handleSprintChange}
        />
      </div>

      <Separator />

      {/* No sprints */}
      {listLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sprints.length === 0 ? (
        <div className="flex h-52 flex-col items-center justify-center gap-3 text-muted-foreground">
          <AlertCircle className="h-8 w-8 opacity-40" />
          <p className="text-sm">
            No sprints yet. Create and complete a sprint to generate a review.
          </p>
        </div>
      ) : !effectiveId ? null : (
        <div className="space-y-5">
          {/* Sprint meta */}
          <SprintMeta sprintId={effectiveId} />

          {/* Tabs */}
          <TabBar active={activeTab} onChange={setActiveTab} />

          {/* Tab panels */}
          <div role="tabpanel">
            {activeTab === "review" && sprint && (
              <SprintReviewPanel sprint={sprint} />
            )}
            {activeTab === "retrospective" && sprint && (
              <RetrospectivePanel sprint={sprint} />
            )}
            {!sprint && (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Velocity trend — always shown below if data is available */}
      {sprints.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Velocity Trend (last 6 sprints)
            </h2>
            <div className="rounded-lg border bg-card p-4">
              <VelocityChart last={6} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
