import { api } from "@/lib/api";
import type {
  MentionBacklink,
  MentionRef,
  MentionResolved,
  MentionSearchResult,
  MentionSyncPayload,
  MentionType,
} from "./types";

const BASE = "/api/mentions";

/** GET /api/mentions/search. Empty `q` returns recents. */
export function searchMentions(params: {
  q: string;
  types?: MentionType[];
  limit?: number;
}): Promise<MentionSearchResult[]> {
  return api.get<MentionSearchResult[]>(`${BASE}/search`, {
    q: params.q,
    types: params.types?.length ? params.types.join(",") : undefined,
    limit: params.limit,
  });
}

/** GET /api/mentions/resolve?refs=type:id,... (max 100 per request). */
export function resolveMentions(refs: MentionRef[]): Promise<MentionResolved[]> {
  return api.get<MentionResolved[]>(`${BASE}/resolve`, {
    refs: refs.map((r) => `${r.type}:${r.id}`).join(","),
  });
}

/** PUT /api/mentions/sync. Replaces the mention set of one source. */
export function syncMentions(payload: MentionSyncPayload): Promise<{ count: number }> {
  return api.put<{ count: number }>(`${BASE}/sync`, payload);
}

/** GET /api/mentions/backlinks?target_type=&target_id= */
export function fetchBacklinks(targetType: MentionType, targetId: string): Promise<MentionBacklink[]> {
  return api.get<MentionBacklink[]>(`${BASE}/backlinks`, {
    target_type: targetType,
    target_id: targetId,
  });
}
