//! Habit module — REST route wiring.
//!
//! All routes are mounted under `/api/habits` by `main.rs`.
//!
//! | Method | Path                          | Handler              |
//! |--------|-------------------------------|----------------------|
//! | GET    | /                             | list_habits          |
//! | POST   | /                             | create_habit         |
//! | GET    | /:id                          | get_habit            |
//! | PATCH  | /:id                          | update_habit         |
//! | DELETE | /:id                          | delete_habit         |
//! | POST   | /:id/archive                  | archive_habit        |
//! | GET    | /:id/logs                     | list_logs            |
//! | POST   | /:id/logs                     | log_habit            |
//! | DELETE | /:id/logs/:log_id             | delete_log           |

use axum::{
    routing::{delete, get, post},
    Router,
};

use crate::shared::state::AppState;

use super::handlers;

/// Build and return the habit module router.
///
/// Mounted at `/api/habits` in `main.rs`.
pub fn router() -> Router<AppState> {
    Router::new()
        // Habit CRUD
        .route("/", get(handlers::list_habits).post(handlers::create_habit))
        .route(
            "/:id",
            get(handlers::get_habit)
                .patch(handlers::update_habit)
                .delete(handlers::delete_habit),
        )
        // Archive (soft-delete)
        .route("/:id/archive", post(handlers::archive_habit))
        // Habit logs
        .route(
            "/:id/logs",
            get(handlers::list_logs).post(handlers::log_habit),
        )
        .route("/:id/logs/:log_id", delete(handlers::delete_log))
}
