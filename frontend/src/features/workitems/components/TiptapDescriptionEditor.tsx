"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Decide whether a stored description value is HTML (produced by this editor) or
 * legacy plain text. We treat it as HTML if it contains a recognizable tag.
 */
function looksLikeHtml(value: string): boolean {
  return /<\/?(p|h[1-6]|ul|ol|li|blockquote|pre|code|strong|em|s|br|a|hr)\b[^>]*>/i.test(
    value,
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Inline markdown → HTML (escapes first, then applies emphasis/code/links). */
function inlineMarkdown(text: string): string {
  let t = escapeHtml(text);
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, "$1<em>$2</em>");
  t = t.replace(/~~([^~]+)~~/g, "<s>$1</s>");
  t = t.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  return t;
}

/** Block-level markdown → HTML (headings, lists, quote, hr, fenced code). */
function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let items: string[] = [];

  const flush = () => {
    if (listType) {
      out.push(
        `<${listType}>${items.map((li) => `<li>${li}</li>`).join("")}</${listType}>`,
      );
      listType = null;
      items = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code block
    const fence = /^```(\w+)?\s*$/.exec(line.trim());
    if (fence) {
      flush();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) {
        buf.push(lines[i]);
        i++;
      }
      out.push(`<pre><code>${escapeHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }

    if (line.trim() === "") {
      flush();
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flush();
      out.push("<hr />");
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const lvl = h[1].length;
      out.push(`<h${lvl}>${inlineMarkdown(h[2])}</h${lvl}>`);
      continue;
    }

    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ol) {
      if (listType !== "ol") flush();
      listType = "ol";
      items.push(inlineMarkdown(ol[1]));
      continue;
    }
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (ul) {
      if (listType !== "ul") flush();
      listType = "ul";
      items.push(inlineMarkdown(ul[1]));
      continue;
    }
    const q = /^>\s+(.*)$/.exec(line);
    if (q) {
      flush();
      out.push(`<blockquote>${inlineMarkdown(q[1])}</blockquote>`);
      continue;
    }

    flush();
    out.push(`<p>${inlineMarkdown(line)}</p>`);
  }
  flush();
  return out.join("");
}

/**
 * Normalize a stored description into HTML. Tiptap-authored values are already
 * HTML and pass through; legacy/plain values are parsed as markdown so #
 * headings, - / 1. lists, **bold**, > quotes etc. render correctly.
 */
export function descriptionToHtml(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (looksLikeHtml(raw)) return raw;
  return markdownToHtml(raw);
}

/** Tiptap leaves an empty doc as "<p></p>"; treat that as no content. */
export function isEmptyHtml(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}

// ── Read-only renderer ──────────────────────────────────────────────────────────

const PROSE_CLASS = cn(
  "prose prose-sm prose-neutral dark:prose-invert max-w-none",
  "[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:text-sm",
  "[&_:first-child]:mt-0 [&_:last-child]:mb-0",
);

export function DescriptionPreview({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  const html = descriptionToHtml(value);
  if (!html || isEmptyHtml(html)) {
    return (
      <div className={cn("text-sm text-muted-foreground italic", className)}>
        Add a description...
      </div>
    );
  }
  return (
    <div
      // Reuse the editor's `.ProseMirror` content styles (headings, lists,
      // quotes, code) so the read-only preview matches the editor. The
      // `prose` classes are kept harmlessly but the project has no typography
      // plugin, so `.ProseMirror` is what actually styles the markup.
      className={cn("ProseMirror", PROSE_CLASS, className)}
      // Content is authored by the single app user; safe to render.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ── Toolbar ─────────────────────────────────────────────────────────────────────

function ToolbarButton({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded transition-colors",
        "text-muted-foreground hover:bg-accent hover:text-foreground",
        active && "bg-accent text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1 py-1">
      <ToolbarButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Inline code"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code className="h-3.5 w-3.5" />
      </ToolbarButton>
      <div className="mx-1 h-5 w-px bg-border" />
      <ToolbarButton
        label="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }
      >
        <Heading1 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
      >
        <Heading2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <div className="mx-1 h-5 w-px bg-border" />
      <ToolbarButton
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Ordered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
}

// ── Editor ───────────────────────────────────────────────────────────────────────

export interface TiptapDescriptionEditorProps {
  /** Initial stored description (HTML or legacy plain text). */
  value: string | null | undefined;
  /** Called with serialized HTML (or empty string) when the user saves. */
  onSave: (html: string) => void;
  onCancel: () => void;
  autoFocus?: boolean;
}

/**
 * Self-contained WYSIWYG editor for a work item description. Editing mode shows
 * a Tiptap editor with a small toolbar + markdown-style keyboard shortcuts
 * (StarterKit input rules). On save it serializes editor.getHTML().
 */
export function TiptapDescriptionEditor({
  value,
  onSave,
  onCancel,
  autoFocus = true,
}: TiptapDescriptionEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
    ],
    content: descriptionToHtml(value),
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: cn(
          PROSE_CLASS,
          "min-h-[6rem] px-3 py-2 outline-none",
        ),
      },
    },
    // Avoids SSR hydration mismatch warnings in Next.js App Router.
    immediatelyRender: false,
  });

  // Keep content in sync if the underlying value changes while not editing.
  useEffect(() => {
    if (!editor) return;
    const next = descriptionToHtml(value);
    if (next !== editor.getHTML()) {
      editor.commands.setContent(next, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  function handleSave() {
    if (!editor) return;
    const html = editor.getHTML();
    onSave(isEmptyHtml(html) ? "" : html);
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          // Subtle at rest: transparent border + hover hint. The harsh
          // all-sides black border is gone; the input border + focus ring only
          // appear when the editor is focused, matching the app's inputs.
          "rounded-md border border-transparent bg-background transition-colors",
          "ring-1 ring-border hover:ring-input",
          "focus-within:border-input focus-within:ring-2 focus-within:ring-ring",
        )}
      >
        {editor && <Toolbar editor={editor} />}
        <EditorContent editor={editor} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Tip: type <code className="rounded bg-muted px-1">**bold**</code>,{" "}
          <code className="rounded bg-muted px-1"># heading</code>,{" "}
          <code className="rounded bg-muted px-1">- list</code>, or{" "}
          <code className="rounded bg-muted px-1">&gt; quote</code>.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
