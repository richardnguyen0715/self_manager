//! Data models and DTOs for the `review` module.
//!
//! # DB schema (from `migrations/0003_agile.sql`)
//!
//! ```sql
//! sprint_reviews (
//!   id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
//!   user_id          uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
//!   sprint_id        uuid         NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
//!   planned_points   int          NOT NULL DEFAULT 0,
//!   completed_points int          NOT NULL DEFAULT 0,
//!   velocity         numeric(5,2) NOT NULL DEFAULT 0,
//!   summary          text,
//!   created_at       timestamptz  NOT NULL DEFAULT now(),
//!   updated_at       timestamptz  NOT NULL DEFAULT now(),
//!   CONSTRAINT uq_sprint_reviews_sprint UNIQUE (sprint_id)
//! )
//! ```
//!
//! `velocity` is a completion ratio in `[0.0, 100.0]` — stored as
//! `numeric(5,2)` in Postgres and mapped to `f64` via SQLx's `PgNumeric`
//! → `Decimal` bridge. We bind it as `f64` and read it back as `f64`.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

// ── DB row ─────────────────────────────────────────────────────────────────────

/// Full `sprint_reviews` row returned from the database.
///
/// `velocity` is stored as `NUMERIC(5,2)` in Postgres; SQLx decodes it into
/// `f64` when the column alias carries the `!` non-null override.
#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct SprintReview {
    pub id: Uuid,
    pub user_id: Uuid,
    pub sprint_id: Uuid,
    pub planned_points: i32,
    pub completed_points: i32,
    /// Completion velocity in `[0.0, 100.0]`.
    pub velocity: f64,
    pub summary: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Response DTO ───────────────────────────────────────────────────────────────

/// Flat response body for a single sprint review (returned by all endpoints).
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

impl From<SprintReview> for SprintReviewResponse {
    fn from(r: SprintReview) -> Self {
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

// ── Request DTOs ───────────────────────────────────────────────────────────────

/// Body for `PUT /api/sprints/:id/review` — upserts the review.
///
/// `planned_points` and `completed_points` may be provided explicitly to
/// override the values that were auto-computed when the sprint was completed.
/// When omitted, any existing values are preserved (on update) or derived from
/// the sprint's current data (on insert).
#[derive(Debug, Deserialize, Validate)]
pub struct UpsertReviewRequest {
    /// Optional free-text summary for the sprint review.
    ///
    /// Maximum 10 000 characters.
    #[validate(length(max = 10_000, message = "summary must be ≤ 10 000 characters"))]
    pub summary: Option<String>,

    /// Override for the planned story-point total.
    ///
    /// When absent on an insert, this is computed from the sprint's work items.
    /// On an update, the existing value is left unchanged when this is absent.
    #[validate(range(min = 0, message = "planned_points must be ≥ 0"))]
    pub planned_points: Option<i32>,

    /// Override for the completed story-point total.
    ///
    /// When absent on an insert, this is copied from the sprint's
    /// `completed_points` column. On an update, the existing value is left
    /// unchanged when this is absent.
    #[validate(range(min = 0, message = "completed_points must be ≥ 0"))]
    pub completed_points: Option<i32>,
}
