"use client";

import { useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useUnreadNotificationCount,
  useNotifications,
  useMarkAllNotificationsRead,
} from "../hooks/useNotifications";
import { useNotificationsStore } from "../notifications.store";
import { NotificationItem } from "./NotificationItem";
import { NotificationsBellSkeleton } from "./NotificationsBellSkeleton";

export function NotificationBell() {
  const { dropdownOpen, openDropdown, closeDropdown } = useNotificationsStore();
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const { data: recentData, isLoading } = useNotifications(
    { page_size: 8 },
    { enabled: dropdownOpen },
  );
  const { mutate: markAllRead, isPending: isMarkingAll } =
    useMarkAllNotificationsRead();

  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on outside click / Escape
  useEffect(() => {
    if (!dropdownOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        closeDropdown();
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDropdown();
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [dropdownOpen, closeDropdown]);

  const notifications = recentData?.items ?? [];
  const hasUnread = unreadCount > 0;

  return (
    <div className="relative">
      {/* Bell trigger */}
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        aria-label={`Notifications${hasUnread ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={dropdownOpen}
        aria-haspopup="dialog"
        onClick={() => (dropdownOpen ? closeDropdown() : openDropdown())}
        className="relative"
      >
        <Bell className="h-4 w-4" />
        {hasUnread && (
          <span
            aria-hidden
            className={cn(
              "absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-semibold leading-none text-destructive-foreground",
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown panel */}
      {dropdownOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications panel"
          className={cn(
            "absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border bg-popover shadow-lg",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              Notifications
              {hasUnread && (
                <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {unreadCount}
                </span>
              )}
            </h2>
            {hasUnread && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => markAllRead()}
                disabled={isMarkingAll}
              >
                Mark all read
              </Button>
            )}
          </div>

          <Separator />

          {/* Body */}
          <ScrollArea className="max-h-[420px]">
            {isLoading ? (
              <NotificationsBellSkeleton />
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  You&apos;re all caught up!
                </p>
              </div>
            ) : (
              <div role="list" className="py-1">
                {notifications.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    compact
                    hideDismiss={false}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <Separator />
          <div className="px-4 py-2.5">
            <Link
              href="/notifications"
              onClick={closeDropdown}
              className="block w-full rounded-md py-1.5 text-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
