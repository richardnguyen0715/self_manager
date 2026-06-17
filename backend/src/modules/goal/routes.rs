//! Route definitions for the `goal` module.
//!
//! All routes are mounted under `/api/goals` by `main.rs`.
//!
//! ```text
//! GET    /api/goals                     list_goals
//! POST   /api/goals                     create_goal
//! GET    /api/goals/:id                 get_goal
//! PATCH  /api/goals/:id                 update_goal
//! DELETE /api/goals/:id                 delete_goal
//! PATCH  /api/goals/:id/position        reorder_goal
//! GET    /api/goals/:id/projects        list_goal_projects
//! ```

use axum::{
    routing::{get, patch},
    Router,
};

use crate::shared::state::AppState;

use super::handlers;

/// Build the [`Router`] for this module.
///
/// `main.rs` nests this under `/api/goals`:
///
/// ```rust,ignore
/// .nest("/goals", modules::goal::router())
/// ```
pub fn router() -> Router<AppState> {
    Router::new()
        // Collection endpoints
        .route("/", get(handlers::list_goals).post(handlers::create_goal))
        // Item endpoints
        .route(
            "/:id",
            get(handlers::get_goal)
                .patch(handlers::update_goal)
                .delete(handlers::delete_goal),
        )
        // Sub-resource: reorder
        .route("/:id/position", patch(handlers::reorder_goal))
        // Sub-resource: projects under this goal
        .route("/:id/projects", get(handlers::list_goal_projects))
}
