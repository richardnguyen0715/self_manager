"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent, TextareaHTMLAttributes } from "react";
import { MentionList } from "./MentionList";
import type { MentionListHandle } from "./MentionList";
import { mentionToken } from "./text";
import type { MentionSearchResult } from "./types";

// "@" only triggers at the start or after whitespace/"(" (so emails don't).
const TRIGGER_RE = /(?:^|[\s(])@([^\s@[\]]*)$/;

interface MentionTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
}

/**
 * `<textarea>` with an `@` picker. Picking an object inserts a
 * `@[Label](type:id)` token (rendered as a chip by `MentionText`).
 */
export const MentionTextarea = forwardRef<HTMLTextAreaElement, MentionTextareaProps>(
  function MentionTextarea({ value, onValueChange, onKeyDown, onBlur, ...rest }, forwardedRef) {
    const ref = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(forwardedRef, () => ref.current as HTMLTextAreaElement);
    const listRef = useRef<MentionListHandle>(null);
    const [query, setQuery] = useState<string | null>(null);
    const [dismissed, setDismissed] = useState(false);

    function detect(text: string, caret: number): void {
      const m = TRIGGER_RE.exec(text.slice(0, caret));
      setQuery(m ? m[1] : null);
      if (!m) setDismissed(false);
    }

    function handleChange(e: ChangeEvent<HTMLTextAreaElement>): void {
      onValueChange(e.target.value);
      detect(e.target.value, e.target.selectionStart);
    }

    function insert(item: MentionSearchResult): void {
      const el = ref.current;
      if (!el) return;
      const caret = el.selectionStart;
      const before = value.slice(0, caret);
      const m = TRIGGER_RE.exec(before);
      if (!m) return;
      const at = before.length - m[1].length - 1; // index of "@"
      const token = `${mentionToken(item)} `;
      const next = value.slice(0, at) + token + value.slice(caret);
      onValueChange(next);
      setQuery(null);
      const pos = at + token.length;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    }

    const open = query !== null && !dismissed;

    function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
      if (open) {
        if (e.key === "Escape") {
          e.preventDefault();
          setDismissed(true);
          return;
        }
        if (listRef.current?.onKeyDown({ event: e.nativeEvent })) {
          e.preventDefault();
          return;
        }
      }
      onKeyDown?.(e);
    }

    return (
      <div className="relative w-full">
        <textarea
          {...rest}
          ref={ref}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onKeyUp={(e) => {
            if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") {
              detect(e.currentTarget.value, e.currentTarget.selectionStart);
            }
          }}
          onBlur={(e) => {
            // Let a click on the popup land before it closes.
            setTimeout(() => setQuery(null), 150);
            onBlur?.(e);
          }}
        />
        {open && (
          <div className="absolute left-0 top-full z-50 mt-1" onMouseDown={(e) => e.preventDefault()}>
            <MentionList ref={listRef} query={query ?? ""} command={insert} />
          </div>
        )}
      </div>
    );
  },
);
