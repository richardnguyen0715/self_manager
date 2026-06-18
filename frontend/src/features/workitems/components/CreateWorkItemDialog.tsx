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
import { cn } from "@/lib/utils";
import { CalendarDays, X, Loader2, ChevronDown, Check } from "lucide-react";
import * as SelectPrimitive from "@radix-ui/react-select";
import type { Priority, WorkItemStatus, WorkItemType } from "@/types";
import { useCreateWorkItem } from "../hooks/useWorkItems";
import { useWorkItemUIStore } from "../store";
import { useProjectStore } from "@/stores";
import type { CreateWorkItemPayload } from "../types";

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(4000).optional().nullable(),
  type: z.enum(["story", "task", "bug", "habit", "milestone"]),
  status: z.enum(["backlog", "todo", "in_progress", "review", "done"]),
  priority: z.enum(["critical", "high", "medium", "low"]),
  story_points: z.coerce.number().int().nullable().optional(),
  due_date: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof schema>;

// ─── Inline select ────────────────────────────────────────────────────────────

interface InlineSelectProps<T extends string> {
  id?: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  placeholder?: string;
  className?: string;
}

function InlineSelect<T extends string>({
  id,
  value,
  onChange,
  options,
  placeholder,
  className,
}: InlineSelectProps<T>) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange}>
      <SelectPrimitive.Trigger
        id={id}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm gap-2",
          "focus:outline-none focus:ring-1 focus:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:translate-y-1",
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className={cn(
                  "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
                  "focus:bg-accent focus:text-accent-foreground",
                )}
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <Check className="h-4 w-4" />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

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
  { value: "review", label: "In Review" },
  { value: "done", label: "Done" },
];

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const POINTS_OPTIONS: { value: string; label: string }[] = [
  { value: "__none__", label: "Unestimated" },
  { value: "1", label: "1" },
  { value: "3", label: "3" },
  { value: "5", label: "5" },
  { value: "8", label: "8" },
];

// ─── Dialog ───────────────────────────────────────────────────────────────────

export function CreateWorkItemDialog() {
  const { isCreateDialogOpen, closeCreateDialog } = useWorkItemUIStore();
  const { currentProjectId } = useProjectStore();
  const createMutation = useCreateWorkItem();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      type: "task",
      status: "backlog",
      priority: "medium",
      story_points: null,
      due_date: null,
    },
  });

  useEffect(() => {
    if (!isCreateDialogOpen) {
      reset();
    }
  }, [isCreateDialogOpen, reset]);

  function toIso(v: string | null | undefined): string | null {
    if (!v) return null;
    return v.length === 10 ? `${v}T00:00:00Z` : v;
  }

  async function onSubmit(values: FormValues) {
    const payload: CreateWorkItemPayload = {
      title: values.title,
      description: values.description || null,
      type: values.type,
      status: values.status,
      priority: values.priority,
      story_points: values.story_points ?? null,
      due_date: toIso(values.due_date),
      project_id: currentProjectId ?? null,
    };
    await createMutation.mutateAsync(payload);
    closeCreateDialog();
    reset();
  }

  const isPending = isSubmitting || createMutation.isPending;
  const errorMessage = createMutation.error?.message;

  return (
    <Dialog
      open={isCreateDialogOpen}
      onOpenChange={(open) => !open && closeCreateDialog()}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Work Item</DialogTitle>
          <DialogDescription className="sr-only">
            Fill in the details and click create.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="wi-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="wi-title"
              placeholder="What needs to be done?"
              autoFocus
              {...register("title")}
              className={cn(errors.title && "border-destructive")}
            />
            {errors.title && (
              <p className="text-xs text-destructive">
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="wi-description">Description</Label>
            <textarea
              id="wi-description"
              rows={3}
              placeholder="Add details, notes, or context..."
              {...register("description")}
              className={cn(
                "flex w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
            />
          </div>

          {/* Type + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
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

          {/* Priority + Points */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <Label htmlFor="wi-points">Story points</Label>
              <Controller
                control={control}
                name="story_points"
                render={({ field }) => (
                  <InlineSelect<string>
                    id="wi-points"
                    value={
                      field.value == null ? "__none__" : String(field.value)
                    }
                    onChange={(v) =>
                      field.onChange(v === "__none__" ? null : Number(v))
                    }
                    options={POINTS_OPTIONS}
                  />
                )}
              />
            </div>
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <Label
              htmlFor="wi-due-date"
              className="flex items-center gap-1.5"
            >
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              Due date
            </Label>
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
              onClick={closeCreateDialog}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Creating...
                </>
              ) : (
                "Create work item"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
