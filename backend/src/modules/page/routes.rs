//! Route definitions for the `page` module.
//!
//! Mounted under `/api/pages` by `main.rs` after merging with
//! `doc_comment::router()`:
//!
//! ```rust,ignore
//! .nest("/pages", modules::page::router().merge(modules::doc_comment::router()))
//! ```
//!
//! NOTE: Literal path segments (`/search` and `/move`) MUST be registered
//! **before** `/:id` so that Axum does not capture them as UUIDs.
//!
//! ```text
//! GET    /                                      list_page_tree
//! GET    /search                                search_pages
//! POST   /move                                  move_page
//! POST   /                                      create_page
//! GET    /:id                                   get_page
//! PATCH  /:id                                   update_page
//! DELETE /:id                                   delete_page
//! POST   /:id/publish                           publish_page
//! GET    /:id/versions                          list_versions
//! POST   /:id/versions                          save_version
//! GET    /:id/versions/:version_id              get_version
//! POST   /:id/versions/:version_id/restore      restore_version
//! POST   /:id/images                            upload_page_image
//! ```

use axum::{
    routing::{get, post},
    Router,
};

use crate::shared::state::AppState;

use super::handlers;

/// Build the [`Router`] for this module.
///
/// `main.rs` merges this with `doc_comment::router()` then nests under
/// `/api/pages`:
///
/// ```rust,ignore
/// .nest("/pages", modules::page::router().merge(modules::doc_comment::router()))
/// ```
pub fn router() -> Router<AppState> {
    Router::new()
        // ── Collection (literal segments first) ──────────────────────────────
        // GET  /  → tree list (space_id required in query)
        // POST /  → create page
        .route(
            "/",
            get(handlers::list_page_tree).post(handlers::create_page),
        )
        // GET  /search  — must precede /:id
        .route("/search", get(handlers::search_pages))
        // POST /move    — must precede /:id
        .route("/move", post(handlers::move_page))
        // ── Individual page ──────────────────────────────────────────────────
        .route(
            "/:id",
            get(handlers::get_page)
                .patch(handlers::update_page)
                .delete(handlers::delete_page),
        )
        // POST /:id/publish
        .route("/:id/publish", post(handlers::publish_page))
        // ── Versions ─────────────────────────────────────────────────────────
        // GET  /:id/versions      → list summaries
        // POST /:id/versions      → save-version snapshot
        .route(
            "/:id/versions",
            get(handlers::list_versions).post(handlers::save_version),
        )
        // GET  /:id/versions/:version_id          → full version
        .route("/:id/versions/:version_id", get(handlers::get_version))
        // POST /:id/versions/:version_id/restore  → restore version
        .route(
            "/:id/versions/:version_id/restore",
            post(handlers::restore_version),
        )
        // ── Image upload ──────────────────────────────────────────────────────
        // POST /:id/images        → multipart upload, no DB row
        .route("/:id/images", post(handlers::upload_page_image))
}
