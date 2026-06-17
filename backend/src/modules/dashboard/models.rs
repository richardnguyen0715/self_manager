//! Dashboard module — response DTOs for the aggregated today view.
//!
//! The dashboard is read-only; it surfaces data owned by other modules
//! (tasks, habits, calendar events, time blocks) through a single cohesive
//! snapshot endpoint and a quick-stats endpoint.
//!
//! No request DTOs with validator annotations are needed here because all
//! inputs are either path parameters or simple date query strings.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Re-used enum mirrors ───────────────────────────────────────────────────────
//
// We redeclare lightweight enum types rather than importing from sibling
// modules to keep the dashboard module self-contained and avoid exposing
// module-internal types across the crate boundary.

/// Mirrors `task_priority` Postgres enum.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "task_priority", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DashTaskPriority {
    Critical,
    High,
    Medium,
    Low,
}

/// Mirrors `task_status` Postgres enum.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "task_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DashTaskStatus {
    Inbox,
    Planned,
    InProgress,
    Waiting,
    Completed,
    Archived,
}

/// Mirrors `habit_type` Postgres enum.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "habit_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DashHabitType {
    Check,
    Count,
    Duration,
}

// ── Query parameters ───────────────────────────────────────────────────────────

/// Optional date override for the dashboard.
///
/// When absent the server uses today in UTC.  The string must be `YYYY-MM-DD`.
#[derive(Clone, Debug, Deserialize)]
pub struct DashboardDateQuery {
    /// Target date (`YYYY-MM-DD`).  Defaults to today (UTC) when omitted.
    pub date: Option<String>,
}

// ── Task snapshot ──────────────────────────────────────────────────────────────

/// A lightweight task card shown on the dashboard.
#[derive(Clone, Debug, Serialize, sqlx::FromRow)]
pub struct DashboardTask {
    pub id: Uuid,
    pub title: String,
    pub priority: DashTaskPriority,
    pub status: DashTaskStatus,
    pub due_date: Option<DateTime<Utc>>,
    pub estimated_time: Option<i32>,
    pub project_id: Option<Uuid>,
    /// Cached project name joined from `projects`.
    pub project_name: Option<String>,
}

// ── Habit snapshot ─────────────────────────────────────────────────────────────

/// A habit row enriched with today's completion status.
#[derive(Clone, Debug, Serialize)]
pub struct DashboardHabit {
    pub id: Uuid,
    pub name: String,
    pub habit_type: DashHabitType,
    pub target_value: f64,
    /// Value logged for the target date; `None` when not yet logged.
    pub logged_value: Option<f64>,
    /// `true` when `logged_value >= target_value`.
    pub completed: bool,
    /// Current streak length in days.
    pub current_streak: i32,
    pub color: Option<String>,
    pub icon: Option<String>,
}

// ── Calendar event snapshot ────────────────────────────────────────────────────

/// A calendar event that falls on the target date.
#[derive(Clone, Debug, Serialize, sqlx::FromRow)]
pub struct DashboardEvent {
    pub id: Uuid,
    pub title: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub all_day: bool,
    pub location: Option<String>,
    pub color: Option<String>,
}

// ── Time-block snapshot ────────────────────────────────────────────────────────

/// A time block scheduled on the target date, with its linked task title.
#[derive(Clone, Debug, Serialize, sqlx::FromRow)]
pub struct DashboardTimeBlock {
    pub id: Uuid,
    pub title: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    /// Derived: `(end_time - start_time)` in whole minutes.
    pub estimated_minutes: i64,
    /// Minutes of actual focus time from completed focus sessions.
    pub actual_focus_minutes: Option<i64>,
    pub task_id: Option<Uuid>,
    /// Linked task title, if any.
    pub task_title: Option<String>,
    pub color: Option<String>,
}

// ── Quick stats ────────────────────────────────────────────────────────────────

/// Aggregated numbers shown in the dashboard header bar.
#[derive(Clone, Debug, Serialize)]
pub struct QuickStats {
    /// Tasks completed on the target date.
    pub tasks_done_today: i64,
    /// Tasks whose `due_date` is before now and status is not completed/archived.
    pub tasks_overdue: i64,
    /// Best current habit streak across all active habits.
    pub best_habit_streak: i32,
    /// Total focus minutes today derived from finished `focus_sessions`.
    pub focus_minutes_today: i64,
    /// Number of pomodoro sessions completed today.
    pub pomodoro_sessions_today: i64,
    /// Rate of habits completed today (0.0–1.0).  `null` when no habits exist.
    pub habit_completion_rate_today: Option<f64>,
}

// ── Aggregate response ─────────────────────────────────────────────────────────

/// Full dashboard snapshot returned by `GET /api/dashboard`.
#[derive(Clone, Debug, Serialize)]
pub struct DashboardResponse {
    /// The ISO-8601 date this snapshot represents (YYYY-MM-DD).
    pub date: NaiveDate,
    /// Quick stat counters shown in the header.
    pub stats: QuickStats,
    /// Tasks due today, overdue, or in-progress — capped at 50.
    pub tasks: Vec<DashboardTask>,
    /// Active habits that should be tracked today.
    pub habits: Vec<DashboardHabit>,
    /// Calendar events that overlap with the target date.
    pub events: Vec<DashboardEvent>,
    /// Time blocks scheduled for the target date.
    pub time_blocks: Vec<DashboardTimeBlock>,
}

// ── Habit streak helper (DB intermediate) ─────────────────────────────────────

/// Internal row type used to hydrate habit data + today's log in one pass.
///
/// `target_value` and `logged_value` are cast to `DOUBLE PRECISION` in SQL so
/// no `bigdecimal` sqlx feature is required.
#[derive(sqlx::FromRow)]
pub(super) struct HabitWithLog {
    pub id: Uuid,
    pub name: String,
    pub habit_type: DashHabitType,
    /// Cast from `NUMERIC(10,2)` via `::DOUBLE PRECISION` in the query.
    pub target_value: f64,
    pub color: Option<String>,
    pub icon: Option<String>,
    /// Logged value for the target date; `NULL` when not yet logged.
    /// Cast from `NUMERIC(10,2)` via `::DOUBLE PRECISION` in the query.
    pub logged_value: Option<f64>,
    /// Whether the log entry is marked completed.
    pub log_completed: Option<bool>,
}

/// Internal row for streak calculation.
#[derive(sqlx::FromRow)]
pub(super) struct StreakRow {
    pub habit_id: Uuid,
    pub log_date: NaiveDate,
    pub completed: bool,
}
