//! Data models and DTOs for the `retrospective` module.
//!
//! # DB schema (from `migrations/0003_agile.sql`)
//!
//! ```sql
//! retrospectives (
//!   id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
//!   user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
//!   sprint_id    uuid        NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
//!   went_well    text,
//!   went_wrong   text,
//!   action_items jsonb       NOT NULL DEFAULT '[]'::jsonb,
//!   created_at   timestamptz NOT NULL DEFAULT now(),
//!   updated_at   timestamptz NOT NULL DEFAULT now(),
//!   CONSTRAINT uq_retrospectives_sprint UNIQUE (sprint_id)
//! )
//! ```
//!
//! One retrospective per sprint; the `PUT` endpoint upserts.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;
use validator::Validate;

// ── DB row ─────────────────────────────────────────────────────────────────────

/// Full retrospective row returned from the database.
///
/// `action_items` is stored as `jsonb`; SQLx maps it to [`serde_json::Value`].
/// The JSON shape expected by the frontend is an array of
/// `{ id: string, text: string, done?: boolean }` objects.
#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Retrospective {
    pub id: Uuid,
    pub user_id: Uuid,
    pub sprint_id: Uuid,
    pub went_well: Option<String>,
    pub went_wrong: Option<String>,
    /// Arbitrary JSON array of action items.
    pub action_items: JsonValue,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Request DTOs ───────────────────────────────────────────────────────────────

/// Body for `PUT /api/sprints/:id/retrospective`.
///
/// All fields are optional; omitted fields retain their current values on
/// update, or default to `null` / `[]` on creation.
#[derive(Debug, Deserialize, Validate)]
pub struct UpsertRetrospectiveRequest {
    /// Free-form text describing what went well during the sprint.
    ///
    /// Pass `null` or omit to leave unchanged; pass `""` to clear.
    #[validate(length(max = 10_000, message = "went_well must be ≤ 10 000 characters"))]
    pub went_well: Option<String>,

    /// Free-form text describing what went wrong during the sprint.
    ///
    /// Pass `null` or omit to leave unchanged; pass `""` to clear.
    #[validate(length(max = 10_000, message = "went_wrong must be ≤ 10 000 characters"))]
    pub went_wrong: Option<String>,

    /// Array of action items (`[{ id, text, done? }]`).
    ///
    /// Pass `null` or omit to leave unchanged; pass `[]` to clear.
    pub action_items: Option<JsonValue>,
}
