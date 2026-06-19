"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import type { Habit } from "@/types";
import {
  useCreateHabit,
  useUpdateHabit,
  type CreateHabitPayload,
} from "../hooks/useHabits";
import { useHabitsStore } from "../store/habits.store";
import { cn } from "@/lib/utils";

// ─── Validation schema ─────────────────────────────────────────────────────────

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const habitSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(120),
    description: z.string().max(500).optional().or(z.literal("")),
    habit_type: z.enum(["check", "count", "duration"]),
    frequency: z.enum(["daily", "weekly", "custom"]),
    frequency_days: z.array(z.number().int().min(0).max(6)).optional().nullable(),
    target_value: z.coerce.number().positive().optional().nullable(),
    reminder_time: z.string().optional().nullable(),
    color: z.string().optional().nullable(),
    icon: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.frequency === "custom") {
        return (data.frequency_days?.length ?? 0) > 0;
      }
      return true;
    },
    { message: "Select at least one day for custom frequency", path: ["frequency_days"] },
  );

type HabitFormValues = z.infer<typeof habitSchema>;

// ─── Preset colours ────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#64748b", // slate
];

// ─── Component ─────────────────────────────────────────────────────────────────

interface HabitFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  habit?: Habit;
}

export function HabitFormDialog({ open, mode, habit }: HabitFormDialogProps) {
  const { closeModal } = useHabitsStore();
  const createMutation = useCreateHabit();
  const updateMutation = useUpdateHabit(habit?.id ?? "");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<HabitFormValues>({
    resolver: zodResolver(habitSchema),
    defaultValues: {
      name: "",
      description: "",
      habit_type: "check",
      frequency: "daily",
      frequency_days: null,
      target_value: null,
      reminder_time: null,
      color: PRESET_COLORS[0],
      icon: null,
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (mode === "edit" && habit) {
      reset({
        name: habit.name,
        description: habit.description ?? "",
        habit_type: habit.habit_type,
        frequency: habit.frequency,
        frequency_days: habit.frequency_days ?? null,
        target_value: habit.target_value > 0 ? habit.target_value : null,
        reminder_time: habit.reminder_time ?? null,
        color: habit.color ?? PRESET_COLORS[0],
        icon: habit.icon ?? null,
      });
    } else if (mode === "create") {
      reset({
        name: "",
        description: "",
        habit_type: "check",
        frequency: "daily",
        frequency_days: null,
        target_value: null,
        reminder_time: null,
        color: PRESET_COLORS[0],
        icon: null,
      });
    }
  }, [mode, habit, reset]);

  const habitType = watch("habit_type");
  const frequency = watch("frequency");
  const frequencyDays = watch("frequency_days");
  const selectedColor = watch("color");

  function toggleDay(day: number) {
    const current = frequencyDays ?? [];
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];
    setValue("frequency_days", next, { shouldValidate: true });
  }

  async function onSubmit(values: HabitFormValues) {
    const payload: CreateHabitPayload = {
      name: values.name,
      description: values.description || null,
      habit_type: values.habit_type,
      frequency: values.frequency,
      frequency_days:
        values.frequency === "custom" ? (values.frequency_days ?? null) : null,
      target_value: values.habit_type !== "check" ? (values.target_value ?? null) : null,
      reminder_time: values.reminder_time || null,
      color: values.color || null,
      icon: values.icon || null,
    };

    if (mode === "create") {
      await createMutation.mutateAsync(payload);
    } else {
      await updateMutation.mutateAsync(payload);
    }

    closeModal();
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeModal()}>
      <DialogContent className="w-[95vw] max-w-md sm:w-full">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New Habit" : "Edit Habit"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="habit-name">Name</Label>
            <Input
              id="habit-name"
              placeholder="e.g. Morning run"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="habit-desc">Description (optional)</Label>
            <Input
              id="habit-desc"
              placeholder="Why this habit matters"
              {...register("description")}
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="flex gap-2">
              {(["check", "count", "duration"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setValue("habit_type", t, { shouldValidate: true })}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    habitType === t
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent",
                  )}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Target value (count / duration only) */}
          {habitType !== "check" && (
            <div className="space-y-1.5">
              <Label htmlFor="habit-target">
                Target {habitType === "duration" ? "(mins)" : "count"}
              </Label>
              <Input
                id="habit-target"
                type="number"
                min={1}
                placeholder="e.g. 30"
                {...register("target_value")}
              />
              {errors.target_value && (
                <p className="text-xs text-destructive">
                  {errors.target_value.message}
                </p>
              )}
            </div>
          )}

          {/* Frequency */}
          <div className="space-y-1.5">
            <Label>Frequency</Label>
            <div className="flex gap-2">
              {(["daily", "weekly", "custom"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() =>
                    setValue("frequency", f, { shouldValidate: true })
                  }
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    frequency === f
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent",
                  )}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Custom days */}
          {frequency === "custom" && (
            <div className="space-y-1.5">
              <Label>Days</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((day, idx) => {
                  const active = (frequencyDays ?? []).includes(idx);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={cn(
                        "h-8 w-8 shrink-0 rounded-full text-xs font-semibold transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-accent",
                      )}
                    >
                      {day[0]}
                    </button>
                  );
                })}
              </div>
              {errors.frequency_days && (
                <p className="text-xs text-destructive">
                  {errors.frequency_days.message as string}
                </p>
              )}
            </div>
          )}

          {/* Color */}
          <div className="space-y-1.5">
            <Label>Colour</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setValue("color", c)}
                  style={{ backgroundColor: c }}
                  className={cn(
                    "h-6 w-6 rounded-full transition-transform",
                    selectedColor === c
                      ? "scale-125 ring-2 ring-ring ring-offset-2"
                      : "hover:scale-110",
                  )}
                  aria-label={`Select colour ${c}`}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || isSubmitting}>
              {isPending ? "Saving…" : mode === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
