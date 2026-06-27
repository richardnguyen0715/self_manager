// ─── Task Calendar feature entry point ───────────────────────────────────────
//
// The project Calendar: a pure task-timeline. Tasks (scoped to the selected
// project, or all projects) are laid out by due date with full inline CRUD —
// create on empty space, click to edit, drag to reschedule. Events and time
// blocks live in the personal Life Calendar instead.

export { TaskCalendarView } from "./components/TaskCalendarView";
export { useTaskCalendarStore } from "./store";
