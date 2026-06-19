"use client";

import dynamic from "next/dynamic";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Database, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Lazy-import DatabaseEmbed from the database feature to avoid circular
// bundling and to keep the editor bundle lean.
const DatabaseEmbedLazy = dynamic(
  () =>
    import("@/features/docs/database").then((m) => ({
      default: m.DatabaseEmbed,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading database…</span>
      </div>
    ),
  },
);

/**
 * DatabaseEmbedView — TipTap node view wrapper.
 *
 * Renders the live DatabaseView (lazy-loaded from features/docs/database).
 * If no databaseId is set or the dynamic import hasn't shipped yet, shows a
 * placeholder. Graceful degradation: if the database was deleted, the
 * DatabaseEmbed component itself should handle the 404 state.
 */
export function DatabaseEmbedView({ node, selected }: NodeViewProps) {
  const databaseId = (node.attrs.databaseId as string) ?? "";

  if (!databaseId) {
    return (
      <NodeViewWrapper>
        <div className="my-2 flex h-20 items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground">
          <Database className="h-4 w-4" />
          <span>No database linked</span>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <div
        className={cn(
          "my-3 overflow-hidden rounded-lg border",
          selected && "ring-2 ring-primary",
        )}
        // Prevent editor from stealing pointer events inside the embed
        onMouseDown={(e) => e.stopPropagation()}
      >
        <DatabaseEmbedLazy databaseId={databaseId} />
      </div>
    </NodeViewWrapper>
  );
}
