import { MENTION_TYPE_SET } from "./types";
import type { MentionRef, MentionSearchResult, MentionType } from "./types";

/**
 * Plain-text mention token, used where there is no rich editor (retro cards):
 * `@[Label](type:uuid)`. Rich editors store `entityMention` nodes / HTML instead.
 */
const TOKEN_SOURCE = "@\\[([^\\]]*)\\]\\(([a-z_]+):([0-9a-fA-F-]{36})\\)";

export type MentionTextSegment =
  | { kind: "text"; value: string }
  | { kind: "mention"; type: MentionType; id: string; label: string };

export function mentionToken(item: Pick<MentionSearchResult, "type" | "id" | "title">): string {
  // Brackets would break the token; the label is only a fallback (live title wins).
  const label = item.title.replace(/[[\]]/g, "");
  return `@[${label}](${item.type}:${item.id})`;
}

export function hasMentionToken(text: string): boolean {
  return new RegExp(TOKEN_SOURCE).test(text);
}

export function parseMentionText(text: string): MentionTextSegment[] {
  const re = new RegExp(TOKEN_SOURCE, "g");
  const out: MentionTextSegment[] = [];
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (!MENTION_TYPE_SET.has(m[2])) continue;
    if (m.index > last) out.push({ kind: "text", value: text.slice(last, m.index) });
    out.push({ kind: "mention", type: m[2] as MentionType, id: m[3], label: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}

export function collectTextMentionRefs(text: string): MentionRef[] {
  return parseMentionText(text).flatMap((s) =>
    s.kind === "mention" ? [{ type: s.type, id: s.id }] : [],
  );
}

/** Mention targets inside Tiptap HTML (`<span data-entity-mention ...>`). */
export function collectHtmlMentionRefs(html: string | null | undefined): MentionRef[] {
  if (!html) return [];
  const out: MentionRef[] = [];
  const spanRe = /<span\b[^>]*data-entity-mention[^>]*>/g;
  for (const m of html.matchAll(spanRe)) {
    const type = /data-mention-type="([^"]+)"/.exec(m[0])?.[1];
    const id = /data-mention-id="([^"]+)"/.exec(m[0])?.[1];
    if (type && id && MENTION_TYPE_SET.has(type)) out.push({ type: type as MentionType, id });
  }
  return out;
}
