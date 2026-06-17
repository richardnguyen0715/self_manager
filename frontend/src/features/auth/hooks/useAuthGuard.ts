"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { getAccessToken } from "@/lib/api";

/**
 * Redirects unauthenticated users to /auth.
 * Call inside any protected client component or layout.
 * Returns { isAuthenticated, isLoading, user }.
 */
export function useAuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, user } = useAuthStore();

  useEffect(() => {
    // Skip guard on public auth routes
    if (pathname.startsWith("/auth") || pathname.startsWith("/login") || pathname.startsWith("/register")) {
      return;
    }

    // If Zustand says not authenticated and there is no token in storage,
    // redirect to the auth page.
    if (!isAuthenticated && !getAccessToken()) {
      router.replace(`/auth?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, pathname, router]);

  return { isAuthenticated, isLoading, user };
}
