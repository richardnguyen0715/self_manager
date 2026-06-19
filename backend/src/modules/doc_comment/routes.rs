//! Route definitions for the `doc_comment` module.
//!
//! Routes are **relative to `/pages`** (no leading `/pages` segment). They are
//! designed to be merged with `page::router()` before the combined result is
//! nested under `/api/pages`:
//!
//! ```rust,ignore
//! .nest("/pages", modules::page::router().merge(modules::doc_comment::router()))
//! ```
//!
//! This keeps `:id` routing unambiguous: both the page handlers and comment
//! handlers share the same `:id` parameter (the page UUID) without path
//! conflicts.
//!
//! ```text
//! GET    /api/pages/:id/comments              list_comments
//! POST   /api/pages/:id/comments              create_comment
//! DELETE /api/pages/:id/comments/:comment_id  delete_comment
//! ```

use axum::{
    routing::{delete, get},
    Router,
};

use crate::shared::state::AppState;

use super::handlers;

/// Build the [`Router`] for this module.
///
/// The returned router uses paths **relative to `/pages`** and must be merged
/// with `page::router()` before being nested under `/api/pages` in `main.rs`.
///
/// ```rust,ignore
/// .nest(
///     "/pages",
///     modules::page::router().merge(modules::doc_comment::router()),
/// )
/// ```
pub fn router() -> Router<AppState> {
    Router::new()
        // Comments collection: list + create
        .route(
            "/:id/comments",
            get(handlers::list_comments).post(handlers::create_comment),
        )
        // Individual comment: delete (author-only)
        .route(
            "/:id/comments/:comment_id",
            delete(handlers::delete_comment),
        )
}
