"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAnalyticsStore } from "../analytics.store";
import type { DateRangePreset } from "../types";

const PRESETS: { label: string; value: DateRangePreset }[] = [
  { label: "7 days", value: "last_7_days" },
  { label: "This week", value: "this_week" },
  { label: "30 days", value: "last_30_days" },
  { label: "This month", value: "this_month" },
  { label: "3 months", value: "last_3_months" },
];

export function PeriodSelector() {
  const { preset, dateRange, setPreset } = useAnalyticsStore();

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground shrink-0">
        {dateRange.from} &mdash; {dateRange.to}
      </span>
      <div
        className="flex items-center gap-1 p-1 rounded-md bg-muted"
        role="group"
        aria-label="Select time period"
      >
        {PRESETS.map((p) => (
          <Button
            key={p.value}
            variant="ghost"
            size="sm"
            onClick={() => setPreset(p.value)}
            aria-pressed={preset === p.value}
            className={cn(
              "h-7 px-3 text-xs rounded-sm transition-colors",
              preset === p.value &&
                "bg-background text-foreground shadow-sm pointer-events-none",
            )}
          >
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
