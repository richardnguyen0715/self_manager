//! Axum request handlers for the `board_column` module.
//!
//! All routes require a valid `Authorization: Bearer <access-token>` header;
//! the [`AuthUser`] extractor enforces this at the framework level.
//!
//! Handlers are thin: extract → validate → delegate to [`service`] → respond.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;
use validator::Validate;

use crate::shared::{
    error::{AppError, AppResult},
    extractors::AuthUser,
    state::AppState,
};

use super::{
    models::{
        BoardColumn, CreateBoardColumnRequest, ListBoardColumnsQuery,
        ReorderBoardColumnsRequest, UpdateBoardColumnRequest,
    },
    service,
};

// ── GET /api/board-columns ────────────────────────────────────────────────────

/// List board columns for the authenticated user, optionally scoped to a project.
///
/// If no columns exist for the requested scope, the five default columns are
/// seeded lazily and existing work items are backfilled before the response
/// is returned.
pub async fn list_board_columns(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ListBoardColumnsQuery>,
) -> AppResult<Json<Vec<BoardColumn>>> {
    let columns = service::list_board_columns(&state, auth.user_id, &query).await?;
    Ok(Json(columns))
}

// ── POST /api/board-columns ───────────────────────────────────────────────────

/// Create a new custom board column.
///
/// Returns `201 Created` with the new column appended at the end of the scope.
pub async fn create_board_column(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreateBoardColumnRequest>,
) -> AppResult<(StatusCode, Json<BoardColumn>)> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let col = service::create_board_column(&state, auth.user_id, body).await?;
    Ok((StatusCode::CREATED, Json(col)))
}

// ── PATCH /api/board-columns/:id ─────────────────────────────────────────────

/// Partially update a board column's name, color, or wip_limit.
///
/// Returns `404 Not Found` when the column does not exist or belongs to
/// a different user.
pub async fn update_board_column(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(column_id): Path<Uuid>,
    Json(body): Json<UpdateBoardColumnRequest>,
) -> AppResult<Json<BoardColumn>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let col = service::update_board_column(&state, auth.user_id, column_id, body).await?;
    Ok(Json(col))
}

// ── DELETE /api/board-columns/:id ────────────────────────────────────────────

/// Delete a board column.
///
/// Work items in the deleted column are moved to the next remaining column
/// (lowest position). If this was the last column, their `column_id` is
/// cleared to `NULL`.
///
/// Returns `204 No Content` on success.
pub async fn delete_board_column(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(column_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::delete_board_column(&state, auth.user_id, column_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── PUT /api/board-columns/reorder ───────────────────────────────────────────

/// Reorder columns by assigning `position = array_index` for each supplied ID.
///
/// The body must contain all column IDs in the desired order.
/// Returns `422` if any ID does not belong to the authenticated user.
/// Returns `204 No Content` on success.
pub async fn reorder_board_columns(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<ReorderBoardColumnsRequest>,
) -> AppResult<StatusCode> {
    service::reorder_board_columns(&state, auth.user_id, body).await?;
    Ok(StatusCode::NO_CONTENT)
}
