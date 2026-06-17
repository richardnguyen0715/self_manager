"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/utils";
import type { DailyStatPoint } from "@/types";

interface WeeklyReviewProps {
  // Receives the raw DailyStatPoint[] from the /daily endpoint
  data: DailyStatPoint[] | undefined;
  isLoading?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-background p-3 shadow-md text-xs">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full inline-block"
            style={{ background: p.color }}
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function HabitBadge({ rate }: { rate: number }) {
  const variant =
    rate >= 80
      ? ("default" as const)
      : rate >= 50
        ? ("secondary" as const)
        : ("destructive" as const);
  return (
    <Badge variant={variant} className="text-xs">
      {rate.toFixed(0)}%
    </Badge>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="h-16 rounded-md bg-muted animate-pulse" />
      ))}
    </div>
  );
}

export function WeeklyReview({ data, isLoading }: WeeklyReviewProps) {
  const days = data ?? [];

  const chartData = days.map((d) => ({
    day: format(parseISO(d.stat_date), "EEE"),
    Completed: d.tasks_completed,
    "Focus (h)": +(d.focus_minutes / 60).toFixed(1),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Daily Activity</CardTitle>
        <p className="text-xs text-muted-foreground">
          Per-day task and habit summary
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <ChartSkeleton />
        ) : days.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No data for this period
          </div>
        ) : (
          <>
            {/* Daily summary rows */}
            <div className="divide-y divide-border rounded-md border overflow-hidden">
              {days.map((d) => (
                <div
                  key={d.stat_date}
                  className="flex items-center justify-between px-3 py-2.5 text-sm bg-card hover:bg-muted/40 transition-colors"
                >
                  <span className="text-muted-foreground text-xs">
                    {format(parseISO(d.stat_date), "EEE, MMM d")}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {d.tasks_completed} tasks
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDuration(d.focus_minutes)}
                    </span>
                    <HabitBadge rate={d.habit_completion_rate} />
                  </div>
                </div>
              ))}
            </div>

            {/* Bar chart for tasks + focus hours */}
            {chartData.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Tasks completed &amp; focus hours per day
                </p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      className="text-muted-foreground"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="Completed"
                      fill="hsl(var(--primary))"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={24}
                    />
                    <Bar
                      dataKey="Focus (h)"
                      fill="hsl(197, 71%, 52%)"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
