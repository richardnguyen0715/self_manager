"use client";

import type { Notification, NotificationType } from "@/types";

// ─── Re-exports for convenience ────────────────────────────────────────────────

export type { Notification, NotificationType };

// ─── API request shapes ────────────────────────────────────────────────────────

/**
 * Query params for GET /api/notifications.
 * Backend accepts: unread_only (bool), page (default 1), page_size (default 20).
 * There is no `type` filter at the list endpoint.
 */
export interface NotificationListParams {
  page?: number;
  page_size?: number;
  unread_only?: boolean;
}

// ─── Local UI grouping helper ──────────────────────────────────────────────────

export type NotificationGroup = "today" | "earlier";

export interface GroupedNotification {
  group: NotificationGroup;
  items: Notification[];
}
