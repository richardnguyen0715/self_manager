//! Route wiring for the `project` module.
//!
//! Mounted by `main.rs` under the prefix `/api/projects`.
//!
//! | Method | Path                      | Handler                    |
//! |--------|---------------------------|----------------------------|
//! | GET    | /                         | list_projects              |
//! | POST   | /                         | create_project             |
//! | PUT    | /reorder                  | reorder_projects           |
//! | GET    | /:id                      | get_project                |
//! | PATCH  | /:id                      | update_project             |
//! | DELETE | /:id                      | delete_project (soft)      |
//! | POST   | /:id/restore              | restore_project            |
//! | DELETE | /:id/purge                | purge_project (hard)       |

use axum::{
    routing::{delete, get, patch, post, put},
    Router,
};

use crate::shared::state::AppState;

use super::handlers;

/// Build and return the project module router.
///
/// The reorder route (`PUT /reorder`) is registered **before** the `/:id`
/// parameter route so that Axum's router does not treat the literal segment
/// `reorder` as a UUID.
pub fn router() -> Router<AppState> {
    Router::new()
        // Collection endpoints
        .route("/", get(handlers::list_projects))
        .route("/", post(handlers::create_project))
        // Bulk-reorder — must come before `/:id` to avoid param capture
        .route("/reorder", put(handlers::reorder_projects))
        // Item endpoints
        .route("/:id", get(handlers::get_project))
        .route("/:id", patch(handlers::update_project))
        .route("/:id", delete(handlers::delete_project))
        // Soft-delete lifecycle: restore from / purge out of the Trash
        .route("/:id/restore", post(handlers::restore_project))
        .route("/:id/purge", delete(handlers::purge_project))
}
