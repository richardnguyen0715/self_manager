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
import type { WorkItem, WorkItemStatus, WorkItemType, Priority } from "@/types";
import { useCreateWorkItem, useUpdateWorkItem } from "../hooks/useHierarchy";
import { InlineSelect } from "./InlineSelect";

// ─── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(4000).nullable().optional(),
  type: z.enum(["story", "task", "bug", "habit", "milestone"] as const),
  status: z.enum([
    "backlog",
    "todo",
    "in_progress",
    "review",
    "done",
  ] as const),
  priority: z.enum(["critical", "high", "medium", "low"] as const),
  story_points: z.coerce
    .number()
    .refine((v) => [1, 3, 5, 8].includes(v) || v === 0, {
      message: "Must be 1, 3, 5, or 8",
    })
    .nullable()
    .optional(),
  due_date: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Options ──────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: WorkItemType; label: string }[] = [
  { value: "story", label: "Story" },
  { value: "task", label: "Task" },
  { value: "bug", label: "Bug" },
  { value: "habit", label: "Habit" },
  { value: "milestone", label: "Milestone" },
];

const STATUS_OPTIONS: { value: WorkItemStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
];

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const POINTS_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "Unestimated" },
  { value: "1", label: "1 pt" },
  { value: "3", label: "3 pts" },
  { value: "5", label: "5 pts" },
  { value: "8", label: "8 pts" },
];

// ─── Props ─────────────────────────────────────────────────────────────────────

interface WorkItemFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  epicId?: string;
  workItem?: WorkItem;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WorkItemForm({
  open,
  onOpenChange,
  epicId,
  workItem,
}: WorkItemFormProps) {
  const isEdit = Boolean(workItem);
  const createWorkItem = useCreateWorkItem();
  const updateWorkItem = useUpdateWorkItem();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: workItem?.title ?? "",
      description: workItem?.description ?? null,
      type: workItem?.type ?? "task",
      status: workItem?.status ?? "backlog",
      priority: workItem?.priority ?? "medium",
      story_points: workItem?.story_points ?? null,
      due_date: workItem?.due_date?.slice(0, 10) ?? null,
    },
  });

  useEffect(() => {
    reset({
      title: workItem?.title ?? "",
      description: workItem?.description ?? null,
      type: workItem?.type ?? "task",
      status: workItem?.status ?? "backlog",
      priority: workItem?.priority ?? "medium",
      story_points: workItem?.story_points ?? null,
      due_date: workItem?.due_date?.slice(0, 10) ?? null,
    });
  }, [workItem, reset]);

  const onSubmit = async (values: FormValues) => {
    const points =
      values.story_points && values.story_points > 0
        ? values.story_points
        : null;

    try {
      if (isEdit && workItem) {
        await updateWorkItem.mutateAsync({
          id: workItem.id,
          title: values.title,
          description: values.description ?? null,
          type: values.type,
          status: values.status,
          priority: values.priority,
          story_points: points,
          due_date: values.due_date ? `${values.due_date}T00:00:00Z` : null,
        });
      } else if (epicId) {
        await createWorkItem.mutateAsync({
          title: values.title,
          description: values.description ?? null,
          type: values.type,
          epic_id: epicId,
          status: values.status,
          priority: values.priority,
          story_points: points,
          due_date: values.due_date ? `${values.due_date}T00:00:00Z` : null,
        });
      }
      onOpenChange(false);
      reset();
    } catch {
      // error surfaced via mutation state
    }
  };

  const mutationError =
    (isEdit ? updateWorkItem.error : createWorkItem.error)?.message ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Work Item" : "New Work Item"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update work item details." : "Create a new work item."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wi-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="wi-title"
                placeholder="What needs to be done?"
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
              <Label htmlFor="wi-description">Description</Label>
              <textarea
                id="wi-description"
                rows={3}
                placeholder="Add details or context..."
                className="flex w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                {...register("description")}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wi-type">Type</Label>
                <Controller
                  control={control}
                  name="type"
                  render={({ field }) => (
                    <InlineSelect<WorkItemType>
                      id="wi-type"
                      value={field.value}
                      onChange={field.onChange}
                      options={TYPE_OPTIONS}
                    />
                  )}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wi-status">Status</Label>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <InlineSelect<WorkItemStatus>
                      id="wi-status"
                      value={field.value}
                      onChange={field.onChange}
                      options={STATUS_OPTIONS}
                    />
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wi-priority">Priority</Label>
                <Controller
                  control={control}
                  name="priority"
                  render={({ field }) => (
                    <InlineSelect<Priority>
                      id="wi-priority"
                      value={field.value}
                      onChange={field.onChange}
                      options={PRIORITY_OPTIONS}
                    />
                  )}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wi-points">Story Points</Label>
                <Controller
                  control={control}
                  name="story_points"
                  render={({ field }) => (
                    <InlineSelect<string>
                      id="wi-points"
                      value={String(field.value ?? 0)}
                      onChange={(v) =>
                        field.onChange(v === "0" ? null : Number(v))
                      }
                      options={POINTS_OPTIONS}
                    />
                  )}
                />
                {errors.story_points && (
                  <p className="text-xs text-destructive">
                    {errors.story_points.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wi-due-date">Due date</Label>
              <Controller
                control={control}
                name="due_date"
                render={({ field }) => (
                  <DateInput
                    id="wi-due-date"
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v || null)}
                  />
                )}
              />
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
                  : "Create Work Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
