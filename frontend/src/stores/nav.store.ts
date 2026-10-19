"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Sidebar items the user may hide from Settings. Dashboard, Organizations,
 * Projects, Trash and Settings are never hideable.
 */
export const HIDEABLE_NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/backlog", label: "Backlog" },
  { href: "/board", label: "Board" },
  { href: "/sprints", label: "Sprints" },
  { href: "/work-items", label: "Work Items" },
  { href: "/hierarchy", label: "Hierarchy" },
  { href: "/goals", label: "Goals" },
  { href: "/calendar", label: "Calendar" },
  { href: "/timeblocking", label: "Time Blocking" },
  { href: "/habits", label: "Habits" },
  { href: "/focus", label: "Focus" },
  { href: "/docs", label: "Docs" },
  { href: "/usage", label: "Usage" },
  { href: "/analytics", label: "Analytics" },
  { href: "/retros", label: "Retros" },
];

interface NavState {
  /** Hrefs of hideable sidebar items the user turned off. */
  hiddenNavItems: string[];
  /** Sidebar section id -> collapsed flag. */
  collapsedSections: Record<string, boolean>;

  setNavItemHidden: (href: string, hidden: boolean) => void;
  toggleSectionCollapsed: (sectionId: string) => void;
}

export const useNavStore = create<NavState>()(
  persist(
    (set) => ({
      hiddenNavItems: [],
      collapsedSections: {},

      setNavItemHidden: (href, hidden) =>
        set((s) => ({
          hiddenNavItems: hidden
            ? Array.from(new Set([...s.hiddenNavItems, href]))
            : s.hiddenNavItems.filter((h) => h !== href),
        })),

      toggleSectionCollapsed: (sectionId) =>
        set((s) => ({
          collapsedSections: {
            ...s.collapsedSections,
            [sectionId]: !s.collapsedSections[sectionId],
          },
        })),
    }),
    {
      name: "mml_nav",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
