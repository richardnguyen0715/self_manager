//! Data models and DTOs for the `work_item` module.
//!
//! # DB schema (from `migrations/0003_agile.sql`)
//!
//! ```sql
//! work_items (
//!   id              uuid PRIMARY KEY,
//!   user_id         uuid NOT NULL,
//!   epic_id         uuid REFERENCES epics(id) ON DELETE SET NULL,
//!   sprint_id       uuid REFERENCES sprints(id) ON DELETE SET NULL,
//!   type            work_item_type NOT NULL DEFAULT 'task',
//!   title           text NOT NULL,
//!   description     text,
//!   status          work_item_status NOT NULL DEFAULT 'backlog',
//!   priority        task_priority NOT NULL DEFAULT 'medium',
//!   story_points    int CHECK (story_points IN (1,3,5,8)),
//!   position        int NOT NULL DEFAULT 0,
//!   due_date        timestamptz,
//!   recurrence_rule text,
//!   completed_at    timestamptz,
//!   created_at      timestamptz NOT NULL DEFAULT now(),
//!   updated_at      timestamptz NOT NULL DEFAULT now()
//! )
//!
//! work_item_subtasks (
//!   id           uuid PRIMARY KEY,
//!   work_item_id uuid NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
//!   title        text NOT NULL,
//!   is_done      boolean NOT NULL DEFAULT false,
//!   position     int NOT NULL DEFAULT 0,
//!   created_at   timestamptz NOT NULL DEFAULT now(),
//!   updated_at   timestamptz NOT NULL DEFAULT now()
//! )
//! ```
//!
//! Postgres enums: `work_item_type`, `work_item_status`, `task_priority`.
//! All are stored as plain enum columns; services cast `::text` on SELECT
//! and bind with `($n::text)::enum_name` on INSERT/UPDATE.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

// ── DB row ─────────────────────────────────────────────────────────────────────

/// Full `work_items` row returned from the database.
///
/// Enum columns are carried as `String` because the services use the
/// enum-as-text pattern (`::text` cast) rather than `sqlx::Type` derive.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct WorkItem {
    pub id: Uuid,
    pub user_id: Uuid,
    pub project_id: Option<Uuid>,
    pub epic_id: Option<Uuid>,
    pub sprint_id: Option<Uuid>,
    /// `work_item_type` column cast to text: `"story"|"task"|"bug"|"habit"|"milestone"`.
    pub item_type: String,
    pub title: String,
    pub description: Option<String>,
    /// `work_item_status` column cast to text: `"backlog"|"todo"|"in_progress"|"review"|"done"`.
    pub status: String,
    /// `task_priority` column cast to text: `"critical"|"high"|"medium"|"low"`.
    pub priority: String,
    pub story_points: Option<i32>,
    pub position: i32,
    pub due_date: Option<DateTime<Utc>>,
    pub recurrence_rule: Option<String>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Full `work_item_subtasks` row.
#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct WorkItemSubtask {
    pub id: Uuid,
    pub work_item_id: Uuid,
    pub title: String,
    pub is_done: bool,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Response DTOs ──────────────────────────────────────────────────────────────

/// Full work-item response with embedded subtasks.
///
/// Returned by `GET /api/work-items/:id`, `POST /api/work-items`,
/// and all PATCH sub-resource endpoints.
#[derive(Debug, Serialize)]
pub struct WorkItemResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub project_id: Option<Uuid>,
    pub epic_id: Option<Uuid>,
    pub sprint_id: Option<Uuid>,
    #[serde(rename = "type")]
    pub item_type: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    pub story_points: Option<i32>,
    pub position: i32,
    pub due_date: Option<DateTime<Utc>>,
    pub recurrence_rule: Option<String>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub subtasks: Vec<WorkItemSubtask>,
}

/// Lightweight list item without embedded subtasks (includes counts only).
///
/// Returned by list endpoints for efficiency.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct WorkItemListItem {
    pub id: Uuid,
    pub project_id: Option<Uuid>,
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

/// Paginated list envelope matching the `{ data, total }` convention.
#[derive(Debug, Serialize)]
pub struct WorkItemListResponse {
    pub data: Vec<WorkItemListItem>,
    pub total: i64,
}

/// Subtask list response (bare array).
#[derive(Debug, Serialize)]
pub struct SubtaskListResponse(pub Vec<WorkItemSubtask>);

// ── Value objects (typed enums for request DTOs) ───────────────────────────────

/// Typed DTO for the `work_item_type` postgres enum.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkItemType {
    Story,
    Task,
    Bug,
    Habit,
    Milestone,
}

impl WorkItemType {
    /// Returns the Postgres-compatible lowercase string.
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Story => "story",
            Self::Task => "task",
            Self::Bug => "bug",
            Self::Habit => "habit",
            Self::Milestone => "milestone",
        }
    }
}

impl std::fmt::Display for WorkItemType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Typed DTO for the `work_item_status` postgres enum.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkItemStatus {
    Backlog,
    Todo,
    InProgress,
    Review,
    Done,
}

impl WorkItemStatus {
    /// Returns the Postgres-compatible lowercase string.
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Backlog => "backlog",
            Self::Todo => "todo",
            Self::InProgress => "in_progress",
            Self::Review => "review",
            Self::Done => "done",
        }
    }
}

impl std::fmt::Display for WorkItemStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Typed DTO for the `task_priority` postgres enum (reused for work items).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkItemPriority {
    Critical,
    High,
    Medium,
    Low,
}

impl WorkItemPriority {
    /// Returns the Postgres-compatible lowercase string.
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Critical => "critical",
            Self::High => "high",
            Self::Medium => "medium",
            Self::Low => "low",
        }
    }
}

impl std::fmt::Display for WorkItemPriority {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

// ── Request DTOs ───────────────────────────────────────────────────────────────

/// Body for `POST /api/work-items`.
#[derive(Debug, Deserialize, Validate)]
pub struct CreateWorkItemRequest {
    /// Required; 1–500 characters.
    #[validate(length(min = 1, max = 500, message = "title must be 1–500 characters"))]
    pub title: String,

    /// Optional description; max 10 000 characters.
    #[validate(length(max = 10_000, message = "description must be ≤ 10 000 characters"))]
    pub description: Option<String>,

    /// Work item type; defaults to `"task"`.
    #[serde(rename = "type")]
    pub item_type: Option<WorkItemType>,

    /// Optional project association (scoping unit).
    pub project_id: Option<Uuid>,

    /// Optional epic association.
    pub epic_id: Option<Uuid>,

    /// Optional sprint association; `None` means backlog.
    pub sprint_id: Option<Uuid>,

    /// Initial status; defaults to `"backlog"`.
    pub status: Option<WorkItemStatus>,

    /// Priority; defaults to `"medium"`.
    pub priority: Option<WorkItemPriority>,

    /// Story points estimate; must be 1, 3, 5, or 8.
    pub story_points: Option<i32>,

    /// Optional due date (RFC 3339 timestamp).
    pub due_date: Option<DateTime<Utc>>,

    /// iCalendar RRULE string for recurring work items.
    #[validate(length(max = 500, message = "recurrence_rule must be ≤ 500 characters"))]
    pub recurrence_rule: Option<String>,
}

/// Body for `PATCH /api/work-items/:id` — every field is optional.
#[derive(Debug, Deserialize, Validate)]
pub struct UpdateWorkItemRequest {
    #[validate(length(min = 1, max = 500, message = "title must be 1–500 characters"))]
    pub title: Option<String>,

    #[validate(length(max = 10_000, message = "description must be ≤ 10 000 characters"))]
    pub description: Option<String>,

    #[serde(rename = "type")]
    pub item_type: Option<WorkItemType>,

    pub project_id: Option<Uuid>,

    pub epic_id: Option<Uuid>,

    pub sprint_id: Option<Uuid>,

    pub status: Option<WorkItemStatus>,

    pub priority: Option<WorkItemPriority>,

    pub story_points: Option<i32>,

    pub position: Option<i32>,

    pub due_date: Option<DateTime<Utc>>,

    #[validate(length(max = 500, message = "recurrence_rule must be ≤ 500 characters"))]
    pub recurrence_rule: Option<String>,
}

/// Body for `PATCH /api/work-items/:id/status`.
#[derive(Debug, Deserialize)]
pub struct SetStatusRequest {
    pub status: WorkItemStatus,
}

/// Body for `PATCH /api/work-items/:id/points`.
#[derive(Debug, Deserialize)]
pub struct SetPointsRequest {
    /// Must be 1, 3, 5, 8, or null (unestimated).
    pub story_points: Option<i32>,
}

/// Body for `PATCH /api/work-items/:id/sprint`.
#[derive(Debug, Deserialize)]
pub struct MoveToSprintRequest {
    pub sprint_id: Uuid,
    pub position: Option<i32>,
}

/// Body for `PATCH /api/work-items/:id/backlog`.
#[derive(Debug, Deserialize)]
pub struct MoveToBacklogRequest {
    pub position: Option<i32>,
}

/// Body for `POST /api/work-items/:id/subtasks`.
#[derive(Debug, Deserialize, Validate)]
pub struct CreateSubtaskRequest {
    #[validate(length(min = 1, max = 500, message = "title must be 1–500 characters"))]
    pub title: String,
}

/// Body for `PATCH /api/work-items/:id/subtasks/:subtask_id`.
#[derive(Debug, Deserialize, Validate)]
pub struct UpdateSubtaskRequest {
    #[validate(length(min = 1, max = 500, message = "title must be 1–500 characters"))]
    pub title: Option<String>,
    pub is_done: Option<bool>,
    pub position: Option<i32>,
}

// ── Links / Web-links / Attachments — DB rows ─────────────────────────────────

/// Full `work_item_links` row with denormalised target work-item fields.
///
/// Returned by `GET /api/work-items/:id/links`.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct WorkItemLink {
    pub id: Uuid,
    pub work_item_id: Uuid,
    pub target_work_item_id: Uuid,
    pub link_type: String,
    /// Title of the target work item (denormalised join).
    pub target_title: String,
    /// `work_item_type` of the target cast to text.
    pub target_type: String,
    /// `work_item_status` of the target cast to text.
    pub target_status: String,
    pub created_at: DateTime<Utc>,
}

/// Full `work_item_web_links` row.
///
/// Returned by `GET /api/work-items/:id/web-links`.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct WebLink {
    pub id: Uuid,
    pub work_item_id: Uuid,
    pub url: String,
    pub title: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Full `work_item_attachments` row with a derived `url` field.
///
/// Returned by `GET /api/work-items/:id/attachments`.
#[derive(Debug, Serialize)]
pub struct Attachment {
    pub id: Uuid,
    pub work_item_id: Uuid,
    pub filename: String,
    /// Publicly accessible path: `/uploads/<stored_path>`.
    pub url: String,
    pub mime_type: Option<String>,
    pub size_bytes: Option<i64>,
    pub created_at: DateTime<Utc>,
}

/// Raw DB row for `work_item_attachments` — used internally before building
/// the [`Attachment`] response (which adds the derived `url`).
#[derive(Debug, sqlx::FromRow)]
pub struct AttachmentRow {
    pub id: Uuid,
    pub work_item_id: Uuid,
    pub filename: String,
    pub stored_path: String,
    pub mime_type: Option<String>,
    pub size_bytes: Option<i64>,
    pub created_at: DateTime<Utc>,
}

impl AttachmentRow {
    /// Convert to [`Attachment`] response, deriving `url` from `stored_path`.
    #[must_use]
    pub fn into_response(self) -> Attachment {
        let url = format!("/uploads/{}", self.stored_path);
        Attachment {
            id: self.id,
            work_item_id: self.work_item_id,
            filename: self.filename,
            url,
            mime_type: self.mime_type,
            size_bytes: self.size_bytes,
            created_at: self.created_at,
        }
    }
}

// ── Links / Web-links / Attachments — Request DTOs ────────────────────────────

/// Body for `POST /api/work-items/:id/links`.
#[derive(Debug, Deserialize)]
pub struct CreateLinkRequest {
    /// UUID of the work item to link to (must be owned by the same user).
    pub target_work_item_id: Uuid,
    /// Relationship label; defaults to `"relates_to"`.
    pub link_type: Option<String>,
}

/// Body for `POST /api/work-items/:id/web-links`.
#[derive(Debug, Deserialize, Validate)]
pub struct CreateWebLinkRequest {
    /// The URL to attach; max 2 048 characters.
    #[validate(length(min = 1, max = 2048, message = "url must be 1–2048 characters"))]
    pub url: String,
    /// Optional human-readable label.
    #[validate(length(max = 500, message = "title must be ≤ 500 characters"))]
    pub title: Option<String>,
}

// ── Query parameters ───────────────────────────────────────────────────────────

/// Query-string parameters for `GET /api/work-items`.
#[derive(Debug, Deserialize)]
pub struct ListWorkItemsQuery {
    /// Filter by project (scoping unit). `None` returns items across all projects.
    pub project_id: Option<Uuid>,
    /// Filter by sprint; `None` returns all (including backlog).
    pub sprint_id: Option<Uuid>,
    /// Filter by epic.
    pub epic_id: Option<Uuid>,
    /// Filter by status string.
    pub status: Option<WorkItemStatus>,
    /// Filter by type string.
    #[serde(rename = "type")]
    pub item_type: Option<WorkItemType>,
    /// Filter by priority.
    pub priority: Option<WorkItemPriority>,
    /// Page size; defaults to 50, max 200.
    pub limit: Option<i64>,
    /// Zero-based offset; defaults to 0.
    pub offset: Option<i64>,
}
