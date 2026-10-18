//! DB row + request DTOs for the `saved_view` module.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

/// Allowed `scope` values (mirrors the DB CHECK constraint).
pub const VALID_SCOPES: &[&str] = &["work_items", "backlog", "board"];

// ── DB row ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct SavedView {
    pub id: Uuid,
    pub user_id: Uuid,
    pub project_id: Option<Uuid>,
    pub name: String,
    pub scope: String,
    pub filters: serde_json::Value,
    pub display: serde_json::Value,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Request DTOs ────────────────────────────────────────────────────────────

/// Body for `POST /api/saved-views`.
#[derive(Debug, Deserialize, Validate)]
pub struct CreateSavedViewRequest {
    #[validate(length(min = 1, max = 100, message = "name must be 1–100 characters"))]
    pub name: String,

    /// Defaults to `"work_items"` when omitted.
    pub scope: Option<String>,

    /// `None` = "All projects" scope.
    pub project_id: Option<Uuid>,

    /// Saved filter state (e.g. `{ "type": [...], "status": [...], "search": "" }`).
    pub filters: Option<serde_json::Value>,

    /// Saved display options. Opaque to the backend.
    pub display: Option<serde_json::Value>,
}

/// Body for `PATCH /api/saved-views/:id`. Omitted fields are left unchanged.
#[derive(Debug, Deserialize, Validate)]
pub struct UpdateSavedViewRequest {
    #[validate(length(min = 1, max = 100, message = "name must be 1–100 characters"))]
    pub name: Option<String>,

    pub filters: Option<serde_json::Value>,

    pub display: Option<serde_json::Value>,

    pub position: Option<i32>,
}

// ── Query parameters ────────────────────────────────────────────────────────

/// Query-string parameters for `GET /api/saved-views`.
#[derive(Debug, Deserialize)]
pub struct ListSavedViewsQuery {
    pub scope: Option<String>,
    /// `None` = "All projects" (`project_id IS NULL`) scope.
    pub project_id: Option<Uuid>,
}
