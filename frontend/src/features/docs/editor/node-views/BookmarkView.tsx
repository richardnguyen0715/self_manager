"use client";

import { useEffect, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { ExternalLink, Link, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookmarkAttrs } from "../extensions/Bookmark";

/**
 * BookmarkView — renders a rich link-preview card for the Bookmark node.
 *
 * If `title` is null (freshly inserted), we attempt to resolve OG metadata
 * via a lightweight Next.js API route proxy to avoid CORS issues.  If that
 * fails, we fall back to showing just the bare URL.
 */
export function BookmarkView({ node, updateAttributes, selected }: NodeViewProps) {
  const attrs = node.attrs as BookmarkAttrs;
  const [loading, setLoading] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);

  // Attempt to resolve metadata once when title is still null
  useEffect(() => {
    if (!attrs.href || attrs.title !== null || fetchFailed) return;

    let cancelled = false;
    setLoading(true);

    // Try to fetch OG metadata via a simple API proxy; graceful fallback
    const resolveTitle = async () => {
      try {
        const res = await fetch(
          `/api/og-preview?url=${encodeURIComponent(attrs.href)}`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (!cancelled && res.ok) {
          const data = (await res.json()) as {
            title?: string;
            description?: string;
            image?: string;
          };
          updateAttributes({
            title: data.title ?? attrs.href,
            description: data.description ?? null,
            image: data.image ?? null,
          });
        } else {
          if (!cancelled) {
            updateAttributes({ title: attrs.href });
          }
        }
      } catch {
        if (!cancelled) {
          setFetchFailed(true);
          updateAttributes({ title: attrs.href });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void resolveTitle();
    return () => {
      cancelled = true;
    };
  }, [attrs.href, attrs.title, fetchFailed, updateAttributes]);

  const hostname = (() => {
    try {
      return new URL(attrs.href).hostname;
    } catch {
      return attrs.href;
    }
  })();

  return (
    <NodeViewWrapper>
      <a
        href={attrs.href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "my-2 flex overflow-hidden rounded-lg border bg-card transition-colors no-underline",
          "hover:bg-accent/30",
          selected && "ring-2 ring-primary",
        )}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Text side */}
        <div className="flex flex-1 flex-col gap-1 p-4 min-w-0">
          {loading ? (
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          ) : (
            <span className="font-medium text-foreground truncate text-sm leading-snug">
              {attrs.title ?? attrs.href}
            </span>
          )}
          {attrs.description && (
            <span className="text-xs text-muted-foreground line-clamp-2">
              {attrs.description}
            </span>
          )}
          <div className="flex items-center gap-1 mt-auto pt-1">
            <Link className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate">
              {hostname}
            </span>
            <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 ml-auto" />
          </div>
        </div>

        {/* Image side */}
        {attrs.image ? (
          <div className="relative h-auto w-28 shrink-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attrs.image}
              alt={attrs.title ?? ""}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex h-auto w-16 shrink-0 items-center justify-center bg-muted/40">
            <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
          </div>
        )}
      </a>
    </NodeViewWrapper>
  );
}
