//! Route definitions for the `backlog` module.
//!
//! All routes are mounted under `/api/backlog` by `main.rs`.
//!
//! ```text
//! GET  /api/backlog   list_backlog
//! ```

use axum::{routing::get, Router};

use crate::shared::state::AppState;

use super::handlers;

/// Build the [`Router`] for the backlog module.
///
/// `main.rs` nests this under `/api/backlog`:
///
/// ```rust,ignore
/// .nest("/backlog", modules::backlog::router())
/// ```
pub fn router() -> Router<AppState> {
    Router::new().route("/", get(handlers::list_backlog))
}
