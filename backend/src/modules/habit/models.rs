//! Habit module — domain models, database row types, and request/response DTOs.
//!
//! The database schema (from `migrations/0001_init.sql`) defines:
//! - `habits`      — one row per habit definition owned by a user.
//! - `habit_logs`  — one row per (habit, date) completion entry.
//!
//! Enum types on the Postgres side are `habit_type` and `habit_frequency`.
//!
//! `NUMERIC(10,2)` columns (`target_value`, `value`) are decoded as `f64` —
//! sufficient precision for the productivity-domain values used here.

use chrono::{DateTime, NaiveDate, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

// ── Postgres-backed enums ─────────────────────────────────────────────────────

/// Mirrors the `habit_type` Postgres enum.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "habit_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum HabitType {
    Check,
    Count,
    Duration,
}

/// Mirrors the `habit_frequency` Postgres enum.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "habit_frequency", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum HabitFrequency {
    Daily,
    Weekly,
    Custom,
}

// ── Database row types ────────────────────────────────────────────────────────

/// Full row from the `habits` table.
///
/// `NUMERIC(10,2)` is mapped to `f64` — SQLx decodes it via the wire
/// protocol's text representation without requiring the `bigdecimal` feature.
#[derive(Clone, Debug, FromRow)]
pub struct Habit {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub habit_type: HabitType,
    pub target_value: f64,
    pub frequency: HabitFrequency,
    /// Day-of-week array (0 = Sun … 6 = Sat). NULL when frequency ≠ custom.
    pub frequency_days: Option<Vec<i32>>,
    /// Local time-of-day for the reminder.
    pub reminder_time: Option<NaiveTime>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub archived: bool,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Full row from the `habit_logs` table.
#[derive(Clone, Debug, FromRow)]
pub struct HabitLog {
    pub id: Uuid,
    pub habit_id: Uuid,
    pub user_id: Uuid,
    pub log_date: NaiveDate,
    pub value: f64,
    pub completed: bool,
    pub note: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

/// `POST /habits` — create a new habit.
#[derive(Clone, Debug, Deserialize, Validate)]
pub struct CreateHabitRequest {
    #[validate(length(min = 1, max = 255, message = "name must be 1–255 characters"))]
    pub name: String,

    #[validate(length(max = 2000, message = "description must be at most 2 000 characters"))]
    pub description: Option<String>,

    pub habit_type: HabitType,

    /// Must be ≥ 1.  Defaults to 1 server-side when absent.
    pub target_value: Option<f64>,

    pub frequency: HabitFrequency,

    /// Required (and validated) when `frequency == Custom`.
    /// Each element must be in 0–6.
    pub frequency_days: Option<Vec<i32>>,

    /// `"HH:MM"` local time string (e.g. `"07:30"`).
    pub reminder_time: Option<String>,

    pub color: Option<String>,
    pub icon: Option<String>,
    pub position: Option<i32>,
}

/// `PATCH /habits/:id` — partial update.
///
/// Every field is wrapped in an outer `Option` — `None` means "not supplied,
/// keep existing"; `Some(None)` means "clear this nullable field".
#[derive(Clone, Debug, Deserialize, Validate)]
pub struct UpdateHabitRequest {
    #[validate(length(min = 1, max = 255, message = "name must be 1–255 characters"))]
    pub name: Option<String>,

    #[validate(length(max = 2000, message = "description must be at most 2 000 characters"))]
    pub description: Option<Option<String>>,

    pub habit_type: Option<HabitType>,
    pub target_value: Option<f64>,
    pub frequency: Option<HabitFrequency>,
    pub frequency_days: Option<Option<Vec<i32>>>,
    /// `None` = not supplied; `Some(None)` = clear; `Some(Some("HH:MM"))` = set.
    pub reminder_time: Option<Option<String>>,
    pub color: Option<Option<String>>,
    pub icon: Option<Option<String>>,
    pub archived: Option<bool>,
    pub position: Option<i32>,
}

/// `POST /habits/:id/logs` — log a value for a given date.
#[derive(Clone, Debug, Deserialize, Validate)]
pub struct LogHabitRequest {
    /// ISO-8601 date string (`YYYY-MM-DD`).
    #[validate(length(equal = 10, message = "log_date must be YYYY-MM-DD"))]
    pub log_date: String,

    /// Measured value.  For `check` habits use 0.0 or 1.0.
    pub value: f64,

    #[validate(length(max = 1000, message = "note must be at most 1 000 characters"))]
    pub note: Option<String>,
}

// ── Response DTOs ─────────────────────────────────────────────────────────────

/// Enriched habit response that also carries live stats.
#[derive(Clone, Debug, Serialize)]
pub struct HabitResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub habit_type: HabitType,
    pub target_value: f64,
    pub frequency: HabitFrequency,
    pub frequency_days: Option<Vec<i32>>,
    /// `"HH:MM"` formatted reminder time, if set.
    pub reminder_time: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub archived: bool,
    pub position: i32,
    /// Consecutive completed periods (days for daily/custom, weeks for weekly).
    pub current_streak: i32,
    /// Fraction of applicable periods completed in the last 30 days (0.0–1.0).
    pub completion_rate_30d: f64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Response for a single habit log entry.
#[derive(Clone, Debug, Serialize)]
pub struct HabitLogResponse {
    pub id: Uuid,
    pub habit_id: Uuid,
    pub log_date: NaiveDate,
    pub value: f64,
    pub completed: bool,
    pub note: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Query parameters for `GET /habits/:id/logs`.
#[derive(Clone, Debug, Deserialize)]
pub struct LogsQuery {
    /// Inclusive start date (`YYYY-MM-DD`). Defaults to 30 days ago.
    pub from: Option<NaiveDate>,
    /// Inclusive end date (`YYYY-MM-DD`). Defaults to today.
    pub to: Option<NaiveDate>,
}
