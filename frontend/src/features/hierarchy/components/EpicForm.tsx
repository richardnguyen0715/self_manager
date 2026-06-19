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
import type { Epic, EpicStatus } from "@/types";
import { useCreateEpic, useUpdateEpic } from "../hooks/useHierarchy";

// ─── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(["todo", "in_progress", "done", "cancelled"] as const),
  start_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Props ─────────────────────────────────────────────────────────────────────

interface EpicFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initiativeId?: string;
  epic?: Epic;
}

// ─── Component ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: EpicStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

export function EpicForm({
  open,
  onOpenChange,
  initiativeId,
  epic,
}: EpicFormProps) {
  const isEdit = Boolean(epic);
  const createEpic = useCreateEpic();
  const updateEpic = useUpdateEpic();

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: epic?.title ?? "",
      description: epic?.description ?? null,
      status: epic?.status ?? "todo",
      start_date: epic?.start_date ?? null,
      due_date: epic?.due_date ?? null,
    },
  });

  useEffect(() => {
    reset({
      title: epic?.title ?? "",
      description: epic?.description ?? null,
      status: epic?.status ?? "todo",
      start_date: epic?.start_date ?? null,
      due_date: epic?.due_date ?? null,
    });
  }, [epic, reset]);

  const statusValue = watch("status");

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEdit && epic) {
        await updateEpic.mutateAsync({
          id: epic.id,
          title: values.title,
          description: values.description ?? null,
          status: values.status,
          start_date: values.start_date ?? null,
          due_date: values.due_date ?? null,
        });
      } else if (initiativeId) {
        await createEpic.mutateAsync({
          initiative_id: initiativeId,
          title: values.title,
          description: values.description ?? null,
          status: values.status,
          start_date: values.start_date ?? null,
          due_date: values.due_date ?? null,
        });
      }
      onOpenChange(false);
      reset();
    } catch {
      // error surfaced via mutation state
    }
  };

  const mutationError =
    (isEdit ? updateEpic.error : createEpic.error)?.message ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Epic" : "New Epic"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this epic."
              : "Create a multi-sprint body of work."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="epic-title">Title</Label>
              <Input
                id="epic-title"
                placeholder="e.g. Learn Rust"
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
              <Label htmlFor="epic-description">
                Description{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <textarea
                id="epic-description"
                rows={3}
                placeholder="Describe this epic..."
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                {...register("description")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="epic-status">Status</Label>
              <select
                id="epic-status"
                value={statusValue}
                onChange={(e) =>
                  setValue("status", e.target.value as EpicStatus)
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="epic-start-date">Start date</Label>
                <Controller
                  control={control}
                  name="start_date"
                  render={({ field }) => (
                    <DateInput
                      id="epic-start-date"
                      value={field.value ?? ""}
                      onChange={(v) => field.onChange(v || null)}
                    />
                  )}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="epic-due-date">Due date</Label>
                <Controller
                  control={control}
                  name="due_date"
                  render={({ field }) => (
                    <DateInput
                      id="epic-due-date"
                      value={field.value ?? ""}
                      onChange={(v) => field.onChange(v || null)}
                    />
                  )}
                />
              </div>
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
                  : "Create Epic"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
