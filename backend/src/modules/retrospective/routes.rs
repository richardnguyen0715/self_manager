//! Route definitions for the `retrospective` module.
//!
//! These routes are mounted under `/api/sprints` by `main.rs` (or by the
//! sprint module's router), so the full paths become:
//!
//! ```text
//! GET  /api/sprints/:sprint_id/retrospective   get_retrospective
//! PUT  /api/sprints/:sprint_id/retrospective   upsert_retrospective
//! ```
//!
//! The router exposes `/:sprint_id/retrospective` relative to its mount point.

use axum::{
    routing::get,
    Router,
};

use crate::shared::state::AppState;

use super::handlers;

/// Build the [`Router`] for this module.
///
/// `main.rs` (or the sprint router) nests this under `/api/sprints`:
///
/// ```rust,ignore
/// .nest("/sprints", modules::retrospective::router())
/// ```
///
/// Resulting endpoints:
/// - `GET  /sprints/:sprint_id/retrospective`
/// - `PUT  /sprints/:sprint_id/retrospective`
pub fn router() -> Router<AppState> {
    Router::new().route(
        "/:sprint_id/retrospective",
        get(handlers::get_retrospective).put(handlers::upsert_retrospective),
    )
}
