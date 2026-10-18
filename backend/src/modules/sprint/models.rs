//! Data models and DTOs for the `sprint` module.
//!
//! # DB schema (from `migrations/0003_agile.sql`)
//!
//! ```sql
//! sprints (
//!   id               uuid PRIMARY KEY,
//!   user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
//!   name             text NOT NULL,
//!   goal_text        text,
//!   start_date       date NOT NULL,
//!   end_date         date NOT NULL,
//!   capacity_points  int  NOT NULL DEFAULT 0,
//!   status           sprint_status NOT NULL DEFAULT 'planned',
//!   velocity         numeric(5,2),
//!   completed_points int  NOT NULL DEFAULT 0,
//!   created_at       timestamptz NOT NULL DEFAULT now(),
//!   updated_at       timestamptz NOT NULL DEFAULT now()
//! )
//! ```
//!
//! `sprint_status` enum: `'planned' | 'active' | 'completed'`

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

// ── DB row ──────────────────────────────────────────────────────────────────────

/// Full sprint row returned from the database.
///
/// Enum columns are selected as `col::text AS "col!"` and carried as `String`.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct SprintRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub project_id: Option<Uuid>,
    pub name: String,
    pub goal_text: Option<String>,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub capacity_points: i32,
    /// Stored as `sprint_status` enum; selected as `::text`.
    pub status: String,
    pub velocity: Option<f64>,
    pub completed_points: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Sprint review row.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct SprintReviewRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub sprint_id: Uuid,
    pub planned_points: i32,
    pub completed_points: i32,
    pub velocity: f64,
    pub summary: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Retrospective row.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct RetrospectiveRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub sprint_id: Uuid,
    pub went_well: Option<String>,
    pub went_wrong: Option<String>,
    /// JSONB column; sqlx maps this to `serde_json::Value`.
    pub action_items: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Response DTOs ───────────────────────────────────────────────────────────────

/// Full sprint response — includes derived scalar fields computed in service.
#[derive(Debug, Serialize)]
pub struct SprintResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub project_id: Option<Uuid>,
    pub name: String,
    pub goal_text: Option<String>,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub capacity_points: i32,
    pub status: String,
    pub velocity: Option<f64>,
    pub completed_points: i32,
    /// Σ story_points of work items in this sprint (derived).
    pub planned_points: i64,
    /// Total work items committed to this sprint (derived).
    pub committed_count: i64,
    /// Work items with status `done` (derived).
    pub done_count: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Paginated list of sprints.
#[derive(Debug, Serialize)]
pub struct SprintListResponse {
    pub data: Vec<SprintResponse>,
    pub total: i64,
}

/// Sprint review response.
#[derive(Debug, Serialize)]
pub struct SprintReviewResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub sprint_id: Uuid,
    pub planned_points: i32,
    pub completed_points: i32,
    pub velocity: f64,
    pub summary: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<SprintReviewRow> for SprintReviewResponse {
    fn from(r: SprintReviewRow) -> Self {
        Self {
            id: r.id,
            user_id: r.user_id,
            sprint_id: r.sprint_id,
            planned_points: r.planned_points,
            completed_points: r.completed_points,
            velocity: r.velocity,
            summary: r.summary,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

/// Retrospective response.
#[derive(Debug, Serialize)]
pub struct RetrospectiveResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub sprint_id: Uuid,
    pub went_well: Option<String>,
    pub went_wrong: Option<String>,
    pub action_items: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<RetrospectiveRow> for RetrospectiveResponse {
    fn from(r: RetrospectiveRow) -> Self {
        Self {
            id: r.id,
            user_id: r.user_id,
            sprint_id: r.sprint_id,
            went_well: r.went_well,
            went_wrong: r.went_wrong,
            action_items: r.action_items,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

// ── Burndown & Velocity response types ─────────────────────────────────────────

/// A single day's burndown data point.
#[derive(Debug, Serialize)]
pub struct BurndownPoint {
    /// Calendar date (YYYY-MM-DD).
    pub date: NaiveDate,
    /// Story points remaining at end of day.
    pub remaining_points: i64,
    /// Ideal remaining points for a linear burn.
    pub ideal_points: f64,
}

/// Full burndown response for one sprint.
#[derive(Debug, Serialize)]
pub struct BurndownResponse {
    pub sprint_id: Uuid,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub total_points: i64,
    pub points: Vec<BurndownPoint>,
}

/// A single sprint's velocity data point.
#[derive(Debug, Serialize)]
pub struct VelocityPoint {
    pub sprint_id: Uuid,
    pub sprint_name: String,
    pub planned_points: i64,
    pub completed_points: i32,
    /// `completed / planned * 100` clamped to `[0, 100]`.
    pub velocity: f64,
}

/// List of velocity points.
#[derive(Debug, Serialize)]
pub struct VelocityListResponse {
    pub data: Vec<VelocityPoint>,
}

// ── Request DTOs ────────────────────────────────────────────────────────────────

/// Body for `POST /api/sprints`.
#[derive(Debug, Deserialize, Validate)]
pub struct CreateSprintRequest {
    /// Required; 1–200 characters.
    #[validate(length(min = 1, max = 200, message = "name must be 1–200 characters"))]
    pub name: String,

    /// Optional free-text sprint goal.
    #[validate(length(max = 1000, message = "goal_text must be ≤ 1 000 characters"))]
    pub goal_text: Option<String>,

    /// Sprint start date (YYYY-MM-DD).
    pub start_date: NaiveDate,

    /// Sprint end date (YYYY-MM-DD); must be >= start_date.
    pub end_date: NaiveDate,

    /// Optional capacity in story points; defaults to 0 (no cap).
    pub capacity_points: Option<i32>,

    /// Optional project association (scoping unit).
    pub project_id: Option<Uuid>,
}

/// Body for `PATCH /api/sprints/:id` — every field optional.
#[derive(Debug, Deserialize, Validate)]
pub struct UpdateSprintRequest {
    #[validate(length(min = 1, max = 200, message = "name must be 1–200 characters"))]
    pub name: Option<String>,

    #[validate(length(max = 1000, message = "goal_text must be ≤ 1 000 characters"))]
    pub goal_text: Option<String>,

    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub capacity_points: Option<i32>,

    /// Allows direct status updates (e.g. planning adjustments).
    pub status: Option<SprintStatus>,

    /// Optional project association (scoping unit).
    pub project_id: Option<Uuid>,
}

/// What to do with work items that are not `done` when a sprint is completed.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UnfinishedItemsAction {
    /// Leave unfinished items in this sprint (the pre-existing behaviour).
    #[default]
    Keep,
    /// Detach unfinished items from any sprint (move to backlog).
    Backlog,
    /// Move unfinished items into `next_sprint_id` (must be a planned sprint).
    NextSprint,
}

/// Body for `POST /api/sprints/:id/complete`. The body itself is optional;
/// when absent every field takes its default (`unfinished = keep`).
#[derive(Debug, Deserialize, Validate, Default)]
pub struct CompleteSprintRequest {
    #[validate(length(max = 5000, message = "summary must be ≤ 5 000 characters"))]
    pub summary: Option<String>,

    /// Disposition of unfinished items. Defaults to `keep`.
    #[serde(default)]
    pub unfinished: UnfinishedItemsAction,

    /// Required when `unfinished = next_sprint`.
    pub next_sprint_id: Option<Uuid>,
}

/// Response for `POST /api/sprints/:id/complete`: the review plus the number
/// of unfinished items that were moved.
#[derive(Debug, Serialize)]
pub struct CompleteSprintResponse {
    #[serde(flatten)]
    pub review: SprintReviewResponse,
    pub moved_count: i64,
}

/// Body for `PUT /api/sprints/:id/review`.
#[derive(Debug, Deserialize, Validate)]
pub struct UpsertReviewRequest {
    #[validate(length(max = 5000, message = "summary must be ≤ 5 000 characters"))]
    pub summary: Option<String>,
}

/// Body for `PUT /api/sprints/:id/retrospective`.
#[derive(Debug, Deserialize)]
pub struct UpsertRetrospectiveRequest {
    pub went_well: Option<String>,
    pub went_wrong: Option<String>,
    pub action_items: Option<serde_json::Value>,
}

// ── Value objects ───────────────────────────────────────────────────────────────

/// Typed wrapper for the `sprint_status` Postgres enum.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SprintStatus {
    Planned,
    Active,
    Completed,
}

impl SprintStatus {
    /// Database-compatible string representation.
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Planned => "planned",
            Self::Active => "active",
            Self::Completed => "completed",
        }
    }
}

impl std::fmt::Display for SprintStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

// ── Query params ────────────────────────────────────────────────────────────────

/// Query-string parameters for `GET /api/sprints`.
#[derive(Debug, Deserialize)]
pub struct ListSprintsQuery {
    /// Filter by project (scoping unit). `None` returns sprints across all projects.
    pub project_id: Option<Uuid>,
    /// Filter by status.
    pub status: Option<SprintStatus>,
    /// Page size; defaults to 50, max 200.
    pub limit: Option<i64>,
    /// Zero-based offset; defaults to 0.
    pub offset: Option<i64>,
}

/// Query params for `GET /api/sprints/velocity`.
#[derive(Debug, Deserialize)]
pub struct VelocityQuery {
    /// Number of recent completed sprints to return (default 6).
    pub last: Option<i64>,
}

/// Query params for `GET /api/sprints/:id/work-items`.
#[derive(Debug, Deserialize)]
pub struct WorkItemStatusQuery {
    pub status: Option<String>,
}

// ── Work item list item (lightweight projection for nested lists) ───────────────

/// Lightweight work item returned inside sprint / epic / backlog list endpoints.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct WorkItemListItem {
    pub id: Uuid,
    pub project_id: Option<Uuid>,
    pub epic_id: Option<Uuid>,
    pub sprint_id: Option<Uuid>,
    #[sqlx(rename = "item_type")]
    pub r#type: String,
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

/// Paginated work item list.
#[derive(Debug, Serialize)]
pub struct WorkItemListResponse {
    pub data: Vec<WorkItemListItem>,
    pub total: i64,
}
