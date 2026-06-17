// ─── View ──────────────────────────────────────────────────────────────────────
export { SettingsView } from "./components/SettingsView";

// ─── Hooks ─────────────────────────────────────────────────────────────────────
export { useProfile, useUpdateProfile, useUploadAvatar, useRemoveAvatar } from "./hooks/useProfile";
export { useChangePassword, useDeleteAccount, useLogoutAllSessions } from "./hooks/useAccount";
export { useNotificationPrefs, useUpdateNotificationPrefs, useSubscribePush, useUnsubscribePush } from "./hooks/useNotificationPrefs";
export { useAppearancePrefs, useUpdateAppearancePrefs } from "./hooks/useAppearancePrefs";

// ─── Stores ────────────────────────────────────────────────────────────────────
export { useAppearanceStore, useSettingsUIStore } from "./settings.store";

// ─── Types ─────────────────────────────────────────────────────────────────────
export type {
  UpdateProfilePayload,
  ChangePasswordPayload,
  AvatarUploadResponse,
  NotificationPreferences,
  UpdateNotificationPrefsPayload,
  AppearancePreferences,
  UpdateAppearancePayload,
  ColorTheme,
  SettingsSection,
} from "./types";
