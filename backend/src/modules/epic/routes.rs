//! Route definitions for the `epic` module.
//!
//! All routes are mounted under `/api/epics` by `main.rs`.
//!
//! ```text
//! GET    /api/epics                        list_epics
//! POST   /api/epics                        create_epic
//! GET    /api/epics/:id                    get_epic
//! PATCH  /api/epics/:id                    update_epic
//! DELETE /api/epics/:id                    delete_epic
//! GET    /api/epics/:id/work-items         list_epic_work_items
//! ```

use axum::{
    routing::get,
    Router,
};

use crate::shared::state::AppState;

use super::handlers;

/// Build the [`Router`] for this module.
///
/// `main.rs` nests this under `/api/epics`:
///
/// ```rust,ignore
/// .nest("/epics", modules::epic::router())
/// ```
pub fn router() -> Router<AppState> {
    Router::new()
        // Collection endpoints
        .route("/", get(handlers::list_epics).post(handlers::create_epic))
        // Item endpoints
        .route(
            "/:id",
            get(handlers::get_epic)
                .patch(handlers::update_epic)
                .delete(handlers::delete_epic),
        )
        // Sub-resource: work items under this epic
        .route("/:id/work-items", get(handlers::list_epic_work_items))
}
