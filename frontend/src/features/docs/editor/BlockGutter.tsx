"use client";

/**
 * BlockGutter — renders a "+" add-block button that tracks the position of
 * the GlobalDragHandle's `.drag-handle` element.
 *
 * GlobalDragHandle appends a single `div.drag-handle` to the editor's parent
 * element and repositions it on every block hover using inline `style.top` /
 * `style.left`.  This component watches those style mutations with a
 * MutationObserver and renders a "+" button immediately to the left of the
 * handle (both are fixed-position so they work even inside a scrolling pane).
 *
 * Clicking "+" inserts a new empty paragraph right after the hovered block
 * and types "/" so the slash-command menu opens automatically.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { Plus } from "lucide-react";

interface BlockGutterProps {
  editor: Editor | null;
  /** Direct wrapper of EditorContent — GlobalDragHandle appends its element here. */
  editorWrapperRef: React.RefObject<HTMLDivElement | null>;
}

interface HandlePos {
  top: number;
  left: number;
  visible: boolean;
}

export function BlockGutter({ editor, editorWrapperRef }: BlockGutterProps) {
  const [pos, setPos] = useState<HandlePos>({ top: 0, left: 0, visible: false });
  const handleElRef = useRef<HTMLElement | null>(null);
  // Track whether the "+" button itself is hovered so we can keep it visible
  const addBtnHoveredRef = useRef(false);

  // ── Find and observe the drag-handle element ────────────────────────────────
  useEffect(() => {
    const wrapper = editorWrapperRef.current;
    if (!wrapper) return;

    let mo: MutationObserver | null = null;

    const sync = (el: HTMLElement) => {
      // The extension hides the handle by setting display:none or opacity:0
      const s = el.style;
      const hidden =
        s.display === "none" ||
        s.visibility === "hidden" ||
        s.opacity === "0" ||
        el.classList.contains("hidden");

      if (hidden && !addBtnHoveredRef.current) {
        setPos((p) => ({ ...p, visible: false }));
        return;
      }

      const top = parseFloat(s.top) || 0;
      const left = parseFloat(s.left) || 0;
      if (top > 0 || left > 0) {
        setPos({ top, left, visible: true });
      }
    };

    const attach = (el: HTMLElement) => {
      handleElRef.current = el;
      sync(el);
      mo = new MutationObserver(() => sync(el));
      mo.observe(el, {
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    };

    // The drag-handle element is created lazily when the editor first renders;
    // poll until we find it, then stop.
    const found = wrapper.querySelector<HTMLElement>(".drag-handle");
    if (found) {
      attach(found);
    } else {
      const wrapperMo = new MutationObserver(() => {
        const el = wrapper.querySelector<HTMLElement>(".drag-handle");
        if (el) {
          wrapperMo.disconnect();
          attach(el);
        }
      });
      wrapperMo.observe(wrapper, { childList: true, subtree: true });
      mo = wrapperMo;
    }

    return () => {
      mo?.disconnect();
    };
  }, [editorWrapperRef]);

  // ── Insert paragraph + "/" to trigger slash menu ────────────────────────────
  const handleAddBlock = () => {
    if (!editor || !handleElRef.current) return;

    const el = handleElRef.current;
    const handleTop = parseFloat(el.style.top) || 0;
    // Sample a point slightly inside the editor content to find which block
    // the handle is pointing at.  The handle sits left of the content; add 40px.
    const handleLeft = parseFloat(el.style.left) || 0;
    const view = editor.view;

    const pmPos = view.posAtCoords({
      left: handleLeft + 40,
      top: handleTop + 8,
    });

    let insertAt: number;

    if (pmPos != null) {
      const $pos = view.state.doc.resolve(pmPos.pos);
      // Walk up to depth 1 — the top-level block
      let depth = $pos.depth;
      while (depth > 1) depth--;
      const blockNode = $pos.node(depth);
      insertAt = $pos.before(depth) + (blockNode?.nodeSize ?? 1);
    } else {
      // Fallback: end of document
      insertAt = editor.state.doc.content.size;
    }

    editor
      .chain()
      .focus()
      .insertContentAt(insertAt, { type: "paragraph" })
      .setTextSelection(insertAt + 1)
      .insertContent("/")
      .run();
  };

  // Don't render until position is known
  if (!pos.visible) return null;

  // The "+" button sits 28px to the left of the drag-handle grip
  const btnLeft = pos.left - 28;
  const btnTop = pos.top;

  return createPortal(
    <button
      type="button"
      aria-label="Add block below"
      onMouseDown={(e) => {
        // Keep editor focused; don't let the button steal focus
        e.preventDefault();
      }}
      onMouseEnter={() => {
        addBtnHoveredRef.current = true;
      }}
      onMouseLeave={() => {
        addBtnHoveredRef.current = false;
      }}
      onClick={handleAddBlock}
      style={{
        position: "fixed",
        top: btnTop,
        left: btnLeft,
        zIndex: 50,
        // dimensions match the drag-handle
        width: 24,
        height: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 4,
        border: "none",
        padding: 0,
        background: "transparent",
        color: "hsl(var(--muted-foreground) / 0.4)",
        cursor: "pointer",
        transition: "background-color 0.15s, color 0.15s",
      }}
      onFocus={(e) =>
        (e.currentTarget.style.color = "hsl(var(--muted-foreground))")
      }
      onBlur={(e) =>
        (e.currentTarget.style.color = "hsl(var(--muted-foreground) / 0.4)")
      }
      className="notion-add-btn"
    >
      <Plus
        style={{ width: 14, height: 14, pointerEvents: "none" }}
      />
    </button>,
    document.body,
  );
}
