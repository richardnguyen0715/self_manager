"use client";

/**
 * CreateSprintDialog — create a new sprint from the backlog screen.
 * Same Dialog + react-hook-form + zod pattern as TaskDialog.
 */

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
import { cn } from "@/lib/utils";
import { X, Loader2, CalendarDays, Hash } from "lucide-react";
import { useCreateSprint } from "@/features/agile";
import { useBacklogStore } from "../store/useBacklogStore";
import { useProjectStore } from "@/stores";

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z
  .object({
    name: z.string().min(1, "Sprint name is required").max(100),
    goal_text: z.string().max(500).optional().nullable(),
    start_date: z.string().min(1, "Start date is required"),
    end_date: z.string().min(1, "End date is required"),
    capacity_points: z.coerce.number().int().min(0).optional(),
  })
  .refine((d) => d.end_date >= d.start_date, {
    message: "End date must be on or after start date",
    path: ["end_date"],
  });

type FormValues = z.infer<typeof schema>;

// ─── Component ────────────────────────────────────────────────────────────────

export function CreateSprintDialog() {
  const { dialog, closeDialog } = useBacklogStore();
  const { currentProjectId } = useProjectStore();
  const isOpen = dialog.kind === "create_sprint";
  const createSprint = useCreateSprint();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      goal_text: "",
      start_date: "",
      end_date: "",
      capacity_points: 0,
    },
  });

  function handleClose() {
    reset();
    closeDialog();
  }

  async function onSubmit(values: FormValues) {
    await createSprint.mutateAsync({
      name: values.name,
      goal_text: values.goal_text || null,
      start_date: values.start_date,
      end_date: values.end_date,
      capacity_points: values.capacity_points ?? 0,
      project_id: currentProjectId ?? null,
    });
    reset();
    closeDialog();
  }

  const isPending = isSubmitting || createSprint.isPending;
  const errorMsg = createSprint.error?.message;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="w-[95vw] max-w-md sm:w-auto">
        <DialogHeader>
          <DialogTitle>Create Sprint</DialogTitle>
          <DialogDescription className="sr-only">
            Fill in sprint details and click Create.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="sprint-name">
              Sprint name <span className="text-destructive">*</span>
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
            <textarea
              id="sprint-goal"
              rows={2}
              placeholder="What is the goal of this sprint?"
              {...register("goal_text")}
              className={cn(
                "flex w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sprint-start" className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                Start date <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="start_date"
                render={({ field }) => (
                  <DateInput
                    id="sprint-start"
                    value={field.value}
                    onChange={field.onChange}
                    className={cn(errors.start_date && "border-destructive")}
                  />
                )}
              />
              {errors.start_date && (
                <p className="text-xs text-destructive">
                  {errors.start_date.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sprint-end" className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                End date <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="end_date"
                render={({ field }) => (
                  <DateInput
                    id="sprint-end"
                    value={field.value}
                    onChange={field.onChange}
                    className={cn(errors.end_date && "border-destructive")}
                  />
                )}
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
            <Label htmlFor="sprint-capacity" className="flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              Capacity (story points)
              <span className="text-xs font-normal text-muted-foreground ml-1">
                0 = unlimited
              </span>
            </Label>
            <Input
              id="sprint-capacity"
              type="number"
              min={0}
              step={1}
              placeholder="0"
              {...register("capacity_points")}
            />
          </div>

          {/* API error */}
          {errorMsg && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 flex items-start gap-2">
              <X className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">{errorMsg}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create sprint"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
