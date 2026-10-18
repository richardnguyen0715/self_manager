//! Business logic for the `backlog` module.
//!
//! The backlog is the set of [`work_items`] rows whose `sprint_id` is `NULL`.
//! This module provides a single read query with optional `epic_id` filtering
//! and standard `limit`/`offset` pagination.
//!
//! # Enum-as-text pattern
//!
//! New agile tables use plain Postgres enums without a registered SQLx type.
//! Columns are selected as `col::text AS "alias!"` and never bound through a
//! Rust enum — only through `($n::text)::enum_name` casts.

use uuid::Uuid;

use crate::shared::{error::AppResult, state::AppState};

use super::models::{BacklogListResponse, BacklogRow, ListBacklogQuery, WorkItemListItem};

// ── helpers ────────────────────────────────────────────────────────────────────

/// Clamp `limit` to `[1, 200]`, defaulting to 50.
#[inline]
fn clamp_limit(raw: Option<i64>) -> i64 {
    raw.unwrap_or(50).clamp(1, 200)
}

/// Floor `offset` at 0, defaulting to 0.
#[inline]
fn clamp_offset(raw: Option<i64>) -> i64 {
    raw.unwrap_or(0).max(0)
}

// ── public service functions ───────────────────────────────────────────────────

/// Return a paginated list of backlog items (`sprint_id IS NULL`) for the
/// authenticated user.
///
/// When `query.epic_id` is `Some`, only items that belong to that epic are
/// returned.  Items with no epic (`epic_id IS NULL`) are included when no
/// `epic_id` filter is given.
///
/// Results are ordered by `position ASC, created_at ASC` for stable
/// drag-and-drop ordering.
///
/// # Errors
///
/// Returns [`crate::shared::error::AppError::Db`] on database failure.
pub async fn list_backlog(
    state: &AppState,
    user_id: Uuid,
    query: &ListBacklogQuery,
) -> AppResult<BacklogListResponse> {
    let limit = clamp_limit(query.limit);
    let offset = clamp_offset(query.offset);

    // Use the nullable-param pattern so both project_id and epic_id can be
    // optional without combinatorial query branches.
    let rows = sqlx::query_as!(
        BacklogRow,
        r#"
        SELECT
            wi.id,
            wi.project_id,
            wi.epic_id,
            wi.sprint_id,
            wi.type::text            AS "item_type!",
            wi.title,
            wi.status::text          AS "status!",
            wi.priority::text        AS "priority!",
            wi.story_points,
            wi.position,
            wi.due_date,
            COALESCE((SELECT p.key FROM projects p WHERE p.id = wi.project_id), 'WI')
                || '-' || wi.seq_id  AS "key?",
            wi.seq_id                AS "seq_id?",
            wi.created_at,
            wi.updated_at,
            COUNT(s.id)              AS "subtask_count!",
            COUNT(s.id) FILTER (WHERE s.is_done) AS "done_subtask_count!"
        FROM work_items wi
        LEFT JOIN work_item_subtasks s ON s.work_item_id = wi.id
        WHERE wi.user_id   = $1
          AND wi.deleted_at IS NULL
          AND wi.sprint_id IS NULL
          AND ($2::uuid IS NULL OR wi.project_id = $2)
          AND ($3::uuid IS NULL OR wi.epic_id    = $3)
        GROUP BY wi.id
        ORDER BY wi.position ASC, wi.created_at ASC
        LIMIT $4 OFFSET $5
        "#,
        user_id,
        query.project_id as Option<Uuid>,
        query.epic_id    as Option<Uuid>,
        limit,
        offset,
    )
    .fetch_all(&state.db)
    .await?;

    let total: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)
        FROM work_items
        WHERE user_id   = $1
          AND deleted_at IS NULL
          AND sprint_id IS NULL
          AND ($2::uuid IS NULL OR project_id = $2)
          AND ($3::uuid IS NULL OR epic_id    = $3)
        "#,
        user_id,
        query.project_id as Option<Uuid>,
        query.epic_id    as Option<Uuid>,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    Ok(BacklogListResponse {
        data: rows.into_iter().map(WorkItemListItem::from).collect(),
        total,
    })
}
