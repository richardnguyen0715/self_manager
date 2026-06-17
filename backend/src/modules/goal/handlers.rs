//! Axum request handlers for the `goal` module.
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
        CreateGoalRequest, GoalListResponse, GoalResponse, ListGoalsQuery, ReorderGoalRequest,
        UpdateGoalRequest,
    },
    service,
};

// ── GET /api/goals ─────────────────────────────────────────────────────────────

/// List all goals for the authenticated user.
///
/// Supports optional `?status=active|completed|abandoned|paused`, `?limit=50`,
/// and `?offset=0` query parameters.
pub async fn list_goals(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ListGoalsQuery>,
) -> AppResult<Json<GoalListResponse>> {
    let list = service::list_goals(&state, auth.user_id, &query).await?;
    Ok(Json(list))
}

// ── POST /api/goals ────────────────────────────────────────────────────────────

/// Create a new goal for the authenticated user.
///
/// Returns `201 Created` with the created goal body.
pub async fn create_goal(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreateGoalRequest>,
) -> AppResult<(StatusCode, Json<GoalResponse>)> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let goal = service::create_goal(&state, auth.user_id, body).await?;
    Ok((StatusCode::CREATED, Json(goal)))
}

// ── GET /api/goals/:id ─────────────────────────────────────────────────────────

/// Fetch a single goal by its UUID.
///
/// Returns `404 Not Found` when the goal does not exist or belongs to a
/// different user.
pub async fn get_goal(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(goal_id): Path<Uuid>,
) -> AppResult<Json<GoalResponse>> {
    let goal = service::get_goal(&state, auth.user_id, goal_id).await?;
    Ok(Json(goal))
}

// ── PATCH /api/goals/:id ───────────────────────────────────────────────────────

/// Partially update a goal.
///
/// Only fields present in the JSON body are modified; absent fields retain
/// their current values.
pub async fn update_goal(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(goal_id): Path<Uuid>,
    Json(body): Json<UpdateGoalRequest>,
) -> AppResult<Json<GoalResponse>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let goal = service::update_goal(&state, auth.user_id, goal_id, body).await?;
    Ok(Json(goal))
}

// ── DELETE /api/goals/:id ──────────────────────────────────────────────────────

/// Delete a goal by its UUID.
///
/// Returns `204 No Content` on success. Projects under this goal will have
/// their `goal_id` set to `NULL` by the database cascade rule.
pub async fn delete_goal(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(goal_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::delete_goal(&state, auth.user_id, goal_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── PATCH /api/goals/:id/position ─────────────────────────────────────────────

/// Update the sort position of a goal (lightweight drag-and-drop endpoint).
///
/// Returns the updated goal.
pub async fn reorder_goal(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(goal_id): Path<Uuid>,
    Json(body): Json<ReorderGoalRequest>,
) -> AppResult<Json<GoalResponse>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let goal = service::reorder_goal(&state, auth.user_id, goal_id, body.position).await?;
    Ok(Json(goal))
}

// ── GET /api/goals/:id/projects ────────────────────────────────────────────────

/// List all projects that belong to a goal.
///
/// Returns `404 Not Found` when the goal does not exist or belongs to a
/// different user.
pub async fn list_goal_projects(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(goal_id): Path<Uuid>,
) -> AppResult<Json<Vec<service::GoalProjectSummary>>> {
    let projects = service::list_goal_projects(&state, auth.user_id, goal_id).await?;
    Ok(Json(projects))
}
