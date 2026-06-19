"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Plus,
  FileText,
  Pencil,
  Trash2,
  LayoutGrid,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  useSpace,
  useUpdateSpace,
  useDeleteSpace,
  useCreatePage,
  usePageTree,
} from "@/features/docs";
import type { Space } from "@/features/docs";
import type { UpdateSpacePayload } from "@/features/docs";
import { SpaceDialog } from "./SpaceDialog";
import { DeleteSpaceDialog } from "./DeleteSpaceDialog";
import { PageTree } from "../pages/PageTree";
import { PageListTable } from "../pages/PageListTable";

// ─── Props ────────────────────────────────────────────────────────────────────

interface SpaceViewProps {
  spaceId: string;
  /** Currently active page (for tree highlight). */
  activePageId?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SpaceView({ spaceId, activePageId }: SpaceViewProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [listMode, setListMode] = React.useState<"tree" | "table">("table");

  const { data: space, isLoading: spaceLoading } = useSpace(spaceId);
  const { data: pageTree = [], isLoading: treeLoading } = usePageTree(spaceId);
  const updateSpace = useUpdateSpace(spaceId);
  const deleteSpace = useDeleteSpace();
  const createPage = useCreatePage();

  function handleCreatePage(parentId?: string) {
    createPage.mutate(
      { space_id: spaceId, parent_id: parentId },
      {
        onSuccess: (page) => {
          router.push(`/docs/${spaceId}/${page.id}`);
        },
      },
    );
  }

  function handleEdit(payload: UpdateSpacePayload) {
    updateSpace.mutate(payload, { onSuccess: () => setEditOpen(false) });
  }

  function handleDelete(id: string) {
    deleteSpace.mutate(id, {
      onSuccess: () => {
        // Navigate back to docs index — use window for simplicity
        window.location.href = "/docs";
      },
    });
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (spaceLoading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="h-7 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted" />
        <Separator />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-center">
        <p className="text-sm text-muted-foreground">Space not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Space header */}
      <SpaceHeader
        space={space}
        listMode={listMode}
        onListModeChange={setListMode}
        onCreatePage={() => handleCreatePage()}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
      />

      <Separator />

      {/* Content area */}
      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* Tree sidebar */}
        <aside className="flex w-64 shrink-0 flex-col border-r bg-sidebar">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pages
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleCreatePage()}
              aria-label="Create page"
              disabled={createPage.isPending}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {treeLoading ? (
            <div className="flex flex-col gap-1.5 px-3 py-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-7 animate-pulse rounded bg-muted"
                  style={{ width: `${70 + Math.random() * 20}%` }}
                />
              ))}
            </div>
          ) : (
            <PageTree
              spaceId={spaceId}
              nodes={pageTree}
              activePageId={activePageId}
              onCreatePage={handleCreatePage}
            />
          )}
        </aside>

        {/* Main panel */}
        <main className="flex flex-1 flex-col overflow-auto p-6">
          {listMode === "table" ? (
            <PageListTable
              spaceId={spaceId}
              nodes={pageTree}
              onCreatePage={() => handleCreatePage()}
            />
          ) : (
            /* Tree is already visible in the sidebar; give a "click a page" hint */
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Select a page from the tree to open it.
              </p>
              <Button variant="outline" onClick={() => handleCreatePage()}>
                <Plus className="h-4 w-4" /> New page
              </Button>
            </div>
          )}
        </main>
      </div>

      {/* Dialogs */}
      <SpaceDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode={{ kind: "edit", space }}
        onSubmit={(payload) => handleEdit(payload as UpdateSpacePayload)}
        isPending={updateSpace.isPending}
      />

      <DeleteSpaceDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        space={space}
        onConfirm={handleDelete}
        isPending={deleteSpace.isPending}
      />
    </div>
  );
}

// ─── Space header ─────────────────────────────────────────────────────────────

interface SpaceHeaderProps {
  space: Space;
  listMode: "tree" | "table";
  onListModeChange: (m: "tree" | "table") => void;
  onCreatePage: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SpaceHeader({
  space,
  listMode,
  onListModeChange,
  onCreatePage,
  onEdit,
  onDelete,
}: SpaceHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-6 py-4">
      {/* Back */}
      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
        <Link href="/docs" aria-label="Back to docs">
          <ChevronLeft className="h-4 w-4" />
        </Link>
      </Button>

      {/* Icon + Name */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {space.icon ? (
          <span className="text-2xl leading-none">{space.icon}</span>
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{space.name}</h1>
          {space.description && (
            <p className="truncate text-xs text-muted-foreground">
              {space.description}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* View mode toggles */}
        <div className="flex rounded-md border bg-background p-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 ${listMode === "table" ? "bg-muted" : ""}`}
            onClick={() => onListModeChange("table")}
            aria-label="Table view"
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 ${listMode === "tree" ? "bg-muted" : ""}`}
            onClick={() => onListModeChange("tree")}
            aria-label="Tree view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={onCreatePage}>
          <Plus className="h-3.5 w-3.5" /> New page
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onEdit}
          aria-label="Edit space"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
          aria-label="Delete space"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
