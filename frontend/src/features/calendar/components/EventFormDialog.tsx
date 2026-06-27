"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { DateInput } from "@/components/ui/date-input";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
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
import { useCalendarTypes, useDeleteCalendarType } from "../hooks/useCalendarTypes";
import {
  buildRRule,
  parseRRule,
  DEFAULT_RECURRENCE,
  WEEKDAY_LABELS,
  type RecurrenceOptions,
  type RecurrenceFreq,
} from "../recurrence";

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
  const { data: calendarTypes = [] } = useCalendarTypes();
  const deleteTypeMutation = useDeleteCalendarType();

  // Type assignments + recurrence live outside react-hook-form (arrays/custom).
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);
  const [recurrence, setRecurrence] = useState<RecurrenceOptions>(DEFAULT_RECURRENCE);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);

  function toggleType(id: string) {
    setSelectedTypeIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  const isBusy =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    deleteTypeMutation.isPending;

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
      setSelectedTypeIds(existingEvent.type_ids ?? []);
      setRecurrence(parseRRule(existingEvent.recurrence_rule));
    } else if (!isEditing) {
      reset({
        title: "",
        description: "",
        start_time: toDatetimeLocal(newEventStart),
        end_time: toDatetimeLocal(newEventEnd),
        all_day: false,
        color: "",
      });
      setSelectedTypeIds([]);
      setRecurrence(DEFAULT_RECURRENCE);
    }
  }, [isEditing, existingEvent, newEventStart, newEventEnd, reset]);

  const onSubmit = async (values: EventFormValues) => {
    // Display colour falls back to the first assigned type's colour.
    const firstType = calendarTypes.find((t) => t.id === selectedTypeIds[0]);
    const color = values.color?.trim() || firstType?.color || undefined;

    const payload = {
      ...values,
      color,
      start_time: fromDatetimeLocal(values.start_time),
      end_time: fromDatetimeLocal(values.end_time),
      recurrence_rule: buildRRule(recurrence),
      type_ids: selectedTypeIds,
    };

    if (isEditing && editingEventId) {
      await updateMutation.mutateAsync({ id: editingEventId, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    closeEventDialog();
  };

  // ── Delete options ──────────────────────────────────────────────────────
  // "Delete all": remove the whole event (all occurrences of a recurring one).
  const handleDeleteEvent = async () => {
    if (!editingEventId) return;
    await deleteMutation.mutateAsync(editingEventId);
    closeEventDialog();
  };

  // "Delete from this calendar": unassign one calendar type; event stays.
  const handleRemoveFromCalendar = async (typeId: string) => {
    if (!editingEventId) return;
    await updateMutation.mutateAsync({
      id: editingEventId,
      type_ids: selectedTypeIds.filter((t) => t !== typeId),
    });
    closeEventDialog();
  };

  // "Delete this calendar": delete the calendar type entirely.
  const handleDeleteCalendar = async (typeId: string) => {
    await deleteTypeMutation.mutateAsync(typeId);
    closeEventDialog();
  };

  const assignedTypes = calendarTypes.filter((t) => selectedTypeIds.includes(t.id));

  return (
    <Dialog open={eventDialogOpen} onOpenChange={(open) => !open && closeEventDialog()}>
      <DialogContent className="w-[95vw] max-w-full sm:w-auto sm:max-w-md">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            {/* Calendars (types) */}
            {calendarTypes.length > 0 && (
              <div className="space-y-1.5">
                <Label>Calendars</Label>
                <div className="flex flex-wrap gap-1.5">
                  {calendarTypes.map((t) => {
                    const active = selectedTypeIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleType(t.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                          active
                            ? "border-transparent text-white"
                            : "bg-background hover:bg-accent",
                        )}
                        style={active ? { backgroundColor: t.color } : undefined}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full border"
                          style={{ backgroundColor: t.color }}
                        />
                        {t.icon && <span>{t.icon}</span>}
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Repeat / recurrence */}
            <div className="space-y-2">
              <Label htmlFor="event-repeat">Repeat</Label>
              <select
                id="event-repeat"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={recurrence.freq}
                onChange={(e) =>
                  setRecurrence((r) => ({ ...r, freq: e.target.value as RecurrenceFreq }))
                }
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom (weekdays)</option>
              </select>

              {recurrence.freq === "custom" && (
                <div className="flex flex-wrap gap-1">
                  {WEEKDAY_LABELS.map((label, i) => {
                    const active = recurrence.weekdays.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() =>
                          setRecurrence((r) => ({
                            ...r,
                            weekdays: active
                              ? r.weekdays.filter((d) => d !== i)
                              : [...r.weekdays, i],
                          }))
                        }
                        className={cn(
                          "h-8 w-9 rounded-md border text-xs font-medium transition-colors",
                          active
                            ? "bg-primary text-primary-foreground border-transparent"
                            : "bg-background hover:bg-accent",
                        )}
                      >
                        {label[0]}
                      </button>
                    );
                  })}
                </div>
              )}

              {recurrence.freq !== "none" && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Ends:</span>
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                    value={recurrence.end}
                    onChange={(e) =>
                      setRecurrence((r) => ({
                        ...r,
                        end: e.target.value as "never" | "count",
                      }))
                    }
                  >
                    <option value="never">Never (permanent)</option>
                    <option value="count">After N times</option>
                  </select>
                  {recurrence.end === "count" && (
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={1}
                        className="h-8 w-20"
                        value={recurrence.count}
                        onChange={(e) =>
                          setRecurrence((r) => ({
                            ...r,
                            count: Math.max(1, Number(e.target.value) || 1),
                          }))
                        }
                      />
                      <span className="text-muted-foreground">times</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <Label htmlFor="event-color">
                Color (hex){selectedTypeIds.length > 0 && " — overrides calendar colour"}
              </Label>
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

            {/* Delete options menu */}
            {isEditing && showDeleteMenu && (
              <div className="rounded-md border bg-muted/40 p-2 space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground px-1">
                  Delete options
                </p>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={handleDeleteEvent}
                  className="w-full text-left text-sm rounded px-2 py-1.5 text-destructive hover:bg-destructive/10 transition-colors"
                >
                  Delete event (all occurrences)
                </button>
                {assignedTypes.map((t) => (
                  <button
                    key={`rm-${t.id}`}
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleRemoveFromCalendar(t.id)}
                    className="w-full text-left text-sm rounded px-2 py-1.5 hover:bg-accent transition-colors flex items-center gap-1.5"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full border shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    Remove from “{t.name}”
                  </button>
                ))}
                {assignedTypes.map((t) => (
                  <button
                    key={`del-${t.id}`}
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleDeleteCalendar(t.id)}
                    className="w-full text-left text-sm rounded px-2 py-1.5 text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    Delete calendar “{t.name}” (and unassign everywhere)
                  </button>
                ))}
              </div>
            )}

            <DialogFooter className="gap-2 pt-2">
              {isEditing && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => setShowDeleteMenu((v) => !v)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete…
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
