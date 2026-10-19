"use client";

import { EstimateBadge } from "@/features/estimate";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { AlertCircle, ArrowRight, CircleDot } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkItemListItem, Priority } from "@/types";

const PRIORITY_DOT: Record<Priority, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-400",
};

const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  review: "In Review",
  done: "Done",
};

const STATUS_CLASS: Record<string, string> = {
  backlog: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  todo: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  in_progress: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  review: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

interface OverdueWorkItemRowProps {
  item: WorkItemListItem;
}

function OverdueWorkItemRow({ item }: OverdueWorkItemRowProps) {
  return (
    <div className="flex items-start gap-3 py-2.5 first:pt-0 border-b border-border last:border-0">
      {/* Priority dot */}
      <span
        className={cn(
          "h-2 w-2 rounded-full mt-1.5 shrink-0",
          PRIORITY_DOT[item.priority] ?? "bg-muted-foreground",
        )}
        title={item.priority}
      />

      {/* Title + meta */}
      <div className="flex-1 min-w-0 space-y-1">
        <Link
          href={`/work-items/${item.id}`}
          className="text-sm font-medium leading-snug hover:text-primary transition-colors line-clamp-1"
        >
          {item.title}
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="secondary"
            className={cn(
              "text-[10px] h-4 px-1.5 font-medium",
              STATUS_CLASS[item.status] ?? "",
            )}
          >
            {STATUS_LABEL[item.status] ?? item.status}
          </Badge>
          {item.due_date && (
            <span className="text-[10px] text-destructive flex items-center gap-0.5">
              <CircleDot className="h-2.5 w-2.5" />
              Due {format(parseISO(item.due_date), "MMM d")}
            </span>
          )}
          {item.story_points != null && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              <EstimateBadge projectId={item.project_id} value={item.story_points} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface OverdueWorkItemsPanelProps {
  items: WorkItemListItem[];
}

export function OverdueWorkItemsPanel({ items }: OverdueWorkItemsPanelProps) {
  const list = items ?? [];
  const MAX_SHOW = 5;
  const visible = list.slice(0, MAX_SHOW);
  const overflow = list.length - MAX_SHOW;

  return (
    <Card>
      <CardHeader className="pb-2 pt-5 px-5">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="min-w-0 text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
            <span className="truncate">Overdue Work Items</span>
          </CardTitle>
          {list.length > 0 && (
            <Badge
              variant="secondary"
              className="shrink-0 text-[10px] bg-destructive/10 text-destructive font-semibold"
            >
              {list.length}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <span className="text-2xl">🎉</span>
            <p className="text-xs text-muted-foreground">
              Nothing overdue. Great job!
            </p>
          </div>
        ) : (
          <>
            <div>
              {visible.map((item) => (
                <OverdueWorkItemRow key={item.id} item={item} />
              ))}
            </div>
            {overflow > 0 && (
              <p className="text-xs text-muted-foreground pt-2">
                +{overflow} more overdue
              </p>
            )}
          </>
        )}

        {list.length > 0 && (
          <div className="flex justify-end pt-3">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="gap-1 text-xs text-muted-foreground h-7"
            >
              <Link href="/work-items?status=overdue">
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
