// ─── Components ───────────────────────────────────────────────────────────────
export { NotificationBell } from "./components/NotificationBell";
export { NotificationItem } from "./components/NotificationItem";
export { NotificationFilters } from "./components/NotificationFilters";
export { NotificationsList } from "./components/NotificationsList";
export { NotificationsView } from "./components/NotificationsView";
export { NotificationPreferencesPanel } from "./components/NotificationPreferencesPanel";
export { BrowserPushOptIn } from "./components/BrowserPushOptIn";
export { NotificationIcon } from "./components/NotificationIcon";

// ─── Hooks ────────────────────────────────────────────────────────────────────
export {
  notificationKeys,
  useNotifications,
  useInfiniteNotifications,
  useUnreadNotificationCount,
  useNotification,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
  useSnoozeNotification,
} from "./hooks/useNotifications";

export { useBrowserPush } from "./hooks/useBrowserPush";

// ─── Store ────────────────────────────────────────────────────────────────────
export { useNotificationsStore } from "./notifications.store";

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  NotificationListParams,
  NotificationGroup,
  GroupedNotification,
} from "./types";
