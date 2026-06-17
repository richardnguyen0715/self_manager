"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";

// Routes that do not require authentication.
const PUBLIC_PREFIXES = ["/auth", "/login", "/register"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "?") || pathname.startsWith(p + "/"),
  );
}

/**
 * Client-side auth guard. Redirects unauthenticated users to /auth for any
 * protected route, and bounces authenticated users away from the auth pages.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    const pub = isPublic(pathname);
    if (!isAuthenticated && !pub) {
      router.replace("/auth?tab=login");
    } else if (isAuthenticated && pub) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, pathname, router]);

  return <>{children}</>;
}
