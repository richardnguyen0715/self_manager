//! Analytics router — wires HTTP paths to handler functions.
//!
//! Mounted by `main.rs` at `/api/analytics`.
//!
//! | Method | Path                          | Handler                  | Auth |
//! |--------|-------------------------------|--------------------------|------|
//! | GET    | /summary                      | get_summary              | yes  |
//! | GET    | /daily                        | get_daily_series         | yes  |
//! | GET    | /time-usage                   | get_time_usage           | yes  |
//! | GET    | /completion-rate              | get_completion_rate      | yes  |
//! | POST   | /refresh                      | refresh_today            | yes  |
//! | POST   | /refresh/:date                | refresh_date             | yes  |

use axum::{
    routing::{get, post},
    Router,
};

use crate::shared::state::AppState;

use super::handlers;

/// Returns the analytics sub-router.
///
/// This function is called once at startup by `main.rs`:
/// ```rust,ignore
/// .nest("/analytics", modules::analytics::router())
/// ```
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/summary", get(handlers::get_summary))
        .route("/daily", get(handlers::get_daily_series))
        .route("/time-usage", get(handlers::get_time_usage))
        .route("/completion-rate", get(handlers::get_completion_rate))
        .route("/refresh", post(handlers::refresh_today))
        .route("/refresh/:date", post(handlers::refresh_date))
}
