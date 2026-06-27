"use client";

import { cn } from "@/lib/utils";
import type { WorkItemType } from "@/types";
import { WORK_ITEM_TYPE_META } from "../work-item-type-config";

interface WorkItemTypeBadgeProps {
  type: WorkItemType;
  className?: string;
  showLabel?: boolean;
}

/** Back-compat alias — some callers import this name. */
export const WORK_ITEM_TYPE_CONFIG = WORK_ITEM_TYPE_META;

export function WorkItemTypeBadge({
  type,
  className,
  showLabel = false,
}: WorkItemTypeBadgeProps) {
  const meta = WORK_ITEM_TYPE_META[type] ?? WORK_ITEM_TYPE_META.task;
  const { label, icon: Icon, text } = meta;
  return (
    <span className={cn("inline-flex items-center gap-1", text, className)}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {showLabel && <span className="text-xs font-medium">{label}</span>}
      {!showLabel && <span className="sr-only">{label}</span>}
    </span>
  );
}
