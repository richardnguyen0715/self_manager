"use client";

import type { MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { useMentionResolve } from "./hooks";
import { MENTION_TYPE_META, MENTION_TYPE_SET } from "./types";
import type { MentionType } from "./types";

/**
 * Node view for EntityMention. Shows the live title (resolved in a batched
 * request), navigates on click (Ctrl/Cmd-click opens a new tab), and renders
 * a muted struck-through chip when the target no longer exists.
 */
export function MentionChipView({ node, selected }: NodeViewProps) {
  const router = useRouter();
  const storedType = node.attrs.mentionType as string;
  const mentionType: MentionType = MENTION_TYPE_SET.has(storedType)
    ? (storedType as MentionType)
    : "work_item";
  const mentionId = node.attrs.mentionId as string;
  const storedLabel = (node.attrs.label as string) || "Untitled";

  const { data } = useMentionResolve({ type: mentionType, id: mentionId });
  const meta = MENTION_TYPE_META[mentionType];
  const Icon = meta.icon;

  const deleted = data !== undefined && data !== null && !data.exists;
  const href = data?.href;
  const title = deleted ? "deleted" : data?.title || storedLabel;

  const handleClick = (event: MouseEvent<HTMLSpanElement>) => {
    if (!href || deleted) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.metaKey || event.ctrlKey) {
      window.open(href, "_blank", "noopener,noreferrer");
    } else {
      router.push(href);
    }
  };

  return (
    <NodeViewWrapper as="span" className="inline">
      <span
        data-entity-mention=""
        data-mention-type={mentionType}
        data-mention-id={mentionId}
        role={href && !deleted ? "link" : undefined}
        title={deleted ? `${meta.label} deleted` : `${meta.label}: ${title}`}
        onClick={handleClick}
        className={cn(
          "mx-0.5 inline-flex max-w-full items-center gap-1 rounded px-1.5 py-px align-baseline text-sm font-medium",
          "bg-muted/60 text-foreground",
          href && !deleted && "cursor-pointer hover:bg-muted",
          deleted && "text-muted-foreground line-through",
          selected && "ring-2 ring-primary/40",
        )}
      >
        <Icon className={cn("h-3.5 w-3.5 shrink-0", meta.className)} aria-hidden />
        <span className="truncate">{title}</span>
      </span>
    </NodeViewWrapper>
  );
}
