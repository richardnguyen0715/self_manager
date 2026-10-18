"use client";

import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  AlertTriangle,
  Repeat2,
  Timer,
  Rocket,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RetroAutoSource, RetroSnapshot } from "../types";

interface SnapshotBlockProps {
  snapshot: RetroSnapshot | null | undefined;
  /** Which metrics this auto_metrics section shows. Empty / "all" shows everything. */
  source?: RetroAutoSource | null;
  className?: string;
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * Read-only metric cards for a retro's snapshot. Every field is optional: a
 * card is only rendered when its data is present, so partial or older
 * snapshots degrade gracefully.
 */
export function SnapshotBlock({ snapshot, source, className }: SnapshotBlockProps) {
  if (!snapshot) {
    return (
      <p className="text-sm text-muted-foreground">
        No metrics yet. They appear once the retro is opened.
      </p>
    );
  }

  const want = (...keys: (RetroAutoSource | "all")[]) =>
    !source || source === "all" || keys.includes(source);

  const completed = snapshot.completed_items;
  const overdue = snapshot.overdue;
  const habits = snapshot.habits;
  const focus = snapshot.focus;
  const sprint = snapshot.sprint;
  const scope = snapshot.scope;

  const cards: React.ReactNode[] = [];

  if (want("completed_items", "all") && completed) {
    const byType = completed.by_type ?? {};
    const typeHint = Object.entries(byType)
      .filter(([, n]) => num(n) && n > 0)
      .map(([t, n]) => `${n} ${t.replace(/_/g, " ")}`)
      .join(" · ");
    const items = completed.items ?? [];
    cards.push(
      <MetricCard
        key="completed"
        icon={CheckCircle2}
        label="Completed items"
        value={num(completed.count) ? String(completed.count) : "0"}
        hint={
          [num(completed.points) ? `${completed.points} pts` : null, typeHint]
            .filter(Boolean)
            .join(" · ") || undefined
        }
      >
        {items.length > 0 ? (
          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {items.slice(0, 5).map((it) => (
              <li key={it.id} className="truncate">
                {it.key ? <span className="font-mono">{it.key} </span> : null}
                {it.title}
              </li>
            ))}
            {items.length > 5 ? <li>+{items.length - 5} more</li> : null}
          </ul>
        ) : null}
      </MetricCard>,
    );
  }

  if (want("overdue", "all") && overdue && num(overdue.count)) {
    cards.push(
      <MetricCard
        key="overdue"
        icon={AlertTriangle}
        label="Overdue"
        value={String(overdue.count)}
        hint="Open items past due"
      />,
    );
  }

  if (want("habits", "all") && habits) {
    const rate = num(habits.rate) ? Math.round(habits.rate * 100) : null;
    cards.push(
      <MetricCard
        key="habits"
        icon={Repeat2}
        label="Habit completion"
        value={rate !== null ? `${rate}%` : "—"}
        hint={
          num(habits.logged_days) ? `${habits.logged_days} logged days` : undefined
        }
      >
        {(habits.streaks ?? []).length > 0 ? (
          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {(habits.streaks ?? []).slice(0, 5).map((s) => (
              <li key={s.habit_id} className="truncate">
                {s.name}: {s.streak}d streak
              </li>
            ))}
          </ul>
        ) : null}
      </MetricCard>,
    );
  }

  if (want("focus", "all") && focus) {
    cards.push(
      <MetricCard
        key="focus"
        icon={Timer}
        label="Focus time"
        value={num(focus.minutes) ? `${Math.round(focus.minutes)} min` : "0 min"}
        hint={num(focus.sessions) ? `${focus.sessions} sessions` : undefined}
      />,
    );
  }

  if (want("sprint") && sprint) {
    const velocity = num(sprint.velocity) ? sprint.velocity : null;
    cards.push(
      <MetricCard
        key="sprint"
        icon={Rocket}
        label={`Sprint · ${sprint.name ?? ""}`.trim()}
        value={
          num(sprint.completed_points)
            ? `${sprint.completed_points} pts`
            : "—"
        }
        hint={[
          num(sprint.committed_points)
            ? `of ${sprint.committed_points} committed`
            : null,
          velocity !== null ? `velocity ${velocity}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined}
      />,
    );
  }

  if (want("sprint", "all") && scope && num(scope.total_items)) {
    const done = num(scope.done_items) ? scope.done_items : 0;
    const pct = scope.total_items > 0 ? Math.round((done / scope.total_items) * 100) : 0;
    cards.push(
      <MetricCard
        key="scope"
        icon={Target}
        label={`${scope.label ?? "Scope"} progress`}
        value={`${pct}%`}
        hint={`${done} of ${scope.total_items} done`}
      >
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full bg-primary transition-all")}
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </div>
      </MetricCard>,
    );
  }

  if (cards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No metrics recorded for this section.
      </p>
    );
  }

  const range = snapshot.range;
  return (
    <div className={cn("space-y-2", className)}>
      {range?.from || range?.to ? (
        <p className="text-xs text-muted-foreground">
          Range {range.from ?? "?"} → {range.to ?? "?"}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards}
      </div>
    </div>
  );
}
