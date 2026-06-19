//! Data models and DTOs for the `space` module.
//!
//! # DB schema (from `migrations/0007_docs.sql`)
//!
//! ```sql
//! spaces (
//!   id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
//!   user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
//!   project_id  uuid                 REFERENCES projects(id) ON DELETE SET NULL,
//!   name        text        NOT NULL,
//!   icon        text,
//!   description text,
//!   created_at  timestamptz NOT NULL DEFAULT now(),
//!   updated_at  timestamptz NOT NULL DEFAULT now()
//! )
//! ```
//!
//! `icon`, `description`, and `project_id` are nullable columns.  PATCH fields
//! that need to distinguish "absent → keep" from `null → clear` use
//! `Option<Option<T>>`: outer `Some` means the field was present in the JSON
//! body, inner `None` means the caller sent `null`.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

// ── DB row ─────────────────────────────────────────────────────────────────────

/// Full `spaces` row returned from the database.
#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Space {
    pub id: Uuid,
    pub user_id: Uuid,
    pub project_id: Option<Uuid>,
    pub name: String,
    pub icon: Option<String>,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Request DTOs ───────────────────────────────────────────────────────────────

/// Body for `POST /api/spaces`.
#[derive(Debug, Deserialize, Validate)]
pub struct CreateSpaceRequest {
    /// Space name; 1–200 characters, required.
    #[validate(length(min = 1, max = 200, message = "name must be 1–200 characters"))]
    pub name: String,

    /// Optional emoji icon glyph (e.g. `"📘"`).
    pub icon: Option<String>,

    /// Optional human-readable description.
    pub description: Option<String>,

    /// Optional project association (`NULL` = personal/unscoped space).
    pub project_id: Option<Uuid>,
}

/// Body for `PATCH /api/spaces/:id` — every field is optional.
///
/// Nullable fields use `Option<Option<T>>`:
/// - Field absent in JSON body → outer `None` → keep existing value.
/// - Field present as `null`   → outer `Some(None)` → clear/set to NULL.
/// - Field present with value  → outer `Some(Some(v))` → update to `v`.
#[derive(Debug, Deserialize, Validate)]
pub struct UpdateSpaceRequest {
    /// New name; 1–200 characters when provided.
    #[validate(length(min = 1, max = 200, message = "name must be 1–200 characters"))]
    pub name: Option<String>,

    /// New icon emoji glyph, or `null` to clear.
    pub icon: Option<Option<String>>,

    /// New description, or `null` to clear.
    pub description: Option<Option<String>>,

    /// New project association, or `null` to detach from any project.
    pub project_id: Option<Option<Uuid>>,
}

// ── Query parameters ───────────────────────────────────────────────────────────

/// Query-string parameters for `GET /api/spaces`.
#[derive(Debug, Deserialize)]
pub struct ListSpacesQuery {
    /// Optional filter — return only spaces linked to this project UUID.
    /// Absent = return all spaces for the authenticated user.
    pub project_id: Option<Uuid>,
}
