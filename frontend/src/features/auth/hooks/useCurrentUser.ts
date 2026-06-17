"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import type { UserProfile } from "@/types";
import { API_ENDPOINTS } from "@/types";

export const currentUserQueryKey = ["auth", "me"] as const;

export function useCurrentUser() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setUser = useAuthStore((s) => s.setUser);

  return useQuery<UserProfile, Error>({
    queryKey: currentUserQueryKey,
    queryFn: async () => {
      const user = await api.get<UserProfile>(API_ENDPOINTS.AUTH_ME);
      setUser(user);
      return user;
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes — user profile changes rarely
  });
}
