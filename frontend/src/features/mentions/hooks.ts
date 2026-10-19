"use client";

import { useEffect } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Editor } from "@tiptap/core";
import {
  fetchBacklinks,
  resolveMentions,
  searchMentions,
  syncMentions,
} from "./api";
import type {
  MentionBacklink,
  MentionRef,
  MentionResolved,
  MentionSearchResult,
  MentionSourceType,
  MentionType,
} from "./types";
import { MENTION_TYPES } from "./types";

export const mentionKeys = {
  all: ["mentions"] as const,
  search: (q: string, types: string) => [...mentionKeys.all, "search", q, types] as const,
  resolve: (type: MentionType, id: string) => [...mentionKeys.all, "resolve", type, id] as const,
  backlinks: (type: MentionType, id: string) => [...mentionKeys.all, "backlinks", type, id] as const,
};

const MAX_REFS_PER_REQUEST = 100;
const RESOLVE_BATCH_WINDOW_MS = 10;

// ── Picker search ────────────────────────────────────────────────────────────

/** Owner-scoped search for the @ picker. Results are cached by react-query. */
export function useMentionSearch(
  q: string,
  types?: MentionType[],
  limit = 8,
) {
  const trimmed = q.trim();
  const typesKey = types?.join(",") ?? "";
  return useQuery<MentionSearchResult[]>({
    queryKey: [...mentionKeys.search(trimmed, typesKey), limit],
    queryFn: () => searchMentions({ q: trimmed, types, limit }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

// ── Chip resolution (batched) ────────────────────────────────────────────────

interface PendingResolve {
  ref: MentionRef;
  resolve: (value: MentionResolved | null) => void;
  reject: (reason: unknown) => void;
}

let pendingResolves: PendingResolve[] = [];
let resolveTimer: ReturnType<typeof setTimeout> | null = null;

function refKey(ref: MentionRef): string {
  return `${ref.type}:${ref.id}`;
}

function flushResolves(): void {
  const batch = pendingResolves;
  pendingResolves = [];
  resolveTimer = null;

  // Dedupe refs so one request covers every chip asking for the same object.
  const unique = new Map<string, MentionRef>();
  for (const p of batch) unique.set(refKey(p.ref), p.ref);
  const refs = Array.from(unique.values());

  const chunks: MentionRef[][] = [];
  for (let i = 0; i < refs.length; i += MAX_REFS_PER_REQUEST) {
    chunks.push(refs.slice(i, i + MAX_REFS_PER_REQUEST));
  }

  Promise.all(chunks.map((chunk) => resolveMentions(chunk)))
    .then((responses) => {
      const byKey = new Map<string, MentionResolved>();
      for (const rows of responses) {
        for (const row of rows) byKey.set(`${row.type}:${row.id}`, row);
      }
      for (const p of batch) p.resolve(byKey.get(refKey(p.ref)) ?? null);
    })
    .catch((err: unknown) => {
      for (const p of batch) p.reject(err);
    });
}

/**
 * Queues a single ref. Refs requested within the same short window are sent
 * as one `GET /api/mentions/resolve` call, so an editor full of chips makes
 * one request instead of one per chip.
 */
function loadResolved(ref: MentionRef): Promise<MentionResolved | null> {
  return new Promise((resolve, reject) => {
    pendingResolves.push({ ref, resolve, reject });
    if (resolveTimer === null) {
      resolveTimer = setTimeout(flushResolves, RESOLVE_BATCH_WINDOW_MS);
    }
  });
}

/** Live title/existence for one mention chip. */
export function useMentionResolve(ref: MentionRef) {
  return useQuery<MentionResolved | null>({
    queryKey: mentionKeys.resolve(ref.type, ref.id),
    queryFn: () => loadResolved(ref),
    enabled: ref.id.length > 0,
    staleTime: 30_000,
    retry: false,
  });
}

// ── Backlinks ────────────────────────────────────────────────────────────────

export function useMentionBacklinks(targetType: MentionType, targetId: string) {
  return useQuery<MentionBacklink[]>({
    queryKey: mentionKeys.backlinks(targetType, targetId),
    queryFn: () => fetchBacklinks(targetType, targetId),
    enabled: targetId.length > 0,
    staleTime: 15_000,
  });
}

// ── Sync ─────────────────────────────────────────────────────────────────────

export interface MentionSource {
  type: MentionSourceType;
  id: string | undefined;
}

const SYNC_DEBOUNCE_MS = 1000;

/** Collects the distinct mention targets currently in the editor document. */
export function collectMentionTargets(
  editor: Editor,
  source: MentionSource,
): MentionRef[] {
  const found = new Map<string, MentionRef>();
  editor.state.doc.descendants((node) => {
    let ref: MentionRef | null = null;
    if (node.type.name === "entityMention") {
      const type = node.attrs.mentionType as string;
      const id = node.attrs.mentionId as string;
      if (MENTION_TYPES.includes(type as MentionType) && id) {
        ref = { type: type as MentionType, id };
      }
    } else if (node.type.name === "pageMention" && source.type === "doc") {
      // Docs keep their own @page nodes; they also count as "doc" mentions.
      const pageId = node.attrs.pageId as string;
      if (pageId) ref = { type: "doc", id: pageId };
    }
    if (ref && !(ref.type === source.type && ref.id === source.id)) {
      found.set(refKey(ref), ref);
    }
    return true;
  });
  return Array.from(found.values()).sort((a, b) => refKey(a).localeCompare(refKey(b)));
}

/**
 * Keeps the `mentions` rows of one source in step with the editor content.
 * Changes are debounced (1 s); a PUT is sent only when the set of targets
 * differs from the last one sent. Pending changes are flushed on unmount or
 * when the source changes.
 */
export function useMentionSync(editor: Editor | null, source: MentionSource): void {
  const queryClient = useQueryClient();
  const sourceType = source.type;
  const sourceId = source.id;

  useEffect(() => {
    if (!editor || !sourceId) return;

    const src: MentionSource = { type: sourceType, id: sourceId };
    let lastKey = JSON.stringify(collectMentionTargets(editor, src));
    let latest: MentionRef[] = collectMentionTargets(editor, src);
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = (): void => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      const key = JSON.stringify(latest);
      if (key === lastKey) return;
      const targets = latest;
      syncMentions({
        source_type: src.type,
        source_id: src.id as string,
        targets,
      })
        .then(() => {
          lastKey = key;
          void queryClient.invalidateQueries({ queryKey: mentionKeys.all });
        })
        .catch(() => {
          // Leave lastKey stale so the next edit retries the sync.
        });
    };

    const onUpdate = (): void => {
      latest = collectMentionTargets(editor, src);
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, SYNC_DEBOUNCE_MS);
    };

    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
      // Flush anything still pending (unmount, source change, editor swap).
      flush();
    };
  }, [editor, sourceType, sourceId, queryClient]);
}
