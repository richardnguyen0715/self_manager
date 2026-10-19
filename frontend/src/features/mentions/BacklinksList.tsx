"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useMentionBacklinks } from "./hooks";
import { MENTION_TYPE_META, MENTION_TYPE_SET } from "./types";
import type { MentionType } from "./types";

interface BacklinksListProps {
  targetType: MentionType;
  targetId: string;
  className?: string;
}

/** "Mentioned in" list for an object. Renders nothing when there are no backlinks. */
export function BacklinksList({ targetType, targetId, className }: BacklinksListProps) {
  const { data } = useMentionBacklinks(targetType, targetId);
  const [open, setOpen] = useState(true);

  if (!data || data.length === 0) return null;

  return (
    <section className={cn("space-y-2", className)} aria-label="Mentioned in">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Mentioned in ({data.length})
      </button>
      {open && (
        <ul className="divide-y rounded-md border">
          {data.map((row) => {
            const type = MENTION_TYPE_SET.has(row.source_type)
              ? (row.source_type as MentionType)
              : "doc";
            const meta = MENTION_TYPE_META[type];
            const Icon = meta.icon;
            return (
              <li key={`${row.source_type}:${row.source_id}`}>
                <Link
                  href={row.href}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60"
                >
                  <Icon className={cn("h-4 w-4 shrink-0", meta.className)} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{row.title || "Untitled"}</span>
                    {row.subtitle && (
                      <span className="block truncate text-xs text-muted-foreground">{row.subtitle}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
