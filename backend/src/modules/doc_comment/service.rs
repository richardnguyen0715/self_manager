//! Business logic for the `doc_comment` module.
//!
//! All public functions accept a reference to [`AppState`] and execute SQL via
//! `sqlx::query!` / `sqlx::query_as!` (compile-time checked).
//!
//! ## Ownership semantics
//!
//! - Every comment lookup is gated on the **page** being owned by `user_id`
//!   (via `pages.user_id = $user_id`) so that a user cannot interact with
//!   comments on a page they do not own.
//! - Comment deletion additionally checks `page_comments.user_id = $user_id`
//!   (author-only delete). The page-ownership check is applied first so the
//!   caller always gets a consistent 404 when the page is inaccessible.

use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    state::AppState,
};

use super::models::{CreateCommentRequest, PageComment};

// ── List ───────────────────────────────────────────────────────────────────────

/// Return all comments for `page_id`, ordered oldest-first.
///
/// Validates that the page exists and is owned by `user_id` before fetching
/// comments; returns [`AppError::NotFound`] otherwise.
///
/// # Errors
///
/// - [`AppError::NotFound`] — page not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn list_comments(
    state: &AppState,
    user_id: Uuid,
    page_id: Uuid,
) -> AppResult<Vec<PageComment>> {
    // Guard: page must exist and be owned by this user.
    let page_exists: bool = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM pages WHERE id = $1 AND user_id = $2
        ) AS "exists!"
        "#,
        page_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?;

    if !page_exists {
        return Err(AppError::NotFound);
    }

    let comments = sqlx::query_as!(
        PageComment,
        r#"
        SELECT id, page_id, user_id, body, created_at
        FROM   page_comments
        WHERE  page_id = $1
        ORDER  BY created_at ASC, id ASC
        "#,
        page_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(comments)
}

// ── Create ─────────────────────────────────────────────────────────────────────

/// Create a new comment on `page_id` authored by `user_id`.
///
/// Validates page ownership before inserting. Returns the newly-created
/// [`PageComment`] row.
///
/// # Errors
///
/// - [`AppError::NotFound`] — page not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn create_comment(
    state: &AppState,
    user_id: Uuid,
    page_id: Uuid,
    req: CreateCommentRequest,
) -> AppResult<PageComment> {
    // Guard: page must exist and be owned by this user.
    let page_exists: bool = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM pages WHERE id = $1 AND user_id = $2
        ) AS "exists!"
        "#,
        page_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?;

    if !page_exists {
        return Err(AppError::NotFound);
    }

    let comment = sqlx::query_as!(
        PageComment,
        r#"
        INSERT INTO page_comments (page_id, user_id, body)
        VALUES ($1, $2, $3)
        RETURNING id, page_id, user_id, body, created_at
        "#,
        page_id,
        user_id,
        req.body,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(comment)
}

// ── Delete ─────────────────────────────────────────────────────────────────────

/// Delete comment `comment_id` from `page_id`, enforcing author ownership.
///
/// Both the page and the comment must be owned by `user_id`. Returns
/// [`AppError::NotFound`] when either is inaccessible or if `comment_id` does
/// not belong to `page_id`.
///
/// # Errors
///
/// - [`AppError::NotFound`] — page or comment not found, or not owned by the
///   authenticated user.
/// - [`AppError::Db`] — database failure.
pub async fn delete_comment(
    state: &AppState,
    user_id: Uuid,
    page_id: Uuid,
    comment_id: Uuid,
) -> AppResult<()> {
    // Guard: page must exist and be owned by this user.
    let page_exists: bool = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM pages WHERE id = $1 AND user_id = $2
        ) AS "exists!"
        "#,
        page_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?;

    if !page_exists {
        return Err(AppError::NotFound);
    }

    // Delete only when comment is on this page AND authored by this user.
    let result = sqlx::query!(
        r#"
        DELETE FROM page_comments
        WHERE  id      = $1
          AND  page_id = $2
          AND  user_id = $3
        "#,
        comment_id,
        page_id,
        user_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}
