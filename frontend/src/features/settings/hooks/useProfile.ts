"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { currentUserQueryKey } from "@/features/auth/hooks/useCurrentUser";
import type { User } from "@/types";
import { API_ENDPOINTS } from "@/types";
import type { UpdateProfilePayload, AvatarUploadResponse } from "../types";

// ─── Query keys ────────────────────────────────────────────────────────────────

export const profileKeys = {
  all: ["settings", "profile"] as const,
  me: () => [...profileKeys.all, "me"] as const,
} as const;

// ─── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Fetches the current user profile from GET /api/users/me.
 * Syncs the result into the auth store so the header avatar stays in sync.
 */
export function useProfile() {
  const setUser = useAuthStore((s) => s.setUser);

  return useQuery<User, Error>({
    queryKey: profileKeys.me(),
    queryFn: async () => {
      const user = await api.get<User>(API_ENDPOINTS.USERS_PROFILE);
      setUser(user);
      return user;
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Updates name and/or timezone via PATCH /api/users/me.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation<User, Error, UpdateProfilePayload>({
    mutationFn: (payload) =>
      api.patch<User>(API_ENDPOINTS.USERS_UPDATE_PROFILE, payload),
    onSuccess: (updated: User) => {
      setUser(updated);
      queryClient.setQueryData<User>(profileKeys.me(), updated);
      queryClient.setQueryData<User>(currentUserQueryKey, updated);
    },
  });
}

/**
 * Uploads a new avatar via POST /api/users/me/avatar (multipart/form-data).
 * Returns the new avatar URL which is then merged back into the user record.
 */
export function useUploadAvatar() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation<AvatarUploadResponse, Error, File>({
    mutationFn: async (file) => {
      const form = new FormData();
      form.append("avatar", file);

      // Use raw fetch here because apiClient JSON-encodes the body
      const { getAccessToken } = await import("@/lib/api");
      const token = getAccessToken();
      const API_BASE_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

      const res = await fetch(
        `${API_BASE_URL}${API_ENDPOINTS.USERS_AVATAR}`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Avatar upload failed");
      }

      return res.json() as Promise<AvatarUploadResponse>;
    },
    onSuccess: (data) => {
      // Merge the new avatar_url into both caches
      queryClient.setQueryData<User>(profileKeys.me(), (old: User | undefined) =>
        old ? { ...old, avatar_url: data.avatar_url } : old,
      );
      queryClient.setQueryData<User>(currentUserQueryKey, (old: User | undefined) => {
        if (!old) return old;
        const updated = { ...old, avatar_url: data.avatar_url };
        setUser(updated);
        return updated;
      });
    },
  });
}

/**
 * Removes the current avatar via DELETE /api/users/me/avatar.
 */
export function useRemoveAvatar() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation<void, Error, void>({
    mutationFn: () => api.delete(API_ENDPOINTS.USERS_AVATAR),
    onSuccess: () => {
      queryClient.setQueryData<User>(profileKeys.me(), (old: User | undefined) =>
        old ? { ...old, avatar_url: null } : old,
      );
      queryClient.setQueryData<User>(currentUserQueryKey, (old: User | undefined) => {
        if (!old) return old;
        const updated = { ...old, avatar_url: null };
        setUser(updated);
        return updated;
      });
    },
  });
}
