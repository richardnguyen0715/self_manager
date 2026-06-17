//! Data transfer objects for the `search` module.
//!
//! All structs in this file are **read-only** — the search module never mutates
//! any entity. Each `*Hit` type carries just enough fields for a result card in
//! the command palette or the full search page.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

// ── Request ───────────────────────────────────────────────────────────────────

/// Query parameters for `GET /api/search`.
///
/// # Example
///
/// ```text
/// GET /api/search?q=meeting+notes&kinds=task,habit&limit=10
/// ```
#[derive(Debug, Deserialize, Validate)]
pub struct SearchQuery {
    /// The full-text / trigram search term.
    ///
    /// Must be between 1 and 200 characters after trimming.
    #[validate(length(min = 1, max = 200, message = "q must be 1–200 characters"))]
    pub q: String,

    /// Comma-separated entity kinds to include.
    ///
    /// Accepted values: `task`, `project`, `habit`.
    /// Defaults to all kinds when absent.
    pub kinds: Option<String>,

    /// Maximum number of results **per entity kind**.
    ///
    /// Defaults to 20, capped at 50.
    pub limit: Option<i64>,
}

impl SearchQuery {
    /// Parse the `kinds` field into a sorted, deduplicated list of
    /// [`EntityKind`] values.  Unknown tokens are silently ignored.
    #[must_use]
    pub fn parsed_kinds(&self) -> Vec<EntityKind> {
        match &self.kinds {
            None => vec![EntityKind::Task, EntityKind::Project, EntityKind::Habit],
            Some(raw) => {
                let mut out: Vec<EntityKind> = raw
                    .split(',')
                    .filter_map(|s| match s.trim() {
                        "task" => Some(EntityKind::Task),
                        "project" => Some(EntityKind::Project),
                        "habit" => Some(EntityKind::Habit),
                        _ => None,
                    })
                    .collect();
                out.dedup();
                if out.is_empty() {
                    vec![EntityKind::Task, EntityKind::Project, EntityKind::Habit]
                } else {
                    out
                }
            }
        }
    }

    /// Clamp and return the effective per-kind limit (1–50, default 20).
    #[must_use]
    pub fn effective_limit(&self) -> i64 {
        self.limit.unwrap_or(20).clamp(1, 50)
    }
}

/// Discriminator for result kinds.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EntityKind {
    Task,
    Project,
    Habit,
}

// ── Per-entity hit rows (returned from sqlx) ──────────────────────────────────

/// A single task search hit.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TaskHit {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    /// Serialised as a string to stay consistent across the REST API.
    #[serde(rename = "priority")]
    pub priority: String,
    #[serde(rename = "status")]
    pub status: String,
    pub due_date: Option<DateTime<Utc>>,
    pub project_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A single project search hit.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ProjectHit {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "status")]
    pub status: String,
    pub deadline: Option<chrono::NaiveDate>,
    pub goal_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A single habit search hit.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HabitHit {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "habit_type")]
    pub habit_type: String,
    pub frequency: String,
    pub archived: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Response ──────────────────────────────────────────────────────────────────

/// Envelope returned by `GET /api/search`.
///
/// Each slice is only present when the corresponding kind was requested.
#[derive(Debug, Serialize)]
pub struct SearchResponse {
    /// The original (trimmed) query echoed back for display purposes.
    pub query: String,
    /// Total number of hits across all included kinds.
    pub total: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tasks: Option<Vec<TaskHit>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub projects: Option<Vec<ProjectHit>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub habits: Option<Vec<HabitHit>>,
}
