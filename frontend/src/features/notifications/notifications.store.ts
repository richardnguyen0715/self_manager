import { create } from "zustand";
import type { NotificationType } from "@/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

// "deadline" is a UI grouping that covers deadline_1d | deadline_2h | deadline_30m.
// "system" is shown as "General" in the UI.
type NotificationFilter = "all" | "unread" | "deadline" | NotificationType;

interface NotificationsUIState {
  /** Bell-dropdown open state */
  dropdownOpen: boolean;
  /** Active filter on the full /notifications page */
  activeFilter: NotificationFilter;

  // Actions
  openDropdown: () => void;
  closeDropdown: () => void;
  toggleDropdown: () => void;
  setActiveFilter: (filter: NotificationFilter) => void;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useNotificationsStore = create<NotificationsUIState>((set) => ({
  dropdownOpen: false,
  activeFilter: "all",

  openDropdown: () => set({ dropdownOpen: true }),
  closeDropdown: () => set({ dropdownOpen: false }),
  toggleDropdown: () =>
    set((state) => ({ dropdownOpen: !state.dropdownOpen })),
  setActiveFilter: (activeFilter) => set({ activeFilter }),
}));
