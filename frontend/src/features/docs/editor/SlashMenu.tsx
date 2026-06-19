"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { Editor, Range } from "@tiptap/core";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Minus,
  Code2,
  Table,
  Image,
  Info,
  AlertTriangle,
  Columns2,
  GitGraph,
  ListTree,
  StickyNote,
  CheckCircle,
  Type,
  ToggleLeft,
  MessageSquare,
  Bookmark,
  Frame,
  Youtube,
  Highlighter,
  Database,
  AtSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: React.ElementType;
  command: (params: { editor: Editor; range: Range }) => void;
}

// ── Static slash items (no side effects) ──────────────────────────────────────
// The Image item's command is intentionally a no-op here; callers should
// override it via buildSlashItems() to open an in-app dialog instead of
// relying on window.prompt.
export const SLASH_ITEMS: SlashCommandItem[] = [
  {
    title: "Text",
    description: "Start with plain paragraph",
    icon: Type,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: "Heading 1",
    description: "Large section heading",
    icon: Heading1,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setHeading({ level: 1 })
        .run();
    },
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    icon: Heading2,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setHeading({ level: 2 })
        .run();
    },
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    icon: Heading3,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setHeading({ level: 3 })
        .run();
    },
  },
  {
    title: "Bullet List",
    description: "Unordered list",
    icon: List,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Numbered List",
    description: "Ordered list",
    icon: ListOrdered,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "Task List",
    description: "Checklist with checkboxes",
    icon: CheckSquare,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: "Quote",
    description: "Blockquote",
    icon: Quote,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: "Divider line",
    description: "Horizontal line / rule to separate sections",
    icon: Minus,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: "Code Block",
    description: "Syntax-highlighted code",
    icon: Code2,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCodeBlock().run();
    },
  },
  {
    title: "Table",
    description: "3×3 table",
    icon: Table,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  {
    // Image — command is a no-op placeholder; see buildSlashItems() below.
    title: "Image",
    description: "Insert image via URL",
    icon: Image,
    command: () => {
      // Intentionally empty — callers override this via buildSlashItems().
    },
  },
  {
    title: "Info Panel",
    description: "Highlighted info callout",
    icon: Info,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insertInfoPanel("info")
        .run();
    },
  },
  {
    title: "Note Panel",
    description: "Highlighted note callout",
    icon: StickyNote,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insertInfoPanel("note")
        .run();
    },
  },
  {
    title: "Warning Panel",
    description: "Highlighted warning callout",
    icon: AlertTriangle,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insertInfoPanel("warning")
        .run();
    },
  },
  {
    title: "Success Panel",
    description: "Highlighted success callout",
    icon: CheckCircle,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insertInfoPanel("success")
        .run();
    },
  },
  {
    title: "Two Columns",
    description: "Side-by-side column layout",
    icon: Columns2,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertColumns()
        .run();
    },
  },
  {
    title: "Mermaid Diagram",
    description: "Flowchart or sequence diagram",
    icon: GitGraph,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertMermaid()
        .run();
    },
  },
  {
    title: "Table of Contents",
    description: "Auto-generated heading list",
    icon: ListTree,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTableOfContents()
        .run();
    },
  },
  // ── V2 new blocks ────────────────────────────────────────────────────────
  {
    title: "Toggle",
    description: "Collapsible block",
    icon: ToggleLeft,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insertToggle()
        .run();
    },
  },
  {
    title: "Callout",
    description: "Emoji callout block",
    icon: MessageSquare,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insertCallout("info")
        .run();
    },
  },
  {
    title: "Bookmark",
    description: "Link preview card",
    icon: Bookmark,
    // command is a no-op placeholder; buildSlashItems overrides with URL dialog
    command: () => {},
  },
  {
    title: "Embed",
    description: "Embed any URL in an iframe",
    icon: Frame,
    // command is a no-op placeholder; buildSlashItems overrides with URL dialog
    command: () => {},
  },
  {
    title: "Video",
    description: "YouTube or video URL",
    icon: Youtube,
    // command is a no-op placeholder; buildSlashItems overrides with URL dialog
    command: () => {},
  },
  {
    title: "Highlight",
    description: "Highlight text",
    icon: Highlighter,
    command: ({ editor, range }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor.chain().focus().deleteRange(range) as any)
        .toggleHighlight()
        .run();
    },
  },
  {
    title: "Database",
    description: "Embed a database view",
    icon: Database,
    // command is a no-op placeholder; buildSlashItems overrides with ID dialog
    command: () => {},
  },
  {
    title: "Mention Page",
    description: "@mention a page",
    icon: AtSign,
    command: ({ editor, range }) => {
      // Trigger @page mention by deleting the slash and inserting @
      editor.chain().focus().deleteRange(range).insertContent("@").run();
    },
  },
];

// ── buildSlashItems ──────────────────────────────────────────────────────────
// Returns a copy of SLASH_ITEMS with URL-dependent commands wired to open
// in-app dialogs (Image, Bookmark, Embed, Video, Database).
//
// Each `onRequest*` receives a callback that is called with the URL/id once
// the user confirms (or not called if they cancel).

export interface SlashItemsOptions {
  onRequestImageUrl: (
    onUrl: (url: string, editor: Editor, range: Range) => void,
    editor: Editor,
    range: Range,
  ) => void;
  onRequestBookmarkUrl?: (
    onUrl: (url: string, editor: Editor, range: Range) => void,
    editor: Editor,
    range: Range,
  ) => void;
  onRequestEmbedUrl?: (
    onUrl: (url: string, editor: Editor, range: Range) => void,
    editor: Editor,
    range: Range,
  ) => void;
  onRequestVideoUrl?: (
    onUrl: (url: string, editor: Editor, range: Range) => void,
    editor: Editor,
    range: Range,
  ) => void;
  onRequestDatabaseId?: (
    onId: (id: string, editor: Editor, range: Range) => void,
    editor: Editor,
    range: Range,
  ) => void;
}

export function buildSlashItems(
  onRequestImageUrlOrOptions:
    | SlashItemsOptions["onRequestImageUrl"]
    | SlashItemsOptions,
  // Legacy overload: single function
  _unused?: never,
): SlashCommandItem[] {
  // Normalise: accept either the old single-function signature or the options
  // object so callers from before V2 keep working.
  const opts: SlashItemsOptions =
    typeof onRequestImageUrlOrOptions === "function"
      ? { onRequestImageUrl: onRequestImageUrlOrOptions }
      : onRequestImageUrlOrOptions;

  return SLASH_ITEMS.map((item) => {
    switch (item.title) {
      case "Image":
        return {
          ...item,
          command: ({ editor, range }: { editor: Editor; range: Range }) => {
            opts.onRequestImageUrl(
              (url, ed, r) => {
                if (url) {
                  ed.chain().focus().deleteRange(r).setImage({ src: url }).run();
                }
              },
              editor,
              range,
            );
          },
        };

      case "Bookmark":
        if (!opts.onRequestBookmarkUrl) return item;
        return {
          ...item,
          command: ({ editor, range }: { editor: Editor; range: Range }) => {
            opts.onRequestBookmarkUrl!(
              (url, ed, r) => {
                if (url) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (ed.chain().focus().deleteRange(r) as any)
                    .insertBookmark({ href: url })
                    .run();
                }
              },
              editor,
              range,
            );
          },
        };

      case "Embed":
        if (!opts.onRequestEmbedUrl) return item;
        return {
          ...item,
          command: ({ editor, range }: { editor: Editor; range: Range }) => {
            opts.onRequestEmbedUrl!(
              (url, ed, r) => {
                if (url) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (ed.chain().focus().deleteRange(r) as any)
                    .insertEmbed(url)
                    .run();
                }
              },
              editor,
              range,
            );
          },
        };

      case "Video":
        if (!opts.onRequestVideoUrl) return item;
        return {
          ...item,
          command: ({ editor, range }: { editor: Editor; range: Range }) => {
            opts.onRequestVideoUrl!(
              (url, ed, r) => {
                if (url) {
                  // setYoutubeVideo is from @tiptap/extension-youtube
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (ed.chain().focus().deleteRange(r) as any)
                    .setYoutubeVideo({ src: url })
                    .run();
                }
              },
              editor,
              range,
            );
          },
        };

      case "Database":
        if (!opts.onRequestDatabaseId) return item;
        return {
          ...item,
          command: ({ editor, range }: { editor: Editor; range: Range }) => {
            opts.onRequestDatabaseId!(
              (id, ed, r) => {
                if (id) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (ed.chain().focus().deleteRange(r) as any)
                    .insertDatabaseEmbed(id)
                    .run();
                }
              },
              editor,
              range,
            );
          },
        };

      default:
        return item;
    }
  });
}

// ── SlashMenu component ───────────────────────────────────────────────────────

export interface SlashMenuHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface SlashMenuProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    useEffect(() => setSelectedIndex(0), [items]);

    // Keep the highlighted item scrolled into view during keyboard navigation.
    useEffect(() => {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    useImperativeHandle(ref, () => ({
      onKeyDown({ event }: { event: KeyboardEvent }) {
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          if (items[selectedIndex]) {
            command(items[selectedIndex]);
          }
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) return null;

    return (
      <div className="z-50 w-72 overflow-hidden rounded-lg border bg-popover shadow-lg">
        <div className="max-h-72 overflow-y-auto py-1">
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                onClick={() => command(item)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                  index === selectedIndex
                    ? "bg-accent text-accent-foreground"
                    : "text-popover-foreground hover:bg-accent/60",
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border bg-background">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex flex-col">
                  <span className="font-medium leading-tight">{item.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  },
);
SlashMenu.displayName = "SlashMenu";
