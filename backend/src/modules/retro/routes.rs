//! Routes for the `retro` module. Mounted at `/api/retros`.
//!
//! Static segments (`/templates`, `/open`, `/trends`, `/by-target`,
//! `/actions`, `/entries/:id`, `/links/:id`) are registered alongside `/:id`;
//! matchit prefers the static segment, so they are never shadowed.

use axum::{
    routing::{delete, get, patch, post},
    Router,
};

use crate::shared::state::AppState;

use super::handlers;

pub fn router() -> Router<AppState> {
    Router::new()
        // ── Templates ───────────────────────────────────────────────────────
        .route(
            "/templates",
            get(handlers::list_templates).post(handlers::create_template),
        )
        .route(
            "/templates/:id",
            patch(handlers::update_template).delete(handlers::delete_template),
        )
        // ── Retros: collection & static paths ───────────────────────────────
        .route("/open", post(handlers::open_retro))
        .route("/trends", get(handlers::trends))
        .route("/by-target", get(handlers::by_target))
        .route("/", get(handlers::list_retros))
        // ── Entries & links & actions by their own id ───────────────────────
        .route(
            "/entries/:entry_id",
            patch(handlers::update_entry).delete(handlers::delete_entry),
        )
        .route("/links/:link_id", delete(handlers::delete_link))
        .route("/actions", get(handlers::list_actions))
        .route(
            "/actions/:action_id",
            patch(handlers::update_action).delete(handlers::delete_action),
        )
        .route("/actions/:action_id/convert", post(handlers::convert_action))
        // ── Single retro ────────────────────────────────────────────────────
        .route(
            "/:id",
            get(handlers::get_retro)
                .patch(handlers::update_retro)
                .delete(handlers::delete_retro),
        )
        .route("/:id/refresh-snapshot", post(handlers::refresh_snapshot))
        .route("/:id/complete", post(handlers::complete_retro))
        .route("/:id/reopen", post(handlers::reopen_retro))
        .route("/:id/sections/:section_id", patch(handlers::update_section))
        .route("/:id/entries", post(handlers::create_entry))
        .route("/:id/links", post(handlers::create_link))
        .route("/:id/actions", post(handlers::create_action))
}
