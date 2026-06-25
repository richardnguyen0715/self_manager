//! Route definitions for the `page` module.
//!
//! Mounted under `/api/pages` by `main.rs` after merging with
//! `doc_comment::router()`:
//!
//! ```rust,ignore
//! .nest("/pages", modules::page::router().merge(modules::doc_comment::router()))
//! ```
//!
//! NOTE: Literal path segments MUST be registered **before** `/:id` so that
//! Axum does not capture them as UUIDs. The ordering here is significant.
//!
//! ```text
//! GET    /                                      list_page_tree
//! GET    /search                                search_pages          (literal, before /:id)
//! GET    /templates                             list_templates        (literal, before /:id)
//! POST   /move                                  move_page             (literal, before /:id)
//! POST   /from-template                         create_from_template  (literal, before /:id)
//! POST   /                                      create_page
//! GET    /:id                                   get_page
//! PATCH  /:id                                   update_page
//! DELETE /:id                                   delete_page
//! POST   /:id/publish                           publish_page
//! POST   /:id/public                            set_page_public
//! POST   /:id/cover                             upload_cover_image
//! GET    /:id/backlinks                         list_backlinks
//! GET    /:id/links                             list_outbound_links
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
        // ── Collection (literal segments — all must precede /:id) ────────────
        // GET  /  → tree list (space_id required in query)
        // POST /  → create page
        .route(
            "/",
            get(handlers::list_page_tree).post(handlers::create_page),
        )
        // GET  /search
        .route("/search", get(handlers::search_pages))
        // GET  /templates
        .route("/templates", get(handlers::list_templates))
        // POST /move
        .route("/move", post(handlers::move_page))
        // POST /from-template
        .route("/from-template", post(handlers::create_from_template))
        // ── Individual page ──────────────────────────────────────────────────
        .route(
            "/:id",
            get(handlers::get_page)
                .patch(handlers::update_page)
                .delete(handlers::delete_page),
        )
        // POST /:id/publish
        .route("/:id/publish", post(handlers::publish_page))
        // POST /:id/unpublish
        .route("/:id/unpublish", post(handlers::unpublish_page))
        // POST /:id/public  — publish-as-website toggle
        .route("/:id/public", post(handlers::set_page_public))
        // POST /:id/cover   — cover image upload
        .route("/:id/cover", post(handlers::upload_cover_image))
        // ── Backlinks ─────────────────────────────────────────────────────────
        // GET /:id/backlinks  — inbound @page mentions
        .route("/:id/backlinks", get(handlers::list_backlinks))
        // GET /:id/links      — outbound @page mentions
        .route("/:id/links", get(handlers::list_outbound_links))
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
