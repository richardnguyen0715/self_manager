"use client";

import { useState, useId } from "react";
import {
  Loader2,
  Plus,
  X,
  Check,
  Pencil,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Retrospective } from "@/types";
import {
  useSprintRetroData,
  useUpsertRetrospective,
} from "../hooks/useSprints";

// ─── Action item row ──────────────────────────────────────────────────────────

interface ActionItemRowProps {
  item: { id: string; text: string; done?: boolean };
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

function ActionItemRow({ item, onToggle, onDelete }: ActionItemRowProps) {
  return (
    <div className="group flex items-center gap-2 py-1.5">
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        className={cn(
          "h-4 w-4 rounded border border-input flex items-center justify-center shrink-0 transition-colors",
          item.done
            ? "bg-emerald-500 border-emerald-500 text-white"
            : "hover:border-primary",
        )}
        aria-label={item.done ? "Mark incomplete" : "Mark done"}
      >
        {item.done && <Check className="h-2.5 w-2.5" />}
      </button>
      <span
        className={cn(
          "flex-1 text-sm",
          item.done && "line-through text-muted-foreground",
        )}
      >
        {item.text}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0"
        onClick={() => onDelete(item.id)}
        aria-label="Remove action item"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ─── Edit form ────────────────────────────────────────────────────────────────

interface RetroEditFormProps {
  sprintId: string;
  existing: Retrospective | undefined;
  onCancel: () => void;
}

function RetroEditForm({ sprintId, existing, onCancel }: RetroEditFormProps) {
  const upsert = useUpsertRetrospective(sprintId);
  const uid = useId();

  const [wentWell, setWentWell] = useState(existing?.went_well ?? "");
  const [wentWrong, setWentWrong] = useState(existing?.went_wrong ?? "");
  const [actionItems, setActionItems] = useState<
    { id: string; text: string; done?: boolean }[]
  >(existing?.action_items ?? []);
  const [newAction, setNewAction] = useState("");

  function addAction() {
    const text = newAction.trim();
    if (!text) return;
    setActionItems((prev) => [
      ...prev,
      { id: `ai-${Date.now()}`, text, done: false },
    ]);
    setNewAction("");
  }

  function toggleAction(id: string) {
    setActionItems((prev) =>
      prev.map((a) => (a.id === id ? { ...a, done: !a.done } : a)),
    );
  }

  function deleteAction(id: string) {
    setActionItems((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleSave() {
    await upsert.mutateAsync({
      went_well: wentWell.trim() || undefined,
      went_wrong: wentWrong.trim() || undefined,
      action_items: actionItems,
    });
    onCancel();
  }

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Went well */}
        <div className="space-y-1.5">
          <Label
            htmlFor={`${uid}-well`}
            className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            What went well
          </Label>
          <textarea
            id={`${uid}-well`}
            rows={5}
            value={wentWell}
            onChange={(e) => setWentWell(e.target.value)}
            placeholder="e.g. Great team collaboration, shipped on time..."
            className="flex w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        {/* Went wrong */}
        <div className="space-y-1.5">
          <Label
            htmlFor={`${uid}-wrong`}
            className="flex items-center gap-1.5 text-red-600 dark:text-red-400"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
            What went wrong
          </Label>
          <textarea
            id={`${uid}-wrong`}
            rows={5}
            value={wentWrong}
            onChange={(e) => setWentWrong(e.target.value)}
            placeholder="e.g. Scope creep, unclear requirements..."
            className="flex w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Action items */}
      <div className="space-y-2">
        <Label>Action items</Label>
        <div className="rounded-md border bg-muted/30 px-3 py-2 space-y-0.5 min-h-[3rem]">
          {actionItems.length === 0 && (
            <p className="text-xs text-muted-foreground py-1">
              No action items yet.
            </p>
          )}
          {actionItems.map((ai) => (
            <ActionItemRow
              key={ai.id}
              item={ai}
              onToggle={toggleAction}
              onDelete={deleteAction}
            />
          ))}

          {/* New action input */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={newAction}
              onChange={(e) => setNewAction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAction();
                }
              }}
              placeholder="Add action item… (Enter to add)"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {newAction.trim() && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={addAction}
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Save / cancel */}
      <div className="flex items-center gap-2">
        <Button
          onClick={handleSave}
          disabled={upsert.isPending}
          size="sm"
        >
          {upsert.isPending ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            "Save retrospective"
          )}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        {upsert.error && (
          <p className="text-xs text-destructive ml-2">
            {upsert.error.message}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Read-only view ───────────────────────────────────────────────────────────

interface RetroReadViewProps {
  retro: Retrospective;
  onEdit: () => void;
}

function RetroReadView({ retro, onEdit }: RetroReadViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Retrospective recorded
        </span>
        <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
          Edit
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <ThumbsUp className="h-3.5 w-3.5" />
            What went well
          </h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {retro.went_well || "Nothing noted."}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-red-600 dark:text-red-400">
            <ThumbsDown className="h-3.5 w-3.5" />
            What went wrong
          </h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {retro.went_wrong || "Nothing noted."}
          </p>
        </div>
      </div>

      {retro.action_items.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h4 className="text-sm font-semibold mb-3">Action items</h4>
          <div className="space-y-1.5">
            {retro.action_items.map((ai) => (
              <div key={ai.id} className="flex items-start gap-2 text-sm">
                <span
                  className={cn(
                    "h-4 w-4 mt-0.5 rounded border border-input flex items-center justify-center shrink-0",
                    ai.done &&
                      "bg-emerald-500 border-emerald-500 text-white",
                  )}
                >
                  {ai.done && <Check className="h-2.5 w-2.5" />}
                </span>
                <span
                  className={cn(
                    ai.done && "line-through text-muted-foreground",
                  )}
                >
                  {ai.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface RetrospectivePanelProps {
  sprintId: string;
}

export function RetrospectivePanel({ sprintId }: RetrospectivePanelProps) {
  const { data: retro, isLoading } = useSprintRetroData(sprintId);
  const [isEditing, setIsEditing] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!retro || isEditing) {
    return (
      <RetroEditForm
        sprintId={sprintId}
        existing={retro}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return <RetroReadView retro={retro} onEdit={() => setIsEditing(true)} />;
}
