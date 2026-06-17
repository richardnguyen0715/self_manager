//! Analytics module — database row types and request/response DTOs.
//!
//! # Database tables
//! - `analytics_events` — raw domain event log (append-only).
//! - `daily_stats`       — pre-aggregated per-user per-day counters.
//!
//! # DTO conventions
//! - Request structs carry a `_Request` suffix and derive [`validator::Validate`].
//! - Response structs carry a `_Response` suffix (or are named descriptively).

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

// ── Raw event log ─────────────────────────────────────────────────────────────

/// A single row from the `analytics_events` table.
#[derive(Debug, Clone, FromRow, Serialize)]
pub struct AnalyticsEvent {
    pub id: Uuid,
    pub user_id: Uuid,
    pub event_type: String,
    pub entity_id: Option<Uuid>,
    pub metadata: Option<serde_json::Value>,
    pub occurred_at: DateTime<Utc>,
}

// ── Pre-aggregated daily stats ─────────────────────────────────────────────

/// A single row from the `daily_stats` table.
///
/// `habit_completion_rate` is stored as `numeric(5,4)` in Postgres; we cast
/// it to `float8` in every query so SQLx maps it to `f64` without requiring
/// the optional `bigdecimal` or `rust_decimal` Cargo features.
#[derive(Debug, Clone, FromRow, Serialize)]
pub struct DailyStat {
    pub id: Uuid,
    pub user_id: Uuid,
    pub stat_date: NaiveDate,
    pub tasks_completed: i32,
    pub tasks_created: i32,
    pub focus_minutes: i32,
    /// Habit completion rate in [0.0, 1.0].
    pub habit_completion_rate: f64,
    pub pomodoro_sessions: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Query parameter structs ───────────────────────────────────────────────────

/// Query parameters for the period-based analytics endpoints.
///
/// All dates are expected as `YYYY-MM-DD` strings in the caller's local date;
/// the service computes timestamps in UTC.
#[derive(Debug, Deserialize, Validate)]
pub struct PeriodQuery {
    /// Inclusive start date (`YYYY-MM-DD`).
    #[validate(length(min = 10, max = 10))]
    pub start: String,
    /// Inclusive end date (`YYYY-MM-DD`).
    #[validate(length(min = 10, max = 10))]
    pub end: String,
}

/// Query parameters for the time-usage breakdown endpoint.
#[derive(Debug, Deserialize, Validate)]
pub struct TimeUsageQuery {
    #[validate(length(min = 10, max = 10))]
    pub start: String,
    #[validate(length(min = 10, max = 10))]
    pub end: String,
}

// ── Response DTOs ─────────────────────────────────────────────────────────────

/// Summary statistics for the requested period.
#[derive(Debug, Serialize)]
pub struct PeriodSummaryResponse {
    pub start: NaiveDate,
    pub end: NaiveDate,
    pub tasks_completed: i64,
    pub tasks_created: i64,
    pub focus_minutes: i64,
    pub pomodoro_sessions: i64,
    /// Average habit completion rate (0.0 – 1.0) across days that have data.
    pub avg_habit_completion_rate: f64,
    /// Average tasks completed per day within the period.
    pub avg_tasks_completed_per_day: f64,
}

/// One daily data point returned in a time-series list.
///
/// `habit_completion_rate` is mapped from a SQL `float8` cast, so it arrives
/// as `f64` directly — no `try_from` override needed.
#[derive(Debug, Serialize, FromRow)]
pub struct DailyStatPoint {
    pub stat_date: NaiveDate,
    pub tasks_completed: i32,
    pub tasks_created: i32,
    pub focus_minutes: i32,
    pub habit_completion_rate: f64,
    pub pomodoro_sessions: i32,
}

/// Aggregated focus time broken down by day within the requested window.
#[derive(Debug, Serialize)]
pub struct TimeUsageResponse {
    pub start: NaiveDate,
    pub end: NaiveDate,
    pub total_focus_minutes: i64,
    pub days: Vec<DayFocusPoint>,
}

/// Focus minutes for a single calendar day.
#[derive(Debug, Serialize, FromRow)]
pub struct DayFocusPoint {
    pub date: NaiveDate,
    pub focus_minutes: i64,
}

/// Completion rate aggregated per week.
#[derive(Debug, Serialize)]
pub struct CompletionRateResponse {
    pub start: NaiveDate,
    pub end: NaiveDate,
    pub overall_task_completion_rate: f64,
    /// Percentage of unique days within the period that had at least one task completed.
    pub active_days_rate: f64,
    pub daily: Vec<DailyCompletionPoint>,
}

/// Task completion data for a single day.
#[derive(Debug, Serialize, FromRow)]
pub struct DailyCompletionPoint {
    pub stat_date: NaiveDate,
    pub tasks_completed: i32,
    pub tasks_created: i32,
    /// tasks_completed / tasks_created, or 0.0 when tasks_created = 0.
    pub completion_rate: f64,
}

/// Response for the "upsert / refresh daily stats" admin/on-demand endpoint.
#[derive(Debug, Serialize)]
pub struct RefreshStatsResponse {
    pub refreshed_date: NaiveDate,
    pub stats: DailyStat,
}
