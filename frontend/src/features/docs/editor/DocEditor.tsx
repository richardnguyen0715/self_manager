"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";

// ── StarterKit ──────────────────────────────────────────────────────────────
import StarterKit from "@tiptap/starter-kit";

// ── Official extensions ─────────────────────────────────────────────────────
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import CharacterCount from "@tiptap/extension-character-count";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { all, createLowlight } from "lowlight";

// ── Tippy.js for suggestion popups ─────────────────────────────────────────
import tippy from "tippy.js";
import "tippy.js/dist/tippy.css";
import { createRoot } from "react-dom/client";

// ── Custom extensions ───────────────────────────────────────────────────────
import { InfoPanel } from "./extensions/InfoPanel";
import { Columns, Column } from "./extensions/Columns";
import { Mermaid } from "./extensions/Mermaid";
import { TableOfContents } from "./extensions/TableOfContents";

// ── Node views ──────────────────────────────────────────────────────────────
import { InfoPanelView } from "./node-views/InfoPanelView";
import { MermaidView } from "./node-views/MermaidView";
import { TableOfContentsView } from "./node-views/TableOfContentsView";

// ── Slash menu ──────────────────────────────────────────────────────────────
import type { SlashMenuHandle } from "./SlashMenu";
import { SlashMenu, SLASH_ITEMS } from "./SlashMenu";

// ── Toolbar + template picker ───────────────────────────────────────────────
import { Toolbar } from "./Toolbar";
import { TemplatesPicker } from "./TemplatesPicker";

// ── Hooks + types ───────────────────────────────────────────────────────────
import { useUploadPageImage } from "@/features/docs";
import type { TipTapDoc } from "@/types";
import { cn } from "@/lib/utils";

// ── Lowlight (all languages bundled) ────────────────────────────────────────
const lowlight = createLowlight(all);

// ── Slash-menu suggestion config ────────────────────────────────────────────
type SlashItem = (typeof SLASH_ITEMS)[number];

function buildSlashSuggestion() {
  return {
    char: "/",
    startOfLine: false,
    // command in SuggestionOptions<I, TSelected> receives { editor, range, props: TSelected }
    command({
      editor,
      range,
      props,
    }: {
      editor: import("@tiptap/core").Editor;
      range: import("@tiptap/core").Range;
      props: SlashItem;
    }) {
      props.command({ editor, range });
    },
    items({ query }: { query: string }): SlashItem[] {
      const q = query.toLowerCase();
      return SLASH_ITEMS.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q),
      );
    },
    render() {
      let rootEl: ReturnType<typeof createRoot> | null = null;
      let popupInstance: ReturnType<typeof tippy> | null = null;
      let menuHandle: SlashMenuHandle | null = null;

      return {
        onStart(suggProps: SuggestionProps<SlashItem, SlashItem>) {
          const container = document.createElement("div");
          rootEl = createRoot(container);
          rootEl.render(
            <SlashMenu
              ref={(r) => { menuHandle = r; }}
              items={suggProps.items}
              // props.command(item) dispatches via the top-level command handler
              command={(item) => suggProps.command(item)}
            />,
          );

          popupInstance = tippy("body", {
            getReferenceClientRect: (suggProps.clientRect ?? (() => new DOMRect())) as () => DOMRect,
            appendTo: () => document.body,
            content: container,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
            maxWidth: "none",
          });
        },

        onUpdate(suggProps: SuggestionProps<SlashItem, SlashItem>) {
          if (rootEl) {
            rootEl.render(
              <SlashMenu
                ref={(r) => { menuHandle = r; }}
                items={suggProps.items}
                command={(item) => suggProps.command(item)}
              />,
            );
          }
          if (popupInstance?.[0]) {
            popupInstance[0].setProps({
              getReferenceClientRect: (suggProps.clientRect ?? (() => new DOMRect())) as () => DOMRect,
            });
          }
        },

        onKeyDown(kd: SuggestionKeyDownProps) {
          if (kd.event.key === "Escape") {
            popupInstance?.[0]?.hide();
            return true;
          }
          return menuHandle?.onKeyDown(kd) ?? false;
        },

        onExit() {
          popupInstance?.[0]?.destroy();
          rootEl?.unmount();
        },
      };
    },
  };
}

// ── Slash command TipTap Extension ───────────────────────────────────────────
const SlashCommandExtension = Extension.create({
  name: "slashCommand",
  addOptions() {
    return { suggestion: buildSlashSuggestion() };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

// ── Mention suggestion (lightweight stub) ────────────────────────────────────
const mentionSuggestion = {
  items: ({ query }: { query: string }) =>
    query.length > 0 ? [query] : [],
  render: () => ({
    onStart: () => {},
    onUpdate: () => {},
    onKeyDown: () => false,
    onExit: () => {},
  }),
};

// ── Doc helpers ───────────────────────────────────────────────────────────────

function normalizeDoc(doc: TipTapDoc): TipTapDoc {
  if (!doc || Object.keys(doc).length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
  return doc;
}

function hasContent(doc: TipTapDoc): boolean {
  const nodes = (doc?.content as unknown[]) ?? [];
  if (nodes.length === 0) return false;
  if (nodes.length === 1) {
    const first = nodes[0] as { type?: string; content?: unknown[] };
    if (first.type === "paragraph" && ((first.content ?? []).length === 0)) {
      return false;
    }
  }
  return true;
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface DocEditorProps {
  /** Page id — used for the image upload endpoint */
  pageId: string;
  /** Controlled JSON document */
  value: TipTapDoc;
  /** Called on each doc update; caller should debounce before persisting */
  onChange: (doc: TipTapDoc) => void;
  /** Renders the editor as non-editable */
  readOnly?: boolean;
  /** Optional wrapper className */
  className?: string;
  /** Show the template picker when the page is freshly blank */
  showTemplatePicker?: boolean;
}

// ── DocEditor ────────────────────────────────────────────────────────────────

export function DocEditor({
  pageId,
  value,
  onChange,
  readOnly = false,
  className,
  showTemplatePicker = false,
}: DocEditorProps) {
  const uploadMutation = useUploadPageImage(pageId);

  // Keep onChange ref stable so the TipTap onUpdate closure always has
  // the latest version without triggering editor recreation.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [templatePickerOpen, setTemplatePickerOpen] = useState(
    showTemplatePicker && !hasContent(value),
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
          class: "text-primary underline underline-offset-2",
        },
      }),
      Placeholder.configure({
        placeholder: 'Type "/" for slash commands, or start writing…',
      }),
      CharacterCount,
      Mention.configure({
        HTMLAttributes: { class: "mention" },
        suggestion: mentionSuggestion,
      }),
      // Custom node extensions with React node views
      InfoPanel.extend({
        addNodeView() {
          return ReactNodeViewRenderer(InfoPanelView);
        },
      }),
      Column,
      Columns,
      Mermaid.extend({
        addNodeView() {
          return ReactNodeViewRenderer(MermaidView);
        },
      }),
      TableOfContents.extend({
        addNodeView() {
          return ReactNodeViewRenderer(TableOfContentsView);
        },
      }),
      // Slash command (non-conflicting with Mention)
      SlashCommandExtension,
    ],
    editable: !readOnly,
    content: normalizeDoc(value),
    onUpdate({ editor: ed }) {
      onChangeRef.current(ed.getJSON() as TipTapDoc);
    },
    editorProps: {
      attributes: {
        class: "focus:outline-none",
        spellcheck: "true",
      },
    },
  });

  // Sync externally changed value (e.g. version restore sets new content)
  const valueRef = useRef(value);
  useEffect(() => {
    if (!editor || JSON.stringify(valueRef.current) === JSON.stringify(value)) return;
    valueRef.current = value;
    editor.commands.setContent(normalizeDoc(value), false);
  }, [editor, value]);

  // Upload helper
  const handleImageUpload = useCallback(
    async (file: File): Promise<string> => {
      const result = await uploadMutation.mutateAsync(file);
      return result.url;
    },
    [uploadMutation],
  );

  // Clipboard paste → upload image
  useEffect(() => {
    if (!editor || readOnly) return;

    const handlePaste = async (event: Event) => {
      const ce = event as unknown as ClipboardEvent;
      const items = Array.from(ce.clipboardData?.items ?? []);
      const imageItem = items.find((i) => i.type.startsWith("image/"));
      if (!imageItem) return;
      event.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return;
      try {
        const url = await handleImageUpload(file);
        editor.chain().focus().setImage({ src: url }).run();
      } catch {
        // swallow — could add toast here
      }
    };

    const el = editor.view.dom;
    el.addEventListener("paste", handlePaste);
    return () => el.removeEventListener("paste", handlePaste);
  }, [editor, handleImageUpload, readOnly]);

  const handleTemplateSelect = (content: TipTapDoc) => {
    editor?.commands.setContent(normalizeDoc(content), false);
    onChangeRef.current(content);
  };

  const charCount = editor?.storage.characterCount?.characters?.() ?? 0;
  const wordCount = editor?.storage.characterCount?.words?.() ?? 0;

  return (
    <div className={cn("flex flex-col flex-1 min-h-0", className)}>
      {editor && !readOnly && (
        <Toolbar editor={editor} onImageUpload={handleImageUpload} />
      )}

      <div className="flex-1 overflow-y-auto">
        <EditorContent
          editor={editor}
          className={cn(
            "mx-auto max-w-3xl px-8 py-10",
            // Prose styling
            "prose prose-neutral dark:prose-invert max-w-none",
            // Editor area min-height
            "[&_.ProseMirror]:min-h-[60vh] [&_.ProseMirror]:outline-none",
            // Heading scroll margin for anchors
            "[&_h1]:scroll-mt-16 [&_h2]:scroll-mt-16 [&_h3]:scroll-mt-16",
            // Task list reset
            "[&_.task-list]:list-none [&_.task-list]:pl-0",
            "[&_.task-list-item]:flex [&_.task-list-item]:items-baseline [&_.task-list-item]:gap-2",
            "[&_.task-list-item_input[type=checkbox]]:cursor-pointer",
            // Mention chip
            "[&_.mention]:rounded [&_.mention]:bg-primary/10 [&_.mention]:px-1",
            "[&_.mention]:text-primary [&_.mention]:font-medium [&_.mention]:text-sm",
            // Columns layout
            "[&_.columns-block]:grid [&_.columns-block]:grid-cols-2 [&_.columns-block]:gap-4 [&_.columns-block]:my-3",
            "[&_.column-block]:min-w-0",
            // Code block
            "[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:text-sm",
            // Placeholder
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground/60",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0",
            // Table
            "[&_table]:w-full [&_table]:border-collapse",
            "[&_td,&_th]:border [&_td,&_th]:border-border [&_td,&_th]:px-3 [&_td,&_th]:py-1.5 [&_td,&_th]:text-sm",
            "[&_th]:bg-muted [&_th]:font-semibold",
          )}
        />
      </div>

      {/* Status bar — only when editable */}
      {!readOnly && (
        <div className="flex items-center justify-end gap-4 border-t bg-background/80 px-4 py-1 text-xs text-muted-foreground">
          <span>{wordCount} words</span>
          <span>{charCount} chars</span>
        </div>
      )}

      {/* Template picker */}
      <TemplatesPicker
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onSelect={handleTemplateSelect}
      />
    </div>
  );
}

// ── DocView — thin read-only wrapper ─────────────────────────────────────────

export interface DocViewProps {
  content: TipTapDoc;
  className?: string;
}

export function DocView({ content, className }: DocViewProps) {
  return (
    <DocEditor
      pageId="__readonly__"
      value={content}
      onChange={() => {}}
      readOnly
      className={className}
    />
  );
}
