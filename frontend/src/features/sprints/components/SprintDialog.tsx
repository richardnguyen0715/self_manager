"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, X } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useSprintUIStore } from "../store";
import { useProjectStore } from "@/stores";
import {
  useCreateSprint,
  useUpdateSprint,
  useSprintDetail,
} from "../hooks/useSprints";

// ─── Schema ───────────────────────────────────────────────────────────────────

const sprintSchema = z
  .object({
    name: z.string().min(1, "Sprint name is required").max(255),
    goal_text: z.string().max(1000).optional(),
    start_date: z.string().min(1, "Start date is required"),
    end_date: z.string().min(1, "End date is required"),
    capacity_points: z.coerce
      .number()
      .int()
      .min(0, "Must be ≥ 0")
      .default(0),
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: "End date must be on or after start date",
    path: ["end_date"],
  });

type SprintFormValues = z.infer<typeof sprintSchema>;

// ─── Dialog ───────────────────────────────────────────────────────────────────

export function SprintDialog() {
  const {
    isCreateDialogOpen,
    isEditDialogOpen,
    editingSprintId,
    closeDialog,
  } = useSprintUIStore();
  const { currentProjectId } = useProjectStore();

  const isOpen = isCreateDialogOpen || isEditDialogOpen;
  const isEdit = Boolean(editingSprintId);

  const { data: editingSprint, isLoading: isLoadingSprint } = useSprintDetail(
    editingSprintId ?? "",
  );

  const createMutation = useCreateSprint();
  const updateMutation = useUpdateSprint(editingSprintId ?? "");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SprintFormValues>({
    resolver: zodResolver(sprintSchema),
    defaultValues: {
      name: "",
      goal_text: "",
      start_date: "",
      end_date: "",
      capacity_points: 0,
    },
  });

  useEffect(() => {
    if (editingSprint && isEdit) {
      reset({
        name: editingSprint.name,
        goal_text: editingSprint.goal_text ?? "",
        start_date: editingSprint.start_date,
        end_date: editingSprint.end_date,
        capacity_points: editingSprint.capacity_points,
      });
    } else if (!isEdit) {
      // default start today, end +14d
      const today = new Date();
      const end = new Date();
      end.setDate(today.getDate() + 13);
      reset({
        name: "",
        goal_text: "",
        start_date: today.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        capacity_points: 0,
      });
    }
  }, [editingSprint, isEdit, reset]);

  async function onSubmit(values: SprintFormValues) {
    const payload = {
      name: values.name,
      goal_text: values.goal_text || null,
      start_date: values.start_date,
      end_date: values.end_date,
      capacity_points: values.capacity_points,
      // Only stamp project_id on create, not on edit (to avoid overwriting)
      ...(!isEdit && { project_id: currentProjectId ?? null }),
    };

    if (isEdit && editingSprintId) {
      await updateMutation.mutateAsync(payload);
    } else {
      await createMutation.mutateAsync(payload);
    }
    closeDialog();
  }

  const isPending =
    isSubmitting || createMutation.isPending || updateMutation.isPending;
  const errorMessage =
    createMutation.error?.message ?? updateMutation.error?.message;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Sprint" : "Create Sprint"}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? "Edit sprint details." : "Create a new sprint."}
          </DialogDescription>
        </DialogHeader>

        {isEdit && isLoadingSprint ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="sprint-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sprint-name"
                placeholder="e.g. Sprint 1"
                autoFocus
                {...register("name")}
                className={cn(errors.name && "border-destructive")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Goal text */}
            <div className="space-y-1.5">
              <Label htmlFor="sprint-goal">Sprint goal</Label>
              <Input
                id="sprint-goal"
                placeholder="What is this sprint trying to achieve?"
                {...register("goal_text")}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sprint-start">
                  Start date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sprint-start"
                  type="date"
                  {...register("start_date")}
                  className={cn(errors.start_date && "border-destructive")}
                />
                {errors.start_date && (
                  <p className="text-xs text-destructive">
                    {errors.start_date.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sprint-end">
                  End date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sprint-end"
                  type="date"
                  {...register("end_date")}
                  className={cn(errors.end_date && "border-destructive")}
                />
                {errors.end_date && (
                  <p className="text-xs text-destructive">
                    {errors.end_date.message}
                  </p>
                )}
              </div>
            </div>

            {/* Capacity */}
            <div className="space-y-1.5">
              <Label htmlFor="sprint-capacity">
                Capacity (story points)
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  — 0 = unlimited
                </span>
              </Label>
              <Input
                id="sprint-capacity"
                type="number"
                min={0}
                step={1}
                {...register("capacity_points")}
                className={cn(errors.capacity_points && "border-destructive")}
              />
              {errors.capacity_points && (
                <p className="text-xs text-destructive">
                  {errors.capacity_points.message}
                </p>
              )}
            </div>

            {/* API error */}
            {errorMessage && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 flex items-start gap-2">
                <X className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{errorMessage}</p>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? isEdit
                    ? "Saving..."
                    : "Creating..."
                  : isEdit
                    ? "Save changes"
                    : "Create sprint"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
