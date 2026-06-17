// ─── Main feature entry point ─────────────────────────────────────────────────

export { CalendarView } from "./components/CalendarView";

// Store
export { useCalendarStore } from "./store";
export type { CalendarView as CalendarViewType } from "./store";

// Hooks
export { useCalendarEvents, calendarKeys } from "./hooks/useCalendarEvents";
export { useCalendarTimeBlocks, timeBlockKeys } from "./hooks/useCalendarTimeBlocks";
export { useUnscheduledTasks } from "./hooks/useCalendarTasks";
