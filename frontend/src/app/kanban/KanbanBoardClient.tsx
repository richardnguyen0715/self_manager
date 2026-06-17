"use client";

import { KanbanBoard } from "@/features/kanban";

/**
 * Thin client boundary so the Server Component page.tsx can export metadata
 * while the board's DnD, Zustand store, and TanStack Query hooks run client-side.
 */
export function KanbanBoardClient() {
  return <KanbanBoard />;
}
