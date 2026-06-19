"use client";

import { Suspense } from "react";
import { FocusTimer } from "./components/FocusTimer";
import { FocusStatsPanel } from "./components/FocusStatsPanel";
import { SessionHistory } from "./components/SessionHistory";

function TimerSkeleton() {
  return (
    <div className="flex flex-col items-center gap-6">
      {/* mode selector placeholder */}
      <div className="flex flex-wrap justify-center gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 w-20 animate-pulse rounded-xl bg-muted sm:w-24" />
        ))}
      </div>
      {/* ring placeholder — scales down on small screens */}
      <div className="aspect-square w-[min(80vw,260px)] animate-pulse rounded-full bg-muted" />
      {/* controls placeholder */}
      <div className="h-10 w-40 animate-pulse rounded-md bg-muted" />
    </div>
  );
}

export function FocusFeature() {
  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_320px] lg:gap-8">
      {/* Left: timer */}
      <div className="flex flex-col items-center justify-start py-6 lg:py-8">
        <Suspense fallback={<TimerSkeleton />}>
          <FocusTimer />
        </Suspense>
      </div>

      {/* Right: stats + history */}
      <div className="flex flex-col gap-4">
        <FocusStatsPanel />
        <SessionHistory />
      </div>
    </div>
  );
}
