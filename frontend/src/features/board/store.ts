"use client";

import { create } from "zustand";
import type {
  WorkItemListItem,
  WorkItemStatus,
  WorkItemType,
  Priority,
  BoardColumn as BoardColumnDef,
} from "@/types";

// ─── Board filters ──────────────────────────────────────────────────────────

export interface BoardFilters {
  type: WorkItemType | "all";
  priority: Priority | "all";
  sprintId: string | "all" | "none";
}

// ─── Board column (runtime, carries inlined items array) ─────────────────────
// Extends the API BoardColumn type with a runtime `items` list and an
// `accentClass` derived from `color` for Tailwind border coloring.

export interface BoardColumn extends BoardColumnDef {
  /** Items currently in this column (optimistic, kept in sync with server). */
  items: WorkItemListItem[];
  /** Tailwind border-color class derived from the column color; used for the
   *  top border accent on each column card. */
  accentClass: string;
}

// ─── State ────────────────────────────────────────────────────────────────────

interface BoardUIState {
  /** Columns ordered by position, each carrying an inlined items array */
  columns: BoardColumn[];

  /** work_item id whose detail sheet is open; null = closed */
  openItemId: string | null;

  /** id of column where the quick-create form is open; null = closed */
  creatingInColumnId: string | null;

  /** Whether a DnD drag is in flight (blocks duplicate drops) */
  isDragging: boolean;

  /** Display filters applied to the board */
  filters: BoardFilters;
  setFilters: (patch: Partial<BoardFilters>) => void;
  resetFilters: () => void;

  // ─── Actions ─────────────────────────────────────────────────────────────────

  setColumns: (columns: BoardColumn[]) => void;

  /**
   * Optimistically move a work item between / within columns.
   * Called on DragOver (cross-column) and DragEnd (same-column reorder).
   */
  moveItem: (
    itemId: string,
    srcColumnId: string,
    dstColumnId: string,
    dstIndex: number,
  ) => void;

  /** Replace a single item's data after a successful mutation */
  updateItem: (item: WorkItemListItem) => void;

  /** Remove an item optimistically (after delete) */
  removeItem: (itemId: string) => void;

  /** Append a newly-created item to the correct column */
  appendItem: (item: WorkItemListItem) => void;

  openItemDetail: (itemId: string) => void;
  closeItemDetail: () => void;

  openCreateInColumn: (columnId: string) => void;
  closeCreateInColumn: () => void;

  setIsDragging: (v: boolean) => void;
}

export const useBoardStore = create<BoardUIState>((set, get) => ({
  columns: [],
  openItemId: null,
  creatingInColumnId: null,
  isDragging: false,
  filters: { type: "all", priority: "all", sprintId: "all" },

  setFilters: (patch) =>
    set((state) => ({ filters: { ...state.filters, ...patch } })),
  resetFilters: () =>
    set({ filters: { type: "all", priority: "all", sprintId: "all" } }),

  setColumns: (columns) => set({ columns }),

  moveItem: (itemId, srcColumnId, dstColumnId, dstIndex) => {
    const cols = get().columns.map((c) => ({
      ...c,
      items: [...(c.items ?? [])],
    }));

    const srcCol = cols.find((c) => c.id === srcColumnId);
    const dstCol = cols.find((c) => c.id === dstColumnId);
    if (!srcCol || !dstCol) return;

    const srcItems = srcCol.items;
    const idx = srcItems.findIndex((i) => i.id === itemId);
    if (idx === -1) return;

    const [item] = srcItems.splice(idx, 1);
    // When moving to a different column, update column_id on the optimistic copy
    // and also update status if the destination has a mapped_status.
    const movedItem: WorkItemListItem =
      srcColumnId !== dstColumnId
        ? {
            ...item,
            column_id: dstColumnId,
            // If the destination column maps to a status enum, reflect that too.
            status: dstCol.mapped_status ?? item.status,
          }
        : item;

    srcCol.items = srcItems;
    const dstItems = dstCol.items;
    dstItems.splice(dstIndex, 0, movedItem);
    dstCol.items = dstItems;

    set({ columns: cols });
  },

  updateItem: (item) => {
    set((state) => ({
      columns: state.columns.map((col) => ({
        ...col,
        items: (col.items ?? []).map((i) => (i.id === item.id ? item : i)),
      })),
    }));
  },

  removeItem: (itemId) => {
    set((state) => ({
      columns: state.columns.map((col) => ({
        ...col,
        items: (col.items ?? []).filter((i) => i.id !== itemId),
      })),
    }));
  },

  appendItem: (item) => {
    set((state) => {
      // Place item in the column matching column_id, or fall back to the
      // column whose mapped_status matches item.status, or first column.
      const target = state.columns.find(
        (col) =>
          (item.column_id && col.id === item.column_id) ||
          (!item.column_id && col.mapped_status === item.status),
      ) ?? state.columns[0];

      if (!target) return state;

      return {
        columns: state.columns.map((col) =>
          col.id !== target.id
            ? col
            : { ...col, items: [...(col.items ?? []), item] },
        ),
      };
    });
  },

  openItemDetail: (itemId) => set({ openItemId: itemId }),
  closeItemDetail: () => set({ openItemId: null }),

  openCreateInColumn: (columnId) => set({ creatingInColumnId: columnId }),
  closeCreateInColumn: () => set({ creatingInColumnId: null }),

  setIsDragging: (v) => set({ isDragging: v }),
}));
