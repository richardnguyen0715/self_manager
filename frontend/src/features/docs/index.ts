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
  useUnpublishPage,
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
  // V2: Page meta
  useTogglePagePublic,
  useUploadPageCover,
  usePageTemplates,
  useCreateFromTemplate,
  usePageBacklinks,
  usePageLinks,
  // V2: Databases
  useDatabases,
  useDatabase,
  useCreateDatabase,
  useUpdateDatabase,
  useDeleteDatabase,
  useDatabaseColumns,
  useCreateColumn,
  useUpdateColumn,
  useDeleteColumn,
  useDatabaseRows,
  useCreateRow,
  useUpdateRow,
  useBatchUpdateRows,
  useDeleteRow,
  useDatabaseViews,
  useCreateView,
  useUpdateView,
  useDeleteView,
  useViewRows,
  // V2: Docs search
  useDocsSearch,
  // V2: Public (unauthenticated)
  usePublicPage,
  usePublicPageTree,
} from "./hooks/useDocs";

// ── Payload types ──────────────────────────────────────────────────────────────
export type {
  CreateSpacePayload,
  UpdateSpacePayload,
  CreatePagePayload,
  UpdatePagePayload,
  MovePagePayload,
  CreateCommentPayload,
  // V2
  TogglePagePublicPayload,
  CreateFromTemplatePayload,
  CreateDatabasePayload,
  UpdateDatabasePayload,
  CreateColumnPayload,
  UpdateColumnPayload,
  CreateRowPayload,
  UpdateRowPayload,
  BatchRowUpdate,
  BatchUpdateRowsPayload,
  CreateViewPayload,
  UpdateViewPayload,
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
  // V2
  PageBacklink,
  PagePublicState,
  PageLinkRef,
  Database,
  DatabaseColumn,
  DatabaseColumnType,
  DatabaseRow,
  DatabaseView,
  DatabaseViewType,
  DatabaseViewConfig,
  DatabaseDetail,
  BoardGroup,
  ViewRowsResponse,
  SelectOption,
  ViewFilter,
  ViewSort,
  DocSearchResult,
  PageSearchHit,
  DatabaseSearchHit,
  PublicPageRef,
  PublicPage,
  PublicPageTreeNode,
} from "./types";
