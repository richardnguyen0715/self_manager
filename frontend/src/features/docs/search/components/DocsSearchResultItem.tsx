"use client";

import { useRouter } from "next/navigation";
import { FileText, Database, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PageSearchHit, DatabaseSearchHit } from "@/types";

// ─── Shared types ──────────────────────────────────────────────────────────────

export type DocsHitKind = "page" | "database";

export interface DocsPageHit extends PageSearchHit {
  kind: "page";
}

export interface DocsDatabaseHit extends DatabaseSearchHit {
  kind: "database";
}

export type DocsHit = DocsPageHit | DocsDatabaseHit;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getHref(hit: DocsHit): string {
  return hit.kind === "page"
    ? `/docs/page/${hit.id}`
    : `/docs/db/${hit.id}`;
}

function getSubText(hit: DocsHit): string | null {
  if (hit.kind === "page") {
    return hit.snippet?.trim() || null;
  }
  // database
  return hit.matched_rows > 0
    ? `${hit.matched_rows} matching row${hit.matched_rows !== 1 ? "s" : ""}`
    : null;
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface DocsSearchResultItemProps {
  hit: DocsHit;
  /** Called after the router pushes so the parent (palette/page) can close. */
  onNavigate?: () => void;
  className?: string;
}

export function DocsSearchResultItem({
  hit,
  onNavigate,
  className,
}: DocsSearchResultItemProps) {
  const router = useRouter();
  const href = getHref(hit);
  const subText = getSubText(hit);
  const hasEmoji = Boolean(hit.icon);

  function handleClick() {
    router.push(href);
    onNavigate?.();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  }

  return (
    <div
      role="option"
      tabIndex={0}
      aria-selected={false}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5",
        "transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
        className,
      )}
    >
      {/* Icon */}
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-sm",
          hit.kind === "page"
            ? "text-violet-600 dark:text-violet-400"
            : "text-cyan-600 dark:text-cyan-400",
        )}
        aria-hidden
      >
        {hasEmoji ? (
          <span className="leading-none">{hit.icon}</span>
        ) : hit.kind === "page" ? (
          <FileText className="h-3.5 w-3.5" />
        ) : (
          <Database className="h-3.5 w-3.5" />
        )}
      </span>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-foreground leading-tight">
            {hit.title}
          </span>
        </div>
        {subText && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {subText}
          </p>
        )}
      </div>

      {/* Kind label */}
      <span
        className={cn(
          "hidden shrink-0 text-[10px] font-medium sm:flex items-center gap-1",
          hit.kind === "page"
            ? "text-violet-600 dark:text-violet-400"
            : "text-cyan-600 dark:text-cyan-400",
        )}
      >
        {hit.kind === "page" ? (
          <>
            <Hash className="h-2.5 w-2.5" />
            Page
          </>
        ) : (
          <>
            <Database className="h-2.5 w-2.5" />
            Database
          </>
        )}
      </span>
    </div>
  );
}
