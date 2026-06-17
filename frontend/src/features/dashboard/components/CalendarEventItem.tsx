import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardEvent } from "@/types";

interface CalendarEventItemProps {
  event: DashboardEvent;
}

export function CalendarEventItem({ event }: CalendarEventItemProps) {
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);

  const timeRange = event.all_day
    ? "All day"
    : `${format(start, "h:mm a")} – ${format(end, "h:mm a")}`;

  return (
    <div className="flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent/50">
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: event.color ?? "hsl(var(--primary))",
        }}
        aria-hidden="true"
      >
        <CalendarDays className="h-3.5 w-3.5 text-primary-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{event.title}</p>
        <p className={cn("text-[11px] text-muted-foreground")}>{timeRange}</p>
        {event.location && (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground/80">
            {event.location}
          </p>
        )}
      </div>
    </div>
  );
}
