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
    <div className="mx-auto w-full max-w-5xl">
      {/* Space header */}
      <SpaceHeader
        space={space}
        listMode={listMode}
        onListModeChange={setListMode}
        onCreatePage={() => handleCreatePage()}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
      />

      {/* Content — a single full-width region (no redundant sidebar). */}
      <div className="mt-6">
        {listMode === "table" ? (
          <PageListTable
            spaceId={spaceId}
            nodes={pageTree}
            onCreatePage={() => handleCreatePage()}
          />
        ) : (
          <div className="rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pages
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5"
                onClick={() => handleCreatePage()}
                disabled={createPage.isPending}
              >
                <Plus className="h-3.5 w-3.5" /> New
              </Button>
            </div>
            {treeLoading ? (
              <div className="flex flex-col gap-1.5 p-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-7 w-2/3 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : pageTree.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No pages yet.</p>
                <Button variant="outline" size="sm" onClick={() => handleCreatePage()}>
                  <Plus className="h-3.5 w-3.5" /> Create first page
                </Button>
              </div>
            ) : (
              <div className="p-2">
                <PageTree
                  spaceId={spaceId}
                  nodes={pageTree}
                  activePageId={activePageId}
                  onCreatePage={handleCreatePage}
                />
              </div>
            )}
          </div>
        )}
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
    <div className="space-y-4">
      {/* Breadcrumb / back */}
      <Link
        href="/docs"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        All spaces
      </Link>

      {/* Title row */}
      <div className="flex items-start gap-4">
        {/* Icon tile */}
        {space.icon ? (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-3xl leading-none">
            {space.icon}
          </div>
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-6 w-6" />
          </div>
        )}

        <div className="min-w-0 flex-1 pt-0.5">
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {space.name}
          </h1>
          {space.description && (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
              {space.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Segmented view toggle */}
          <div className="flex rounded-lg border bg-background p-0.5">
            <button
              onClick={() => onListModeChange("table")}
              aria-label="List view"
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                listMode === "table"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => onListModeChange("tree")}
              aria-label="Tree view"
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                listMode === "tree"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>

          <Button size="sm" onClick={onCreatePage} className="h-8 gap-1.5">
            <Plus className="h-4 w-4" /> New page
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={onEdit}
            aria-label="Edit space"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
            aria-label="Delete space"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
