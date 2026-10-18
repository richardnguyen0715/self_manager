"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, parseISO } from "date-fns";
import { useRetroTrends } from "../hooks/useRetros";
import { useRetroActions } from "../hooks/useRetroChildren";
import { ActionRow } from "./ActionsPanel";
import type { RetroKind } from "../types";
import { RETRO_KIND_LABELS } from "../types";

const TREND_KINDS: RetroKind[] = [
  "weekly",
  "daily",
  "monthly",
  "quarterly",
  "yearly",
  "sprint",
  "project",
];

/** Rating and completed items over time, plus actions that keep getting carried. */
export function TrendsView() {
  const [kind, setKind] = useState<RetroKind>("weekly");
  const trends = useRetroTrends(kind, 12);
  const actions = useRetroActions("open");

  const points = (trends.data ?? []).map((p) => ({
    label: safeFormat(p.period_start),
    rating: p.rating ?? null,
    completed: p.completed_items ?? null,
    title: p.title,
  }));

  const repeatedlyCarried = (actions.data ?? []).filter((a) => a.carry_count >= 2);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Trends</h2>
          <p className="text-sm text-muted-foreground">Last 12 {RETRO_KIND_LABELS[kind].toLowerCase()} retros.</p>
        </div>
        <select
          aria-label="Cadence"
          value={kind}
          onChange={(e) => setKind(e.target.value as RetroKind)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {TREND_KINDS.map((k) => (
            <option key={k} value={k}>
              {RETRO_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rating and completed items</CardTitle>
        </CardHeader>
        <CardContent>
          {trends.isLoading ? (
            <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : null}
          {trends.isError ? (
            <p className="py-12 text-sm text-destructive">Could not load trends.</p>
          ) : null}
          {!trends.isLoading && !trends.isError && points.length === 0 ? (
            <p className="py-12 text-sm text-muted-foreground">
              No {RETRO_KIND_LABELS[kind].toLowerCase()} retros to chart yet.
            </p>
          ) : null}
          {points.length > 0 ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    yAxisId="rating"
                    domain={[0, 5]}
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    yAxisId="completed"
                    orientation="right"
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    labelFormatter={(_, payload) =>
                      (payload?.[0]?.payload as { title?: string } | undefined)?.title ?? ""
                    }
                  />
                  <Legend />
                  <Line
                    yAxisId="rating"
                    type="monotone"
                    dataKey="rating"
                    name="Rating"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    connectNulls
                    dot
                  />
                  <Line
                    yAxisId="completed"
                    type="monotone"
                    dataKey="completed"
                    name="Completed items"
                    stroke="#10b981"
                    strokeWidth={2}
                    connectNulls
                    dot
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Repeatedly carried actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {actions.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : null}
          {!actions.isLoading && repeatedlyCarried.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing has been carried more than once. Good sign.
            </p>
          ) : null}
          <ul className="space-y-2">
            {repeatedlyCarried.map((a) => (
              <ActionRow
                key={a.id}
                action={a}
                source={{ href: `/retros/${a.retro_id}`, label: a.retro_title }}
              />
            ))}
          </ul>
          <Link href="/retros" className="inline-block text-xs text-muted-foreground hover:underline">
            Back to retros
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function safeFormat(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d");
  } catch {
    return iso;
  }
}
