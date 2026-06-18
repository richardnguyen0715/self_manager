"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { DateInput } from "@/components/ui/date-input";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import { Loader2, Trash2 } from "lucide-react";
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
import { useCalendarStore } from "../store";
import {
  useCalendarEvent,
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
} from "../hooks/useCalendarEvents";

// ─── Schema ───────────────────────────────────────────────────────────────────

const eventSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    start_time: z.string().min(1, "Start time is required"),
    end_time: z.string().min(1, "End time is required"),
    all_day: z.boolean(),
    color: z.string().optional(),
  })
  .refine(
    (data) => new Date(data.start_time) < new Date(data.end_time),
    { message: "End time must be after start time", path: ["end_time"] },
  );

type EventFormValues = z.infer<typeof eventSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert an ISO string to value for <input type="datetime-local"> */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = parseISO(iso);
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

/** Convert datetime-local value back to ISO string */
function fromDatetimeLocal(val: string): string {
  if (!val) return "";
  return new Date(val).toISOString();
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

export function EventFormDialog() {
  const {
    eventDialogOpen,
    editingEventId,
    newEventStart,
    newEventEnd,
    closeEventDialog,
  } = useCalendarStore();

  const isEditing = !!editingEventId;
  const { data: existingEvent, isLoading: isLoadingEvent } = useCalendarEvent(
    editingEventId,
  );

  const createMutation = useCreateCalendarEvent();
  const updateMutation = useUpdateCalendarEvent();
  const deleteMutation = useDeleteCalendarEvent();

  const isBusy =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      description: "",
      start_time: toDatetimeLocal(newEventStart),
      end_time: toDatetimeLocal(newEventEnd),
      all_day: false,
      color: "",
    },
  });

  const isAllDay = watch("all_day");

  // Populate form when editing
  useEffect(() => {
    if (isEditing && existingEvent) {
      reset({
        title: existingEvent.title,
        description: existingEvent.description ?? "",
        start_time: toDatetimeLocal(existingEvent.start_time),
        end_time: toDatetimeLocal(existingEvent.end_time),
        all_day: existingEvent.all_day,
        color: existingEvent.color ?? "",
      });
    } else if (!isEditing) {
      reset({
        title: "",
        description: "",
        start_time: toDatetimeLocal(newEventStart),
        end_time: toDatetimeLocal(newEventEnd),
        all_day: false,
        color: "",
      });
    }
  }, [isEditing, existingEvent, newEventStart, newEventEnd, reset]);

  const onSubmit = async (values: EventFormValues) => {
    const payload = {
      ...values,
      start_time: fromDatetimeLocal(values.start_time),
      end_time: fromDatetimeLocal(values.end_time),
    };

    if (isEditing && editingEventId) {
      await updateMutation.mutateAsync({ id: editingEventId, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    closeEventDialog();
  };

  const handleDelete = async () => {
    if (editingEventId) {
      await deleteMutation.mutateAsync(editingEventId);
      closeEventDialog();
    }
  };

  return (
    <Dialog open={eventDialogOpen} onOpenChange={(open) => !open && closeEventDialog()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Event" : "New Event"}</DialogTitle>
        </DialogHeader>

        {isEditing && isLoadingEvent ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="event-title">Title</Label>
              <Input
                id="event-title"
                placeholder="Event title"
                autoFocus
                {...register("title")}
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="event-desc">Description</Label>
              <Input
                id="event-desc"
                placeholder="Optional description"
                {...register("description")}
              />
            </div>

            {/* All-day toggle */}
            <div className="flex items-center gap-2">
              <input
                id="event-allday"
                type="checkbox"
                className="h-4 w-4 rounded border accent-primary"
                {...register("all_day")}
              />
              <Label htmlFor="event-allday" className="cursor-pointer">
                All day
              </Label>
            </div>

            {/* Start / End */}
            {!isAllDay && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="event-start">Start</Label>
                  <Input
                    id="event-start"
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
                  <Label htmlFor="event-end">End</Label>
                  <Input
                    id="event-end"
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
            )}

            {isAllDay && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="event-start-date">Start date</Label>
                  <Controller
                    control={control}
                    name="start_time"
                    render={({ field }) => (
                      <DateInput
                        id="event-start-date"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="event-end-date">End date</Label>
                  <Controller
                    control={control}
                    name="end_time"
                    render={({ field }) => (
                      <DateInput
                        id="event-end-date"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
              </div>
            )}

            {/* Color */}
            <div className="space-y-1.5">
              <Label htmlFor="event-color">Color (hex)</Label>
              <div className="flex gap-2 items-center">
                <input
                  id="event-color-picker"
                  type="color"
                  className="h-9 w-9 rounded border cursor-pointer p-0.5 bg-transparent"
                  {...register("color")}
                />
                <Input
                  id="event-color"
                  placeholder="#3b82f6"
                  className="flex-1"
                  {...register("color")}
                />
              </div>
            </div>

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
                onClick={closeEventDialog}
                disabled={isBusy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isBusy}>
                {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditing ? "Save changes" : "Create event"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
