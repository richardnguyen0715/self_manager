//! Axum request handlers for the `timeblock` module.
//!
//! Every handler that mutates or reads user data requires a valid
//! [`AuthUser`] extractor. Handlers are intentionally thin — they extract
//! inputs, delegate to the service layer, and return JSON.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;
use validator::Validate as _;

use crate::shared::{
    error::{AppError, AppResult},
    extractors::AuthUser,
    state::AppState,
};

use super::{
    models::{
        CreateTimeBlockRequest, FinishFocusSessionRequest, ListTimeBlocksQuery,
        StartFocusSessionRequest, UpdateTimeBlockRequest,
    },
    service,
};

// ── Time block handlers ────────────────────────────────────────────────────────

/// `POST /api/timeblocks`
///
/// Create a new time block for the authenticated user.
pub async fn create_time_block(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreateTimeBlockRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let block = service::create_time_block(&state, auth.user_id, body).await?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "data": block })),
    ))
}

/// `GET /api/timeblocks`
///
/// List time blocks for the authenticated user with optional date-range and
/// task filters.
pub async fn list_time_blocks(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ListTimeBlocksQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let list = service::list_time_blocks(&state, auth.user_id, query).await?;

    Ok(Json(serde_json::json!({ "data": list })))
}

/// `GET /api/timeblocks/:id`
///
/// Fetch a single time block by id.
pub async fn get_time_block(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(block_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let block = service::get_time_block(&state, auth.user_id, block_id).await?;

    Ok(Json(serde_json::json!({ "data": block })))
}

/// `PATCH /api/timeblocks/:id`
///
/// Partially update a time block. Only provided fields are modified.
pub async fn update_time_block(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(block_id): Path<Uuid>,
    Json(body): Json<UpdateTimeBlockRequest>,
) -> AppResult<Json<serde_json::Value>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let block = service::update_time_block(&state, auth.user_id, block_id, body).await?;

    Ok(Json(serde_json::json!({ "data": block })))
}

/// `DELETE /api/timeblocks/:id`
///
/// Delete a time block owned by the authenticated user.
pub async fn delete_time_block(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(block_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::delete_time_block(&state, auth.user_id, block_id).await?;

    Ok(StatusCode::NO_CONTENT)
}

// ── Focus session handlers ─────────────────────────────────────────────────────

/// `GET /api/timeblocks/:id/focus-sessions`
///
/// List all focus sessions for a time block, newest first.
pub async fn list_focus_sessions(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(block_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let sessions = service::list_focus_sessions(&state, auth.user_id, block_id).await?;

    Ok(Json(serde_json::json!({ "data": sessions })))
}

/// `POST /api/timeblocks/:id/focus-sessions`
///
/// Start a new focus session linked to the given time block.
pub async fn start_focus_session(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(block_id): Path<Uuid>,
    Json(body): Json<StartFocusSessionRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let session = service::start_focus_session(&state, auth.user_id, block_id, body).await?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "data": session })),
    ))
}

/// `PATCH /api/timeblocks/:block_id/focus-sessions/:session_id/pause`
///
/// Pause an active (non-ended, non-paused) focus session.
pub async fn pause_focus_session(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((block_id, session_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let session = service::pause_focus_session(&state, auth.user_id, block_id, session_id).await?;

    Ok(Json(serde_json::json!({ "data": session })))
}

/// `PATCH /api/timeblocks/:block_id/focus-sessions/:session_id/resume`
///
/// Resume a paused focus session.
pub async fn resume_focus_session(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((block_id, session_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let session = service::resume_focus_session(&state, auth.user_id, block_id, session_id).await?;

    Ok(Json(serde_json::json!({ "data": session })))
}

/// `PATCH /api/timeblocks/:block_id/focus-sessions/:session_id/finish`
///
/// Finish a focus session. Records actual duration and emits
/// [`DomainEvent::TimeBlockFinished`].
pub async fn finish_focus_session(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((block_id, session_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<FinishFocusSessionRequest>,
) -> AppResult<Json<serde_json::Value>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let session =
        service::finish_focus_session(&state, auth.user_id, block_id, session_id, body).await?;

    Ok(Json(serde_json::json!({ "data": session })))
}
