//! Routes for the `calendar_type` module. Mounted at `/api/calendar-types`.
//!
//! ```text
//! GET    /api/calendar-types       list_types
//! POST   /api/calendar-types       create_type
//! GET    /api/calendar-types/:id   get_type
//! PATCH  /api/calendar-types/:id   update_type
//! DELETE /api/calendar-types/:id   delete_type
//! ```

use axum::{routing::get, Router};

use crate::shared::state::AppState;

use super::handlers;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(handlers::list_types).post(handlers::create_type))
        .route(
            "/:id",
            get(handlers::get_type)
                .patch(handlers::update_type)
                .delete(handlers::delete_type),
        )
}
