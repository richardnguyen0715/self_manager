"use client";

import { useState } from "react";
import {
  Trash2,
  RotateCcw,
  Loader2,
  FolderOpen,
  ListChecks,
  Layers,
} from "lucide-react";
import {
  useTrash,
  useRestoreWorkItem,
  usePurgeWorkItem,
  useRestoreTask,
  usePurgeTask,
  useRestoreProject,
  usePurgeProject,
} from "@/features/trash/hooks/useTrash";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Project, Task, WorkItemListItem } from "@/types";

type EntityKind = "work item" | "task" | "project";

/** A single deleted row with Restore + Delete permanently actions. */
function TrashRow({
  icon,
  title,
  subtitle,
  kind,
  pending,
  onRestore,
  onPurge,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string | null;
  kind: EntityKind;
  pending: boolean;
  onRestore: () => void;
  onPurge: () => void;
}) {
  const confirm = useConfirm();

  async function handlePurge() {
    const ok = await confirm({
      title: `Delete this ${kind} permanently?`,
      description: `"${title}" will be permanently removed. This cannot be undone.`,
      confirmText: "Delete permanently",
      destructive: true,
    });
    if (ok) onPurge();
  }

  return (
    <Card className="group flex items-center gap-3 px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRestore}
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          )}
          Restore
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={handlePurge}
          disabled={pending}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete permanently
        </Button>
      </div>
    </Card>
  );
}

function Section({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        {icon}
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums">
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

export default function TrashPage() {
  const { data, isLoading } = useTrash();

  const restoreWorkItem = useRestoreWorkItem();
  const purgeWorkItem = usePurgeWorkItem();
  const restoreTask = useRestoreTask();
  const purgeTask = usePurgeTask();
  const restoreProject = useRestoreProject();
  const purgeProject = usePurgeProject();

  // Track which row id is mid-flight so we can disable just that row.
  const [busyId, setBusyId] = useState<string | null>(null);

  function run(
    id: string,
    mut: { mutate: (id: string, opts?: { onSettled?: () => void }) => void },
  ) {
    setBusyId(id);
    mut.mutate(id, { onSettled: () => setBusyId(null) });
  }

  const workItems = data?.work_items ?? [];
  const tasks = data?.tasks ?? [];
  const projects = data?.projects ?? [];
  const totalCount = workItems.length + tasks.length + projects.length;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Trash</h1>
        <p className="text-sm text-muted-foreground">
          Restore deleted items, or remove them permanently.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : totalCount === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Trash2 className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Trash is empty.</p>
          <p className="text-xs text-muted-foreground">
            Deleted work items, tasks and projects will appear here.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <Section
            title="Work Items"
            icon={<Layers className="h-4 w-4 text-muted-foreground" />}
            count={workItems.length}
          >
            {workItems.map((wi: WorkItemListItem) => (
              <TrashRow
                key={wi.id}
                icon={<Layers className="h-4 w-4" />}
                title={wi.title}
                subtitle={wi.type}
                kind="work item"
                pending={busyId === wi.id}
                onRestore={() => run(wi.id, restoreWorkItem)}
                onPurge={() => run(wi.id, purgeWorkItem)}
              />
            ))}
          </Section>

          <Section
            title="Tasks"
            icon={<ListChecks className="h-4 w-4 text-muted-foreground" />}
            count={tasks.length}
          >
            {tasks.map((t: Task) => (
              <TrashRow
                key={t.id}
                icon={<ListChecks className="h-4 w-4" />}
                title={t.title}
                subtitle={t.description}
                kind="task"
                pending={busyId === t.id}
                onRestore={() => run(t.id, restoreTask)}
                onPurge={() => run(t.id, purgeTask)}
              />
            ))}
          </Section>

          <Section
            title="Projects"
            icon={<FolderOpen className="h-4 w-4 text-muted-foreground" />}
            count={projects.length}
          >
            {projects.map((p: Project) => (
              <TrashRow
                key={p.id}
                icon={<FolderOpen className="h-4 w-4" />}
                title={p.name}
                subtitle={p.description}
                kind="project"
                pending={busyId === p.id}
                onRestore={() => run(p.id, restoreProject)}
                onPurge={() => run(p.id, purgeProject)}
              />
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}
