"use client";

import React from "react";
import Link from "next/link";
import { CheckSquare } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
}

/**
 * Wraps the auth card with a centered full-screen background and a branding
 * strip on the left (hidden on mobile).
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ── Left branding panel (desktop only) ─────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between bg-zinc-900 p-10 text-white">
        <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
          <CheckSquare className="h-6 w-6 text-primary" />
          <span>ManageMyLife</span>
        </Link>

        <blockquote className="space-y-2">
          <p className="text-xl font-light leading-relaxed text-zinc-200">
            &ldquo;The secret of getting ahead is getting started.&rdquo;
          </p>
          <footer className="text-sm text-zinc-400">— Mark Twain</footer>
        </blockquote>

        <p className="text-xs text-zinc-500">
          Tasks &bull; Habits &bull; Time Blocking &bull; Goals &bull; Focus
        </p>
      </div>

      {/* ── Right form panel ────────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center px-6 py-12 bg-background">
        {/* Mobile branding */}
        <Link
          href="/"
          className="mb-8 flex items-center gap-2 font-semibold text-lg lg:hidden"
        >
          <CheckSquare className="h-6 w-6 text-primary" />
          <span>ManageMyLife</span>
        </Link>

        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
