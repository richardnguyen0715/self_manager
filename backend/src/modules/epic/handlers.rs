//! Axum request handlers for the `epic` module.
//!
//! All routes require a valid `Authorization: Bearer <access-token>` header;
//! the [`AuthUser`] extractor enforces this at the framework level.
//!
//! Handler functions are thin: they extract inputs, delegate to [`service`],
//! and convert the result into an appropriate HTTP response.

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
        CreateEpicRequest, EpicListResponse, EpicResponse, ListEpicWorkItemsQuery, ListEpicsQuery,
        UpdateEpicRequest, WorkItemListResponse,
    },
    service,
};

// ── GET /api/epics ─────────────────────────────────────────────────────────────

/// List all epics for the authenticated user.
///
/// Supports optional `?initiative_id=<uuid>`, `?status=todo|in_progress|done|cancelled`,
/// `?limit=50`, and `?offset=0` query parameters.
pub async fn list_epics(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ListEpicsQuery>,
) -> AppResult<Json<EpicListResponse>> {
    let list = service::list_epics(&state, auth.user_id, &query).await?;
    Ok(Json(list))
}

// ── POST /api/epics ────────────────────────────────────────────────────────────

/// Create a new epic for the authenticated user.
///
/// Returns `201 Created` with the created epic body, including zeroed progress
/// rollup (no work items yet).
pub async fn create_epic(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreateEpicRequest>,
) -> AppResult<(StatusCode, Json<EpicResponse>)> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let epic = service::create_epic(&state, auth.user_id, body).await?;
    Ok((StatusCode::CREATED, Json(epic)))
}

// ── GET /api/epics/:id ─────────────────────────────────────────────────────────

/// Fetch a single epic by its UUID.
///
/// The response includes derived `progress`, `total_points`, and `done_points`
/// fields computed from the epic's child work items.
///
/// Returns `404 Not Found` when the epic does not exist or belongs to a
/// different user.
pub async fn get_epic(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(epic_id): Path<Uuid>,
) -> AppResult<Json<EpicResponse>> {
    let epic = service::get_epic(&state, auth.user_id, epic_id).await?;
    Ok(Json(epic))
}

// ── PATCH /api/epics/:id ───────────────────────────────────────────────────────

/// Partially update an epic.
///
/// Only fields present in the JSON body are modified; absent fields retain
/// their current values.
///
/// If `initiative_id` is provided the epic is re-parented; the new initiative
/// must also belong to the authenticated user.
pub async fn update_epic(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(epic_id): Path<Uuid>,
    Json(body): Json<UpdateEpicRequest>,
) -> AppResult<Json<EpicResponse>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let epic = service::update_epic(&state, auth.user_id, epic_id, body).await?;
    Ok(Json(epic))
}

// ── DELETE /api/epics/:id ──────────────────────────────────────────────────────

/// Delete an epic by its UUID.
///
/// Returns `204 No Content` on success. Work items under this epic will have
/// their `epic_id` set to `NULL` by the database `ON DELETE SET NULL` rule.
pub async fn delete_epic(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(epic_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::delete_epic(&state, auth.user_id, epic_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── GET /api/epics/:id/work-items ─────────────────────────────────────────────

/// List all work items that belong to an epic.
///
/// Supports optional `?status=<work_item_status>` filter.
///
/// Returns `404 Not Found` when the epic does not exist or belongs to a
/// different user.
pub async fn list_epic_work_items(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(epic_id): Path<Uuid>,
    Query(query): Query<ListEpicWorkItemsQuery>,
) -> AppResult<Json<WorkItemListResponse>> {
    let list =
        service::list_epic_work_items(&state, auth.user_id, epic_id, &query).await?;
    Ok(Json(list))
}
