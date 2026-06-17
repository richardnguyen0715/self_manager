"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AppearancePreferences,
  SettingsSection,
  ColorTheme,
} from "./types";

// ─── Appearance state (persisted locally) ─────────────────────────────────────

interface AppearanceState {
  theme: AppearancePreferences["theme"];
  colorTheme: ColorTheme;
  compactMode: boolean;
  showCompletedTasks: boolean;
  weekStartsOn: 0 | 1;

  setTheme: (theme: AppearancePreferences["theme"]) => void;
  setColorTheme: (colorTheme: ColorTheme) => void;
  setCompactMode: (compactMode: boolean) => void;
  setShowCompletedTasks: (show: boolean) => void;
  setWeekStartsOn: (day: 0 | 1) => void;
  applyFromServer: (prefs: AppearancePreferences) => void;
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      theme: "system",
      colorTheme: "zinc",
      compactMode: false,
      showCompletedTasks: true,
      weekStartsOn: 1,

      setTheme: (theme) => set({ theme }),
      setColorTheme: (colorTheme) => set({ colorTheme }),
      setCompactMode: (compactMode) => set({ compactMode }),
      setShowCompletedTasks: (showCompletedTasks) => set({ showCompletedTasks }),
      setWeekStartsOn: (weekStartsOn) => set({ weekStartsOn }),
      applyFromServer: (prefs) =>
        set({
          theme: prefs.theme,
          colorTheme: prefs.color_theme,
          compactMode: prefs.compact_mode,
          showCompletedTasks: prefs.show_completed_tasks,
          weekStartsOn: prefs.week_starts_on,
        }),
    }),
    {
      name: "mml_appearance",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// ─── Settings UI state (non-persisted) ────────────────────────────────────────

interface SettingsUIState {
  activeSection: SettingsSection;
  changePasswordOpen: boolean;
  deleteAccountOpen: boolean;

  setActiveSection: (section: SettingsSection) => void;
  setChangePasswordOpen: (open: boolean) => void;
  setDeleteAccountOpen: (open: boolean) => void;
}

export const useSettingsUIStore = create<SettingsUIState>((set) => ({
  activeSection: "profile",
  changePasswordOpen: false,
  deleteAccountOpen: false,

  setActiveSection: (activeSection) => set({ activeSection }),
  setChangePasswordOpen: (changePasswordOpen) => set({ changePasswordOpen }),
  setDeleteAccountOpen: (deleteAccountOpen) => set({ deleteAccountOpen }),
}));
