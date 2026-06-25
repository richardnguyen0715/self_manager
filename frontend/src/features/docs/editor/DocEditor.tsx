"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import type { Editor as TipTapEditor, Range } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";

// ── Drag-handle + auto-joiner ───────────────────────────────────────────────
import GlobalDragHandle from "tiptap-extension-global-drag-handle";
import AutoJoiner from "tiptap-extension-auto-joiner";

// ── Block gutter / block menu ────────────────────────────────────────────────
import { BlockGutter } from "./BlockGutter";
import { BlockMenu } from "./BlockMenu";
import type { BlockMenuState } from "./BlockMenu";

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
import Highlight from "@tiptap/extension-highlight";
import Youtube from "@tiptap/extension-youtube";
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
import { Toggle, ToggleSummary } from "./extensions/Toggle";
import { Callout } from "./extensions/Callout";
import { Bookmark } from "./extensions/Bookmark";
import { Embed } from "./extensions/Embed";
import { DatabaseEmbed } from "./extensions/DatabaseEmbed";
import { PageMention } from "./extensions/PageMention";
import type { PageMentionAttrs } from "./extensions/PageMention";
import { NodeDelete } from "./extensions/NodeDelete";
import { BlockSelection } from "./extensions/BlockSelection";

// ── Node views ──────────────────────────────────────────────────────────────
import { CodeBlockView } from "./node-views/CodeBlockView";
import { InfoPanelView } from "./node-views/InfoPanelView";
import { MermaidView } from "./node-views/MermaidView";
import { TableOfContentsView } from "./node-views/TableOfContentsView";
import { ToggleView } from "./node-views/ToggleView";
import { CalloutView } from "./node-views/CalloutView";
import { BookmarkView } from "./node-views/BookmarkView";
import { EmbedView } from "./node-views/EmbedView";
import { DatabaseEmbedView } from "./node-views/DatabaseEmbedView";

// ── Slash menu ──────────────────────────────────────────────────────────────
import type { SlashMenuHandle, SlashCommandItem } from "./SlashMenu";
import { SlashMenu, buildSlashItems } from "./SlashMenu";

// ── Page mention list ───────────────────────────────────────────────────────
import { PageMentionList } from "./PageMentionList";
import type { PageMentionListHandle } from "./PageMentionList";

// ── Toolbar + template picker ───────────────────────────────────────────────
import { Toolbar } from "./Toolbar";
import { TemplatesPicker } from "./TemplatesPicker";

// ── URL dialog (replaces window.prompt) ────────────────────────────────────
import { UrlDialog } from "./UrlDialog";

// ── Hooks + types ───────────────────────────────────────────────────────────
import { useUploadPageImage, useSearchPages, usePageTree } from "@/features/docs";
import { usePeekStore } from "@/features/docs/store/usePeekStore";
import type { TipTapDoc, PageSearchResult, PageTreeNode } from "@/types";
import { cn } from "@/lib/utils";

// ── Lowlight (all languages bundled) ────────────────────────────────────────
const lowlight = createLowlight(all);

// ── Types ────────────────────────────────────────────────────────────────────
type SlashItem = SlashCommandItem;

interface PendingUrlInsert {
  onUrl: (url: string, editor: TipTapEditor, range: Range) => void;
  editor: TipTapEditor;
  range: Range;
}

type UrlRequestFn = (
  onUrl: (url: string, editor: TipTapEditor, range: Range) => void,
  editor: TipTapEditor,
  range: Range,
) => void;

// ── buildSlashSuggestion ─────────────────────────────────────────────────────

function buildSlashSuggestion(
  onRequestImageUrl: UrlRequestFn,
  onRequestBookmarkUrl: UrlRequestFn,
  onRequestEmbedUrl: UrlRequestFn,
  onRequestVideoUrl: UrlRequestFn,
  onRequestDatabaseId: UrlRequestFn,
) {
  const items = buildSlashItems({
    onRequestImageUrl,
    onRequestBookmarkUrl,
    onRequestEmbedUrl,
    onRequestVideoUrl,
    onRequestDatabaseId,
  });

  return {
    char: "/",
    startOfLine: false,
    command({
      editor,
      range,
      props,
    }: {
      editor: TipTapEditor;
      range: Range;
      props: SlashItem;
    }) {
      props.command({ editor, range });
    },
    items({ query }: { query: string }): SlashItem[] {
      const q = query.toLowerCase();
      return items.filter(
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

// ── @page mention suggestion builder ────────────────────────────────────────

function buildPageMentionSuggestion(
  getSearchResults: (q: string) => PageSearchResult[],
  isLoading: (q: string) => boolean,
  onSelect: (attrs: PageMentionAttrs) => void,
) {
  return {
    char: "@",
    startOfLine: false,
    command({
      editor,
      range,
      props,
    }: {
      editor: TipTapEditor;
      range: Range;
      props: PageSearchResult;
    }) {
      // Delete the @ + query text, then insert the pageMention node
      editor
        .chain()
        .focus()
        .deleteRange(range)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insertPageMention({ pageId: props.id, label: props.title })
        .run();
      onSelect({ pageId: props.id, label: props.title });
    },
    items({ query }: { query: string }): PageSearchResult[] {
      return getSearchResults(query);
    },
    render() {
      let rootEl: ReturnType<typeof createRoot> | null = null;
      let popupInstance: ReturnType<typeof tippy> | null = null;
      let listHandle: PageMentionListHandle | null = null;

      return {
        onStart(suggProps: SuggestionProps<PageSearchResult, PageSearchResult>) {
          const container = document.createElement("div");
          rootEl = createRoot(container);
          rootEl.render(
            <PageMentionList
              ref={(r) => { listHandle = r; }}
              items={suggProps.items}
              loading={isLoading(suggProps.query ?? "")}
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

        onUpdate(suggProps: SuggestionProps<PageSearchResult, PageSearchResult>) {
          if (rootEl) {
            rootEl.render(
              <PageMentionList
                ref={(r) => { listHandle = r; }}
                items={suggProps.items}
                loading={isLoading(suggProps.query ?? "")}
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
          return listHandle?.onKeyDown(kd) ?? false;
        },

        onExit() {
          popupInstance?.[0]?.destroy();
          rootEl?.unmount();
        },
      };
    },
  };
}

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
  /**
   * Space id — scopes the @mention page search.  When present the mention
   * dropdown lists pages from this space even before the user types anything
   * (mirroring Notion's behaviour).
   */
  spaceId?: string;
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
  spaceId,
  value,
  onChange,
  readOnly = false,
  className,
  showTemplatePicker = false,
}: DocEditorProps) {
  const uploadMutation = useUploadPageImage(pageId);
  const openPeek = usePeekStore((s) => s.openPeek);

  const editorWrapperRef = useRef<HTMLDivElement>(null);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [templatePickerOpen, setTemplatePickerOpen] = useState(
    showTemplatePicker && !hasContent(value),
  );

  // ── @page mention query ────────────────────────────────────────────────────
  const [mentionQuery, setMentionQuery] = useState("");

  // When query is non-empty: call the search endpoint scoped to the space.
  // Guard: only enable when q has content (the endpoint requires a non-empty q).
  const isQueryEmpty = mentionQuery.trim().length === 0;
  const { data: searchResults, isFetching: searchLoading } = useSearchPages(
    mentionQuery,
    spaceId,
  );

  // When query is empty: show all pages in the current space from the page tree.
  const { data: pageTree, isFetching: treeLoading } = usePageTree(spaceId ?? "");

  // Flatten a PageTreeNode tree into a flat list of PageSearchResult-shaped items.
  function flattenTree(nodes: PageTreeNode[]): PageSearchResult[] {
    const result: PageSearchResult[] = [];
    const visit = (n: PageTreeNode) => {
      result.push({ id: n.id, space_id: n.space_id, title: n.title, kind: n.kind, icon: n.icon, snippet: null });
      n.children.forEach(visit);
    };
    nodes.forEach(visit);
    return result;
  }

  // Combine: empty query → page tree; non-empty query → search results.
  const mentionResults: PageSearchResult[] = isQueryEmpty
    ? flattenTree(pageTree ?? [])
    : (searchResults ?? []);
  const mentionLoading = isQueryEmpty ? treeLoading : searchLoading;

  // Stable refs so suggestion config closures always get fresh values
  const mentionResultsRef = useRef<PageSearchResult[]>([]);
  const mentionLoadingRef = useRef(false);
  useEffect(() => {
    mentionResultsRef.current = mentionResults;
    mentionLoadingRef.current = mentionLoading;
  }, [mentionResults, mentionLoading]);

  // ── Image URL dialog state ────────────────────────────────────────────────
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const pendingImageRef = useRef<PendingUrlInsert | null>(null);

  // ── Bookmark URL dialog ───────────────────────────────────────────────────
  const [bookmarkDialogOpen, setBookmarkDialogOpen] = useState(false);
  const pendingBookmarkRef = useRef<PendingUrlInsert | null>(null);

  // ── Embed URL dialog ──────────────────────────────────────────────────────
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false);
  const pendingEmbedRef = useRef<PendingUrlInsert | null>(null);

  // ── Video URL dialog ──────────────────────────────────────────────────────
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const pendingVideoRef = useRef<PendingUrlInsert | null>(null);

  // ── Database ID dialog ────────────────────────────────────────────────────
  const [databaseDialogOpen, setDatabaseDialogOpen] = useState(false);
  const pendingDatabaseRef = useRef<PendingUrlInsert | null>(null);

  // ── Block menu state (turn into / duplicate) ──────────────────────────────
  const [blockMenuState, setBlockMenuState] = useState<BlockMenuState>({
    x: 0,
    y: 0,
    open: false,
  });

  // ── Stable request refs ───────────────────────────────────────────────────
  const requestImageUrlRef = useRef(
    (onUrl: PendingUrlInsert["onUrl"], ed: TipTapEditor, range: Range) => {
      pendingImageRef.current = { onUrl, editor: ed, range };
      setImageDialogOpen(true);
    },
  );

  const requestBookmarkUrlRef = useRef(
    (onUrl: PendingUrlInsert["onUrl"], ed: TipTapEditor, range: Range) => {
      pendingBookmarkRef.current = { onUrl, editor: ed, range };
      setBookmarkDialogOpen(true);
    },
  );

  const requestEmbedUrlRef = useRef(
    (onUrl: PendingUrlInsert["onUrl"], ed: TipTapEditor, range: Range) => {
      pendingEmbedRef.current = { onUrl, editor: ed, range };
      setEmbedDialogOpen(true);
    },
  );

  const requestVideoUrlRef = useRef(
    (onUrl: PendingUrlInsert["onUrl"], ed: TipTapEditor, range: Range) => {
      pendingVideoRef.current = { onUrl, editor: ed, range };
      setVideoDialogOpen(true);
    },
  );

  const requestDatabaseIdRef = useRef(
    (onUrl: PendingUrlInsert["onUrl"], ed: TipTapEditor, range: Range) => {
      pendingDatabaseRef.current = { onUrl, editor: ed, range };
      setDatabaseDialogOpen(true);
    },
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }).extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockView);
        },
      }),
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
        placeholder: "Type '/' for commands",
        includeChildren: true,
      }),
      CharacterCount,
      // ── V2: Highlight + Youtube (npm extensions) ──────────────────────
      Highlight.configure({ multicolor: true }),
      Youtube.configure({ controls: true, nocookie: true }),
      // ── V2: Custom node extensions (with React node views) ────────────
      Toggle.extend({
        addNodeView() {
          return ReactNodeViewRenderer(ToggleView);
        },
      }),
      ToggleSummary,
      Callout.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CalloutView);
        },
      }),
      Bookmark.extend({
        addNodeView() {
          return ReactNodeViewRenderer(BookmarkView);
        },
      }),
      Embed.extend({
        addNodeView() {
          return ReactNodeViewRenderer(EmbedView);
        },
      }),
      DatabaseEmbed.extend({
        addNodeView() {
          return ReactNodeViewRenderer(DatabaseEmbedView);
        },
      }),
      PageMention,
      // ── Existing custom nodes ──────────────────────────────────────────
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
      // ── Drag-to-reorder + auto-joiner ──────────────────────────────────
      GlobalDragHandle.configure({
        dragHandleWidth: 24,
        scrollTreshold: 100,
        customNodeTypes: ["toggle", "callout", "bookmark", "embed", "databaseEmbed"],
      }),
      AutoJoiner.configure({
        elementsToJoin: ["bulletList", "orderedList", "taskList"],
      }),
      // ── Node deletion (Backspace/Delete for NodeSelection) ────────────
      NodeDelete,
      // ── Multi-block selection (gutter drag + decorations) ─────────────
      BlockSelection,
      // ── @page mention suggestion ──────────────────────────────────────
      Extension.create({
        name: "pageMentionSuggestion",
        addOptions() {
          return {
            suggestion: buildPageMentionSuggestion(
              (q) => {
                setMentionQuery(q);
                return mentionResultsRef.current;
              },
              () => mentionLoadingRef.current,
              () => {
                // No extra client action needed; backlinks synced on content save
              },
            ),
          };
        },
        addProseMirrorPlugins() {
          return [
            Suggestion({
              editor: this.editor,
              pluginKey: new PluginKey("pageMentionSuggestion"),
              ...this.options.suggestion,
            }),
          ];
        },
      }),
      // ── Slash command ─────────────────────────────────────────────────
      Extension.create({
        name: "slashCommand",
        addOptions() {
          return {
            suggestion: buildSlashSuggestion(
              (...args) => requestImageUrlRef.current(...args),
              (...args) => requestBookmarkUrlRef.current(...args),
              (...args) => requestEmbedUrlRef.current(...args),
              (...args) => requestVideoUrlRef.current(...args),
              (...args) => requestDatabaseIdRef.current(...args),
            ),
          };
        },
        addProseMirrorPlugins() {
          return [
            Suggestion({
              editor: this.editor,
              pluginKey: new PluginKey("slashCommandSuggestion"),
              ...this.options.suggestion,
            }),
          ];
        },
      }),
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
      // Intercept clicks on page-mention chips so they open the peek panel
      // instead of following the href navigation.
      handleClick(_view, _pos, event) {
        const target = event.target as HTMLElement | null;
        if (!target) return false;
        const anchor = target.closest<HTMLAnchorElement>("a.page-mention");
        if (!anchor) return false;
        event.preventDefault();
        const targetPageId = anchor.dataset.pageId;
        if (targetPageId) {
          openPeek(targetPageId);
        }
        return true;
      },
    },
  });

  // Sync externally changed value (e.g. version restore). Never re-set content
  // while the user is typing — setContent resets the cursor to the end, which
  // caused the caret to jump on edit/delete.
  const valueRef = useRef(value);
  useEffect(() => {
    if (!editor) return;
    if (editor.isFocused) {
      // We're the source of this change; just track it, don't reset.
      valueRef.current = value;
      return;
    }
    if (JSON.stringify(valueRef.current) === JSON.stringify(value)) return;
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

  const handleInsertImageUrl = useCallback(
    (url: string) => {
      if (!editor || !url) return;
      editor.chain().focus().setImage({ src: url }).run();
    },
    [editor],
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
        // swallow
      }
    };

    const el = editor.view.dom;
    el.addEventListener("paste", handlePaste);
    return () => el.removeEventListener("paste", handlePaste);
  }, [editor, handleImageUpload, readOnly]);

  // Context menu on editor to open BlockMenu
  useEffect(() => {
    if (!editor || readOnly) return;
    const el = editor.view.dom;
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setBlockMenuState({ x: e.clientX, y: e.clientY, open: true });
    };
    el.addEventListener("contextmenu", handleContextMenu);
    return () => el.removeEventListener("contextmenu", handleContextMenu);
  }, [editor, readOnly]);

  // ── Drag-handle focus fix ────────────────────────────────────────────────
  // The GlobalDragHandle element lives OUTSIDE the contenteditable, so clicking
  // it can steal browser focus from the editor.  We listen for mousedown on the
  // parent (where the handle is appended) and, if the target is the handle,
  // we schedule a re-focus after the event is processed so that keydown events
  // (Backspace / Delete) still reach ProseMirror.
  useEffect(() => {
    if (!editor || readOnly) return;
    const parent = editor.view.dom.parentElement;
    if (!parent) return;

    const onParentMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Match both the handle itself and any SVG child inside it
      const handle = target.closest("[data-drag-handle], .drag-handle");
      if (!handle) return;
      // After the browser processes the click (which may move focus to the
      // drag handle element), refocus the editor view.
      requestAnimationFrame(() => {
        editor.view.focus();
      });
    };

    parent.addEventListener("mousedown", onParentMouseDown);
    return () => parent.removeEventListener("mousedown", onParentMouseDown);
  }, [editor, readOnly]);

  // ── Read-only page-mention click → peek panel ───────────────────────────
  // When the editor is read-only (DocView), ProseMirror's handleClick in
  // editorProps is still active but we also add a delegated DOM listener on
  // the wrapper for belt-and-suspenders coverage (e.g. if editor is null).
  useEffect(() => {
    if (!readOnly) return;
    const container = editorWrapperRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest<HTMLAnchorElement>("a.page-mention");
      if (!anchor) return;
      e.preventDefault();
      const targetPageId = anchor.dataset.pageId;
      if (targetPageId) {
        openPeek(targetPageId);
      }
    };

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, [readOnly, openPeek]);

  const handleTemplateSelect = (content: TipTapDoc) => {
    editor?.commands.setContent(normalizeDoc(content), false);
    onChangeRef.current(content);
  };

  // ── Dialog confirm / cancel helpers ──────────────────────────────────────

  const confirmDialog = (
    pendingRef: React.MutableRefObject<PendingUrlInsert | null>,
    setOpen: (v: boolean) => void,
  ) =>
    (url: string) => {
      setOpen(false);
      const pending = pendingRef.current;
      if (pending && url) {
        pending.onUrl(url, pending.editor, pending.range);
      }
      pendingRef.current = null;
    };

  const cancelDialog = (
    pendingRef: React.MutableRefObject<PendingUrlInsert | null>,
    setOpen: (v: boolean) => void,
  ) =>
    () => {
      setOpen(false);
      pendingRef.current = null;
    };

  const charCount = editor?.storage.characterCount?.characters?.() ?? 0;
  const wordCount = editor?.storage.characterCount?.words?.() ?? 0;

  return (
    <div className={cn("flex flex-col flex-1 min-h-0", className)}>
      {editor && !readOnly && (
        <Toolbar
          editor={editor}
          onImageUpload={handleImageUpload}
          onInsertImageUrl={handleInsertImageUrl}
        />
      )}

      {/* Notion-style centered page scroll area */}
      <div className="notion-page-scroll flex-1 overflow-y-auto">
        <div
          ref={editorWrapperRef}
          className="notion-editor-wrapper group/editor relative mx-auto"
        >
          <EditorContent
            editor={editor}
            className={cn(
              "notion-editor-content",
              "prose prose-neutral dark:prose-invert max-w-none",
              "[&_.ProseMirror]:min-h-[60vh] [&_.ProseMirror]:outline-none",
              "[&_h1]:scroll-mt-16 [&_h2]:scroll-mt-16 [&_h3]:scroll-mt-16",
              "[&_.task-list]:list-none [&_.task-list]:pl-0",
              "[&_.task-list-item]:flex [&_.task-list-item]:items-baseline [&_.task-list-item]:gap-2",
              "[&_.task-list-item_input[type=checkbox]]:cursor-pointer",
              // @page mention chip
              "[&_.page-mention]:rounded [&_.page-mention]:bg-primary/10 [&_.page-mention]:px-1",
              "[&_.page-mention]:text-primary [&_.page-mention]:font-medium [&_.page-mention]:text-sm",
              "[&_.page-mention]:no-underline hover:[&_.page-mention]:underline",
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
              // Highlight mark
              "[&_mark]:rounded [&_mark]:px-0.5 [&_mark]:bg-yellow-200/80 dark:[&_mark]:bg-yellow-700/60",
              // YouTube embed
              "[&_.youtube-wrapper]:my-3 [&_.youtube-wrapper]:overflow-hidden [&_.youtube-wrapper]:rounded-lg",
            )}
          />
          {editor && !readOnly && (
            <BlockGutter editor={editor} editorWrapperRef={editorWrapperRef} />
          )}
        </div>
      </div>

      {/* Status bar */}
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

      {/* Block menu (turn into / duplicate) */}
      {editor && !readOnly && (
        <BlockMenu
          editor={editor}
          state={blockMenuState}
          onClose={() => setBlockMenuState((s) => ({ ...s, open: false }))}
        />
      )}

      {/* ── URL dialogs ──────────────────────────────────────────────── */}
      <UrlDialog
        open={imageDialogOpen}
        title="Insert Image"
        label="Image URL"
        placeholder="https://example.com/image.png"
        onConfirm={confirmDialog(pendingImageRef, setImageDialogOpen)}
        onCancel={cancelDialog(pendingImageRef, setImageDialogOpen)}
      />

      <UrlDialog
        open={bookmarkDialogOpen}
        title="Add Bookmark"
        label="URL"
        placeholder="https://example.com"
        onConfirm={confirmDialog(pendingBookmarkRef, setBookmarkDialogOpen)}
        onCancel={cancelDialog(pendingBookmarkRef, setBookmarkDialogOpen)}
      />

      <UrlDialog
        open={embedDialogOpen}
        title="Embed URL"
        label="URL"
        placeholder="https://example.com"
        onConfirm={confirmDialog(pendingEmbedRef, setEmbedDialogOpen)}
        onCancel={cancelDialog(pendingEmbedRef, setEmbedDialogOpen)}
      />

      <UrlDialog
        open={videoDialogOpen}
        title="Insert Video"
        label="YouTube / Video URL"
        placeholder="https://www.youtube.com/watch?v=..."
        onConfirm={confirmDialog(pendingVideoRef, setVideoDialogOpen)}
        onCancel={cancelDialog(pendingVideoRef, setVideoDialogOpen)}
      />

      <UrlDialog
        open={databaseDialogOpen}
        title="Embed Database"
        label="Database ID"
        placeholder="uuid"
        onConfirm={confirmDialog(pendingDatabaseRef, setDatabaseDialogOpen)}
        onCancel={cancelDialog(pendingDatabaseRef, setDatabaseDialogOpen)}
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
