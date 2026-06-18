//! Axum request handlers for the `sprint` module.
//!
//! All routes require a valid `Authorization: Bearer <access-token>` header;
//! the [`AuthUser`] extractor enforces this at the framework level.
//!
//! Handler functions are thin: extract inputs, optionally validate, delegate
//! to [`service`], and return the appropriate HTTP response.
//!
//! # Endpoints
//!
//! | Method | Path | Handler |
//! |--------|------|---------|
//! | GET    | `/`                    | [`list_sprints`]            |
//! | POST   | `/`                    | [`create_sprint`]           |
//! | GET    | `/active`              | [`get_active_sprint`]       |
//! | GET    | `/velocity`            | [`get_velocity`]            |
//! | GET    | `/:id`                 | [`get_sprint`]              |
//! | PATCH  | `/:id`                 | [`update_sprint`]           |
//! | DELETE | `/:id`                 | [`delete_sprint`]           |
//! | POST   | `/:id/activate`        | [`activate_sprint`]         |
//! | POST   | `/:id/complete`        | [`complete_sprint`]         |
//! | GET    | `/:id/work-items`      | [`list_sprint_work_items`]  |
//! | GET    | `/:id/burndown`        | [`get_burndown`]            |
//! | GET    | `/:id/review`          | [`get_review`]              |
//! | PUT    | `/:id/review`          | [`upsert_review`]           |
//! | GET    | `/:id/retrospective`   | [`get_retrospective`]       |
//! | PUT    | `/:id/retrospective`   | [`upsert_retrospective`]    |

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
        CompleteSprintRequest, CreateSprintRequest, ListSprintsQuery, RetrospectiveResponse,
        SprintListResponse, SprintResponse, SprintReviewResponse, UpdateSprintRequest,
        UpsertRetrospectiveRequest, UpsertReviewRequest, VelocityListResponse, VelocityQuery,
        WorkItemListResponse, WorkItemStatusQuery,
    },
    service,
};

// ── GET /api/sprints ─────────────────────────────────────────────────────────────

/// List all sprints for the authenticated user.
///
/// Supports optional `?status=planned|active|completed`, `?limit`, `?offset`.
pub async fn list_sprints(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ListSprintsQuery>,
) -> AppResult<Json<SprintListResponse>> {
    let list = service::list_sprints(&state, auth.user_id, &query).await?;
    Ok(Json(list))
}

// ── POST /api/sprints ─────────────────────────────────────────────────────────────

/// Create a new sprint.
///
/// Returns `201 Created` with the created sprint.
pub async fn create_sprint(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreateSprintRequest>,
) -> AppResult<(StatusCode, Json<SprintResponse>)> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let sprint = service::create_sprint(&state, auth.user_id, body).await?;
    Ok((StatusCode::CREATED, Json(sprint)))
}

// ── GET /api/sprints/active ───────────────────────────────────────────────────────

/// Return the currently active sprint, or `404` when none exists.
pub async fn get_active_sprint(
    auth: AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<SprintResponse>> {
    let sprint = service::get_active_sprint(&state, auth.user_id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(sprint))
}

// ── GET /api/sprints/velocity ─────────────────────────────────────────────────────

/// Return velocity data for the last N completed sprints (default 6).
pub async fn get_velocity(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<VelocityQuery>,
) -> AppResult<Json<VelocityListResponse>> {
    let data = service::get_velocity(&state, auth.user_id, query.last).await?;
    Ok(Json(data))
}

// ── GET /api/sprints/:id ──────────────────────────────────────────────────────────

/// Fetch a single sprint by UUID.
///
/// Returns `404 Not Found` when the sprint does not exist or belongs to a
/// different user.
pub async fn get_sprint(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(sprint_id): Path<Uuid>,
) -> AppResult<Json<SprintResponse>> {
    let sprint = service::get_sprint(&state, auth.user_id, sprint_id).await?;
    Ok(Json(sprint))
}

// ── PATCH /api/sprints/:id ────────────────────────────────────────────────────────

/// Partially update a sprint.
pub async fn update_sprint(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(sprint_id): Path<Uuid>,
    Json(body): Json<UpdateSprintRequest>,
) -> AppResult<Json<SprintResponse>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let sprint = service::update_sprint(&state, auth.user_id, sprint_id, body).await?;
    Ok(Json(sprint))
}

// ── DELETE /api/sprints/:id ───────────────────────────────────────────────────────

/// Delete a sprint.
///
/// Returns `204 No Content` on success. Work items in the sprint have their
/// `sprint_id` set to NULL (moved back to backlog) by the DB cascade rule.
pub async fn delete_sprint(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(sprint_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::delete_sprint(&state, auth.user_id, sprint_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── POST /api/sprints/:id/activate ───────────────────────────────────────────────

/// Activate a sprint (planned → active).
///
/// Returns `409 Conflict` if another sprint is already active.
pub async fn activate_sprint(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(sprint_id): Path<Uuid>,
) -> AppResult<Json<SprintResponse>> {
    let sprint = service::activate_sprint(&state, auth.user_id, sprint_id).await?;
    Ok(Json(sprint))
}

// ── POST /api/sprints/:id/complete ───────────────────────────────────────────────

/// Complete a sprint and auto-create a sprint review.
///
/// Returns the auto-created [`SprintReviewResponse`].
pub async fn complete_sprint(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(sprint_id): Path<Uuid>,
    Json(body): Json<CompleteSprintRequest>,
) -> AppResult<Json<SprintReviewResponse>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let review = service::complete_sprint(&state, auth.user_id, sprint_id, body).await?;
    Ok(Json(review))
}

// ── GET /api/sprints/:id/work-items ──────────────────────────────────────────────

/// List work items assigned to a sprint.
///
/// Supports optional `?status=` filter.
pub async fn list_sprint_work_items(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(sprint_id): Path<Uuid>,
    Query(query): Query<WorkItemStatusQuery>,
) -> AppResult<Json<WorkItemListResponse>> {
    let list =
        service::list_sprint_work_items(&state, auth.user_id, sprint_id, &query).await?;
    Ok(Json(list))
}

// ── GET /api/sprints/:id/burndown ─────────────────────────────────────────────────

/// Return the burndown chart data for a sprint.
pub async fn get_burndown(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(sprint_id): Path<Uuid>,
) -> AppResult<Json<super::models::BurndownResponse>> {
    let burndown = service::get_burndown(&state, auth.user_id, sprint_id).await?;
    Ok(Json(burndown))
}

// ── GET /api/sprints/:id/review ───────────────────────────────────────────────────

/// Fetch the sprint review, or `404` when no review exists yet.
pub async fn get_review(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(sprint_id): Path<Uuid>,
) -> AppResult<Json<SprintReviewResponse>> {
    let review = service::get_review(&state, auth.user_id, sprint_id).await?;
    Ok(Json(review))
}

// ── PUT /api/sprints/:id/review ───────────────────────────────────────────────────

/// Upsert the sprint review.
pub async fn upsert_review(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(sprint_id): Path<Uuid>,
    Json(body): Json<UpsertReviewRequest>,
) -> AppResult<Json<SprintReviewResponse>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let review = service::upsert_review(&state, auth.user_id, sprint_id, body).await?;
    Ok(Json(review))
}

// ── GET /api/sprints/:id/retrospective ───────────────────────────────────────────

/// Fetch the retrospective, or `404` when none exists.
pub async fn get_retrospective(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(sprint_id): Path<Uuid>,
) -> AppResult<Json<RetrospectiveResponse>> {
    let retro = service::get_retrospective(&state, auth.user_id, sprint_id).await?;
    Ok(Json(retro))
}

// ── PUT /api/sprints/:id/retrospective ───────────────────────────────────────────

/// Upsert the retrospective.
pub async fn upsert_retrospective(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(sprint_id): Path<Uuid>,
    Json(body): Json<UpsertRetrospectiveRequest>,
) -> AppResult<Json<RetrospectiveResponse>> {
    let retro =
        service::upsert_retrospective(&state, auth.user_id, sprint_id, body).await?;
    Ok(Json(retro))
}
