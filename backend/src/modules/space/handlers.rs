//! Axum request handlers for the `space` module.
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
    models::{CreateSpaceRequest, ListSpacesQuery, Space, UpdateSpaceRequest},
    service,
};

// ── GET /api/spaces ────────────────────────────────────────────────────────────

/// List all spaces for the authenticated user.
///
/// Accepts an optional `?project_id=<uuid>` query parameter to filter by
/// project association.  Without the parameter all spaces are returned.
///
/// # Responses
///
/// - `200 OK` — JSON array of [`Space`] objects (may be empty).
/// - `401 Unauthorized` — missing or invalid bearer token.
pub async fn list_spaces(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ListSpacesQuery>,
) -> AppResult<Json<Vec<Space>>> {
    let spaces = service::list_spaces(&state, auth.user_id, &query).await?;
    Ok(Json(spaces))
}

// ── POST /api/spaces ───────────────────────────────────────────────────────────

/// Create a new space owned by the authenticated user.
///
/// # Body (`application/json`)
///
/// | Field        | Type     | Required | Notes                         |
/// |--------------|----------|----------|-------------------------------|
/// | `name`       | `string` | yes      | 1–200 characters              |
/// | `icon`       | `string` | no       | emoji glyph, e.g. `"📘"`     |
/// | `description`| `string` | no       |                               |
/// | `project_id` | `uuid`   | no       | `null` = personal space       |
///
/// # Responses
///
/// - `201 Created` — full [`Space`] JSON.
/// - `422 Unprocessable Entity` — validation failure.
pub async fn create_space(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreateSpaceRequest>,
) -> AppResult<(StatusCode, Json<Space>)> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let space = service::create_space(&state, auth.user_id, body).await?;
    Ok((StatusCode::CREATED, Json(space)))
}

// ── GET /api/spaces/:id ────────────────────────────────────────────────────────

/// Fetch a single space by UUID.
///
/// Returns `404 Not Found` when the space does not exist or belongs to a
/// different user.
pub async fn get_space(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(space_id): Path<Uuid>,
) -> AppResult<Json<Space>> {
    let space = service::get_space(&state, auth.user_id, space_id).await?;
    Ok(Json(space))
}

// ── PATCH /api/spaces/:id ─────────────────────────────────────────────────────

/// Partially update a space.
///
/// Only fields present in the JSON body are modified.  Nullable fields
/// (`icon`, `description`, `project_id`) can be set to `null` explicitly to
/// clear them, or omitted entirely to leave them unchanged.
///
/// # Responses
///
/// - `200 OK` — full updated [`Space`] JSON.
/// - `404 Not Found` — space absent or owned by another user.
/// - `422 Unprocessable Entity` — validation failure.
pub async fn update_space(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(space_id): Path<Uuid>,
    Json(body): Json<UpdateSpaceRequest>,
) -> AppResult<Json<Space>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let space = service::update_space(&state, auth.user_id, space_id, body).await?;
    Ok(Json(space))
}

// ── DELETE /api/spaces/:id ────────────────────────────────────────────────────

/// Delete a space by UUID.
///
/// Cascade rules in the database automatically remove all child pages, page
/// versions, and page comments.
///
/// # Responses
///
/// - `204 No Content` — deletion succeeded.
/// - `404 Not Found` — space absent or owned by another user.
pub async fn delete_space(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(space_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::delete_space(&state, auth.user_id, space_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
