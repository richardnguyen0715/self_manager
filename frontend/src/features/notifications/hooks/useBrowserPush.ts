"use client";

import { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api";

const PUSH_SUBSCRIBE_ENDPOINT = "/api/notifications/push/subscribe" as const;
const PUSH_UNSUBSCRIBE_ENDPOINT = "/api/notifications/push/unsubscribe" as const;

type PushPermissionState = "default" | "granted" | "denied" | "unsupported";

interface UseBrowserPushReturn {
  /** Current Notification.permission value (or "unsupported") */
  permissionState: PushPermissionState;
  /** True while subscribe/unsubscribe request is in-flight */
  isLoading: boolean;
  /** Last error from the subscribe/unsubscribe flow */
  error: string | null;
  /** Whether push notifications are fully set up (granted + server registered) */
  isSubscribed: boolean;
  /** Request permission and register with the backend */
  subscribe: () => Promise<void>;
  /** Unregister from the backend and clear the SW subscription */
  unsubscribe: () => Promise<void>;
}

function getVapidKey(): string {
  // The VAPID public key is injected at build time via Next.js env variables.
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    bytes[i] = rawData.charCodeAt(i);
  }
  return bytes;
}

export function useBrowserPush(): UseBrowserPushReturn {
  const [permissionState, setPermissionState] =
    useState<PushPermissionState>("default");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Initialise permission state on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermissionState("unsupported");
      return;
    }
    setPermissionState(Notification.permission as PushPermissionState);

    // Check whether we already have a push subscription registered
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          if (sub) setIsSubscribed(true);
        })
        .catch(() => {
          // SW not ready or push not available — silently ignore
        });
    }
  }, []);

  const subscribe = useCallback(async () => {
    setError(null);

    if (typeof window === "undefined" || !("Notification" in window)) {
      setError("Browser push notifications are not supported.");
      return;
    }

    setIsLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission as PushPermissionState);

      if (permission !== "granted") {
        setError(
          "Permission denied. Enable notifications in your browser settings.",
        );
        return;
      }

      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setError("Push notifications require a modern browser with service worker support.");
        return;
      }

      const vapidKey = getVapidKey();
      if (!vapidKey) {
        setError("Push notifications are not configured for this environment.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Send the subscription to the backend
      await api.post(PUSH_SUBSCRIBE_ENDPOINT, subscription.toJSON());

      setIsSubscribed(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to enable push notifications.";
      setError(message);
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          // Notify backend first so it removes the endpoint
          await api.post(PUSH_UNSUBSCRIBE_ENDPOINT, {
            endpoint: subscription.endpoint,
          });
          await subscription.unsubscribe();
        }
      }
      setIsSubscribed(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to disable push notifications.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    permissionState,
    isLoading,
    error,
    isSubscribed,
    subscribe,
    unsubscribe,
  };
}
