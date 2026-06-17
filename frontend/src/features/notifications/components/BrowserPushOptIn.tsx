"use client";

import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBrowserPush } from "../hooks/useBrowserPush";

interface BrowserPushOptInProps {
  /** Compact inline variant for the preferences section */
  compact?: boolean;
}

export function BrowserPushOptIn({ compact = false }: BrowserPushOptInProps) {
  const {
    permissionState,
    isLoading,
    error,
    isSubscribed,
    subscribe,
    unsubscribe,
  } = useBrowserPush();

  if (permissionState === "unsupported") {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            Browser push notifications
          </p>
          <p className="text-xs text-muted-foreground">
            {isSubscribed
              ? "Enabled — you will receive push alerts in this browser."
              : permissionState === "denied"
              ? "Blocked in browser settings — enable site notifications to continue."
              : "Get alerted even when the tab is in the background."}
          </p>
          {error && (
            <p className="mt-1 text-xs text-destructive">{error}</p>
          )}
        </div>

        {permissionState !== "denied" && (
          <Button
            variant={isSubscribed ? "outline" : "secondary"}
            size="sm"
            onClick={isSubscribed ? unsubscribe : subscribe}
            disabled={isLoading}
            className="shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isSubscribed ? (
              <>
                <BellOff className="mr-1.5 h-3.5 w-3.5" />
                Disable
              </>
            ) : (
              <>
                <BellRing className="mr-1.5 h-3.5 w-3.5" />
                Enable
              </>
            )}
          </Button>
        )}
      </div>
    );
  }

  // Full banner variant — shown at top of /notifications page when not yet subscribed
  if (isSubscribed || permissionState === "denied") return null;

  return (
    <div
      className={cn(
        "flex items-start gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4",
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Bell className="h-4 w-4 text-primary" />
      </span>

      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">
          Stay on top of deadlines
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Enable browser push notifications to get deadline reminders, habit
          nudges, and focus alerts even when ManageMyLife is in the background.
        </p>
        {error && (
          <p className="mt-1.5 text-xs text-destructive">{error}</p>
        )}
      </div>

      <Button
        size="sm"
        onClick={subscribe}
        disabled={isLoading}
        className="shrink-0"
      >
        {isLoading ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <BellRing className="mr-1.5 h-3.5 w-3.5" />
        )}
        Enable
      </Button>
    </div>
  );
}
