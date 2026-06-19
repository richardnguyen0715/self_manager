"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * EmbedView — renders a sandboxed <iframe> for arbitrary URL embeds.
 * Height defaults to 400px; the user can drag-resize via a CSS resize handle.
 */
export function EmbedView({ node, selected }: NodeViewProps) {
  const src = (node.attrs.src as string) ?? "";

  if (!src) {
    return (
      <NodeViewWrapper>
        <div className="my-2 flex h-16 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          Empty embed
        </div>
      </NodeViewWrapper>
    );
  }

  const displayUrl = (() => {
    try {
      const u = new URL(src);
      return u.hostname + (u.pathname !== "/" ? u.pathname : "");
    } catch {
      return src;
    }
  })();

  return (
    <NodeViewWrapper>
      <div
        className={cn(
          "my-2 overflow-hidden rounded-lg border bg-card",
          selected && "ring-2 ring-primary",
        )}
      >
        {/* URL bar */}
        <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
          <span className="truncate flex-1">{displayUrl}</span>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        {/* iframe */}
        <div className="relative" style={{ height: 400 }}>
          <iframe
            src={src}
            className="absolute inset-0 h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
            loading="lazy"
            title={displayUrl}
          />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
