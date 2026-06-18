"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Initiative, InitiativeStatus } from "@/types";
import {
  useCreateInitiative,
  useUpdateInitiative,
} from "../hooks/useHierarchy";

// ─── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(["active", "completed", "paused", "abandoned"] as const),
});

type FormValues = z.infer<typeof schema>;

// ─── Props ─────────────────────────────────────────────────────────────────────

interface InitiativeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goalId?: string;
  initiative?: Initiative;
}

// ─── Component ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: InitiativeStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "abandoned", label: "Abandoned" },
];

export function InitiativeForm({
  open,
  onOpenChange,
  goalId,
  initiative,
}: InitiativeFormProps) {
  const isEdit = Boolean(initiative);
  const createInitiative = useCreateInitiative();
  const updateInitiative = useUpdateInitiative();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initiative?.title ?? "",
      description: initiative?.description ?? null,
      status: initiative?.status ?? "active",
    },
  });

  useEffect(() => {
    reset({
      title: initiative?.title ?? "",
      description: initiative?.description ?? null,
      status: initiative?.status ?? "active",
    });
  }, [initiative, reset]);

  const statusValue = watch("status");

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEdit && initiative) {
        await updateInitiative.mutateAsync({
          id: initiative.id,
          title: values.title,
          description: values.description ?? null,
          status: values.status,
        });
      } else if (goalId) {
        await createInitiative.mutateAsync({
          goal_id: goalId,
          title: values.title,
          description: values.description ?? null,
          status: values.status,
        });
      }
      onOpenChange(false);
      reset();
    } catch {
      // error surfaced via mutation state
    }
  };

  const mutationError =
    (isEdit ? updateInitiative.error : createInitiative.error)?.message ??
    null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Initiative" : "New Initiative"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this strategic initiative."
              : "Create a strategic bucket under your goal."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="initiative-title">Title</Label>
              <Input
                id="initiative-title"
                placeholder="e.g. Backend Mastery"
                autoFocus
                {...register("title")}
              />
              {errors.title && (
                <p className="text-xs text-destructive">
                  {errors.title.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="initiative-description">
                Description{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <textarea
                id="initiative-description"
                rows={3}
                placeholder="Describe this initiative..."
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                {...register("description")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="initiative-status">Status</Label>
              <select
                id="initiative-status"
                value={statusValue}
                onChange={(e) =>
                  setValue("status", e.target.value as InitiativeStatus)
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {mutationError && (
              <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
                {mutationError}
              </p>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                  ? "Save Changes"
                  : "Create Initiative"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
