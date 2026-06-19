"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";

// Routes that do not require authentication.
const PUBLIC_PREFIXES = ["/auth", "/login", "/register", "/p"];

// Routes that are public AND should NOT redirect authenticated users away.
// /p/[slug] is a public site renderer — authenticated users should still see it.
const PUBLIC_READONLY_PREFIXES = ["/p"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "?") || pathname.startsWith(p + "/"),
  );
}

function isPublicReadonly(pathname: string): boolean {
  return PUBLIC_READONLY_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "?") || pathname.startsWith(p + "/"),
  );
}

/**
 * Client-side auth guard. Redirects unauthenticated users to /auth for any
 * protected route, and bounces authenticated users away from the auth pages
 * (but NOT away from public-readonly routes like /p/[slug]).
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    const pub = isPublic(pathname);
    const pubReadonly = isPublicReadonly(pathname);
    if (!isAuthenticated && !pub) {
      router.replace("/auth?tab=login");
    } else if (isAuthenticated && pub && !pubReadonly) {
      // Only bounce authenticated users away from auth pages, not from public pages.
      router.replace("/dashboard");
    }
  }, [isAuthenticated, pathname, router]);

  return <>{children}</>;
}
