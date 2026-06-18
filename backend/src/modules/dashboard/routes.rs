//! Dashboard router.
//!
//! Mounted by `main.rs` at `/api/dashboard`.
//!
//! | Method | Path      | Handler               | Auth |
//! |--------|-----------|-----------------------|------|
//! | GET    | /         | get_dashboard         | yes  |
//! | GET    | /stats    | get_stats             | yes  |
//! | GET    | /sprint   | get_sprint_dashboard  | yes  |

use axum::{routing::get, Router};

use crate::shared::state::AppState;

use super::handlers;

/// Returns the dashboard sub-router.
///
/// Called once at startup by `main.rs`:
/// ```rust,ignore
/// .nest("/dashboard", modules::dashboard::router())
/// ```
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(handlers::get_dashboard))
        .route("/stats", get(handlers::get_stats))
        // NEW: sprint-centric view added by agile OS migration (0003_agile.sql).
        // IMPORTANT: register `/sprint` before any `/:id`-style catch-all routes
        // (there are none in this router, but keeping the convention explicit).
        .route("/sprint", get(handlers::get_sprint_dashboard))
}
