"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { DateInput } from "@/components/ui/date-input";
import type { Goal, GoalStatus } from "@/types";
import {
  useCreateGoal,
  useUpdateGoal,
  type CreateGoalPayload,
  type UpdateGoalPayload,
} from "../hooks/useGoals";

// ─── Schema ────────────────────────────────────────────────────────────────────

const goalSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(["active", "completed", "abandoned", "paused"] as const),
  target_date: z
    .string()
    .nullable()
    .optional()
    .refine(
      (v) => !v || !isNaN(Date.parse(v)),
      { message: "Invalid date" },
    ),
});

type GoalFormValues = z.infer<typeof goalSchema>;

// ─── Props ─────────────────────────────────────────────────────────────────────

interface GoalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the form operates in edit mode. */
  goal?: Goal;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GoalForm({ open, onOpenChange, goal }: GoalFormProps) {
  const isEdit = Boolean(goal);
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      title: goal?.title ?? "",
      description: goal?.description ?? null,
      status: (goal?.status as GoalStatus) ?? "active",
      target_date: goal?.target_date ?? null,
    },
  });

  // Reset form when the goal prop changes (switching between goals)
  useEffect(() => {
    reset({
      title: goal?.title ?? "",
      description: goal?.description ?? null,
      status: (goal?.status as GoalStatus) ?? "active",
      target_date: goal?.target_date ?? null,
    });
  }, [goal, reset]);

  const statusValue = watch("status");

  const onSubmit = async (values: GoalFormValues) => {
    try {
      if (isEdit && goal) {
        const payload: UpdateGoalPayload & { id: string } = {
          id: goal.id,
          title: values.title,
          description: values.description ?? null,
          status: values.status,
          target_date: values.target_date ?? null,
        };
        await updateGoal.mutateAsync(payload);
      } else {
        const payload: CreateGoalPayload = {
          title: values.title,
          description: values.description ?? null,
          status: values.status,
          target_date: values.target_date ?? null,
        };
        await createGoal.mutateAsync(payload);
      }
      onOpenChange(false);
      reset();
    } catch {
      // Error is surfaced via mutation state — no extra handling needed here
    }
  };

  const mutationError =
    (isEdit ? updateGoal.error : createGoal.error)?.message ?? null;

  const STATUS_OPTIONS: { value: GoalStatus; label: string }[] = [
    { value: "active", label: "Active" },
    { value: "paused", label: "Paused" },
    { value: "completed", label: "Completed" },
    { value: "abandoned", label: "Abandoned" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Goal" : "New Goal"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update your goal details."
              : "Define a high-level objective. You can attach projects to it later."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-4 py-2">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-title">Title</Label>
              <Input
                id="goal-title"
                placeholder="e.g. Launch side project by Q4"
                autoFocus
                {...register("title")}
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-description">
                Description{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <textarea
                id="goal-description"
                rows={3}
                placeholder="What does achieving this goal look like?"
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                {...register("description")}
              />
              {errors.description && (
                <p className="text-xs text-destructive">
                  {errors.description.message}
                </p>
              )}
            </div>

            {/* Status + Deadline row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Status */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="goal-status">Status</Label>
                <select
                  id="goal-status"
                  value={statusValue}
                  onChange={(e) =>
                    setValue("status", e.target.value as GoalStatus)
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

              {/* Target date */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="goal-target-date">
                  Target Date{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Controller
                  control={control}
                  name="target_date"
                  render={({ field }) => (
                    <DateInput
                      id="goal-target-date"
                      value={field.value ?? ""}
                      onChange={(v) => field.onChange(v || null)}
                    />
                  )}
                />
                {errors.target_date && (
                  <p className="text-xs text-destructive">
                    {errors.target_date.message}
                  </p>
                )}
              </div>
            </div>

            {/* API error */}
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
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save Changes"
                  : "Create Goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
