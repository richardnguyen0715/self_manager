"use client";

import { create } from "zustand";
import type { Habit, HabitFrequency, HabitType } from "@/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

type HabitModal =
  | { type: "create" }
  | { type: "edit"; habit: Habit }
  | { type: "log"; habit: Habit }
  | { type: "heatmap"; habit: Habit }
  | null;

type FilterFrequency = HabitFrequency | "all";
type FilterType = HabitType | "all";

interface HabitsState {
  // ── Filters ────────────────────────────────────────────────────────────────
  filterFrequency: FilterFrequency;
  filterType: FilterType;
  showArchived: boolean;

  // ── Active modal ──────────────────────────────────────────────────────────
  modal: HabitModal;

  // ── Actions ───────────────────────────────────────────────────────────────
  setFilterFrequency: (v: FilterFrequency) => void;
  setFilterType: (v: FilterType) => void;
  setShowArchived: (v: boolean) => void;

  openCreateModal: () => void;
  openEditModal: (habit: Habit) => void;
  openLogModal: (habit: Habit) => void;
  openHeatmapModal: (habit: Habit) => void;
  closeModal: () => void;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useHabitsStore = create<HabitsState>((set) => ({
  filterFrequency: "all",
  filterType: "all",
  showArchived: false,

  modal: null,

  setFilterFrequency: (v) => set({ filterFrequency: v }),
  setFilterType: (v) => set({ filterType: v }),
  setShowArchived: (v) => set({ showArchived: v }),

  openCreateModal: () => set({ modal: { type: "create" } }),
  openEditModal: (habit) => set({ modal: { type: "edit", habit } }),
  openLogModal: (habit) => set({ modal: { type: "log", habit } }),
  openHeatmapModal: (habit) => set({ modal: { type: "heatmap", habit } }),
  closeModal: () => set({ modal: null }),
}));
