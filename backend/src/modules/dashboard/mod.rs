//! `dashboard` module — aggregated today view.
//!
//! Exposes a single [`router()`] function mounted by `main.rs` at
//! `/api/dashboard`.  The module is read-only: it aggregates data from tasks,
//! habits, calendar events, and time blocks without owning any tables.
//!
//! # Endpoints
//!
//! | Method | Path              | Description                                 |
//! |--------|-------------------|---------------------------------------------|
//! | GET    | /api/dashboard    | Full snapshot: tasks/habits/events/blocks + stats |
//! | GET    | /api/dashboard/stats | Quick-stats counters only                |

pub mod handlers;
pub mod models;
pub mod routes;
pub mod service;

/// Returns the dashboard sub-router to be mounted at `/api/dashboard`.
pub fn router() -> axum::Router<crate::shared::state::AppState> {
    routes::router()
}
