//! Route definitions for the `board_column` module.
//!
//! All routes are mounted under `/api/board-columns` by `main.rs`.
//!
//! ```text
//! GET    /api/board-columns              list_board_columns   (lazy seed + backfill)
//! POST   /api/board-columns              create_board_column
//! PATCH  /api/board-columns/:id          update_board_column
//! DELETE /api/board-columns/:id          delete_board_column
//! PUT    /api/board-columns/reorder      reorder_board_columns
//! ```
//!
//! NOTE: `/reorder` must be registered before `/:id` so that Axum does not
//! accidentally capture the literal string `"reorder"` as a UUID path segment.

use axum::{
    routing::{get, patch, put},
    Router,
};

use crate::shared::state::AppState;

use super::handlers;

/// Build the [`Router`] for this module.
///
/// `main.rs` nests this under `/api/board-columns`:
///
/// ```rust,ignore
/// .nest("/board-columns", modules::board_column::router())
/// ```
pub fn router() -> Router<AppState> {
    Router::new()
        // Collection
        .route("/", get(handlers::list_board_columns).post(handlers::create_board_column))
        // Reorder — must come before /:id to avoid "reorder" being parsed as a UUID.
        .route("/reorder", put(handlers::reorder_board_columns))
        // Individual column
        .route(
            "/:id",
            patch(handlers::update_board_column).delete(handlers::delete_board_column),
        )
}
