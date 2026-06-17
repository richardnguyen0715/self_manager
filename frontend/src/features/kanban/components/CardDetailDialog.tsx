"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CalendarDays,
  Clock,
  Flag,
  Loader2,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Priority, TaskStatus } from "@/types";
import { useKanbanStore } from "../store";
import { useUpdateCard, useDeleteCard } from "../hooks/useTaskMutations";

// ─── Zod schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]),
  status: z.enum(["inbox", "planned", "in_progress", "waiting", "completed", "archived"]),
  due_date: z.string().optional(),
  start_date: z.string().optional(),
  estimated_time: z.coerce.number().positive().int().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

// ─── Priority / status labels ─────────────────────────────────────────────────

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "inbox", label: "Inbox" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting", label: "Waiting" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function CardDetailDialog() {
  const { openCardId, columns, closeCardDetail } = useKanbanStore();
  const updateCard = useUpdateCard();
  const deleteCard = useDeleteCard();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Find the task across all columns
  const task = columns.flatMap((c) => c.tasks ?? []).find((t) => t.id === openCardId) ?? null;
  const isOpen = openCardId !== null && task !== null;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: task
      ? {
          title: task.title,
          description: task.description ?? "",
          priority: task.priority,
          status: task.status,
          due_date: task.due_date ? task.due_date.split("T")[0] : "",
          start_date: task.start_date ? task.start_date.split("T")[0] : "",
          estimated_time:
            task.estimated_time != null ? task.estimated_time : "",
        }
      : undefined,
  });

  const onClose = () => {
    reset();
    setDeleteConfirm(false);
    closeCardDetail();
  };

  const onSubmit = async (values: FormValues) => {
    if (!task) return;
    await updateCard.mutateAsync({
      taskId: task.id,
      payload: {
        title: values.title,
        description: values.description || null,
        priority: values.priority as Priority,
        status: values.status as TaskStatus,
        due_date: values.due_date || null,
        start_date: values.start_date || null,
        estimated_time:
          values.estimated_time !== "" && values.estimated_time != null
            ? Number(values.estimated_time)
            : null,
      },
    });
    onClose();
  };

  const onDelete = async () => {
    if (!task) return;
    await deleteCard.mutateAsync(task.id);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-start justify-between gap-2">
            <DialogTitle className="text-base">Card Details</DialogTitle>
            <div className="flex items-center gap-1">
              {task?.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: tag.color ? tag.color + "22" : undefined,
                    color: tag.color ?? undefined,
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
          {/* Meta info line */}
          {task && (
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span>Created {format(parseISO(task.created_at), "MMM d, yyyy")}</span>
              {task.completed_at && (
                <span>Completed {format(parseISO(task.completed_at), "MMM d, yyyy")}</span>
              )}
            </div>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <form
            id="card-detail-form"
            onSubmit={handleSubmit(onSubmit)}
            className="px-6 py-4 space-y-4"
          >
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="detail-title">Title</Label>
              <Input id="detail-title" {...register("title")} />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="detail-desc">Description</Label>
              <textarea
                id="detail-desc"
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                placeholder="Add a description…"
                {...register("description")}
              />
            </div>

            <Separator />

            {/* Priority + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="detail-priority">
                  <Flag className="inline h-3 w-3 mr-1" />
                  Priority
                </Label>
                <select
                  id="detail-priority"
                  {...register("priority")}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="detail-status">Status</Label>
                <select
                  id="detail-status"
                  {...register("status")}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="detail-start">
                  <CalendarDays className="inline h-3 w-3 mr-1" />
                  Start date
                </Label>
                <Input id="detail-start" type="date" {...register("start_date")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="detail-due">Due date</Label>
                <Input id="detail-due" type="date" {...register("due_date")} />
              </div>
            </div>

            {/* Estimated time */}
            <div className="space-y-1.5">
              <Label htmlFor="detail-est">
                <Clock className="inline h-3 w-3 mr-1" />
                Estimated time (minutes)
              </Label>
              <Input
                id="detail-est"
                type="number"
                min={1}
                placeholder="e.g. 30"
                {...register("estimated_time")}
              />
            </div>

            {/* Subtasks summary */}
            {task && task.subtasks.length > 0 && (
              <div className="space-y-1.5">
                <Label>Subtasks</Label>
                <div className="space-y-1">
                  {task.subtasks.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-2 text-sm">
                      <span
                        className={
                          sub.is_done
                            ? "line-through text-muted-foreground"
                            : ""
                        }
                      >
                        {sub.title}
                      </span>
                      {sub.is_done && (
                        <Badge variant="secondary" className="text-xs h-4 px-1">
                          done
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t">
          {/* Delete */}
          {deleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-destructive">Delete this card?</span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onDelete}
                disabled={deleteCard.isPending}
              >
                {deleteCard.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Confirm"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDeleteConfirm(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="card-detail-form"
              size="sm"
              disabled={!isDirty || isSubmitting || updateCard.isPending}
            >
              {(isSubmitting || updateCard.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
