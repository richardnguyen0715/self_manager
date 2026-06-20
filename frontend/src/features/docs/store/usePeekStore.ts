"use client";

/**
 * usePeekStore — Zustand store for the Notion-style page peek side panel.
 *
 * The panel renders a read-only view of a referenced page that slides in from
 * the right when the user clicks a page-mention chip (@PageTitle) inside the
 * editor.  Clicking a mention inside the peek swaps peekPageId (nested peek
 * navigation).  Navigating to the full page or pressing Escape closes it.
 */

import { create } from "zustand";

interface PeekState {
  /** The page currently shown in the peek panel, or null when closed. */
  peekPageId: string | null;

  /** Open the peek panel for the given page id. Calling again swaps the page. */
  openPeek: (pageId: string) => void;

  /** Close the peek panel. */
  closePeek: () => void;
}

export const usePeekStore = create<PeekState>((set) => ({
  peekPageId: null,
  openPeek: (pageId: string) => set({ peekPageId: pageId }),
  closePeek: () => set({ peekPageId: null }),
}));
