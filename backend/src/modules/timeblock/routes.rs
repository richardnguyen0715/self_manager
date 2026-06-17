//! Route wiring for the `timeblock` module.
//!
//! Mounted by `main.rs` at `/api/timeblocks`.
//!
//! # Endpoint map
//!
//! | Method | Path                                                              | Handler                   |
//! |--------|-------------------------------------------------------------------|---------------------------|
//! | POST   | `/api/timeblocks`                                                 | create_time_block         |
//! | GET    | `/api/timeblocks`                                                 | list_time_blocks          |
//! | GET    | `/api/timeblocks/:id`                                             | get_time_block            |
//! | PATCH  | `/api/timeblocks/:id`                                             | update_time_block         |
//! | DELETE | `/api/timeblocks/:id`                                             | delete_time_block         |
//! | GET    | `/api/timeblocks/:id/focus-sessions`                              | list_focus_sessions       |
//! | POST   | `/api/timeblocks/:id/focus-sessions`                              | start_focus_session       |
//! | PATCH  | `/api/timeblocks/:id/focus-sessions/:session_id/pause`            | pause_focus_session       |
//! | PATCH  | `/api/timeblocks/:id/focus-sessions/:session_id/resume`           | resume_focus_session      |
//! | PATCH  | `/api/timeblocks/:id/focus-sessions/:session_id/finish`           | finish_focus_session      |

use axum::{
    routing::{get, patch, post},
    Router,
};

use crate::shared::state::AppState;

use super::handlers;

/// Build the `timeblock` sub-router.
///
/// The returned [`Router`] is parameterised over [`AppState`] to satisfy the
/// contract required by `main.rs`.
pub fn router() -> Router<AppState> {
    Router::new()
        // ── Time block CRUD ───────────────────────────────────────────────────
        .route(
            "/",
            post(handlers::create_time_block).get(handlers::list_time_blocks),
        )
        .route(
            "/:id",
            get(handlers::get_time_block)
                .patch(handlers::update_time_block)
                .delete(handlers::delete_time_block),
        )
        // ── Focus sessions ────────────────────────────────────────────────────
        .route(
            "/:id/focus-sessions",
            get(handlers::list_focus_sessions).post(handlers::start_focus_session),
        )
        .route(
            "/:id/focus-sessions/:session_id/pause",
            patch(handlers::pause_focus_session),
        )
        .route(
            "/:id/focus-sessions/:session_id/resume",
            patch(handlers::resume_focus_session),
        )
        .route(
            "/:id/focus-sessions/:session_id/finish",
            patch(handlers::finish_focus_session),
        )
}
