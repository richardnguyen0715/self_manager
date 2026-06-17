"use client";

import { memo, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NotificationIcon } from "./NotificationIcon";
import { useMarkNotificationRead, useDeleteNotification } from "../hooks/useNotifications";
import type { Notification } from "@/types";

interface NotificationItemProps {
  notification: Notification;
  /** Compact mode: used inside the dropdown */
  compact?: boolean;
  /** Hide the dismiss (X) button */
  hideDismiss?: boolean;
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export const NotificationItem = memo(function NotificationItem({
  notification,
  compact = false,
  hideDismiss = false,
}: NotificationItemProps) {
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: deleteNotification, isPending: isDeleting } =
    useDeleteNotification();

  const handleMarkRead = useCallback(() => {
    if (!notification.read) {
      markRead(notification.id);
    }
  }, [notification.id, notification.read, markRead]);

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      deleteNotification(notification.id);
    },
    [notification.id, deleteNotification],
  );

  const timestamp = notification.sent_at ?? notification.created_at;

  return (
    <div
      role="listitem"
      onClick={handleMarkRead}
      className={cn(
        "group relative flex gap-3 rounded-lg transition-colors",
        compact ? "px-3 py-2.5" : "px-4 py-3",
        !notification.read &&
          "bg-primary/5 hover:bg-primary/10",
        notification.read &&
          "hover:bg-muted/60",
        !notification.read && "cursor-pointer",
      )}
    >
      {/* Unread indicator dot */}
      {!notification.read && (
        <span
          aria-label="Unread"
          className="absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary"
        />
      )}

      <NotificationIcon type={notification.type} />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm leading-snug",
            !notification.read
              ? "font-semibold text-foreground"
              : "font-normal text-foreground",
          )}
        >
          {notification.title}
        </p>
        {notification.body && (
          <p
            className={cn(
              "mt-0.5 line-clamp-2 text-xs leading-relaxed",
              compact ? "line-clamp-1" : "line-clamp-2",
              "text-muted-foreground",
            )}
          >
            {notification.body}
          </p>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          {formatRelativeTime(timestamp ?? notification.created_at)}
        </p>
      </div>

      {/* Dismiss button */}
      {!hideDismiss && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Dismiss notification"
              disabled={isDeleting}
              onClick={handleDismiss}
              className={cn(
                "h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100",
                isDeleting && "opacity-50",
              )}
            >
              <X className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Dismiss</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
});
