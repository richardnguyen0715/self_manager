"use client";

import { useState } from "react";
import { History, MessageSquare, X, PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { CommentsPanel } from "./CommentsPanel";

// ─── Tab types ─────────────────────────────────────────────────────────────────

type CollabTab = "history" | "comments";

const TABS: { id: CollabTab; label: string; Icon: React.ElementType }[] = [
  { id: "history", label: "History", Icon: History },
  { id: "comments", label: "Comments", Icon: MessageSquare },
];

// ─── Rail trigger button ───────────────────────────────────────────────────────

interface CollabRailTriggerProps {
  onClick: () => void;
  className?: string;
}

/**
 * Standalone trigger button that can be placed in the editor toolbar.
 * Renders a right-rail icon; clicking it opens/toggles the CollabRail.
 */
export function CollabRailTrigger({
  onClick,
  className,
}: CollabRailTriggerProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={cn("h-8 w-8", className)}
      aria-label="Open collab panel"
    >
      <PanelRightOpen className="h-4 w-4" />
    </Button>
  );
}

// ─── Main rail ─────────────────────────────────────────────────────────────────

interface CollabRailProps {
  pageId: string;
  /**
   * Whether the rail is visible. Controlled externally so the editor can
   * toggle it via a toolbar button.
   */
  open: boolean;
  onClose: () => void;
  /**
   * Called when a version is successfully restored so the editor route
   * can trigger a page reload / refetch.
   */
  onVersionRestored?: () => void;
  /**
   * Rendering mode:
   *  - "rail"      — fixed right panel (absolute, sits inside a relative
   *                  container beside the editor). Default.
   *  - "slideover" — fixed viewport overlay (useful when editor is full-width).
   */
  mode?: "rail" | "slideover";
  /** Initial tab to show. Defaults to "comments". */
  defaultTab?: CollabTab;
}

export function CollabRail({
  pageId,
  open,
  onClose,
  onVersionRestored,
  mode = "rail",
  defaultTab = "comments",
}: CollabRailProps) {
  const [activeTab, setActiveTab] = useState<CollabTab>(defaultTab);

  // ── Slide-over overlay ─────────────────────────────────────────────────────
  if (mode === "slideover") {
    return (
      <>
        {/* Backdrop */}
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
        )}

        {/* Panel */}
        <aside
          aria-label="Collaboration panel"
          className={cn(
            "fixed right-0 top-0 z-50 h-full w-80 max-w-full bg-background shadow-2xl",
            "flex flex-col border-l transition-transform duration-300 ease-in-out",
            open ? "translate-x-0" : "translate-x-full",
          )}
        >
          <CollabRailInner
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onClose={onClose}
            pageId={pageId}
            onVersionRestored={onVersionRestored}
          />
        </aside>
      </>
    );
  }

  // ── Inline rail (default) ─────────────────────────────────────────────────
  if (!open) return null;

  return (
    <aside
      aria-label="Collaboration panel"
      className={cn(
        "flex h-full w-80 shrink-0 flex-col border-l bg-background",
      )}
    >
      <CollabRailInner
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClose={onClose}
        pageId={pageId}
        onVersionRestored={onVersionRestored}
      />
    </aside>
  );
}

// ─── Inner content (shared between modes) ──────────────────────────────────────

interface CollabRailInnerProps {
  activeTab: CollabTab;
  onTabChange: (tab: CollabTab) => void;
  onClose: () => void;
  pageId: string;
  onVersionRestored?: () => void;
}

function CollabRailInner({
  activeTab,
  onTabChange,
  onClose,
  pageId,
  onVersionRestored,
}: CollabRailInnerProps) {
  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <h2 className="text-sm font-semibold text-foreground">Collaborate</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7"
          aria-label="Close collab panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-stretch border-b">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors",
              "border-b-2",
              activeTab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
            aria-selected={activeTab === id}
            role="tab"
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Panel body ──────────────────────────────────────────────────────── */}
      <ScrollArea className="flex-1">
        <div className="p-4" role="tabpanel">
          {activeTab === "history" ? (
            <VersionHistoryPanel
              pageId={pageId}
              onRestored={onVersionRestored}
            />
          ) : (
            <CommentsPanel pageId={pageId} />
          )}
        </div>
      </ScrollArea>
    </>
  );
}
