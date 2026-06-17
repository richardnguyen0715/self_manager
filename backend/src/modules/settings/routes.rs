//! Route wiring for the `settings` module.
//!
//! All routes are mounted under `/api/settings` by `main.rs`.
//!
//! | Method | Path                        | Handler                  | Auth |
//! |--------|-----------------------------|--------------------------|------|
//! | GET    | `/appearance`               | get_appearance           | yes  |
//! | PATCH  | `/appearance`               | update_appearance        | yes  |
//! | GET    | `/notifications`            | get_notification_prefs   | yes  |
//! | PATCH  | `/notifications`            | update_notification_prefs| yes  |
//! | POST   | `/account/password`         | change_password          | yes  |
//! | POST   | `/account/delete`           | delete_account           | yes  |

use axum::{
    routing::{get, post},
    Router,
};

use crate::shared::state::AppState;

use super::handlers;

/// Build and return the settings sub-router.
///
/// Mounted at `/api/settings` by `main.rs`.
pub fn router() -> Router<AppState> {
    Router::new()
        // ── Appearance ────────────────────────────────────────────────────────
        .route(
            "/appearance",
            get(handlers::get_appearance).patch(handlers::update_appearance),
        )
        // ── Notification preferences ──────────────────────────────────────────
        .route(
            "/notifications",
            get(handlers::get_notification_prefs).patch(handlers::update_notification_prefs),
        )
        // ── Account management ────────────────────────────────────────────────
        .route("/account/password", post(handlers::change_password))
        .route("/account/delete", post(handlers::delete_account))
}
