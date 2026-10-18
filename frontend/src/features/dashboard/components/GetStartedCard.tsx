"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useProjects } from "@/features/tasks/hooks/useProjects";
import { useWorkItems } from "@/features/workitems/hooks/useWorkItems";
import { useSprints } from "@/features/agile/hooks/useSprints";
import { useSprintDashboard } from "../hooks/useSprintDashboard";

// ─── Dismissal (persisted locally) ─────────────────────────────────────────────

interface GetStartedState {
  dismissed: boolean;
  dismiss: () => void;
}

const useGetStartedStore = create<GetStartedState>()(
  persist(
    (set) => ({
      dismissed: false,
      dismiss: () => set({ dismissed: true }),
    }),
    {
      name: "mml_dashboard_get_started",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// ─── Card ──────────────────────────────────────────────────────────────────────

/**
 * Onboarding checklist. Shown only when there is no active sprint and no work
 * items. Step state comes from data the dashboard already loads (projects,
 * sprint dashboard) plus one-row list queries for work items and sprints.
 */
export function GetStartedCard() {
  const projectsQuery = useProjects();
  const workItemsQuery = useWorkItems({ limit: 1 });
  const sprintsQuery = useSprints({ limit: 1 });
  const sprintDashboardQuery = useSprintDashboard();
  const dismissed = useGetStartedStore((s) => s.dismissed);
  const dismiss = useGetStartedStore((s) => s.dismiss);

  const projects = projectsQuery.data;
  const workItemsTotal = workItemsQuery.data?.total;
  const sprintsTotal = sprintsQuery.data?.total;
  const dashboard = sprintDashboardQuery.data;

  // Only decide once every input has loaded, so the card never flashes.
  if (
    dismissed ||
    !projects ||
    workItemsTotal === undefined ||
    sprintsTotal === undefined ||
    !dashboard
  ) {
    return null;
  }

  const hasActiveSprint = Boolean(dashboard.active_sprint);
  if (hasActiveSprint || workItemsTotal > 0) return null;

  const steps = [
    { label: "Create a project", href: "/projects", done: projects.length > 0 },
    { label: "Create a work item", href: "/work-items", done: workItemsTotal > 0 },
    { label: "Create a sprint", href: "/sprints", done: sprintsTotal > 0 },
    { label: "Start the sprint", href: "/sprints", done: hasActiveSprint },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base">Get started</CardTitle>
          <CardDescription>
            {doneCount} of {steps.length} steps done
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={dismiss}
          aria-label="Dismiss get started checklist"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <ol className="space-y-1">
          {steps.map((step, index) => (
            <li key={step.label}>
              <Link
                href={step.href}
                className="flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent"
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                    step.done
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40 text-muted-foreground",
                  )}
                >
                  {step.done ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span
                  className={cn(
                    step.done ? "text-muted-foreground line-through" : "text-foreground",
                  )}
                >
                  {step.label}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
