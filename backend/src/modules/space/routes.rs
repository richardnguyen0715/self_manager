//! Route definitions for the `space` module.
//!
//! All routes are mounted under `/api/spaces` by `main.rs`.
//!
//! ```text
//! GET    /api/spaces        list_spaces     — ?project_id? filter
//! POST   /api/spaces        create_space
//! GET    /api/spaces/:id    get_space
//! PATCH  /api/spaces/:id    update_space
//! DELETE /api/spaces/:id    delete_space
//! ```

use axum::{routing::get, Router};

use crate::shared::state::AppState;

use super::handlers;

/// Build the [`Router`] for the `space` module.
///
/// `main.rs` nests this under `/api/spaces`:
///
/// ```rust,ignore
/// .nest("/spaces", modules::space::router())
/// ```
pub fn router() -> Router<AppState> {
    Router::new()
        // Collection — list + create
        .route(
            "/",
            get(handlers::list_spaces).post(handlers::create_space),
        )
        // Item — get, partial update, delete
        .route(
            "/:id",
            get(handlers::get_space)
                .patch(handlers::update_space)
                .delete(handlers::delete_space),
        )
}
