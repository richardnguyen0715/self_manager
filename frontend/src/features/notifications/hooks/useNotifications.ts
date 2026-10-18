"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  type UseQueryOptions,
  type InfiniteData,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type {
  Notification,
  NotificationListResponse,
  UnreadCountResponse,
} from "@/types";
import type { NotificationListParams } from "../types";

// ─── Query key factory ─────────────────────────────────────────────────────────

export const notificationKeys = {
  all: ["notifications"] as const,
  lists: () => [...notificationKeys.all, "list"] as const,
  list: (params: NotificationListParams) =>
    [...notificationKeys.lists(), params] as const,
  unreadCount: () => [...notificationKeys.all, "unread-count"] as const,
  detail: (id: string) => [...notificationKeys.all, "detail", id] as const,
} as const;

// ─── List / detail ─────────────────────────────────────────────────────────────

/**
 * Paginated list of notifications.
 * GET /api/notifications?page=&page_size=&unread_only=
 * Response: NotificationListResponse { items, total, page, page_size, unread_count }
 */
export function useNotifications(
  params: NotificationListParams = {},
  options?: Partial<UseQueryOptions<NotificationListResponse>>,
) {
  return useQuery<NotificationListResponse>({
    queryKey: notificationKeys.list(params),
    queryFn: () =>
      api.get<NotificationListResponse>(API_ENDPOINTS.NOTIFICATIONS, {
        page: params.page ?? 1,
        page_size: params.page_size ?? 30,
        ...(params.unread_only !== undefined && {
          unread_only: params.unread_only,
        }),
      }),
    staleTime: 1000 * 30, // 30 s — notifications change frequently
    ...options,
  });
}

/**
 * Infinite query for the full notifications list page (scroll-to-load-more).
 * GET /api/notifications?page=1&page_size=20 → next pages on demand
 */
export function useInfiniteNotifications(
  params: Omit<NotificationListParams, "page"> = {},
) {
  return useInfiniteQuery<
    NotificationListResponse,
    Error,
    InfiniteData<NotificationListResponse>,
    ReturnType<typeof notificationKeys.list>,
    number
  >({
    queryKey: notificationKeys.list({ ...params, page: undefined }),
    queryFn: ({ pageParam }) =>
      api.get<NotificationListResponse>(API_ENDPOINTS.NOTIFICATIONS, {
        page: pageParam,
        page_size: params.page_size ?? 20,
        ...(params.unread_only !== undefined && {
          unread_only: params.unread_only,
        }),
        ...(params.snoozed && { snoozed: true }),
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total / lastPage.page_size);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
    staleTime: 1000 * 30,
  });
}

/**
 * Lightweight unread count — polled every 60 s when the window is focused.
 * GET /api/notifications/unread-count → { unread_count }
 */
export function useUnreadNotificationCount() {
  return useQuery<number>({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async () => {
      const res = await api.get<UnreadCountResponse>(
        API_ENDPOINTS.NOTIFICATIONS_UNREAD_COUNT,
      );
      return res.unread_count;
    },
    staleTime: 1000 * 60, // 60 s
    refetchInterval: 1000 * 60, // poll every minute
    refetchIntervalInBackground: false,
  });
}

/**
 * GET /api/notifications/:id → flat NotificationResponse
 */
export function useNotification(
  id: string,
  options?: Partial<UseQueryOptions<Notification>>,
) {
  return useQuery<Notification>({
    queryKey: notificationKeys.detail(id),
    queryFn: () =>
      api.get<Notification>(API_ENDPOINTS.NOTIFICATION_BY_ID(id)),
    enabled: Boolean(id),
    ...options,
  });
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Mark a single notification as read.
 * POST /api/notifications/:id/read → flat NotificationResponse
 */
export function useMarkNotificationRead() {
  const qc = useQueryClient();

  return useMutation<Notification, Error, string>({
    mutationFn: (id) =>
      api.post<Notification>(API_ENDPOINTS.NOTIFICATION_MARK_READ(id)),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: notificationKeys.lists() });
      await qc.cancelQueries({ queryKey: notificationKeys.unreadCount() });

      const previousLists = qc.getQueriesData<NotificationListResponse>({
        queryKey: notificationKeys.lists(),
      });

      qc.setQueriesData<NotificationListResponse>(
        { queryKey: notificationKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((n) =>
              n.id === id ? { ...n, read: true } : n,
            ),
          };
        },
      );

      qc.setQueryData<number>(notificationKeys.unreadCount(), (prev) =>
        Math.max(0, (prev ?? 0) - 1),
      );

      return { previousLists };
    },
    onError: (_err, _vars, context) => {
      const ctx = context as
        | {
            previousLists: [
              unknown,
              NotificationListResponse | undefined,
            ][];
          }
        | undefined;
      ctx?.previousLists.forEach(([key, value]) => {
        qc.setQueryData(
          key as Parameters<typeof qc.setQueryData>[0],
          value,
        );
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.lists() });
      qc.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });
}

/**
 * Mark ALL notifications as read.
 * POST /api/notifications/mark-all-read → { updated: i64 }
 */
export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();

  return useMutation<{ updated: number }, Error, void>({
    mutationFn: () =>
      api.post<{ updated: number }>(API_ENDPOINTS.NOTIFICATIONS_MARK_ALL_READ),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: notificationKeys.lists() });
      await qc.cancelQueries({ queryKey: notificationKeys.unreadCount() });

      const previousLists = qc.getQueriesData<NotificationListResponse>({
        queryKey: notificationKeys.lists(),
      });

      qc.setQueriesData<NotificationListResponse>(
        { queryKey: notificationKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            unread_count: 0,
            items: old.items.map((n) => ({ ...n, read: true })),
          };
        },
      );

      qc.setQueryData<number>(notificationKeys.unreadCount(), 0);

      return { previousLists };
    },
    onError: (_err, _vars, context) => {
      const ctx = context as
        | {
            previousLists: [
              unknown,
              NotificationListResponse | undefined,
            ][];
          }
        | undefined;
      ctx?.previousLists.forEach(([key, value]) => {
        qc.setQueryData(
          key as Parameters<typeof qc.setQueryData>[0],
          value,
        );
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.lists() });
      qc.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });
}

/**
 * Snooze a notification until `until`, or clear the snooze when `until` is null.
 * POST /api/notifications/:id/snooze { until } | POST /api/notifications/:id/unsnooze
 */
export function useSnoozeNotification() {
  const qc = useQueryClient();

  return useMutation<Notification, Error, { id: string; until: Date | null }>({
    mutationFn: ({ id, until }) =>
      until
        ? api.post<Notification>(`/api/notifications/${id}/snooze`, {
            until: until.toISOString(),
          })
        : api.post<Notification>(`/api/notifications/${id}/unsnooze`),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.lists() });
      qc.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });
}

/**
 * Delete a single notification.
 * DELETE /api/notifications/:id → 204 No Content
 */
export function useDeleteNotification() {
  const qc = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => api.delete<void>(API_ENDPOINTS.NOTIFICATION_BY_ID(id)),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: notificationKeys.lists() });

      const previousLists = qc.getQueriesData<NotificationListResponse>({
        queryKey: notificationKeys.lists(),
      });

      qc.setQueriesData<NotificationListResponse>(
        { queryKey: notificationKeys.lists() },
        (old) => {
          if (!old) return old;
          const removed = old.items.find((n) => n.id === id);
          return {
            ...old,
            total: old.total - 1,
            unread_count:
              removed && !removed.read
                ? Math.max(0, old.unread_count - 1)
                : old.unread_count,
            items: old.items.filter((n) => n.id !== id),
          };
        },
      );

      return { previousLists };
    },
    onError: (_err, _vars, context) => {
      const ctx = context as
        | {
            previousLists: [
              unknown,
              NotificationListResponse | undefined,
            ][];
          }
        | undefined;
      ctx?.previousLists.forEach(([key, value]) => {
        qc.setQueryData(
          key as Parameters<typeof qc.setQueryData>[0],
          value,
        );
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.lists() });
      qc.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });
}
