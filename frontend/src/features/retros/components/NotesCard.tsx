"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Check,
  Code,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EntityMention,
  MentionSuggestion,
  useMentionSync,
} from "@/features/mentions";

const AUTOSAVE_DELAY_MS = 800;
const SAFE_URL = /^(https?:\/\/|mailto:)/i;

/** Tiptap leaves an empty doc as "<p></p>"; store that as "" (cleared). */
function normalizeNotes(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim().length === 0 ? "" : html;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export interface NotesCardProps {
  retroId: string;
  /** Stored notes (Tiptap HTML) or null. */
  notes: string | null;
  /** Persists the notes; resolves when the save has completed. */
  onSave: (notes: string) => Promise<unknown>;
}

/** Free-form rich notes box for a retro. Autosaves; `@` mentions sync to the retro. */
export function NotesCard({ retroId, notes, onSave }: NotesCardProps) {
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  });

  const lastSavedRef = useRef(normalizeNotes(notes ?? ""));
  const pendingRef = useRef<string | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  const commit = useCallback(async () => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    const html = pendingRef.current;
    pendingRef.current = null;
    if (html === null || html === lastSavedRef.current) return;
    setSaveState("saving");
    try {
      await onSaveRef.current(html);
      lastSavedRef.current = html;
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        protocols: ["mailto"],
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      }),
      Placeholder.configure({
        placeholder: "Free-form notes… type @ to mention a task, doc, sprint…",
      }),
      EntityMention,
      MentionSuggestion,
    ],
    content: notes ?? "",
    editorProps: {
      attributes: {
        class: "min-h-[10rem] px-4 py-3 text-sm outline-none",
      },
    },
    onUpdate: ({ editor: ed }) => {
      pendingRef.current = normalizeNotes(ed.getHTML());
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => void commit(), AUTOSAVE_DELAY_MS);
    },
    // Avoids SSR hydration mismatch warnings in Next.js App Router.
    immediatelyRender: false,
  });

  useMentionSync(editor, { type: "retro", id: retroId });

  // Flush a pending save when the card unmounts (e.g. navigating away).
  useEffect(() => {
    return () => {
      void commit();
    };
  }, [commit]);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Notes</h2>
        <SaveIndicator state={saveState} />
      </div>
      <div className="rounded-md border border-input bg-background shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring">
        {editor ? <Toolbar editor={editor} /> : null}
        <EditorContent editor={editor} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Rich text for this retro. Paste a URL to link it, or type{" "}
        <code className="rounded bg-muted px-1">@</code> to mention a task, doc,
        sprint and more.
      </p>
    </section>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (state === "error") {
    return <span className="text-xs text-destructive">Save failed</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Check className="h-3 w-3" /> Saved
    </span>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
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
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const openLinkInput = () => {
    setLinkValue(editor.getAttributes("link").href ?? "");
    setLinkError(null);
    setLinkOpen((open) => !open);
  };

  const applyLink = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = linkValue.trim();
    if (!raw) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkOpen(false);
      return;
    }
    const href = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
    if (!SAFE_URL.test(href)) {
      setLinkError("Only http(s) and mailto links are allowed.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkOpen(false);
  };

  return (
    <div className="border-b border-border">
      <div className="flex flex-wrap items-center gap-0.5 px-1 py-1">
        <ToolbarButton
          label="Heading"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="mx-1 h-5 w-px bg-border" />
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
          label="Inline code"
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code className="h-3.5 w-3.5" />
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
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton
          label="Link"
          active={editor.isActive("link") || linkOpen}
          onClick={openLinkInput}
        >
          <Link2 className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      {linkOpen ? (
        <form onSubmit={applyLink} className="flex items-center gap-2 px-2 pb-2">
          <input
            autoFocus
            value={linkValue}
            onChange={(e) => {
              setLinkValue(e.target.value);
              setLinkError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setLinkOpen(false);
            }}
            placeholder="https://… (empty removes the link)"
            aria-label="Link URL"
            className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <button
            type="submit"
            className="h-7 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Apply
          </button>
          {linkError ? (
            <span className="text-xs text-destructive">{linkError}</span>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
