//! Business logic for the `epic` module.
//!
//! All public functions accept a reference to [`AppState`] and execute raw SQL
//! via `sqlx::query!` / `sqlx::query_as!` (compile-time checked).
//!
//! ## Enum-as-text pattern
//!
//! New Postgres enums (`epic_status`) are handled without `sqlx::Type` derive:
//! - SELECT: `status::text AS "status!"`
//! - Filter: `status::text = $n`
//! - Insert/Update: `($n::text)::epic_status`
//!
//! ## Progress rollup
//!
//! `EpicResponse` carries three derived fields computed from `work_items`:
//! - `progress.total_items` / `progress.done_items` / `progress.completion_rate`
//! - `total_points` / `done_points`
//!
//! These are fetched in a single aggregation query per epic to avoid N+1 problems.

use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    state::AppState,
};

use super::models::{
    CreateEpicRequest, EpicListResponse, EpicProgress, EpicResponse, EpicRow, EpicStatus,
    ListEpicWorkItemsQuery, ListEpicsQuery, UpdateEpicRequest, WorkItemListResponse,
    WorkItemSummary,
};

// ── helpers ────────────────────────────────────────────────────────────────────

#[inline]
fn clamp_limit(raw: Option<i64>) -> i64 {
    raw.unwrap_or(50).clamp(1, 200)
}

#[inline]
fn clamp_offset(raw: Option<i64>) -> i64 {
    raw.unwrap_or(0).max(0)
}

// ── progress rollup ────────────────────────────────────────────────────────────

/// Aggregation row returned by the progress query.
#[derive(Debug, sqlx::FromRow)]
struct ProgressRow {
    total_items: Option<i64>,
    done_items: Option<i64>,
    total_points: Option<i64>,
    done_points: Option<i64>,
}

/// Fetch derived progress for a single epic from `work_items`.
async fn fetch_progress(state: &AppState, epic_id: Uuid) -> AppResult<(EpicProgress, i64, i64)> {
    let row = sqlx::query_as!(
        ProgressRow,
        r#"
        SELECT
            COUNT(*)                                        AS total_items,
            COUNT(*) FILTER (WHERE status::text = 'done')  AS done_items,
            COALESCE(SUM(story_points), 0)                 AS total_points,
            COALESCE(SUM(story_points) FILTER (WHERE status::text = 'done'), 0) AS done_points
        FROM work_items
        WHERE epic_id = $1
        "#,
        epic_id,
    )
    .fetch_one(&state.db)
    .await?;

    let total_items = row.total_items.unwrap_or(0);
    let done_items = row.done_items.unwrap_or(0);
    let total_points = row.total_points.unwrap_or(0);
    let done_points = row.done_points.unwrap_or(0);

    let completion_rate = if total_items == 0 {
        0.0_f64
    } else {
        done_items as f64 / total_items as f64
    };

    Ok((
        EpicProgress {
            total_items,
            done_items,
            completion_rate,
        },
        total_points,
        done_points,
    ))
}

/// Attach progress rollup to a raw [`EpicRow`], producing an [`EpicResponse`].
async fn attach_progress(state: &AppState, row: EpicRow) -> AppResult<EpicResponse> {
    let (progress, total_points, done_points) = fetch_progress(state, row.id).await?;
    Ok(EpicResponse {
        id: row.id,
        user_id: row.user_id,
        initiative_id: row.initiative_id,
        title: row.title,
        description: row.description,
        status: row.status,
        start_date: row.start_date,
        due_date: row.due_date,
        color: row.color,
        position: row.position,
        progress,
        total_points,
        done_points,
        created_at: row.created_at,
        updated_at: row.updated_at,
    })
}

// ── ownership guard ────────────────────────────────────────────────────────────

/// Verify that `initiative_id` exists and is owned by `user_id`.
///
/// Returns `AppError::NotFound` when either condition fails.
async fn assert_initiative_owner(
    state: &AppState,
    user_id: Uuid,
    initiative_id: Uuid,
) -> AppResult<()> {
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM initiatives WHERE id = $1 AND user_id = $2)",
        initiative_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound);
    }

    Ok(())
}

// ── public service functions ───────────────────────────────────────────────────

/// Fetch a paginated list of epics for the authenticated user.
///
/// Optionally filters by `initiative_id` and/or `status`. Results are ordered
/// by `position ASC`, then `created_at ASC`.
///
/// # Errors
///
/// Returns [`AppError::Db`] on database failure.
pub async fn list_epics(
    state: &AppState,
    user_id: Uuid,
    query: &ListEpicsQuery,
) -> AppResult<EpicListResponse> {
    let limit = clamp_limit(query.limit);
    let offset = clamp_offset(query.offset);
    let status_str = query.status.as_ref().map(EpicStatus::as_str);

    // Fetch raw rows with four-way filter combination handled via dynamic SQL
    // expressed as two branches to keep the compile-time query!() macros happy.
    let rows: Vec<EpicRow> = match (query.initiative_id, status_str) {
        (Some(init_id), Some(st)) => {
            sqlx::query_as!(
                EpicRow,
                r#"
                SELECT
                    id, user_id, initiative_id, title, description,
                    status::text AS "status!",
                    start_date, due_date, color, position, created_at, updated_at
                FROM epics
                WHERE user_id = $1
                  AND initiative_id = $2
                  AND status::text = $3
                ORDER BY position ASC, created_at ASC
                LIMIT $4 OFFSET $5
                "#,
                user_id,
                init_id,
                st,
                limit,
                offset,
            )
            .fetch_all(&state.db)
            .await?
        }
        (Some(init_id), None) => {
            sqlx::query_as!(
                EpicRow,
                r#"
                SELECT
                    id, user_id, initiative_id, title, description,
                    status::text AS "status!",
                    start_date, due_date, color, position, created_at, updated_at
                FROM epics
                WHERE user_id = $1
                  AND initiative_id = $2
                ORDER BY position ASC, created_at ASC
                LIMIT $3 OFFSET $4
                "#,
                user_id,
                init_id,
                limit,
                offset,
            )
            .fetch_all(&state.db)
            .await?
        }
        (None, Some(st)) => {
            sqlx::query_as!(
                EpicRow,
                r#"
                SELECT
                    id, user_id, initiative_id, title, description,
                    status::text AS "status!",
                    start_date, due_date, color, position, created_at, updated_at
                FROM epics
                WHERE user_id = $1
                  AND status::text = $2
                ORDER BY position ASC, created_at ASC
                LIMIT $3 OFFSET $4
                "#,
                user_id,
                st,
                limit,
                offset,
            )
            .fetch_all(&state.db)
            .await?
        }
        (None, None) => {
            sqlx::query_as!(
                EpicRow,
                r#"
                SELECT
                    id, user_id, initiative_id, title, description,
                    status::text AS "status!",
                    start_date, due_date, color, position, created_at, updated_at
                FROM epics
                WHERE user_id = $1
                ORDER BY position ASC, created_at ASC
                LIMIT $2 OFFSET $3
                "#,
                user_id,
                limit,
                offset,
            )
            .fetch_all(&state.db)
            .await?
        }
    };

    let total: i64 = match (query.initiative_id, status_str) {
        (Some(init_id), Some(st)) => sqlx::query_scalar!(
            "SELECT COUNT(*) FROM epics WHERE user_id = $1 AND initiative_id = $2 AND status::text = $3",
            user_id,
            init_id,
            st,
        )
        .fetch_one(&state.db)
        .await?
        .unwrap_or(0),

        (Some(init_id), None) => sqlx::query_scalar!(
            "SELECT COUNT(*) FROM epics WHERE user_id = $1 AND initiative_id = $2",
            user_id,
            init_id,
        )
        .fetch_one(&state.db)
        .await?
        .unwrap_or(0),

        (None, Some(st)) => sqlx::query_scalar!(
            "SELECT COUNT(*) FROM epics WHERE user_id = $1 AND status::text = $2",
            user_id,
            st,
        )
        .fetch_one(&state.db)
        .await?
        .unwrap_or(0),

        (None, None) => sqlx::query_scalar!(
            "SELECT COUNT(*) FROM epics WHERE user_id = $1",
            user_id,
        )
        .fetch_one(&state.db)
        .await?
        .unwrap_or(0),
    };

    // Attach progress to each row. For list views this is acceptable; the list
    // is bounded by `limit` (max 200) and each progress query is a single
    // aggregation on an indexed FK column.
    let mut data = Vec::with_capacity(rows.len());
    for row in rows {
        data.push(attach_progress(state, row).await?);
    }

    Ok(EpicListResponse { data, total })
}

/// Create a new epic for the authenticated user.
///
/// Verifies that the referenced `initiative_id` exists and is owned by the user.
///
/// # Errors
///
/// - [`AppError::NotFound`] — initiative not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn create_epic(
    state: &AppState,
    user_id: Uuid,
    req: CreateEpicRequest,
) -> AppResult<EpicResponse> {
    assert_initiative_owner(state, user_id, req.initiative_id).await?;

    let status = req
        .status
        .as_ref()
        .map(EpicStatus::as_str)
        .unwrap_or("todo");
    let position = req.position.unwrap_or(0);

    let row = sqlx::query_as!(
        EpicRow,
        r#"
        INSERT INTO epics
            (user_id, initiative_id, title, description, status, start_date, due_date, color, position)
        VALUES ($1, $2, $3, $4, ($5::text)::epic_status, $6, $7, $8, $9)
        RETURNING
            id, user_id, initiative_id, title, description,
            status::text AS "status!",
            start_date, due_date, color, position, created_at, updated_at
        "#,
        user_id,
        req.initiative_id,
        req.title,
        req.description,
        status,
        req.start_date,
        req.due_date,
        req.color,
        position,
    )
    .fetch_one(&state.db)
    .await?;

    attach_progress(state, row).await
}

/// Fetch a single epic by ID, enforcing ownership.
///
/// The returned response includes derived progress rollup fields.
///
/// # Errors
///
/// - [`AppError::NotFound`] — epic not found or belongs to a different user.
/// - [`AppError::Db`] — database failure.
pub async fn get_epic(state: &AppState, user_id: Uuid, epic_id: Uuid) -> AppResult<EpicResponse> {
    let row = sqlx::query_as!(
        EpicRow,
        r#"
        SELECT
            id, user_id, initiative_id, title, description,
            status::text AS "status!",
            start_date, due_date, color, position, created_at, updated_at
        FROM epics
        WHERE id = $1 AND user_id = $2
        "#,
        epic_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    attach_progress(state, row).await
}

/// Partially update an epic; only provided fields are mutated.
///
/// When `initiative_id` is supplied, verifies that the new initiative is owned
/// by the same user.
///
/// # Errors
///
/// - [`AppError::NotFound`] — epic (or new initiative) not found / wrong owner.
/// - [`AppError::Db`] — database failure.
pub async fn update_epic(
    state: &AppState,
    user_id: Uuid,
    epic_id: Uuid,
    req: UpdateEpicRequest,
) -> AppResult<EpicResponse> {
    // Fetch current state to coalesce missing fields.
    let current = sqlx::query_as!(
        EpicRow,
        r#"
        SELECT
            id, user_id, initiative_id, title, description,
            status::text AS "status!",
            start_date, due_date, color, position, created_at, updated_at
        FROM epics
        WHERE id = $1 AND user_id = $2
        "#,
        epic_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // If re-parenting, verify the new initiative belongs to this user.
    let new_initiative_id = if let Some(init_id) = req.initiative_id {
        assert_initiative_owner(state, user_id, init_id).await?;
        init_id
    } else {
        current.initiative_id
    };

    let new_title = req.title.as_deref().unwrap_or(&current.title);
    let new_description = if req.description.is_some() {
        req.description.as_deref()
    } else {
        current.description.as_deref()
    };
    let new_status = req
        .status
        .as_ref()
        .map(EpicStatus::as_str)
        .unwrap_or(current.status.as_str());
    let new_start_date = if req.start_date.is_some() {
        req.start_date
    } else {
        current.start_date
    };
    let new_due_date = if req.due_date.is_some() {
        req.due_date
    } else {
        current.due_date
    };
    let new_color = if req.color.is_some() {
        req.color.as_deref()
    } else {
        current.color.as_deref()
    };
    let new_position = req.position.unwrap_or(current.position);

    let updated = sqlx::query_as!(
        EpicRow,
        r#"
        UPDATE epics
        SET
            initiative_id = $3,
            title         = $4,
            description   = $5,
            status        = ($6::text)::epic_status,
            start_date    = $7,
            due_date      = $8,
            color         = $9,
            position      = $10,
            updated_at    = now()
        WHERE id = $1 AND user_id = $2
        RETURNING
            id, user_id, initiative_id, title, description,
            status::text AS "status!",
            start_date, due_date, color, position, created_at, updated_at
        "#,
        epic_id,
        user_id,
        new_initiative_id,
        new_title,
        new_description,
        new_status,
        new_start_date,
        new_due_date,
        new_color,
        new_position,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    attach_progress(state, updated).await
}

/// Delete an epic by ID, enforcing ownership.
///
/// Work items under this epic will have their `epic_id` set to `NULL` by the
/// database `ON DELETE SET NULL` constraint.
///
/// # Errors
///
/// - [`AppError::NotFound`] — epic not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn delete_epic(state: &AppState, user_id: Uuid, epic_id: Uuid) -> AppResult<()> {
    let result = sqlx::query!(
        "DELETE FROM epics WHERE id = $1 AND user_id = $2",
        epic_id,
        user_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}

/// List work items that belong to a specific epic, enforcing ownership.
///
/// Optionally filters by `status`. Results are ordered by `position ASC`,
/// then `created_at ASC`.
///
/// # Errors
///
/// - [`AppError::NotFound`] — epic not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn list_epic_work_items(
    state: &AppState,
    user_id: Uuid,
    epic_id: Uuid,
    query: &ListEpicWorkItemsQuery,
) -> AppResult<WorkItemListResponse> {
    // Verify epic ownership first.
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM epics WHERE id = $1 AND user_id = $2)",
        epic_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound);
    }

    let items: Vec<WorkItemSummary> = if let Some(status) = &query.status {
        let status_str = status.as_str();
        sqlx::query_as!(
            WorkItemSummary,
            r#"
            SELECT
                wi.id,
                wi.epic_id,
                wi.sprint_id,
                wi.type::text        AS "item_type!",
                wi.title,
                wi.status::text      AS "status!",
                wi.priority::text    AS "priority!",
                wi.story_points,
                wi.due_date,
                wi.position,
                COUNT(s.id)                                       AS "subtask_count!",
                COUNT(s.id) FILTER (WHERE s.is_done = true)       AS "done_subtask_count!",
                wi.created_at,
                wi.updated_at
            FROM work_items wi
            LEFT JOIN work_item_subtasks s ON s.work_item_id = wi.id
            WHERE wi.epic_id = $1
              AND wi.user_id = $2
              AND wi.status::text = $3
            GROUP BY wi.id
            ORDER BY wi.position ASC, wi.created_at ASC
            "#,
            epic_id,
            user_id,
            status_str,
        )
        .fetch_all(&state.db)
        .await?
    } else {
        sqlx::query_as!(
            WorkItemSummary,
            r#"
            SELECT
                wi.id,
                wi.epic_id,
                wi.sprint_id,
                wi.type::text        AS "item_type!",
                wi.title,
                wi.status::text      AS "status!",
                wi.priority::text    AS "priority!",
                wi.story_points,
                wi.due_date,
                wi.position,
                COUNT(s.id)                                       AS "subtask_count!",
                COUNT(s.id) FILTER (WHERE s.is_done = true)       AS "done_subtask_count!",
                wi.created_at,
                wi.updated_at
            FROM work_items wi
            LEFT JOIN work_item_subtasks s ON s.work_item_id = wi.id
            WHERE wi.epic_id = $1
              AND wi.user_id = $2
            GROUP BY wi.id
            ORDER BY wi.position ASC, wi.created_at ASC
            "#,
            epic_id,
            user_id,
        )
        .fetch_all(&state.db)
        .await?
    };

    let total = items.len() as i64;

    Ok(WorkItemListResponse { data: items, total })
}
