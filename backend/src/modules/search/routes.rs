//! Route wiring for the `search` module.
//!
//! Mounted by `main.rs` under `/api/search`.

use axum::{routing::get, Router};

use crate::shared::state::AppState;

use super::handlers;

/// Build the search module router.
///
/// # Routes
///
/// | Method | Path          | Handler            | Auth |
/// |--------|---------------|--------------------|------|
/// | GET    | `/api/search` | [`handlers::search`] | Yes |
pub fn router() -> Router<AppState> {
    Router::new().route("/", get(handlers::search))
}
