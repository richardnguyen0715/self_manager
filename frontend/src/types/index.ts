// ─── Enums ────────────────────────────────────────────────────────────────────

export type Priority = "critical" | "high" | "medium" | "low";

/**
 * Mirrors the `task_status` Postgres enum (snake_case serialisation).
 * Used as Kanban column keys — the board groups tasks by this field
 * client-side; there is no separate kanban module on the backend.
 */
export type TaskStatus =
  | "inbox"
  | "planned"
  | "in_progress"
  | "waiting"
  | "completed"
  | "archived";

export type HabitType = "check" | "count" | "duration";

export type HabitFrequency = "daily" | "weekly" | "custom";

/**
 * Mirrors the `focus_mode` Postgres enum.
 * Serialised values must match backend exactly (e.g. "pomodoro_25_5").
 */
export type FocusMode = "pomodoro_25_5" | "deep_work_50_10" | "custom";

/**
 * Mirrors the `notification_type` Postgres enum (snake_case).
 */
export type NotificationType =
  | "deadline_1d"
  | "deadline_2h"
  | "deadline_30m"
  | "habit_reminder"
  | "time_block_reminder"
  | "goal_deadline"
  | "system";

export type GoalStatus = "active" | "completed" | "abandoned" | "paused";

export type ProjectStatus = "active" | "completed" | "archived";

// ─── Core Entities ─────────────────────────────────────────────────────────────

/**
 * Public user profile returned by GET /api/auth/me.
 * Backend model: UserProfile { id, email, display_name, avatar_url, timezone, created_at }
 * Note: field is `display_name`, not `name`.
 */
export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  timezone: string;
  created_at: string;
}

/**
 * Full `tags` row.
 * Backend: Tag { id, user_id, name, color?, created_at, updated_at }
 */
export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Goal response DTO.
 * Backend: GoalResponse { id, title, description?, target_date?, status, color?,
 *   position, created_at, updated_at }
 * Note: field is `target_date` (NaiveDate YYYY-MM-DD), not `deadline`.
 */
export interface Goal {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null; // YYYY-MM-DD
  status: GoalStatus;
  color: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

/**
 * GoalListResponse envelope returned by GET /api/goals.
 * Backend: GoalListResponse { data: Vec<GoalResponse>, total: i64 }
 */
export interface GoalListResponse {
  data: Goal[];
  total: number;
}

/**
 * GoalProjectSummary — project summary returned by GET /api/goals/:id/projects.
 * Mirrors ProjectResponse but is a summary view scoped to the goal.
 * Backend: ProjectResponse { id, user_id, goal_id?, name, description?, color?,
 *   deadline?, status, position, progress: ProjectProgress, created_at, updated_at }
 */
export interface GoalProjectSummary {
  id: string;
  user_id: string;
  goal_id: string | null;
  name: string;
  description: string | null;
  color: string | null;
  deadline: string | null; // YYYY-MM-DD
  status: ProjectStatus;
  position: number;
  progress: ProjectProgress;
  created_at: string;
  updated_at: string;
}

/**
 * Project response DTO.
 * Backend: ProjectResponse { id, user_id, goal_id?, name, description?, color?,
 *   deadline?, status, position, progress: ProjectProgress, created_at, updated_at }
 * Note: field is `name`, not `title`; `deadline` is NaiveDate (YYYY-MM-DD).
 */
export interface ProjectProgress {
  total_tasks: number;
  completed_tasks: number;
  completion_rate: number; // 0.0–1.0
}

export interface Project {
  id: string;
  user_id: string;
  goal_id: string | null;
  name: string;
  description: string | null;
  color: string | null;
  deadline: string | null; // YYYY-MM-DD
  status: ProjectStatus;
  position: number;
  progress: ProjectProgress;
  created_at: string;
  updated_at: string;
}

/**
 * Full `subtasks` row.
 * Backend: Subtask { id, task_id, title, is_done, position, created_at, updated_at }
 * Note: field is `is_done`, not `is_completed`.
 */
export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

/**
 * TaskResponse — task enriched with subtasks and tags.
 * Returned by POST /api/tasks, GET /api/tasks/:id, PATCH /api/tasks/:id.
 * Backend uses #[serde(flatten)] so all Task fields appear at the top level
 * alongside `subtasks` and `tags`.
 */
export interface Task {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  due_date: string | null; // RFC 3339
  start_date: string | null; // RFC 3339
  estimated_time: number | null; // minutes (i32)
  actual_time: number | null; // minutes (i32)
  recurrence_rule: string | null;
  completed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  subtasks: Subtask[];
  tags: Tag[];
}

/**
 * TaskListItem — lightweight item in GET /api/tasks list.
 * Backend: TaskListItem { id, project_id?, title, priority, status, due_date?,
 *   estimated_time?, tag_ids, subtask_count, done_subtask_count, position,
 *   created_at, updated_at }
 */
export interface TaskListItem {
  id: string;
  project_id: string | null;
  title: string;
  priority: Priority;
  status: TaskStatus;
  due_date: string | null;
  estimated_time: number | null;
  tag_ids: string[];
  subtask_count: number;
  done_subtask_count: number;
  position: number;
  created_at: string;
  updated_at: string;
}

/**
 * TimeBlock row.
 * Backend: TimeBlock { id, user_id, task_id?, title, start_time, end_time,
 *   actual_start?, actual_end?, color?, created_at, updated_at }
 * Note: fields are `start_time`/`end_time`, not `start_at`/`end_at`.
 *
 * Timeblock handlers wrap responses in { data: T }.
 */
export interface TimeBlock {
  id: string;
  user_id: string;
  task_id: string | null;
  title: string;
  start_time: string; // RFC 3339
  end_time: string; // RFC 3339
  actual_start: string | null;
  actual_end: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * TimeBlockSummary — lightweight item returned in GET /api/timeblocks list.
 * Backend: TimeBlockSummary { id, title, task_id?, start_time, end_time,
 *   color?, estimated_minutes, actual_minutes? }
 */
export interface TimeBlockSummary {
  id: string;
  title: string;
  task_id: string | null;
  start_time: string;
  end_time: string;
  color: string | null;
  estimated_minutes: number;
  actual_minutes: number | null;
}

/**
 * TimeBlockList — paginated wrapper from GET /api/timeblocks.
 * Backend: TimeBlockList { items, total, offset, limit }
 * Envelope: { data: TimeBlockList }
 */
export interface TimeBlockList {
  items: TimeBlockSummary[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * FocusSession row.
 * Backend: FocusSession { id, user_id, time_block_id?, mode, started_at,
 *   paused_at?, ended_at?, duration_seconds?, created_at, updated_at }
 * Handlers wrap in { data: FocusSession } or { data: FocusSession[] }.
 */
export interface FocusSession {
  id: string;
  user_id: string;
  time_block_id: string | null;
  mode: FocusMode;
  started_at: string;
  paused_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * HabitResponse — enriched habit with live stats.
 * Backend: HabitResponse { id, user_id, name, description?, habit_type,
 *   target_value, frequency, frequency_days?, reminder_time?, color?, icon?,
 *   archived, position, current_streak, completion_rate_30d, created_at, updated_at }
 * Note: field is `name` not `title`; `habit_type` not `type`;
 *   `archived` not `is_archived`; `current_streak`/`completion_rate_30d` not
 *   `streak`/`completion_rate`.
 */
export interface Habit {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  habit_type: HabitType;
  target_value: number;
  frequency: HabitFrequency;
  frequency_days: number[] | null; // 0=Sun..6=Sat
  reminder_time: string | null; // "HH:MM"
  color: string | null;
  icon: string | null;
  archived: boolean;
  position: number;
  current_streak: number;
  completion_rate_30d: number; // 0.0–1.0
  created_at: string;
  updated_at: string;
}

/**
 * HabitLogResponse.
 * Backend: HabitLogResponse { id, habit_id, log_date, value, completed,
 *   note?, created_at, updated_at }
 * Note: field is `log_date` (NaiveDate YYYY-MM-DD), not `date`.
 */
export interface HabitLog {
  id: string;
  habit_id: string;
  log_date: string; // YYYY-MM-DD
  value: number;
  completed: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * CalendarEvent row.
 * Backend: CalendarEvent { id, user_id, title, description?, start_time,
 *   end_time, all_day, location?, color?, recurrence_rule?, created_at, updated_at }
 * Note: fields are `start_time`/`end_time`/`all_day`, not `start_at`/`end_at`/`is_all_day`.
 * GET /api/calendar returns EventListResponse { events: Vec<CalendarEvent>, total }.
 */
export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_time: string; // RFC 3339
  end_time: string; // RFC 3339
  all_day: boolean;
  location: string | null;
  color: string | null;
  recurrence_rule: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventListResponse {
  events: CalendarEvent[];
  total: number;
}

/**
 * NotificationResponse.
 * Backend: NotificationResponse { id, type (serde rename), title, body?,
 *   entity_id?, entity_table?, read (bool), scheduled_for?, sent_at?,
 *   created_at, updated_at }
 * Note: field is `read` (bool), not `is_read`.
 */
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entity_id: string | null;
  entity_table: string | null;
  read: boolean;
  scheduled_for: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * NotificationListResponse — paginated list from GET /api/notifications.
 * Backend: NotificationListResponse { items, total, page, page_size, unread_count }
 */
export interface NotificationListResponse {
  items: Notification[];
  total: number;
  page: number;
  page_size: number;
  unread_count: number;
}

/**
 * UnreadCountResponse from GET /api/notifications/unread-count.
 * Backend: UnreadCountResponse { unread_count }
 */
export interface UnreadCountResponse {
  unread_count: number;
}

// ─── Notification channel ──────────────────────────────────────────────────────

/**
 * Delivery channel for notification preferences.
 * Backend enum: NotificationChannel { InApp, BrowserPush }
 * Serialised as snake_case strings.
 */
export type NotificationChannel = "in_app" | "browser_push";

// ─── Auth ──────────────────────────────────────────────────────────────────────

/**
 * Flat auth response returned by POST /api/auth/register and POST /api/auth/login.
 * Backend: AuthResponse { access_token, refresh_token, user: UserProfile }
 * IMPORTANT: this is flat — no nested `tokens` object.
 */
/**
 * Alias so settings/hooks can import `User` — backend actually calls this
 * UserProfile.  All fields are identical; `User` is the frontend alias.
 */
export type User = UserProfile;

/**
 * Generic API response envelope used by some endpoints.
 * Many backend handlers return unwrapped data; use specific types where known.
 */
export interface ApiResponse<T> {
  data: T;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: UserProfile;
}

/**
 * Token pair returned by POST /api/auth/refresh.
 * Backend: TokenPairResponse { access_token, refresh_token }
 */
export interface TokenPairResponse {
  access_token: string;
  refresh_token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

/**
 * QuickStats from GET /api/dashboard/stats.
 * Backend: QuickStats { tasks_done_today, tasks_overdue, best_habit_streak,
 *   focus_minutes_today, pomodoro_sessions_today, habit_completion_rate_today? }
 */
export interface QuickStats {
  tasks_done_today: number;
  tasks_overdue: number;
  best_habit_streak: number;
  focus_minutes_today: number;
  pomodoro_sessions_today: number;
  habit_completion_rate_today: number | null;
}

/**
 * DashboardTask — lightweight task card in the dashboard.
 * Backend: DashboardTask { id, title, priority, status, due_date?, estimated_time?,
 *   project_id?, project_name? }
 */
export interface DashboardTask {
  id: string;
  title: string;
  priority: Priority;
  status: TaskStatus;
  due_date: string | null;
  estimated_time: number | null;
  project_id: string | null;
  project_name: string | null;
}

/**
 * DashboardHabit — habit with today's completion status.
 * Backend: DashboardHabit { id, name, habit_type, target_value, logged_value?,
 *   completed, current_streak, color?, icon? }
 */
export interface DashboardHabit {
  id: string;
  name: string;
  habit_type: HabitType;
  target_value: number;
  logged_value: number | null;
  completed: boolean;
  current_streak: number;
  color: string | null;
  icon: string | null;
}

/**
 * DashboardEvent — calendar event snippet in the dashboard.
 * Backend: DashboardEvent { id, title, start_time, end_time, all_day,
 *   location?, color? }
 */
export interface DashboardEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  location: string | null;
  color: string | null;
}

/**
 * DashboardTimeBlock — time block snippet in the dashboard.
 * Backend: DashboardTimeBlock { id, title, start_time, end_time,
 *   estimated_minutes, actual_focus_minutes?, task_id?, task_title?, color? }
 */
export interface DashboardTimeBlock {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  estimated_minutes: number;
  actual_focus_minutes: number | null;
  task_id: string | null;
  task_title: string | null;
  color: string | null;
}

/**
 * DashboardResponse from GET /api/dashboard.
 * Backend: DashboardResponse { date, stats: QuickStats, tasks, habits, events, time_blocks }
 * Query param: ?date=YYYY-MM-DD (optional, defaults to today UTC)
 */
export interface DashboardResponse {
  date: string; // YYYY-MM-DD
  stats: QuickStats;
  tasks: DashboardTask[];
  habits: DashboardHabit[];
  events: DashboardEvent[];
  time_blocks: DashboardTimeBlock[];
}

// ─── Analytics ─────────────────────────────────────────────────────────────────

/**
 * PeriodSummaryResponse from GET /api/analytics/summary.
 * Backend: PeriodSummaryResponse { start, end, tasks_completed, tasks_created,
 *   focus_minutes, pomodoro_sessions, avg_habit_completion_rate,
 *   avg_tasks_completed_per_day }
 * Query params: start=YYYY-MM-DD, end=YYYY-MM-DD
 */
export interface PeriodSummaryResponse {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  tasks_completed: number;
  tasks_created: number;
  focus_minutes: number;
  pomodoro_sessions: number;
  avg_habit_completion_rate: number;
  avg_tasks_completed_per_day: number;
}

/**
 * DailyStatPoint — one element in GET /api/analytics/daily response array.
 * Backend: DailyStatPoint { stat_date, tasks_completed, tasks_created,
 *   focus_minutes, habit_completion_rate, pomodoro_sessions }
 * Query params: start=YYYY-MM-DD, end=YYYY-MM-DD
 */
export interface DailyStatPoint {
  stat_date: string; // YYYY-MM-DD
  tasks_completed: number;
  tasks_created: number;
  focus_minutes: number;
  habit_completion_rate: number;
  pomodoro_sessions: number;
}

/**
 * TimeUsageResponse from GET /api/analytics/time-usage.
 * Backend: TimeUsageResponse { start, end, total_focus_minutes, days: Vec<DayFocusPoint> }
 * Query params: start=YYYY-MM-DD, end=YYYY-MM-DD
 */
export interface DayFocusPoint {
  date: string; // YYYY-MM-DD
  focus_minutes: number;
}

export interface TimeUsageResponse {
  start: string;
  end: string;
  total_focus_minutes: number;
  days: DayFocusPoint[];
}

/**
 * CompletionRateResponse from GET /api/analytics/completion-rate.
 * Backend: CompletionRateResponse { start, end, overall_task_completion_rate,
 *   active_days_rate, daily: Vec<DailyCompletionPoint> }
 */
export interface DailyCompletionPoint {
  stat_date: string; // YYYY-MM-DD
  tasks_completed: number;
  tasks_created: number;
  completion_rate: number;
}

export interface CompletionRateResponse {
  start: string;
  end: string;
  overall_task_completion_rate: number;
  active_days_rate: number;
  daily: DailyCompletionPoint[];
}

/**
 * RefreshStatsResponse from POST /api/analytics/refresh and
 * POST /api/analytics/refresh/:date.
 */
export interface RefreshStatsResponse {
  refreshed_date: string; // YYYY-MM-DD
  stats: {
    id: string;
    user_id: string;
    stat_date: string;
    tasks_completed: number;
    tasks_created: number;
    focus_minutes: number;
    habit_completion_rate: number;
    pomodoro_sessions: number;
    created_at: string;
    updated_at: string;
  };
}

// ─── Search ────────────────────────────────────────────────────────────────────

/**
 * SearchResponse from GET /api/search.
 * Backend: SearchResponse { query, total, tasks?, projects?, habits? }
 * Query params: q (required), kinds (comma-separated "task,project,habit"),
 *   limit (per-kind, default 20, max 50)
 */
export interface TaskHit {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectHit {
  id: string;
  name: string;
  description: string | null;
  status: string;
  deadline: string | null;
  goal_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface HabitHit {
  id: string;
  name: string;
  description: string | null;
  habit_type: string;
  frequency: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface SearchResponse {
  query: string;
  total: number;
  tasks?: TaskHit[];
  projects?: ProjectHit[];
  habits?: HabitHit[];
}

// ─── Agile enums ──────────────────────────────────────────────────────────────

export type InitiativeStatus = "active" | "completed" | "paused" | "abandoned";
export type EpicStatus = "todo" | "in_progress" | "done" | "cancelled";
export type SprintStatus = "planned" | "active" | "completed";
export type WorkItemType = "story" | "task" | "bug" | "habit" | "milestone";
export type WorkItemStatus = "backlog" | "todo" | "in_progress" | "review" | "done";
// priority reuses existing `Priority`

// ─── Agile entities ────────────────────────────────────────────────────────────

export interface Initiative {
  id: string;
  user_id: string;
  goal_id: string;
  title: string;
  description: string | null;
  status: InitiativeStatus;
  color: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface EpicProgress {
  total_items: number;
  done_items: number;
  completion_rate: number;
}

export interface Epic {
  id: string;
  user_id: string;
  initiative_id: string;
  title: string;
  description: string | null;
  status: EpicStatus;
  start_date: string | null; // YYYY-MM-DD
  due_date: string | null; // YYYY-MM-DD
  color: string | null;
  position: number;
  progress: EpicProgress;
  total_points: number;
  done_points: number;
  created_at: string;
  updated_at: string;
}

export interface Sprint {
  id: string;
  user_id: string;
  project_id: string | null;
  name: string;
  goal_text: string | null;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  capacity_points: number;
  status: SprintStatus;
  velocity: number | null;
  completed_points: number;
  planned_points: number;
  committed_count: number;
  done_count: number;
  created_at: string;
  updated_at: string;
}

export interface WorkItemSubtask {
  id: string;
  work_item_id: string;
  title: string;
  is_done: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

/**
 * BoardColumn — a user-defined column on the Kanban board.
 * Mirrors the `board_columns` table row returned by GET /api/board-columns.
 * mapped_status links the 5 seeded defaults back to work_item_status; custom
 * columns have mapped_status = null.
 */
export interface BoardColumn {
  id: string;
  user_id?: string;
  project_id: string | null;
  name: string;
  color: string | null;
  position: number;
  wip_limit: number | null;
  mapped_status: WorkItemStatus | null;
  created_at: string;
  updated_at: string;
}

export interface WorkItem {
  id: string;
  user_id: string;
  project_id: string | null;
  epic_id: string | null;
  sprint_id: string | null;
  column_id: string | null;
  type: WorkItemType;
  title: string;
  description: string | null;
  status: WorkItemStatus;
  priority: Priority;
  story_points: number | null;
  position: number;
  due_date: string | null;
  recurrence_rule: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  subtasks: WorkItemSubtask[];
}

/** Kept for backwards compat — WorkItem is the primary entity. */
export type WorkItemAlias = WorkItem;

export interface WorkItemListItem {
  id: string;
  project_id: string | null;
  epic_id: string | null;
  sprint_id: string | null;
  column_id: string | null;
  type: WorkItemType;
  title: string;
  status: WorkItemStatus;
  priority: Priority;
  story_points: number | null;
  due_date: string | null;
  position: number;
  subtask_count: number;
  done_subtask_count: number;
  created_at: string;
  updated_at: string;
}

export interface SprintReview {
  id: string;
  user_id: string;
  sprint_id: string;
  planned_points: number;
  completed_points: number;
  velocity: number;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface Retrospective {
  id: string;
  user_id: string;
  sprint_id: string;
  went_well: string | null;
  went_wrong: string | null;
  action_items: { id: string; text: string; done?: boolean }[];
  created_at: string;
  updated_at: string;
}

export interface BurndownPoint {
  date: string;
  remaining_points: number;
  ideal_points: number;
}

export interface BurndownResponse {
  sprint_id: string;
  start_date: string;
  end_date: string;
  total_points: number;
  points: BurndownPoint[];
}

export interface VelocityPoint {
  sprint_id: string;
  sprint_name: string;
  planned_points: number;
  completed_points: number;
  velocity: number;
}

export interface EpicTimePoint {
  epic_id: string;
  epic_title: string;
  focus_minutes: number;
}

export interface GoalProgress {
  goal_id: string;
  title: string;
  completion_rate: number;
}

export interface SprintDashboardResponse {
  active_sprint: Sprint | null;
  sprint_progress_pct: number;
  goal_progress: GoalProgress[];
  today_time_blocks: DashboardTimeBlock[];
  overdue_work_items: WorkItemListItem[];
  habits: DashboardHabit[];
}

/** Generic list envelope matching the goal module pattern: { data, total }. */
export interface AgileListResponse<T> {
  data: T[];
  total: number;
}

// ─── Docs ──────────────────────────────────────────────────────────────────────

export type PageKind = "page" | "whiteboard";
export type PageStatus = "draft" | "published";

export interface Space {
  id: string;
  user_id: string;
  project_id: string | null;
  name: string;
  icon: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// Opaque TipTap/ProseMirror doc + Excalidraw scene
export type TipTapDoc = Record<string, unknown>;
export type ExcalidrawScene = Record<string, unknown>;

export interface Page {
  id: string;
  space_id: string;
  parent_id: string | null;
  user_id: string;
  title: string;
  kind: PageKind;
  content: TipTapDoc;
  excalidraw: ExcalidrawScene | null;
  status: PageStatus;
  position: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  // V2 Notion-parity fields
  icon: string | null;
  cover_url: string | null;
  is_public: boolean;
  public_slug: string | null;
  is_template: boolean;
}

// GET /api/pages?space_id= returns nested tree nodes
export interface PageTreeNode {
  id: string;
  space_id: string;
  parent_id: string | null;
  title: string;
  kind: PageKind;
  status: PageStatus;
  position: number;
  // V2 Notion-parity fields included in tree
  icon: string | null;
  is_public: boolean;
  public_slug: string | null;
  is_template: boolean;
  children: PageTreeNode[];
}

export interface PageSearchResult {
  id: string;
  space_id: string;
  title: string;
  kind: PageKind;
  // V2 additions
  icon: string | null;
  snippet: string | null;
}

export interface PageVersionSummary {
  id: string;
  page_id: string;
  user_id: string;
  title: string;
  created_at: string;
}

export interface PageVersion extends PageVersionSummary {
  content: TipTapDoc;
}

export interface PageComment {
  id: string;
  page_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export interface PageImageUploadResponse {
  url: string; // "/uploads/<file>"
}

// ─── Docs V2: Page backlinks + public state ────────────────────────────────────

/** Single backlink: a page that contains an @page mention pointing at this page. */
export interface PageBacklink {
  source_page_id: string;
  title: string;
  space_id: string;
}

/** Response shape from POST /api/pages/:id/public */
export interface PagePublicState {
  is_public: boolean;
  public_slug: string | null;
}

/** Outbound link ref (GET /api/pages/:id/links). */
export interface PageLinkRef {
  target_page_id: string;
  title: string;
  space_id: string;
}

// ─── Docs V2: Database types ───────────────────────────────────────────────────

export type DatabaseColumnType =
  | "text"
  | "number"
  | "date"
  | "checkbox"
  | "select"
  | "multi_select"
  | "status"
  | "url";

export interface SelectOption {
  id: string;
  name: string;
  color: string;
}

export interface Database {
  id: string;
  space_id: string;
  user_id: string;
  title: string;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatabaseColumn {
  id: string;
  database_id: string;
  name: string;
  type: DatabaseColumnType;
  options: SelectOption[];
  position: number;
  created_at: string;
}

export interface DatabaseRow {
  id: string;
  database_id: string;
  /** Map of column id → typed value. Missing key = empty cell. */
  values: Record<string, unknown>;
  position: number;
  created_at: string;
  updated_at: string;
}

export type DatabaseViewType = "table" | "board";

export interface ViewFilter {
  column_id: string;
  op: "eq" | "neq" | "contains" | "gt" | "lt" | "is_empty" | "is_not_empty";
  value?: unknown;
}

export interface ViewSort {
  column_id: string;
  direction: "asc" | "desc";
}

export interface DatabaseViewConfig {
  /** Board only: must be a select|status column id. */
  group_by_column_id?: string;
  /** AND-combined filter conditions. */
  filters?: ViewFilter[];
  sorts?: ViewSort[];
  /** Table only: explicit column display order. */
  column_order?: string[];
  /** Table only: hidden column ids. */
  hidden_column_ids?: string[];
}

export interface DatabaseView {
  id: string;
  database_id: string;
  name: string;
  type: DatabaseViewType;
  config: DatabaseViewConfig;
  position: number;
  created_at: string;
  updated_at: string;
}

/** Response from GET /api/databases/:id — full detail with columns and views. */
export interface DatabaseDetail {
  database: Database;
  columns: DatabaseColumn[];
  views: DatabaseView[];
}

/** One group bucket in a board-view response. */
export interface BoardGroup {
  option_id: string | null;
  option_name: string;
  rows: DatabaseRow[];
}

/**
 * Response from GET /api/databases/:id/views/:viewId/rows.
 * Table: { rows: DatabaseRow[] }
 * Board: { groups: BoardGroup[] }
 */
export interface ViewRowsResponse {
  rows?: DatabaseRow[];
  groups?: BoardGroup[];
}

// ─── Docs V2: Search result types ─────────────────────────────────────────────

export interface PageSearchHit {
  id: string;
  space_id: string;
  title: string;
  icon: string | null;
  snippet: string;
}

export interface DatabaseSearchHit {
  id: string;
  space_id: string;
  title: string;
  icon: string | null;
  matched_rows: number;
}

/** Response from GET /api/docs/search */
export interface DocSearchResult {
  pages: PageSearchHit[];
  databases: DatabaseSearchHit[];
}

// ─── Docs V2: Public page types (unauthenticated) ─────────────────────────────

/** Lightweight child reference within a public page. */
export interface PublicPageRef {
  id: string;
  title: string;
  icon: string | null;
  public_slug: string | null;
}

/** Full public page response from GET /api/public/pages/:slug */
export interface PublicPage {
  id: string;
  title: string;
  icon: string | null;
  cover_url: string | null;
  content: TipTapDoc;
  updated_at: string;
  /** Direct child pages that are also is_public = true. */
  children: PublicPageRef[];
}

/** Recursive tree node for GET /api/public/pages/:slug/tree */
export interface PublicPageTreeNode {
  id: string;
  title: string;
  icon: string | null;
  public_slug: string | null;
  children: PublicPageTreeNode[];
}

// ─── API Endpoint Paths (REST contract — verbatim from backend) ─────────────────

export const API_ENDPOINTS = {
  // ── Auth (/api/auth) ──────────────────────────────────────────────────────
  AUTH_LOGIN: "/api/auth/login",
  AUTH_REGISTER: "/api/auth/register",
  AUTH_REFRESH: "/api/auth/refresh",
  AUTH_LOGOUT: "/api/auth/logout",
  AUTH_ME: "/api/auth/me",

  // ── Tasks (/api/tasks) ────────────────────────────────────────────────────
  // GET / POST /api/tasks
  TASKS: "/api/tasks",
  // GET / PATCH / DELETE /api/tasks/:id
  TASK_BY_ID: (id: string) => `/api/tasks/${id}`,
  // GET / POST /api/tasks/:id/subtasks
  TASK_SUBTASKS: (id: string) => `/api/tasks/${id}/subtasks`,
  // PATCH / DELETE /api/tasks/:id/subtasks/:subtask_id
  TASK_SUBTASK_BY_ID: (id: string, subtaskId: string) =>
    `/api/tasks/${id}/subtasks/${subtaskId}`,
  // POST /api/tasks/:id/tags  { tag_id }
  TASK_ATTACH_TAG: (id: string) => `/api/tasks/${id}/tags`,
  // DELETE /api/tasks/:id/tags/:tag_id
  TASK_DETACH_TAG: (id: string, tagId: string) =>
    `/api/tasks/${id}/tags/${tagId}`,

  // ── Tags (under /api/tasks) ───────────────────────────────────────────────
  // GET / POST /api/tasks/tags
  TAGS: "/api/tasks/tags",
  // PATCH / DELETE /api/tasks/tags/:tag_id
  TAG_BY_ID: (tagId: string) => `/api/tasks/tags/${tagId}`,

  // ── Projects (/api/projects) ──────────────────────────────────────────────
  PROJECTS: "/api/projects",
  PROJECT_BY_ID: (id: string) => `/api/projects/${id}`,
  PROJECTS_REORDER: "/api/projects/reorder",

  // ── Goals (/api/goals) ────────────────────────────────────────────────────
  GOALS: "/api/goals",
  GOAL_BY_ID: (id: string) => `/api/goals/${id}`,
  GOAL_POSITION: (id: string) => `/api/goals/${id}/position`,
  GOAL_PROJECTS: (id: string) => `/api/goals/${id}/projects`,

  // ── Habits (/api/habits) ──────────────────────────────────────────────────
  HABITS: "/api/habits",
  HABIT_BY_ID: (id: string) => `/api/habits/${id}`,
  HABIT_ARCHIVE: (id: string) => `/api/habits/${id}/archive`,
  HABIT_LOGS: (id: string) => `/api/habits/${id}/logs`,
  HABIT_LOG_BY_ID: (id: string, logId: string) =>
    `/api/habits/${id}/logs/${logId}`,

  // ── Calendar (/api/calendar) ──────────────────────────────────────────────
  // GET (?start=RFC3339&end=RFC3339) / POST /api/calendar
  CALENDAR: "/api/calendar",
  // GET / PATCH / DELETE /api/calendar/:id
  CALENDAR_BY_ID: (id: string) => `/api/calendar/${id}`,

  // ── Timeblocks (/api/timeblocks) ──────────────────────────────────────────
  // GET (?from&to&task_id&offset&limit) / POST /api/timeblocks
  TIMEBLOCKS: "/api/timeblocks",
  // GET / PATCH / DELETE /api/timeblocks/:id
  TIMEBLOCK_BY_ID: (id: string) => `/api/timeblocks/${id}`,
  // GET / POST /api/timeblocks/:id/focus-sessions
  FOCUS_SESSIONS: (blockId: string) =>
    `/api/timeblocks/${blockId}/focus-sessions`,
  // PATCH /api/timeblocks/:id/focus-sessions/:session_id/pause
  FOCUS_SESSION_PAUSE: (blockId: string, sessionId: string) =>
    `/api/timeblocks/${blockId}/focus-sessions/${sessionId}/pause`,
  // PATCH /api/timeblocks/:id/focus-sessions/:session_id/resume
  FOCUS_SESSION_RESUME: (blockId: string, sessionId: string) =>
    `/api/timeblocks/${blockId}/focus-sessions/${sessionId}/resume`,
  // PATCH /api/timeblocks/:id/focus-sessions/:session_id/finish
  FOCUS_SESSION_FINISH: (blockId: string, sessionId: string) =>
    `/api/timeblocks/${blockId}/focus-sessions/${sessionId}/finish`,

  // ── Analytics (/api/analytics) ────────────────────────────────────────────
  // GET ?start=YYYY-MM-DD&end=YYYY-MM-DD
  ANALYTICS_SUMMARY: "/api/analytics/summary",
  // GET ?start=YYYY-MM-DD&end=YYYY-MM-DD
  ANALYTICS_DAILY: "/api/analytics/daily",
  // GET ?start=YYYY-MM-DD&end=YYYY-MM-DD
  ANALYTICS_TIME_USAGE: "/api/analytics/time-usage",
  // GET ?start=YYYY-MM-DD&end=YYYY-MM-DD
  ANALYTICS_COMPLETION_RATE: "/api/analytics/completion-rate",
  // POST (no body) — refresh today's stats
  ANALYTICS_REFRESH: "/api/analytics/refresh",
  // POST — refresh a specific date
  ANALYTICS_REFRESH_DATE: (date: string) => `/api/analytics/refresh/${date}`,

  // ── Notifications (/api/notifications) ────────────────────────────────────
  // GET (?unread_only&page&page_size) / POST
  NOTIFICATIONS: "/api/notifications",
  // GET / PATCH / DELETE /api/notifications/:id
  NOTIFICATION_BY_ID: (id: string) => `/api/notifications/${id}`,
  // POST /api/notifications/:id/read — mark single as read
  NOTIFICATION_MARK_READ: (id: string) => `/api/notifications/${id}/read`,
  // POST /api/notifications/mark-all-read
  NOTIFICATIONS_MARK_ALL_READ: "/api/notifications/mark-all-read",
  // GET /api/notifications/unread-count
  NOTIFICATIONS_UNREAD_COUNT: "/api/notifications/unread-count",

  // ── Search (/api/search) ──────────────────────────────────────────────────
  // GET ?q=&kinds=task,project,habit&limit=
  SEARCH: "/api/search",

  // ── Dashboard (/api/dashboard) ────────────────────────────────────────────
  // GET ?date=YYYY-MM-DD (optional)
  DASHBOARD: "/api/dashboard",
  // GET ?date=YYYY-MM-DD (optional)
  DASHBOARD_STATS: "/api/dashboard/stats",

  // ── Users / profile (/api/auth — no separate /api/users router yet) ────────
  // GET /api/auth/me — current user profile
  USERS_PROFILE: "/api/auth/me",
  // PATCH /api/auth/me — update display_name / timezone (backend stub)
  USERS_UPDATE_PROFILE: "/api/auth/me",
  // POST|DELETE /api/auth/me/avatar — avatar upload/remove (backend stub)
  USERS_AVATAR: "/api/auth/me/avatar",

  // ── Auth — session management ─────────────────────────────────────────────
  // POST /api/auth/logout-all — revoke all refresh tokens for the user
  AUTH_LOGOUT_ALL: "/api/auth/logout-all",

  // ── Settings (/api/settings) ──────────────────────────────────────────────
  // GET | PATCH /api/settings/appearance
  SETTINGS_APPEARANCE: "/api/settings/appearance",
  // GET | PATCH /api/settings/notifications
  SETTINGS_NOTIFICATIONS: "/api/settings/notifications",
  // POST /api/settings/account/password — change password
  SETTINGS_ACCOUNT_PASSWORD: "/api/settings/account/password",
  // POST /api/settings/account/delete — delete account
  SETTINGS_ACCOUNT_DELETE: "/api/settings/account/delete",

  // ── Push notifications (/api/notifications/push) ──────────────────────────
  // POST /api/notifications/push/subscribe
  NOTIFICATIONS_PUSH_SUBSCRIBE: "/api/notifications/push/subscribe",
  // POST /api/notifications/push/unsubscribe
  NOTIFICATIONS_PUSH_UNSUBSCRIBE: "/api/notifications/push/unsubscribe",

  // ── Initiatives (/api/initiatives) ────────────────────────────────────────
  INITIATIVES: "/api/initiatives",
  INITIATIVE_BY_ID: (id: string) => `/api/initiatives/${id}`,
  INITIATIVE_EPICS: (id: string) => `/api/initiatives/${id}/epics`,

  // ── Epics (/api/epics) ────────────────────────────────────────────────────
  EPICS: "/api/epics",
  EPIC_BY_ID: (id: string) => `/api/epics/${id}`,
  EPIC_WORK_ITEMS: (id: string) => `/api/epics/${id}/work-items`,

  // ── Sprints (/api/sprints) ────────────────────────────────────────────────
  SPRINTS: "/api/sprints",
  SPRINT_ACTIVE: "/api/sprints/active",
  SPRINT_VELOCITY: "/api/sprints/velocity",
  SPRINT_BY_ID: (id: string) => `/api/sprints/${id}`,
  SPRINT_ACTIVATE: (id: string) => `/api/sprints/${id}/activate`,
  SPRINT_COMPLETE: (id: string) => `/api/sprints/${id}/complete`,
  SPRINT_WORK_ITEMS: (id: string) => `/api/sprints/${id}/work-items`,
  SPRINT_BURNDOWN: (id: string) => `/api/sprints/${id}/burndown`,
  SPRINT_REVIEW: (id: string) => `/api/sprints/${id}/review`,
  SPRINT_RETRO: (id: string) => `/api/sprints/${id}/retrospective`,

  // ── Board Columns (/api/board-columns) ───────────────────────────────────
  BOARD_COLUMNS: "/api/board-columns",
  BOARD_COLUMN_BY_ID: (id: string) => `/api/board-columns/${id}`,
  BOARD_COLUMNS_REORDER: "/api/board-columns/reorder",

  // ── Work Items (/api/work-items) ──────────────────────────────────────────
  WORK_ITEMS: "/api/work-items",
  WORK_ITEM_BY_ID: (id: string) => `/api/work-items/${id}`,
  WORK_ITEM_STATUS: (id: string) => `/api/work-items/${id}/status`,
  WORK_ITEM_COLUMN: (id: string) => `/api/work-items/${id}/column`,
  WORK_ITEM_POINTS: (id: string) => `/api/work-items/${id}/points`,
  WORK_ITEM_SPRINT: (id: string) => `/api/work-items/${id}/sprint`,
  WORK_ITEM_BACKLOG: (id: string) => `/api/work-items/${id}/backlog`,
  WORK_ITEM_SUBTASKS: (id: string) => `/api/work-items/${id}/subtasks`,
  WORK_ITEM_SUBTASK_BY_ID: (id: string, subtaskId: string) =>
    `/api/work-items/${id}/subtasks/${subtaskId}`,
  // GET|POST /api/work-items/:id/links
  WORK_ITEM_LINKS: (id: string) => `/api/work-items/${id}/links`,
  // DELETE /api/work-items/:id/links/:link_id
  WORK_ITEM_LINK_BY_ID: (id: string, linkId: string) =>
    `/api/work-items/${id}/links/${linkId}`,
  // GET|POST /api/work-items/:id/web-links
  WORK_ITEM_WEB_LINKS: (id: string) => `/api/work-items/${id}/web-links`,
  // DELETE /api/work-items/:id/web-links/:link_id
  WORK_ITEM_WEB_LINK_BY_ID: (id: string, linkId: string) =>
    `/api/work-items/${id}/web-links/${linkId}`,
  // GET|POST /api/work-items/:id/attachments
  WORK_ITEM_ATTACHMENTS: (id: string) => `/api/work-items/${id}/attachments`,
  // DELETE /api/work-items/:id/attachments/:att_id
  WORK_ITEM_ATTACHMENT_BY_ID: (id: string, attId: string) =>
    `/api/work-items/${id}/attachments/${attId}`,

  // ── Backlog (/api/backlog) ────────────────────────────────────────────────
  BACKLOG: "/api/backlog",

  // ── Dashboard evolved ─────────────────────────────────────────────────────
  DASHBOARD_SPRINT: "/api/dashboard/sprint",

  // ── Analytics evolved ─────────────────────────────────────────────────────
  ANALYTICS_VELOCITY: "/api/analytics/velocity",
  ANALYTICS_BURNDOWN: "/api/analytics/burndown",
  ANALYTICS_TIME_BY_EPIC: "/api/analytics/time-by-epic",

  // ── Docs: Spaces (/api/spaces) ────────────────────────────────────────────
  SPACES: "/api/spaces",                                  // GET ?project_id? / POST
  SPACE_BY_ID: (id: string) => `/api/spaces/${id}`,       // GET / PATCH / DELETE

  // ── Docs: Pages (/api/pages) ──────────────────────────────────────────────
  PAGES: "/api/pages",                                    // GET ?space_id= / POST
  PAGE_BY_ID: (id: string) => `/api/pages/${id}`,         // GET / PATCH / DELETE
  PAGES_SEARCH: "/api/pages/search",                      // GET ?q=&space_id?
  PAGE_MOVE: "/api/pages/move",                           // POST { id, parent_id?, position }
  PAGE_PUBLISH: (id: string) => `/api/pages/${id}/publish`,
  PAGE_VERSIONS: (id: string) => `/api/pages/${id}/versions`,            // GET / POST
  PAGE_VERSION_BY_ID: (id: string, vid: string) =>
    `/api/pages/${id}/versions/${vid}`,                                  // GET
  PAGE_VERSION_RESTORE: (id: string, vid: string) =>
    `/api/pages/${id}/versions/${vid}/restore`,                          // POST
  PAGE_IMAGES: (id: string) => `/api/pages/${id}/images`,                // POST multipart
  PAGE_COMMENTS: (id: string) => `/api/pages/${id}/comments`,            // GET / POST
  PAGE_COMMENT_BY_ID: (id: string, cid: string) =>
    `/api/pages/${id}/comments/${cid}`,                                  // DELETE

  // ── Docs V2: Page additions ────────────────────────────────────────────────
  // POST /api/pages/:id/public  { public: bool } → PagePublicState
  PAGE_PUBLIC: (id: string) => `/api/pages/${id}/public`,
  // POST /api/pages/:id/cover  multipart → { url }
  PAGE_COVER: (id: string) => `/api/pages/${id}/cover`,
  // GET /api/pages/templates?space_id?
  PAGES_TEMPLATES: "/api/pages/templates",
  // POST /api/pages/from-template  { space_id, parent_id?, template_id, title? }
  PAGE_FROM_TEMPLATE: "/api/pages/from-template",
  // GET /api/pages/:id/backlinks → PageBacklink[]
  PAGE_BACKLINKS: (id: string) => `/api/pages/${id}/backlinks`,
  // GET /api/pages/:id/links → PageLinkRef[]
  PAGE_LINKS: (id: string) => `/api/pages/${id}/links`,

  // ── Docs V2: Databases (/api/databases) ───────────────────────────────────
  // GET ?space_id= / POST
  DATABASES: "/api/databases",
  // GET / PATCH / DELETE /api/databases/:id
  DATABASE_BY_ID: (id: string) => `/api/databases/${id}`,
  // GET /api/databases/:id/columns / POST
  DATABASE_COLUMNS: (id: string) => `/api/databases/${id}/columns`,
  // PATCH / DELETE /api/databases/:id/columns/:colId
  DATABASE_COLUMN_BY_ID: (id: string, colId: string) =>
    `/api/databases/${id}/columns/${colId}`,
  // GET /api/databases/:id/rows / POST
  DATABASE_ROWS: (id: string) => `/api/databases/${id}/rows`,
  // PATCH /api/databases/:id/rows  (batch update)
  DATABASE_ROWS_BATCH: (id: string) => `/api/databases/${id}/rows`,
  // PATCH / DELETE /api/databases/:id/rows/:rowId
  DATABASE_ROW_BY_ID: (id: string, rowId: string) =>
    `/api/databases/${id}/rows/${rowId}`,
  // GET /api/databases/:id/views / POST
  DATABASE_VIEWS: (id: string) => `/api/databases/${id}/views`,
  // PATCH / DELETE /api/databases/:id/views/:viewId
  DATABASE_VIEW_BY_ID: (id: string, viewId: string) =>
    `/api/databases/${id}/views/${viewId}`,
  // GET /api/databases/:id/views/:viewId/rows
  DATABASE_VIEW_ROWS: (id: string, viewId: string) =>
    `/api/databases/${id}/views/${viewId}/rows`,

  // ── Docs V2: Search (/api/docs) ───────────────────────────────────────────
  // GET /api/docs/search?q=&space_id?
  DOCS_SEARCH: "/api/docs/search",

  // ── Docs V2: Public (unauthenticated, /api/public) ────────────────────────
  // GET /api/public/pages/:slug
  PUBLIC_PAGE: (slug: string) => `/api/public/pages/${slug}`,
  // GET /api/public/pages/:slug/tree
  PUBLIC_PAGE_TREE: (slug: string) => `/api/public/pages/${slug}/tree`,
} as const;
