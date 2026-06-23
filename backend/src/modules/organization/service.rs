//! Business logic for the `organization` module.
//!
//! All public functions accept `&AppState` (cheap clone of Arc-backed handles)
//! and the authenticated `user_id`, enforcing row-level ownership before every
//! mutation.  SQL is executed via `sqlx::query!` / `sqlx::query_as!` for
//! compile-time verification against the live schema.

use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    state::AppState,
};

#[allow(unused_imports)] // Organization is a sqlx query_as! target type
use super::models::{
    CreateOrganizationRequest, Organization, OrganizationResponse, UpdateOrganizationRequest,
};

// ── Service functions ─────────────────────────────────────────────────────────

/// Return all organizations belonging to `user_id`, ordered by position.
pub async fn list_organizations(
    state: &AppState,
    user_id: Uuid,
) -> AppResult<Vec<OrganizationResponse>> {
    let rows = sqlx::query_as!(
        Organization,
        r#"
        SELECT
            id,
            user_id,
            name,
            description,
            color,
            position,
            created_at,
            updated_at
        FROM organizations
        WHERE user_id = $1
        ORDER BY position ASC, created_at ASC
        "#,
        user_id
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows.into_iter().map(OrganizationResponse::from).collect())
}

/// Fetch one organization by id, enforcing ownership.
pub async fn get_organization(
    state: &AppState,
    user_id: Uuid,
    organization_id: Uuid,
) -> AppResult<OrganizationResponse> {
    let org = sqlx::query_as!(
        Organization,
        r#"
        SELECT
            id,
            user_id,
            name,
            description,
            color,
            position,
            created_at,
            updated_at
        FROM organizations
        WHERE id = $1 AND user_id = $2
        "#,
        organization_id,
        user_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(OrganizationResponse::from(org))
}

/// Insert a new organization and return the full response.
pub async fn create_organization(
    state: &AppState,
    user_id: Uuid,
    req: CreateOrganizationRequest,
) -> AppResult<OrganizationResponse> {
    let org = sqlx::query_as!(
        Organization,
        r#"
        INSERT INTO organizations (user_id, name, description, color, position)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
            id,
            user_id,
            name,
            description,
            color,
            position,
            created_at,
            updated_at
        "#,
        user_id,
        req.name,
        req.description,
        req.color,
        req.position.unwrap_or(0)
    )
    .fetch_one(&state.db)
    .await?;

    Ok(OrganizationResponse::from(org))
}

/// Apply a partial update to an existing organization.
pub async fn update_organization(
    state: &AppState,
    user_id: Uuid,
    organization_id: Uuid,
    req: UpdateOrganizationRequest,
) -> AppResult<OrganizationResponse> {
    let org = sqlx::query_as!(
        Organization,
        r#"
        UPDATE organizations SET
            name        = COALESCE($3, name),
            description = COALESCE($4, description),
            color       = COALESCE($5, color),
            position    = COALESCE($6, position),
            updated_at  = now()
        WHERE id = $1 AND user_id = $2
        RETURNING
            id,
            user_id,
            name,
            description,
            color,
            position,
            created_at,
            updated_at
        "#,
        organization_id,    // $1
        user_id,            // $2
        req.name,           // $3
        req.description,    // $4
        req.color,          // $5
        req.position,       // $6
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(OrganizationResponse::from(org))
}

/// Permanently delete an organization owned by `user_id`.
///
/// Hard delete — organizations are NOT part of the trash/soft-delete scope.
/// Cascaded by the DB: `projects.organization_id` is set to NULL via the
/// `ON DELETE SET NULL` foreign key.
pub async fn delete_organization(
    state: &AppState,
    user_id: Uuid,
    organization_id: Uuid,
) -> AppResult<()> {
    let result = sqlx::query!(
        "DELETE FROM organizations WHERE id = $1 AND user_id = $2",
        organization_id,
        user_id
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}
