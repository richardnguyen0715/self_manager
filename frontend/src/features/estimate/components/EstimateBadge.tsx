"use client";

import { cn } from "@/lib/utils";
import { useEstimateSystem, useEstimateSystemIdForProject } from "../hooks";
import { formatEstimate } from "../utils";

interface EstimateBadgeProps {
  /** Project whose estimate system formats the value. */
  projectId?: string | null;
  /** Explicit system id; takes precedence over projectId. */
  systemId?: string | null;
  value: number | null | undefined;
  className?: string;
}

/** Read-only display of a stored estimate in the project's scale. */
export function EstimateBadge({
  projectId,
  systemId,
  value,
  className,
}: EstimateBadgeProps) {
  const projectSystemId = useEstimateSystemIdForProject(projectId);
  const system = useEstimateSystem(systemId ?? projectSystemId);
  return (
    <span className={cn("tabular-nums", className)}>
      {formatEstimate(system, value)}
    </span>
  );
}
