"use client";

import Link from "next/link";
import { LineChart } from "lucide-react";
import { OpenActionsCard } from "./OpenActionsCard";
import { QuickOpenBar } from "./QuickOpenBar";
import { RetroTimeline } from "./RetroTimeline";

/** /retros: quick open buttons, cadence timeline and the open-actions side card. */
export function RetrosView() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Retros &amp; reviews</h2>
          <p className="text-sm text-muted-foreground">
            Daily, weekly and monthly check-ins, plus retros for sprints and projects.
          </p>
        </div>
        <Link
          href="/retros/trends"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <LineChart className="h-4 w-4" />
          Trends
        </Link>
      </div>

      <QuickOpenBar />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <RetroTimeline />
        <aside className="min-w-0">
          <OpenActionsCard />
        </aside>
      </div>
    </div>
  );
}
