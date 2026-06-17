"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { useAuthGuard } from "../hooks/useAuthGuard";

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Client-side route guard.  Wrap any page or layout that requires an
 * authenticated user.  While the auth state is being restored from
 * localStorage, a full-screen spinner is shown so the user never sees a
 * flash of protected content.
 *
 * Redirects happen inside useAuthGuard via next/navigation.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuthGuard();

  if (isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        aria-label="Loading"
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // useAuthGuard handles the redirect; render null while navigation completes
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
