"use client";

/**
 * PagePeekPanel — Notion-style "peek" side panel.
 *
 * Slides in from the right when peekPageId is non-null.  Renders the
 * referenced page read-only (title + icon + content via DocEditor).
 * Clicking a page-mention chip inside the peek swaps the viewed page
 * (nested peek navigation).  An "open as full page" button navigates to
 * /docs/{spaceId}/{pageId} and closes the panel.
 *
 * Mount once inside DocsPageEditorPage so it overlays the editor.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  ArrowUpRight,
  Loader2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePage } from "@/features/docs";
import { DocView } from "@/features/docs/editor/DocEditor";
import { usePeekStore } from "@/features/docs/store/usePeekStore";
import { cn } from "@/lib/utils";
import type { TipTapDoc } from "@/types";

// ── Inner panel content ───────────────────────────────────────────────────────

interface PeekContentProps {
  pageId: string;
  /** Called when a mention is clicked inside the peek (swap page). */
  onMentionClick: (targetPageId: string) => void;
}

function PeekContent({ pageId, onMentionClick }: PeekContentProps) {
  const { data: page, isLoading, isError } = usePage(pageId);
  const contentRef = useRef<HTMLDivElement>(null);

  // Delegate click events on .page-mention anchors inside the read-only view.
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest<HTMLAnchorElement>("a.page-mention");
      if (!anchor) return;
      e.preventDefault();
      e.stopPropagation();
      const targetId = anchor.dataset.pageId;
      if (targetId) {
        onMentionClick(targetId);
      }
    };

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, [onMentionClick]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !page) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center px-6">
        <AlertCircle className="h-7 w-7 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Page not found or you don&apos;t have access.
        </p>
      </div>
    );
  }

  return (
    <div ref={contentRef} className="flex flex-1 flex-col overflow-hidden">
      {/* Page title + icon */}
      <div className="shrink-0 px-6 pt-5 pb-3">
        {page.icon && (
          <div className="mb-2 text-3xl leading-none">{page.icon}</div>
        )}
        <h1 className="text-2xl font-bold text-foreground leading-tight">
          {page.title || "Untitled"}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {page.published_at
            ? `Published ${new Date(page.published_at).toLocaleDateString()}`
            : `Last updated ${new Date(page.updated_at).toLocaleDateString()}`}
        </p>
      </div>

      {/* Read-only editor content */}
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {page.content ? (
          <DocView
            content={page.content as TipTapDoc}
            className="text-sm"
          />
        ) : (
          <p className="text-sm text-muted-foreground italic">
            This page has no content yet.
          </p>
        )}
      </div>
    </div>
  );
}

// ── PeekHeader ────────────────────────────────────────────────────────────────

interface PeekHeaderProps {
  pageId: string;
  canGoBack: boolean;
  onBack: () => void;
  onClose: () => void;
  onExpand: () => void;
}

function PeekHeader({
  pageId,
  canGoBack,
  onBack,
  onClose,
  onExpand,
}: PeekHeaderProps) {
  const { data: page } = usePage(pageId);

  return (
    <div className="flex h-11 shrink-0 items-center gap-1.5 border-b px-3">
      {canGoBack && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onBack}
          title="Go back"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
      )}

      <span className="flex-1 truncate text-sm font-medium text-foreground/80 min-w-0">
        {page?.title || "Page preview"}
      </span>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={onExpand}
        title="Open as full page"
      >
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={onClose}
        title="Close peek"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ── PagePeekPanel ─────────────────────────────────────────────────────────────

export function PagePeekPanel() {
  const { peekPageId, closePeek, openPeek } = usePeekStore();
  const router = useRouter();

  // Navigation stack for nested peek (back button).
  const [history, setHistory] = useState<string[]>([]);

  // Reset history when panel first opens with a fresh pageId.
  const prevPeekPageId = useRef<string | null>(null);
  useEffect(() => {
    if (peekPageId && prevPeekPageId.current === null) {
      // Panel just opened — clear history.
      setHistory([]);
    }
    prevPeekPageId.current = peekPageId;
  }, [peekPageId]);

  // Fetch the current page to find its space_id for the expand link.
  const { data: peekPage } = usePage(peekPageId ?? "");

  // Handle mention click inside the peek: push current onto history, swap.
  const handleMentionClick = useCallback(
    (targetPageId: string) => {
      if (!peekPageId) return;
      setHistory((prev) => [...prev, peekPageId]);
      openPeek(targetPageId);
    },
    [peekPageId, openPeek],
  );

  // Back: pop history stack.
  const handleBack = useCallback(() => {
    setHistory((prev) => {
      const next = [...prev];
      const previous = next.pop();
      if (previous) openPeek(previous);
      return next;
    });
  }, [openPeek]);

  // Expand: navigate full page, close panel.
  const handleExpand = useCallback(() => {
    if (!peekPage) return;
    router.push(`/docs/${peekPage.space_id}/${peekPage.id}`);
    closePeek();
    setHistory([]);
  }, [peekPage, router, closePeek]);

  // Close on Escape.
  useEffect(() => {
    if (!peekPageId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closePeek();
        setHistory([]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [peekPageId, closePeek]);

  const isOpen = peekPageId !== null;

  return (
    <>
      {/* Backdrop — clicking outside closes the panel */}
      <div
        className={cn(
          "fixed inset-0 z-40 transition-opacity duration-200",
          isOpen
            ? "pointer-events-auto bg-black/20 dark:bg-black/40 opacity-100"
            : "pointer-events-none opacity-0",
        )}
        aria-hidden="true"
        onClick={() => {
          closePeek();
          setHistory([]);
        }}
      />

      {/* Slide-over panel */}
      <aside
        role="complementary"
        aria-label="Page preview"
        className={cn(
          // Layout
          "fixed right-0 top-0 bottom-0 z-50",
          "flex flex-col",
          "w-[520px] max-w-[calc(100vw-3rem)]",
          // Visual
          "border-l bg-background shadow-2xl",
          // Slide animation
          "transition-transform duration-200 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {peekPageId && (
          <>
            <PeekHeader
              pageId={peekPageId}
              canGoBack={history.length > 0}
              onBack={handleBack}
              onClose={() => {
                closePeek();
                setHistory([]);
              }}
              onExpand={handleExpand}
            />

            <PeekContent
              key={peekPageId}
              pageId={peekPageId}
              onMentionClick={handleMentionClick}
            />
          </>
        )}
      </aside>
    </>
  );
}
