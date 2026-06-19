"use client";

import { useMemo } from "react";
import {
  Network,
  Plus,
  Loader2,
  AlertCircle,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Goal } from "@/types";
import { useGoalsList } from "../hooks/useHierarchy";
import {
  useInitiative,
  useEpic,
  useWorkItem,
  useDeleteInitiative,
  useDeleteEpic,
  useDeleteWorkItem,
} from "../hooks/useHierarchy";
import { useHierarchyStore } from "../store/hierarchy.store";
import { GoalHierarchyRow } from "./GoalHierarchyRow";
import { InitiativeForm } from "./InitiativeForm";
import { EpicForm } from "./EpicForm";
import { WorkItemForm } from "./WorkItemForm";
import { WorkItemDetail } from "./WorkItemDetail";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

// ─── Summary strip ─────────────────────────────────────────────────────────────

function SummaryStrip({ goals }: { goals: Goal[] }) {
  const active = goals.filter((g) => g.status === "active").length;
  const completed = goals.filter((g) => g.status === "completed").length;

  return (
    <div className="flex items-center gap-4 md:gap-6 flex-wrap">
      {[
        {
          label: "Goals",
          value: goals.length,
          colorClass: "text-foreground",
        },
        {
          label: "Active",
          value: active,
          colorClass: "text-green-600 dark:text-green-400",
        },
        {
          label: "Completed",
          value: completed,
          colorClass: "text-blue-600 dark:text-blue-400",
        },
      ].map((s) => (
        <div key={s.label} className="flex flex-col items-center gap-0.5">
          <span
            className={`text-2xl font-bold tabular-nums ${s.colorClass}`}
          >
            {s.value}
          </span>
          <span className="text-xs text-muted-foreground">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Delete helpers (separate component for data fetching) ────────────────────

function DeleteInitiativeDialog() {
  const { deleteInitiativeId, closeDeleteInitiative } = useHierarchyStore();
  const { data: initiative } = useInitiative(deleteInitiativeId ?? "");
  const deleteInitiative = useDeleteInitiative();

  if (!deleteInitiativeId) return null;

  return (
    <DeleteConfirmDialog
      open={Boolean(deleteInitiativeId)}
      onOpenChange={(open) => !open && closeDeleteInitiative()}
      title="Delete Initiative"
      description={`Are you sure you want to delete "${initiative?.title ?? "this initiative"}"? All epics and their work items will also be removed.`}
      isPending={deleteInitiative.isPending}
      onConfirm={async () => {
        await deleteInitiative.mutateAsync(deleteInitiativeId);
        closeDeleteInitiative();
      }}
    />
  );
}

function DeleteEpicDialog() {
  const { deleteEpicId, closeDeleteEpic } = useHierarchyStore();
  const { data: epic } = useEpic(deleteEpicId ?? "");
  const deleteEpic = useDeleteEpic();

  if (!deleteEpicId) return null;

  return (
    <DeleteConfirmDialog
      open={Boolean(deleteEpicId)}
      onOpenChange={(open) => !open && closeDeleteEpic()}
      title="Delete Epic"
      description={`Are you sure you want to delete "${epic?.title ?? "this epic"}"? All linked work items will be unlinked.`}
      isPending={deleteEpic.isPending}
      onConfirm={async () => {
        await deleteEpic.mutateAsync(deleteEpicId);
        closeDeleteEpic();
      }}
    />
  );
}

function DeleteWorkItemDialog() {
  const { deleteWorkItemId, closeDeleteWorkItem } = useHierarchyStore();
  const { data: workItem } = useWorkItem(deleteWorkItemId ?? "");
  const deleteWorkItem = useDeleteWorkItem();

  if (!deleteWorkItemId) return null;

  return (
    <DeleteConfirmDialog
      open={Boolean(deleteWorkItemId)}
      onOpenChange={(open) => !open && closeDeleteWorkItem()}
      title="Delete Work Item"
      description={`Delete "${workItem?.title ?? "this work item"}"? This cannot be undone.`}
      isPending={deleteWorkItem.isPending}
      onConfirm={async () => {
        await deleteWorkItem.mutateAsync(deleteWorkItemId);
        closeDeleteWorkItem();
      }}
    />
  );
}

// ─── Edit initiative helper ───────────────────────────────────────────────────

function EditInitiativeDialog() {
  const { editInitiativeId, closeEditInitiative } = useHierarchyStore();
  const { data: initiative } = useInitiative(editInitiativeId ?? "");

  if (!editInitiativeId) return null;

  return (
    <InitiativeForm
      open={Boolean(editInitiativeId)}
      onOpenChange={(open) => !open && closeEditInitiative()}
      initiative={initiative}
    />
  );
}

function EditEpicDialog() {
  const { editEpicId, closeEditEpic } = useHierarchyStore();
  const { data: epic } = useEpic(editEpicId ?? "");

  if (!editEpicId) return null;

  return (
    <EpicForm
      open={Boolean(editEpicId)}
      onOpenChange={(open) => !open && closeEditEpic()}
      epic={epic}
    />
  );
}

function EditWorkItemDialog() {
  const { editWorkItemId, closeEditWorkItem } = useHierarchyStore();
  const { data: workItem } = useWorkItem(editWorkItemId ?? "");

  if (!editWorkItemId) return null;

  return (
    <WorkItemForm
      open={Boolean(editWorkItemId)}
      onOpenChange={(open) => !open && closeEditWorkItem()}
      workItem={workItem}
    />
  );
}

// ─── Main HierarchyView ────────────────────────────────────────────────────────

export function HierarchyView() {
  const {
    createInitiativeForGoalId,
    closeCreateInitiative,
    createEpicForInitiativeId,
    closeCreateEpic,
    createWorkItemForEpicId,
    closeCreateWorkItem,
    selectedWorkItemId,
    workItemDetailOpen,
    closeWorkItemDetail,
  } = useHierarchyStore();

  const { data: goalsData, isLoading, isError, error, refetch } = useGoalsList(
    { limit: 100 },
  );

  const goals: Goal[] = goalsData?.data ?? [];

  return (
    <div className="flex h-full gap-0">
      {/* Main tree panel */}
      <div className="flex flex-col flex-1 min-w-0 gap-4 md:gap-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Hierarchy</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Goal → Initiative → Epic → Work Item portfolio view with progress
              rollups.
            </p>
          </div>
        </div>

        {/* Summary strip */}
        {!isLoading && goals.length > 0 && <SummaryStrip goals={goals} />}

        {/* States */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading hierarchy...</p>
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="rounded-full bg-destructive/10 p-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div className="text-center">
              <p className="font-semibold">Failed to load goals</p>
              <p className="text-sm text-muted-foreground mt-1">
                {(error as Error)?.message ?? "An unexpected error occurred."}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="gap-2"
            >
              <RefreshCcw className="h-4 w-4" />
              Try again
            </Button>
          </div>
        )}

        {!isLoading && !isError && goals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Network className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="font-semibold">No goals yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create a goal first, then add initiatives and epics here.
              </p>
            </div>
            <Button variant="outline" onClick={() => (window.location.href = "/goals")}>
              Go to Goals
            </Button>
          </div>
        )}

        {!isLoading && !isError && goals.length > 0 && (
          <ScrollArea className="flex-1 -mx-1 px-1">
            <div className="flex flex-col gap-3 pb-6">
              {goals.map((goal) => (
                <GoalHierarchyRow key={goal.id} goal={goal} />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Work Item detail slide-over panel */}
      {workItemDetailOpen && selectedWorkItemId && (
        <>
          <Separator orientation="vertical" className="mx-0 h-auto hidden md:block" />
          <div className="fixed inset-0 z-40 bg-background flex flex-col overflow-hidden md:static md:inset-auto md:z-auto md:w-[480px] lg:w-[680px] md:shrink-0 md:border-l">
            <WorkItemDetail
              workItemId={selectedWorkItemId}
              onClose={closeWorkItemDetail}
            />
          </div>
        </>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}

      {/* Create initiative */}
      {createInitiativeForGoalId && (
        <InitiativeForm
          open={Boolean(createInitiativeForGoalId)}
          onOpenChange={(open) => !open && closeCreateInitiative()}
          goalId={createInitiativeForGoalId}
        />
      )}

      {/* Edit initiative */}
      <EditInitiativeDialog />

      {/* Delete initiative */}
      <DeleteInitiativeDialog />

      {/* Create epic */}
      {createEpicForInitiativeId && (
        <EpicForm
          open={Boolean(createEpicForInitiativeId)}
          onOpenChange={(open) => !open && closeCreateEpic()}
          initiativeId={createEpicForInitiativeId}
        />
      )}

      {/* Edit epic */}
      <EditEpicDialog />

      {/* Delete epic */}
      <DeleteEpicDialog />

      {/* Create work item */}
      {createWorkItemForEpicId && (
        <WorkItemForm
          open={Boolean(createWorkItemForEpicId)}
          onOpenChange={(open) => !open && closeCreateWorkItem()}
          epicId={createWorkItemForEpicId}
        />
      )}

      {/* Edit work item */}
      <EditWorkItemDialog />

      {/* Delete work item */}
      <DeleteWorkItemDialog />
    </div>
  );
}
