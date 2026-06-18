"use client";

import { SprintBoard } from "@/features/board";

/**
 * Thin "use client" boundary so the Server Component page.tsx can
 * export metadata while DnD, Zustand store, and TanStack Query hooks
 * run client-side.
 */
export function SprintBoardClient() {
  return <SprintBoard />;
}
