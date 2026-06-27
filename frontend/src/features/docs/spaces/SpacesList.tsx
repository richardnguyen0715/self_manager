"use client";

import * as React from "react";
import { Plus, Search, FileText, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  useSpaces,
  useCreateSpace,
  useUpdateSpace,
  useDeleteSpace,
} from "@/features/docs";
import type { Space, CreateSpacePayload, UpdateSpacePayload } from "@/features/docs";
import { useProjectStore } from "@/stores";
import { SpaceCard } from "./SpaceCard";
import { SpaceDialog } from "./SpaceDialog";
import { DeleteSpaceDialog } from "./DeleteSpaceDialog";

// ─── View mode ────────────────────────────────────────────────────────────────

type ViewMode = "grid" | "list";

// ─── List row ─────────────────────────────────────────────────────────────────

function SpaceListRow({
  space,
  onEdit,
  onDelete,
}: {
  space: Space;
  onEdit: (s: Space) => void;
  onDelete: (s: Space) => void;
}) {
  const updatedAt = new Date(space.updated_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <a
      href={`/docs/${space.id}`}
      className="group flex items-center gap-4 rounded-lg border bg-card px-4 py-3 text-card-foreground transition-shadow hover:shadow-sm"
    >
      {/* Icon */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xl">
        {space.icon ? (
          <span>{space.icon}</span>
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{space.name}</p>
        {space.description && (
          <p className="truncate text-xs text-muted-foreground">
            {space.description}
          </p>
        )}
      </div>

      {/* Meta */}
      <p className="hidden shrink-0 text-xs text-muted-foreground sm:block">
        Updated {updatedAt}
      </p>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit(space);
          }}
          aria-label="Edit space"
        >
          {/* Pencil icon inline */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(space);
          }}
          aria-label="Delete space"
        >
          {/* Trash icon inline */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </Button>
      </div>
    </a>
  );
}

// ─── Header sub-component ─────────────────────────────────────────────────────

interface SpacesHeaderProps {
  search: string;
  onSearchChange: (v: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  onCreateClick: () => void;
}

function SpacesHeader({
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onCreateClick,
}: SpacesHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Docs</h1>
        <p className="text-sm text-muted-foreground">
          All your spaces — containers for pages and knowledge.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search spaces…"
            className="h-9 w-48 pl-9 text-sm"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* View toggles */}
        <div className="flex rounded-md border bg-background p-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", viewMode === "grid" && "bg-muted")}
            onClick={() => onViewModeChange("grid")}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", viewMode === "list" && "bg-muted")}
            onClick={() => onViewModeChange("list")}
            aria-label="List view"
          >
            <List className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Create */}
        <Button onClick={onCreateClick}>
          <Plus className="h-4 w-4" /> New space
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SpacesList() {
  const [search, setSearch] = React.useState("");
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");

  // Dialog state
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Space | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Space | null>(null);

  // Scope spaces to the selected project. When "All projects" is active
  // (currentProjectId === null), pass undefined → backend returns every space.
  const currentProjectId = useProjectStore((s) => s.currentProjectId);

  // Data hooks
  const { data: spaces = [], isLoading, isError } = useSpaces(
    currentProjectId ?? undefined,
  );
  const createSpace = useCreateSpace();
  const updateSpace = useUpdateSpace(editTarget?.id ?? "");
  const deleteSpace = useDeleteSpace();

  // Filtered list
  const filtered = React.useMemo(() => {
    if (!search.trim()) return spaces;
    const q = search.toLowerCase();
    return spaces.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q),
    );
  }, [spaces, search]);

  // Handlers
  function handleCreate(payload: CreateSpacePayload | UpdateSpacePayload) {
    // New spaces belong to the currently selected project so other projects
    // can't see them. Under "All projects" (null) the space stays unassigned.
    const withProject: CreateSpacePayload = {
      ...(payload as CreateSpacePayload),
      project_id: currentProjectId ?? undefined,
    };
    createSpace.mutate(withProject, {
      onSuccess: () => setCreateOpen(false),
    });
  }

  function handleEdit(payload: CreateSpacePayload | UpdateSpacePayload) {
    if (!editTarget) return;
    updateSpace.mutate(payload as UpdateSpacePayload, {
      onSuccess: () => setEditTarget(null),
    });
  }

  function handleDelete(id: string) {
    deleteSpace.mutate(id, {
      onSuccess: () => setDeleteTarget(null),
    });
  }

  // ── Skeleton ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <SpacesHeader
          search={search}
          onSearchChange={setSearch}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onCreateClick={() => setCreateOpen(true)}
        />
        <Separator />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Failed to load spaces. Please try again.
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <SpacesHeader
        search={search}
        onSearchChange={setSearch}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onCreateClick={() => setCreateOpen(true)}
      />

      <Separator />

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <FileText className="h-7 w-7 text-muted-foreground" />
          </div>
          {search ? (
            <>
              <p className="font-medium">No spaces match &ldquo;{search}&rdquo;</p>
              <p className="text-sm text-muted-foreground">
                Try a different search term.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">No spaces yet</p>
              <p className="text-sm text-muted-foreground">
                Create a space to start organising your docs.
              </p>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Create space
              </Button>
            </>
          )}
        </div>
      )}

      {/* Grid view */}
      {filtered.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((space) => (
            <SpaceCard
              key={space.id}
              space={space}
              onEdit={(s) => setEditTarget(s)}
              onDelete={(s) => setDeleteTarget(s)}
            />
          ))}
          {/* Create card */}
          <button
            onClick={() => setCreateOpen(true)}
            className="flex h-full min-h-[9rem] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-background text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-6 w-6" />
            <span className="text-sm font-medium">New space</span>
          </button>
        </div>
      )}

      {/* List view */}
      {filtered.length > 0 && viewMode === "list" && (
        <div className="flex flex-col gap-2">
          {filtered.map((space) => (
            <SpaceListRow
              key={space.id}
              space={space}
              onEdit={(s) => setEditTarget(s)}
              onDelete={(s) => setDeleteTarget(s)}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <SpaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode={{ kind: "create" }}
        onSubmit={handleCreate}
        isPending={createSpace.isPending}
      />

      <SpaceDialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        mode={
          editTarget
            ? { kind: "edit", space: editTarget }
            : { kind: "create" }
        }
        onSubmit={handleEdit}
        isPending={updateSpace.isPending}
      />

      <DeleteSpaceDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        space={deleteTarget}
        onConfirm={handleDelete}
        isPending={deleteSpace.isPending}
      />
    </div>
  );
}
