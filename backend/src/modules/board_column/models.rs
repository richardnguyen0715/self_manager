//! Data models and DTOs for the `board_column` module.
//!
//! # DB schema (from `migrations/0006_board_columns.sql`)
//!
//! ```sql
//! board_columns (
//!   id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//!   user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
//!   project_id     uuid REFERENCES projects(id) ON DELETE CASCADE,
//!   name           text NOT NULL,
//!   color          text,
//!   position       int NOT NULL DEFAULT 0,
//!   wip_limit      int,
//!   mapped_status  work_item_status,   -- NULL for custom columns
//!   created_at     timestamptz NOT NULL DEFAULT now(),
//!   updated_at     timestamptz NOT NULL DEFAULT now()
//! )
//! ```
//!
//! Enum columns use the same **enum-as-text** pattern as the rest of the codebase:
//! - SELECT: `col::text AS "col!"`  / `col::text AS "col?"` for nullable
//! - Bind:   `($n::text)::work_item_status`

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

// ── DB row ─────────────────────────────────────────────────────────────────────

/// Full `board_columns` row returned from the database.
///
/// `mapped_status` is an `Option<String>` because the column is nullable:
/// seeded columns carry one of the five `work_item_status` values; user-created
/// columns carry `NULL`.
#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct BoardColumn {
    pub id: Uuid,
    pub user_id: Uuid,
    pub project_id: Option<Uuid>,
    pub name: String,
    pub color: Option<String>,
    pub position: i32,
    pub wip_limit: Option<i32>,
    /// `work_item_status` column cast to text, or `NULL` for custom columns.
    pub mapped_status: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Request DTOs ───────────────────────────────────────────────────────────────

/// Body for `POST /api/board-columns`.
#[derive(Debug, Deserialize, Validate)]
pub struct CreateBoardColumnRequest {
    /// Column display name; 1–200 characters.
    #[validate(length(min = 1, max = 200, message = "name must be 1–200 characters"))]
    pub name: String,

    /// Optional hex color or CSS color string.
    #[validate(length(max = 50, message = "color must be ≤ 50 characters"))]
    pub color: Option<String>,

    /// Optional project scoping. `None` = "All projects" board.
    pub project_id: Option<Uuid>,

    /// Optional WIP limit (work-in-progress cap).
    pub wip_limit: Option<i32>,
}

/// Body for `PATCH /api/board-columns/:id`.
#[derive(Debug, Deserialize, Validate)]
pub struct UpdateBoardColumnRequest {
    /// New display name.
    #[validate(length(min = 1, max = 200, message = "name must be 1–200 characters"))]
    pub name: Option<String>,

    /// New color.
    #[validate(length(max = 50, message = "color must be ≤ 50 characters"))]
    pub color: Option<String>,

    /// New WIP limit; `None` preserves the existing value.
    pub wip_limit: Option<i32>,
}

/// Body for `PUT /api/board-columns/reorder`.
#[derive(Debug, Deserialize)]
pub struct ReorderBoardColumnsRequest {
    /// Full ordered list of column IDs for the same (user, project_id) scope.
    /// Each element receives `position = array_index`.
    pub ids: Vec<Uuid>,
}

// ── Query parameters ───────────────────────────────────────────────────────────

/// Query-string parameters for `GET /api/board-columns`.
#[derive(Debug, Deserialize)]
pub struct ListBoardColumnsQuery {
    /// Optional project filter. `None` = "All projects" (project_id IS NULL) scope.
    pub project_id: Option<Uuid>,
}
