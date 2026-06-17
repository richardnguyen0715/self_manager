"use client";

import { useEffect, useRef } from "react";
import { Play, Pause, Square, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FocusMode } from "@/types";
import {
  useStartFocusSession,
  usePauseFocusSession,
  useResumeFocusSession,
  useFinishFocusSession,
  getFocusSessionStatus,
  getFocusWorkMinutes,
} from "../hooks/useFocusSession";
import { useTimeBlockingStore } from "../timeblocking.store";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function progressPercent(elapsed: number, workDurationMin: number): number {
  const total = workDurationMin * 60;
  return Math.min(100, Math.round((elapsed / total) * 100));
}

function modeLabel(mode: FocusMode): string {
  if (mode === "pomodoro_25_5") return "25 min work / 5 min break";
  if (mode === "deep_work_50_10") return "50 min work / 10 min break";
  return "Custom";
}

// ─── Focus launch button (placed on the time block detail sidebar) ────────────

interface FocusLaunchProps {
  timeBlockId: string;
  taskId: string | null;
  disabled?: boolean;
}

export function FocusLaunchButton({
  timeBlockId,
  disabled,
}: FocusLaunchProps) {
  const startSession = useStartFocusSession();
  const { activeFocusSession, focusPanelOpen } = useTimeBlockingStore();

  const alreadyRunning =
    focusPanelOpen &&
    activeFocusSession?.time_block_id === timeBlockId;

  function handleStart(mode: FocusMode) {
    startSession.mutate({ blockId: timeBlockId, mode });
  }

  if (alreadyRunning) {
    return (
      <Badge variant="secondary" className="gap-1">
        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        Focus active
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Start focus:</span>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs gap-1"
        disabled={disabled || startSession.isPending}
        onClick={() => handleStart("pomodoro_25_5")}
      >
        <Play className="h-3 w-3" />
        25/5
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs gap-1"
        disabled={disabled || startSession.isPending}
        onClick={() => handleStart("deep_work_50_10")}
      >
        <Play className="h-3 w-3" />
        50/10
      </Button>
    </div>
  );
}

// ─── Circular progress ring ───────────────────────────────────────────────────

interface ProgressRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function ProgressRing({
  percent,
  size = 120,
  strokeWidth = 8,
  className,
}: ProgressRingProps) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (percent / 100);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("rotate-[-90deg]", className)}
      aria-hidden
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        className="stroke-muted"
        strokeWidth={strokeWidth}
      />
      {/* Progress */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        className="stroke-primary transition-all duration-1000 ease-linear"
        strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Floating focus session panel ─────────────────────────────────────────────

export function FocusSessionPanel() {
  const {
    focusPanelOpen,
    activeFocusSession,
    focusTimerElapsed,
    tickFocusTimer,
    closeFocusPanel,
  } = useTimeBlockingStore();

  const pauseSession = usePauseFocusSession();
  const resumeSession = useResumeFocusSession();
  const finishSession = useFinishFocusSession();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick timer only when session is active (not paused/finished)
  useEffect(() => {
    const status = activeFocusSession
      ? getFocusSessionStatus(activeFocusSession)
      : null;

    if (focusPanelOpen && status === "active") {
      intervalRef.current = setInterval(() => {
        tickFocusTimer();
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [focusPanelOpen, activeFocusSession, tickFocusTimer]);

  if (!focusPanelOpen || !activeFocusSession) return null;

  const session = activeFocusSession;
  const status = getFocusSessionStatus(session);
  const isActive = status === "active";
  const isPaused = status === "paused";
  const workMin = getFocusWorkMinutes(session.mode);
  const pct = progressPercent(focusTimerElapsed, workMin);

  const blockId = session.time_block_id ?? "";

  return (
    <div
      role="region"
      aria-label="Focus session"
      className={cn(
        "fixed bottom-6 right-6 z-50 w-72 rounded-xl border bg-background shadow-2xl p-5",
        "animate-in slide-in-from-bottom-4 fade-in duration-300",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Focus session
          </p>
          <p className="text-sm font-medium mt-0.5 truncate max-w-[180px]">
            {modeLabel(session.mode)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={closeFocusPanel}
          aria-label="Minimize focus panel"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Progress ring + timer */}
      <div className="relative flex items-center justify-center mb-4">
        <ProgressRing percent={pct} size={120} strokeWidth={8} />
        <div className="absolute flex flex-col items-center">
          <span className="text-2xl font-mono font-bold tabular-nums leading-none">
            {formatTimer(focusTimerElapsed)}
          </span>
          <span className="text-[10px] text-muted-foreground mt-1">
            {isActive ? "working" : isPaused ? "paused" : status}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {isActive && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() =>
              pauseSession.mutate({ blockId, sessionId: session.id })
            }
            disabled={pauseSession.isPending}
          >
            <Pause className="h-3.5 w-3.5" />
            Pause
          </Button>
        )}

        {isPaused && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() =>
              resumeSession.mutate({ blockId, sessionId: session.id })
            }
            disabled={resumeSession.isPending}
          >
            <Play className="h-3.5 w-3.5" />
            Resume
          </Button>
        )}

        <Button
          variant="destructive"
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() =>
            finishSession.mutate({
              blockId,
              sessionId: session.id,
              duration_seconds: focusTimerElapsed,
            })
          }
          disabled={finishSession.isPending}
        >
          <Square className="h-3.5 w-3.5" />
          Finish
        </Button>
      </div>

      {/* Elapsed info */}
      <p className="text-center text-[10px] text-muted-foreground mt-3">
        {Math.round(focusTimerElapsed / 60)}m elapsed of {workMin}m planned
      </p>
    </div>
  );
}
