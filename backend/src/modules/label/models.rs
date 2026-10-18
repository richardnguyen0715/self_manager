//! Label module — DB row + request DTOs.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Maximum label name length (characters, after trimming).
pub const MAX_NAME_LEN: usize = 50;

// ── DB row ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Label {
    pub id: Uuid,
    pub user_id: Uuid,
    /// `None` = global to the user; `Some` = scoped to one project.
    pub project_id: Option<Uuid>,
    pub name: String,
    pub color: String,
    pub created_at: DateTime<Utc>,
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

/// Query for `GET /api/labels`. With `project_id`, returns that project's labels
/// plus the user's global labels; without it, returns every label of the user.
#[derive(Debug, Deserialize)]
pub struct ListLabelsQuery {
    pub project_id: Option<Uuid>,
}

/// Body for `POST /api/labels`.
#[derive(Debug, Deserialize)]
pub struct CreateLabelRequest {
    pub name: String,
    pub color: Option<String>,
    pub project_id: Option<Uuid>,
}

/// Body for `PATCH /api/labels/:id` — every field optional.
#[derive(Debug, Deserialize)]
pub struct UpdateLabelRequest {
    pub name: Option<String>,
    pub color: Option<String>,
}
