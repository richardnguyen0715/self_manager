//! Routes for the `saved_view` module. Mounted at `/api/saved-views`.
//!
//! ```text
//! GET    /api/saved-views        list_saved_views
//! POST   /api/saved-views        create_saved_view
//! PATCH  /api/saved-views/:id    update_saved_view
//! DELETE /api/saved-views/:id    delete_saved_view
//! ```

use axum::{routing::get, Router};

use crate::shared::state::AppState;

use super::handlers;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(handlers::list_saved_views).post(handlers::create_saved_view))
        .route(
            "/:id",
            axum::routing::patch(handlers::update_saved_view).delete(handlers::delete_saved_view),
        )
}
