/**
 * Docs feature — public barrel.
 *
 * All other doc sub-feature modules (editor, shell, routes, collab, whiteboard)
 * should import data hooks and shared types from this barrel:
 *
 *   import { useSpaces, usePage, docsKeys } from "@/features/docs";
 *   import type { Space, Page, PageTreeNode } from "@/features/docs";
 */

// ── Data hooks ─────────────────────────────────────────────────────────────────
export {
  docsKeys,
  // Space
  useSpaces,
  useSpace,
  useCreateSpace,
  useUpdateSpace,
  useDeleteSpace,
  // Page
  usePageTree,
  usePage,
  useSearchPages,
  useCreatePage,
  useUpdatePage,
  useDeletePage,
  usePublishPage,
  useMovePage,
  // Versions
  usePageVersions,
  usePageVersion,
  useSaveVersion,
  useRestoreVersion,
  // Comments
  usePageComments,
  useCreateComment,
  useDeleteComment,
  // Upload
  useUploadPageImage,
} from "./hooks/useDocs";

// ── Payload types ──────────────────────────────────────────────────────────────
export type {
  CreateSpacePayload,
  UpdateSpacePayload,
  CreatePagePayload,
  UpdatePagePayload,
  MovePagePayload,
  CreateCommentPayload,
} from "./hooks/useDocs";

// ── Shared entity types (re-exported from @/types via types.ts) ────────────────
export type {
  PageKind,
  PageStatus,
  Space,
  TipTapDoc,
  ExcalidrawScene,
  Page,
  PageTreeNode,
  PageSearchResult,
  PageVersionSummary,
  PageVersion,
  PageComment,
  PageImageUploadResponse,
} from "./types";
