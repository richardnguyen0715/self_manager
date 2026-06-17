"use client";

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
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
import type { Priority, TaskStatus } from "@/types";
import { useKanbanStore } from "../store";
import { useCreateCard } from "../hooks/useTaskMutations";

// ─── Zod schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  due_date: z.string().optional(),
  estimated_time: z.coerce.number().positive().int().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

// ─── Component ────────────────────────────────────────────────────────────────

interface AddCardDialogProps {
  columnId: TaskStatus;
}

export function AddCardDialog({ columnId }: AddCardDialogProps) {
  const { addingCardToColumnId, closeAddCard } = useKanbanStore();
  const isOpen = addingCardToColumnId === columnId;

  const createCard = useCreateCard(columnId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { priority: "medium" },
  });

  const titleRef = useRef<HTMLInputElement | null>(null);
  const { ref: titleFormRef, ...titleRest } = register("title");

  // Auto-focus title on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const onSubmit = async (values: FormValues) => {
    await createCard.mutateAsync({
      title: values.title,
      description: values.description || null,
      priority: values.priority as Priority,
      due_date: values.due_date || null,
      estimated_time:
        values.estimated_time !== "" && values.estimated_time != null
          ? Number(values.estimated_time)
          : null,
    });
    reset();
    closeAddCard();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          closeAddCard();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Card</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="add-card-title">Title</Label>
            <Input
              id="add-card-title"
              placeholder="Task title…"
              {...titleRest}
              ref={(el) => {
                titleFormRef(el);
                (titleRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
              }}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="add-card-desc">Description</Label>
            <Input
              id="add-card-desc"
              placeholder="Optional description…"
              {...register("description")}
            />
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label htmlFor="add-card-priority">Priority</Label>
            <select
              id="add-card-priority"
              {...register("priority")}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Due date + estimated time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="add-card-due">Due date</Label>
              <Input
                id="add-card-due"
                type="date"
                {...register("due_date")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-card-est">Est. time (min)</Label>
              <Input
                id="add-card-est"
                type="number"
                min={1}
                placeholder="30"
                {...register("estimated_time")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                closeAddCard();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || createCard.isPending}>
              {(isSubmitting || createCard.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Add Card
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
