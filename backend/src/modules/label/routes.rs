//! Routes for the `label` module. Mounted at `/api/labels`.
//!
//! ```text
//! GET    /api/labels       list_labels   (?project_id=)
//! POST   /api/labels       create_label
//! PATCH  /api/labels/:id   update_label  (rename + recolour)
//! DELETE /api/labels/:id   delete_label
//! ```

use axum::{
    routing::{get, patch},
    Router,
};

use crate::shared::state::AppState;

use super::handlers;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(handlers::list_labels).post(handlers::create_label))
        .route(
            "/:id",
            patch(handlers::update_label).delete(handlers::delete_label),
        )
}
