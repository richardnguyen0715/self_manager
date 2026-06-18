"use client";

/**
 * useBacklogData — assembles all data the backlog screen needs.
 *
 * Endpoints used (exact contract names):
 *   GET /api/backlog          → { data: WorkItemListItem[], total }
 *   GET /api/sprints          → { data: Sprint[], total }
 *   GET /api/sprints/active   → Sprint (flat) | 404
 *   GET /api/epics            → { data: Epic[], total }
 *   GET /api/work-items       → { data: WorkItemListItem[], total } (per sprint)
 *
 * Mutations exposed:
 *   POST   /api/work-items                     (create)
 *   PATCH  /api/work-items/:id/sprint          (move to sprint)
 *   PATCH  /api/work-items/:id/backlog         (move to backlog)
 *   POST   /api/sprints                        (create sprint)
 *   POST   /api/sprints/:id/activate
 *   POST   /api/sprints/:id/complete
 */

export {
  useBacklog,
  useCreateWorkItem,
  useMoveWorkItemToSprint,
  useMoveWorkItemToBacklog,
  useDeleteWorkItem,
} from "@/features/agile";

export {
  useSprints,
  useActiveSprint,
  useSprintWorkItems,
  useCreateSprint,
  useActivateSprint,
  useCompleteSprint,
} from "@/features/agile";

export { useEpics } from "@/features/agile";
