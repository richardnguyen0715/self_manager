"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { useUIStore } from "@/stores";
import { CommandPalette } from "@/features/search";
import { ShortcutsDialog, useGlobalHotkeys } from "@/features/shortcuts";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
}

export function AppShell({ children, title }: AppShellProps) {
  const { openCommandPalette, mobileNavOpen, closeMobileNav } = useUIStore();
  const pathname = usePathname();

  // Plane-style chord shortcuts (G then B, N then W, ?) + shortcuts dialog
  useGlobalHotkeys();

  // Global keyboard shortcut Ctrl+K / Cmd+K for command palette
  // Also handle Escape to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openCommandPalette();
      }
      if (e.key === "Escape" && mobileNavOpen) {
        closeMobileNav();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openCommandPalette, mobileNavOpen, closeMobileNav]);

  // Close mobile drawer on route change
  useEffect(() => {
    closeMobileNav();
  }, [pathname, closeMobileNav]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Desktop sidebar (lg+): static, participates in flex layout ── */}
      <div className="hidden lg:flex">
        <Sidebar variant="desktop" />
      </div>

      {/* ── Mobile drawer (below lg): fixed off-canvas overlay ── */}
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={closeMobileNav}
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden",
          mobileNavOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      />
      {/* Drawer panel */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex transition-transform duration-300 lg:hidden",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Sidebar variant="mobile" />
      </div>

      {/* ── Main content area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-auto px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-6">
          {children}
        </main>
      </div>

      {/* Command palette — portal-rendered, driven by useUIStore */}
      <CommandPalette />
      <ShortcutsDialog />
    </div>
  );
}
