"use client";

import { useState, useRef } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Subtask } from "@/types";
import {
  useCreateSubtask,
  useUpdateSubtask,
  useDeleteSubtask,
} from "../hooks/useTasks";

interface SubtaskListProps {
  taskId: string;
  subtasks: Subtask[];
}

interface SubtaskItemProps {
  taskId: string;
  subtask: Subtask;
}

function SubtaskItem({ taskId, subtask }: SubtaskItemProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(subtask.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateMutation = useUpdateSubtask(taskId, subtask.id);
  const deleteMutation = useDeleteSubtask(taskId);

  function handleToggle(checked: boolean) {
    updateMutation.mutate({ is_done: checked });
  }

  function handleTitleBlur() {
    setEditing(false);
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(subtask.title);
      return;
    }
    if (trimmed !== subtask.title) {
      updateMutation.mutate({ title: trimmed });
    }
  }

  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") inputRef.current?.blur();
    if (e.key === "Escape") {
      setTitle(subtask.title);
      setEditing(false);
    }
  }

  return (
    <li className="group flex items-center gap-2 py-1">
      <GripVertical
        className="h-4 w-4 shrink-0 text-muted-foreground/40 opacity-0 group-hover:opacity-100 cursor-grab"
        aria-hidden="true"
      />

      <CheckboxPrimitive.Root
        checked={subtask.is_done}
        onCheckedChange={handleToggle}
        disabled={updateMutation.isPending}
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border border-input transition-colors",
          "data-[state=checked]:bg-primary data-[state=checked]:border-primary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "disabled:opacity-50",
        )}
      >
        <CheckboxPrimitive.Indicator>
          <Check className="h-3 w-3 text-primary-foreground" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>

      {editing ? (
        <input
          ref={inputRef}
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          className="flex-1 bg-transparent text-sm outline-none focus:ring-0 border-b border-input"
        />
      ) : (
        <span
          role="button"
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setEditing(true);
          }}
          className={cn(
            "flex-1 text-sm cursor-text",
            subtask.is_done && "line-through text-muted-foreground",
          )}
        >
          {subtask.title}
        </span>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
        onClick={() => deleteMutation.mutate(subtask.id)}
        disabled={deleteMutation.isPending}
        aria-label="Delete subtask"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

export function SubtaskList({ taskId, subtasks }: SubtaskListProps) {
  const [newTitle, setNewTitle] = useState("");
  const createMutation = useCreateSubtask(taskId);

  const completedCount = subtasks.filter((s) => s.is_done).length;

  function handleAdd() {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    createMutation.mutate(
      { title: trimmed },
      {
        onSuccess: () => setNewTitle(""),
      },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleAdd();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          Subtasks
          {subtasks.length > 0 && (
            <span className="ml-1.5 text-xs tabular-nums">
              {completedCount}/{subtasks.length}
            </span>
          )}
        </p>
        {subtasks.length > 0 && (
          <div
            className="h-1.5 w-24 rounded-full bg-muted overflow-hidden"
            title={`${Math.round((completedCount / subtasks.length) * 100)}% complete`}
          >
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{
                width: `${Math.round((completedCount / subtasks.length) * 100)}%`,
              }}
            />
          </div>
        )}
      </div>

      {subtasks.length > 0 && (
        <ul className="space-y-0.5">
          {subtasks
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((subtask) => (
              <SubtaskItem key={subtask.id} taskId={taskId} subtask={subtask} />
            ))}
        </ul>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Input
          placeholder="Add subtask..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 text-sm"
          disabled={createMutation.isPending}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleAdd}
          disabled={!newTitle.trim() || createMutation.isPending}
          className="h-7 shrink-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
