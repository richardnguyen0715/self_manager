"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useRetros } from "../hooks/useRetros";
import { formatPeriod } from "../format";
import type { RetroKind, RetroStatus, RetroSummary } from "../types";
import { RETRO_KIND_LABELS } from "../types";

type CadenceTab = "all" | RetroKind;

const CADENCE_TABS: { value: CadenceTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "sprint", label: "Sprint" },
  { value: "project", label: "Project" },
];

const STATUS_FILTERS: { value: RetroStatus | "all"; label: string }[] = [
  { value: "all", label: "Any status" },
  { value: "draft", label: "Draft" },
  { value: "completed", label: "Completed" },
];

/** Cadence tabs, status filter and the timeline of retros, newest first. */
export function RetroTimeline() {
  const [cadence, setCadence] = useState<CadenceTab>("all");
  const [status, setStatus] = useState<RetroStatus | "all">("all");

  const { data, isLoading, isError } = useRetros({
    kind: cadence === "all" ? undefined : cadence,
    status: status === "all" ? undefined : status,
    limit: 100,
  });

  const items = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="flex flex-wrap gap-1">
          {CADENCE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={cadence === tab.value}
              onClick={() => setCadence(tab.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                cadence === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value as RetroStatus | "all")}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading retros…
        </div>
      ) : null}

      {isError ? (
        <p className="py-8 text-sm text-destructive">Could not load retros.</p>
      ) : null}

      {!isLoading && !isError && items.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">
          No retros here yet. Start with today&apos;s check-in or this week&apos;s review.
        </p>
      ) : null}

      <ul className="space-y-2">
        {items.map((retro) => (
          <RetroRow key={retro.id} retro={retro} />
        ))}
      </ul>
    </div>
  );
}

function RetroRow({ retro }: { retro: RetroSummary }) {
  return (
    <li>
      <Link href={`/retros/${retro.id}`} className="block">
        <Card className="transition-colors hover:bg-accent/40">
          <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium">{retro.title}</span>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {RETRO_KIND_LABELS[retro.kind]}
                </Badge>
                {retro.status === "completed" ? (
                  <Badge variant="secondary">Completed</Badge>
                ) : (
                  <Badge variant="outline">Draft</Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{formatPeriod(retro)}</span>
                {retro.scope_label ? <span>· {retro.scope_label}</span> : null}
                <span>
                  · {retro.entries_count} entries · {retro.links_count} links
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3 text-xs">
              <RatingDots value={retro.rating} />
              {retro.mood ? (
                <span className="text-muted-foreground">mood {retro.mood}/5</span>
              ) : null}
              {retro.open_actions > 0 ? (
                <Badge variant="default">{retro.open_actions} open</Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </Link>
    </li>
  );
}

function RatingDots({ value }: { value: number | null }) {
  if (!value) return null;
  return (
    <span className="flex items-center gap-0.5" aria-label={`Rating ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "h-3 w-3",
            n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
          )}
        />
      ))}
    </span>
  );
}
