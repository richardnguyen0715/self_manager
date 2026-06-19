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
} from "@/types";

export type {
  CreateSpacePayload,
  UpdateSpacePayload,
  CreatePagePayload,
  UpdatePagePayload,
  MovePagePayload,
  CreateCommentPayload,
} from "./hooks/useDocs";
