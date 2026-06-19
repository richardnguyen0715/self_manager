"use client";

import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDate, formatTime } from "@/lib/utils";
import { useFocusSessionsList } from "../hooks/useFocusSessions";
import { useFocusStore } from "../store";
import type { FocusSession } from "@/types";

// ─── mode label map ────────────────────────────────────────────────────────────
// Keys must match canonical FocusMode values from @/types
const MODE_LABEL: Record<FocusSession["mode"], string> = {
  pomodoro_25_5: "Pomodoro",
  deep_work_50_10: "Deep Work",
  custom: "Custom",
};

// ─── derive session status from FocusSession fields ───────────────────────────
// The backend FocusSession has no `status` field.
// ended_at + duration_seconds > 0  → completed
// ended_at + duration_seconds === 0 → abandoned (finished with 0s)
// paused_at !== null, no ended_at  → paused
// otherwise                         → active

type DerivedStatus = "completed" | "abandoned" | "paused" | "active";

function deriveStatus(s: FocusSession): DerivedStatus {
  if (s.ended_at !== null) {
    return (s.duration_seconds ?? 0) > 0 ? "completed" : "abandoned";
  }
  if (s.paused_at !== null) return "paused";
  return "active";
}

function formatDurationSeconds(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "0m";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

function SessionRow({ session }: { session: FocusSession }) {
  const status = deriveStatus(session);
  const isCompleted = status === "completed";
  const isAbandoned = status === "abandoned";

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-0.5 shrink-0">
        {isCompleted ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : isAbandoned ? (
          <XCircle className="h-4 w-4 text-destructive" />
        ) : (
          <Clock className="h-4 w-4 text-amber-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium">
            {MODE_LABEL[session.mode]}
          </span>
          <Badge
            variant={
              isCompleted ? "default" : isAbandoned ? "destructive" : "secondary"
            }
            className="shrink-0 text-xs"
          >
            {status}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {formatDate(session.started_at)} at {formatTime(session.started_at)}
          {session.duration_seconds != null && session.duration_seconds > 0 && (
            <> &middot; {formatDurationSeconds(session.duration_seconds)}</>
          )}
        </p>
      </div>
    </div>
  );
}

export function SessionHistory() {
  const activeBlockId = useFocusStore((s) => s.activeBlockId);

  const { data: sessions = [], isLoading } = useFocusSessionsList(
    // only fetch when we have a block id; hook is disabled when blockId is falsy
    { blockId: activeBlockId ?? "" },
  );

  // Filter to ended sessions for history display
  const history = sessions.filter((s) => s.ended_at !== null);

  if (!activeBlockId) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-4 text-center text-sm text-muted-foreground">
            Select a time block to view session history.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent Sessions</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading && (
          <div className="space-y-3 p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="mt-0.5 h-4 w-4 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-48 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && history.length === 0 && (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            No completed sessions yet. Start your first focus session!
          </p>
        )}

        {!isLoading && history.length > 0 && (
          <ScrollArea className="max-h-80">
            <div className="divide-y px-6">
              {history.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
