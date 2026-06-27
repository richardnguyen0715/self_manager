"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { getAccessToken } from "@/lib/api";

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

  // Wait for the persisted auth store to rehydrate from localStorage before
  // making any redirect decision. Without this, a hard reload momentarily sees
  // isAuthenticated=false and bounces the user /board -> /auth -> /dashboard,
  // losing the page they were on.
  // NOTE: `.persist` is undefined during the server prerender pass, so guard
  // every access with optional chaining — touching it unguarded crashes
  // `next build` while statically exporting pages like /_not-found and /search.
  const [hydrated, setHydrated] = useState(
    () => useAuthStore.persist?.hasHydrated?.() ?? false,
  );

  useEffect(() => {
    const persist = useAuthStore.persist;
    if (!persist) {
      setHydrated(true);
      return;
    }
    if (persist.hasHydrated()) setHydrated(true);
    const unsub = persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated) return; // don't decide until we know the real auth state
    const pub = isPublic(pathname);
    const pubReadonly = isPublicReadonly(pathname);
    // Treat a token in storage as "logged in" for the redirect decision. This
    // closes a reload race where the persisted `isAuthenticated` flag lags one
    // tick behind: without it, a reload on /calendar would bounce to /auth and
    // then get re-bounced to /dashboard, losing the page the user was on.
    const loggedIn = isAuthenticated || Boolean(getAccessToken());
    if (!loggedIn && !pub) {
      router.replace("/auth?tab=login");
    } else if (loggedIn && pub && !pubReadonly) {
      // Only bounce authenticated users away from auth pages, not from public pages.
      router.replace("/dashboard");
    }
  }, [isAuthenticated, pathname, router, hydrated]);

  return <>{children}</>;
}
