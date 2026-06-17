"use client";

import { useEffect } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { useUIStore } from "@/stores";
import { CommandPalette } from "@/features/search";

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
}

export function AppShell({ children, title }: AppShellProps) {
  const { openCommandPalette } = useUIStore();

  // Global keyboard shortcut Ctrl+K / Cmd+K for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openCommandPalette();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openCommandPalette]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
      {/* Command palette — portal-rendered, driven by useUIStore */}
      <CommandPalette />
    </div>
  );
}
