"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type { NotificationPreferences, UpdateNotificationPrefsPayload } from "../types";

// ─── Query keys ────────────────────────────────────────────────────────────────

export const notificationPrefKeys = {
  all: ["settings", "notifications"] as const,
  prefs: () => [...notificationPrefKeys.all, "prefs"] as const,
} as const;

// ─── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Fetches the user's notification preferences.
 * GET /api/settings/notifications
 */
export function useNotificationPrefs() {
  return useQuery<NotificationPreferences, Error>({
    queryKey: notificationPrefKeys.prefs(),
    queryFn: () =>
      api.get<NotificationPreferences>(API_ENDPOINTS.SETTINGS_NOTIFICATIONS),
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Updates notification preferences.
 * PATCH /api/settings/notifications
 */
export function useUpdateNotificationPrefs() {
  const queryClient = useQueryClient();

  return useMutation<
    NotificationPreferences,
    Error,
    UpdateNotificationPrefsPayload
  >({
    mutationFn: (payload) =>
      api.patch<NotificationPreferences>(
        API_ENDPOINTS.SETTINGS_NOTIFICATIONS,
        payload,
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData<NotificationPreferences>(
        notificationPrefKeys.prefs(),
        updated,
      );
    },
  });
}

/**
 * Requests browser push permission and registers the subscription with the
 * backend via POST /api/notifications/push/subscribe.
 * Returns the updated preferences (browser_push_subscribed = true).
 */
export function useSubscribePush() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        throw new Error("Push notifications are not supported in this browser.");
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error(
          "Push notification permission was denied. Please allow notifications in browser settings.",
        );
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error("Push notifications are not configured.");
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
      });

      // Canonical push subscribe endpoint
      await api.post(API_ENDPOINTS.NOTIFICATIONS_PUSH_SUBSCRIBE, subscription.toJSON());
    },
    onSuccess: () => {
      // Invalidate prefs so browser_push_subscribed refreshes
      queryClient.invalidateQueries({ queryKey: notificationPrefKeys.prefs() });
    },
  });
}

/**
 * Unsubscribes the current device from push notifications.
 * POST /api/notifications/push/unsubscribe
 */
export function useUnsubscribePush() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          // Notify backend first, then unsubscribe locally
          await api.post(API_ENDPOINTS.NOTIFICATIONS_PUSH_UNSUBSCRIBE, {
            endpoint: subscription.endpoint,
          });
          await subscription.unsubscribe();
        }
      }
    },
    onSuccess: () => {
      // Invalidate prefs so browser_push_subscribed refreshes
      queryClient.invalidateQueries({ queryKey: notificationPrefKeys.prefs() });
    },
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
