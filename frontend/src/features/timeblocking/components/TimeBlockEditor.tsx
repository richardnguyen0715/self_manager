"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, X } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { TaskListItem } from "@/types";
import { useTimeBlockingStore } from "../timeblocking.store";
import {
  useCreateTimeBlock,
  useUpdateTimeBlock,
} from "../hooks/useTimeBlocks";
import { useTaskSelector } from "../hooks/useTaskSelector";

// ─── Validation schema ────────────────────────────────────────────────────────

const schema = z
  .object({
    title: z.string().min(1, "Title is required").max(200),
    start_time: z.string().min(1, "Start time is required"),
    end_time: z.string().min(1, "End time is required"),
    color: z.string().nullable().optional(),
    task_id: z.string().nullable().optional(),
  })
  .refine(
    (data) => new Date(data.end_time) > new Date(data.start_time),
    { message: "End time must be after start time", path: ["end_time"] },
  );

type FormValues = z.infer<typeof schema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert ISO datetime to <input type="datetime-local"> value. */
function toDatetimeLocal(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convert <input type="datetime-local"> value back to ISO. */
function fromDatetimeLocal(value: string): string {
  if (!value) return "";
  return new Date(value).toISOString();
}

// ─── Sub-component: Task search combobox ──────────────────────────────────────

interface TaskComboboxProps {
  value: string | null;
  onChange: (taskId: string | null, task: TaskListItem | null) => void;
}

function TaskCombobox({ value, onChange }: TaskComboboxProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskListItem | null>(null);

  const { data: tasks = [] } = useTaskSelector(search);
  // Client-side filter by title when search is provided
  const filtered = search
    ? tasks.filter((t) =>
        t.title.toLowerCase().includes(search.toLowerCase()),
      )
    : tasks;

  function handleSelect(task: TaskListItem) {
    setSelectedTask(task);
    onChange(task.id, task);
    setSearch("");
    setOpen(false);
  }

  function handleClear() {
    setSelectedTask(null);
    onChange(null, null);
    setSearch("");
  }

  // Sync when value is cleared externally
  useEffect(() => {
    if (!value) setSelectedTask(null);
  }, [value]);

  return (
    <div className="relative">
      {selectedTask ? (
        <div className="flex items-center gap-2 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm">
          <span className="flex-1 truncate">{selectedTask.title}</span>
          <button
            type="button"
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Remove linked task"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search tasks..."
            value={search}
            className="pl-8"
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
        </div>
      )}

      {open && !selectedTask && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <ul className="max-h-48 overflow-auto py-1">
            {filtered.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2"
                  onMouseDown={() => handleSelect(task)}
                >
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      task.priority === "critical" && "bg-red-500",
                      task.priority === "high" && "bg-orange-500",
                      task.priority === "medium" && "bg-yellow-500",
                      task.priority === "low" && "bg-blue-500",
                    )}
                  />
                  <span className="truncate">{task.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Main editor component ────────────────────────────────────────────────────

export function TimeBlockEditor() {
  const { editorOpen, editingBlock, draftBlock, closeEditor } =
    useTimeBlockingStore();

  const createBlock = useCreateTimeBlock();
  const updateBlock = useUpdateTimeBlock();

  const isEditing = Boolean(editingBlock);

  // Determine default start/end from draft or editing block
  const defaultStart = editingBlock
    ? toDatetimeLocal(editingBlock.start_time)
    : draftBlock
    ? toDatetimeLocal(draftBlock.start_time)
    : toDatetimeLocal(
        (() => {
          const d = new Date();
          d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
          return d.toISOString();
        })(),
      );

  const defaultEnd = editingBlock
    ? toDatetimeLocal(editingBlock.end_time)
    : draftBlock
    ? toDatetimeLocal(draftBlock.end_time)
    : toDatetimeLocal(
        (() => {
          const d = new Date();
          d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15 + 60, 0, 0);
          return d.toISOString();
        })(),
      );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: editingBlock?.title ?? draftBlock?.title ?? "",
      start_time: defaultStart,
      end_time: defaultEnd,
      color: editingBlock?.color ?? null,
      task_id: editingBlock?.task_id ?? draftBlock?.task_id ?? null,
    },
  });

  // Re-populate form when editingBlock changes
  useEffect(() => {
    if (editorOpen) {
      reset({
        title: editingBlock?.title ?? draftBlock?.title ?? "",
        start_time: editingBlock
          ? toDatetimeLocal(editingBlock.start_time)
          : draftBlock
          ? toDatetimeLocal(draftBlock.start_time)
          : defaultStart,
        end_time: editingBlock
          ? toDatetimeLocal(editingBlock.end_time)
          : draftBlock
          ? toDatetimeLocal(draftBlock.end_time)
          : defaultEnd,
        color: editingBlock?.color ?? null,
        task_id: editingBlock?.task_id ?? draftBlock?.task_id ?? null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOpen, editingBlock?.id]);

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      title: values.title,
      task_id: values.task_id ?? null,
      start_time: fromDatetimeLocal(values.start_time),
      end_time: fromDatetimeLocal(values.end_time),
      ...(values.color ? { color: values.color } : {}),
    };

    if (isEditing && editingBlock) {
      await updateBlock.mutateAsync({ id: editingBlock.id, payload });
    } else {
      await createBlock.mutateAsync(payload);
    }

    closeEditor();
  });

  return (
    <Dialog open={editorOpen} onOpenChange={(open) => !open && closeEditor()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Time Block" : "New Time Block"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-4 pt-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="tb-title">Title</Label>
            <Input
              id="tb-title"
              placeholder="What are you working on?"
              autoComplete="off"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Start & End */}
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

          {/* Color */}
          <div className="space-y-1.5">
            <Label htmlFor="tb-color">
              Color{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="tb-color"
              type="color"
              className="h-9 w-20 cursor-pointer px-1 py-0.5"
              {...register("color")}
            />
          </div>

          {/* Link task */}
          <div className="space-y-1.5">
            <Label>Linked task (optional)</Label>
            <TaskCombobox
              value={watch("task_id") ?? null}
              onChange={(taskId) => setValue("task_id", taskId)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeEditor}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEditing ? "Save changes" : "Create block"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
