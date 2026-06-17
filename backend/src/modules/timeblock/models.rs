//! Domain models, database row types, and request/response DTOs for the
//! `timeblock` module.
//!
//! The three database types (`time_blocks`, `focus_sessions`, and the
//! `focus_mode` enum) are mapped here. All public-facing structs derive
//! [`serde::Serialize`] so they can be returned as JSON; request DTOs also
//! derive [`serde::Deserialize`] and [`validator::Validate`].

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

// ── Database enums ─────────────────────────────────────────────────────────────

/// Maps the `focus_mode` PostgreSQL enum.
///
/// Variant names in the DB: `pomodoro_25_5`, `deep_work_50_10`, `custom`.
/// Explicit renames are required because `rename_all = "snake_case"` would
/// produce `pomodoro255` / `deep_work5010`, which do not match the DB values.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "focus_mode")]
pub enum FocusMode {
    #[sqlx(rename = "pomodoro_25_5")]
    #[serde(rename = "pomodoro_25_5")]
    Pomodoro255,

    #[sqlx(rename = "deep_work_50_10")]
    #[serde(rename = "deep_work_50_10")]
    DeepWork5010,

    #[sqlx(rename = "custom")]
    #[serde(rename = "custom")]
    Custom,
}

// ── Database row structs ───────────────────────────────────────────────────────

/// A full row from the `time_blocks` table.
#[derive(Clone, Debug, Serialize, sqlx::FromRow)]
pub struct TimeBlock {
    pub id: Uuid,
    pub user_id: Uuid,
    pub task_id: Option<Uuid>,
    pub title: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub actual_start: Option<DateTime<Utc>>,
    pub actual_end: Option<DateTime<Utc>>,
    pub color: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A full row from the `focus_sessions` table.
#[derive(Clone, Debug, Serialize, sqlx::FromRow)]
pub struct FocusSession {
    pub id: Uuid,
    pub user_id: Uuid,
    pub time_block_id: Option<Uuid>,
    pub mode: FocusMode,
    pub started_at: DateTime<Utc>,
    pub paused_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_seconds: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Request DTOs ───────────────────────────────────────────────────────────────

/// Body for `POST /api/timeblocks`.
#[derive(Clone, Debug, Deserialize, Validate)]
pub struct CreateTimeBlockRequest {
    #[validate(length(min = 1, max = 255, message = "title must be 1–255 characters"))]
    pub title: String,

    /// RFC 3339 / ISO 8601 datetime with timezone offset.
    pub start_time: DateTime<Utc>,

    /// Must be strictly after `start_time` (also enforced by DB constraint).
    pub end_time: DateTime<Utc>,

    /// Optional task to link. The task must belong to the same user.
    pub task_id: Option<Uuid>,

    /// CSS hex color string, e.g. `"#4F46E5"`.
    #[validate(length(max = 32, message = "color must be at most 32 characters"))]
    pub color: Option<String>,
}

/// Body for `PATCH /api/timeblocks/:id`.
///
/// Every field is optional — only provided fields are updated.
#[derive(Clone, Debug, Deserialize, Validate)]
pub struct UpdateTimeBlockRequest {
    #[validate(length(min = 1, max = 255, message = "title must be 1–255 characters"))]
    pub title: Option<String>,

    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,

    /// Pass `null` explicitly to unlink a task.
    pub task_id: Option<Option<Uuid>>,

    /// Pass `null` explicitly to clear the color.
    pub color: Option<Option<String>>,
}

/// Query parameters for `GET /api/timeblocks`.
#[derive(Clone, Debug, Deserialize)]
pub struct ListTimeBlocksQuery {
    /// Inclusive lower bound (ISO 8601).
    pub from: Option<DateTime<Utc>>,
    /// Inclusive upper bound (ISO 8601).
    pub to: Option<DateTime<Utc>>,
    /// Filter by linked task.
    pub task_id: Option<Uuid>,
    /// Pagination offset (default: 0).
    pub offset: Option<i64>,
    /// Page size (default: 50, max enforced in service layer).
    pub limit: Option<i64>,
}

/// Body for `POST /api/timeblocks/:id/focus-sessions`.
#[derive(Clone, Debug, Deserialize, Validate)]
pub struct StartFocusSessionRequest {
    #[serde(default = "default_focus_mode")]
    pub mode: FocusMode,
}

fn default_focus_mode() -> FocusMode {
    FocusMode::Pomodoro255
}

/// Body for `PATCH /api/timeblocks/:block_id/focus-sessions/:session_id/finish`.
#[derive(Clone, Debug, Deserialize, Validate)]
pub struct FinishFocusSessionRequest {
    /// Caller-reported active seconds (>= 0). The server stores this verbatim
    /// but also records `ended_at = now()`.
    #[validate(range(min = 0, message = "duration_seconds must be >= 0"))]
    pub duration_seconds: i32,
}

// ── Response DTOs ──────────────────────────────────────────────────────────────

/// Lightweight summary returned in list responses.
#[derive(Clone, Debug, Serialize)]
pub struct TimeBlockSummary {
    pub id: Uuid,
    pub title: String,
    pub task_id: Option<Uuid>,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub color: Option<String>,
    /// Derived: `(end_time - start_time)` in whole minutes.
    pub estimated_minutes: i64,
    /// Derived: actual duration in minutes when both `actual_start` and
    /// `actual_end` are set.
    pub actual_minutes: Option<i64>,
}

impl From<TimeBlock> for TimeBlockSummary {
    fn from(b: TimeBlock) -> Self {
        let estimated_minutes = (b.end_time - b.start_time).num_minutes();
        let actual_minutes = b
            .actual_start
            .zip(b.actual_end)
            .map(|(s, e)| (e - s).num_minutes());

        Self {
            id: b.id,
            title: b.title,
            task_id: b.task_id,
            start_time: b.start_time,
            end_time: b.end_time,
            color: b.color,
            estimated_minutes,
            actual_minutes,
        }
    }
}

/// Paginated list wrapper.
#[derive(Clone, Debug, Serialize)]
pub struct TimeBlockList {
    pub items: Vec<TimeBlockSummary>,
    pub total: i64,
    pub offset: i64,
    pub limit: i64,
}
