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
        <div
          contentEditable={false}
          className="my-2 flex items-center gap-2 text-sm italic text-muted-foreground/60"
        >
          <List className="h-4 w-4" />
          Table of contents — add headings to populate
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <div contentEditable={false} className="my-3 border-b pb-3">
        <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-foreground">
          <List className="h-4 w-4 text-muted-foreground" />
          Table of Contents
        </div>
        <nav className="flex flex-col gap-0.5 pl-6">
          {headings.map((h, i) => (
            <a
              key={i}
              href={`#${h.id}`}
              style={{ paddingLeft: `${(h.level - 1) * 16}px` }}
              className="block rounded px-1 py-0.5 text-sm text-muted-foreground no-underline transition-colors hover:bg-accent hover:text-foreground hover:underline underline-offset-2 decoration-muted-foreground/40"
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(h.id);
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {h.text}
            </a>
          ))}
        </nav>
      </div>
    </NodeViewWrapper>
  );
}
