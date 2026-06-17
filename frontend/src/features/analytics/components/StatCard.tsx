"use client";

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  trend?: {
    direction: "up" | "down" | "neutral";
    label: string;
  };
  className?: string;
  iconClassName?: string;
}

const TREND_COLORS = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-rose-600 dark:text-rose-400",
  neutral: "text-muted-foreground",
} as const;

const TREND_SYMBOLS = {
  up: "↑",
  down: "↓",
  neutral: "→",
} as const;

export function StatCard({
  title,
  value,
  subtext,
  icon: Icon,
  trend,
  className,
  iconClassName,
}: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md bg-primary/10",
            iconClassName,
          )}
        >
          <Icon className="h-4 w-4 text-primary" aria-hidden />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {(subtext || trend) && (
          <div className="mt-1 flex items-center gap-1 text-xs">
            {trend && (
              <span className={TREND_COLORS[trend.direction]}>
                {TREND_SYMBOLS[trend.direction]} {trend.label}
              </span>
            )}
            {subtext && !trend && (
              <span className="text-muted-foreground">{subtext}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
