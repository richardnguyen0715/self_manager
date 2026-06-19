"use client";

import { CheckCircle2, Circle, MoreVertical, Flame, BarChart3, Pencil, Trash2, Archive, RefreshCw } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Habit } from "@/types";
import { useDeleteHabit, useArchiveHabit } from "../hooks/useHabits";
import { useHabitsStore } from "../store/habits.store";
import { cn } from "@/lib/utils";

// ─── Type label ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<Habit["habit_type"], string> = {
  check: "Check-in",
  count: "Count",
  duration: "Duration",
};

const FREQ_LABELS: Record<Habit["frequency"], string> = {
  daily: "Daily",
  weekly: "Weekly",
  custom: "Custom",
};

// ─── Progress indicator for count/duration ────────────────────────────────────

interface ProgressRingProps {
  value: number; // 0–100
  color: string;
  size?: number;
}

function ProgressRing({ value, color, size = 36 }: ProgressRingProps) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ - (value / 100) * circ;

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={3}
        className="stroke-secondary"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={3}
        stroke={color}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={dash}
        className="transition-all duration-500"
      />
    </svg>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface HabitCardProps {
  habit: Habit;
  // today's log value for progress display (fetched by parent/list)
  todayValue?: number | null;
  todayCompleted?: boolean;
}

export function HabitCard({ habit, todayValue, todayCompleted }: HabitCardProps) {
  const { openEditModal, openLogModal, openHeatmapModal } = useHabitsStore();
  const deleteMutation = useDeleteHabit();
  const archiveMutation = useArchiveHabit(habit.id);

  const isCompleted = todayCompleted === true;
  const habitColor = habit.color ?? "hsl(var(--primary))";

  // Compute today's progress percentage for count/duration
  let progressPct = 0;
  if (habit.habit_type !== "check" && habit.target_value && todayValue) {
    progressPct = Math.min((todayValue / habit.target_value) * 100, 100);
  } else if (isCompleted) {
    progressPct = 100;
  }

  function handleCheckToggle() {
    openLogModal(habit);
  }

  async function handleArchive() {
    await archiveMutation.mutateAsync();
  }

  async function handleDelete() {
    await deleteMutation.mutateAsync(habit.id);
  }

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md",
        habit.archived && "opacity-60",
      )}
    >
      {/* Check / progress button */}
      <button
        type="button"
        onClick={handleCheckToggle}
        className="mt-0.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-full"
        aria-label={isCompleted ? "Unlog habit" : "Log habit"}
      >
        {habit.habit_type === "check" ? (
          isCompleted ? (
            <CheckCircle2
              className="h-6 w-6 transition-colors"
              style={{ color: habitColor }}
            />
          ) : (
            <Circle className="h-6 w-6 text-muted-foreground transition-colors hover:text-foreground" />
          )
        ) : (
          <div className="relative">
            <ProgressRing
              value={progressPct}
              color={habitColor}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-foreground">
              {Math.round(progressPct)}%
            </span>
          </div>
        )}
      </button>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={cn(
                "truncate font-medium text-sm leading-tight",
                isCompleted && "text-muted-foreground line-through",
              )}
            >
              {habit.name}
            </p>
            {habit.description && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {habit.description}
              </p>
            )}
          </div>

          {/* Actions menu */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                aria-label="Habit actions"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="z-50 min-w-[140px] overflow-hidden rounded-md border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95"
                align="end"
                sideOffset={4}
              >
                <DropdownMenu.Item
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
                  onSelect={() => openLogModal(habit)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Log today
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
                  onSelect={() => openHeatmapModal(habit)}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  View activity
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Item
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
                  onSelect={() => openEditModal(habit)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
                  onSelect={handleArchive}
                >
                  {habit.archived ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" />
                      Unarchive
                    </>
                  ) : (
                    <>
                      <Archive className="h-3.5 w-3.5" />
                      Archive
                    </>
                  )}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none hover:bg-destructive/10"
                  onSelect={handleDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        {/* Meta row */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {/* Colour swatch + type */}
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `${habitColor}22`,
              color: habitColor,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: habitColor }}
            />
            {TYPE_LABELS[habit.habit_type]}
          </span>

          {/* Frequency */}
          <Badge variant="secondary" className="text-xs">
            {habit.frequency === "custom" && habit.frequency_days?.length
              ? `${habit.frequency_days.length}d/wk`
              : FREQ_LABELS[habit.frequency]}
          </Badge>

          {/* Target */}
          {habit.target_value > 0 && (
            <Badge variant="outline" className="text-xs">
              Target: {habit.target_value}
            </Badge>
          )}

          {/* Streak */}
          {habit.current_streak > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-orange-500">
              <Flame className="h-3 w-3" />
              {habit.current_streak}
            </span>
          )}

          {/* Completion rate (completion_rate_30d is 0.0–1.0) */}
          <span className="ml-auto text-xs text-muted-foreground">
            {Math.round(habit.completion_rate_30d * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
