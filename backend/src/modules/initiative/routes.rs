//! Route definitions for the `initiative` module.
//!
//! All routes are mounted under `/api/initiatives` by `main.rs`.
//!
//! ```text
//! GET    /api/initiatives               list_initiatives
//! POST   /api/initiatives               create_initiative
//! GET    /api/initiatives/:id           get_initiative
//! PATCH  /api/initiatives/:id           update_initiative
//! DELETE /api/initiatives/:id           delete_initiative
//! GET    /api/initiatives/:id/epics     list_initiative_epics
//! ```

use axum::{routing::get, Router};

use crate::shared::state::AppState;

use super::handlers;

/// Build the [`Router`] for this module.
///
/// `main.rs` nests this under `/api/initiatives`:
///
/// ```rust,ignore
/// .nest("/initiatives", modules::initiative::router())
/// ```
pub fn router() -> Router<AppState> {
    Router::new()
        // Collection endpoints
        .route(
            "/",
            get(handlers::list_initiatives).post(handlers::create_initiative),
        )
        // Item endpoints
        .route(
            "/:id",
            get(handlers::get_initiative)
                .patch(handlers::update_initiative)
                .delete(handlers::delete_initiative),
        )
        // Sub-resource: epics under this initiative
        .route("/:id/epics", get(handlers::list_initiative_epics))
}
