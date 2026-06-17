"use client";

import { useForm } from "react-hook-form";
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
import { useCreateProject, type CreateProjectPayload } from "../hooks/useGoals";

// ─── Schema ────────────────────────────────────────────────────────────────────

const PROJECT_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f43f5e", // rose
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#0ea5e9", // sky
  "#64748b", // slate
] as const;

const projectSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(2000).nullable().optional(),
  color: z.string().nullable().optional(),
  deadline: z
    .string()
    .nullable()
    .optional()
    .refine((v) => !v || !isNaN(Date.parse(v)), { message: "Invalid date" }),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ProjectFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goalId: string;
  goalTitle?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProjectForm({
  open,
  onOpenChange,
  goalId,
  goalTitle,
}: ProjectFormProps) {
  const createProject = useCreateProject();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      description: null,
      color: PROJECT_COLORS[0],
      deadline: null,
    },
  });

  const selectedColor = watch("color");

  const onSubmit = async (values: ProjectFormValues) => {
    try {
      const payload: CreateProjectPayload = {
        name: values.name,
        description: values.description ?? null,
        color: values.color ?? null,
        deadline: values.deadline ?? null,
        goal_id: goalId,
        status: "active",
      };
      await createProject.mutateAsync(payload);
      onOpenChange(false);
      reset();
    } catch {
      // Error surfaced via mutation state
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          {goalTitle && (
            <DialogDescription>
              Adding a project to goal: <strong>{goalTitle}</strong>
            </DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-4 py-2">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                placeholder="e.g. Build landing page"
                autoFocus
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-description">
                Description{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <textarea
                id="project-description"
                rows={2}
                placeholder="Brief project description"
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                {...register("description")}
              />
            </div>

            {/* Color + Deadline */}
            <div className="grid grid-cols-2 gap-3">
              {/* Color swatches */}
              <div className="flex flex-col gap-1.5">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-1.5">
                  {PROJECT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      title={color}
                      onClick={() => setValue("color", color)}
                      className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{
                        backgroundColor: color,
                        borderColor:
                          selectedColor === color ? "white" : "transparent",
                        boxShadow:
                          selectedColor === color
                            ? `0 0 0 2px ${color}`
                            : undefined,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Deadline */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="project-deadline">
                  Deadline{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="project-deadline"
                  type="date"
                  {...register("deadline")}
                />
                {errors.deadline && (
                  <p className="text-xs text-destructive">
                    {errors.deadline.message}
                  </p>
                )}
              </div>
            </div>

            {/* API error */}
            {createProject.error && (
              <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
                {createProject.error.message}
              </p>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
