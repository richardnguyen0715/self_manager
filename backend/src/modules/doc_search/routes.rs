//! Route definitions for the `doc_search` module.
//!
//! Mounted under `/api/docs` by `main.rs`:
//!
//! ```rust,ignore
//! .nest("/docs", modules::doc_search::router())
//! ```
//!
//! ```text
//! GET  /search   search_docs   (requires AuthUser)
//! ```

use axum::{routing::get, Router};

use crate::shared::state::AppState;

use super::handlers;

/// Build the [`Router`] for the `doc_search` module.
///
/// Mounted at `/api/docs` in `main.rs`.
///
/// ```rust,ignore
/// .nest("/docs", modules::doc_search::router())
/// ```
pub fn router() -> Router<AppState> {
    Router::new()
        // GET /api/docs/search?q=&space_id?
        .route("/search", get(handlers::search_docs))
}
