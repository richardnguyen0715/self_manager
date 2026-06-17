"use client";

import { Search, Bell, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores";

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const { openCommandPalette } = useUIStore();

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      {title && (
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* Command palette trigger */}
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
