"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { RETRO_ENDPOINTS } from "../api";
import type {
  CreateRetroTemplatePayload,
  OpenRetroPayload,
  RetroDetail,
  RetroKind,
  RetroLinkTargetType,
  RetroListFilters,
  RetroListResponse,
  RetroTemplate,
  RetroTrendPoint,
  RetroSummary,
  UpdateRetroPayload,
  UpdateRetroTemplatePayload,
} from "../types";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const retroKeys = {
  all: ["retros"] as const,
  lists: () => [...retroKeys.all, "list"] as const,
  list: (filters: RetroListFilters) => [...retroKeys.lists(), filters] as const,
  details: () => [...retroKeys.all, "detail"] as const,
  detail: (id: string) => [...retroKeys.details(), id] as const,
  trends: () => [...retroKeys.all, "trends"] as const,
  trend: (kind: RetroKind, limit: number) =>
    [...retroKeys.trends(), kind, limit] as const,
  byTargets: () => [...retroKeys.all, "by-target"] as const,
  byTarget: (targetType: RetroLinkTargetType, targetId: string) =>
    [...retroKeys.byTargets(), targetType, targetId] as const,
  actions: () => [...retroKeys.all, "actions"] as const,
  openActions: () => [...retroKeys.actions(), "open"] as const,
  templates: () => [...retroKeys.all, "templates"] as const,
};

/** Invalidate everything a retro's header/list/counts depend on. */
export function invalidateRetroLists(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: retroKeys.lists() }),
    qc.invalidateQueries({ queryKey: retroKeys.trends() }),
    qc.invalidateQueries({ queryKey: retroKeys.byTargets() }),
  ]);
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** GET /api/retros — timeline list with optional filters. */
export function useRetros(filters: RetroListFilters = {}) {
  return useQuery({
    queryKey: retroKeys.list(filters),
    queryFn: () =>
      api.get<RetroListResponse>(
        RETRO_ENDPOINTS.LIST,
        filters as Record<string, string | number | boolean | undefined | null>,
      ),
    placeholderData: keepPreviousData,
  });
}

/** GET /api/retros/:id — header, sections, entries, links, actions. */
export function useRetroDetail(id: string) {
  return useQuery({
    queryKey: retroKeys.detail(id),
    queryFn: () => api.get<RetroDetail>(RETRO_ENDPOINTS.BY_ID(id)),
    enabled: Boolean(id),
  });
}

/** GET /api/retros/templates — own + built-in templates, with sections. */
export function useRetroTemplates() {
  return useQuery({
    queryKey: retroKeys.templates(),
    queryFn: () => api.get<RetroTemplate[]>(RETRO_ENDPOINTS.TEMPLATES),
    staleTime: 1000 * 60 * 5,
  });
}

/** GET /api/retros/trends?kind=&limit= — points for the trends chart. */
export function useRetroTrends(kind: RetroKind = "weekly", limit = 12) {
  return useQuery({
    queryKey: retroKeys.trend(kind, limit),
    queryFn: () =>
      api.get<RetroTrendPoint[]>(RETRO_ENDPOINTS.TRENDS, { kind, limit }),
  });
}

/**
 * GET /api/retros/by-target?target_type=&target_id=
 * Retros that link to the object or are scoped to it (backlinks).
 */
export function useRetrosByTarget(
  targetType: RetroLinkTargetType,
  targetId: string | null | undefined,
) {
  return useQuery({
    queryKey: retroKeys.byTarget(targetType, targetId ?? ""),
    queryFn: () =>
      api.get<RetroSummary[]>(RETRO_ENDPOINTS.BY_TARGET, {
        target_type: targetType,
        target_id: targetId ?? undefined,
      }),
    enabled: Boolean(targetId),
  });
}

// ─── Retro mutations ──────────────────────────────────────────────────────────

/**
 * POST /api/retros/open — idempotent. Returns the existing retro for the
 * kind + period + scope, or creates it from the template.
 */
export function useOpenRetro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: OpenRetroPayload) =>
      api.post<RetroDetail>(RETRO_ENDPOINTS.OPEN, payload),
    onSuccess: (data) => {
      qc.setQueryData(retroKeys.detail(data.retro.id), data);
      invalidateRetroLists(qc);
      qc.invalidateQueries({ queryKey: retroKeys.actions() });
    },
  });
}

/** PATCH /api/retros/:id — title, summary, rating, mood. */
export function useUpdateRetro(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateRetroPayload) =>
      api.patch<RetroDetail>(RETRO_ENDPOINTS.BY_ID(id), payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: retroKeys.detail(id) });
      invalidateRetroLists(qc);
    },
  });
}

/** DELETE /api/retros/:id */
export function useDeleteRetro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(RETRO_ENDPOINTS.BY_ID(id)),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: retroKeys.detail(id) });
      qc.invalidateQueries({ queryKey: retroKeys.actions() });
      invalidateRetroLists(qc);
    },
  });
}

/** POST /api/retros/:id/refresh-snapshot — draft only. */
export function useRefreshRetroSnapshot(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<RetroDetail>(RETRO_ENDPOINTS.REFRESH_SNAPSHOT(id)),
    onSuccess: (data) => {
      qc.setQueryData(retroKeys.detail(id), data);
    },
  });
}

/** POST /api/retros/:id/complete — freezes the snapshot. */
export function useCompleteRetro(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<RetroDetail>(RETRO_ENDPOINTS.COMPLETE(id)),
    onSuccess: (data) => {
      qc.setQueryData(retroKeys.detail(id), data);
      invalidateRetroLists(qc);
    },
  });
}

/** POST /api/retros/:id/reopen */
export function useReopenRetro(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<RetroDetail>(RETRO_ENDPOINTS.REOPEN(id)),
    onSuccess: (data) => {
      qc.setQueryData(retroKeys.detail(id), data);
      invalidateRetroLists(qc);
    },
  });
}

// ─── Template mutations ───────────────────────────────────────────────────────

/** POST /api/retros/templates */
export function useCreateRetroTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRetroTemplatePayload) =>
      api.post<RetroTemplate>(RETRO_ENDPOINTS.TEMPLATES, payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: retroKeys.templates() }),
  });
}

/** PATCH /api/retros/templates/:id — own templates only. */
export function useUpdateRetroTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateRetroTemplatePayload) =>
      api.patch<RetroTemplate>(RETRO_ENDPOINTS.TEMPLATE_BY_ID(id), payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: retroKeys.templates() }),
  });
}

/** DELETE /api/retros/templates/:id — own, non-builtin only. */
export function useDeleteRetroTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<void>(RETRO_ENDPOINTS.TEMPLATE_BY_ID(id)),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: retroKeys.templates() }),
  });
}

// ─── Composite: "Add to this week's review" ───────────────────────────────────

export interface AddToWeeklyRetroInput {
  targetType: RetroLinkTargetType;
  targetId: string;
}

/**
 * Opens this week's weekly retro (idempotent) and links the target to it as
 * `mentions`. A 409 from the link endpoint means it was already linked, which
 * is treated as success.
 */
export function useAddToWeeklyRetro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ targetType, targetId }: AddToWeeklyRetroInput) => {
      const retro = await api.post<RetroDetail>(RETRO_ENDPOINTS.OPEN, {
        kind: "weekly",
      } satisfies OpenRetroPayload);
      const retroId = retro.retro.id;
      try {
        await api.post(RETRO_ENDPOINTS.LINKS(retroId), {
          target_type: targetType,
          target_id: targetId,
          relation: "mentions",
        });
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status !== 409) throw err;
      }
      return { retroId, title: retro.retro.title };
    },
    onSuccess: ({ retroId }) => {
      qc.invalidateQueries({ queryKey: retroKeys.detail(retroId) });
      invalidateRetroLists(qc);
    },
  });
}
