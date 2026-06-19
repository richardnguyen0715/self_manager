//! Route definitions for the `public_docs` module.
//!
//! Mounted under `/api/public` by `main.rs`:
//!
//! ```rust,ignore
//! .nest("/api/public", modules::public_docs::router())
//! ```
//!
//! **No `AuthUser` extractor is used on any route here.**
//!
//! ```text
//! GET  /pages/:slug        get_public_page       — full page + direct public children
//! GET  /pages/:slug/tree   get_public_page_tree  — recursive public subtree
//! ```
//!
//! NOTE: `/pages/:slug/tree` is registered **before** `/:slug` because Axum
//! matches routes in registration order for the same method+prefix. Both routes
//! share the same method (GET) but differ in path segment count, so Axum's
//! longest-prefix routing resolves them correctly regardless. Registering the
//! deeper path first is a belt-and-suspenders measure following the codebase
//! convention of "literal before wildcard".

use axum::{routing::get, Router};

use crate::shared::state::AppState;

use super::handlers;

/// Build the [`Router`] for the `public_docs` module.
///
/// `main.rs` mounts this under `/api/public` with no authentication middleware.
///
/// ```rust,ignore
/// .nest("/api/public", modules::public_docs::router())
/// ```
pub fn router() -> Router<AppState> {
    Router::new()
        // Literal `/tree` suffix registered first so it is not captured by `:slug`.
        .route("/pages/:slug/tree", get(handlers::get_public_page_tree))
        .route("/pages/:slug", get(handlers::get_public_page))
}
