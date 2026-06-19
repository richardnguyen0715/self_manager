"use client";

import { cn } from "@/lib/utils";
import { useFocusStore } from "../store";
import { useTimerTick } from "../hooks/useTimerTick";
import { TimerRing } from "./TimerRing";
import { ModeSelector } from "./ModeSelector";
import { SessionControls } from "./SessionControls";
import { TaskLinker } from "./TaskLinker";
import { TimeBlockPicker } from "./TimeBlockPicker";

function formatMMSS(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function FocusTimer() {
  // Drive the countdown
  useTimerTick();

  const phase = useFocusStore((s) => s.phase);
  const elapsedSeconds = useFocusStore((s) => s.elapsedSeconds);
  const totalSeconds = useFocusStore((s) => s.totalSeconds);
  const clientStartedAt = useFocusStore((s) => s.clientStartedAt);
  const activeSession = useFocusStore((s) => s.activeSession);

  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  // progress 0 = full ring, 1 = empty ring (draining)
  const progress = totalSeconds > 0 ? elapsedSeconds / totalSeconds : 0;

  const isBreak = phase === "break";
  const isPaused = phase === "work" && clientStartedAt === null && !!activeSession;
  const isIdle = phase === "idle" || phase === "finished";

  const phaseLabel = isBreak
    ? "Break"
    : phase === "work"
    ? isPaused
      ? "Paused"
      : "Focus"
    : "Ready";

  const ringColorClass = isBreak
    ? "text-emerald-500"
    : isPaused
    ? "text-amber-500"
    : phase === "work"
    ? "text-primary"
    : "text-muted-foreground";

  return (
    <div className="flex w-full flex-col items-center gap-5 sm:gap-6">
      {/* Mode selector (only show when idle) */}
      {isIdle && <ModeSelector />}

      {/* Ring timer — scales down on mobile via TimerRing's responsive wrapper */}
      <TimerRing
        progress={progress}
        size={260}
        strokeWidth={10}
        colorClass={ringColorClass}
      >
        <div className="flex flex-col items-center gap-1 select-none">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {phaseLabel}
          </span>
          <span
            className={cn(
              "text-4xl font-bold tabular-nums tracking-tight sm:text-5xl",
              isPaused && "opacity-60",
            )}
          >
            {formatMMSS(remainingSeconds)}
          </span>
        </div>
      </TimerRing>

      {/* Session controls */}
      <SessionControls />

      {/* Time block picker — required to start a session; hidden during active/break phases */}
      {isIdle && (
        <div className="w-full max-w-xs">
          <TimeBlockPicker />
        </div>
      )}

      {/* Task linker – shown when idle or work phase */}
      {!isBreak && (
        <div className="w-full max-w-xs">
          <TaskLinker />
        </div>
      )}
    </div>
  );
}
