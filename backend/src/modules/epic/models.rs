//! Data models and DTOs for the `epic` module.
//!
//! # DB schema (from `migrations/0003_agile.sql`)
//!
//! ```sql
//! epics (
//!   id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
//!   user_id       uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
//!   initiative_id uuid        NOT NULL REFERENCES initiatives (id) ON DELETE CASCADE,
//!   title         text        NOT NULL,
//!   description   text,
//!   status        epic_status NOT NULL DEFAULT 'todo',
//!   start_date    date,
//!   due_date      date,
//!   color         text,
//!   position      int         NOT NULL DEFAULT 0,
//!   created_at    timestamptz NOT NULL DEFAULT now(),
//!   updated_at    timestamptz NOT NULL DEFAULT now()
//! )
//! ```
//!
//! `epic_status` enum: `'todo' | 'in_progress' | 'done' | 'cancelled'`
//!
//! Progress fields (`progress`, `total_points`, `done_points`) are derived in
//! the service layer by querying `work_items`; they are NOT stored columns.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

// ── DB row ─────────────────────────────────────────────────────────────────────

/// Full epic row returned from the database (stored columns only).
///
/// `status` is stored as `String` because SQLx maps Postgres enums to `String`
/// when using compile-time `query!` / `query_as!` macros with the `::text` cast
/// pattern mandated by the agile-OS conventions.
#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct EpicRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub initiative_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub start_date: Option<NaiveDate>,
    pub due_date: Option<NaiveDate>,
    pub color: Option<String>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Progress rollup ────────────────────────────────────────────────────────────

/// Derived progress computed from child `work_items`.
#[derive(Debug, Serialize)]
pub struct EpicProgress {
    pub total_items: i64,
    pub done_items: i64,
    /// Completion rate in the range \[0.0, 1.0\].
    pub completion_rate: f64,
}

// ── Response DTOs ──────────────────────────────────────────────────────────────

/// Full response body for a single epic, including derived progress fields.
#[derive(Debug, Serialize)]
pub struct EpicResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub initiative_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub start_date: Option<NaiveDate>,
    pub due_date: Option<NaiveDate>,
    pub color: Option<String>,
    pub position: i32,
    pub progress: EpicProgress,
    pub total_points: i64,
    pub done_points: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Paginated list response.
#[derive(Debug, Serialize)]
pub struct EpicListResponse {
    pub data: Vec<EpicResponse>,
    pub total: i64,
}

/// Lightweight work-item summary returned by `GET /api/epics/:id/work-items`.
///
/// Mirrors `WorkItemListItem` from the agile contract; defined here to avoid
/// a cross-module dependency on the `work_item` module during incremental
/// roll-out.
#[derive(Debug, sqlx::FromRow, Serialize)]
pub struct WorkItemSummary {
    pub id: Uuid,
    pub epic_id: Option<Uuid>,
    pub sprint_id: Option<Uuid>,
    #[serde(rename = "type")]
    pub item_type: String,
    pub title: String,
    pub status: String,
    pub priority: String,
    pub story_points: Option<i32>,
    pub due_date: Option<DateTime<Utc>>,
    pub position: i32,
    pub subtask_count: i64,
    pub done_subtask_count: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Paginated work-items-under-epic response.
#[derive(Debug, Serialize)]
pub struct WorkItemListResponse {
    pub data: Vec<WorkItemSummary>,
    pub total: i64,
}

// ── Request DTOs ───────────────────────────────────────────────────────────────

/// Body for `POST /api/epics`.
#[derive(Debug, Deserialize, Validate)]
pub struct CreateEpicRequest {
    /// The parent initiative; must belong to the same user.
    pub initiative_id: Uuid,

    /// Required; 1–200 characters.
    #[validate(length(min = 1, max = 200, message = "title must be 1–200 characters"))]
    pub title: String,

    /// Optional free-form description; max 5 000 characters.
    #[validate(length(max = 5000, message = "description must be ≤ 5 000 characters"))]
    pub description: Option<String>,

    /// Valid values: `"todo"`, `"in_progress"`, `"done"`, `"cancelled"`.
    /// Defaults to `"todo"` when absent.
    pub status: Option<EpicStatus>,

    /// ISO-8601 date (`YYYY-MM-DD`). Optional planned start date.
    pub start_date: Option<NaiveDate>,

    /// ISO-8601 date (`YYYY-MM-DD`). Optional planned due date.
    pub due_date: Option<NaiveDate>,

    /// CSS hex color, e.g. `"#6366f1"`. Max 50 characters.
    #[validate(length(max = 50, message = "color must be ≤ 50 characters"))]
    pub color: Option<String>,

    /// Sort position among the initiative's epics; defaults to 0.
    pub position: Option<i32>,
}

/// Body for `PATCH /api/epics/:id` — every field is optional.
#[derive(Debug, Deserialize, Validate)]
pub struct UpdateEpicRequest {
    #[validate(length(min = 1, max = 200, message = "title must be 1–200 characters"))]
    pub title: Option<String>,

    #[validate(length(max = 5000, message = "description must be ≤ 5 000 characters"))]
    pub description: Option<String>,

    pub status: Option<EpicStatus>,

    pub start_date: Option<NaiveDate>,

    pub due_date: Option<NaiveDate>,

    #[validate(length(max = 50, message = "color must be ≤ 50 characters"))]
    pub color: Option<String>,

    pub position: Option<i32>,

    /// Allows re-parenting an epic to a different initiative that the user owns.
    pub initiative_id: Option<Uuid>,
}

// ── Value objects ──────────────────────────────────────────────────────────────

/// Typed wrapper for the `epic_status` Postgres enum.
///
/// Serialises to/from lowercase snake_case strings so that the JSON API uses
/// `"todo"`, `"in_progress"`, `"done"`, `"cancelled"`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EpicStatus {
    Todo,
    InProgress,
    Done,
    Cancelled,
}

impl EpicStatus {
    /// Returns the database-compatible string representation.
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Todo => "todo",
            Self::InProgress => "in_progress",
            Self::Done => "done",
            Self::Cancelled => "cancelled",
        }
    }
}

impl std::fmt::Display for EpicStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

// ── Query params ───────────────────────────────────────────────────────────────

/// Query-string parameters for `GET /api/epics`.
#[derive(Debug, Deserialize)]
pub struct ListEpicsQuery {
    /// Filter by parent initiative. If absent, all initiatives are included.
    pub initiative_id: Option<Uuid>,

    /// Filter by status. If absent, all statuses are returned.
    pub status: Option<EpicStatus>,

    /// Page size; defaults to 50, max 200.
    pub limit: Option<i64>,

    /// Zero-based page offset; defaults to 0.
    pub offset: Option<i64>,
}

/// Query-string parameters for `GET /api/epics/:id/work-items`.
#[derive(Debug, Deserialize)]
pub struct ListEpicWorkItemsQuery {
    /// Filter work items by status string (e.g. `"todo"`, `"done"`).
    pub status: Option<String>,
}
