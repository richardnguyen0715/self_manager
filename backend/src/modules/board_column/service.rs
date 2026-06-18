//! Business logic for the `board_column` module.
//!
//! All public functions accept a reference to [`AppState`] and execute SQL
//! via `sqlx::query!` / `sqlx::query_as!` (compile-time checked).
//!
//! ## Lazy seeding
//!
//! When `list_board_columns` finds zero columns for a `(user_id, project_id)`
//! scope it inserts the five default columns in order:
//!
//! | Name        | mapped_status | color   |
//! |-------------|---------------|---------|
//! | Backlog     | backlog       | #94a3b8 |
//! | To Do       | todo          | #8b5cf6 |
//! | In Progress | in_progress   | #0ea5e9 |
//! | In Review   | review        | #f59e0b |
//! | Done        | done          | #10b981 |
//!
//! After seeding, any work items in the same scope with `column_id IS NULL`
//! are backfilled: their `column_id` is set to the seeded column whose
//! `mapped_status` matches the item's `status`.
//!
//! ## Enum-as-text pattern
//!
//! - SELECT: `col::text AS "col?"` (nullable) or `col::text AS "col!"`
//! - Filter: `col::text = $n`
//! - Bind:   `($n::text)::work_item_status`

use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    state::AppState,
};

use super::models::{
    BoardColumn, CreateBoardColumnRequest, ListBoardColumnsQuery, ReorderBoardColumnsRequest,
    UpdateBoardColumnRequest,
};

// ── Default column seed data ───────────────────────────────────────────────────

struct DefaultColumn {
    name: &'static str,
    color: &'static str,
    mapped_status: &'static str,
    position: i32,
}

const DEFAULT_COLUMNS: &[DefaultColumn] = &[
    DefaultColumn { name: "Backlog",     color: "#94a3b8", mapped_status: "backlog",     position: 0 },
    DefaultColumn { name: "To Do",       color: "#8b5cf6", mapped_status: "todo",        position: 1 },
    DefaultColumn { name: "In Progress", color: "#0ea5e9", mapped_status: "in_progress", position: 2 },
    DefaultColumn { name: "In Review",   color: "#f59e0b", mapped_status: "review",      position: 3 },
    DefaultColumn { name: "Done",        color: "#10b981", mapped_status: "done",        position: 4 },
];

// ── List + lazy seed ───────────────────────────────────────────────────────────

/// Return all board columns for the given `(user_id, project_id)` scope,
/// ordered by position.
///
/// If no columns exist yet, the five default columns are seeded and existing
/// work items are backfilled with the matching `column_id`.
///
/// # Errors
///
/// Returns [`AppError::Db`] on database failure.
pub async fn list_board_columns(
    state: &AppState,
    user_id: Uuid,
    query: &ListBoardColumnsQuery,
) -> AppResult<Vec<BoardColumn>> {
    let project_id = query.project_id;

    // Check whether columns already exist for this scope.
    let count: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)
        FROM board_columns
        WHERE user_id = $1
          AND ($2::uuid IS NULL AND project_id IS NULL
               OR project_id = $2)
        "#,
        user_id,
        project_id as Option<Uuid>,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    if count == 0 {
        seed_defaults(state, user_id, project_id).await?;
        backfill_items(state, user_id, project_id).await?;
    }

    let columns = sqlx::query_as!(
        BoardColumn,
        r#"
        SELECT
            id,
            user_id,
            project_id,
            name,
            color,
            position,
            wip_limit,
            mapped_status::text AS "mapped_status?",
            created_at,
            updated_at
        FROM board_columns
        WHERE user_id = $1
          AND ($2::uuid IS NULL AND project_id IS NULL
               OR project_id = $2)
        ORDER BY position ASC, created_at ASC
        "#,
        user_id,
        project_id as Option<Uuid>,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(columns)
}

/// Insert the five default columns for a `(user_id, project_id)` scope.
async fn seed_defaults(
    state: &AppState,
    user_id: Uuid,
    project_id: Option<Uuid>,
) -> AppResult<()> {
    for col in DEFAULT_COLUMNS {
        sqlx::query!(
            r#"
            INSERT INTO board_columns (user_id, project_id, name, color, position, mapped_status)
            VALUES ($1, $2, $3, $4, $5, ($6::text)::work_item_status)
            "#,
            user_id,
            project_id as Option<Uuid>,
            col.name,
            col.color,
            col.position,
            col.mapped_status,
        )
        .execute(&state.db)
        .await?;
    }

    Ok(())
}

/// Backfill `work_items.column_id` for items without a column assignment.
///
/// Matches each item's `status` to the seeded column's `mapped_status`.
/// Only items in the correct scope are updated (same `user_id`; `project_id`
/// match when a project filter is active, otherwise all of the user's items).
async fn backfill_items(
    state: &AppState,
    user_id: Uuid,
    project_id: Option<Uuid>,
) -> AppResult<()> {
    sqlx::query!(
        r#"
        UPDATE work_items wi
        SET column_id  = bc.id,
            updated_at = now()
        FROM board_columns bc
        WHERE wi.user_id     = $1
          AND wi.column_id   IS NULL
          AND bc.user_id     = $1
          AND bc.mapped_status IS NOT NULL
          AND bc.mapped_status = wi.status
          AND (
              $2::uuid IS NULL AND bc.project_id IS NULL AND wi.project_id IS NULL
              OR bc.project_id = $2 AND wi.project_id = $2
          )
        "#,
        user_id,
        project_id as Option<Uuid>,
    )
    .execute(&state.db)
    .await?;

    Ok(())
}

// ── Create ─────────────────────────────────────────────────────────────────────

/// Create a new custom board column.
///
/// The column is appended after any existing columns in the same scope
/// (`position = MAX(position) + 1`). `mapped_status` is always `NULL` for
/// user-created columns.
///
/// # Errors
///
/// - [`AppError::Validation`] — name too long.
/// - [`AppError::Db`] — database failure.
pub async fn create_board_column(
    state: &AppState,
    user_id: Uuid,
    req: CreateBoardColumnRequest,
) -> AppResult<BoardColumn> {
    let project_id = req.project_id;

    // Next position = max(position) + 1 in this scope.
    let next_position: i32 = sqlx::query_scalar!(
        r#"
        SELECT COALESCE(MAX(position), -1) + 1
        FROM board_columns
        WHERE user_id = $1
          AND ($2::uuid IS NULL AND project_id IS NULL
               OR project_id = $2)
        "#,
        user_id,
        project_id as Option<Uuid>,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    let col = sqlx::query_as!(
        BoardColumn,
        r#"
        INSERT INTO board_columns (user_id, project_id, name, color, position, wip_limit)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
            id, user_id, project_id, name, color, position, wip_limit,
            mapped_status::text AS "mapped_status?",
            created_at, updated_at
        "#,
        user_id,
        project_id as Option<Uuid>,
        req.name,
        req.color,
        next_position,
        req.wip_limit,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(col)
}

// ── Update ─────────────────────────────────────────────────────────────────────

/// Partially update a board column's name, color, or wip_limit.
///
/// Only non-`None` fields are modified; `mapped_status` and `project_id` are
/// never changed through this endpoint.
///
/// # Errors
///
/// - [`AppError::NotFound`] — column not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn update_board_column(
    state: &AppState,
    user_id: Uuid,
    column_id: Uuid,
    req: UpdateBoardColumnRequest,
) -> AppResult<BoardColumn> {
    // Fetch current row for coalescing.
    let current = sqlx::query_as!(
        BoardColumn,
        r#"
        SELECT
            id, user_id, project_id, name, color, position, wip_limit,
            mapped_status::text AS "mapped_status?",
            created_at, updated_at
        FROM board_columns
        WHERE id = $1 AND user_id = $2
        "#,
        column_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let new_name = req.name.unwrap_or(current.name);
    let new_color = if req.color.is_some() {
        req.color
    } else {
        current.color
    };
    let new_wip_limit = if req.wip_limit.is_some() {
        req.wip_limit
    } else {
        current.wip_limit
    };

    let updated = sqlx::query_as!(
        BoardColumn,
        r#"
        UPDATE board_columns
        SET name       = $3,
            color      = $4,
            wip_limit  = $5,
            updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING
            id, user_id, project_id, name, color, position, wip_limit,
            mapped_status::text AS "mapped_status?",
            created_at, updated_at
        "#,
        column_id,
        user_id,
        new_name,
        new_color,
        new_wip_limit,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(updated)
}

// ── Delete ─────────────────────────────────────────────────────────────────────

/// Delete a board column, enforcing ownership.
///
/// Before deletion, all work items assigned to this column have their
/// `column_id` reassigned to the column with the lowest position in the same
/// scope. If this is the last column in the scope, `column_id` is set to
/// `NULL` on those items.
///
/// # Errors
///
/// - [`AppError::NotFound`] — column not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn delete_board_column(
    state: &AppState,
    user_id: Uuid,
    column_id: Uuid,
) -> AppResult<()> {
    // Fetch the column to obtain its scope (project_id).
    let col = sqlx::query!(
        r#"
        SELECT project_id
        FROM board_columns
        WHERE id = $1 AND user_id = $2
        "#,
        column_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let project_id = col.project_id;

    // Find the first remaining column in the scope (excluding this one).
    let fallback_id: Option<Uuid> = sqlx::query_scalar!(
        r#"
        SELECT id
        FROM board_columns
        WHERE user_id  = $1
          AND id      != $2
          AND ($3::uuid IS NULL AND project_id IS NULL
               OR project_id = $3)
        ORDER BY position ASC, created_at ASC
        LIMIT 1
        "#,
        user_id,
        column_id,
        project_id as Option<Uuid>,
    )
    .fetch_optional(&state.db)
    .await?;

    // Reassign (or clear) work items in this column.
    sqlx::query!(
        r#"
        UPDATE work_items
        SET column_id  = $3,
            updated_at = now()
        WHERE column_id = $1
          AND user_id   = $2
        "#,
        column_id,
        user_id,
        fallback_id as Option<Uuid>,
    )
    .execute(&state.db)
    .await?;

    // Delete the column.
    let result = sqlx::query!(
        "DELETE FROM board_columns WHERE id = $1 AND user_id = $2",
        column_id,
        user_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}

// ── Reorder ────────────────────────────────────────────────────────────────────

/// Set `position = array_index` for each column id in `req.ids`.
///
/// Validates that every supplied ID belongs to the authenticated user.
/// Returns a validation error if any ID is not owned by the user.
///
/// # Errors
///
/// - [`AppError::Validation`] — an ID does not belong to the user.
/// - [`AppError::Db`] — database failure.
pub async fn reorder_board_columns(
    state: &AppState,
    user_id: Uuid,
    req: ReorderBoardColumnsRequest,
) -> AppResult<()> {
    if req.ids.is_empty() {
        return Ok(());
    }

    // Validate ownership of every supplied column ID.
    let owned_count: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)
        FROM board_columns
        WHERE user_id = $1
          AND id = ANY($2)
        "#,
        user_id,
        &req.ids as &[Uuid],
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    if owned_count != req.ids.len() as i64 {
        return Err(AppError::Validation(
            "one or more column IDs do not belong to the user".to_owned(),
        ));
    }

    // Update positions in order.
    for (idx, &col_id) in req.ids.iter().enumerate() {
        sqlx::query!(
            r#"
            UPDATE board_columns
            SET position   = $3,
                updated_at = now()
            WHERE id = $1 AND user_id = $2
            "#,
            col_id,
            user_id,
            idx as i32,
        )
        .execute(&state.db)
        .await?;
    }

    Ok(())
}
