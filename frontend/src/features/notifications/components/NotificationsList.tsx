"use client";

import { useEffect, useRef, useCallback } from "react";
import { Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  useInfiniteNotifications,
  useMarkAllNotificationsRead,
} from "../hooks/useNotifications";
import { useNotificationsStore } from "../notifications.store";
import { NotificationItem } from "./NotificationItem";
import { NotificationsListSkeleton } from "./NotificationsListSkeleton";
import type { Notification } from "@/types";

function isToday(isoString: string): boolean {
  const d = new Date(isoString);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function NotificationsList() {
  const { activeFilter } = useNotificationsStore();
  const { mutate: markAllRead, isPending: isMarkingAll } =
    useMarkAllNotificationsRead();

  // Derive query params from active filter.
  // The backend list endpoint only supports unread_only; there is no type filter.
  const unread_only = activeFilter === "unread" ? true : undefined;

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    error,
  } = useInfiniteNotifications({ unread_only, page_size: 20 });

  // Flatten all pages into a single array
  const allNotifications: Notification[] =
    data?.pages.flatMap((p) => p.items) ?? [];

  const totalCount = data?.pages[0]?.total ?? 0;
  const unreadInView = allNotifications.filter((n) => !n.read).length;

  // Split into today / earlier
  const todayItems = allNotifications.filter((n) =>
    isToday(n.sent_at ?? n.created_at),
  );
  const earlierItems = allNotifications.filter(
    (n) => !isToday(n.sent_at ?? n.created_at),
  );

  // Note: type-filter tabs (deadline_reminder, habit_reminder, etc.) are client-side
  // only since the backend list endpoint has no type query param. Filter after fetch.
  const visibleToday =
    activeFilter !== "all" && activeFilter !== "unread"
      ? todayItems.filter((n) => n.type === activeFilter)
      : todayItems;
  const visibleEarlier =
    activeFilter !== "all" && activeFilter !== "unread"
      ? earlierItems.filter((n) => n.type === activeFilter)
      : earlierItems;

  // Intersection observer for "load more"
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [handleObserver]);

  // ─── States ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return <NotificationsListSkeleton count={8} />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-sm text-destructive">
          {error instanceof Error
            ? error.message
            : "Failed to load notifications."}
        </p>
        <Button variant="outline" size="sm" onClick={() => fetchNextPage()}>
          Retry
        </Button>
      </div>
    );
  }

  if (visibleToday.length === 0 && visibleEarlier.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <Bell className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-base font-medium text-muted-foreground">
          {activeFilter === "unread"
            ? "No unread notifications"
            : "No notifications yet"}
        </p>
        <p className="text-sm text-muted-foreground/70">
          {activeFilter === "unread"
            ? "You're all caught up!"
            : "Deadline reminders, habit nudges and more will appear here."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* List header */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {totalCount} notification{totalCount !== 1 ? "s" : ""}
          {unreadInView > 0 && (
            <span className="ml-1 font-semibold text-foreground">
              &bull; {unreadInView} unread
            </span>
          )}
        </p>
        {unreadInView > 0 && (
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

      {/* Today group */}
      {visibleToday.length > 0 && (
        <section aria-label="Today">
          <div className="mb-1 flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Today
            </p>
            <Separator className="flex-1" />
          </div>
          <div role="list" className="rounded-xl border bg-card">
            {visibleToday.map((n, idx) => (
              <div key={n.id}>
                <NotificationItem notification={n} />
                {idx < visibleToday.length - 1 && (
                  <Separator className="mx-4" />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Earlier group */}
      {visibleEarlier.length > 0 && (
        <section aria-label="Earlier" className="mt-6">
          <div className="mb-1 flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Earlier
            </p>
            <Separator className="flex-1" />
          </div>
          <div role="list" className="rounded-xl border bg-card">
            {visibleEarlier.map((n, idx) => (
              <div key={n.id}>
                <NotificationItem notification={n} />
                {idx < visibleEarlier.length - 1 && (
                  <Separator className="mx-4" />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={loadMoreRef} className="py-4 text-center">
        {isFetchingNextPage && (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        )}
        {!hasNextPage && allNotifications.length > 0 && (
          <p className="text-xs text-muted-foreground/60">
            No more notifications
          </p>
        )}
      </div>
    </div>
  );
}
