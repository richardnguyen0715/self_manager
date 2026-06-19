"use client";

import React, { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Plus, Table2, Trello, MoreHorizontal, Pencil, Trash2, X, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DatabaseView as DbView, DatabaseViewType } from "@/types";
import {
  useDatabase,
  useDatabaseRows,
  useViewRows,
  useCreateView,
  useUpdateView,
  useDeleteView,
  useUpdateDatabase,
} from "@/features/docs/hooks/useDocs";
import { TableView } from "./TableView";
import { BoardView } from "./BoardView";
import { FilterSortBar } from "./FilterSortBar";

interface DatabaseViewProps {
  databaseId: string;
  /** When true, render in compact/embed mode (no outer padding, smaller header) */
  embedded?: boolean;
}

/**
 * Top-level Database UI: tabs for views, header with title editing,
 * add-view button, and the actual Table/Board content.
 */
export function DatabaseView({ databaseId, embedded = false }: DatabaseViewProps) {
  const { data: detail, isLoading, error } = useDatabase(databaseId);

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-16", embedded && "py-8")}>
        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className={cn("flex items-center justify-center py-16 text-muted-foreground", embedded && "py-8")}>
        <p className="text-sm">
          {error ? "Failed to load database." : "Database not found."}
        </p>
      </div>
    );
  }

  return (
    <DatabaseViewInner
      databaseId={databaseId}
      detail={detail}
      embedded={embedded}
    />
  );
}

// ─── Inner (has data) ─────────────────────────────────────────────────────────

function DatabaseViewInner({
  databaseId,
  detail,
  embedded,
}: {
  databaseId: string;
  detail: NonNullable<ReturnType<typeof useDatabase>["data"]>;
  embedded: boolean;
}) {
  const { database, columns, views } = detail;
  const safeViews = views ?? [];
  const safeColumns = columns ?? [];

  const [activeViewId, setActiveViewId] = useState<string>(
    safeViews[0]?.id ?? "",
  );
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(database.title);
  const [showAddView, setShowAddView] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [newViewType, setNewViewType] = useState<DatabaseViewType>("table");
  const [viewMenuId, setViewMenuId] = useState<string | null>(null);
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingViewName, setEditingViewName] = useState("");

  const updateDb = useUpdateDatabase(databaseId);
  const createView = useCreateView(databaseId);
  const deleteView = useDeleteView(databaseId);
  const updateView = useUpdateView(databaseId);

  const activeView = safeViews.find((v) => v.id === activeViewId) ?? safeViews[0];

  // Rows data
  const { data: rowsData } = useViewRows(databaseId, activeView?.id ?? "");
  const { data: rawRows } = useDatabaseRows(databaseId);

  // For table view: use view rows (filtered/sorted)
  const tableRows = rowsData?.rows ?? rawRows ?? [];
  // For board view: groups from view rows
  const boardGroups = rowsData?.groups ?? [];

  function saveTitle() {
    if (titleDraft.trim() && titleDraft !== database.title) {
      updateDb.mutate({ title: titleDraft.trim() });
    }
    setEditingTitle(false);
  }

  function addView() {
    if (!newViewName.trim()) return;
    createView.mutate(
      {
        name: newViewName.trim(),
        type: newViewType,
        position: safeViews.length,
      },
      {
        onSuccess: (created) => {
          setActiveViewId(created.id);
          setNewViewName("");
          setShowAddView(false);
        },
      },
    );
  }

  function renameView(viewId: string) {
    if (!editingViewName.trim()) return;
    updateView.mutate(
      { viewId, payload: { name: editingViewName.trim() } },
      { onSuccess: () => setEditingViewId(null) },
    );
  }

  function removeView(viewId: string) {
    if (safeViews.length <= 1) return; // keep at least one
    const nextView = safeViews.find((v) => v.id !== viewId);
    if (nextView) setActiveViewId(nextView.id);
    deleteView.mutate(viewId);
    setViewMenuId(null);
  }

  function handleFilterSortChange(updatedConfig: NonNullable<typeof activeView>["config"]) {
    if (!activeView) return;
    updateView.mutate({ viewId: activeView.id, payload: { config: updatedConfig } });
  }

  return (
    <div className={cn("flex flex-col h-full min-h-0", !embedded && "")}>
      {/* Database header */}
      <div className={cn("px-4 py-3 border-b border-border", embedded && "px-3 py-2")}>
        <div className="flex items-center gap-2">
          {database.icon && (
            <span className={cn("text-2xl leading-none", embedded && "text-lg")}>
              {database.icon}
            </span>
          )}

          {editingTitle ? (
            <input
              autoFocus
              className={cn(
                "font-semibold bg-transparent border-0 outline-none focus:ring-1 focus:ring-ring rounded px-1",
                embedded ? "text-base" : "text-xl",
              )}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") {
                  setTitleDraft(database.title);
                  setEditingTitle(false);
                }
              }}
            />
          ) : (
            <h2
              className={cn(
                "font-semibold cursor-text hover:bg-accent/50 rounded px-1 py-0.5",
                embedded ? "text-base" : "text-xl",
              )}
              onClick={() => setEditingTitle(true)}
            >
              {database.title}
            </h2>
          )}
        </div>
      </div>

      {/* View tabs */}
      <Tabs.Root
        value={activeView?.id ?? ""}
        onValueChange={setActiveViewId}
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="flex items-center gap-0 px-4 border-b border-border overflow-x-auto">
          <Tabs.List className="flex items-center gap-0 -mb-px">
            {safeViews.map((view) => (
              <ViewTab
                key={view.id}
                view={view}
                active={activeView?.id === view.id}
                menuOpen={viewMenuId === view.id}
                isEditing={editingViewId === view.id}
                editingName={editingViewName}
                onEditingNameChange={setEditingViewName}
                onMenuToggle={() =>
                  setViewMenuId((prev) => (prev === view.id ? null : view.id))
                }
                onRename={() => {
                  setEditingViewId(view.id);
                  setEditingViewName(view.name);
                  setViewMenuId(null);
                }}
                onRenameSubmit={() => renameView(view.id)}
                onDelete={() => removeView(view.id)}
                canDelete={safeViews.length > 1}
              />
            ))}
          </Tabs.List>

          {/* Add view */}
          <div className="relative ml-1 flex-shrink-0">
            <button
              className="flex items-center gap-1 px-2 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded"
              onClick={() => setShowAddView((v) => !v)}
            >
              <Plus className="w-3.5 h-3.5" />
              Add view
            </button>

            {showAddView && (
              <div
                className="absolute top-full left-0 mt-1 z-50 w-60 bg-popover border border-border rounded-lg shadow-lg p-3 space-y-2"
                onClick={(e) => e.stopPropagation()}
              >
                <Input
                  autoFocus
                  placeholder="View name"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  className="h-8 text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter") addView(); if (e.key === "Escape") setShowAddView(false); }}
                />
                <div className="flex gap-2">
                  <button
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1 py-2 rounded border text-xs",
                      newViewType === "table"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input hover:border-border",
                    )}
                    onClick={() => setNewViewType("table")}
                  >
                    <Table2 className="w-4 h-4" />
                    Table
                  </button>
                  <button
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1 py-2 rounded border text-xs",
                      newViewType === "board"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input hover:border-border",
                    )}
                    onClick={() => setNewViewType("board")}
                  >
                    <Trello className="w-4 h-4" />
                    Board
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs" onClick={() => setShowAddView(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={addView}
                    disabled={!newViewName.trim() || createView.isPending}
                  >
                    Create
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Filter/sort bar for table views */}
          {activeView?.type === "table" && (
            <div className="ml-auto flex-shrink-0">
              <FilterSortBar
                columns={safeColumns}
                config={activeView.config ?? {}}
                onChange={handleFilterSortChange}
              />
            </div>
          )}
        </div>

        {/* View content */}
        {safeViews.map((view) => (
          <Tabs.Content
            key={view.id}
            value={view.id}
            className="flex-1 min-h-0 overflow-hidden outline-none"
          >
            {view.type === "table" ? (
              <TableView
                dbId={databaseId}
                view={view}
                columns={safeColumns}
                rows={tableRows}
              />
            ) : (
              <BoardView
                dbId={databaseId}
                view={view}
                columns={safeColumns}
                groups={boardGroups}
              />
            )}
          </Tabs.Content>
        ))}

        {safeViews.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p className="text-sm">No views — add one above.</p>
          </div>
        )}
      </Tabs.Root>
    </div>
  );
}

// ─── View tab ─────────────────────────────────────────────────────────────────

interface ViewTabProps {
  view: DbView;
  active: boolean;
  menuOpen: boolean;
  isEditing: boolean;
  editingName: string;
  onEditingNameChange: (v: string) => void;
  onMenuToggle: () => void;
  onRename: () => void;
  onRenameSubmit: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

function ViewTab({
  view,
  active,
  menuOpen,
  isEditing,
  editingName,
  onEditingNameChange,
  onMenuToggle,
  onRename,
  onRenameSubmit,
  onDelete,
  canDelete,
}: ViewTabProps) {
  const Icon = view.type === "table" ? Table2 : Trello;

  return (
    <Tabs.Trigger
      value={view.id}
      asChild
    >
      <div
        className={cn(
          "relative flex items-center gap-1.5 px-3 py-2.5 text-sm cursor-pointer border-b-2 transition-colors group/tab",
          active
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
        )}
      >
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />

        {isEditing ? (
          <input
            autoFocus
            className="w-24 bg-transparent border-0 outline-none text-sm"
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            onBlur={onRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameSubmit();
              if (e.key === "Escape") onEditingNameChange(view.name);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="max-w-[120px] truncate">{view.name}</span>
        )}

        {/* Tab menu trigger */}
        <button
          className={cn(
            "ml-0.5 p-0.5 rounded opacity-0 group-hover/tab:opacity-100 hover:bg-accent/50 transition-opacity",
            menuOpen && "opacity-100",
          )}
          onClick={(e) => {
            e.stopPropagation();
            onMenuToggle();
          }}
        >
          <MoreHorizontal className="w-3 h-3" />
        </button>

        {/* Tab dropdown */}
        {menuOpen && (
          <div
            className="absolute top-full left-0 mt-1 z-50 w-40 bg-popover border border-border rounded-md shadow-md py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
              onClick={onRename}
            >
              <Pencil className="w-3.5 h-3.5" />
              Rename
            </button>
            {canDelete && (
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </Tabs.Trigger>
  );
}
