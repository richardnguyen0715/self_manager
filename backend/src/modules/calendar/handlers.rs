//! Calendar module — Axum request handlers.
//!
//! Every handler is `async fn` returning `AppResult<impl IntoResponse>`.
//! The [`AuthUser`] extractor enforces JWT authentication on all routes;
//! the handler therefore never needs to re-check ownership beyond passing
//! `auth.user_id` to the service layer.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
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
    models::{CreateEventRequest, RangeQuery, UpdateEventRequest},
    service,
};

// ── List (range query) ────────────────────────────────────────────────────────

/// `GET /api/calendar?start=<rfc3339>&end=<rfc3339>`
///
/// Returns all events owned by the authenticated user whose `start_time` falls
/// within `[start, end)`.
pub async fn list_events(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<RangeQuery>,
) -> AppResult<impl IntoResponse> {
    let response =
        service::list_events_in_range(&state, auth.user_id, params.start, params.end).await?;
    Ok(Json(response))
}

// ── Single event ──────────────────────────────────────────────────────────────

/// `GET /api/calendar/:id`
pub async fn get_event(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(event_id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let event = service::get_event_with_types(&state, auth.user_id, event_id).await?;
    Ok(Json(event))
}

// ── Create ────────────────────────────────────────────────────────────────────

/// `POST /api/calendar`
///
/// Returns `201 Created` with the newly created event as JSON.
pub async fn create_event(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreateEventRequest>,
) -> AppResult<impl IntoResponse> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let event = service::create_event(&state, auth.user_id, body).await?;
    Ok((StatusCode::CREATED, Json(event)))
}

// ── Update (partial) ──────────────────────────────────────────────────────────

/// `PATCH /api/calendar/:id`
///
/// Applies a partial update; only supplied JSON fields are written.
pub async fn update_event(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(event_id): Path<Uuid>,
    Json(body): Json<UpdateEventRequest>,
) -> AppResult<impl IntoResponse> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let event = service::update_event(&state, auth.user_id, event_id, body).await?;
    Ok(Json(event))
}

// ── Delete ────────────────────────────────────────────────────────────────────

/// `DELETE /api/calendar/:id`
///
/// Returns `204 No Content` on success.
pub async fn delete_event(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(event_id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    service::delete_event(&state, auth.user_id, event_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
