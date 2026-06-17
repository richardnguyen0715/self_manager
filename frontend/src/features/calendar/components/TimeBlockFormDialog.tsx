"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, differenceInMinutes, parseISO } from "date-fns";
import { Loader2, Trash2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TimeBlock, SearchResponse } from "@/types";
import { useCalendarStore } from "../store";
import {
  useCreateTimeBlock,
  useUpdateTimeBlock,
  useDeleteTimeBlock,
} from "../hooks/useCalendarTimeBlocks";

// ─── Schema ───────────────────────────────────────────────────────────────────

const timeBlockSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    start_time: z.string().min(1, "Start time is required"),
    end_time: z.string().min(1, "End time is required"),
    task_id: z.string().nullable().optional(),
  })
  .refine(
    (d) => new Date(d.start_time) < new Date(d.end_time),
    { message: "End time must be after start time", path: ["end_time"] },
  );

type TimeBlockFormValues = z.infer<typeof timeBlockSchema>;

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm");
}

function fromDatetimeLocal(val: string): string {
  if (!val) return "";
  return new Date(val).toISOString();
}

// ─── Task Picker ──────────────────────────────────────────────────────────────

interface TaskPickerProps {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
}

function TaskPicker({ value, onChange }: TaskPickerProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  // Use /api/search with kinds=task — the canonical search endpoint
  const { data: searchResult } = useQuery({
    queryKey: ["search", "task-picker", search],
    queryFn: () =>
      api.get<SearchResponse>("/api/search", {
        q: search || " ",
        kinds: "task",
        limit: 20,
      }),
    staleTime: 1000 * 30,
    enabled: open,
  });
  const tasks = searchResult?.tasks ?? [];

  // Track selected task title for display — stored locally on selection
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);

  return (
    <div className="space-y-1.5">
      <Label>Link to Task (optional)</Label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <Search className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="flex-1 text-left truncate">
            {value && selectedTitle ? selectedTitle : "Search tasks…"}
          </span>
          {value && (
            <span
              className="text-muted-foreground hover:text-foreground ml-auto text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
                setSelectedTitle(null);
              }}
            >
              Clear
            </span>
          )}
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
            <div className="p-1">
              <Input
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="h-7 text-xs"
              />
            </div>
            <ul className="max-h-40 overflow-y-auto py-1">
              {tasks.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="w-full text-left px-2 py-1 text-xs hover:bg-accent truncate"
                    onClick={() => {
                      onChange(t.id);
                      setSelectedTitle(t.title);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    {t.title}
                  </button>
                </li>
              ))}
              {tasks.length === 0 && (
                <li className="px-2 py-1 text-xs text-muted-foreground">
                  No tasks found
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

export function TimeBlockFormDialog() {
  const {
    timeBlockDialogOpen,
    editingTimeBlockId,
    newTimeBlockStart,
    newTimeBlockEnd,
    closeTimeBlockDialog,
  } = useCalendarStore();

  const isEditing = !!editingTimeBlockId;

  // Fetch existing block for editing — response is wrapped { data: TimeBlock }
  const { data: existingBlock, isLoading: isLoadingBlock } = useQuery({
    queryKey: ["time-blocks", editingTimeBlockId],
    queryFn: async () => {
      const res = await api.get<{ data: TimeBlock }>(`/api/timeblocks/${editingTimeBlockId}`);
      return res.data;
    },
    enabled: !!editingTimeBlockId,
  });

  const createMutation = useCreateTimeBlock();
  const updateMutation = useUpdateTimeBlock();
  const deleteMutation = useDeleteTimeBlock();

  const isBusy =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TimeBlockFormValues>({
    resolver: zodResolver(timeBlockSchema),
    defaultValues: {
      title: "",
      start_time: toDatetimeLocal(newTimeBlockStart),
      end_time: toDatetimeLocal(newTimeBlockEnd),
      task_id: null,
    },
  });

  const startTime = watch("start_time");
  const endTime = watch("end_time");

  // Compute derived duration for display
  const derivedDuration =
    startTime && endTime
      ? (() => {
          const s = new Date(startTime);
          const e = new Date(endTime);
          return e > s ? differenceInMinutes(e, s) : null;
        })()
      : null;

  // Populate form when editing
  useEffect(() => {
    if (isEditing && existingBlock) {
      reset({
        title: existingBlock.title,
        start_time: toDatetimeLocal(existingBlock.start_time),
        end_time: toDatetimeLocal(existingBlock.end_time),
        task_id: existingBlock.task_id ?? null,
      });
    } else if (!isEditing) {
      reset({
        title: "",
        start_time: toDatetimeLocal(newTimeBlockStart),
        end_time: toDatetimeLocal(newTimeBlockEnd),
        task_id: null,
      });
    }
  }, [isEditing, existingBlock, newTimeBlockStart, newTimeBlockEnd, reset]);

  const onSubmit = async (values: TimeBlockFormValues) => {
    const payload = {
      ...values,
      start_time: fromDatetimeLocal(values.start_time),
      end_time: fromDatetimeLocal(values.end_time),
    };

    if (isEditing && editingTimeBlockId) {
      await updateMutation.mutateAsync({ id: editingTimeBlockId, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    closeTimeBlockDialog();
  };

  const handleDelete = async () => {
    if (editingTimeBlockId) {
      await deleteMutation.mutateAsync(editingTimeBlockId);
      closeTimeBlockDialog();
    }
  };

  const taskId = watch("task_id");

  return (
    <Dialog
      open={timeBlockDialogOpen}
      onOpenChange={(open) => !open && closeTimeBlockDialog()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Time Block" : "New Time Block"}
          </DialogTitle>
        </DialogHeader>

        {isEditing && isLoadingBlock ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="tb-title">Title</Label>
              <Input
                id="tb-title"
                placeholder="e.g. Deep work session"
                autoFocus
                {...register("title")}
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>

            {/* Start / End */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tb-start">Start</Label>
                <Input
                  id="tb-start"
                  type="datetime-local"
                  {...register("start_time")}
                />
                {errors.start_time && (
                  <p className="text-xs text-destructive">
                    {errors.start_time.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tb-end">End</Label>
                <Input
                  id="tb-end"
                  type="datetime-local"
                  {...register("end_time")}
                />
                {errors.end_time && (
                  <p className="text-xs text-destructive">
                    {errors.end_time.message}
                  </p>
                )}
              </div>
            </div>

            {/* Duration (computed, read-only indicator) */}
            {derivedDuration !== null && (
              <p className="text-xs text-muted-foreground">
                Duration: {derivedDuration} minutes
              </p>
            )}

            {/* Task picker */}
            <TaskPicker
              value={taskId}
              onChange={(id) => setValue("task_id", id)}
            />

            <DialogFooter className="gap-2 pt-2">
              {isEditing && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isBusy}
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={closeTimeBlockDialog}
                disabled={isBusy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isBusy}>
                {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditing ? "Save changes" : "Create block"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
