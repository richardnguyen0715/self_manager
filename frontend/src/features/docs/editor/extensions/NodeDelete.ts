/**
 * NodeDelete — keyboard extension that makes Backspace / Delete work
 * for NodeSelection and for a "whole-block" text selection that spans
 * exactly one top-level block.
 *
 * Why this is needed:
 *  • tiptap-extension-global-drag-handle sets a NodeSelection on the
 *    block when the user clicks the drag grip.  ProseMirror's default
 *    keymap (baseKeymap) does handle NodeSelection deletion, BUT the
 *    drag-handle DOM element is NOT part of the editor's contenteditable
 *    region.  Clicking it can pull browser focus away from the editor so
 *    the keydown event never reaches ProseMirror.
 *  • To fix the focus problem we also add a mousedown listener on the
 *    drag-handle (see DocEditor.tsx) that calls editor.view.focus() after
 *    the click, keeping ProseMirror as the active focus target.
 *  • As an extra safety net this Extension adds its own high-priority
 *    keymap handler that explicitly handles the two cases:
 *      1. NodeSelection     → deleteSelection + collapse cursor sensibly
 *      2. TextSelection covering all content of a single top-level block
 *         → delete that block
 */

import { Extension } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";
import { deleteSelection } from "@tiptap/pm/commands";

/**
 * Return the before-position of the top-level (depth-1) ancestor of `pos`,
 * or null if `pos` is already at doc level.
 */
function topLevelBefore(state: EditorState, pos: number): number | null {
  const $pos = state.doc.resolve(pos);
  if ($pos.depth === 0) return null;
  // Walk to depth 1
  let d = $pos.depth;
  while (d > 1) d--;
  return $pos.before(d);
}

export const NodeDelete = Extension.create({
  name: "nodeDelete",

  addKeyboardShortcuts() {
    const handler = () => {
      const { state, view } = this.editor;
      const { selection } = state;

      // ── Case 1: NodeSelection ──────────────────────────────────────────────
      if (selection instanceof NodeSelection) {
        // deleteSelection removes the selected node and sets cursor at the
        // position where the node was.
        const dispatched = deleteSelection(state, view.dispatch);
        return dispatched;
      }

      // ── Case 2: TextSelection that covers exactly one top-level block ──────
      // This catches "select all text in a paragraph via click-drag then Delete"
      // but must NOT fire for partial in-block selections (that's normal editing).
      const { $from, $to, empty } = selection as TextSelection;
      if (empty) return false; // normal cursor → let ProseMirror handle it

      const fromBlock = topLevelBefore(state, $from.pos);
      const toBlock   = topLevelBefore(state, $to.pos);

      if (fromBlock === null || toBlock === null) return false;

      // Same top-level block?
      if (fromBlock === toBlock) {
        const block = state.doc.resolve(fromBlock + 1).parent;
        // Check if the whole block content is selected
        const blockStart = fromBlock + 1;
        const blockEnd   = fromBlock + block.nodeSize - 1;
        if ($from.pos === blockStart && $to.pos === blockEnd) {
          // Delete the entire block
          const tr = state.tr.delete(fromBlock, fromBlock + block.nodeSize);
          // Leave cursor at the same offset (clamped)
          const cursorPos = Math.min(fromBlock, tr.doc.content.size);
          tr.setSelection(TextSelection.near(tr.doc.resolve(cursorPos)));
          view.dispatch(tr);
          return true;
        }
      }

      return false;
    };

    return {
      Backspace: handler,
      Delete:    handler,
    };
  },
});
