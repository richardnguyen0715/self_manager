"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Space } from "@/features/docs";
import type { CreateSpacePayload, UpdateSpacePayload } from "@/features/docs";
import { useProjects } from "@/features/tasks/hooks/useProjects";

const NO_PROJECT = "__none__";

// ─── Emoji picker (small static list) ────────────────────────────────────────

const ICON_GLYPHS = [
  "📘", "📗", "📙", "📕", "📓", "📒", "📔", "📃",
  "📝", "📋", "🗒️", "🗂️", "📁", "📂", "🗃️", "💡",
  "🚀", "⭐", "🎯", "🔥", "✅", "💼", "🏗️", "🧩",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpaceFormValues {
  name: string;
  icon: string;
  description: string;
  /** Project UUID, or NO_PROJECT for unassigned. */
  project_id: string;
}

type SpaceDialogMode =
  | { kind: "create" }
  | { kind: "edit"; space: Space };

interface SpaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: SpaceDialogMode;
  /** Called with the validated payload; caller owns the mutation. */
  onSubmit: (payload: CreateSpacePayload | UpdateSpacePayload) => void;
  isPending?: boolean;
  /** Pre-selected project for the create form (e.g. the active project). */
  defaultProjectId?: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SpaceDialog({
  open,
  onOpenChange,
  mode,
  onSubmit,
  isPending = false,
  defaultProjectId = null,
}: SpaceDialogProps) {
  const isEdit = mode.kind === "edit";
  const existing = isEdit ? mode.space : null;
  const { data: projects = [] } = useProjects();

  // Initial project selection: the space's own project when editing, else the
  // active project passed by the caller.
  const initialProject =
    (isEdit ? existing?.project_id : defaultProjectId) ?? "";

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<SpaceFormValues>({
    defaultValues: {
      name: existing?.name ?? "",
      icon: existing?.icon ?? "",
      description: existing?.description ?? "",
      project_id: initialProject || NO_PROJECT,
    },
  });

  // Reset defaults whenever the dialog re-opens for a different mode.
  React.useEffect(() => {
    reset({
      name: existing?.name ?? "",
      icon: existing?.icon ?? "",
      description: existing?.description ?? "",
      project_id: initialProject || NO_PROJECT,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectedIcon = watch("icon");

  function handleFormSubmit(values: SpaceFormValues) {
    const projectId =
      values.project_id === NO_PROJECT ? null : values.project_id;
    const payload: CreateSpacePayload | UpdateSpacePayload = {
      name: values.name.trim(),
      icon: values.icon || undefined,
      description: values.description.trim() || undefined,
      // Create: omit null (unassigned). Edit: send null to clear assignment.
      project_id: isEdit ? projectId : projectId ?? undefined,
    };
    onSubmit(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit space" : "Create space"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this space's details."
              : "Spaces are containers for pages — like a wiki section or project docs."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Icon picker */}
          <div className="space-y-2">
            <Label>Icon (optional)</Label>
            <div className="flex flex-wrap gap-1.5">
              {ICON_GLYPHS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setValue("icon", g === selectedIcon ? "" : g)}
                  className={`flex h-8 w-8 items-center justify-center rounded text-lg transition-colors hover:bg-accent ${
                    selectedIcon === g
                      ? "ring-2 ring-ring bg-accent"
                      : "hover:ring-1 hover:ring-border"
                  }`}
                  aria-label={`Select icon ${g}`}
                >
                  {g}
                </button>
              ))}
              {/* Clear button */}
              {selectedIcon && (
                <button
                  type="button"
                  onClick={() => setValue("icon", "")}
                  className="flex h-8 w-8 items-center justify-center rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  aria-label="Clear icon"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="space-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="space-name"
              placeholder="e.g. Engineering Docs"
              autoFocus
              {...register("name", {
                required: "Name is required",
                maxLength: { value: 200, message: "Max 200 characters" },
              })}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="space-desc">Description (optional)</Label>
            <Input
              id="space-desc"
              placeholder="What is this space for?"
              {...register("description")}
            />
          </div>

          {/* Project assignment */}
          <div className="space-y-2">
            <Label htmlFor="space-project">Project</Label>
            <select
              id="space-project"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              {...register("project_id")}
            >
              <option value={NO_PROJECT}>No project (all projects only)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Only the chosen project sees this space. &ldquo;No project&rdquo; shows
              it only under All projects.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save changes"
                  : "Create space"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
