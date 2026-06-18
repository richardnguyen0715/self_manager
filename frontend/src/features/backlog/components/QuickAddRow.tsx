"use client";

/**
 * QuickAddRow — inline "+ Create" row at the bottom of each section.
 * Matches the Jira "+ Create" affordance below sprint items.
 */

import { useState, useRef, useEffect } from "react";
import { Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateWorkItem } from "@/features/agile";

interface QuickAddRowProps {
  /** If provided, the created item goes straight into this sprint. */
  sprint_id?: string;
  /** Label for the trigger button */
  label?: string;
}

export function QuickAddRow({ sprint_id, label = "Create" }: QuickAddRowProps) {
  const [active, setActive] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const createItem = useCreateWorkItem();

  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) {
      setActive(false);
      return;
    }
    createItem.mutate(
      {
        title: trimmed,
        sprint_id: sprint_id ?? null,
        // Items without a sprint land in backlog (sprint_id null = backlog per contract)
      },
      {
        onSuccess: () => {
          setTitle("");
          setActive(false);
        },
      },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") {
      setTitle("");
      setActive(false);
    }
  }

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setActive(true)}
        className={cn(
          "flex items-center gap-1.5 px-4 py-2 w-full text-sm text-muted-foreground",
          "hover:text-foreground hover:bg-accent/30 transition-colors",
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        {label}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-accent/20">
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Small delay so clicks on the submit button register
          setTimeout(() => {
            if (!createItem.isPending) {
              setTitle("");
              setActive(false);
            }
          }, 150);
        }}
        placeholder="What needs to be done?"
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        disabled={createItem.isPending}
      />
      {createItem.isPending && (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
      )}
    </div>
  );
}
