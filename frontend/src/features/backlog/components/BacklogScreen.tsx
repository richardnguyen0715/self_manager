"use client";

/**
 * BacklogScreen — main entry point for /backlog route.
 *
 * Layout (sprint sections + backlog):
 *   [Filter bar]
 *   [Sprint 0 section]  ← active/planned sprints, each collapsible
 *   [Sprint 1 section]
 *   ...
 *   [Backlog section]   ← unscheduled items (sprint_id IS NULL)
 *
 * Data sources:
 *   GET /api/sprints           → all sprints (sorted planned→active→completed)
 *   GET /api/backlog           → unscheduled items
 *   GET /api/epics             → for filter dropdown
 *
 * Child components manage their own per-sprint data via useSprintWorkItems.
 */

import { Loader2, AlertCircle } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useSprints, useEpics } from "@/features/agile";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import { useProjectStore } from "@/stores";
import { BacklogFilterBar } from "./BacklogFilterBar";
import { SprintSection } from "./SprintSection";
import { BacklogSection } from "./BacklogSection";
import { CreateWorkItemDialog } from "./CreateWorkItemDialog";
import { CreateSprintDialog } from "./CreateSprintDialog";
import type { Sprint } from "@/types";

// ─── Sort sprints: active first, then planned (newest last), then completed ──

function sortSprints(sprints: Sprint[]): Sprint[] {
  const order: Record<Sprint["status"], number> = {
    active: 0,
    planned: 1,
    completed: 2,
  };
  return [...sprints].sort((a, b) => {
    const o = order[a.status] - order[b.status];
    if (o !== 0) return o;
    // Within same status: sort by start_date asc
    return a.start_date.localeCompare(b.start_date);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BacklogScreen() {
  const { currentProjectId } = useProjectStore();

  const {
    data: sprintsData,
    isLoading: sprintsLoading,
    isError: sprintsError,
    refetch: refetchSprints,
  } = useSprints(
    currentProjectId != null
      ? { project_id: currentProjectId }
      : undefined,
  );

  const { data: epicsData } = useEpics();
  const qc = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // Move an item to a sprint (sprintId) or back to the backlog (sprintId null).
  const move = useMutation({
    mutationFn: ({
      itemId,
      sprintId,
    }: {
      itemId: string;
      sprintId: string | null;
    }) =>
      sprintId
        ? api.patch(API_ENDPOINTS.WORK_ITEM_SPRINT(itemId), {
            sprint_id: sprintId,
          })
        : api.patch(API_ENDPOINTS.WORK_ITEM_BACKLOG(itemId), {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backlog"] });
      qc.invalidateQueries({ queryKey: ["sprints"] });
      qc.invalidateQueries({ queryKey: ["work-items"] });
    },
  });

  function onDragEnd(e: DragEndEvent) {
    const data = e.active.data.current as
      | { type: "backlog-item"; itemId: string; fromSprintId: string | null }
      | undefined;
    const over = e.over?.data.current as
      | { type: "sprint-drop"; sprintId: string }
      | { type: "backlog-drop" }
      | undefined;
    if (!data || data.type !== "backlog-item" || !over) return;

    const targetSprintId =
      over.type === "sprint-drop" ? over.sprintId : null;
    if ((data.fromSprintId ?? null) === targetSprintId) return; // no-op
    move.mutate({ itemId: data.itemId, sprintId: targetSprintId });
  }

  const allSprints = sprintsData?.data ?? [];
  const sortedSprints = sortSprints(allSprints);
  const epics = epicsData?.data ?? [];

  if (sprintsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sprintsError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
        <AlertCircle className="h-6 w-6" />
        <p className="text-sm">Failed to load sprints.</p>
        <Button variant="ghost" size="sm" onClick={() => refetchSprints()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Filter bar */}
      <BacklogFilterBar epics={epics} />

      {/* Sprint sections + Backlog section — drag work items between them */}
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragEnd={onDragEnd}
      >
        <div className="space-y-3">
          {sortedSprints.map((sprint) => (
            <SprintSection
              key={sprint.id}
              sprint={sprint}
              allSprints={allSprints}
            />
          ))}

          {/* Backlog (unscheduled) — always rendered last */}
          <BacklogSection sprints={allSprints} epics={epics} />
        </div>
      </DndContext>

      {/* Dialogs — portal-rendered, driven by useBacklogStore */}
      <CreateWorkItemDialog sprints={allSprints} epics={epics} />
      <CreateSprintDialog />
    </>
  );
}
