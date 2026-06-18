//! Axum request handlers for the `retrospective` module.
//!
//! Both routes live under `/api/sprints/:sprint_id/retrospective`:
//!
//! ```text
//! GET  /:sprint_id/retrospective   get_retrospective
//! PUT  /:sprint_id/retrospective   upsert_retrospective
//! ```
//!
//! Handlers are thin: extract inputs, validate when a request body is present,
//! delegate to [`service`], and map to the correct HTTP response.

use axum::{
    extract::{Path, State},
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

use super::{models::UpsertRetrospectiveRequest, service};

// ── GET /api/sprints/:sprint_id/retrospective ─────────────────────────────────

/// Fetch the retrospective for a sprint.
///
/// Returns `404 Not Found` when the sprint does not exist, belongs to a
/// different user, or no retrospective has been created yet for that sprint.
pub async fn get_retrospective(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(sprint_id): Path<Uuid>,
) -> AppResult<Json<super::models::Retrospective>> {
    let retro = service::get_retrospective(&state, auth.user_id, sprint_id).await?;
    Ok(Json(retro))
}

// ── PUT /api/sprints/:sprint_id/retrospective ─────────────────────────────────

/// Upsert the retrospective for a sprint.
///
/// - Creates a new retrospective when none exists yet.
/// - Overwrites the existing retrospective's fields with the supplied values;
///   omitted fields retain their current stored values.
///
/// Returns `200 OK` with the updated (or newly created) retrospective.
pub async fn upsert_retrospective(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(sprint_id): Path<Uuid>,
    Json(body): Json<UpsertRetrospectiveRequest>,
) -> AppResult<(StatusCode, Json<super::models::Retrospective>)> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let retro =
        service::upsert_retrospective(&state, auth.user_id, sprint_id, body).await?;

    // 200 on both create and update; the PUT contract is idempotent.
    Ok((StatusCode::OK, Json(retro)))
}
