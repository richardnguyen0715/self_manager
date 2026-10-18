"use client";

import type { NotificationChannel } from "@/types";

// ─── Profile ───────────────────────────────────────────────────────────────────

export interface UpdateProfilePayload {
  name?: string;
  timezone?: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface AvatarUploadResponse {
  avatar_url: string;
}

// ─── Notification Preferences ─────────────────────────────────────────────────

export interface NotificationPreferences {
  deadline_reminder_channels: NotificationChannel[];
  habit_reminder_channels: NotificationChannel[];
  time_block_reminder_channels: NotificationChannel[];
  /** Lead times in minutes, e.g. [1440, 120, 30] */
  deadline_reminder_offsets: number[];
  /** "HH:MM" local time or null to disable */
  habit_reminder_time: string | null;
  browser_push_subscribed: boolean;
}

export interface UpdateNotificationPrefsPayload {
  deadline_reminder_channels?: NotificationChannel[];
  habit_reminder_channels?: NotificationChannel[];
  time_block_reminder_channels?: NotificationChannel[];
  deadline_reminder_offsets?: number[];
  habit_reminder_time?: string | null;
}

// ─── Appearance ───────────────────────────────────────────────────────────────

export type ColorTheme = "zinc" | "slate" | "blue" | "green" | "rose" | "orange";

export interface AppearancePreferences {
  theme: "light" | "dark" | "system";
  color_theme: ColorTheme;
  compact_mode: boolean;
  show_completed_tasks: boolean;
  week_starts_on: 0 | 1; // 0 = Sunday, 1 = Monday
}

export interface UpdateAppearancePayload {
  theme?: AppearancePreferences["theme"];
  color_theme?: ColorTheme;
  compact_mode?: boolean;
  show_completed_tasks?: boolean;
  week_starts_on?: 0 | 1;
}

// ─── Settings Section navigation ──────────────────────────────────────────────

export type SettingsSection =
  | "profile"
  | "account"
  | "notifications"
  | "appearance"
  | "labels";
