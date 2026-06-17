//! Task module — database row types, request DTOs, and response DTOs.
//!
//! All DB row types derive [`sqlx::FromRow`] so they can be hydrated directly
//! from `query_as!`. Request types derive [`validator::Validate`] so handlers
//! can call `.validate()?` before touching the database.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

// ── Postgres enum mirrors ──────────────────────────────────────────────────────

/// Mirrors the `task_priority` Postgres enum.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "task_priority", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TaskPriority {
    Critical,
    High,
    Medium,
    Low,
}

/// Mirrors the `task_status` Postgres enum.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "task_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Inbox,
    Planned,
    InProgress,
    Waiting,
    Completed,
    Archived,
}

// ── DB row structs ─────────────────────────────────────────────────────────────

/// Full `tasks` row.
#[derive(Clone, Debug, Serialize, sqlx::FromRow)]
pub struct Task {
    pub id: Uuid,
    pub user_id: Uuid,
    pub project_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub priority: TaskPriority,
    pub status: TaskStatus,
    pub due_date: Option<DateTime<Utc>>,
    pub start_date: Option<DateTime<Utc>>,
    pub estimated_time: Option<i32>,
    pub actual_time: Option<i32>,
    pub recurrence_rule: Option<String>,
    pub completed_at: Option<DateTime<Utc>>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Full `subtasks` row.
#[derive(Clone, Debug, Serialize, sqlx::FromRow)]
pub struct Subtask {
    pub id: Uuid,
    pub task_id: Uuid,
    pub title: String,
    pub is_done: bool,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Full `tags` row.
#[derive(Clone, Debug, Serialize, sqlx::FromRow)]
pub struct Tag {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub color: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Response DTOs ──────────────────────────────────────────────────────────────

/// Task enriched with its subtasks and tags — used as the primary API response.
#[derive(Clone, Debug, Serialize)]
pub struct TaskResponse {
    #[serde(flatten)]
    pub task: Task,
    pub subtasks: Vec<Subtask>,
    pub tags: Vec<Tag>,
}

/// Lightweight task list item — no subtasks/tags embedded to keep list payloads small.
#[derive(Clone, Debug, Serialize)]
pub struct TaskListItem {
    pub id: Uuid,
    pub project_id: Option<Uuid>,
    pub title: String,
    pub priority: TaskPriority,
    pub status: TaskStatus,
    pub due_date: Option<DateTime<Utc>>,
    pub estimated_time: Option<i32>,
    pub tag_ids: Vec<Uuid>,
    pub subtask_count: i64,
    pub done_subtask_count: i64,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Query parameters ───────────────────────────────────────────────────────────

/// Query parameters accepted by `GET /api/tasks`.
#[derive(Clone, Debug, Deserialize)]
pub struct ListTasksQuery {
    pub project_id: Option<Uuid>,
    pub status: Option<TaskStatus>,
    pub priority: Option<TaskPriority>,
    /// Return only tasks due on or before this timestamp.
    pub due_before: Option<DateTime<Utc>>,
    /// Return only tasks due on or after this timestamp.
    pub due_after: Option<DateTime<Utc>>,
    /// Tag filter: return only tasks that carry this tag.
    pub tag_id: Option<Uuid>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

// ── Request DTOs ───────────────────────────────────────────────────────────────

/// Body for `POST /api/tasks`.
#[derive(Clone, Debug, Deserialize, Validate)]
pub struct CreateTaskRequest {
    #[validate(length(min = 1, max = 500, message = "title must be 1–500 characters"))]
    pub title: String,
    #[validate(length(max = 10_000, message = "description must be ≤ 10 000 characters"))]
    pub description: Option<String>,
    pub priority: Option<TaskPriority>,
    pub status: Option<TaskStatus>,
    pub project_id: Option<Uuid>,
    pub due_date: Option<DateTime<Utc>>,
    pub start_date: Option<DateTime<Utc>>,
    #[validate(range(min = 1, message = "estimated_time must be positive"))]
    pub estimated_time: Option<i32>,
    pub recurrence_rule: Option<String>,
    pub tag_ids: Option<Vec<Uuid>>,
}

/// Body for `PATCH /api/tasks/:id`.
#[derive(Clone, Debug, Deserialize, Validate)]
pub struct UpdateTaskRequest {
    #[validate(length(min = 1, max = 500, message = "title must be 1–500 characters"))]
    pub title: Option<String>,
    #[validate(length(max = 10_000, message = "description must be ≤ 10 000 characters"))]
    pub description: Option<String>,
    pub priority: Option<TaskPriority>,
    pub status: Option<TaskStatus>,
    pub project_id: Option<Uuid>,
    pub due_date: Option<DateTime<Utc>>,
    pub start_date: Option<DateTime<Utc>>,
    #[validate(range(min = 1, message = "estimated_time must be positive"))]
    pub estimated_time: Option<i32>,
    pub actual_time: Option<i32>,
    pub recurrence_rule: Option<String>,
    pub position: Option<i32>,
}

/// Body for `POST /api/tasks/:id/subtasks`.
#[derive(Clone, Debug, Deserialize, Validate)]
pub struct CreateSubtaskRequest {
    #[validate(length(min = 1, max = 500, message = "title must be 1–500 characters"))]
    pub title: String,
}

/// Body for `PATCH /api/tasks/:task_id/subtasks/:subtask_id`.
#[derive(Clone, Debug, Deserialize, Validate)]
pub struct UpdateSubtaskRequest {
    #[validate(length(min = 1, max = 500, message = "title must be 1–500 characters"))]
    pub title: Option<String>,
    pub is_done: Option<bool>,
    pub position: Option<i32>,
}

/// Body for `POST /api/tags`.
#[derive(Clone, Debug, Deserialize, Validate)]
pub struct CreateTagRequest {
    #[validate(length(min = 1, max = 50, message = "tag name must be 1–50 characters"))]
    pub name: String,
    pub color: Option<String>,
}

/// Body for `PATCH /api/tags/:id`.
#[derive(Clone, Debug, Deserialize, Validate)]
pub struct UpdateTagRequest {
    #[validate(length(min = 1, max = 50, message = "tag name must be 1–50 characters"))]
    pub name: Option<String>,
    pub color: Option<String>,
}

/// Body for `POST /api/tasks/:id/tags`.
#[derive(Clone, Debug, Deserialize)]
pub struct AttachTagRequest {
    pub tag_id: Uuid,
}

/// Body for `PATCH /api/tasks/:id/reorder`.
#[derive(Clone, Debug, Deserialize)]
pub struct ReorderTaskRequest {
    pub position: i32,
}
