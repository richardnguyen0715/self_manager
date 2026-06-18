"use client";

import { useState, useId } from "react";
import {
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Pencil,
  Check,
  X,
  ThumbsUp,
  ThumbsDown,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Sprint } from "@/types";
import {
  useSprintRetroData,
  useUpsertRetro,
} from "../hooks/useReviews";

// ─── Section editor ───────────────────────────────────────────────────────────

interface SectionEditorProps {
  label: string;
  icon: React.ReactNode;
  value: string | null;
  onSave: (value: string) => void;
  isSaving: boolean;
  placeholder: string;
  accentClass: string;
}

function SectionEditor({
  label,
  icon,
  value,
  onSave,
  isSaving,
  placeholder,
  accentClass,
}: SectionEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  function handleSave() {
    onSave(draft.trim());
    setEditing(false);
  }

  function handleCancel() {
    setDraft(value ?? "");
    setEditing(false);
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className={cn("text-sm font-semibold flex items-center gap-1.5", accentClass)}>
          {icon}
          {label}
        </h3>
        {!editing && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs gap-1"
            onClick={() => {
              setDraft(value ?? "");
              setEditing(true);
            }}
          >
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
        )}
      </div>

      {editing ? (
        <>
          <textarea
            autoFocus
            rows={5}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className={cn(
              "flex w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
              "placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            )}
          />
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              Save
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">
          {value || <span className="italic">Nothing noted yet.</span>}
        </p>
      )}
    </div>
  );
}

// ─── Action items editor ──────────────────────────────────────────────────────

interface ActionItem {
  id: string;
  text: string;
  done?: boolean;
}

interface ActionItemsEditorProps {
  items: ActionItem[];
  onUpdate: (items: ActionItem[]) => void;
  isSaving: boolean;
}

function ActionItemsEditor({ items, onUpdate, isSaving }: ActionItemsEditorProps) {
  const newItemId = useId();
  const [draftText, setDraftText] = useState("");

  function toggleDone(id: string) {
    const updated = items.map((item) =>
      item.id === id ? { ...item, done: !item.done } : item,
    );
    onUpdate(updated);
  }

  function deleteItem(id: string) {
    onUpdate(items.filter((item) => item.id !== id));
  }

  function addItem() {
    const text = draftText.trim();
    if (!text) return;
    const newItem: ActionItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text,
      done: false,
    };
    onUpdate([...items, newItem]);
    setDraftText("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addItem();
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
        <Zap className="h-4 w-4" />
        Action Items
      </h3>

      {/* Existing items */}
      {items.length > 0 ? (
        <ul className="space-y-1.5" role="list" aria-label="Action items">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-2 group"
            >
              <button
                type="button"
                onClick={() => toggleDone(item.id)}
                disabled={isSaving}
                className={cn(
                  "mt-0.5 shrink-0 rounded transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  item.done
                    ? "text-emerald-500 hover:text-emerald-600"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-label={item.done ? "Mark incomplete" : "Mark done"}
              >
                {item.done ? (
                  <CheckSquare className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </button>
              <span
                className={cn(
                  "flex-1 text-sm leading-snug pt-0.5",
                  item.done && "line-through text-muted-foreground",
                )}
              >
                {item.text}
              </span>
              <button
                type="button"
                onClick={() => deleteItem(item.id)}
                disabled={isSaving}
                className={cn(
                  "shrink-0 opacity-0 group-hover:opacity-100 transition-opacity",
                  "text-muted-foreground hover:text-destructive rounded",
                  "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                )}
                aria-label={`Remove action item: ${item.text}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          No action items yet. Add one below.
        </p>
      )}

      {/* Add new item */}
      <div className="flex items-center gap-2">
        <Input
          id={`${newItemId}-new-action`}
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add an action item…"
          className="h-8 text-sm"
          disabled={isSaving}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addItem}
          disabled={!draftText.trim() || isSaving}
          className="shrink-0"
          aria-label="Add action item"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Retrospective Panel ──────────────────────────────────────────────────────

interface RetrospectivePanelProps {
  sprint: Sprint;
}

/**
 * Displays and allows editing the sprint retrospective:
 *   - What went well (free-text, editable)
 *   - What went wrong (free-text, editable)
 *   - Action items (checklist, add/toggle/delete, persisted on change)
 *
 * Data: GET /api/sprints/:id/retrospective
 * Mutation: PUT /api/sprints/:id/retrospective { went_well?, went_wrong?, action_items? }
 */
export function RetrospectivePanel({ sprint }: RetrospectivePanelProps) {
  const { data: retro, isLoading, isError } = useSprintRetroData(sprint.id);
  const upsert = useUpsertRetro(sprint.id);

  // Stable local copies of retro fields — fall back to empty when no retro yet
  const wentWell = retro?.went_well ?? null;
  const wentWrong = retro?.went_wrong ?? null;
  const actionItems: ActionItem[] = retro?.action_items ?? [];

  function saveField(field: "went_well" | "went_wrong", value: string) {
    upsert.mutate({
      went_well: field === "went_well" ? value || undefined : retro?.went_well ?? undefined,
      went_wrong: field === "went_wrong" ? value || undefined : retro?.went_wrong ?? undefined,
      action_items: actionItems,
    });
  }

  function saveActionItems(items: ActionItem[]) {
    upsert.mutate({
      went_well: retro?.went_well ?? undefined,
      went_wrong: retro?.went_wrong ?? undefined,
      action_items: items,
    });
  }

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
        <AlertCircle className="h-5 w-5" />
        <p className="text-sm">Failed to load retrospective data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!retro && sprint.status !== "completed" && (
        <div className="rounded-md bg-muted/60 border px-4 py-3">
          <p className="text-sm text-muted-foreground">
            No retrospective recorded yet. Start adding notes below — they will
            be auto-saved.
          </p>
        </div>
      )}

      {upsert.isError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-sm text-destructive">
            {upsert.error instanceof Error
              ? upsert.error.message
              : "Failed to save retrospective."}
          </p>
        </div>
      )}

      {/* Two-column layout on wide screens */}
      <div className="grid sm:grid-cols-2 gap-4">
        <SectionEditor
          label="What went well"
          icon={<ThumbsUp className="h-4 w-4" />}
          value={wentWell}
          onSave={(v) => saveField("went_well", v)}
          isSaving={upsert.isPending}
          placeholder="Describe what worked well during the sprint…"
          accentClass="text-emerald-600 dark:text-emerald-400"
        />
        <SectionEditor
          label="What went wrong"
          icon={<ThumbsDown className="h-4 w-4" />}
          value={wentWrong}
          onSave={(v) => saveField("went_wrong", v)}
          isSaving={upsert.isPending}
          placeholder="Describe what could be improved…"
          accentClass="text-red-600 dark:text-red-400"
        />
      </div>

      <Separator />

      {/* Action items — full width */}
      <ActionItemsEditor
        items={actionItems}
        onUpdate={saveActionItems}
        isSaving={upsert.isPending}
      />
    </div>
  );
}
