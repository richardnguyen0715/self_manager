//! Data models, DTOs, and request/response types for the `project` module.
//!
//! Database representation uses [`Project`] (via `sqlx::FromRow`).
//! HTTP surface is [`ProjectResponse`] (enriched with computed progress fields)
//! plus the request bodies [`CreateProjectRequest`] and [`UpdateProjectRequest`].

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

// ── Enum mirrors ──────────────────────────────────────────────────────────────

/// Mirrors the `project_status` Postgres enum.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "project_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ProjectStatus {
    Active,
    Completed,
    Archived,
}

// ── Database row ──────────────────────────────────────────────────────────────

/// Raw row returned by `SELECT … FROM projects`.
#[derive(Clone, Debug, FromRow)]
pub struct Project {
    pub id: Uuid,
    pub user_id: Uuid,
    pub goal_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub deadline: Option<NaiveDate>,
    pub status: ProjectStatus,
    pub position: i32,
    /// Owning organization, or `None` when the project is unassigned.
    pub organization_id: Option<Uuid>,
    /// Soft-delete timestamp; `None` for active rows.
    pub deleted_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Progress aggregation (computed by the service layer) ──────────────────────

/// Task-count snapshot attached to every project response.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProjectProgress {
    /// Total tasks belonging to this project.
    pub total_tasks: i64,
    /// Tasks whose `status = 'completed'`.
    pub completed_tasks: i64,
    /// Completion ratio in `[0.0, 1.0]`. `0.0` when `total_tasks == 0`.
    pub completion_rate: f64,
}

// ── HTTP response ─────────────────────────────────────────────────────────────

/// Full project payload returned to the client.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProjectResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub goal_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub deadline: Option<NaiveDate>,
    pub status: ProjectStatus,
    pub position: i32,
    /// Owning organization, or `None` when the project is unassigned.
    pub organization_id: Option<Uuid>,
    /// Soft-delete timestamp; `None` for active rows (set for Trash views).
    pub deleted_at: Option<DateTime<Utc>>,
    pub progress: ProjectProgress,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl ProjectResponse {
    /// Combine a raw [`Project`] row with its computed [`ProjectProgress`].
    pub fn from_parts(project: Project, progress: ProjectProgress) -> Self {
        Self {
            id: project.id,
            user_id: project.user_id,
            goal_id: project.goal_id,
            name: project.name,
            description: project.description,
            color: project.color,
            deadline: project.deadline,
            status: project.status,
            position: project.position,
            organization_id: project.organization_id,
            deleted_at: project.deleted_at,
            progress,
            created_at: project.created_at,
            updated_at: project.updated_at,
        }
    }
}

// ── Request bodies ────────────────────────────────────────────────────────────

/// `POST /api/projects` body.
#[derive(Clone, Debug, Deserialize, Validate)]
pub struct CreateProjectRequest {
    /// Project display name (1–200 characters).
    #[validate(length(min = 1, max = 200, message = "name must be 1–200 characters"))]
    pub name: String,

    /// Optional free-form description.
    #[validate(length(max = 2000, message = "description must be ≤ 2000 characters"))]
    pub description: Option<String>,

    /// Hex colour string, e.g. `"#3B82F6"`.
    #[validate(length(max = 20, message = "color must be ≤ 20 characters"))]
    pub color: Option<String>,

    /// ISO-8601 date (YYYY-MM-DD) deadline.
    pub deadline: Option<NaiveDate>,

    /// Optional parent goal.
    pub goal_id: Option<Uuid>,

    /// Sort order hint; defaults to `0`.
    pub position: Option<i32>,
}

/// `PATCH /api/projects/:id` body — every field is optional.
#[derive(Clone, Debug, Deserialize, Validate)]
pub struct UpdateProjectRequest {
    #[validate(length(min = 1, max = 200, message = "name must be 1–200 characters"))]
    pub name: Option<String>,

    #[validate(length(max = 2000, message = "description must be ≤ 2000 characters"))]
    pub description: Option<String>,

    #[validate(length(max = 20, message = "color must be ≤ 20 characters"))]
    pub color: Option<String>,

    pub deadline: Option<NaiveDate>,

    pub goal_id: Option<Uuid>,

    pub status: Option<ProjectStatus>,

    pub position: Option<i32>,

    /// Assign or unassign the owning organization.
    ///
    /// Three-state semantics via `Option<Option<Uuid>>`:
    /// - field omitted   → `None`        → leave `organization_id` unchanged
    /// - `null`          → `Some(None)`  → unassign (set to NULL)
    /// - `"<uuid>"`      → `Some(Some)`  → assign to that organization
    #[serde(default, deserialize_with = "deserialize_double_option")]
    pub organization_id: Option<Option<Uuid>>,
}

/// Deserialize a present-but-nullable field into `Option<Option<T>>`.
///
/// An absent field is handled by `#[serde(default)]` (yields `None`); this
/// function is only invoked when the key is present, so it returns
/// `Some(inner)` where `inner` is `None` for an explicit JSON `null`.
fn deserialize_double_option<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer).map(Some)
}

// ── Query parameters ──────────────────────────────────────────────────────────

/// Optional filters accepted by `GET /api/projects`.
#[derive(Clone, Debug, Deserialize)]
pub struct ListProjectsQuery {
    /// Filter by status (`active` / `completed` / `archived`).
    pub status: Option<ProjectStatus>,
    /// Filter by parent goal.
    pub goal_id: Option<Uuid>,
}

// ── Reorder request ───────────────────────────────────────────────────────────

/// `PUT /api/projects/reorder` body — bulk position update.
#[derive(Clone, Debug, Deserialize, Validate)]
pub struct ReorderProjectsRequest {
    /// List of `(id, new_position)` pairs. All IDs must belong to the caller.
    #[validate(length(min = 1, message = "items must not be empty"))]
    pub items: Vec<ReorderItem>,
}

/// Single entry in a reorder request.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ReorderItem {
    pub id: Uuid,
    pub position: i32,
}
