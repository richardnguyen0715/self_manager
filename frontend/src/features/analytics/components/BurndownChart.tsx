"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BurndownResponse, Sprint, AgileListResponse } from "@/types";
import { useSprintBurndown } from "../hooks/useAgileAnalytics";

interface BurndownChartProps {
  sprintsData: AgileListResponse<Sprint> | undefined;
  sprintsLoading?: boolean;
}

interface TooltipEntry {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-background p-3 shadow-md text-xs">
      <p className="mb-1.5 font-medium text-foreground">{label}</p>
      {payload.map((entry) => (
        <div
          key={entry.name}
          className="flex items-center justify-between gap-4"
        >
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: entry.color }}
            />
            {entry.name}
          </span>
          <span className="font-medium text-foreground">{entry.value} pts</span>
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-[260px] w-full rounded-md bg-muted animate-pulse" />
  );
}

function SprintSelector({
  sprints,
  selected,
  onSelect,
}: {
  sprints: Sprint[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="group"
      aria-label="Select sprint for burndown"
    >
      {sprints.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={
            selected === s.id
              ? "inline-flex items-center rounded-full border border-transparent bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground transition-colors"
              : "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
          }
          aria-pressed={selected === s.id}
        >
          {s.name}
        </button>
      ))}
    </div>
  );
}

function BurndownInner({ burndownData }: { burndownData: BurndownResponse }) {
  const points = burndownData.points ?? [];
  const chartData = points.map((p) => ({
    date: format(parseISO(p.date), "MMM d"),
    "Remaining pts": p.remaining_points,
    "Ideal pts": p.ideal_points,
  }));

  const lastPoint = points[points.length - 1];
  const isAhead =
    lastPoint && lastPoint.remaining_points <= lastPoint.ideal_points;

  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          Total: {burndownData.total_points} pts
        </span>
        {lastPoint && (
          <Badge variant={isAhead ? "default" : "destructive"} className="text-xs">
            {isAhead ? "On track" : "Behind"}
          </Badge>
        )}
      </div>
      {chartData.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
          No burndown data for this sprint
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart
            data={chartData}
            margin={{ top: 4, right: 16, left: -8, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-border"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
              iconType="circle"
              iconSize={8}
            />
            <Line
              type="monotone"
              dataKey="Ideal pts"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="Remaining pts"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3, fill: "hsl(var(--primary))" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </>
  );
}

function BurndownContent({
  sprintId,
}: {
  sprintId: string | null;
}) {
  const { data, isLoading, isError } = useSprintBurndown(sprintId);

  if (!sprintId) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        Select a sprint above to view its burndown
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[260px] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading burndown…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        Could not load burndown data
      </div>
    );
  }

  return <BurndownInner burndownData={data} />;
}

export function BurndownChart({
  sprintsData,
  sprintsLoading,
}: BurndownChartProps) {
  const sprints = sprintsData?.data ?? [];

  // Default: pre-select the active sprint, then most-recent completed
  const defaultId =
    sprints.find((s) => s.status === "active")?.id ??
    sprints.find((s) => s.status === "completed")?.id ??
    null;

  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(
    defaultId,
  );

  // If the default changed (e.g. sprints loaded after mount) and nothing is
  // selected yet, pick the default.
  const resolvedId =
    selectedSprintId ?? defaultId;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sprint Burndown</CardTitle>
        <p className="text-xs text-muted-foreground">
          Remaining story points per day vs. ideal burn rate
        </p>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pt-0 pb-4">
        {sprintsLoading ? (
          <ChartSkeleton />
        ) : sprints.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            No sprints found
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto pb-1">
              <SprintSelector
                sprints={sprints}
                selected={resolvedId}
                onSelect={setSelectedSprintId}
              />
            </div>
            <BurndownContent sprintId={resolvedId} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
