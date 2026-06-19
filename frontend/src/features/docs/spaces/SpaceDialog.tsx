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
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SpaceDialog({
  open,
  onOpenChange,
  mode,
  onSubmit,
  isPending = false,
}: SpaceDialogProps) {
  const isEdit = mode.kind === "edit";
  const existing = isEdit ? mode.space : null;

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
    },
  });

  // Reset defaults whenever the dialog re-opens for a different mode.
  React.useEffect(() => {
    reset({
      name: existing?.name ?? "",
      icon: existing?.icon ?? "",
      description: existing?.description ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectedIcon = watch("icon");

  function handleFormSubmit(values: SpaceFormValues) {
    const payload: CreateSpacePayload | UpdateSpacePayload = {
      name: values.name.trim(),
      icon: values.icon || undefined,
      description: values.description.trim() || undefined,
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
