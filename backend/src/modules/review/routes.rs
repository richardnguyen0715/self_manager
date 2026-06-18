//! Route definitions for the `review` module.
//!
//! This module owns `GET` and `PUT` on `/:sprint_id/review`, relative to the
//! `/api/sprints` prefix. The sprint module nests this router:
//!
//! ```rust,ignore
//! // inside sprint::routes::router():
//! .nest("/:id", modules::review::router())
//! ```
//!
//! Which produces the full paths:
//!
//! ```text
//! GET  /api/sprints/:id/review   get_review
//! PUT  /api/sprints/:id/review   upsert_review
//! ```
//!
//! The `:id` path segment from the outer nest is re-exposed as `:sprint_id`
//! inside each handler via `Path<Uuid>`.

use axum::{routing::get, Router};

use crate::shared::state::AppState;

use super::handlers;

/// Build the [`Router`] for this module.
///
/// Intended to be nested inside the sprint router at `/:id`:
///
/// ```rust,ignore
/// // sprint::routes
/// Router::new()
///     .route("/:id", …)
///     .nest("/:id", modules::review::router())
/// ```
pub fn router() -> Router<AppState> {
    Router::new().route("/review", get(handlers::get_review).put(handlers::upsert_review))
}
