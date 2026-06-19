/**
 * Docs feature — shared type re-exports.
 *
 * All Docs types live in @/types (global). This file re-exports them so
 * feature sub-modules (editor, shell, routes, collab, whiteboard) can import
 * from "@/features/docs" without knowing which root package defines the types.
 */

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
  // V2 page additions
  PageBacklink,
  PagePublicState,
  PageLinkRef,
  // V2 database
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
  // V2 search
  DocSearchResult,
  PageSearchHit,
  DatabaseSearchHit,
  // V2 public
  PublicPageRef,
  PublicPage,
  PublicPageTreeNode,
} from "@/types";

export type {
  CreateSpacePayload,
  UpdateSpacePayload,
  CreatePagePayload,
  UpdatePagePayload,
  MovePagePayload,
  CreateCommentPayload,
  // V2 payload types
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
