//! Data models and DTOs for the `goal` module.
//!
//! # DB schema (from `migrations/0001_init.sql`)
//!
//! ```sql
//! goals (
//!   id          uuid PRIMARY KEY,
//!   user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
//!   title       text NOT NULL,
//!   description text,
//!   target_date date,
//!   status      goal_status NOT NULL DEFAULT 'active',
//!   color       text,
//!   position    int  NOT NULL DEFAULT 0,
//!   created_at  timestamptz NOT NULL DEFAULT now(),
//!   updated_at  timestamptz NOT NULL DEFAULT now()
//! )
//! ```
//!
//! `goal_status` enum: `'active' | 'completed' | 'abandoned' | 'paused'`

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

// ── DB row ─────────────────────────────────────────────────────────────────────

/// Full goal row returned from the database.
#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Goal {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub target_date: Option<NaiveDate>,
    /// Stored as text because SQLx maps postgres enums to `String` when using
    /// the `query!` / `query_as!` macros without a custom type registration.
    pub status: String,
    pub color: Option<String>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Response DTOs ──────────────────────────────────────────────────────────────

/// Roll-up of work under a goal, aggregated from tasks of its linked projects.
#[derive(Debug, Clone, Serialize)]
pub struct GoalProgress {
    pub total_projects: i64,
    pub total_tasks: i64,
    pub completed_tasks: i64,
    /// 0–100, share of tasks completed across the goal's projects.
    pub percent: i32,
}

impl Default for GoalProgress {
    fn default() -> Self {
        Self {
            total_projects: 0,
            total_tasks: 0,
            completed_tasks: 0,
            percent: 0,
        }
    }
}

/// Response body for a single goal.
#[derive(Debug, Serialize)]
pub struct GoalResponse {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub target_date: Option<NaiveDate>,
    pub status: String,
    pub color: Option<String>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// Progress rolled up from the goal's linked projects' tasks.
    pub progress: GoalProgress,
}

impl From<Goal> for GoalResponse {
    fn from(g: Goal) -> Self {
        Self {
            id: g.id,
            title: g.title,
            description: g.description,
            target_date: g.target_date,
            status: g.status,
            color: g.color,
            position: g.position,
            created_at: g.created_at,
            updated_at: g.updated_at,
            progress: GoalProgress::default(),
        }
    }
}

/// Paginated list response.
#[derive(Debug, Serialize)]
pub struct GoalListResponse {
    pub data: Vec<GoalResponse>,
    pub total: i64,
}

// ── Request DTOs ───────────────────────────────────────────────────────────────

/// Body for `POST /api/goals`.
#[derive(Debug, Deserialize, Validate)]
pub struct CreateGoalRequest {
    /// Required; 1–200 characters.
    #[validate(length(min = 1, max = 200, message = "title must be 1–200 characters"))]
    pub title: String,

    /// Optional free-form description; max 5 000 characters.
    #[validate(length(max = 5000, message = "description must be ≤ 5 000 characters"))]
    pub description: Option<String>,

    /// ISO-8601 date string (`YYYY-MM-DD`).
    pub target_date: Option<NaiveDate>,

    /// Valid values: `"active"`, `"completed"`, `"abandoned"`, `"paused"`.
    /// Defaults to `"active"` when absent.
    pub status: Option<GoalStatus>,

    /// CSS hex color, e.g. `"#6366f1"`.
    #[validate(length(max = 50, message = "color must be ≤ 50 characters"))]
    pub color: Option<String>,

    /// Sort position among the user's goals; defaults to 0.
    pub position: Option<i32>,
}

/// Body for `PATCH /api/goals/:id` — every field is optional.
#[derive(Debug, Deserialize, Validate)]
pub struct UpdateGoalRequest {
    #[validate(length(min = 1, max = 200, message = "title must be 1–200 characters"))]
    pub title: Option<String>,

    #[validate(length(max = 5000, message = "description must be ≤ 5 000 characters"))]
    pub description: Option<String>,

    pub target_date: Option<NaiveDate>,

    pub status: Option<GoalStatus>,

    #[validate(length(max = 50, message = "color must be ≤ 50 characters"))]
    pub color: Option<String>,

    pub position: Option<i32>,
}

/// Request body for `PATCH /api/goals/:id/position`.
#[derive(Debug, Deserialize, Validate)]
pub struct ReorderGoalRequest {
    pub position: i32,
}

// ── Value objects ──────────────────────────────────────────────────────────────

/// Typed wrapper for the `goal_status` postgres enum.
///
/// Serialises to/from lowercase snake_case strings so that the JSON API
/// uses `"active"`, `"completed"`, etc.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GoalStatus {
    Active,
    Completed,
    Abandoned,
    Paused,
}

impl GoalStatus {
    /// Returns the database-compatible string representation.
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Completed => "completed",
            Self::Abandoned => "abandoned",
            Self::Paused => "paused",
        }
    }
}

impl std::fmt::Display for GoalStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

// ── Query params ───────────────────────────────────────────────────────────────

/// Query-string parameters for `GET /api/goals`.
#[derive(Debug, Deserialize)]
pub struct ListGoalsQuery {
    /// Filter by status. If absent, all statuses are returned.
    pub status: Option<GoalStatus>,

    /// Page size; defaults to 50, max 200.
    pub limit: Option<i64>,

    /// Zero-based page offset; defaults to 0.
    pub offset: Option<i64>,
}
