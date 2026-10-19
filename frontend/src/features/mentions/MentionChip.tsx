"use client";

import type { MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useMentionResolve } from "./hooks";
import { MENTION_TYPE_META } from "./types";
import type { MentionType } from "./types";

/** Read-only, clickable mention chip with a live title (outside any editor). */
export function MentionChip({
  type,
  id,
  label,
}: {
  type: MentionType;
  id: string;
  label: string;
}) {
  const router = useRouter();
  const { data } = useMentionResolve({ type, id });
  const meta = MENTION_TYPE_META[type];
  const Icon = meta.icon;
  const deleted = data !== undefined && data !== null && !data.exists;
  const href = data?.href;
  const title = deleted ? "deleted" : data?.title || label || "Untitled";

  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (!href || deleted) return;
    e.preventDefault();
    if (e.metaKey || e.ctrlKey) window.open(href, "_blank", "noopener,noreferrer");
    else router.push(href);
  };

  return (
    <span
      role={href && !deleted ? "link" : undefined}
      title={deleted ? `${meta.label} deleted` : `${meta.label}: ${title}`}
      onClick={onClick}
      className={cn(
        "mx-0.5 inline-flex max-w-full items-center gap-1 rounded bg-muted/60 px-1.5 py-px align-baseline text-sm font-medium text-foreground",
        href && !deleted && "cursor-pointer hover:bg-muted",
        deleted && "text-muted-foreground line-through",
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", meta.className)} aria-hidden />
      <span className="truncate">{title}</span>
    </span>
  );
}
