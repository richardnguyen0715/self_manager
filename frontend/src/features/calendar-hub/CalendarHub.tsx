"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarCheck2, CalendarHeart } from "lucide-react";
import { cn } from "@/lib/utils";
import { LifeCalendarView } from "@/features/life-calendar";
import { TaskCalendarView } from "@/features/task-calendar";

type Mode = "life" | "tasks";

const STORAGE_KEY = "mml.calendar.mode";

const MODES: { id: Mode; label: string; hint: string; icon: typeof CalendarHeart }[] = [
  { id: "life", label: "Events & time blocks", hint: "Personal calendar", icon: CalendarHeart },
  { id: "tasks", label: "Tasks", hint: "Project task timeline", icon: CalendarCheck2 },
];

function readStoredMode(): Mode {
  try {
    return localStorage.getItem(STORAGE_KEY) === "tasks" ? "tasks" : "life";
  } catch {
    return "life";
  }
}

/**
 * One Calendar entry point. Events/time blocks (the former "Life Calendar") and
 * the project task timeline (the former "Calendar") share a segmented switch;
 * the mode lives in `?view=` so it is linkable, and is remembered per browser
 * when the URL does not specify one.
 */
export function CalendarHub() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlMode = params.get("view");

  const [stored, setStored] = useState<Mode>("life");
  useEffect(() => setStored(readStoredMode()), []);

  const mode: Mode = urlMode === "tasks" || urlMode === "life" ? urlMode : stored;

  const select = useCallback(
    (next: Mode) => {
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* storage unavailable */
      }
      setStored(next);
      router.replace(`${pathname}?view=${next}`, { scroll: false });
    },
    [pathname, router],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div
        role="tablist"
        aria-label="Calendar mode"
        className="inline-flex w-fit gap-1 rounded-lg bg-muted p-1"
      >
        {MODES.map(({ id, label, hint, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={mode === id}
            title={hint}
            onClick={() => select(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              mode === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {mode === "tasks" ? <TaskCalendarView /> : <LifeCalendarView />}
      </div>
    </div>
  );
}
