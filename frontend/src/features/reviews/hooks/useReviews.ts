"use client";

/**
 * Reviews feature hooks.
 *
 * These are THIN wrappers that re-export the canonical agile hooks so that the
 * reviews feature folder has a clear, self-contained boundary while calling the
 * EXACT endpoints and param names from the contract REST map.
 *
 * Endpoints used:
 *   GET  /api/sprints                        → list sprints
 *   GET  /api/sprints/:id                    → sprint detail (planned_points, done_count, velocity…)
 *   GET  /api/sprints/:id/review             → SprintReview (flat) or 404
 *   PUT  /api/sprints/:id/review             → upsert SprintReview  { summary? }
 *   GET  /api/sprints/:id/retrospective      → Retrospective (flat) or 404
 *   PUT  /api/sprints/:id/retrospective      → upsert Retrospective { went_well?, went_wrong?, action_items? }
 *   GET  /api/sprints/velocity               → { data: VelocityPoint[] }  ?last=N
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type {
  Sprint,
  SprintReview,
  Retrospective,
  VelocityPoint,
  AgileListResponse,
} from "@/types";
import type { UpsertSprintReviewPayload, UpsertRetrospectivePayload } from "@/features/agile/types";

// ─── Re-export query keys from canonical store ────────────────────────────────
// We reference the canonical sprintKeys from the agile hooks for cache coherence.
export { sprintKeys } from "@/features/agile/hooks/useSprints";

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * List all sprints so the user can pick one to review.
 * Calls GET /api/sprints  (no filters — show all for review selection).
 */
export function useSprintsForReview() {
  return useQuery({
    queryKey: ["sprints", "list", { forReview: true }],
    queryFn: () =>
      api.get<AgileListResponse<Sprint>>(API_ENDPOINTS.SPRINTS),
  });
}

/**
 * Single sprint detail — includes derived planned_points, done_count, velocity.
 * Calls GET /api/sprints/:id
 */
export function useReviewSprint(sprintId: string) {
  return useQuery({
    queryKey: ["sprints", "detail", sprintId],
    queryFn: () => api.get<Sprint>(API_ENDPOINTS.SPRINT_BY_ID(sprintId)),
    enabled: Boolean(sprintId),
  });
}

/**
 * Sprint review data (planned/completed pts, velocity, summary).
 * Calls GET /api/sprints/:id/review
 * Returns null data (not an error) on 404 — review may not exist yet.
 */
export function useSprintReviewData(sprintId: string) {
  return useQuery({
    queryKey: ["sprints", "detail", sprintId, "review"],
    queryFn: () => api.get<SprintReview>(API_ENDPOINTS.SPRINT_REVIEW(sprintId)),
    enabled: Boolean(sprintId),
    retry: (failureCount, error) => {
      const status = (error as { status?: number }).status;
      if (status === 404) return false;
      return failureCount < 2;
    },
  });
}

/**
 * Upsert sprint review summary.
 * Calls PUT /api/sprints/:id/review  { summary? }
 */
export function useUpsertReviewSummary(sprintId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertSprintReviewPayload) =>
      api.put<SprintReview>(API_ENDPOINTS.SPRINT_REVIEW(sprintId), payload),
    onSuccess: (data) => {
      qc.setQueryData(["sprints", "detail", sprintId, "review"], data);
      // Also invalidate the canonical agile review key for shared cache coherence
      qc.invalidateQueries({ queryKey: ["sprints", "detail", sprintId, "review"] });
    },
  });
}

/**
 * Retrospective data (went well / wrong / action items).
 * Calls GET /api/sprints/:id/retrospective
 * Returns null data on 404.
 */
export function useSprintRetroData(sprintId: string) {
  return useQuery({
    queryKey: ["sprints", "detail", sprintId, "retro"],
    queryFn: () =>
      api.get<Retrospective>(API_ENDPOINTS.SPRINT_RETRO(sprintId)),
    enabled: Boolean(sprintId),
    retry: (failureCount, error) => {
      const status = (error as { status?: number }).status;
      if (status === 404) return false;
      return failureCount < 2;
    },
  });
}

/**
 * Upsert retrospective.
 * Calls PUT /api/sprints/:id/retrospective  { went_well?, went_wrong?, action_items? }
 */
export function useUpsertRetro(sprintId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertRetrospectivePayload) =>
      api.put<Retrospective>(
        API_ENDPOINTS.SPRINT_RETRO(sprintId),
        payload,
      ),
    onSuccess: (data) => {
      qc.setQueryData(["sprints", "detail", sprintId, "retro"], data);
      qc.invalidateQueries({ queryKey: ["sprints", "detail", sprintId, "retro"] });
    },
  });
}

/**
 * Velocity history — last N sprints.
 * Calls GET /api/sprints/velocity  ?last=N
 */
export function useVelocityHistory(last = 6) {
  return useQuery({
    queryKey: ["sprints", "velocity", last],
    queryFn: () =>
      api.get<{ data: VelocityPoint[] }>(API_ENDPOINTS.SPRINT_VELOCITY, {
        last,
      }),
  });
}
