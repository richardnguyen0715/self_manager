//! Business logic for the `saved_view` module.
//!
//! Uses sqlx's **runtime** query API so no offline `.sqlx` cache regeneration
//! is needed. Every query filters by `user_id` for ownership scoping.

use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    state::AppState,
};

use super::models::{
    CreateSavedViewRequest, ListSavedViewsQuery, SavedView, UpdateSavedViewRequest, VALID_SCOPES,
};

const SELECT_COLS: &str = "id, user_id, project_id, name, scope, filters, display, \
     position, created_at, updated_at";

fn validate_scope(scope: &str) -> AppResult<()> {
    if VALID_SCOPES.contains(&scope) {
        Ok(())
    } else {
        Err(AppError::Validation(format!(
            "scope must be one of: {}",
            VALID_SCOPES.join(", ")
        )))
    }
}

// ── Read ──────────────────────────────────────────────────────────────────────

pub async fn list(
    state: &AppState,
    user_id: Uuid,
    query: &ListSavedViewsQuery,
) -> AppResult<Vec<SavedView>> {
    if let Some(scope) = query.scope.as_deref() {
        validate_scope(scope)?;
    }

    let sql = format!(
        "SELECT {SELECT_COLS} FROM saved_views \
         WHERE user_id = $1 \
           AND ($2::text IS NULL OR scope = $2) \
           AND (($3::uuid IS NULL AND project_id IS NULL) OR project_id = $3) \
         ORDER BY position ASC, created_at ASC"
    );
    let rows = sqlx::query_as::<_, SavedView>(&sql)
        .bind(user_id)
        .bind(query.scope.as_deref())
        .bind(query.project_id)
        .fetch_all(&state.db)
        .await?;
    Ok(rows)
}

async fn get(state: &AppState, user_id: Uuid, id: Uuid) -> AppResult<SavedView> {
    let sql = format!("SELECT {SELECT_COLS} FROM saved_views WHERE id = $1 AND user_id = $2");
    sqlx::query_as::<_, SavedView>(&sql)
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)
}

// ── Write ─────────────────────────────────────────────────────────────────────

pub async fn create(
    state: &AppState,
    user_id: Uuid,
    req: CreateSavedViewRequest,
) -> AppResult<SavedView> {
    let scope = req.scope.unwrap_or_else(|| "work_items".to_owned());
    validate_scope(&scope)?;

    let filters = req.filters.unwrap_or_else(|| serde_json::json!({}));
    let display = req.display.unwrap_or_else(|| serde_json::json!({}));

    // Append after the last view in the same (user, scope, project) group.
    let sql = format!(
        "INSERT INTO saved_views (user_id, project_id, name, scope, filters, display, position) \
         VALUES ($1, $2, $3, $4, $5, $6, \
            (SELECT COALESCE(MAX(position), -1) + 1 FROM saved_views \
             WHERE user_id = $1 AND scope = $4 \
               AND (($2::uuid IS NULL AND project_id IS NULL) OR project_id = $2))) \
         RETURNING {SELECT_COLS}"
    );
    let row = sqlx::query_as::<_, SavedView>(&sql)
        .bind(user_id)
        .bind(req.project_id)
        .bind(req.name)
        .bind(scope)
        .bind(filters)
        .bind(display)
        .fetch_one(&state.db)
        .await?;
    Ok(row)
}

pub async fn update(
    state: &AppState,
    user_id: Uuid,
    id: Uuid,
    req: UpdateSavedViewRequest,
) -> AppResult<SavedView> {
    // Load existing (enforces ownership) then resolve each optional field.
    let existing = get(state, user_id, id).await?;

    let name = req.name.unwrap_or(existing.name);
    let filters = req.filters.unwrap_or(existing.filters);
    let display = req.display.unwrap_or(existing.display);
    let position = req.position.unwrap_or(existing.position);

    let sql = format!(
        "UPDATE saved_views \
         SET name = $1, filters = $2, display = $3, position = $4, updated_at = now() \
         WHERE id = $5 AND user_id = $6 \
         RETURNING {SELECT_COLS}"
    );
    sqlx::query_as::<_, SavedView>(&sql)
        .bind(name)
        .bind(filters)
        .bind(display)
        .bind(position)
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)
}

pub async fn delete(state: &AppState, user_id: Uuid, id: Uuid) -> AppResult<()> {
    let result = sqlx::query("DELETE FROM saved_views WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user_id)
        .execute(&state.db)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}
