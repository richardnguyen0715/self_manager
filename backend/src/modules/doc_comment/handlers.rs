//! Axum request handlers for the `doc_comment` module.
//!
//! All routes require a valid `Authorization: Bearer <access-token>` header;
//! the [`AuthUser`] extractor enforces this at the framework level.
//!
//! Handlers are thin: extract → validate → delegate to [`service`] → respond.

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

use super::{
    models::{CreateCommentRequest, PageComment},
    service,
};

// ── GET /api/pages/:id/comments ───────────────────────────────────────────────

/// List all comments for a page, ordered oldest-first.
///
/// Returns `404 Not Found` when the page does not exist or belongs to a
/// different user.
///
/// # Response
///
/// `200 OK` — `[PageComment]`
pub async fn list_comments(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(page_id): Path<Uuid>,
) -> AppResult<Json<Vec<PageComment>>> {
    let comments = service::list_comments(&state, auth.user_id, page_id).await?;
    Ok(Json(comments))
}

// ── POST /api/pages/:id/comments ──────────────────────────────────────────────

/// Create a new comment on a page.
///
/// The authenticated user becomes the comment author. Returns `404 Not Found`
/// when the page does not exist or belongs to a different user. Returns `422`
/// when `body` fails length validation.
///
/// # Response
///
/// `201 Created` — `PageComment`
pub async fn create_comment(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(page_id): Path<Uuid>,
    Json(body): Json<CreateCommentRequest>,
) -> AppResult<(StatusCode, Json<PageComment>)> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let comment = service::create_comment(&state, auth.user_id, page_id, body).await?;
    Ok((StatusCode::CREATED, Json(comment)))
}

// ── DELETE /api/pages/:id/comments/:comment_id ────────────────────────────────

/// Delete a comment by its UUID.
///
/// Author-only: returns `404 Not Found` when the comment does not exist, does
/// not belong to this page, or was authored by a different user.
///
/// # Response
///
/// `204 No Content`
pub async fn delete_comment(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((page_id, comment_id)): Path<(Uuid, Uuid)>,
) -> AppResult<StatusCode> {
    service::delete_comment(&state, auth.user_id, page_id, comment_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
