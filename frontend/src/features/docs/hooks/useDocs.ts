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
}

export interface MovePagePayload {
  id: string;
  parent_id?: string | null;
  position: number;
}

export interface CreateCommentPayload {
  body: string;
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
