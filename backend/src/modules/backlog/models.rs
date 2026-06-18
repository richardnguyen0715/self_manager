//! Data models and DTOs for the `backlog` module.
//!
//! The backlog is a **logical view**, not a separate table.  It is defined as:
//!
//! ```sql
//! SELECT * FROM work_items WHERE user_id = $1 AND sprint_id IS NULL
//! ORDER BY position ASC, created_at ASC
//! ```
//!
//! # DB columns used (from `migrations/0003_agile.sql`)
//!
//! ```sql
//! work_items (
//!   id              uuid,
//!   user_id         uuid,
//!   epic_id         uuid?,
//!   sprint_id       uuid?,        -- NULL  ⇒  in backlog
//!   type            work_item_type,
//!   title           text,
//!   status          work_item_status,
//!   priority        task_priority,
//!   story_points    int?,
//!   position        int,
//!   due_date        timestamptz?,
//!   created_at      timestamptz,
//!   updated_at      timestamptz
//! )
//! work_item_subtasks (
//!   work_item_id    uuid,
//!   is_done         boolean
//! )
//! ```

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── DB projection row ──────────────────────────────────────────────────────────

/// Raw row returned by the backlog list query.
///
/// Enum columns are fetched as `::text` to avoid requiring a registered SQLx
/// type; `subtask_count` / `done_subtask_count` are joined aggregates.
#[derive(Debug, sqlx::FromRow)]
pub struct BacklogRow {
    pub id: Uuid,
    pub project_id: Option<Uuid>,
    pub epic_id: Option<Uuid>,
    /// Always `NULL` for backlog items; included for API symmetry with
    /// `WorkItemListItem`.
    pub sprint_id: Option<Uuid>,
    /// `work_item_type::text`
    pub item_type: String,
    pub title: String,
    /// `work_item_status::text`
    pub status: String,
    /// `task_priority::text`
    pub priority: String,
    pub story_points: Option<i32>,
    pub position: i32,
    pub due_date: Option<DateTime<Utc>>,
    pub subtask_count: i64,
    pub done_subtask_count: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Response DTOs ──────────────────────────────────────────────────────────────

/// Lightweight work-item summary used in list responses.
///
/// Mirrors the `WorkItemListItem` TypeScript interface from `AGILE-CONTRACT.md`
/// section E.
#[derive(Debug, Serialize)]
pub struct WorkItemListItem {
    pub id: Uuid,
    pub project_id: Option<Uuid>,
    pub epic_id: Option<Uuid>,
    pub sprint_id: Option<Uuid>,
    /// Rust field name is `item_type`; serialised as `"type"` to match the
    /// JSON contract (`type` is a reserved word in TypeScript).
    #[serde(rename = "type")]
    pub item_type: String,
    pub title: String,
    pub status: String,
    pub priority: String,
    pub story_points: Option<i32>,
    pub due_date: Option<DateTime<Utc>>,
    pub position: i32,
    pub subtask_count: i64,
    pub done_subtask_count: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<BacklogRow> for WorkItemListItem {
    fn from(r: BacklogRow) -> Self {
        Self {
            id: r.id,
            project_id: r.project_id,
            epic_id: r.epic_id,
            sprint_id: r.sprint_id,
            item_type: r.item_type,
            title: r.title,
            status: r.status,
            priority: r.priority,
            story_points: r.story_points,
            due_date: r.due_date,
            position: r.position,
            subtask_count: r.subtask_count,
            done_subtask_count: r.done_subtask_count,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

/// Paginated list envelope — matches `{ data, total }` used by the `goal`
/// module and required by `AGILE-CONTRACT.md` section C.
#[derive(Debug, Serialize)]
pub struct BacklogListResponse {
    pub data: Vec<WorkItemListItem>,
    pub total: i64,
}

// ── Query-string parameters ────────────────────────────────────────────────────

/// Query parameters accepted by `GET /api/backlog`.
#[derive(Debug, Deserialize)]
pub struct ListBacklogQuery {
    /// Filter by project (scoping unit). `None` returns items across all projects.
    pub project_id: Option<Uuid>,

    /// Filter by epic; if absent all epics (including items with no epic) are
    /// returned.
    pub epic_id: Option<Uuid>,

    /// Page size.  Defaults to 50; clamped to `[1, 200]`.
    pub limit: Option<i64>,

    /// Zero-based row offset.  Defaults to 0.
    pub offset: Option<i64>,
}
