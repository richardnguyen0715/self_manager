//! Axum request handlers for the `review` module.
//!
//! All routes require a valid `Authorization: Bearer <access-token>` header;
//! the [`AuthUser`] extractor enforces this at the framework level.
//!
//! Handlers are thin: they extract inputs, delegate to [`service`], and convert
//! the result into the appropriate HTTP response.

use axum::{
    extract::{Path, State},
    Json,
};
use uuid::Uuid;
use validator::Validate;

use crate::shared::{
    error::{AppError, AppResult},
    extractors::AuthUser,
    state::AppState,
};

use super::{models::UpsertReviewRequest, service};

// ── GET /api/sprints/:id/review ────────────────────────────────────────────────

/// Fetch the sprint review for the given sprint.
///
/// Returns `404 Not Found` when:
/// - The sprint does not exist or belongs to a different user.
/// - No review has been created yet for this sprint.
pub async fn get_review(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(sprint_id): Path<Uuid>,
) -> AppResult<Json<super::models::SprintReviewResponse>> {
    let review = service::get_review(&state, auth.user_id, sprint_id).await?;
    Ok(Json(review))
}

// ── PUT /api/sprints/:id/review ────────────────────────────────────────────────

/// Upsert the sprint review for the given sprint.
///
/// Creates the review if it does not yet exist, or updates it if it does.
///
/// On creation, `planned_points` defaults to the sum of story points of all
/// work items assigned to the sprint; `completed_points` defaults to the
/// sprint's `completed_points` column.
///
/// On update, only fields present in the JSON body are modified; absent fields
/// retain their current values.
///
/// Returns the upserted review.
pub async fn upsert_review(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(sprint_id): Path<Uuid>,
    Json(body): Json<UpsertReviewRequest>,
) -> AppResult<Json<super::models::SprintReviewResponse>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let review = service::upsert_review(&state, auth.user_id, sprint_id, body).await?;
    Ok(Json(review))
}
