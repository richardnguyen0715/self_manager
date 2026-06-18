//! Axum request handlers for the `initiative` module.
//!
//! All routes require a valid `Authorization: Bearer <access-token>` header;
//! the [`AuthUser`] extractor enforces this at the framework level.
//!
//! Handler functions are intentionally thin: they extract inputs, validate
//! request bodies, delegate to [`service`], and convert the result into an
//! appropriate HTTP response.
//!
//! # Endpoint summary
//!
//! | Method   | Path                        | Handler                   |
//! |----------|-----------------------------|---------------------------|
//! | `GET`    | `/`                         | [`list_initiatives`]      |
//! | `POST`   | `/`                         | [`create_initiative`]     |
//! | `GET`    | `/:id`                      | [`get_initiative`]        |
//! | `PATCH`  | `/:id`                      | [`update_initiative`]     |
//! | `DELETE` | `/:id`                      | [`delete_initiative`]     |
//! | `GET`    | `/:id/epics`                | [`list_initiative_epics`] |

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
        CreateInitiativeRequest, EpicListResponse, InitiativeListResponse, InitiativeResponse,
        ListInitiativesQuery, UpdateInitiativeRequest,
    },
    service,
};

// ── GET /api/initiatives ────────────────────────────────────────────────────────

/// List all initiatives for the authenticated user.
///
/// Supports optional `?goal_id=<uuid>`, `?status=active|completed|paused|abandoned`,
/// `?limit=50`, and `?offset=0` query parameters.
///
/// Returns `{ data: Initiative[], total }`.
pub async fn list_initiatives(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ListInitiativesQuery>,
) -> AppResult<Json<InitiativeListResponse>> {
    let list = service::list_initiatives(&state, auth.user_id, &query).await?;
    Ok(Json(list))
}

// ── POST /api/initiatives ───────────────────────────────────────────────────────

/// Create a new initiative for the authenticated user.
///
/// The `goal_id` in the request body must reference a goal that belongs to the
/// same user; otherwise `404 Not Found` is returned.
///
/// Returns `201 Created` with the created initiative as a flat object.
pub async fn create_initiative(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreateInitiativeRequest>,
) -> AppResult<(StatusCode, Json<InitiativeResponse>)> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let initiative = service::create_initiative(&state, auth.user_id, body).await?;
    Ok((StatusCode::CREATED, Json(initiative)))
}

// ── GET /api/initiatives/:id ────────────────────────────────────────────────────

/// Fetch a single initiative by its UUID.
///
/// Returns `404 Not Found` when the initiative does not exist or belongs to a
/// different user.
pub async fn get_initiative(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(initiative_id): Path<Uuid>,
) -> AppResult<Json<InitiativeResponse>> {
    let initiative = service::get_initiative(&state, auth.user_id, initiative_id).await?;
    Ok(Json(initiative))
}

// ── PATCH /api/initiatives/:id ──────────────────────────────────────────────────

/// Partially update an initiative.
///
/// Only fields present in the JSON body are modified; absent fields retain
/// their current values.
///
/// When `goal_id` is updated, the new goal must also be owned by the requesting
/// user; otherwise `404 Not Found` is returned.
pub async fn update_initiative(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(initiative_id): Path<Uuid>,
    Json(body): Json<UpdateInitiativeRequest>,
) -> AppResult<Json<InitiativeResponse>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let initiative =
        service::update_initiative(&state, auth.user_id, initiative_id, body).await?;
    Ok(Json(initiative))
}

// ── DELETE /api/initiatives/:id ─────────────────────────────────────────────────

/// Delete an initiative by its UUID.
///
/// Returns `204 No Content` on success. Epics linked to this initiative are
/// removed by the database `ON DELETE CASCADE` constraint.
pub async fn delete_initiative(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(initiative_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::delete_initiative(&state, auth.user_id, initiative_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── GET /api/initiatives/:id/epics ─────────────────────────────────────────────

/// List all epics that belong to an initiative.
///
/// Returns `{ data: Epic[], total }`.
///
/// Returns `404 Not Found` when the initiative does not exist or belongs to a
/// different user.
pub async fn list_initiative_epics(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(initiative_id): Path<Uuid>,
) -> AppResult<Json<EpicListResponse>> {
    let epics = service::list_initiative_epics(&state, auth.user_id, initiative_id).await?;
    Ok(Json(epics))
}
