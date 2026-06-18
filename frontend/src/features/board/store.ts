"use client";

import { create } from "zustand";
import type { WorkItemListItem, WorkItemStatus } from "@/types";

// ─── Board column (virtual, derived from work_item_status) ────────────────────

export interface BoardColumn {
  status: WorkItemStatus;
  label: string;
  accentClass: string;
  items: WorkItemListItem[];
}

// ─── State ────────────────────────────────────────────────────────────────────

interface BoardUIState {
  /** Columns ordered by position, each carrying an inlined items array */
  columns: BoardColumn[];

  /** work_item id whose detail sheet is open; null = closed */
  openItemId: string | null;

  /** id of column where the quick-create form is open; null = closed */
  creatingInColumnStatus: WorkItemStatus | null;

  /** Whether a DnD drag is in flight (blocks duplicate drops) */
  isDragging: boolean;

  // ─── Actions ─────────────────────────────────────────────────────────────────

  setColumns: (columns: BoardColumn[]) => void;

  /**
   * Optimistically move a work item between / within columns.
   * Called on DragOver (cross-column) and DragEnd (same-column reorder).
   */
  moveItem: (
    itemId: string,
    srcStatus: WorkItemStatus,
    dstStatus: WorkItemStatus,
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

  openCreateInColumn: (status: WorkItemStatus) => void;
  closeCreateInColumn: () => void;

  setIsDragging: (v: boolean) => void;
}

export const useBoardStore = create<BoardUIState>((set, get) => ({
  columns: [],
  openItemId: null,
  creatingInColumnStatus: null,
  isDragging: false,

  setColumns: (columns) => set({ columns }),

  moveItem: (itemId, srcStatus, dstStatus, dstIndex) => {
    const cols = get().columns.map((c) => ({
      ...c,
      items: [...(c.items ?? [])],
    }));

    const srcCol = cols.find((c) => c.status === srcStatus);
    const dstCol = cols.find((c) => c.status === dstStatus);
    if (!srcCol || !dstCol) return;

    const srcItems = srcCol.items;
    const idx = srcItems.findIndex((i) => i.id === itemId);
    if (idx === -1) return;

    const [item] = srcItems.splice(idx, 1);
    // When moving to a different column, update the status on the optimistic copy
    const movedItem: WorkItemListItem =
      srcStatus !== dstStatus ? { ...item, status: dstStatus } : item;

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
    set((state) => ({
      columns: state.columns.map((col) => {
        if (col.status !== item.status) return col;
        return { ...col, items: [...(col.items ?? []), item] };
      }),
    }));
  },

  openItemDetail: (itemId) => set({ openItemId: itemId }),
  closeItemDetail: () => set({ openItemId: null }),

  openCreateInColumn: (status) => set({ creatingInColumnStatus: status }),
  closeCreateInColumn: () => set({ creatingInColumnStatus: null }),

  setIsDragging: (v) => set({ isDragging: v }),
}));
