"use client";

/**
 * CreateWorkItemDialog — full create dialog for a new backlog work item.
 * Follows the TaskDialog pattern exactly (same shadcn/ui Dialog primitives,
 * same radix-select, react-hook-form + zod).
 */

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
import { X, Loader2, CalendarDays, Hash } from "lucide-react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import type { WorkItemType, WorkItemStatus, Priority, Sprint, Epic } from "@/types";
import { WORK_ITEM_TYPES } from "@/types";
import { WORK_ITEM_TYPE_META } from "@/features/workitems/work-item-type-config";
import { useCreateWorkItem } from "@/features/agile";
import { useBacklogStore } from "../store/useBacklogStore";
import { useProjectStore } from "@/stores";

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(4000).optional().nullable(),
  type: z.enum([
    "story", "task", "bug", "habit", "milestone",
    "epic", "debug", "fix", "feat", "docs", "revert", "deploy", "release",
  ]),
  priority: z.enum(["critical", "high", "medium", "low"]),
  status: z.enum(["backlog", "todo", "in_progress", "review", "done"]),
  story_points: z.coerce
    .number()
    .int()
    .refine((v) => [1, 3, 5, 8].includes(v), { message: "Must be 1, 3, 5, or 8" })
    .nullable()
    .optional(),
  epic_id: z.string().optional().nullable(),
  sprint_id: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof schema>;

// ─── Inline select (same pattern as TaskDialog) ───────────────────────────────

interface InlineSelectProps<T extends string> {
  id?: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}

function InlineSelect<T extends string>({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: InlineSelectProps<T>) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        id={id}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
          "focus:outline-none focus:ring-1 focus:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50 gap-2",
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

const TYPE_OPTS: { value: WorkItemType; label: string }[] = WORK_ITEM_TYPES.map(
  (t) => ({ value: t, label: WORK_ITEM_TYPE_META[t].label }),
);

const PRIORITY_OPTS: { value: Priority; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const STATUS_OPTS: { value: WorkItemStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "In Review" },
  { value: "done", label: "Done" },
];

const POINTS_OPTS: { value: string; label: string }[] = [
  { value: "__none__", label: "Unestimated" },
  { value: "1", label: "1 pt" },
  { value: "3", label: "3 pts" },
  { value: "5", label: "5 pts" },
  { value: "8", label: "8 pts" },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface CreateWorkItemDialogProps {
  sprints?: Sprint[];
  epics?: Epic[];
}

export function CreateWorkItemDialog({
  sprints = [],
  epics = [],
}: CreateWorkItemDialogProps) {
  const { dialog, closeDialog } = useBacklogStore();
  const { currentProjectId } = useProjectStore();
  const isOpen = dialog.kind === "create_item";
  const prefillSprintId =
    dialog.kind === "create_item" ? dialog.sprint_id : undefined;

  const createItem = useCreateWorkItem();

  const sprintOpts: { value: string; label: string }[] = [
    { value: "__backlog__", label: "Backlog (no sprint)" },
    ...sprints
      .filter((s) => s.status !== "completed")
      .map((s) => ({ value: s.id, label: s.name })),
  ];

  const epicOpts: { value: string; label: string }[] = [
    { value: "__none__", label: "No epic" },
    ...epics.map((e) => ({ value: e.id, label: e.title })),
  ];

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
      priority: "medium",
      status: "backlog",
      story_points: null,
      epic_id: null,
      sprint_id: prefillSprintId ?? null,
      due_date: null,
    },
  });

  // Reset + prefill when dialog opens
  useEffect(() => {
    if (isOpen) {
      reset({
        title: "",
        description: "",
        type: "task",
        priority: "medium",
        status: "backlog",
        story_points: null,
        epic_id: null,
        sprint_id: prefillSprintId ?? null,
        due_date: null,
      });
    }
  }, [isOpen, prefillSprintId, reset]);

  async function onSubmit(values: FormValues) {
    await createItem.mutateAsync({
      title: values.title,
      description: values.description || null,
      type: values.type,
      priority: values.priority,
      status: values.status,
      story_points: values.story_points ?? null,
      project_id: currentProjectId ?? null,
      epic_id:
        values.epic_id && values.epic_id !== "__none__"
          ? values.epic_id
          : null,
      sprint_id:
        values.sprint_id && values.sprint_id !== "__backlog__"
          ? values.sprint_id
          : null,
      due_date: values.due_date
        ? values.due_date.length === 10
          ? `${values.due_date}T00:00:00Z`
          : values.due_date
        : null,
    });
    closeDialog();
  }

  const isPending = isSubmitting || createItem.isPending;
  const errorMsg = createItem.error?.message;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="w-[95vw] max-w-xl max-h-[90vh] overflow-y-auto sm:w-auto">
        <DialogHeader>
          <DialogTitle>Create Work Item</DialogTitle>
          <DialogDescription className="sr-only">
            Fill in the details and click Create.
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
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="wi-description">Description</Label>
            <textarea
              id="wi-description"
              rows={3}
              placeholder="Add details or context..."
              {...register("description")}
              className={cn(
                "flex w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
            />
          </div>

          {/* Type + Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    options={TYPE_OPTS}
                  />
                )}
              />
            </div>
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
                    options={PRIORITY_OPTS}
                  />
                )}
              />
            </div>
          </div>

          {/* Status + Story Points */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    options={STATUS_OPTS}
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wi-points" className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                Story points
              </Label>
              <Controller
                control={control}
                name="story_points"
                render={({ field }) => (
                  <InlineSelect<string>
                    id="wi-points"
                    value={field.value != null ? String(field.value) : "__none__"}
                    onChange={(v) =>
                      field.onChange(v === "__none__" ? null : Number(v))
                    }
                    options={POINTS_OPTS}
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

          {/* Epic + Sprint */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {epics.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="wi-epic">Epic</Label>
                <Controller
                  control={control}
                  name="epic_id"
                  render={({ field }) => (
                    <InlineSelect<string>
                      id="wi-epic"
                      value={field.value ?? "__none__"}
                      onChange={(v) =>
                        field.onChange(v === "__none__" ? null : v)
                      }
                      options={epicOpts}
                    />
                  )}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="wi-sprint">Sprint</Label>
              <Controller
                control={control}
                name="sprint_id"
                render={({ field }) => (
                  <InlineSelect<string>
                    id="wi-sprint"
                    value={field.value ?? "__backlog__"}
                    onChange={(v) =>
                      field.onChange(v === "__backlog__" ? null : v)
                    }
                    options={sprintOpts}
                  />
                )}
              />
            </div>
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <Label htmlFor="wi-due" className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              Due date
            </Label>
            <Controller
              control={control}
              name="due_date"
              render={({ field }) => (
                <DateInput
                  id="wi-due"
                  value={field.value ?? ""}
                  onChange={(v) => field.onChange(v || null)}
                />
              )}
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
              onClick={closeDialog}
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
                "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
