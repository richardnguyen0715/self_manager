"use client";

import { MentionChip } from "./MentionChip";
import { parseMentionText } from "./text";

/** Plain text with `@[Label](type:id)` tokens rendered as chips. */
export function MentionText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className ?? "whitespace-pre-wrap break-words text-sm"}>
      {parseMentionText(text).map((s, i) =>
        s.kind === "text" ? (
          <span key={i}>{s.value}</span>
        ) : (
          <MentionChip key={i} type={s.type} id={s.id} label={s.label} />
        ),
      )}
    </div>
  );
}
