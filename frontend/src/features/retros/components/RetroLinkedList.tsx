"use client";

import Link from "next/link";
import { Loader2, NotebookPen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRetrosByTarget } from "../hooks/useRetros";
import { formatPeriod } from "../format";
import type { RetroLinkTargetType } from "../types";

export interface RetroLinkedListProps {
  targetType: RetroLinkTargetType;
  targetId: string;
  /** Heading shown above the list. */
  title?: string;
  /** Text shown when there are no retros. */
  emptyText?: string;
  className?: string;
}

/**
 * Compact list of retros that link to (or are scoped to) an object. Intended
 * for embedding in sprint, work item and project pages.
 */
export function RetroLinkedList({
  targetType,
  targetId,
  title = "Retros",
  emptyText = "No retros reference this yet.",
  className,
}: RetroLinkedListProps) {
  const { data, isLoading, isError } = useRetrosByTarget(targetType, targetId);
  const items = data ?? [];

  return (
    <section className={cn("space-y-2", className)}>
      <h3 className="text-sm font-semibold">{title}</h3>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : null}
      {isError ? <p className="text-xs text-destructive">Could not load retros.</p> : null}
      {!isLoading && !isError && items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : null}

      <ul className="space-y-1">
        {items.map((r) => (
          <li key={r.id}>
            <Link
              href={`/retros/${r.id}`}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              <NotebookPen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{r.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatPeriod(r)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
