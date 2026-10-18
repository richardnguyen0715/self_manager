"use client";

import { useState } from "react";
import { Bookmark, MoreHorizontal, Plus } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/stores";
import { useWorkItemUIStore } from "@/features/workitems/store";
import {
  useSavedViews,
  useCreateSavedView,
  useUpdateSavedView,
  useDeleteSavedView,
} from "../hooks/useSavedViews";
import {
  DEFAULT_SAVED_VIEW_FILTERS,
  normalizeSavedViewFilters,
  sameSavedViewFilters,
  type SavedView,
  type SavedViewFilters,
  type SavedViewScope,
} from "../types";
import { SaveViewDialog } from "./SaveViewDialog";

interface SavedViewsBarProps {
  scope?: SavedViewScope;
}

const pillBase =
  "group relative inline-flex items-center gap-1 h-7 rounded-full border px-3 text-xs font-medium transition-colors whitespace-nowrap";
const pillActive = "border-primary bg-primary text-primary-foreground";
const pillIdle =
  "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent/40";

/**
 * Pill tabs of saved views above the work-items table. "All" clears the
 * filters; clicking a saved view applies its filters; "Save view" stores the
 * current filters under a name.
 */
export function SavedViewsBar({ scope = "work_items" }: SavedViewsBarProps) {
  const filters = useWorkItemUIStore((s) => s.filters);
  const { currentProjectId } = useProjectStore();
  const projectId = currentProjectId ?? null;

  const { data: views = [] } = useSavedViews(scope, projectId);
  const createView = useCreateSavedView();
  const updateView = useUpdateSavedView();
  const deleteView = useDeleteSavedView();
  const confirm = useConfirm();

  const [saveOpen, setSaveOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<SavedView | null>(null);

  const current: SavedViewFilters = normalizeSavedViewFilters({
    type: filters.type,
    status: filters.status,
    priority: filters.priority,
    search: filters.search,
  });
  const isAllActive = sameSavedViewFilters(current, DEFAULT_SAVED_VIEW_FILTERS);

  function applyView(view: SavedView) {
    const next = normalizeSavedViewFilters(view.filters);
    useWorkItemUIStore.setState((s) => ({ filters: { ...s.filters, ...next } }));
  }

  function clearToAll() {
    useWorkItemUIStore.setState((s) => ({
      filters: { ...s.filters, ...DEFAULT_SAVED_VIEW_FILTERS },
    }));
  }

  function handleSave(name: string) {
    createView.mutate(
      { name, scope, project_id: projectId, filters: current, display: {} },
      { onSuccess: () => setSaveOpen(false) },
    );
  }

  function handleRename(name: string) {
    if (!renameTarget) return;
    updateView.mutate(
      { id: renameTarget.id, name },
      { onSuccess: () => setRenameTarget(null) },
    );
  }

  async function handleDelete(view: SavedView) {
    if (
      !(await confirm({
        title: `Delete view "${view.name}"?`,
        description: "The view will be removed. Your current filters are kept.",
        confirmText: "Delete",
        destructive: true,
      }))
    )
      return;
    deleteView.mutate(view.id);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-3">
      <button
        type="button"
        onClick={clearToAll}
        className={cn(pillBase, isAllActive ? pillActive : pillIdle)}
      >
        All
      </button>

      {views.map((view) => {
        const active = sameSavedViewFilters(
          normalizeSavedViewFilters(view.filters),
          current,
        );
        return (
          <div key={view.id} className="relative inline-flex items-center">
            <button
              type="button"
              onClick={() => applyView(view)}
              className={cn(pillBase, "pr-7", active ? pillActive : pillIdle)}
              title={view.name}
            >
              <span className="max-w-[10rem] truncate">{view.name}</span>
            </button>

            <DropdownMenuPrimitive.Root>
              <DropdownMenuPrimitive.Trigger asChild>
                <button
                  type="button"
                  aria-label={`Actions for view ${view.name}`}
                  className={cn(
                    "absolute right-1 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 transition-opacity",
                    active
                      ? "hover:bg-primary-foreground/20"
                      : "hover:bg-accent",
                  )}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuPrimitive.Trigger>
              <DropdownMenuPrimitive.Portal>
                <DropdownMenuPrimitive.Content
                  align="start"
                  sideOffset={4}
                  className="z-50 min-w-[9rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                >
                  <DropdownMenuPrimitive.Item
                    onSelect={() => setRenameTarget(view)}
                    className="flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none gap-2 focus:bg-accent focus:text-accent-foreground"
                  >
                    Rename
                  </DropdownMenuPrimitive.Item>
                  <DropdownMenuPrimitive.Separator className="my-1 h-px bg-border" />
                  <DropdownMenuPrimitive.Item
                    onSelect={() => handleDelete(view)}
                    className="flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none gap-2 focus:bg-destructive/10 focus:text-destructive text-destructive"
                  >
                    Delete
                  </DropdownMenuPrimitive.Item>
                </DropdownMenuPrimitive.Content>
              </DropdownMenuPrimitive.Portal>
            </DropdownMenuPrimitive.Root>
          </div>
        );
      })}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setSaveOpen(true)}
        className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        <Bookmark className="h-3.5 w-3.5" />
        Save view
      </Button>

      <SaveViewDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="Save view"
        submitLabel="Save view"
        isPending={createView.isPending}
        onSubmit={handleSave}
      />

      <SaveViewDialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        title="Rename view"
        initialName={renameTarget?.name ?? ""}
        submitLabel="Rename"
        isPending={updateView.isPending}
        onSubmit={handleRename}
      />
    </div>
  );
}
