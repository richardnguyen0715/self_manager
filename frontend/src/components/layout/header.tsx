"use client";

import { Search, Bell, Command, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores";

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const { openCommandPalette, setMobileNavOpen } = useUIStore();

  return (
    <header className="flex h-14 items-center gap-2 border-b bg-background px-4 md:px-6">
      {/* Hamburger — visible only below lg where the sidebar is off-canvas */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open navigation menu"
        className="shrink-0 lg:hidden"
        onClick={() => setMobileNavOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Page title */}
      {title && (
        <h1 className="truncate text-lg font-semibold text-foreground">
          {title}
        </h1>
      )}

      {/* Right-side actions */}
      <div className="ml-auto flex items-center gap-2">
        {/* Search — full pill on sm+, icon-only on xs */}
        {/* Icon-only button visible below sm */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Search"
          className="sm:hidden"
          onClick={openCommandPalette}
        >
          <Search className="h-4 w-4" />
        </Button>

        {/* Full command palette trigger visible on sm+ */}
        <Button
          variant="outline"
          size="sm"
          className="hidden gap-2 text-muted-foreground sm:flex"
          onClick={openCommandPalette}
        >
          <Search className="h-3.5 w-3.5" />
          <span className="text-xs">Search...</span>
          <kbd className="pointer-events-none ml-2 hidden select-none items-center gap-1 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">
            <Command className="h-3 w-3" />K
          </kbd>
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
