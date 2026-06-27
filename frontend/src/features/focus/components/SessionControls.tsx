"use client";

import { Play, Pause, Square, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusStore } from "../store";
import {
  useStartSession,
  usePauseSession,
  useResumeSession,
  useFinishSession,
} from "../hooks/useFocusSessions";
import { useCreateTimeBlock } from "@/features/calendar/hooks/useCalendarTimeBlocks";
import { FOCUS_MODES } from "../types";
import type { FocusMode } from "../types";

export function SessionControls() {
  const phase = useFocusStore((s) => s.phase);
  const activeSession = useFocusStore((s) => s.activeSession);
  const activeBlockId = useFocusStore((s) => s.activeBlockId);
  const linkedTask = useFocusStore((s) => s.linkedTask);
  const selectedMode = useFocusStore((s) => s.selectedMode);
  const customWorkMinutes = useFocusStore((s) => s.customWorkMinutes);
  const elapsedSeconds = useFocusStore((s) => s.elapsedSeconds);
  const clientStartedAt = useFocusStore((s) => s.clientStartedAt);

  const sessionStarted = useFocusStore((s) => s.sessionStarted);
  const sessionPaused = useFocusStore((s) => s.sessionPaused);
  const sessionResumed = useFocusStore((s) => s.sessionResumed);
  const sessionFinished = useFocusStore((s) => s.sessionFinished);
  const skipBreak = useFocusStore((s) => s.skipBreak);

  const startMutation = useStartSession();
  const pauseMutation = usePauseSession();
  const resumeMutation = useResumeSession();
  const finishMutation = useFinishSession();
  const createBlockMutation = useCreateTimeBlock();

  const isPaused = phase === "work" && clientStartedAt === null && !!activeSession;
  const isBreak = phase === "break";

  function getModeForRequest(): FocusMode {
    return selectedMode;
  }

  function getWorkDurationSeconds(): number {
    if (selectedMode === "custom") return customWorkMinutes * 60;
    return (FOCUS_MODES.find((m) => m.mode === selectedMode)?.workMinutes ?? 25) * 60;
  }

  /**
   * Focus sessions are children of a time block. If the user picked one, we use
   * it; otherwise we auto-create an ad-hoc block spanning the work duration
   * (carrying the linked task, if any) so "Start Focus" always works. The block
   * persists, so the session counts toward analytics and shows on the calendar.
   */
  async function handleStart() {
    let blockId = activeBlockId;

    if (!blockId) {
      const start = new Date();
      const end = new Date(start.getTime() + getWorkDurationSeconds() * 1000);
      const block = await createBlockMutation.mutateAsync({
        title: linkedTask?.title ? `Focus: ${linkedTask.title}` : "Focus session",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        task_id: linkedTask?.id,
      });
      blockId = block.id;
    }

    const session = await startMutation.mutateAsync({
      blockId,
      data: { mode: getModeForRequest() },
    });
    sessionStarted(blockId, session);
  }

  async function handlePause() {
    if (!activeSession || !activeBlockId) return;
    const session = await pauseMutation.mutateAsync({
      blockId: activeBlockId,
      sessionId: activeSession.id,
    });
    sessionPaused(session);
  }

  async function handleResume() {
    if (!activeSession || !activeBlockId) return;
    const session = await resumeMutation.mutateAsync({
      blockId: activeBlockId,
      sessionId: activeSession.id,
    });
    sessionResumed(session);
  }

  async function handleFinish() {
    if (!activeSession || !activeBlockId) return;
    const liveElapsed =
      elapsedSeconds +
      (clientStartedAt ? Math.floor((Date.now() - clientStartedAt) / 1000) : 0);
    const durationSeconds = Math.max(0, liveElapsed);
    await finishMutation.mutateAsync({
      blockId: activeBlockId,
      sessionId: activeSession.id,
      data: { duration_seconds: durationSeconds },
    });
    sessionFinished();
  }

  /**
   * "Abandon" — finish the session with 0 seconds.
   * The backend has no delete endpoint for focus sessions, so we finish with 0.
   */
  async function handleAbandon() {
    if (!activeSession || !activeBlockId) return;
    await finishMutation.mutateAsync({
      blockId: activeBlockId,
      sessionId: activeSession.id,
      data: { duration_seconds: 0 },
    });
    sessionFinished();
  }

  const isMutating =
    startMutation.isPending ||
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    finishMutation.isPending ||
    createBlockMutation.isPending;

  // ── Break phase controls ──────────────────────────────────────────────────
  if (isBreak) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="outline"
          size="lg"
          className="gap-2"
          onClick={skipBreak}
        >
          <SkipForward className="h-4 w-4" />
          Skip Break
        </Button>
      </div>
    );
  }

  // ── Idle phase controls ───────────────────────────────────────────────────
  if (phase === "idle" || phase === "finished") {
    return (
      <Button
        size="lg"
        className="gap-2 px-8"
        onClick={handleStart}
        disabled={isMutating}
        title={
          activeBlockId
            ? undefined
            : "Starts now and creates a focus time block automatically"
        }
      >
        <Play className="h-4 w-4" />
        Start Focus
      </Button>
    );
  }

  // ── Work phase controls (active or paused) ───────────────────────────────
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      {isPaused ? (
        <Button
          size="lg"
          className="gap-2 px-5 sm:px-6"
          onClick={handleResume}
          disabled={isMutating}
        >
          <Play className="h-4 w-4" />
          Resume
        </Button>
      ) : (
        <Button
          size="lg"
          variant="secondary"
          className="gap-2 px-5 sm:px-6"
          onClick={handlePause}
          disabled={isMutating}
        >
          <Pause className="h-4 w-4" />
          Pause
        </Button>
      )}

      <Button
        size="lg"
        variant="outline"
        className="gap-2"
        onClick={handleFinish}
        disabled={isMutating}
      >
        <Square className="h-4 w-4" />
        Finish
      </Button>

      <Button
        size="lg"
        variant="ghost"
        className="gap-2 text-muted-foreground hover:text-destructive"
        onClick={handleAbandon}
        disabled={isMutating}
        title="Abandon session (records 0 seconds)"
      >
        Abandon
      </Button>
    </div>
  );
}
