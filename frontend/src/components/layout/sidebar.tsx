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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Zap,
  ListTodo,
  Rocket,
  SquareKanban,
  Network,
  FolderOpen,
  CalendarHeart,
  BookOpen,
  FileText,
  Building2,
  Trash2,
  NotebookPen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUIStore } from "@/stores";
import { useNavStore } from "@/stores/nav.store";
import { ProjectSwitcher } from "@/components/ui/project-switcher";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Can be hidden via Settings > Appearance > Sidebar. */
  hideable?: boolean;
}

interface NavSectionDef {
  id: string;
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSectionDef[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { label: "Organizations", href: "/organizations", icon: Building2 },
      { label: "Projects", href: "/projects", icon: FolderOpen },
    ],
  },
  {
    id: "planning",
    label: "Planning",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Backlog", href: "/backlog", icon: ListTodo, hideable: true },
      { label: "Board", href: "/board", icon: SquareKanban, hideable: true },
      { label: "Sprints", href: "/sprints", icon: Rocket, hideable: true },
      { label: "Work Items", href: "/work-items", icon: Trello, hideable: true },
      { label: "Hierarchy", href: "/hierarchy", icon: Network, hideable: true },
      { label: "Goals", href: "/goals", icon: Target, hideable: true },
    ],
  },
  {
    id: "life",
    label: "Life",
    items: [
      { label: "Life Calendar", href: "/life", icon: CalendarHeart, hideable: true },
      { label: "Calendar", href: "/calendar", icon: Calendar, hideable: true },
      { label: "Time Blocking", href: "/timeblocking", icon: Clock, hideable: true },
      { label: "Habits", href: "/habits", icon: Repeat2, hideable: true },
      { label: "Focus", href: "/focus", icon: Timer, hideable: true },
    ],
  },
  {
    id: "knowledge",
    label: "Knowledge",
    items: [{ label: "Docs", href: "/docs", icon: FileText, hideable: true }],
  },
  {
    id: "insights",
    label: "Insights",
    items: [
      { label: "Usage", href: "/usage", icon: BookOpen, hideable: true },
      { label: "Analytics", href: "/analytics", icon: BarChart3, hideable: true },
      { label: "Retros", href: "/retros", icon: NotebookPen, hideable: true },
    ],
  },
];

const BOTTOM_ITEMS: NavItem[] = [
  { label: "Trash", href: "/trash", icon: Trash2 },
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
  const hiddenNavItems = useNavStore((s) => s.hiddenNavItems);
  const collapsedSections = useNavStore((s) => s.collapsedSections);
  const toggleSectionCollapsed = useNavStore((s) => s.toggleSectionCollapsed);

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

      {/* Grouped nav — collapsible sections, hidden items skipped */}
      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="flex flex-col gap-3">
          {NAV_SECTIONS.map((section) => {
            const items = section.items.filter(
              (item) => !(item.hideable && hiddenNavItems.includes(item.href)),
            );
            if (items.length === 0) return null;
            // Icon-only mode always shows every item and hides the labels.
            const sectionCollapsed = !collapsed && Boolean(collapsedSections[section.id]);

            return (
              <div key={section.id} className="flex flex-col gap-1">
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggleSectionCollapsed(section.id)}
                    aria-expanded={!sectionCollapsed}
                    className="flex items-center justify-between px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-sidebar-foreground"
                  >
                    {section.label}
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 transition-transform",
                        sectionCollapsed && "-rotate-90",
                      )}
                    />
                  </button>
                )}
                {!sectionCollapsed &&
                  items.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      isActive={pathname.startsWith(item.href)}
                      collapsed={collapsed}
                      onNavClick={handleNavClick}
                    />
                  ))}
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      <Separator />

      {/* Bottom items: Trash, Settings */}
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
