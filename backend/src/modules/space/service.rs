//! Business logic for the `space` module.
//!
//! All public functions accept a reference to [`AppState`] and execute SQL via
//! `sqlx::query!` / `sqlx::query_as!` (compile-time checked).
//!
//! ## Ownership scoping
//!
//! Every query filters by `user_id = $n` so rows belonging to other users are
//! never visible or modifiable — returning `AppError::NotFound` in that case.
//!
//! ## Nullable fields in PATCH
//!
//! `icon`, `description`, and `project_id` are nullable.  The update function
//! loads the existing row first, then resolves each `Option<Option<T>>` field:
//! outer `None` → keep current value; outer `Some(None)` → set to NULL;
//! outer `Some(Some(v))` → overwrite with `v`.

use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    state::AppState,
};

use super::models::{
    CreateSpaceRequest, ListSpacesQuery, Space, UpdateSpaceRequest,
};

// ── Read ───────────────────────────────────────────────────────────────────────

/// Return all spaces owned by `user_id`, optionally filtered by `project_id`.
///
/// Results are ordered by `created_at ASC` (oldest first).
pub async fn list_spaces(
    state: &AppState,
    user_id: Uuid,
    query: &ListSpacesQuery,
) -> AppResult<Vec<Space>> {
    // Two separate query paths: one with a project_id filter and one without,
    // so that the sqlx compile-time macro can check both.
    if let Some(project_id) = query.project_id {
        let spaces = sqlx::query_as!(
            Space,
            r#"
            SELECT id, user_id, project_id, name, icon, description,
                   created_at, updated_at
            FROM   spaces
            WHERE  user_id    = $1
              AND  project_id = $2
            ORDER  BY created_at ASC
            "#,
            user_id,
            project_id,
        )
        .fetch_all(&state.db)
        .await?;
        Ok(spaces)
    } else {
        let spaces = sqlx::query_as!(
            Space,
            r#"
            SELECT id, user_id, project_id, name, icon, description,
                   created_at, updated_at
            FROM   spaces
            WHERE  user_id = $1
            ORDER  BY created_at ASC
            "#,
            user_id,
        )
        .fetch_all(&state.db)
        .await?;
        Ok(spaces)
    }
}

/// Fetch a single space by `id`, enforcing ownership via `user_id`.
///
/// Returns [`AppError::NotFound`] when the row is absent or belongs to another
/// user.
pub async fn get_space(
    state: &AppState,
    user_id: Uuid,
    space_id: Uuid,
) -> AppResult<Space> {
    sqlx::query_as!(
        Space,
        r#"
        SELECT id, user_id, project_id, name, icon, description,
               created_at, updated_at
        FROM   spaces
        WHERE  id      = $1
          AND  user_id = $2
        "#,
        space_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)
}

// ── Write ──────────────────────────────────────────────────────────────────────

/// Insert a new space owned by `user_id`.
///
/// Returns the full row as stored (including generated `id` and timestamps).
pub async fn create_space(
    state: &AppState,
    user_id: Uuid,
    req: CreateSpaceRequest,
) -> AppResult<Space> {
    let space = sqlx::query_as!(
        Space,
        r#"
        INSERT INTO spaces (user_id, project_id, name, icon, description)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, user_id, project_id, name, icon, description,
                  created_at, updated_at
        "#,
        user_id,
        req.project_id as Option<Uuid>,
        req.name,
        req.icon,
        req.description,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(space)
}

/// Apply a partial update to a space, returning the full updated row.
///
/// Loads the existing row first (enforcing ownership), then resolves each
/// `Option<Option<T>>` field before issuing the `UPDATE`.
pub async fn update_space(
    state: &AppState,
    user_id: Uuid,
    space_id: Uuid,
    req: UpdateSpaceRequest,
) -> AppResult<Space> {
    // Enforce ownership and capture current values for unchanged fields.
    let existing = get_space(state, user_id, space_id).await?;

    let new_name = req.name.unwrap_or(existing.name);
    // outer None → keep; outer Some(inner) → set to inner (may be None/null)
    let new_icon = req.icon.unwrap_or(existing.icon);
    let new_description = req.description.unwrap_or(existing.description);
    let new_project_id = req.project_id.unwrap_or(existing.project_id);

    let space = sqlx::query_as!(
        Space,
        r#"
        UPDATE spaces
        SET    name        = $1,
               icon        = $2,
               description = $3,
               project_id  = $4,
               updated_at  = now()
        WHERE  id      = $5
          AND  user_id = $6
        RETURNING id, user_id, project_id, name, icon, description,
                  created_at, updated_at
        "#,
        new_name,
        new_icon,
        new_description,
        new_project_id as Option<Uuid>,
        space_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(space)
}

/// Delete a space by `id`, enforcing ownership.
///
/// Cascade rules in the DB automatically remove all child pages, page versions,
/// and page comments when the space is deleted.
///
/// Returns [`AppError::NotFound`] when the row does not exist or is owned by
/// another user.
pub async fn delete_space(
    state: &AppState,
    user_id: Uuid,
    space_id: Uuid,
) -> AppResult<()> {
    let result = sqlx::query!(
        r#"
        DELETE FROM spaces
        WHERE id      = $1
          AND user_id = $2
        "#,
        space_id,
        user_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}
