"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { API_ENDPOINTS } from "@/types";
import type { ChangePasswordPayload } from "../types";

// ─── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Changes the user's password via POST /api/settings/account/password.
 * Requires the current password for verification.
 * Returns 204 No Content on success.
 */
export function useChangePassword() {
  return useMutation<void, Error, ChangePasswordPayload>({
    mutationFn: (payload) =>
      api.post(API_ENDPOINTS.SETTINGS_ACCOUNT_PASSWORD, payload),
  });
}

/**
 * Permanently deletes the authenticated user's account.
 * POST /api/settings/account/delete  (body: { password: string })
 * On success, clears auth state and redirects to /login.
 */
export function useDeleteAccount() {
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  return useMutation<void, Error, { password: string }>({
    mutationFn: (payload) =>
      api.post(API_ENDPOINTS.SETTINGS_ACCOUNT_DELETE, payload),
    onSuccess: () => {
      logout();
      router.replace("/login");
    },
  });
}

/**
 * Logs out from all active sessions (revokes all refresh tokens server-side).
 * POST /api/auth/logout-all
 * On success, clears local auth state and redirects to /login.
 */
export function useLogoutAllSessions() {
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  return useMutation<void, Error, void>({
    mutationFn: () => api.post(API_ENDPOINTS.AUTH_LOGOUT_ALL),
    onSuccess: () => {
      logout();
      router.replace("/login");
    },
  });
}
