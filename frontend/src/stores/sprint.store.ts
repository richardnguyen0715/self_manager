import { create } from "zustand";
import type { Sprint } from "@/types";

// ─── Active Sprint Store ───────────────────────────────────────────────────────
// Lightweight cache for the currently active sprint so any page/component can
// read it without re-fetching.  The authoritative fetch lives in
// features/agile/hooks/useSprints.ts (useActiveSprint).  This store is
// populated by the SprintProvider that wraps the agile layout.

interface SprintState {
  activeSprint: Sprint | null;
  setActiveSprint: (sprint: Sprint | null) => void;
}

export const useSprintStore = create<SprintState>((set) => ({
  activeSprint: null,
  setActiveSprint: (sprint) => set({ activeSprint: sprint }),
}));
