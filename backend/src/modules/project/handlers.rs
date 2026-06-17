//! Axum handler functions for the `project` module.
//!
//! Every handler is `async`, extracts [`AuthUser`] to enforce authentication,
//! delegates all business logic to `service`, and returns
//! `Result<impl IntoResponse, AppError>`.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use uuid::Uuid;
use validator::Validate;

use crate::shared::{error::AppError, extractors::AuthUser, state::AppState};

use super::{
    models::{
        CreateProjectRequest, ListProjectsQuery, ReorderProjectsRequest, UpdateProjectRequest,
    },
    service,
};

// ── GET /api/projects ─────────────────────────────────────────────────────────

/// List all projects for the authenticated user, with optional filters.
///
/// Query parameters: `status`, `goal_id`.
pub async fn list_projects(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ListProjectsQuery>,
) -> Result<impl IntoResponse, AppError> {
    let projects = service::list_projects(&state, auth.user_id, query).await?;
    Ok(Json(projects))
}

// ── POST /api/projects ────────────────────────────────────────────────────────

/// Create a new project.
pub async fn create_project(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<CreateProjectRequest>,
) -> Result<impl IntoResponse, AppError> {
    req.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let project = service::create_project(&state, auth.user_id, req).await?;
    Ok((StatusCode::CREATED, Json(project)))
}

// ── GET /api/projects/:id ─────────────────────────────────────────────────────

/// Fetch a single project by its UUID.
pub async fn get_project(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let project = service::get_project(&state, auth.user_id, project_id).await?;
    Ok(Json(project))
}

// ── PATCH /api/projects/:id ───────────────────────────────────────────────────

/// Partially update a project (all fields optional).
pub async fn update_project(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Json(req): Json<UpdateProjectRequest>,
) -> Result<impl IntoResponse, AppError> {
    req.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let project = service::update_project(&state, auth.user_id, project_id, req).await?;
    Ok(Json(project))
}

// ── DELETE /api/projects/:id ──────────────────────────────────────────────────

/// Permanently delete a project.
pub async fn delete_project(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    service::delete_project(&state, auth.user_id, project_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── PUT /api/projects/reorder ─────────────────────────────────────────────────

/// Bulk-reorder projects by updating their `position` field.
pub async fn reorder_projects(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<ReorderProjectsRequest>,
) -> Result<impl IntoResponse, AppError> {
    req.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    service::reorder_projects(&state, auth.user_id, req).await?;
    Ok(StatusCode::NO_CONTENT)
}
