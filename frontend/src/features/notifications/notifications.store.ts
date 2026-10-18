import { create } from "zustand";
import type { NotificationType } from "@/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

// "deadline" is a UI grouping that covers deadline_1d | deadline_2h | deadline_30m.
// "system" is shown as "General" in the UI.
type NotificationFilter = "all" | "deadline" | NotificationType;

/** Inbox status tab on the /notifications page. */
export type InboxView = "all" | "unread" | "snoozed";

interface NotificationsUIState {
  /** Bell-dropdown open state */
  dropdownOpen: boolean;
  /** Type filter on the full /notifications page ("all" = no type filter) */
  activeFilter: NotificationFilter;
  /** Status tab on the full /notifications page */
  inboxView: InboxView;

  // Actions
  openDropdown: () => void;
  closeDropdown: () => void;
  toggleDropdown: () => void;
  setActiveFilter: (filter: NotificationFilter) => void;
  setInboxView: (view: InboxView) => void;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useNotificationsStore = create<NotificationsUIState>((set) => ({
  dropdownOpen: false,
  activeFilter: "all",
  inboxView: "all",

  openDropdown: () => set({ dropdownOpen: true }),
  closeDropdown: () => set({ dropdownOpen: false }),
  toggleDropdown: () =>
    set((state) => ({ dropdownOpen: !state.dropdownOpen })),
  setActiveFilter: (activeFilter) => set({ activeFilter }),
  setInboxView: (inboxView) => set({ inboxView }),
}));
