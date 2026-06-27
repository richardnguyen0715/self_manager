"use client";

import {
  format,
  addDays,
  startOfWeek,
  startOfMonth,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { TaskListItem } from "@/types";
import { useTaskUIStore } from "@/features/tasks/store";
import { getPriorityColors } from "@/features/calendar/utils";
import { useTaskCalendarStore } from "../store";

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_LABELS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

// ─── Draggable task chip (month) ────────────────────────────────────────────────

function MonthTaskChip({ task }: { task: TaskListItem }) {
  const openEditDialog = useTaskUIStore((s) => s.openEditDialog);
  const colors = getPriorityColors(task.priority);

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `task-month-${task.id}`, data: { type: "task", task } });

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        openEditDialog(task.id);
      }}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "text-left text-[10px] rounded px-1 leading-4 truncate w-full border-l-2",
        colors.bg,
        colors.border,
        colors.text,
        isDragging && "opacity-40",
      )}
      title={task.title}
    >
      {task.due_date && (
        <span className="opacity-60 mr-0.5">
          {format(parseISO(task.due_date), "h:mm")}
        </span>
      )}
      {task.title}
    </button>
  );
}

// ─── Day cell ────────────────────────────────────────────────────────────────

interface MonthDayCellProps {
  day: Date;
  anchorDate: Date;
  tasks: TaskListItem[];
}

function MonthDayCell({ day, anchorDate, tasks }: MonthDayCellProps) {
  const openCreateDialog = useTaskUIStore((s) => s.openCreateDialog);
  const { goToDate, setView } = useTaskCalendarStore();
  const isCurrentMonth = isSameMonth(day, anchorDate);

  const { setNodeRef, isOver } = useDroppable({
    id: `task-month-day-${day.toISOString()}`,
    data: { day },
  });

  const visible = tasks.slice(0, 3);
  const hidden = tasks.length - visible.length;

  return (
    <div
      ref={setNodeRef}
      onClick={() => openCreateDialog({ due_date: day.toISOString() })}
      className={cn(
        "min-h-[60px] sm:min-h-[100px] border-r border-b p-0.5 sm:p-1 last:border-r-0 flex flex-col gap-0.5 cursor-pointer",
        !isCurrentMonth && "bg-muted/30",
        isOver && "bg-primary/5",
      )}
    >
      <button
        className={cn(
          "w-6 h-6 text-xs font-medium rounded-full flex items-center justify-center self-start hover:bg-accent transition-colors",
          isToday(day) && "bg-primary text-primary-foreground hover:bg-primary/90",
          !isCurrentMonth && "text-muted-foreground",
        )}
        onClick={(e) => {
          e.stopPropagation();
          goToDate(day);
          setView("day");
        }}
        aria-label={format(day, "MMMM d, yyyy")}
      >
        {format(day, "d")}
      </button>

      {visible.map((t) => (
        <MonthTaskChip key={t.id} task={t} />
      ))}

      {hidden > 0 && (
        <button
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors self-start px-1"
          onClick={(e) => {
            e.stopPropagation();
            goToDate(day);
            setView("day");
          }}
        >
          +{hidden} more
        </button>
      )}
    </div>
  );
}

// ─── TaskMonthGrid ─────────────────────────────────────────────────────────────

interface TaskMonthGridProps {
  anchorDate: Date;
  tasks: TaskListItem[];
}

export function TaskMonthGrid({ anchorDate, tasks }: TaskMonthGridProps) {
  const monthStart = startOfMonth(anchorDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });

  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) week.push(addDays(calStart, w * 7 + d));
    weeks.push(week);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-x-auto">
      <div className="flex flex-col flex-1 min-h-0" style={{ minWidth: 280 }}>
        <div className="grid grid-cols-7 border-b">
          {DOW_LABELS.map((label, i) => (
            <div
              key={label}
              className="text-center text-xs font-medium text-muted-foreground py-2 uppercase tracking-wide"
            >
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{DOW_LABELS_SHORT[i]}</span>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((day) => (
                <MonthDayCell
                  key={day.toISOString()}
                  day={day}
                  anchorDate={anchorDate}
                  tasks={tasks.filter(
                    (t) => t.due_date && isSameDay(parseISO(t.due_date), day),
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
