//! Axum handler functions for the `organization` module.
//!
//! Every handler is `async`, extracts [`AuthUser`] to enforce authentication,
//! delegates all business logic to `service`, and returns
//! `Result<impl IntoResponse, AppError>`.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use uuid::Uuid;
use validator::Validate;

use crate::shared::{error::AppError, extractors::AuthUser, state::AppState};

use super::{
    models::{CreateOrganizationRequest, UpdateOrganizationRequest},
    service,
};

// ── GET /api/organizations ──────────────────────────────────────────────────

/// List all organizations for the authenticated user, ordered by position.
pub async fn list_organizations(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, AppError> {
    let orgs = service::list_organizations(&state, auth.user_id).await?;
    Ok(Json(orgs))
}

// ── POST /api/organizations ───────────────────────────────────────────────────

/// Create a new organization.
pub async fn create_organization(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<CreateOrganizationRequest>,
) -> Result<impl IntoResponse, AppError> {
    req.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let org = service::create_organization(&state, auth.user_id, req).await?;
    Ok((StatusCode::CREATED, Json(org)))
}

// ── GET /api/organizations/:id ────────────────────────────────────────────────

/// Fetch a single organization by its UUID.
pub async fn get_organization(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(organization_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let org = service::get_organization(&state, auth.user_id, organization_id).await?;
    Ok(Json(org))
}

// ── PATCH /api/organizations/:id ──────────────────────────────────────────────

/// Partially update an organization (all fields optional).
pub async fn update_organization(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(organization_id): Path<Uuid>,
    Json(req): Json<UpdateOrganizationRequest>,
) -> Result<impl IntoResponse, AppError> {
    req.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let org = service::update_organization(&state, auth.user_id, organization_id, req).await?;
    Ok(Json(org))
}

// ── DELETE /api/organizations/:id ─────────────────────────────────────────────

/// Permanently delete an organization (hard delete).
pub async fn delete_organization(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(organization_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    service::delete_organization(&state, auth.user_id, organization_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
