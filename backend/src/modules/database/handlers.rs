//! Axum request handlers for the `database` module.
//!
//! All routes require `Authorization: Bearer <access-token>` — `AuthUser` is
//! extracted as the first handler parameter.
//!
//! Handlers are thin: extract → validate → delegate to [`service`] → respond.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    extractors::AuthUser,
    state::AppState,
};

use super::{
    models::{
        BatchUpdateRowsRequest, CreateColumnRequest, CreateDatabaseRequest, CreateRowRequest,
        CreateViewRequest, Database, DatabaseColumn, DatabaseDetail, DatabaseRow, DatabaseView,
        ListDatabasesQuery, UpdateColumnRequest, UpdateDatabaseRequest, UpdateRowRequest,
        UpdateViewRequest, ViewRowsResponse,
    },
    service,
};

// ── GET /api/databases?space_id=<uuid> ───────────────────────────────────────

/// Return all databases in a space owned by the authenticated user.
pub async fn list_databases(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ListDatabasesQuery>,
) -> AppResult<Json<Vec<Database>>> {
    let dbs = service::list_databases(&state, auth.user_id, query.space_id).await?;
    Ok(Json(dbs))
}

// ── POST /api/databases ───────────────────────────────────────────────────────

/// Create a new database.
///
/// Seeds one "Name" text column and one default table view. Returns `201 Created`.
pub async fn create_database(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreateDatabaseRequest>,
) -> AppResult<(StatusCode, Json<Database>)> {
    let db = service::create_database(&state, auth.user_id, body).await?;
    Ok((StatusCode::CREATED, Json(db)))
}

// ── GET /api/databases/:id ────────────────────────────────────────────────────

/// Fetch a database with its columns and views.
pub async fn get_database(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(db_id): Path<Uuid>,
) -> AppResult<Json<DatabaseDetail>> {
    let detail = service::get_database(&state, auth.user_id, db_id).await?;
    Ok(Json(detail))
}

// ── PATCH /api/databases/:id ──────────────────────────────────────────────────

/// Partially update a database's title and/or icon.
pub async fn update_database(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(db_id): Path<Uuid>,
    Json(body): Json<UpdateDatabaseRequest>,
) -> AppResult<Json<Database>> {
    let db = service::update_database(&state, auth.user_id, db_id, body).await?;
    Ok(Json(db))
}

// ── DELETE /api/databases/:id ─────────────────────────────────────────────────

/// Delete a database (cascades columns, rows, views). Returns `204 No Content`.
pub async fn delete_database(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(db_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::delete_database(&state, auth.user_id, db_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── GET /api/databases/:id/columns ───────────────────────────────────────────

/// Return all columns for a database, ordered by position.
pub async fn list_columns(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(db_id): Path<Uuid>,
) -> AppResult<Json<Vec<DatabaseColumn>>> {
    let cols = service::list_columns(&state, auth.user_id, db_id).await?;
    Ok(Json(cols))
}

// ── POST /api/databases/:id/columns ──────────────────────────────────────────

/// Create a new column on a database. Returns `201 Created`.
pub async fn create_column(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(db_id): Path<Uuid>,
    Json(body): Json<CreateColumnRequest>,
) -> AppResult<(StatusCode, Json<DatabaseColumn>)> {
    let col = service::create_column(&state, auth.user_id, db_id, body).await?;
    Ok((StatusCode::CREATED, Json(col)))
}

// ── PATCH /api/databases/:id/columns/:col_id ─────────────────────────────────

/// Partially update a column (name, type, options, position).
pub async fn update_column(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((db_id, col_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateColumnRequest>,
) -> AppResult<Json<DatabaseColumn>> {
    let col = service::update_column(&state, auth.user_id, db_id, col_id, body).await?;
    Ok(Json(col))
}

// ── DELETE /api/databases/:id/columns/:col_id ─────────────────────────────────

/// Delete a column; strips its key from every row's `values`. Returns `204`.
pub async fn delete_column(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((db_id, col_id)): Path<(Uuid, Uuid)>,
) -> AppResult<StatusCode> {
    service::delete_column(&state, auth.user_id, db_id, col_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── GET /api/databases/:id/rows ───────────────────────────────────────────────

/// Return all rows in position order (raw, no filtering).
pub async fn list_rows(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(db_id): Path<Uuid>,
) -> AppResult<Json<Vec<DatabaseRow>>> {
    let rows = service::list_rows(&state, auth.user_id, db_id).await?;
    Ok(Json(rows))
}

// ── POST /api/databases/:id/rows ──────────────────────────────────────────────

/// Create a new row. Returns `201 Created`.
pub async fn create_row(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(db_id): Path<Uuid>,
    Json(body): Json<CreateRowRequest>,
) -> AppResult<(StatusCode, Json<DatabaseRow>)> {
    let row = service::create_row(&state, auth.user_id, db_id, body).await?;
    Ok((StatusCode::CREATED, Json(row)))
}

// ── PATCH /api/databases/:id/rows/:row_id ────────────────────────────────────

/// Partially update a row (shallow-merge values, optionally reposition).
pub async fn update_row(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((db_id, row_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateRowRequest>,
) -> AppResult<Json<DatabaseRow>> {
    let row = service::update_row(&state, auth.user_id, db_id, row_id, body).await?;
    Ok(Json(row))
}

// ── PATCH /api/databases/:id/rows (batch) ────────────────────────────────────

/// Batch-update multiple rows' values (Board drag-to-regroup).
pub async fn batch_update_rows(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(db_id): Path<Uuid>,
    Json(body): Json<BatchUpdateRowsRequest>,
) -> AppResult<Json<Vec<DatabaseRow>>> {
    // Guard: reject empty batch early.
    if body.updates.is_empty() {
        return Err(AppError::Validation(
            "updates array must not be empty".to_owned(),
        ));
    }
    let rows = service::batch_update_rows(&state, auth.user_id, db_id, body).await?;
    Ok(Json(rows))
}

// ── DELETE /api/databases/:id/rows/:row_id ───────────────────────────────────

/// Delete a row. Returns `204 No Content`.
pub async fn delete_row(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((db_id, row_id)): Path<(Uuid, Uuid)>,
) -> AppResult<StatusCode> {
    service::delete_row(&state, auth.user_id, db_id, row_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── GET /api/databases/:id/views ─────────────────────────────────────────────

/// Return all views for a database in position order.
pub async fn list_views(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(db_id): Path<Uuid>,
) -> AppResult<Json<Vec<DatabaseView>>> {
    let views = service::list_views(&state, auth.user_id, db_id).await?;
    Ok(Json(views))
}

// ── POST /api/databases/:id/views ────────────────────────────────────────────

/// Create a new view. Returns `201 Created`.
pub async fn create_view(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(db_id): Path<Uuid>,
    Json(body): Json<CreateViewRequest>,
) -> AppResult<(StatusCode, Json<DatabaseView>)> {
    let view = service::create_view(&state, auth.user_id, db_id, body).await?;
    Ok((StatusCode::CREATED, Json(view)))
}

// ── PATCH /api/databases/:id/views/:view_id ──────────────────────────────────

/// Partially update a view (name, config, position).
pub async fn update_view(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((db_id, view_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateViewRequest>,
) -> AppResult<Json<DatabaseView>> {
    let view = service::update_view(&state, auth.user_id, db_id, view_id, body).await?;
    Ok(Json(view))
}

// ── DELETE /api/databases/:id/views/:view_id ─────────────────────────────────

/// Delete a view. Returns `204 No Content`.
pub async fn delete_view(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((db_id, view_id)): Path<(Uuid, Uuid)>,
) -> AppResult<StatusCode> {
    service::delete_view(&state, auth.user_id, db_id, view_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── GET /api/databases/:id/views/:view_id/rows ───────────────────────────────

/// Return rows for a view, applying stored filters/sorts server-side.
///
/// Table view → `{ rows: [...] }`.
/// Board view → `{ groups: [{ option_id, option_name, rows }] }`.
pub async fn get_view_rows(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((db_id, view_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<ViewRowsResponse>> {
    let resp = service::get_view_rows(&state, auth.user_id, db_id, view_id).await?;
    Ok(Json(resp))
}
