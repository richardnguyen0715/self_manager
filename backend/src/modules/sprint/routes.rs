//! Route definitions for the `sprint` module.
//!
//! All routes are mounted under `/api/sprints` by `main.rs`.
//!
//! ```text
//! GET    /api/sprints                        list_sprints
//! POST   /api/sprints                        create_sprint
//! GET    /api/sprints/active                 get_active_sprint
//! GET    /api/sprints/velocity               get_velocity
//! GET    /api/sprints/:id                    get_sprint
//! PATCH  /api/sprints/:id                    update_sprint
//! DELETE /api/sprints/:id                    delete_sprint
//! POST   /api/sprints/:id/activate           activate_sprint
//! POST   /api/sprints/:id/complete           complete_sprint
//! GET    /api/sprints/:id/work-items         list_sprint_work_items
//! GET    /api/sprints/:id/burndown           get_burndown
//! GET    /api/sprints/:id/review             get_review
//! PUT    /api/sprints/:id/review             upsert_review
//! GET    /api/sprints/:id/retrospective      get_retrospective
//! PUT    /api/sprints/:id/retrospective      upsert_retrospective
//! ```
//!
//! IMPORTANT: static segments (`/active`, `/velocity`) MUST be registered
//! before the dynamic segment (`/:id`) so that Axum's router matches them
//! in priority order. Axum uses insertion-order priority for same-method
//! conflicts on overlapping patterns.

use axum::{
    routing::{get, post},
    Router,
};

use crate::shared::state::AppState;

use super::handlers;

/// Build the [`Router`] for this module.
///
/// `main.rs` nests this under `/api/sprints`:
///
/// ```rust,ignore
/// .nest("/sprints", modules::sprint::router())
/// ```
pub fn router() -> Router<AppState> {
    Router::new()
        // ── Collection ──────────────────────────────────────────────────────
        .route("/", get(handlers::list_sprints).post(handlers::create_sprint))
        // ── Static sub-paths (must come before /:id) ────────────────────────
        .route("/active", get(handlers::get_active_sprint))
        .route("/velocity", get(handlers::get_velocity))
        // ── Item ────────────────────────────────────────────────────────────
        .route(
            "/:id",
            get(handlers::get_sprint)
                .patch(handlers::update_sprint)
                .delete(handlers::delete_sprint),
        )
        // ── State transitions ────────────────────────────────────────────────
        .route("/:id/activate", post(handlers::activate_sprint))
        .route("/:id/complete", post(handlers::complete_sprint))
        // ── Nested resources ─────────────────────────────────────────────────
        .route("/:id/work-items", get(handlers::list_sprint_work_items))
        .route("/:id/burndown", get(handlers::get_burndown))
        .route(
            "/:id/review",
            get(handlers::get_review).put(handlers::upsert_review),
        )
        .route(
            "/:id/retrospective",
            get(handlers::get_retrospective).put(handlers::upsert_retrospective),
        )
}
