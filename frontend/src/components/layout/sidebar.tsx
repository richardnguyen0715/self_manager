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
  FolderOpen,
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

interface SidebarProps {
  /**
   * "desktop" — static sidebar inside the flex layout (lg+), supports
   *             the collapsed/expanded toggle via useUIStore.sidebarOpen.
   * "mobile"  — always-expanded drawer panel; shown via CSS translate in
   *             AppShell; nav clicks close the drawer via closeMobileNav.
   */
  variant?: "desktop" | "mobile";
}

export function Sidebar({ variant = "desktop" }: SidebarProps) {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar, closeMobileNav } = useUIStore();

  // Mobile drawer is always expanded; desktop respects sidebarOpen toggle.
  const collapsed = variant === "desktop" && !sidebarOpen;

  // On mobile, clicking a nav item closes the drawer.
  const handleNavClick = variant === "mobile" ? closeMobileNav : undefined;

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-r bg-sidebar transition-all duration-300",
        // Desktop: width collapses; mobile: always full w-60
        variant === "desktop"
          ? sidebarOpen
            ? "w-60"
            : "w-16"
          : "w-60",
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-semibold"
          onClick={handleNavClick}
        >
          <Zap className="h-5 w-5 shrink-0 text-primary" />
          {!collapsed && (
            <span className="text-sm font-semibold text-sidebar-foreground">
              ManageMyLife
            </span>
          )}
        </Link>
      </div>

      {/* Project switcher */}
      <div className={cn("px-2 py-2", collapsed && "px-1")}>
        <ProjectSwitcher collapsed={collapsed} />
      </div>

      <Separator />

      {/* Projects management link */}
      <div className="px-2 py-2">
        <NavLink
          item={{ label: "Projects", href: "/projects", icon: FolderOpen }}
          isActive={pathname.startsWith("/projects")}
          collapsed={collapsed}
          onNavClick={handleNavClick}
        />
      </div>

      <Separator />

      {/* Nav */}
      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={pathname.startsWith(item.href)}
              collapsed={collapsed}
              onNavClick={handleNavClick}
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
              collapsed={collapsed}
              onNavClick={handleNavClick}
            />
          ))}
        </nav>
      </div>

      {/* Toggle button — desktop only */}
      {variant === "desktop" && (
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
      )}
    </aside>
  );
}

interface NavLinkProps {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  onNavClick?: () => void;
}

function NavLink({ item, isActive, collapsed, onNavClick }: NavLinkProps) {
  const Icon = item.icon;

  const linkContent = (
    <Link
      href={item.href}
      onClick={onNavClick}
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
