//! Routes for the `custom_property` module. Mounted at `/api/custom-properties`.
//!
//! ```text
//! GET    /api/custom-properties                                  list_properties   (?project_id=)
//! POST   /api/custom-properties                                  create_property
//! GET    /api/custom-properties/values                           list_project_values (?project_id=)
//! PATCH  /api/custom-properties/:id                              update_property
//! DELETE /api/custom-properties/:id                              delete_property
//! GET    /api/custom-properties/work-items/:work_item_id         list_work_item_values
//! PUT    /api/custom-properties/work-items/:work_item_id/:property_id  set_value
//! ```

use axum::{
    routing::{get, patch, put},
    Router,
};

use crate::shared::state::AppState;

use super::handlers;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/",
            get(handlers::list_properties).post(handlers::create_property),
        )
        .route("/values", get(handlers::list_project_values))
        .route(
            "/:id",
            patch(handlers::update_property).delete(handlers::delete_property),
        )
        .route(
            "/work-items/:work_item_id",
            get(handlers::list_work_item_values),
        )
        .route(
            "/work-items/:work_item_id/:property_id",
            put(handlers::set_value),
        )
}
