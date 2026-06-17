"use client";

import { useMemo } from "react";
import { Plus, SlidersHorizontal, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Habit, HabitFrequency, HabitType } from "@/types";
import { useHabits } from "../hooks/useHabits";
import { useHabitsStore } from "../store/habits.store";
import { HabitCard } from "./HabitCard";
import { HabitFormDialog } from "./HabitFormDialog";
import { HabitLogDialog } from "./HabitLogDialog";
import { HabitHeatmapDialog } from "./HabitHeatmap";
import { cn } from "@/lib/utils";
import { useState } from "react";

// ─── Filter pills ──────────────────────────────────────────────────────────────

type FreqFilter = "all" | HabitFrequency;
type TypeFilter = "all" | HabitType;

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

// ─── Skeleton loader ───────────────────────────────────────────────────────────

function HabitCardSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
      <div className="mt-0.5 h-6 w-6 rounded-full bg-muted animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
        <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
        <div className="flex gap-1.5">
          <div className="h-4 w-14 rounded-full bg-muted animate-pulse" />
          <div className="h-4 w-12 rounded-full bg-muted animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-3xl">
        🔥
      </div>
      <div>
        <p className="font-semibold text-sm">No habits yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Build consistency one day at a time.
        </p>
      </div>
      <Button size="sm" onClick={onNew}>
        <Plus className="h-4 w-4" />
        Add your first habit
      </Button>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function HabitList() {
  const {
    filterFrequency,
    filterType,
    showArchived,
    modal,
    setFilterFrequency,
    setFilterType,
    setShowArchived,
    openCreateModal,
    closeModal,
  } = useHabitsStore();

  const [searchQuery, setSearchQuery] = useState("");

  // Backend returns all habits for the user — no query params supported.
  // Client-side filtering handles frequency, habit_type, archived, and search.
  const { data: habits = [], isLoading, isError } = useHabits();

  const filtered = useMemo(() => {
    return habits.filter((h: Habit) => {
      if (!showArchived && h.archived) return false;
      if (filterFrequency !== "all" && h.frequency !== filterFrequency)
        return false;
      if (filterType !== "all" && h.habit_type !== filterType) return false;
      if (
        searchQuery.trim() &&
        !h.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      return true;
    });
  }, [habits, showArchived, filterFrequency, filterType, searchQuery]);

  // Split active vs archived
  const activeHabits = filtered.filter((h: Habit) => !h.archived);
  const archivedHabits = filtered.filter((h: Habit) => h.archived);

  // Summary stats
  const totalActive = activeHabits.length;

  return (
    <div className="space-y-6">
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">All Habits</h2>
          {!isLoading && (
            <Badge variant="secondary" className="text-xs">
              {totalActive}
            </Badge>
          )}
        </div>
        <Button size="sm" onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          New Habit
        </Button>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search habits…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Frequency:</span>
        </div>
        {(["all", "daily", "weekly", "custom"] as FreqFilter[]).map((f) => (
          <FilterPill
            key={f}
            label={f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            active={filterFrequency === f}
            onClick={() => setFilterFrequency(f)}
          />
        ))}

        <div className="w-px bg-border" />

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Type:</span>
        </div>
        {(["all", "check", "count", "duration"] as TypeFilter[]).map((t) => (
          <FilterPill
            key={t}
            label={t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
            active={filterType === t}
            onClick={() => setFilterType(t)}
          />
        ))}

        <div className="w-px bg-border" />

        <FilterPill
          label="Show archived"
          active={showArchived}
          onClick={() => setShowArchived(!showArchived)}
        />
      </div>

      {/* ── Habit grid ── */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <HabitCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-12">
          <p className="text-sm text-destructive">
            Failed to load habits. Please refresh.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onNew={openCreateModal} />
      ) : (
        <div className="space-y-6">
          {/* Active habits */}
          {activeHabits.length > 0 && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeHabits.map((habit: Habit) => (
                  <HabitCard key={habit.id} habit={habit} />
                ))}
              </div>
            </div>
          )}

          {/* Archived habits (only shown if showArchived) */}
          {showArchived && archivedHabits.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Archived ({archivedHabits.length})
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {archivedHabits.map((habit: Habit) => (
                  <HabitCard key={habit.id} habit={habit} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {modal?.type === "create" && (
        <HabitFormDialog open mode="create" />
      )}
      {modal?.type === "edit" && (
        <HabitFormDialog open mode="edit" habit={modal.habit} />
      )}
      {modal?.type === "log" && (
        <HabitLogDialog open habit={modal.habit} />
      )}
      {modal?.type === "heatmap" && (
        <HabitHeatmapDialog open habit={modal.habit} />
      )}
    </div>
  );
}
