"use client";

import { useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDashboardUIStore } from "../store";
import { useQuickCreateTask } from "../hooks/useQuickCreateTask";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
});

type FormValues = z.infer<typeof schema>;

const PRIORITIES = ["critical", "high", "medium", "low"] as const;

const PRIORITY_COLORS: Record<typeof PRIORITIES[number], string> = {
  critical: "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  high: "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
  medium: "border-yellow-500 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400",
  low: "border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
};

export function QuickCreateTaskForm() {
  const { isQuickCreateOpen, openQuickCreate, closeQuickCreate } =
    useDashboardUIStore();
  const { mutate: createTask, isPending } = useQuickCreateTask();
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", priority: "medium" },
  });

  const selectedPriority = watch("priority");

  // Focus the input when the form opens
  useEffect(() => {
    if (isQuickCreateOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      reset();
    }
  }, [isQuickCreateOpen, reset]);

  const onSubmit = (values: FormValues) => {
    createTask({ title: values.title, priority: values.priority });
  };

  if (!isQuickCreateOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2 border-dashed text-muted-foreground hover:text-foreground"
        onClick={openQuickCreate}
      >
        <Plus className="h-4 w-4" />
        Add task…
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-md border bg-background p-3 shadow-sm"
    >
      <Input
        {...register("title")}
        ref={(el) => {
          register("title").ref(el);
          (inputRef as React.MutableRefObject<HTMLInputElement | null>).current =
            el;
        }}
        placeholder="Task title…"
        className="mb-2 text-sm"
        disabled={isPending}
        autoComplete="off"
      />
      {errors.title && (
        <p className="mb-2 text-xs text-destructive">{errors.title.message}</p>
      )}

      {/* Priority picker */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setValue("priority", p)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize transition-colors",
              selectedPriority === p
                ? PRIORITY_COLORS[p]
                : "border-border bg-transparent text-muted-foreground hover:bg-muted",
            )}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={closeQuickCreate}
          disabled={isPending}
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Add Task
        </Button>
      </div>
    </form>
  );
}
