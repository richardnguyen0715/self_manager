"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api, apiClient } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type {
  Space,
  Page,
  PageTreeNode,
  PageSearchResult,
  PageVersionSummary,
  PageVersion,
  PageComment,
  PageImageUploadResponse,
  TipTapDoc,
  ExcalidrawScene,
  PageKind,
  // V2 types
  PageBacklink,
  PagePublicState,
  PageLinkRef,
  Database,
  DatabaseColumn,
  DatabaseColumnType,
  DatabaseRow,
  DatabaseView,
  DatabaseViewConfig,
  DatabaseDetail,
  ViewRowsResponse,
  SelectOption,
  DocSearchResult,
  PublicPage,
  PublicPageTreeNode,
} from "@/types";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const docsKeys = {
  // Spaces
  spaces: {
    all: ["spaces"] as const,
    lists: () => [...docsKeys.spaces.all, "list"] as const,
    list: (projectId?: string) =>
      [...docsKeys.spaces.lists(), { projectId }] as const,
    details: () => [...docsKeys.spaces.all, "detail"] as const,
    detail: (id: string) => [...docsKeys.spaces.details(), id] as const,
  },

  // Pages
  pages: {
    all: ["pages"] as const,
    trees: () => [...docsKeys.pages.all, "tree"] as const,
    tree: (spaceId: string) =>
      [...docsKeys.pages.trees(), spaceId] as const,
    details: () => [...docsKeys.pages.all, "detail"] as const,
    detail: (id: string) => [...docsKeys.pages.details(), id] as const,
    search: (q: string, spaceId?: string) =>
      [...docsKeys.pages.all, "search", { q, spaceId }] as const,
    versions: (pageId: string) =>
      [...docsKeys.pages.detail(pageId), "versions"] as const,
    version: (pageId: string, versionId: string) =>
      [...docsKeys.pages.versions(pageId), versionId] as const,
    comments: (pageId: string) =>
      [...docsKeys.pages.detail(pageId), "comments"] as const,
    // V2
    backlinks: (pageId: string) =>
      [...docsKeys.pages.detail(pageId), "backlinks"] as const,
    links: (pageId: string) =>
      [...docsKeys.pages.detail(pageId), "links"] as const,
    templates: (spaceId?: string) =>
      [...docsKeys.pages.all, "templates", { spaceId }] as const,
  },

  // V2: Databases
  databases: {
    all: ["databases"] as const,
    lists: () => [...docsKeys.databases.all, "list"] as const,
    list: (spaceId: string) =>
      [...docsKeys.databases.lists(), { spaceId }] as const,
    details: () => [...docsKeys.databases.all, "detail"] as const,
    detail: (id: string) => [...docsKeys.databases.details(), id] as const,
    columns: (dbId: string) =>
      [...docsKeys.databases.detail(dbId), "columns"] as const,
    rows: (dbId: string) =>
      [...docsKeys.databases.detail(dbId), "rows"] as const,
    views: (dbId: string) =>
      [...docsKeys.databases.detail(dbId), "views"] as const,
    viewRows: (dbId: string, viewId: string) =>
      [...docsKeys.databases.detail(dbId), "views", viewId, "rows"] as const,
  },

  // V2: Docs search
  search: {
    all: ["docsSearch"] as const,
    query: (q: string, spaceId?: string) =>
      [...docsKeys.search.all, { q, spaceId }] as const,
  },

  // V2: Public pages (unauthenticated — lives in a separate key space)
  public: {
    all: ["publicDocs"] as const,
    page: (slug: string) => [...docsKeys.public.all, "page", slug] as const,
    tree: (slug: string) => [...docsKeys.public.all, "tree", slug] as const,
  },
} as const;

// ─── Request payload types (local; not in @/types) ────────────────────────────

export interface CreateSpacePayload {
  name: string;
  icon?: string;
  description?: string;
  project_id?: string;
}

export interface UpdateSpacePayload {
  name?: string;
  icon?: string;
  description?: string;
  project_id?: string | null;
}

export interface CreatePagePayload {
  space_id: string;
  parent_id?: string;
  title?: string;
  kind?: PageKind;
}

export interface UpdatePagePayload {
  title?: string;
  content?: TipTapDoc;
  kind?: PageKind;
  excalidraw?: ExcalidrawScene;
  position?: number;
  parent_id?: string | null;
  // V2 additions
  icon?: string | null;
  cover_url?: string | null;
}

export interface MovePagePayload {
  id: string;
  parent_id?: string | null;
  position: number;
}

export interface CreateCommentPayload {
  body: string;
}

// ─── V2 payload types ─────────────────────────────────────────────────────────

export interface TogglePagePublicPayload {
  public: boolean;
}

export interface CreateFromTemplatePayload {
  space_id: string;
  parent_id?: string;
  template_id: string;
  title?: string;
}

// Database payloads
export interface CreateDatabasePayload {
  space_id: string;
  title?: string;
  icon?: string;
}

export interface UpdateDatabasePayload {
  title?: string;
  icon?: string | null;
}

export interface CreateColumnPayload {
  name: string;
  type: DatabaseColumnType;
  options?: SelectOption[];
  position?: number;
}

export interface UpdateColumnPayload {
  name?: string;
  type?: DatabaseColumnType;
  options?: SelectOption[];
  position?: number;
}

export interface CreateRowPayload {
  values?: Record<string, unknown>;
  position?: number;
}

export interface UpdateRowPayload {
  values?: Record<string, unknown>;
  position?: number;
}

export interface BatchRowUpdate {
  id: string;
  values: Record<string, unknown>;
}

export interface BatchUpdateRowsPayload {
  updates: BatchRowUpdate[];
}

export interface CreateViewPayload {
  name: string;
  type: "table" | "board";
  config?: DatabaseViewConfig;
  position?: number;
}

export interface UpdateViewPayload {
  name?: string;
  config?: DatabaseViewConfig;
  position?: number;
}

// ─── Space hooks ──────────────────────────────────────────────────────────────

/** List all spaces for the authenticated user. Optional project filter. */
export function useSpaces(projectId?: string) {
  return useQuery({
    queryKey: docsKeys.spaces.list(projectId),
    queryFn: () =>
      api.get<Space[]>(API_ENDPOINTS.SPACES, projectId ? { project_id: projectId } : undefined),
  });
}

/** Fetch a single space by ID. */
export function useSpace(id: string) {
  return useQuery({
    queryKey: docsKeys.spaces.detail(id),
    queryFn: () => api.get<Space>(API_ENDPOINTS.SPACE_BY_ID(id)),
    enabled: Boolean(id),
  });
}

/** Create a new space. Invalidates the spaces list. */
export function useCreateSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSpacePayload) =>
      api.post<Space>(API_ENDPOINTS.SPACES, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: docsKeys.spaces.lists() });
    },
  });
}

/** Update an existing space. Invalidates the list and the space detail. */
export function useUpdateSpace(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSpacePayload) =>
      api.patch<Space>(API_ENDPOINTS.SPACE_BY_ID(id), payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(docsKeys.spaces.detail(id), updated);
      queryClient.invalidateQueries({ queryKey: docsKeys.spaces.lists() });
    },
  });
}

/** Delete a space (cascades all pages). */
export function useDeleteSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(API_ENDPOINTS.SPACE_BY_ID(id)),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: docsKeys.spaces.detail(id) });
      queryClient.invalidateQueries({ queryKey: docsKeys.spaces.lists() });
    },
  });
}

// ─── Page tree / list hooks ───────────────────────────────────────────────────

/** Fetch the page tree for a space (nested PageTreeNode[]). */
export function usePageTree(spaceId: string) {
  return useQuery({
    queryKey: docsKeys.pages.tree(spaceId),
    queryFn: () =>
      api.get<PageTreeNode[]>(API_ENDPOINTS.PAGES, { space_id: spaceId }),
    enabled: Boolean(spaceId),
  });
}

/** Fetch a single page (full row including content / excalidraw). */
export function usePage(id: string) {
  return useQuery({
    queryKey: docsKeys.pages.detail(id),
    queryFn: () => api.get<Page>(API_ENDPOINTS.PAGE_BY_ID(id)),
    enabled: Boolean(id),
  });
}

/** Search pages by title (pg_trgm). Optional space scope. */
export function useSearchPages(q: string, spaceId?: string) {
  return useQuery({
    queryKey: docsKeys.pages.search(q, spaceId),
    queryFn: () =>
      api.get<PageSearchResult[]>(
        API_ENDPOINTS.PAGES_SEARCH,
        spaceId ? { q, space_id: spaceId } : { q },
      ),
    enabled: q.trim().length > 0,
  });
}

// ─── Page mutation hooks ──────────────────────────────────────────────────────

/** Create a new page (draft, empty content). */
export function useCreatePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePagePayload) =>
      api.post<Page>(API_ENDPOINTS.PAGES, payload),
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: docsKeys.pages.tree(created.space_id),
      });
    },
  });
}

/**
 * Update page fields (autosave path: title, content, excalidraw, position,
 * parent_id). Bumps `updated_at` on the backend.
 */
export function useUpdatePage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdatePagePayload) =>
      api.patch<Page>(API_ENDPOINTS.PAGE_BY_ID(id), payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(docsKeys.pages.detail(id), updated);
      queryClient.invalidateQueries({
        queryKey: docsKeys.pages.tree(updated.space_id),
      });
    },
  });
}

/** Delete a page (cascades children, versions, and comments). */
export function useDeletePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, spaceId }: { id: string; spaceId: string }) =>
      api.delete(API_ENDPOINTS.PAGE_BY_ID(id)).then(() => ({ id, spaceId })),
    onSuccess: ({ id, spaceId }) => {
      queryClient.removeQueries({ queryKey: docsKeys.pages.detail(id) });
      queryClient.invalidateQueries({
        queryKey: docsKeys.pages.tree(spaceId),
      });
    },
  });
}

/**
 * Publish a page: sets status → 'published', records `published_at`,
 * and creates a PageVersion snapshot automatically.
 */
export function usePublishPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<Page>(API_ENDPOINTS.PAGE_PUBLISH(id)),
    onSuccess: (updated) => {
      queryClient.setQueryData(docsKeys.pages.detail(updated.id), updated);
      queryClient.invalidateQueries({
        queryKey: docsKeys.pages.tree(updated.space_id),
      });
      queryClient.invalidateQueries({
        queryKey: docsKeys.pages.versions(updated.id),
      });
    },
  });
}

/**
 * Unpublish a page: reverts status → 'draft' and clears `published_at`.
 */
export function useUnpublishPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<Page>(API_ENDPOINTS.PAGE_UNPUBLISH(id)),
    onSuccess: (updated) => {
      queryClient.setQueryData(docsKeys.pages.detail(updated.id), updated);
      queryClient.invalidateQueries({
        queryKey: docsKeys.pages.tree(updated.space_id),
      });
    },
  });
}

/**
 * Move a page to a new parent / position within the same space.
 * The backend rejects cross-space moves and cycle-creating reparents (422).
 */
export function useMovePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MovePagePayload) =>
      api.post<Page>(API_ENDPOINTS.PAGE_MOVE, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(docsKeys.pages.detail(updated.id), updated);
      queryClient.invalidateQueries({
        queryKey: docsKeys.pages.tree(updated.space_id),
      });
    },
  });
}

// ─── Version hooks ────────────────────────────────────────────────────────────

/** List version summaries for a page (newest first, no content body). */
export function usePageVersions(pageId: string) {
  return useQuery({
    queryKey: docsKeys.pages.versions(pageId),
    queryFn: () =>
      api.get<PageVersionSummary[]>(API_ENDPOINTS.PAGE_VERSIONS(pageId)),
    enabled: Boolean(pageId),
  });
}

/** Fetch a single version including its full content blob. */
export function usePageVersion(pageId: string, versionId: string) {
  return useQuery({
    queryKey: docsKeys.pages.version(pageId, versionId),
    queryFn: () =>
      api.get<PageVersion>(API_ENDPOINTS.PAGE_VERSION_BY_ID(pageId, versionId)),
    enabled: Boolean(pageId) && Boolean(versionId),
  });
}

/** Explicitly snapshot the current page content as a named version. */
export function useSaveVersion(pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<PageVersionSummary>(API_ENDPOINTS.PAGE_VERSIONS(pageId)),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: docsKeys.pages.versions(pageId),
      });
    },
  });
}

/**
 * Restore a version: copies its title + content onto the live page
 * (backend snapshots the current state first).
 */
export function useRestoreVersion(pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) =>
      api.post<Page>(API_ENDPOINTS.PAGE_VERSION_RESTORE(pageId, versionId)),
    onSuccess: (restored) => {
      queryClient.setQueryData(docsKeys.pages.detail(pageId), restored);
      queryClient.invalidateQueries({
        queryKey: docsKeys.pages.versions(pageId),
      });
    },
  });
}

// ─── Comment hooks ────────────────────────────────────────────────────────────

/** List flat comments for a page (oldest first). */
export function usePageComments(pageId: string) {
  return useQuery({
    queryKey: docsKeys.pages.comments(pageId),
    queryFn: () =>
      api.get<PageComment[]>(API_ENDPOINTS.PAGE_COMMENTS(pageId)),
    enabled: Boolean(pageId),
  });
}

/** Post a new comment on a page. */
export function useCreateComment(pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCommentPayload) =>
      api.post<PageComment>(API_ENDPOINTS.PAGE_COMMENTS(pageId), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: docsKeys.pages.comments(pageId),
      });
    },
  });
}

/** Delete a comment (author only; backend returns 204). */
export function useDeleteComment(pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      api.delete(API_ENDPOINTS.PAGE_COMMENT_BY_ID(pageId, commentId)),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: docsKeys.pages.comments(pageId),
      });
    },
  });
}

// ─── Image upload ─────────────────────────────────────────────────────────────

/**
 * Upload an image file for embedding in a page. Returns `{ url }` pointing
 * to `/uploads/<file>` which is stored as the `src` of a TipTap image node.
 * Uses raw `apiClient` with a FormData body (multipart/form-data).
 */
export function useUploadPageImage(pageId: string) {
  return useMutation({
    mutationFn: async (file: File): Promise<PageImageUploadResponse> => {
      const formData = new FormData();
      formData.append("file", file);

      // apiClient defaults to JSON; for multipart we use fetch directly with
      // the auth token forwarded. Import getAccessToken to avoid re-exporting
      // the api module as a wildcard.
      const { getAccessToken } = await import("@/lib/api");
      const token = getAccessToken();
      const API_BASE_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

      const response = await fetch(
        `${API_BASE_URL}${API_ENDPOINTS.PAGE_IMAGES(pageId)}`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        },
      );

      if (!response.ok) {
        let msg = `Upload failed with status ${response.status}`;
        try {
          const err = await response.json();
          if (err.message) msg = err.message;
        } catch {
          // ignore parse error
        }
        throw new Error(msg);
      }

      return response.json() as Promise<PageImageUploadResponse>;
    },
  });
}

// ─── V2: Page meta hooks ──────────────────────────────────────────────────────

/**
 * Toggle a page's public/private state.
 * Toggling true mints a slug from the title; toggling false keeps the slug
 * but sets is_public = false.
 */
export function useTogglePagePublic(pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TogglePagePublicPayload) =>
      api.post<PagePublicState>(API_ENDPOINTS.PAGE_PUBLIC(pageId), payload),
    onSuccess: (updated) => {
      // Merge the public state fields into the cached Page detail
      queryClient.setQueryData<Page>(
        docsKeys.pages.detail(pageId),
        (prev) => prev ? { ...prev, ...updated } : prev,
      );
    },
  });
}

/**
 * Upload a cover image for a page (multipart/form-data).
 * Returns { url } and updates cover_url on the cached page.
 */
export function useUploadPageCover(pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<{ url: string }> => {
      const formData = new FormData();
      formData.append("file", file);
      const { getAccessToken } = await import("@/lib/api");
      const token = getAccessToken();
      const API_BASE_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      const response = await fetch(
        `${API_BASE_URL}${API_ENDPOINTS.PAGE_COVER(pageId)}`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        },
      );
      if (!response.ok) {
        let msg = `Cover upload failed with status ${response.status}`;
        try {
          const err = await response.json();
          if (err.message) msg = err.message;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      return response.json() as Promise<{ url: string }>;
    },
    onSuccess: ({ url }) => {
      queryClient.setQueryData<Page>(
        docsKeys.pages.detail(pageId),
        (prev) => prev ? { ...prev, cover_url: url } : prev,
      );
    },
  });
}

/** Fetch all template pages. Optional space scope. */
export function usePageTemplates(spaceId?: string) {
  return useQuery({
    queryKey: docsKeys.pages.templates(spaceId),
    queryFn: () =>
      api.get<Page[]>(
        API_ENDPOINTS.PAGES_TEMPLATES,
        spaceId ? { space_id: spaceId } : undefined,
      ),
  });
}

/** Create a new page by deep-copying a template's content. */
export function useCreateFromTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateFromTemplatePayload) =>
      api.post<Page>(API_ENDPOINTS.PAGE_FROM_TEMPLATE, payload),
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: docsKeys.pages.tree(created.space_id),
      });
    },
  });
}

/**
 * Fetch backlinks for a page: pages that contain an @page mention pointing
 * at this page.
 */
export function usePageBacklinks(pageId: string) {
  return useQuery({
    queryKey: docsKeys.pages.backlinks(pageId),
    queryFn: () =>
      api.get<PageBacklink[]>(API_ENDPOINTS.PAGE_BACKLINKS(pageId)),
    enabled: Boolean(pageId),
  });
}

/** Fetch outbound page links (optional — for editor validation). */
export function usePageLinks(pageId: string) {
  return useQuery({
    queryKey: docsKeys.pages.links(pageId),
    queryFn: () =>
      api.get<PageLinkRef[]>(API_ENDPOINTS.PAGE_LINKS(pageId)),
    enabled: Boolean(pageId),
  });
}

// ─── V2: Database hooks ───────────────────────────────────────────────────────

/** List databases in a space. */
export function useDatabases(spaceId: string) {
  return useQuery({
    queryKey: docsKeys.databases.list(spaceId),
    queryFn: () =>
      api.get<Database[]>(API_ENDPOINTS.DATABASES, { space_id: spaceId }),
    enabled: Boolean(spaceId),
  });
}

/**
 * Fetch a database with its columns and views.
 * Returns DatabaseDetail = { database, columns[], views[] }.
 */
export function useDatabase(id: string) {
  return useQuery({
    queryKey: docsKeys.databases.detail(id),
    queryFn: () =>
      api.get<DatabaseDetail>(API_ENDPOINTS.DATABASE_BY_ID(id)),
    enabled: Boolean(id),
  });
}

/** Create a database. Seeds 1 "Name" text column + 1 default table view. */
export function useCreateDatabase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDatabasePayload) =>
      api.post<Database>(API_ENDPOINTS.DATABASES, payload),
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: docsKeys.databases.list(created.space_id),
      });
    },
  });
}

/** Update a database's title or icon. */
export function useUpdateDatabase(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateDatabasePayload) =>
      api.patch<Database>(API_ENDPOINTS.DATABASE_BY_ID(id), payload),
    onSuccess: (updated) => {
      // Update detail cache (merge into DatabaseDetail.database)
      queryClient.setQueryData<DatabaseDetail>(
        docsKeys.databases.detail(id),
        (prev) => prev ? { ...prev, database: updated } : prev,
      );
      queryClient.invalidateQueries({
        queryKey: docsKeys.databases.list(updated.space_id),
      });
    },
  });
}

/** Delete a database (cascades columns, rows, views). */
export function useDeleteDatabase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; spaceId: string }) =>
      api.delete(API_ENDPOINTS.DATABASE_BY_ID(id)),
    onSuccess: (_data, { id, spaceId }) => {
      queryClient.removeQueries({ queryKey: docsKeys.databases.detail(id) });
      queryClient.invalidateQueries({
        queryKey: docsKeys.databases.list(spaceId),
      });
    },
  });
}

// ─── V2: Database column hooks ────────────────────────────────────────────────

/** Fetch columns for a database (position order). */
export function useDatabaseColumns(dbId: string) {
  return useQuery({
    queryKey: docsKeys.databases.columns(dbId),
    queryFn: () =>
      api.get<DatabaseColumn[]>(API_ENDPOINTS.DATABASE_COLUMNS(dbId)),
    enabled: Boolean(dbId),
  });
}

/** Add a column to a database. */
export function useCreateColumn(dbId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateColumnPayload) =>
      api.post<DatabaseColumn>(API_ENDPOINTS.DATABASE_COLUMNS(dbId), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: docsKeys.databases.columns(dbId),
      });
      // Invalidate full detail so DatabaseView rebuilds the header
      queryClient.invalidateQueries({
        queryKey: docsKeys.databases.detail(dbId),
      });
    },
  });
}

/** Update a column (rename, retype, reorder, or edit options). */
export function useUpdateColumn(dbId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ colId, payload }: { colId: string; payload: UpdateColumnPayload }) =>
      api.patch<DatabaseColumn>(
        API_ENDPOINTS.DATABASE_COLUMN_BY_ID(dbId, colId),
        payload,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: docsKeys.databases.columns(dbId),
      });
      queryClient.invalidateQueries({
        queryKey: docsKeys.databases.detail(dbId),
      });
    },
  });
}

/**
 * Delete a column (also strips its key from every row's values jsonb —
 * handled server-side).
 */
export function useDeleteColumn(dbId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (colId: string) =>
      api.delete(API_ENDPOINTS.DATABASE_COLUMN_BY_ID(dbId, colId)),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: docsKeys.databases.columns(dbId),
      });
      // Rows may have changed (key stripped) — invalidate
      queryClient.invalidateQueries({
        queryKey: docsKeys.databases.rows(dbId),
      });
      queryClient.invalidateQueries({
        queryKey: docsKeys.databases.detail(dbId),
      });
    },
  });
}

// ─── V2: Database row hooks ───────────────────────────────────────────────────

/** Fetch all rows for a database (raw, position order, no filter/sort). */
export function useDatabaseRows(dbId: string) {
  return useQuery({
    queryKey: docsKeys.databases.rows(dbId),
    queryFn: () =>
      api.get<DatabaseRow[]>(API_ENDPOINTS.DATABASE_ROWS(dbId)),
    enabled: Boolean(dbId),
  });
}

/** Create a new row. */
export function useCreateRow(dbId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRowPayload) =>
      api.post<DatabaseRow>(API_ENDPOINTS.DATABASE_ROWS(dbId), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: docsKeys.databases.rows(dbId),
      });
    },
  });
}

/** Update a single row's values or position (shallow-merge on backend). */
export function useUpdateRow(dbId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rowId, payload }: { rowId: string; payload: UpdateRowPayload }) =>
      api.patch<DatabaseRow>(
        API_ENDPOINTS.DATABASE_ROW_BY_ID(dbId, rowId),
        payload,
      ),
    onSuccess: (updated) => {
      // Optimistically update the row in the rows cache
      queryClient.setQueryData<DatabaseRow[]>(
        docsKeys.databases.rows(dbId),
        (prev) =>
          prev
            ? prev.map((r) => (r.id === updated.id ? updated : r))
            : prev,
      );
    },
  });
}

/**
 * Batch-update multiple rows' values in one request.
 * Used by Board drag-and-drop to move cards between groups.
 */
export function useBatchUpdateRows(dbId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BatchUpdateRowsPayload) =>
      api.patch<DatabaseRow[]>(API_ENDPOINTS.DATABASE_ROWS_BATCH(dbId), payload),
    onSuccess: (updatedRows) => {
      queryClient.setQueryData<DatabaseRow[]>(
        docsKeys.databases.rows(dbId),
        (prev) => {
          if (!prev) return prev;
          const updatedMap = new Map(updatedRows.map((r) => [r.id, r]));
          return prev.map((r) => updatedMap.get(r.id) ?? r);
        },
      );
    },
  });
}

/** Delete a row. */
export function useDeleteRow(dbId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rowId: string) =>
      api.delete(API_ENDPOINTS.DATABASE_ROW_BY_ID(dbId, rowId)),
    onSuccess: (_data, rowId) => {
      queryClient.setQueryData<DatabaseRow[]>(
        docsKeys.databases.rows(dbId),
        (prev) => prev?.filter((r) => r.id !== rowId),
      );
    },
  });
}

// ─── V2: Database view hooks ──────────────────────────────────────────────────

/** Fetch all views for a database (position order / tab list). */
export function useDatabaseViews(dbId: string) {
  return useQuery({
    queryKey: docsKeys.databases.views(dbId),
    queryFn: () =>
      api.get<DatabaseView[]>(API_ENDPOINTS.DATABASE_VIEWS(dbId)),
    enabled: Boolean(dbId),
  });
}

/** Create a new view (table or board). */
export function useCreateView(dbId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateViewPayload) =>
      api.post<DatabaseView>(API_ENDPOINTS.DATABASE_VIEWS(dbId), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: docsKeys.databases.views(dbId),
      });
      queryClient.invalidateQueries({
        queryKey: docsKeys.databases.detail(dbId),
      });
    },
  });
}

/** Update a view's name, config (filters/sorts/group_by), or position. */
export function useUpdateView(dbId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ viewId, payload }: { viewId: string; payload: UpdateViewPayload }) =>
      api.patch<DatabaseView>(
        API_ENDPOINTS.DATABASE_VIEW_BY_ID(dbId, viewId),
        payload,
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData<DatabaseView[]>(
        docsKeys.databases.views(dbId),
        (prev) =>
          prev
            ? prev.map((v) => (v.id === updated.id ? updated : v))
            : prev,
      );
      // Invalidate view rows since config (filter/sort/group) may have changed
      queryClient.invalidateQueries({
        queryKey: docsKeys.databases.viewRows(dbId, updated.id),
      });
    },
  });
}

/** Delete a view. */
export function useDeleteView(dbId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (viewId: string) =>
      api.delete(API_ENDPOINTS.DATABASE_VIEW_BY_ID(dbId, viewId)),
    onSuccess: (_data, viewId) => {
      queryClient.setQueryData<DatabaseView[]>(
        docsKeys.databases.views(dbId),
        (prev) => prev?.filter((v) => v.id !== viewId),
      );
      queryClient.removeQueries({
        queryKey: docsKeys.databases.viewRows(dbId, viewId),
      });
    },
  });
}

/**
 * Fetch rows processed through a view's stored config (filter/sort for table;
 * group-by for board). Returns ViewRowsResponse:
 *   - Table: { rows: DatabaseRow[] }
 *   - Board: { groups: BoardGroup[] }
 */
export function useViewRows(dbId: string, viewId: string) {
  return useQuery({
    queryKey: docsKeys.databases.viewRows(dbId, viewId),
    queryFn: () =>
      api.get<ViewRowsResponse>(
        API_ENDPOINTS.DATABASE_VIEW_ROWS(dbId, viewId),
      ),
    enabled: Boolean(dbId) && Boolean(viewId),
  });
}

// ─── V2: Docs search hook ─────────────────────────────────────────────────────

/**
 * Search pages and databases (pg_trgm title + content/values fulltext).
 * Debounce the `q` value at the call site (~250 ms) before passing here.
 */
export function useDocsSearch(q: string, spaceId?: string) {
  return useQuery({
    queryKey: docsKeys.search.query(q, spaceId),
    queryFn: () =>
      api.get<DocSearchResult>(
        API_ENDPOINTS.DOCS_SEARCH,
        spaceId ? { q, space_id: spaceId } : { q },
      ),
    enabled: q.trim().length > 0,
    staleTime: 10_000,
  });
}

// ─── V2: Public page hooks (unauthenticated) ──────────────────────────────────

/**
 * Fetch a public page by slug (no auth required).
 * Returns the page's content + direct public children.
 * 404 if the page is not found or is not public.
 */
export function usePublicPage(slug: string) {
  return useQuery({
    queryKey: docsKeys.public.page(slug),
    queryFn: () =>
      api.get<PublicPage>(API_ENDPOINTS.PUBLIC_PAGE(slug)),
    enabled: Boolean(slug),
    staleTime: 60_000,
  });
}

/**
 * Fetch the full public descendant subtree rooted at the given slug.
 * Used for site navigation (public sidebar).
 */
export function usePublicPageTree(slug: string) {
  return useQuery({
    queryKey: docsKeys.public.tree(slug),
    queryFn: () =>
      api.get<PublicPageTreeNode[]>(API_ENDPOINTS.PUBLIC_PAGE_TREE(slug)),
    enabled: Boolean(slug),
    staleTime: 60_000,
  });
}
