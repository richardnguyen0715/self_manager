//! Data models and DTOs for the `initiative` module.
//!
//! # DB schema (from `migrations/0003_agile.sql`)
//!
//! ```sql
//! initiatives (
//!   id          uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
//!   user_id     uuid              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
//!   goal_id     uuid              NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
//!   title       text              NOT NULL,
//!   description text,
//!   status      initiative_status NOT NULL DEFAULT 'active',
//!   color       text,
//!   position    int               NOT NULL DEFAULT 0,
//!   created_at  timestamptz       NOT NULL DEFAULT now(),
//!   updated_at  timestamptz       NOT NULL DEFAULT now()
//! )
//! ```
//!
//! `initiative_status` enum: `'active' | 'completed' | 'paused' | 'abandoned'`

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

// ── DB row ──────────────────────────────────────────────────────────────────────

/// Full initiative row returned from the database.
///
/// The `status` column is projected as `status::text` in every query so that
/// SQLx maps it to a plain [`String`] without needing a custom type registration.
#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Initiative {
    pub id: Uuid,
    pub user_id: Uuid,
    pub goal_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    /// `initiative_status` postgres enum projected as text.
    pub status: String,
    pub color: Option<String>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Response DTOs ───────────────────────────────────────────────────────────────

/// Response body for a single initiative (flat object).
#[derive(Debug, Serialize)]
pub struct InitiativeResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub goal_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub color: Option<String>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Initiative> for InitiativeResponse {
    fn from(i: Initiative) -> Self {
        Self {
            id: i.id,
            user_id: i.user_id,
            goal_id: i.goal_id,
            title: i.title,
            description: i.description,
            status: i.status,
            color: i.color,
            position: i.position,
            created_at: i.created_at,
            updated_at: i.updated_at,
        }
    }
}

/// Paginated list envelope — `{ data: Initiative[], total }`.
#[derive(Debug, Serialize)]
pub struct InitiativeListResponse {
    pub data: Vec<InitiativeResponse>,
    pub total: i64,
}

// ── Nested epic summary (returned by GET /api/initiatives/:id/epics) ────────────

/// Lightweight epic row returned by the "epics under initiative" sub-resource.
///
/// The full epic model is owned by the `epic` module; this type is intentionally
/// minimal to avoid cross-module coupling.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct InitiativeEpicSummary {
    pub id: Uuid,
    pub user_id: Uuid,
    pub initiative_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    /// `epic_status` postgres enum projected as text.
    pub status: String,
    pub start_date: Option<chrono::NaiveDate>,
    pub due_date: Option<chrono::NaiveDate>,
    pub color: Option<String>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Paginated list envelope for epics — `{ data: Epic[], total }`.
#[derive(Debug, Serialize)]
pub struct EpicListResponse {
    pub data: Vec<InitiativeEpicSummary>,
    pub total: i64,
}

// ── Request DTOs ────────────────────────────────────────────────────────────────

/// Body for `POST /api/initiatives`.
#[derive(Debug, Deserialize, Validate)]
pub struct CreateInitiativeRequest {
    /// UUID of the goal this initiative belongs to.
    pub goal_id: Uuid,

    /// Required; 1–200 characters.
    #[validate(length(min = 1, max = 200, message = "title must be 1–200 characters"))]
    pub title: String,

    /// Optional free-form description; max 5 000 characters.
    #[validate(length(max = 5000, message = "description must be ≤ 5 000 characters"))]
    pub description: Option<String>,

    /// Valid values: `"active"`, `"completed"`, `"paused"`, `"abandoned"`.
    /// Defaults to `"active"` when absent.
    pub status: Option<InitiativeStatus>,

    /// CSS hex color, e.g. `"#6366f1"`.
    #[validate(length(max = 50, message = "color must be ≤ 50 characters"))]
    pub color: Option<String>,

    /// Sort position among the user's initiatives; defaults to 0.
    pub position: Option<i32>,
}

/// Body for `PATCH /api/initiatives/:id` — every field is optional.
#[derive(Debug, Deserialize, Validate)]
pub struct UpdateInitiativeRequest {
    /// Optionally reassign to a different goal.
    pub goal_id: Option<Uuid>,

    #[validate(length(min = 1, max = 200, message = "title must be 1–200 characters"))]
    pub title: Option<String>,

    #[validate(length(max = 5000, message = "description must be ≤ 5 000 characters"))]
    pub description: Option<String>,

    pub status: Option<InitiativeStatus>,

    #[validate(length(max = 50, message = "color must be ≤ 50 characters"))]
    pub color: Option<String>,

    pub position: Option<i32>,
}

// ── Query params ────────────────────────────────────────────────────────────────

/// Query-string parameters for `GET /api/initiatives`.
#[derive(Debug, Deserialize)]
pub struct ListInitiativesQuery {
    /// Filter by parent goal.  If absent, all goals are included.
    pub goal_id: Option<Uuid>,

    /// Filter by status.  If absent, all statuses are returned.
    pub status: Option<InitiativeStatus>,

    /// Page size; defaults to 50, max 200.
    pub limit: Option<i64>,

    /// Zero-based page offset; defaults to 0.
    pub offset: Option<i64>,
}

// ── Value objects ───────────────────────────────────────────────────────────────

/// Typed wrapper for the `initiative_status` postgres enum.
///
/// Serialises to/from lowercase snake_case strings so that the JSON API
/// uses `"active"`, `"completed"`, `"paused"`, `"abandoned"`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InitiativeStatus {
    Active,
    Completed,
    Paused,
    Abandoned,
}

impl InitiativeStatus {
    /// Returns the database-compatible string representation.
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Completed => "completed",
            Self::Paused => "paused",
            Self::Abandoned => "abandoned",
        }
    }
}

impl std::fmt::Display for InitiativeStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}
