"use client";

import { cn } from "@/lib/utils";
import type { WorkItemType } from "@/types";
import { WORK_ITEM_TYPE_META } from "@/features/workitems/work-item-type-config";

interface WorkItemTypeBadgeProps {
  type: WorkItemType;
  className?: string;
  showLabel?: boolean;
}

const TYPE_CONFIG = WORK_ITEM_TYPE_META;

export function WorkItemTypeBadge({
  type,
  className,
  showLabel = false,
}: WorkItemTypeBadgeProps) {
  const meta = TYPE_CONFIG[type] ?? TYPE_CONFIG.task;
  const { label, icon: Icon, text } = meta;
  return (
    <span className={cn("inline-flex items-center gap-1", text, className)}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {showLabel && <span className="text-xs font-medium">{label}</span>}
    </span>
  );
}

export { TYPE_CONFIG };
