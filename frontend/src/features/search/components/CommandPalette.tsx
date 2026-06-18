"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Search,
  Plus,
  Activity,
  LayoutDashboard,
  CheckSquare,
  FolderOpen,
  Target,
  Clock,
  CalendarDays,
  Timer,
  BarChart2,
  Settings,
  Loader2,
  X,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores";
import { useSearchStore } from "../store";
import { useSearchQuery } from "../hooks/useSearch";
import { useQuickCreateTask, useQuickCreateHabit } from "../hooks/useQuickCreate";
import { SearchResultItem } from "./SearchResultItem";
import type { SearchResult, SearchResultKind } from "../types";

// ─── Navigation items (always visible, filtered by query) ─────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  keywords: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, keywords: ["home", "overview", "today"] },
  { label: "Backlog", href: "/backlog", icon: CheckSquare, keywords: ["todo", "backlog", "work"] },
  { label: "Board", href: "/board", icon: FolderOpen, keywords: ["board", "kanban", "drag"] },
  { label: "Calendar", href: "/calendar", icon: CalendarDays, keywords: ["schedule", "event"] },
  { label: "Time Blocking", href: "/timeblocking", icon: Clock, keywords: ["time", "block", "schedule"] },
  { label: "Habits", href: "/habits", icon: Activity, keywords: ["habit", "routine", "streak"] },
  { label: "Focus", href: "/focus", icon: Timer, keywords: ["pomodoro", "focus", "timer"] },
  { label: "Goals", href: "/goals", icon: Target, keywords: ["goal", "project", "objective"] },
  { label: "Analytics", href: "/analytics", icon: BarChart2, keywords: ["stats", "chart", "analysis"] },
  { label: "Settings", href: "/settings", icon: Settings, keywords: ["preferences", "account", "config"] },
];

function matchesNav(item: NavItem, q: string): boolean {
  const lq = q.toLowerCase();
  return (
    item.label.toLowerCase().includes(lq) ||
    item.keywords.some((kw) => kw.includes(lq))
  );
}

// ─── Quick-create inline form ──────────────────────────────────────────────────

interface QuickCreateFormProps {
  mode: "task" | "habit";
  onDone: () => void;
  onCancel: () => void;
}

function QuickCreateForm({ mode, onDone, onCancel }: QuickCreateFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const createTask = useQuickCreateTask({ onSuccess: onDone });
  const createHabit = useQuickCreateHabit({ onSuccess: onDone });

  const isPending = createTask.isPending || createHabit.isPending;
  const error = createTask.error?.message ?? createHabit.error?.message;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCancel();
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const title = (e.currentTarget.value ?? "").trim();
      if (!title) return;
      if (mode === "task") {
        createTask.mutate({ title });
      } else {
        // QuickCreateHabitPayload uses `name` to match backend CreateHabitRequest
        createHabit.mutate({ name: title });
      }
    }
  }

  return (
    <div className="flex flex-col gap-2 px-3 pb-3 pt-1">
      <p className="text-xs text-muted-foreground">
        {mode === "task" ? "New task title" : "New habit title"} — press{" "}
        <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">Enter</kbd> to create,{" "}
        <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">Esc</kbd> to cancel
      </p>
      <input
        ref={inputRef}
        type="text"
        placeholder={mode === "task" ? "e.g. Write weekly review" : "e.g. Morning run"}
        disabled={isPending}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:opacity-50",
        )}
      />
      {isPending && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Creating…
        </p>
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

// ─── Grouped search results ────────────────────────────────────────────────────

const KIND_LABELS: Record<SearchResultKind, string> = {
  task: "Tasks",
  project: "Projects",
  habit: "Habits",
};

interface GroupedResultsProps {
  results: SearchResult[];
  onNavigate: () => void;
}

function GroupedResults({ results, onNavigate }: GroupedResultsProps) {
  // Group by kind while preserving insertion order
  const groups = useMemo(() => {
    const map = new Map<SearchResultKind, SearchResult[]>();
    for (const r of results) {
      const arr = map.get(r.kind) ?? [];
      arr.push(r);
      map.set(r.kind, arr);
    }
    return map;
  }, [results]);

  if (results.length === 0) return null;

  return (
    <>
      {[...groups.entries()].map(([kind, items]) => (
        <Command.Group key={kind} heading={KIND_LABELS[kind] ?? kind}>
          {items.map((r) => (
            <Command.Item
              key={r.id}
              value={`${r.kind}-${r.id}-${"title" in r ? r.title : r.name}`}
              onSelect={() => {
                // Navigation handled inside SearchResultItem
              }}
              className="p-0"
            >
              <SearchResultItem
                result={r}
                onNavigate={onNavigate}
                className="rounded-none"
              />
            </Command.Item>
          ))}
        </Command.Group>
      ))}
    </>
  );
}

// ─── Main Command Palette ──────────────────────────────────────────────────────

export function CommandPalette() {
  const router = useRouter();

  // Global UI state
  const { commandPaletteOpen, closeCommandPalette } = useUIStore();

  // Search-feature state
  const {
    inputValue,
    setInputValue,
    quickCreateMode,
    setQuickCreateMode,
  } = useSearchStore();

  // Search query (fires only when inputValue has content)
  const trimmed = inputValue.trim();
  const { data: searchData, isFetching } = useSearchQuery(
    { q: trimmed, limit: 20 },
    { enabled: commandPaletteOpen && trimmed.length > 0 },
  );

  // Flatten per-kind arrays from SearchResponse { tasks?, projects?, habits? }
  const results: SearchResult[] = [
    ...(searchData?.tasks ?? []).map((t): SearchResult => ({ ...t, kind: "task" as const })),
    ...(searchData?.projects ?? []).map((p): SearchResult => ({ ...p, kind: "project" as const })),
    ...(searchData?.habits ?? []).map((h): SearchResult => ({ ...h, kind: "habit" as const })),
  ];

  // Close handler — resets inline mode too
  const handleClose = useCallback(() => {
    closeCommandPalette();
    setInputValue("");
    setQuickCreateMode(null);
  }, [closeCommandPalette, setInputValue, setQuickCreateMode]);

  // Keyboard: Escape always closes
  useEffect(() => {
    if (!commandPaletteOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commandPaletteOpen, handleClose]);

  function navigate(href: string) {
    router.push(href);
    handleClose();
  }

  // Filter nav items by current input
  const visibleNavItems =
    trimmed.length === 0
      ? NAV_ITEMS
      : NAV_ITEMS.filter((n) => matchesNav(n, trimmed));

  const hasResults = results.length > 0;
  const showEmpty =
    trimmed.length > 0 && !isFetching && !hasResults && !quickCreateMode;

  if (!commandPaletteOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed left-1/2 top-[20%] z-50 w-full max-w-xl -translate-x-1/2",
          "rounded-xl border bg-background shadow-2xl",
          "animate-in fade-in-0 zoom-in-95 duration-150",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <Command
          shouldFilter={false}
          className="flex flex-col overflow-hidden rounded-xl"
        >
          {/* Search input row */}
          <div className="flex items-center gap-2 border-b px-3 py-2.5">
            {isFetching ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <Command.Input
              value={inputValue}
              onValueChange={setInputValue}
              placeholder="Search or type a command…"
              className={cn(
                "flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground",
              )}
            />
            {inputValue.length > 0 && (
              <button
                onClick={() => setInputValue("")}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <kbd
              onClick={handleClose}
              className="cursor-pointer rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-accent"
              title="Press Esc to close"
            >
              Esc
            </kbd>
          </div>

          {/* Inline quick-create form */}
          {quickCreateMode && (
            <QuickCreateForm
              mode={quickCreateMode}
              onDone={handleClose}
              onCancel={() => setQuickCreateMode(null)}
            />
          )}

          {/* Scrollable list */}
          {!quickCreateMode && (
            <Command.List className="max-h-[420px] overflow-y-auto p-1">
              {/* Quick actions — always shown */}
              <Command.Group heading="Quick actions">
                <Command.Item
                  value="create-task"
                  onSelect={() => setQuickCreateMode("task")}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm",
                    "aria-selected:bg-accent",
                  )}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                  <span>Create task</span>
                  <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    T
                  </kbd>
                </Command.Item>

                <Command.Item
                  value="create-habit"
                  onSelect={() => setQuickCreateMode("habit")}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm",
                    "aria-selected:bg-accent",
                  )}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400">
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                  <span>Create habit</span>
                  <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    H
                  </kbd>
                </Command.Item>

                {trimmed.length > 0 && (
                  <Command.Item
                    value={`search-full-${trimmed}`}
                    onSelect={() => {
                      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
                    }}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm",
                      "aria-selected:bg-accent",
                    )}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-muted">
                      <Search className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                    <span>
                      Search for{" "}
                      <strong className="font-medium">&ldquo;{trimmed}&rdquo;</strong>
                    </span>
                    <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                  </Command.Item>
                )}
              </Command.Group>

              {/* Search results */}
              {hasResults && (
                <GroupedResults results={results} onNavigate={handleClose} />
              )}

              {/* Navigate section */}
              {visibleNavItems.length > 0 && (
                <Command.Group heading="Navigate">
                  {visibleNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Command.Item
                        key={item.href}
                        value={`nav-${item.href}-${item.label}`}
                        onSelect={() => navigate(item.href)}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm",
                          "aria-selected:bg-accent",
                        )}
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded bg-muted">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        </span>
                        <span>Go to {item.label}</span>
                        <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}

              {/* Empty state */}
              {showEmpty && (
                <Command.Empty className="py-10 text-center text-sm text-muted-foreground">
                  No results for &ldquo;{trimmed}&rdquo;
                </Command.Empty>
              )}
            </Command.List>
          )}

          {/* Footer hint */}
          <div className="flex items-center gap-3 border-t px-3 py-2">
            <span className="text-[10px] text-muted-foreground">
              <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">↑↓</kbd> navigate
            </span>
            <span className="text-[10px] text-muted-foreground">
              <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">↵</kbd> select
            </span>
            <span className="text-[10px] text-muted-foreground">
              <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">Esc</kbd> close
            </span>
          </div>
        </Command>
      </div>
    </>
  );
}
