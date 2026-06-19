"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { DatabaseView } from "./DatabaseView";

export interface DatabaseEmbedProps {
  databaseId: string;
  className?: string;
}

/**
 * Embedded database block rendered inside a TipTap doc.
 * Exported from this module so the editor agent's DatabaseEmbed
 * node-view can lazy-import it:
 *   const { DatabaseEmbed } = await import("@/features/docs/database");
 *
 * Renders the full DatabaseView in embedded mode (no outer padding,
 * compact header) inside a bordered block.
 */
export function DatabaseEmbed({ databaseId, className }: DatabaseEmbedProps) {
  if (!databaseId) {
    return (
      <div
        className={cn(
          "border border-dashed border-border rounded-lg px-4 py-6 text-center text-muted-foreground text-sm",
          className,
        )}
      >
        No database linked.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border border-border rounded-xl overflow-hidden bg-background",
        "min-h-[280px] flex flex-col",
        className,
      )}
      // Prevent editor from treating clicks as doc interactions
      contentEditable={false}
    >
      <DatabaseView databaseId={databaseId} embedded />
    </div>
  );
}
