//! Routes for the `estimate` module. Mounted at `/api/estimate-systems`.
//!
//! ```text
//! GET /api/estimate-systems   list_estimate_systems
//! ```

use axum::{routing::get, Router};

use crate::shared::state::AppState;

use super::handlers;

pub fn router() -> Router<AppState> {
    Router::new().route("/", get(handlers::list_estimate_systems))
}
