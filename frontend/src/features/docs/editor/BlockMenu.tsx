"use client";

/**
 * BlockMenu — context menu rendered in the block gutter / drag handle area.
 *
 * Exposes:
 *  - "Turn into" submenu: converts the hovered block to another node type.
 *  - "Duplicate block": copies the current block and inserts it below.
 *
 * Integration: BlockGutter opens this menu on the drag-handle right-click
 * or by right-clicking a block inside the editor.  DocEditor renders it as
 * a portal at the root level.
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code2,
  Copy,
  ChevronRight,
  Info,
  ToggleLeft,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Turn-into target definitions ────────────────────────────────────────────

interface TurnIntoTarget {
  label: string;
  icon: React.ElementType;
  apply: (editor: Editor) => boolean;
  isActive: (editor: Editor) => boolean;
}

const TURN_INTO_TARGETS: TurnIntoTarget[] = [
  {
    label: "Text",
    icon: Type,
    apply: (ed) => ed.chain().focus().setParagraph().run(),
    isActive: (ed) =>
      ed.isActive("paragraph") &&
      !ed.isActive("taskItem") &&
      !ed.isActive("listItem"),
  },
  {
    label: "Heading 1",
    icon: Heading1,
    apply: (ed) => ed.chain().focus().setHeading({ level: 1 }).run(),
    isActive: (ed) => ed.isActive("heading", { level: 1 }),
  },
  {
    label: "Heading 2",
    icon: Heading2,
    apply: (ed) => ed.chain().focus().setHeading({ level: 2 }).run(),
    isActive: (ed) => ed.isActive("heading", { level: 2 }),
  },
  {
    label: "Heading 3",
    icon: Heading3,
    apply: (ed) => ed.chain().focus().setHeading({ level: 3 }).run(),
    isActive: (ed) => ed.isActive("heading", { level: 3 }),
  },
  {
    label: "Bullet List",
    icon: List,
    apply: (ed) => ed.chain().focus().toggleBulletList().run(),
    isActive: (ed) => ed.isActive("bulletList"),
  },
  {
    label: "Numbered List",
    icon: ListOrdered,
    apply: (ed) => ed.chain().focus().toggleOrderedList().run(),
    isActive: (ed) => ed.isActive("orderedList"),
  },
  {
    label: "Task List",
    icon: CheckSquare,
    apply: (ed) => ed.chain().focus().toggleTaskList().run(),
    isActive: (ed) => ed.isActive("taskList"),
  },
  {
    label: "Quote",
    icon: Quote,
    apply: (ed) => ed.chain().focus().toggleBlockquote().run(),
    isActive: (ed) => ed.isActive("blockquote"),
  },
  {
    label: "Code Block",
    icon: Code2,
    apply: (ed) => ed.chain().focus().setCodeBlock().run(),
    isActive: (ed) => ed.isActive("codeBlock"),
  },
  {
    label: "Callout",
    icon: MessageSquare,
    apply: (ed) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ed.chain().focus() as any).insertCallout("info").run(),
    isActive: (ed) => ed.isActive("callout"),
  },
  {
    label: "Toggle",
    icon: ToggleLeft,
    apply: (ed) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ed.chain().focus() as any).insertToggle().run(),
    isActive: (ed) => ed.isActive("toggle"),
  },
  {
    label: "Info Panel",
    icon: Info,
    apply: (ed) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ed.chain().focus() as any).insertInfoPanel("info").run(),
    isActive: (ed) => ed.isActive("infoPanel"),
  },
];

// ── Duplicate block helper ───────────────────────────────────────────────────

function duplicateBlock(editor: Editor): boolean {
  const { state } = editor;
  const { selection } = state;
  const { $anchor } = selection;

  // Find the top-level block at the cursor position
  let depth = $anchor.depth;
  while (depth > 1) depth--;

  const blockPos = $anchor.before(depth);
  const block = $anchor.node(depth);
  if (!block) return false;

  const insertPos = blockPos + block.nodeSize;
  const blockJson = block.toJSON();

  return editor
    .chain()
    .focus()
    .insertContentAt(insertPos, blockJson)
    .run();
}

// ── BlockMenu component ──────────────────────────────────────────────────────

export interface BlockMenuState {
  x: number;
  y: number;
  open: boolean;
}

interface BlockMenuProps {
  editor: Editor;
  state: BlockMenuState;
  onClose: () => void;
}

export function BlockMenu({ editor, state, onClose }: BlockMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape
  useEffect(() => {
    if (!state.open) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [state.open, onClose]);

  if (!state.open) return null;

  return createPortal(
    <div
      ref={menuRef}
      style={{ position: "fixed", top: state.y, left: state.x, zIndex: 60 }}
      className="w-52 overflow-hidden rounded-lg border bg-popover shadow-lg py-1 text-sm"
    >
      {/* Duplicate */}
      <button
        type="button"
        onClick={() => {
          duplicateBlock(editor);
          onClose();
        }}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span>Duplicate block</span>
      </button>

      <div className="my-1 h-px bg-border" />

      {/* Turn into submenu header */}
      <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Turn into
      </div>

      {TURN_INTO_TARGETS.map((target) => {
        const Icon = target.icon;
        const active = target.isActive(editor);
        return (
          <button
            key={target.label}
            type="button"
            onClick={() => {
              target.apply(editor);
              onClose();
            }}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors",
              active
                ? "bg-accent/60 text-accent-foreground"
                : "hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>{target.label}</span>
            {active && (
              <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
