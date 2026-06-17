import { create } from "zustand";
import type { SearchStoreState, SearchResultKind } from "./types";

// Backend /api/search only accepts these three kind values
const ALL_KINDS: SearchResultKind[] = ["task", "project", "habit"];

export const useSearchStore = create<SearchStoreState>((set) => ({
  // Command palette
  isOpen: false,
  inputValue: "",
  selectedKinds: ALL_KINDS,

  // Full-page search
  pageQuery: "",
  pageKinds: ALL_KINDS,
  pageLimit: 20,

  // Quick-create
  quickCreateMode: null,

  // Actions
  open: () => set({ isOpen: true }),

  close: () =>
    set({ isOpen: false, inputValue: "", quickCreateMode: null }),

  setInputValue: (inputValue) => set({ inputValue }),

  toggleKind: (k) =>
    set((state) => {
      const has = state.selectedKinds.includes(k);
      const next = has
        ? state.selectedKinds.filter((x) => x !== k)
        : [...state.selectedKinds, k];
      // Never allow empty — revert to all
      return { selectedKinds: next.length === 0 ? ALL_KINDS : next };
    }),

  setSelectedKinds: (selectedKinds) => set({ selectedKinds }),

  setPageQuery: (pageQuery) => set({ pageQuery }),

  setPageKinds: (pageKinds) =>
    set({ pageKinds: pageKinds.length === 0 ? ALL_KINDS : pageKinds }),

  setPageLimit: (pageLimit) => set({ pageLimit }),

  setQuickCreateMode: (quickCreateMode) => set({ quickCreateMode }),

  reset: () =>
    set({
      isOpen: false,
      inputValue: "",
      selectedKinds: ALL_KINDS,
      quickCreateMode: null,
    }),
}));
