//! Axum handler for the `trash` module.

use axum::{extract::State, response::IntoResponse, Json};

use crate::shared::{error::AppError, extractors::AuthUser, state::AppState};

use super::service;

// ── GET /api/trash ──────────────────────────────────────────────────────────

/// Return all soft-deleted rows for the authenticated user.
///
/// Response shape:
/// ```json
/// { "work_items": [...], "tasks": [...], "projects": [...] }
/// ```
/// Each array contains rows with `deleted_at IS NOT NULL`, newest-deleted first.
pub async fn get_trash(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, AppError> {
    let trash = service::get_trash(&state, auth.user_id).await?;
    Ok(Json(trash))
}
