"use client";

import { BrowserPushOptIn } from "./BrowserPushOptIn";

/**
 * NotificationPreferencesPanel
 *
 * NOTE: The backend does not expose a /api/notifications/preferences endpoint.
 * The only server-configurable preference available is browser push
 * (subscribe/unsubscribe via the service worker). Channel and timing
 * preferences are not yet implemented on the backend.
 */
export function NotificationPreferencesPanel() {
  return (
    <div className="space-y-4">
      {/* Browser push opt-in */}
      <BrowserPushOptIn compact />
    </div>
  );
}
