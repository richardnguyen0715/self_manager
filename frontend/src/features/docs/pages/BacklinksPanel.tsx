"use client";

/**
 * BacklinksPanel — lists all pages that contain an @page mention pointing at
 * the current page. Uses `usePageBacklinks(pageId)` from the docs hooks.
 *
 * Designed for use in a sidebar panel inside the page editor.
 */

import * as React from "react";
import Link from "next/link";
import { LinkIcon, Loader2, AlertCircle, FileText } from "lucide-react";
import { usePageBacklinks } from "@/features/docs";
import type { PageBacklink } from "@/types";
import { cn } from "@/lib/utils";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface BacklinksPanelProps {
  pageId: string;
  /** When provided, clicking a backlink navigates to /docs/{spaceId}/{sourceId}. */
  spaceId?: string;
  className?: string;
}

// ── Backlink row ──────────────────────────────────────────────────────────────

interface BacklinkRowProps {
  backlink: PageBacklink;
  spaceId?: string;
}

function BacklinkRow({ backlink, spaceId }: BacklinkRowProps) {
  const resolvedSpace = spaceId ?? backlink.space_id;
  const href = `/docs/${resolvedSpace}/${backlink.source_page_id}`;

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
        "transition-colors hover:bg-accent text-foreground/80 hover:text-foreground",
        "group",
      )}
    >
      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
      <span className="flex-1 truncate">{backlink.title || "Untitled"}</span>
    </Link>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BacklinksPanel({ pageId, spaceId, className }: BacklinksPanelProps) {
  const { data: backlinks, isLoading, isError } = usePageBacklinks(pageId);

  const safeBacklinks: PageBacklink[] = backlinks ?? [];

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        <h3 className="text-sm font-medium">Backlinks</h3>
        {!isLoading && !isError && (
          <span className="ml-auto text-xs text-muted-foreground">
            {safeBacklinks.length}
          </span>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground px-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading backlinks…
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex items-center gap-2 py-2 text-xs text-destructive px-2">
          <AlertCircle className="h-3 w-3 shrink-0" />
          Failed to load backlinks.
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && safeBacklinks.length === 0 && (
        <p className="py-3 text-xs text-muted-foreground px-2">
          No pages link to this page yet. Add an{" "}
          <span className="font-mono text-muted-foreground">@mention</span> in
          another page to create a backlink.
        </p>
      )}

      {/* Backlink list */}
      {!isLoading && !isError && safeBacklinks.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {safeBacklinks.map((bl) => (
            <BacklinkRow key={bl.source_page_id} backlink={bl} spaceId={spaceId} />
          ))}
        </div>
      )}
    </div>
  );
}
