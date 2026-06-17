"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, getRefreshToken } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { API_ENDPOINTS } from "@/types";

export function useLogout() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: () => {
      const refresh_token = getRefreshToken();
      return api.post<void>(API_ENDPOINTS.AUTH_LOGOUT, refresh_token ? { refresh_token } : undefined);
    },

    onSettled: () => {
      // Clear auth state and all cached queries regardless of server response
      logout();
      queryClient.clear();
      router.replace("/auth");
    },
  });
}
