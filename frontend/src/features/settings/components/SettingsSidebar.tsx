"use client";

import {
  Bell,
  Palette,
  ShieldCheck,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettingsUIStore } from "../settings.store";
import type { SettingsSection } from "../types";

interface NavItem {
  id: SettingsSection;
  label: string;
  icon: React.ElementType;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "profile",
    label: "Profile",
    icon: User,
    description: "Name, avatar, timezone",
  },
  {
    id: "account",
    label: "Account",
    icon: ShieldCheck,
    description: "Password, sessions, danger zone",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    description: "Channels, reminders, push",
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
    description: "Theme, colors, layout",
  },
];

export function SettingsSidebar() {
  const activeSection = useSettingsUIStore((s) => s.activeSection);
  const setActiveSection = useSettingsUIStore((s) => s.setActiveSection);

  return (
    <nav
      aria-label="Settings navigation"
      className="flex flex-col gap-1 w-56 shrink-0"
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeSection === item.id;

        return (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors text-left w-full",
              isActive
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
              )}
            />
            <div className="flex flex-col min-w-0">
              <span>{item.label}</span>
              <span className="text-xs text-muted-foreground truncate leading-tight">
                {item.description}
              </span>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
