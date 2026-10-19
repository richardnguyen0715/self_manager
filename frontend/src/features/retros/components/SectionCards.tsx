"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MentionText, MentionTextarea, hasMentionToken } from "@/features/mentions";
import {
  useCreateRetroEntry,
  useDeleteRetroEntry,
  useUpdateRetroEntry,
} from "../hooks/useRetroChildren";
import { useUpdateRetro } from "../hooks/useRetros";
import type { RetroEntry, RetroSection } from "../types";

export const AUTOSAVE_DELAY_MS = 600;

// ─── Autosave primitive ───────────────────────────────────────────────────────

/**
 * Debounced save. `schedule(value)` saves the latest value after `delay` ms of
 * quiet. `flush()` saves immediately (used on blur and on unmount so a pending
 * edit is never lost when navigating away).
 */
export function useAutosave<T>(
  save: (value: T) => unknown,
  delay = AUTOSAVE_DELAY_MS,
) {
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  const timerRef = useRef<number | undefined>(undefined);
  const pendingRef = useRef<{ value: T } | null>(null);

  const flush = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) void saveRef.current(pending.value);
  }, []);

  const schedule = useCallback(
    (value: T) => {
      pendingRef.current = { value };
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(flush, delay);
    },
    [delay, flush],
  );

  // Save anything still pending when the editor unmounts.
  useEffect(() => flush, [flush]);

  return { schedule, flush };
}

// ─── Autosaving textarea ──────────────────────────────────────────────────────

interface AutosaveTextareaProps {
  initialValue: string;
  onSave: (value: string) => unknown;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  className?: string;
  ariaLabel?: string;
}

/**
 * Uncontrolled-from-the-server textarea: the local draft is the source of
 * truth after mount, so refetches never overwrite what the user is typing.
 */
export function AutosaveTextarea({
  initialValue,
  onSave,
  placeholder,
  rows = 2,
  autoFocus,
  className,
  ariaLabel,
}: AutosaveTextareaProps) {
  const [value, setValue] = useState(initialValue);
  const { schedule, flush } = useAutosave<string>(onSave);
  const ref = useRef<HTMLTextAreaElement>(null);
  // Text holding `@[..](type:id)` tokens shows as chips until the user clicks
  // into it; the textarea always edits the raw token text.
  const [editing, setEditing] = useState(!!autoFocus);

  // The row can mount before the parent decides it should take focus, so the
  // native autoFocus attribute alone misses; focus whenever the flag flips on.
  useEffect(() => {
    if (autoFocus) {
      setEditing(true);
      ref.current?.focus();
    }
  }, [autoFocus]);

  // Entering edit mode mounts the textarea; focus it then.
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const boxClass = cn(
    "w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
    className,
  );

  if (!editing && hasMentionToken(value)) {
    return (
      <div
        role="textbox"
        tabIndex={0}
        aria-label={ariaLabel}
        onClick={() => setEditing(true)}
        onFocus={() => setEditing(true)}
        className={cn(boxClass, "cursor-text")}
      >
        <MentionText text={value} />
      </div>
    );
  }

  return (
    <MentionTextarea
      ref={ref}
      value={value}
      rows={rows}
      placeholder={placeholder}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      onValueChange={(v) => {
        setValue(v);
        schedule(v);
      }}
      onBlur={() => {
        flush();
        setEditing(false);
      }}
      className={boxClass}
    />
  );
}

// ─── Score input (rating 1-5 / mood 1-5) ──────────────────────────────────────

const MOOD_LABELS = ["Rough", "Low", "Okay", "Good", "Great"];

interface ScoreInputProps {
  kind: "rating" | "mood";
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}

/** 1-5 star rating or 1-5 mood scale. Clicking the active value clears it. */
export function ScoreInput({ kind, value, onChange, disabled }: ScoreInputProps) {
  const current = value ?? 0;
  if (kind === "rating") {
    return (
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={current === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            disabled={disabled}
            onClick={() => onChange(current === n ? null : n)}
            className="rounded p-0.5 hover:scale-110 disabled:opacity-50"
          >
            <Star
              className={cn(
                "h-5 w-5",
                n <= current
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground",
              )}
            />
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Mood">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={current === n}
          disabled={disabled}
          onClick={() => onChange(current === n ? null : n)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
            current === n
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input text-muted-foreground hover:text-foreground",
          )}
        >
          {n} {MOOD_LABELS[n - 1]}
        </button>
      ))}
    </div>
  );
}

// ─── Section: rating / mood (stored on the retro) ─────────────────────────────

export function ScoreSection({
  retroId,
  kind,
  value,
}: {
  retroId: string;
  kind: "rating" | "mood";
  value: number | null;
}) {
  const update = useUpdateRetro(retroId);
  return (
    <ScoreInput
      kind={kind}
      value={value}
      disabled={update.isPending}
      onChange={(next) =>
        update.mutate(kind === "rating" ? { rating: next } : { mood: next })
      }
    />
  );
}

// ─── Section: text (single autosaving entry) ──────────────────────────────────

export function TextSection({
  retroId,
  section,
  entry,
}: {
  retroId: string;
  section: RetroSection;
  entry: RetroEntry | undefined;
}) {
  const create = useCreateRetroEntry(retroId);
  const update = useUpdateRetroEntry(retroId);

  // Entry id is held in a ref so rapid saves never create two entries.
  const entryIdRef = useRef<string | undefined>(entry?.id);
  const createRef = useRef<Promise<unknown> | null>(null);

  const save = async (body: string) => {
    if (entryIdRef.current) {
      update.mutate({ entryId: entryIdRef.current, body });
      return;
    }
    if (!createRef.current) {
      createRef.current = create
        .mutateAsync({ section_id: section.id, body })
        .then((created) => {
          entryIdRef.current = created.id;
          return created;
        });
      return;
    }
    await createRef.current;
    if (entryIdRef.current) {
      update.mutate({ entryId: entryIdRef.current, body });
    }
  };

  return (
    <AutosaveTextarea
      initialValue={entry?.body ?? ""}
      onSave={save}
      rows={5}
      placeholder={section.prompt ?? "Write freely…"}
      ariaLabel={section.title}
    />
  );
}

// ─── Section: cards / checklist (list of autosaving entries) ──────────────────

interface EntryListSectionProps {
  retroId: string;
  section: RetroSection;
  entries: RetroEntry[];
  /** checklist: each row has a checkbox; cards: plain text cards. */
  checklist?: boolean;
}

export function EntryListSection({
  retroId,
  section,
  entries,
  checklist = false,
}: EntryListSectionProps) {
  const create = useCreateRetroEntry(retroId);
  const [focusId, setFocusId] = useState<string | null>(null);

  const sorted = [...entries].sort((a, b) => a.position - b.position);
  const nextPosition = sorted.reduce((max, e) => Math.max(max, e.position), -1) + 1;

  return (
    <div className="space-y-2">
      {sorted.map((entry) => (
        <EntryRow
          key={entry.id}
          retroId={retroId}
          entry={entry}
          checklist={checklist}
          autoFocus={focusId === entry.id}
          sectionTitle={section.title}
        />
      ))}

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {checklist ? "No items yet." : "No cards yet."}
        </p>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={create.isPending}
        onClick={() =>
          create.mutate(
            { section_id: section.id, body: "", position: nextPosition },
            { onSuccess: (created) => setFocusId(created.id) },
          )
        }
      >
        <Plus className="h-4 w-4" />
        {checklist ? "Add item" : "Add card"}
      </Button>
    </div>
  );
}

function EntryRow({
  retroId,
  entry,
  checklist,
  autoFocus,
  sectionTitle,
}: {
  retroId: string;
  entry: RetroEntry;
  checklist: boolean;
  autoFocus: boolean;
  sectionTitle: string;
}) {
  const update = useUpdateRetroEntry(retroId);
  const remove = useDeleteRetroEntry(retroId);

  return (
    <div
      className={cn(
        "group flex items-start gap-2 rounded-md border bg-card p-2",
        checklist && entry.checked && "opacity-70",
      )}
    >
      {checklist ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={entry.checked}
          aria-label={`Mark "${entry.body || sectionTitle}" as done`}
          onClick={() => update.mutate({ entryId: entry.id, checked: !entry.checked })}
          className={cn(
            "mt-2 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
            entry.checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input",
          )}
        >
          {entry.checked ? <Check className="h-3 w-3" /> : null}
        </button>
      ) : null}

      <AutosaveTextarea
        key={entry.id}
        initialValue={entry.body}
        rows={1}
        autoFocus={autoFocus}
        placeholder={checklist ? "Describe the item…" : "Write a card…"}
        ariaLabel={sectionTitle}
        onSave={(body) => update.mutate({ entryId: entry.id, body })}
        className={cn(
          "min-h-0 flex-1 border-0 bg-transparent px-1 py-1 shadow-none focus-visible:ring-0",
          checklist && entry.checked && "line-through",
        )}
      />

      <button
        type="button"
        aria-label="Delete"
        onClick={() => remove.mutate(entry.id)}
        className="mt-1 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
