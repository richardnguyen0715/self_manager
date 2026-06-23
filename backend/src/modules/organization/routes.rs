//! Route wiring for the `organization` module.
//!
//! Mounted by `main.rs` under the prefix `/api/organizations`.
//!
//! | Method | Path  | Handler              |
//! |--------|-------|----------------------|
//! | GET    | /     | list_organizations   |
//! | POST   | /     | create_organization  |
//! | GET    | /:id  | get_organization     |
//! | PATCH  | /:id  | update_organization  |
//! | DELETE | /:id  | delete_organization  |

use axum::{
    routing::{delete, get, patch, post},
    Router,
};

use crate::shared::state::AppState;

use super::handlers;

/// Build and return the organization module router.
pub fn router() -> Router<AppState> {
    Router::new()
        // Collection endpoints
        .route("/", get(handlers::list_organizations))
        .route("/", post(handlers::create_organization))
        // Item endpoints
        .route("/:id", get(handlers::get_organization))
        .route("/:id", patch(handlers::update_organization))
        .route("/:id", delete(handlers::delete_organization))
}
