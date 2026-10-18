"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRightCircle, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useCreateRetroAction,
  useConvertRetroAction,
  useDeleteRetroAction,
  useUpdateRetroAction,
} from "../hooks/useRetroChildren";
import type { RetroAction } from "../types";
import { AutosaveTextarea } from "./SectionCards";

// ─── Full panel (retro page) ──────────────────────────────────────────────────

interface ActionsPanelProps {
  retroId: string;
  actions: RetroAction[];
}

/** Add, edit, complete, convert and delete the actions of one retro. */
export function ActionsPanel({ retroId, actions }: ActionsPanelProps) {
  const create = useCreateRetroAction(retroId);
  const [text, setText] = useState("");
  const [due, setDue] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    create.mutate(
      { text: trimmed, due_date: due || null },
      {
        onSuccess: () => {
          setText("");
          setDue("");
        },
      },
    );
  };

  const open = actions.filter((a) => a.status === "open");
  const closed = actions.filter((a) => a.status !== "open");

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex flex-col gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an action…"
          aria-label="New action text"
        />
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            aria-label="Due date"
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          />
          <Button type="submit" size="sm" disabled={!text.trim() || create.isPending} className="ml-auto">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </form>

      {actions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No actions yet.</p>
      ) : null}

      <ul className="space-y-2">
        {open.map((a) => (
          <ActionRow key={a.id} action={a} />
        ))}
      </ul>

      {closed.length > 0 ? (
        <div className="space-y-2 pt-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Closed
          </p>
          <ul className="space-y-2">
            {closed.map((a) => (
              <ActionRow key={a.id} action={a} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// ─── Single action row (shared with the open-actions card) ────────────────────

interface ActionRowProps {
  action: RetroAction;
  /** Shown as a link above the text, e.g. the originating retro on the global list. */
  source?: { href: string; label: string };
}

export function ActionRow({ action, source }: ActionRowProps) {
  const update = useUpdateRetroAction();
  const remove = useDeleteRetroAction();
  const convert = useConvertRetroAction();

  const isDone = action.status === "done";
  const isDropped = action.status === "dropped";
  const carried = action.carry_count > 0;

  return (
    <li
      className={cn(
        "group rounded-md border bg-card p-2.5",
        (isDone || isDropped) && "opacity-70",
      )}
    >
      {source ? (
        <Link href={source.href} className="mb-1 block truncate text-xs text-muted-foreground hover:underline">
          {source.label}
        </Link>
      ) : null}

      <div className="flex items-start gap-2">
        <button
          type="button"
          role="checkbox"
          aria-checked={isDone}
          aria-label={isDone ? "Reopen action" : "Mark action done"}
          disabled={update.isPending}
          onClick={() =>
            update.mutate({
              actionId: action.id,
              status: isDone ? "open" : "done",
            })
          }
          className={cn(
            "mt-2 h-4 w-4 shrink-0 rounded border",
            isDone ? "border-primary bg-primary" : "border-input",
          )}
        />

        <div className="min-w-0 flex-1 space-y-1.5">
          <AutosaveTextarea
            key={action.id}
            initialValue={action.text}
            rows={1}
            ariaLabel="Action text"
            onSave={(text) => {
              if (text.trim()) update.mutate({ actionId: action.id, text: text.trim() });
            }}
            className={cn(
              "min-h-0 border-0 bg-transparent px-1 py-0.5 shadow-none focus-visible:ring-0",
              (isDone || isDropped) && "line-through",
            )}
          />

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              type="date"
              aria-label="Due date"
              value={action.due_date ?? ""}
              onChange={(e) =>
                update.mutate({ actionId: action.id, due_date: e.target.value || null })
              }
              className="h-7 rounded border border-input bg-background px-1.5 text-xs"
            />

            {carried ? (
              <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400">
                carried ×{action.carry_count}
              </Badge>
            ) : null}

            {isDropped ? (
              <Badge variant="secondary">dropped</Badge>
            ) : null}

            {action.work_item_id ? (
              <Link
                href={`/work-items/${action.work_item_id}`}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <ArrowRightCircle className="h-3.5 w-3.5" />
                Work item
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => convert.mutate(action.id)}
                disabled={convert.isPending}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <ArrowRightCircle className="h-3.5 w-3.5" />
                {convert.isPending ? "Converting…" : "Convert to work item"}
              </button>
            )}

            {!isDone && !isDropped ? (
              <button
                type="button"
                onClick={() => update.mutate({ actionId: action.id, status: "dropped" })}
                className="text-muted-foreground hover:text-foreground"
              >
                Drop
              </button>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          aria-label="Delete action"
          onClick={() => remove.mutate(action.id)}
          className="mt-1 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}
