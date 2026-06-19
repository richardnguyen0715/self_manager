"use client";

/**
 * BlockSelection — Notion-style whole-block multi-select via gutter drag.
 *
 * ── What it does ──────────────────────────────────────────────────────────────
 *
 *  1. Listens for mousedown events in the LEFT GUTTER ZONE of the editor
 *     (within ~60 px of the editor's left edge, where the drag-handle lives).
 *     A drag in that zone (or any drag that crosses a block boundary) enters
 *     "block-selection mode".
 *
 *  2. While dragging, the plugin tracks which consecutive top-level blocks
 *     are under the cursor and decorates them with a `.block-selected` CSS
 *     class (a subtle blue highlight added in globals.css).
 *
 *  3. On mouseup the selection range is stored in plugin state.  The
 *     ProseMirror text selection is set to span from the first to the last
 *     selected block so that built-in paste / copy operations work.
 *
 *  4. Backspace / Delete while block-selection is active deletes all selected
 *     blocks and clears the state.
 *
 *  5. Escape clears the block selection without deleting anything.
 *
 *  6. Cmd/Ctrl+A (first press) selects all content of the current block;
 *     (second press) selects all blocks.
 *
 *  7. Cross-block native text-drag (click inside block content, drag across
 *     blocks) is left entirely to ProseMirror — this plugin only activates
 *     when the mouse starts in the gutter zone.
 *
 * ── Architecture ──────────────────────────────────────────────────────────────
 *
 *  - A ProseMirror Plugin with mutable plugin-state (list of selected block
 *    positions) and decorations.
 *  - The gutter zone is detected by comparing the mousedown clientX to the
 *    editor DOM's left edge (editorRect.left).  We use a threshold of 72px
 *    (wider than the visible handle, so the user has a generous click target).
 *  - All DOM event listeners are added to `view.dom.parentElement` in the
 *    plugin's `view()` lifecycle so they are removed cleanly on destroy.
 *
 * ── Limitations ───────────────────────────────────────────────────────────────
 *
 *  - Only top-level blocks are selectable; nested blocks (inside Toggle,
 *    Callout, Columns …) are not individually selectable in this mode.
 *  - The ProseMirror text selection that backs the block selection spans the
 *    entire first→last block range, which means the browser may show a text
 *    cursor at the extremes. The visual decoration overrides the look.
 *  - Drag-to-reorder (via GlobalDragHandle) still works because that uses
 *    the drag-handle element's dragstart event, which is separate from the
 *    gutter mousedown this plugin intercepts.
 */

import { Extension } from "@tiptap/core";
import {
  Plugin,
  PluginKey,
  TextSelection,
} from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import type { Node as PmNode } from "@tiptap/pm/model";

// ── Plugin state type ─────────────────────────────────────────────────────────

interface BlockSelState {
  /** Positions (before-pos of each selected top-level block) */
  blocks: number[];
  /** Whether we are in gutter-drag mode right now */
  dragging: boolean;
}

const EMPTY_STATE: BlockSelState = { blocks: [], dragging: false };

// ── Plugin key (exported so other code can read plugin state) ─────────────────

export const blockSelectionKey = new PluginKey<BlockSelState>("blockSelection");

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return the index (0-based) and before-pos of the top-level block that
 *  contains document position `pos`.  Returns null if pos is at doc level. */
function topLevelInfo(
  doc: PmNode,
  pos: number,
): { index: number; beforePos: number } | null {
  let idx = 0;
  let offset = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const child = doc.child(i);
    if (offset + child.nodeSize > pos) {
      return { index: i, beforePos: offset };
    }
    offset += child.nodeSize;
    idx = i + 1;
  }
  // pos at very end of doc
  if (idx > 0) {
    let o2 = 0;
    for (let j = 0; j < doc.childCount - 1; j++) o2 += doc.child(j).nodeSize;
    return { index: doc.childCount - 1, beforePos: o2 };
  }
  return null;
}

/** Given a sorted list of before-positions, build a TextSelection from the
 *  very start of the first block to the very end of the last block. */
function selectionForBlocks(
  doc: PmNode,
  blocks: number[],
): TextSelection | null {
  if (blocks.length === 0) return null;
  const sorted = [...blocks].sort((a, b) => a - b);
  const first = sorted[0];
  const last  = sorted[sorted.length - 1];
  const lastNode = doc.nodeAt(last);
  if (!lastNode) return null;
  const from = first + 1;          // inside first block
  const to   = last + lastNode.nodeSize - 1; // inside last block
  if (from > to || from < 0 || to > doc.content.size) return null;
  return TextSelection.create(doc, from, to);
}

/** Build DecorationSet from a list of block before-positions. */
function buildDecorations(doc: PmNode, blocks: number[]): DecorationSet {
  if (blocks.length === 0) return DecorationSet.empty;
  const decos = blocks
    .map((pos) => {
      const node = doc.nodeAt(pos);
      if (!node) return null;
      return Decoration.node(pos, pos + node.nodeSize, {
        class: "block-selected",
      });
    })
    .filter((d): d is Decoration => d !== null);
  return DecorationSet.create(doc, decos);
}

// ── Transaction metadata keys ─────────────────────────────────────────────────

const META_SET    = "blockSelSet";    // value: BlockSelState
const META_CLEAR  = "blockSelClear";  // value: true

// ── The plugin ────────────────────────────────────────────────────────────────

function createBlockSelectionPlugin(): Plugin<BlockSelState> {
  return new Plugin<BlockSelState>({
    key: blockSelectionKey,

    // ── State ────────────────────────────────────────────────────────────────
    state: {
      init(): BlockSelState {
        return EMPTY_STATE;
      },
      apply(tr: Transaction, prev: BlockSelState): BlockSelState {
        const set = tr.getMeta(META_SET) as BlockSelState | undefined;
        if (set) return set;
        const clear = tr.getMeta(META_CLEAR) as boolean | undefined;
        if (clear) return EMPTY_STATE;
        // If the doc changed (non-block-sel transaction), clear selection
        if (tr.docChanged && prev.blocks.length > 0 && !set) {
          return EMPTY_STATE;
        }
        return prev;
      },
    },

    // ── Decorations ──────────────────────────────────────────────────────────
    props: {
      decorations(state: EditorState): DecorationSet {
        const pluginState = blockSelectionKey.getState(state);
        if (!pluginState || pluginState.blocks.length === 0) {
          return DecorationSet.empty;
        }
        return buildDecorations(state.doc, pluginState.blocks);
      },
    },

    // ── View (event listeners) ────────────────────────────────────────────────
    view(view: EditorView) {
      let anchorBlockIndex: number | null = null;
      let isGutterDrag = false;

      /** Width of the gutter zone to the left of the editor content. */
      const GUTTER_THRESHOLD = 72; // px from editor left edge

      function getEditorLeft(): number {
        return view.dom.getBoundingClientRect().left;
      }

      /** Get the viewport y-position hit-test → top-level block index */
      function blockIndexAtY(clientY: number): number | null {
        // Use posAtCoords to find PM position, then walk to depth-0 child
        const coord = { left: getEditorLeft() + GUTTER_THRESHOLD + 10, top: clientY };
        const pmPos = view.posAtCoords(coord);
        if (!pmPos) return null;
        const info = topLevelInfo(view.state.doc, pmPos.pos);
        return info ? info.index : null;
      }

      /** Collect before-positions for blocks index range [a, b] (inclusive). */
      function collectBlocks(fromIdx: number, toIdx: number): number[] {
        const lo = Math.min(fromIdx, toIdx);
        const hi = Math.max(fromIdx, toIdx);
        const positions: number[] = [];
        let offset = 0;
        for (let i = 0; i <= hi && i < view.state.doc.childCount; i++) {
          if (i >= lo) positions.push(offset);
          offset += view.state.doc.child(i).nodeSize;
        }
        return positions;
      }

      function dispatchBlockSel(blocks: number[], dragging: boolean) {
        const tr = view.state.tr;
        tr.setMeta(META_SET, { blocks, dragging } satisfies BlockSelState);
        // Also update the PM text selection to match
        if (blocks.length > 0) {
          const textSel = selectionForBlocks(view.state.doc, blocks);
          if (textSel) tr.setSelection(textSel);
        }
        view.dispatch(tr);
      }

      function clearBlockSel() {
        const ps = blockSelectionKey.getState(view.state);
        if (!ps || ps.blocks.length === 0) return;
        const tr = view.state.tr;
        tr.setMeta(META_CLEAR, true);
        view.dispatch(tr);
      }

      // ── mousedown ──────────────────────────────────────────────────────────
      function onMouseDown(e: MouseEvent) {
        if (e.button !== 0) return;
        const editorLeft = getEditorLeft();
        const inGutter = e.clientX < editorLeft + GUTTER_THRESHOLD;

        if (!inGutter) {
          // Click inside editor content → clear our block selection and
          // let ProseMirror handle it normally.
          clearBlockSel();
          isGutterDrag = false;
          return;
        }

        // Gutter click — start tracking
        const idx = blockIndexAtY(e.clientY);
        if (idx === null) {
          clearBlockSel();
          isGutterDrag = false;
          return;
        }

        e.preventDefault(); // prevent browser text-selection in gutter
        isGutterDrag = true;
        anchorBlockIndex = idx;

        // Focus the editor so keyboard events reach ProseMirror
        view.focus();

        const blocks = collectBlocks(idx, idx);
        dispatchBlockSel(blocks, true);
      }

      // ── mousemove ─────────────────────────────────────────────────────────
      function onMouseMove(e: MouseEvent) {
        if (!isGutterDrag || anchorBlockIndex === null) return;
        const idx = blockIndexAtY(e.clientY);
        if (idx === null) return;
        const blocks = collectBlocks(anchorBlockIndex, idx);
        dispatchBlockSel(blocks, true);
      }

      // ── mouseup ───────────────────────────────────────────────────────────
      function onMouseUp(_e: MouseEvent) {
        if (!isGutterDrag) return;
        isGutterDrag = false;
        anchorBlockIndex = null;
        // Keep the selection but mark dragging=false
        const ps = blockSelectionKey.getState(view.state);
        if (ps && ps.blocks.length > 0) {
          const tr = view.state.tr;
          tr.setMeta(META_SET, { blocks: ps.blocks, dragging: false } satisfies BlockSelState);
          view.dispatch(tr);
        }
      }

      const parent = view.dom.parentElement ?? document.body;
      parent.addEventListener("mousedown", onMouseDown);
      // mousemove / mouseup on window so drag continues outside editor
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);

      return {
        destroy() {
          parent.removeEventListener("mousedown", onMouseDown);
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        },
      };
    },
  });
}

// ── The Extension ─────────────────────────────────────────────────────────────

export const BlockSelection = Extension.create({
  name: "blockSelection",

  addProseMirrorPlugins() {
    return [createBlockSelectionPlugin()];
  },

  addKeyboardShortcuts() {
    // ── Delete / Backspace: delete all selected blocks ─────────────────────
    const deleteHandler = () => {
      const { state, view } = this.editor;
      const ps = blockSelectionKey.getState(state);
      if (!ps || ps.blocks.length === 0) return false;

      const sorted = [...ps.blocks].sort((a, b) => a - b);
      const first  = sorted[0];
      const last   = sorted[sorted.length - 1];
      const lastNode = state.doc.nodeAt(last);
      if (!lastNode) return false;
      const deleteEnd = last + lastNode.nodeSize;

      let tr = state.tr.delete(first, deleteEnd);
      tr.setMeta(META_CLEAR, true);

      // Place cursor at start of the range (clamped to doc size)
      const cursorPos = Math.min(first, tr.doc.content.size);
      try {
        tr.setSelection(TextSelection.near(tr.doc.resolve(cursorPos)));
      } catch {
        // If the doc is empty after deletion, place cursor at 0
        if (tr.doc.content.size >= 1) {
          tr.setSelection(TextSelection.near(tr.doc.resolve(1)));
        }
      }

      view.dispatch(tr);
      return true;
    };

    // ── Escape: clear block selection ────────────────────────────────────
    const escapeHandler = () => {
      const ps = blockSelectionKey.getState(this.editor.state);
      if (!ps || ps.blocks.length === 0) return false;
      const tr = this.editor.state.tr;
      tr.setMeta(META_CLEAR, true);
      this.editor.view.dispatch(tr);
      return true;
    };

    // ── Cmd/Ctrl+A: two-stage select ─────────────────────────────────────
    const selectAllHandler = () => {
      const { state, view } = this.editor;
      const ps = blockSelectionKey.getState(state);

      // If block selection already covers all blocks → do nothing (let
      // default browser Ctrl+A run, which selects all text).
      const totalBlocks = state.doc.childCount;
      if (ps && ps.blocks.length === totalBlocks) return false;

      // Stage 1: select all blocks
      const positions: number[] = [];
      let offset = 0;
      for (let i = 0; i < state.doc.childCount; i++) {
        positions.push(offset);
        offset += state.doc.child(i).nodeSize;
      }

      const tr = state.tr;
      tr.setMeta(META_SET, { blocks: positions, dragging: false } satisfies BlockSelState);
      const textSel = selectionForBlocks(state.doc, positions);
      if (textSel) tr.setSelection(textSel);
      view.dispatch(tr);
      return true;
    };

    return {
      Backspace: deleteHandler,
      Delete:    deleteHandler,
      Escape:    escapeHandler,
      "Mod-a":   selectAllHandler,
    };
  },
});

// ── Re-export META keys for use in DocEditor focus-refocus logic ──────────────
export { META_CLEAR as BLOCK_SEL_META_CLEAR };
