"use client";

import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { resolveMentions } from "./api";
import { MENTION_TYPE_SET } from "./types";
import type { MentionRef, MentionType } from "./types";

const CHIP_CLASS = cn(
  "[&_[data-entity-mention]]:mx-0.5 [&_[data-entity-mention]]:inline-flex [&_[data-entity-mention]]:items-center",
  "[&_[data-entity-mention]]:rounded [&_[data-entity-mention]]:bg-muted/60 [&_[data-entity-mention]]:px-1.5",
  "[&_[data-entity-mention]]:py-px [&_[data-entity-mention]]:text-sm [&_[data-entity-mention]]:font-medium",
  "[&_[data-entity-mention]]:cursor-pointer hover:[&_[data-entity-mention]]:bg-muted",
  "[&_[data-entity-mention][data-deleted]]:cursor-default [&_[data-entity-mention][data-deleted]]:text-muted-foreground",
  "[&_[data-entity-mention][data-deleted]]:line-through",
);

/**
 * Read-only rich HTML (Tiptap output) whose `entityMention` spans behave like
 * the editor chips: live title, click to open (Ctrl/Cmd-click: new tab),
 * muted strikethrough when the target is gone.
 */
export function MentionHtml({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const spans = Array.from(root.querySelectorAll<HTMLElement>("span[data-entity-mention]"));
    const refs = new Map<string, MentionRef>();
    for (const el of spans) {
      const type = el.dataset.mentionType;
      const id = el.dataset.mentionId;
      if (type && id && MENTION_TYPE_SET.has(type)) {
        refs.set(`${type}:${id}`, { type: type as MentionType, id });
      }
    }
    if (refs.size === 0) return;
    let cancelled = false;
    resolveMentions(Array.from(refs.values()).slice(0, 100))
      .then((rows) => {
        if (cancelled) return;
        const byKey = new Map(rows.map((r) => [`${r.type}:${r.id}`, r]));
        for (const el of spans) {
          const row = byKey.get(`${el.dataset.mentionType}:${el.dataset.mentionId}`);
          if (!row) continue;
          if (!row.exists) {
            el.dataset.deleted = "";
            el.textContent = "deleted";
            delete el.dataset.href;
          } else {
            el.textContent = `@${row.title}`;
            el.dataset.href = row.href;
          }
        }
      })
      .catch(() => {
        /* keep the stored labels */
      });
    return () => {
      cancelled = true;
    };
  }, [html]);

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("span[data-entity-mention]");
    if (!el || "deleted" in el.dataset) return;
    const href = el.dataset.href;
    if (!href) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.metaKey || e.ctrlKey) window.open(href, "_blank", "noopener,noreferrer");
    else router.push(href);
  };

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={cn(CHIP_CLASS, className)}
      // Content is authored by the single app user; safe to render.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
