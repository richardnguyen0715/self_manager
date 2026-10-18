"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useLabels } from "../hooks/useLabels";
import { LabelChip } from "./LabelChip";
import { LabelPicker } from "./LabelPicker";

interface LabelsFieldProps {
  /** Assigned label names (work item `labels`). */
  value: string[];
  onChange: (next: string[]) => void;
  projectId?: string | null;
  className?: string;
}

/**
 * Coloured chips that open the LabelPicker when clicked. Drop-in replacement
 * for a plain text chip input; keeps the `labels` string array as the value.
 */
export function LabelsField({ value, onChange, projectId, className }: LabelsFieldProps) {
  const { data: labels = [] } = useLabels(projectId);

  const colorByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of labels) if (!map.has(l.name)) map.set(l.name, l.color);
    return map;
  }, [labels]);

  return (
    <LabelPicker
      value={value}
      onChange={onChange}
      projectId={projectId}
      trigger={
        <button
          type="button"
          className={cn(
            "-mx-1 flex min-h-7 w-full flex-wrap items-center gap-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-accent/50",
            className,
          )}
        >
          {value.length === 0 && (
            <span className="text-sm text-muted-foreground/70">Add label...</span>
          )}
          {value.map((name) => (
            <LabelChip key={name} name={name} color={colorByName.get(name)} />
          ))}
        </button>
      }
    />
  );
}
