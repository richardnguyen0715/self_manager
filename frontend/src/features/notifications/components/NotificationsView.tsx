"use client";

import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useNotificationsStore } from "../notifications.store";
import { NotificationFilters } from "./NotificationFilters";
import { NotificationsList } from "./NotificationsList";
import { BrowserPushOptIn } from "./BrowserPushOptIn";
import { NotificationPreferencesPanel } from "./NotificationPreferencesPanel";
import { useState } from "react";

export function NotificationsView() {
  const { activeFilter } = useNotificationsStore();
  const [showPreferences, setShowPreferences] = useState(false);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Page header actions */}
      <div className="flex items-center justify-between gap-3">
        <NotificationFilters />
        <Button
          variant={showPreferences ? "secondary" : "ghost"}
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={() => setShowPreferences((v) => !v)}
          aria-expanded={showPreferences}
          aria-controls="notification-preferences"
        >
          <Settings2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Preferences</span>
        </Button>
      </div>

      {/* Preferences panel (collapsible) */}
      {showPreferences && (
        <section
          id="notification-preferences"
          aria-label="Notification preferences"
          className="rounded-xl border bg-card p-5"
        >
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Notification preferences
          </h2>
          <NotificationPreferencesPanel />
        </section>
      )}

      {/* Browser push opt-in banner — shown when not yet subscribed */}
      {!showPreferences && (
        <BrowserPushOptIn compact={false} />
      )}

      <Separator />

      {/* Active filter heading */}
      {activeFilter !== "all" && (
        <p className="text-xs font-medium text-muted-foreground">
          Showing:{" "}
          <span className="text-foreground capitalize">
            {activeFilter === "unread"
              ? "Unread"
              : activeFilter.replace(/_/g, " ")}
          </span>
        </p>
      )}

      {/* Notifications list */}
      <NotificationsList />
    </div>
  );
}
