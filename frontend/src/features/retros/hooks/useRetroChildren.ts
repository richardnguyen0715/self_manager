"use client";

/**
 * Child-resource hooks for a retro: entries, links and actions.
 *
 * Entry writes update the retro detail cache in place (the server returns the
 * full Entry) so autosave does not trigger a refetch that would fight the
 * editor's local draft. Link/action writes change counts and carry state, so
 * they refresh the detail, lists and action views.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { RETRO_ENDPOINTS } from "../api";
import { invalidateRetroLists, retroKeys } from "./useRetros";
import type {
  CreateRetroActionPayload,
  CreateRetroEntryPayload,
  CreateRetroLinkPayload,
  LinkResolved,
  RetroAction,
  RetroActionStatus,
  RetroActionWithRetro,
  RetroDetail,
  RetroEntry,
  RetroSection,
  UpdateRetroActionPayload,
  UpdateRetroEntryPayload,
} from "../types";

type QC = ReturnType<typeof useQueryClient>;

/** Replace or append an entry in the cached detail. */
function upsertEntryInCache(qc: QC, retroId: string, entry: RetroEntry) {
  qc.setQueryData<RetroDetail>(retroKeys.detail(retroId), (old) => {
    if (!old) return old;
    const exists = old.entries.some((e) => e.id === entry.id);
    return {
      ...old,
      entries: exists
        ? old.entries.map((e) => (e.id === entry.id ? entry : e))
        : [...old.entries, entry],
    };
  });
}

function removeEntryFromCache(qc: QC, retroId: string, entryId: string) {
  qc.setQueryData<RetroDetail>(retroKeys.detail(retroId), (old) =>
    old ? { ...old, entries: old.entries.filter((e) => e.id !== entryId) } : old,
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

/** PATCH /api/retros/:id/sections/:section_id — sets the section's rich note. */
export function useUpdateRetroSectionNotes(retroId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sectionId, notes }: { sectionId: string; notes: string }) =>
      api.patch<RetroSection>(RETRO_ENDPOINTS.SECTION_BY_ID(retroId, sectionId), { notes }),
    onSuccess: (section) =>
      qc.setQueryData<RetroDetail>(retroKeys.detail(retroId), (old) =>
        old
          ? { ...old, sections: old.sections.map((s) => (s.id === section.id ? section : s)) }
          : old,
      ),
  });
}

// ─── Entries ──────────────────────────────────────────────────────────────────

/** POST /api/retros/:id/entries */
export function useCreateRetroEntry(retroId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRetroEntryPayload) =>
      api.post<RetroEntry>(RETRO_ENDPOINTS.ENTRIES(retroId), payload),
    onSuccess: (entry) => upsertEntryInCache(qc, retroId, entry),
  });
}

/** PATCH /api/retros/entries/:entry_id — returns the updated Entry. */
export function useUpdateRetroEntry(retroId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      entryId,
      ...payload
    }: UpdateRetroEntryPayload & { entryId: string }) =>
      api.patch<RetroEntry>(RETRO_ENDPOINTS.ENTRY_BY_ID(entryId), payload),
    onSuccess: (entry) => upsertEntryInCache(qc, retroId, entry),
  });
}

/** DELETE /api/retros/entries/:entry_id */
export function useDeleteRetroEntry(retroId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) =>
      api.delete<void>(RETRO_ENDPOINTS.ENTRY_BY_ID(entryId)),
    onSuccess: (_data, entryId) => removeEntryFromCache(qc, retroId, entryId),
  });
}

// ─── Links ────────────────────────────────────────────────────────────────────

/** POST /api/retros/:id/links — target must exist; duplicates are deduped server-side. */
export function useAddRetroLink(retroId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRetroLinkPayload) =>
      api.post<LinkResolved>(RETRO_ENDPOINTS.LINKS(retroId), payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: retroKeys.detail(retroId) });
      invalidateRetroLists(qc);
    },
  });
}

/** DELETE /api/retros/links/:link_id */
export function useRemoveRetroLink(retroId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) =>
      api.delete<void>(RETRO_ENDPOINTS.LINK_BY_ID(linkId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: retroKeys.detail(retroId) });
      invalidateRetroLists(qc);
    },
  });
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/** GET /api/retros/actions?status=open — open actions across all retros. */
export function useRetroActions(status: RetroActionStatus = "open") {
  return useQuery({
    queryKey: [...retroKeys.actions(), status] as const,
    queryFn: () =>
      api.get<RetroActionWithRetro[]>(RETRO_ENDPOINTS.ACTIONS, { status }),
  });
}

/** POST /api/retros/:id/actions */
export function useCreateRetroAction(retroId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRetroActionPayload) =>
      api.post<RetroAction>(RETRO_ENDPOINTS.RETRO_ACTIONS(retroId), payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: retroKeys.detail(retroId) });
      qc.invalidateQueries({ queryKey: retroKeys.actions() });
      invalidateRetroLists(qc);
    },
  });
}

/** PATCH /api/retros/actions/:action_id — text, status, due date. */
export function useUpdateRetroAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      actionId,
      ...payload
    }: UpdateRetroActionPayload & { actionId: string }) =>
      api.patch<RetroAction>(RETRO_ENDPOINTS.ACTION_BY_ID(actionId), payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: retroKeys.details() });
      qc.invalidateQueries({ queryKey: retroKeys.actions() });
      invalidateRetroLists(qc);
    },
  });
}

/** DELETE /api/retros/actions/:action_id */
export function useDeleteRetroAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (actionId: string) =>
      api.delete<void>(RETRO_ENDPOINTS.ACTION_BY_ID(actionId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: retroKeys.details() });
      qc.invalidateQueries({ queryKey: retroKeys.actions() });
      invalidateRetroLists(qc);
    },
  });
}

/**
 * POST /api/retros/actions/:action_id/convert — creates a task work item.
 * Idempotent on the server when the action is already converted.
 */
export function useConvertRetroAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (actionId: string) =>
      api.post<RetroAction>(RETRO_ENDPOINTS.ACTION_CONVERT(actionId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: retroKeys.details() });
      qc.invalidateQueries({ queryKey: retroKeys.actions() });
    },
  });
}
