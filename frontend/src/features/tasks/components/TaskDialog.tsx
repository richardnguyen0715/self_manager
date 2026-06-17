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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CalendarDays, Clock, Tag, FolderOpen, X, Loader2 } from "lucide-react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import type { Priority, TaskStatus, Tag as TagType } from "@/types";
import { useCreateTask, useUpdateTask, useTask } from "../hooks/useTasks";
import { useProjects } from "../hooks/useProjects";
import { useTags } from "../hooks/useTags";
import { useTaskUIStore } from "../store";
import type { CreateTaskPayload } from "../types";
import { SubtaskList } from "./SubtaskList";

// ─── Schema ───────────────────────────────────────────────────────────────────

const taskSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(4000).optional().nullable(),
  priority: z.enum(["critical", "high", "medium", "low"]),
  status: z.enum([
    "inbox",
    "planned",
    "in_progress",
    "waiting",
    "completed",
    "archived",
  ]),
  due_date: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  estimated_time: z.coerce.number().int().min(0).optional().nullable(),
  project_id: z.string().optional().nullable(),
  tag_ids: z.array(z.string()),
  recurrence_rule: z.string().optional().nullable(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

// ─── Inline select (reusable locally) ─────────────────────────────────────────

interface InlineSelectProps<T extends string> {
  id?: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

function InlineSelect<T extends string>({
  id,
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled,
}: InlineSelectProps<T>) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        id={id}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
          "focus:outline-none focus:ring-1 focus:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "gap-2",
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

// ─── Tag multi-picker ──────────────────────────────────────────────────────────

interface TagPickerProps {
  selected: string[];
  onChange: (ids: string[]) => void;
  allTags: TagType[];
}

function TagPicker({ selected, onChange, allTags }: TagPickerProps) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  if (allTags.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No tags yet — create some in Settings.</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {allTags.map((tag) => {
        const isSelected = selected.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggle(tag.id)}
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background text-foreground hover:bg-accent",
            )}
            style={
              isSelected
                ? undefined
                : { borderColor: tag.color ?? undefined, color: tag.color ?? undefined }
            }
            aria-pressed={isSelected}
          >
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "inbox", label: "Inbox" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting", label: "Waiting" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

export function TaskDialog() {
  const {
    isCreateDialogOpen,
    isEditDialogOpen,
    editingTaskId,
    closeDialog,
  } = useTaskUIStore();

  const isOpen = isCreateDialogOpen || isEditDialogOpen;
  const isEdit = Boolean(editingTaskId);

  // Fetch the full TaskResponse when editing — only fires when we have an ID.
  const { data: editingTask, isLoading: isLoadingTask } = useTask(editingTaskId ?? "");

  // Raw arrays directly from the backend.
  const projects = useProjects().data ?? [];
  const allTags = useTags().data ?? [];

  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask(editingTaskId ?? "");

  const projectOptions: { value: string; label: string }[] = [
    { value: "__none__", label: "No project" },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      status: "inbox",
      due_date: null,
      start_date: null,
      estimated_time: null,
      project_id: null,
      tag_ids: [],
      recurrence_rule: null,
    },
  });

  // Populate form when the fetched task arrives (edit mode).
  useEffect(() => {
    if (editingTask) {
      reset({
        title: editingTask.title,
        description: editingTask.description ?? "",
        priority: editingTask.priority,
        status: editingTask.status,
        due_date: editingTask.due_date?.slice(0, 10) ?? null,
        start_date: editingTask.start_date?.slice(0, 10) ?? null,
        estimated_time: editingTask.estimated_time ?? null,
        project_id: editingTask.project_id ?? null,
        tag_ids: editingTask.tags?.map((t) => t.id) ?? [],
        recurrence_rule: editingTask.recurrence_rule ?? null,
      });
    } else if (!isEdit) {
      reset({
        title: "",
        description: "",
        priority: "medium",
        status: "inbox",
        due_date: null,
        start_date: null,
        estimated_time: null,
        project_id: null,
        tag_ids: [],
        recurrence_rule: null,
      });
    }
  }, [editingTask, isEdit, reset]);

  // Backend expects RFC3339 datetimes; <input type="date"> yields "YYYY-MM-DD".
  function toIso(v: string | null | undefined): string | null {
    if (!v) return null;
    return v.length === 10 ? `${v}T00:00:00Z` : v;
  }

  async function onSubmit(values: TaskFormValues) {
    const payload: CreateTaskPayload = {
      title: values.title,
      description: values.description || null,
      priority: values.priority,
      status: values.status,
      due_date: toIso(values.due_date),
      start_date: toIso(values.start_date),
      estimated_time: values.estimated_time ? values.estimated_time : null,
      project_id:
        values.project_id === "__none__" ? null : values.project_id ?? null,
      tag_ids: values.tag_ids,
      recurrence_rule: values.recurrence_rule || null,
    };

    if (isEdit && editingTask) {
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Task" : "Create Task"}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit
              ? "Edit the task details below."
              : "Fill in the task details and click save."}
          </DialogDescription>
        </DialogHeader>

        {/* Show spinner while loading task for edit */}
        {isEdit && isLoadingTask ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="task-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="task-title"
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
              <Label htmlFor="task-description">Description</Label>
              <textarea
                id="task-description"
                rows={3}
                placeholder="Add details, notes, or context..."
                {...register("description")}
                className={cn(
                  "flex w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              />
            </div>

            {/* Priority + Status row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="task-priority">Priority</Label>
                <Controller
                  control={control}
                  name="priority"
                  render={({ field }) => (
                    <InlineSelect<Priority>
                      id="task-priority"
                      value={field.value}
                      onChange={field.onChange}
                      options={PRIORITY_OPTIONS}
                    />
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="task-status">Status</Label>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <InlineSelect<TaskStatus>
                      id="task-status"
                      value={field.value}
                      onChange={field.onChange}
                      options={STATUS_OPTIONS}
                    />
                  )}
                />
              </div>
            </div>

            {/* Dates row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="task-start-date" className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  Start date
                </Label>
                <Input
                  id="task-start-date"
                  type="date"
                  {...register("start_date")}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="task-due-date" className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  Due date
                </Label>
                <Input
                  id="task-due-date"
                  type="date"
                  {...register("due_date")}
                />
              </div>
            </div>

            {/* Estimated time + Project row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="task-estimated-time" className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  Estimated time (min)
                </Label>
                <Input
                  id="task-estimated-time"
                  type="number"
                  min={0}
                  step={5}
                  placeholder="e.g. 30"
                  {...register("estimated_time")}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="task-project" className="flex items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  Project
                </Label>
                <Controller
                  control={control}
                  name="project_id"
                  render={({ field }) => (
                    <InlineSelect<string>
                      id="task-project"
                      value={field.value ?? "__none__"}
                      onChange={(v) =>
                        field.onChange(v === "__none__" ? null : v)
                      }
                      options={projectOptions}
                    />
                  )}
                />
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                Tags
              </Label>
              <Controller
                control={control}
                name="tag_ids"
                render={({ field }) => (
                  <TagPicker
                    selected={field.value}
                    onChange={field.onChange}
                    allTags={allTags}
                  />
                )}
              />
            </div>

            {/* Subtasks — only visible in edit mode when full task is loaded */}
            {isEdit && editingTask && (
              <div className="space-y-1.5 border rounded-md p-3 bg-muted/30">
                <SubtaskList
                  taskId={editingTask.id}
                  subtasks={editingTask.subtasks}
                />
              </div>
            )}

            {/* Recurrence rule */}
            <div className="space-y-1.5">
              <Label htmlFor="task-rrule" className="flex items-center gap-1.5">
                Recurrence rule
                <span className="text-xs font-normal text-muted-foreground">(optional, iCal RRULE)</span>
              </Label>
              <Input
                id="task-rrule"
                placeholder="e.g. FREQ=DAILY;INTERVAL=1"
                {...register("recurrence_rule")}
              />
              {watch("recurrence_rule") && (
                <p className="text-xs text-muted-foreground">
                  Standard iCal RRULE string. Example: FREQ=WEEKLY;BYDAY=MO,WE,FR
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
                    : "Create task"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
