"use client";

import { cn } from "@/lib/utils";
import type { WorkItemType } from "@/types";
import { WORK_ITEM_TYPE_META } from "@/features/workitems/work-item-type-config";

// Adapt the shared meta to this badge's {label, icon, color} shape.
const TYPE_CONFIG = Object.fromEntries(
  (Object.entries(WORK_ITEM_TYPE_META) as [
    WorkItemType,
    (typeof WORK_ITEM_TYPE_META)[WorkItemType],
  ][]).map(([k, v]) => [k, { label: v.label, icon: v.icon, color: v.badge }]),
) as Record<
  WorkItemType,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
>;

interface WorkItemTypeBadgeProps {
  type: WorkItemType;
  showLabel?: boolean;
  className?: string;
}

export function WorkItemTypeBadge({
  type,
  showLabel = false,
  className,
}: WorkItemTypeBadgeProps) {
  const config = TYPE_CONFIG[type] ?? TYPE_CONFIG.task;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
        config.color,
        className,
      )}
      title={config.label}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

export function WorkItemTypeIcon({
  type,
  className,
}: {
  type: WorkItemType;
  className?: string;
}) {
  const config = TYPE_CONFIG[type] ?? TYPE_CONFIG.task;
  const Icon = config.icon;
  return (
    <span title={config.label}>
      <Icon
        className={cn("h-3.5 w-3.5 shrink-0", config.color.split(" ")[0], className)}
      />
    </span>
  );
}
