import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  activeModal: string | null;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  openModal: (id: string) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  commandPaletteOpen: false,
  activeModal: null,

  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

  openCommandPalette: () => set({ commandPaletteOpen: true }),

  closeCommandPalette: () => set({ commandPaletteOpen: false }),

  openModal: (id) => set({ activeModal: id }),

  closeModal: () => set({ activeModal: null }),
}));
