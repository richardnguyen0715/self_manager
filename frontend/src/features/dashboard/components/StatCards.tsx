"use client";

import Link from "next/link";
import {
  CheckCheck,
  AlertCircle,
  Flame,
  Timer,
  Repeat2,
  Coffee,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { QuickStats } from "@/types";

interface StatCardItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  href?: string;
  colorClass?: string;
}

function StatCardItem({
  icon,
  label,
  value,
  subtitle,
  href,
  colorClass = "text-primary",
}: StatCardItemProps) {
  const content = (
    <Card
      className={cn(
        "group h-full transition-shadow hover:shadow-md",
        href && "cursor-pointer",
      )}
    >
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted",
            colorClass,
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="truncate text-2xl font-bold leading-tight tracking-tight text-foreground">
            {value}
          </p>
          {subtitle && (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

interface StatCardsProps {
  stats: QuickStats;
}

export function StatCards({ stats }: StatCardsProps) {
  // habit_completion_rate_today is 0.0–1.0; format as percentage
  const habitRateLabel =
    stats.habit_completion_rate_today != null
      ? `${Math.round(stats.habit_completion_rate_today * 100)}%`
      : "—";

  return (
    <section aria-label="Today's quick stats">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCardItem
          icon={<CheckCheck className="h-5 w-5" />}
          label="Tasks Done"
          value={stats.tasks_done_today}
          subtitle="today"
          href="/work-items"
          colorClass="text-emerald-600"
        />
        <StatCardItem
          icon={<AlertCircle className="h-5 w-5" />}
          label="Overdue"
          value={stats.tasks_overdue}
          subtitle={stats.tasks_overdue > 0 ? "needs attention" : "all clear"}
          href="/work-items"
          colorClass={
            stats.tasks_overdue > 0 ? "text-destructive" : "text-emerald-600"
          }
        />
        <StatCardItem
          icon={<Repeat2 className="h-5 w-5" />}
          label="Habits"
          value={habitRateLabel}
          subtitle="completion rate"
          href="/habits"
          colorClass="text-violet-600"
        />
        <StatCardItem
          icon={<Flame className="h-5 w-5" />}
          label="Best Streak"
          value={stats.best_habit_streak}
          subtitle="day streak"
          href="/habits"
          colorClass="text-orange-500"
        />
        <StatCardItem
          icon={<Timer className="h-5 w-5" />}
          label="Focus Time"
          value={`${stats.focus_minutes_today}m`}
          subtitle="today"
          href="/focus"
          colorClass="text-cyan-600"
        />
        <StatCardItem
          icon={<Coffee className="h-5 w-5" />}
          label="Pomodoros"
          value={stats.pomodoro_sessions_today}
          subtitle="sessions today"
          href="/focus"
          colorClass="text-rose-500"
        />
      </div>
    </section>
  );
}
