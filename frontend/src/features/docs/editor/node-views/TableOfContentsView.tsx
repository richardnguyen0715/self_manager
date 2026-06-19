"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { List } from "lucide-react";
import { useEffect, useState } from "react";

interface HeadingEntry {
  level: number;
  text: string;
  id: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function TableOfContentsView({ editor }: NodeViewProps) {
  const [headings, setHeadings] = useState<HeadingEntry[]>([]);

  useEffect(() => {
    const update = () => {
      const entries: HeadingEntry[] = [];
      const seenIds: Record<string, number> = {};

      editor.state.doc.descendants((node) => {
        if (node.type.name === "heading") {
          const text = node.textContent;
          const level = node.attrs.level as number;
          let id = slugify(text);
          if (seenIds[id] !== undefined) {
            seenIds[id]++;
            id = `${id}-${seenIds[id]}`;
          } else {
            seenIds[id] = 0;
          }
          entries.push({ level, text, id });
        }
      });

      setHeadings(entries);
    };

    update();
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor]);

  if (headings.length === 0) {
    return (
      <NodeViewWrapper>
        <div className="my-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground flex items-center gap-2">
          <List className="h-4 w-4" />
          Table of contents — add headings to populate
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <div className="my-3 rounded-lg border bg-muted/30 p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <List className="h-3.5 w-3.5" />
          Table of Contents
        </div>
        <nav>
          <ul className="space-y-1">
            {headings.map((h, i) => (
              <li
                key={i}
                style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
              >
                <a
                  href={`#${h.id}`}
                  className="text-sm text-primary hover:underline decoration-primary/50 underline-offset-2"
                  onClick={(e) => {
                    e.preventDefault();
                    const el = document.getElementById(h.id);
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </NodeViewWrapper>
  );
}
