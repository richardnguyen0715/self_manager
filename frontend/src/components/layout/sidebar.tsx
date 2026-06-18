"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Trello,
  Calendar,
  Clock,
  Repeat2,
  Timer,
  Target,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  ListTodo,
  Rocket,
  SquareKanban,
  Network,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUIStore } from "@/stores";
import { ProjectSwitcher } from "@/components/ui/project-switcher";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  // ── Agile ────────────────────────────────────────────────────────────────
  { label: "Backlog", href: "/backlog", icon: ListTodo },
  { label: "Board", href: "/board", icon: SquareKanban },
  { label: "Sprints", href: "/sprints", icon: Rocket },
  { label: "Work Items", href: "/work-items", icon: Trello },
  // ── Personal ─────────────────────────────────────────────────────────────
  { label: "Calendar", href: "/calendar", icon: Calendar },
  { label: "Time Blocking", href: "/timeblocking", icon: Clock },
  { label: "Habits", href: "/habits", icon: Repeat2 },
  { label: "Focus", href: "/focus", icon: Timer },
  { label: "Hierarchy", href: "/hierarchy", icon: Network },
  { label: "Goals", href: "/goals", icon: Target },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
];

const BOTTOM_ITEMS: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useUIStore();

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-r bg-sidebar transition-all duration-300",
        sidebarOpen ? "w-60" : "w-16",
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <Zap className="h-5 w-5 shrink-0 text-primary" />
          {sidebarOpen && (
            <span className="text-sm font-semibold text-sidebar-foreground">
              ManageMyLife
            </span>
          )}
        </Link>
      </div>

      {/* Project switcher */}
      <div className={cn("px-2 py-2 border-b", !sidebarOpen && "px-1")}>
        <ProjectSwitcher collapsed={!sidebarOpen} />
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={pathname.startsWith(item.href)}
              collapsed={!sidebarOpen}
            />
          ))}
        </nav>
      </ScrollArea>

      <Separator />

      {/* Bottom items */}
      <div className="px-2 py-3">
        <nav className="flex flex-col gap-1">
          {BOTTOM_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={pathname.startsWith(item.href)}
              collapsed={!sidebarOpen}
            />
          ))}
        </nav>
      </div>

      {/* Toggle button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="absolute -right-3 top-[4.5rem] z-10 h-6 w-6 rounded-full border bg-background shadow-sm hover:bg-accent"
        aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        {sidebarOpen ? (
          <ChevronLeft className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </Button>
    </aside>
  );
}

interface NavLinkProps {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}

function NavLink({ item, isActive, collapsed }: NavLinkProps) {
  const Icon = item.icon;

  const linkContent = (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        isActive &&
          "bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
        collapsed && "justify-center px-2",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}
