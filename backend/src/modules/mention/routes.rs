//! Routes for the `mention` module. Mounted at `/api/mentions`.
//!
//! ```text
//! GET  /api/mentions/search     search    (?q=&types=&limit=)
//! GET  /api/mentions/resolve    resolve   (?refs=type:uuid,...)
//! PUT  /api/mentions/sync       sync      { source_type, source_id, targets }
//! GET  /api/mentions/backlinks  backlinks (?target_type=&target_id=)
//! ```

use axum::{
    routing::{get, put},
    Router,
};

use crate::shared::state::AppState;

use super::handlers;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/search", get(handlers::search))
        .route("/resolve", get(handlers::resolve))
        .route("/sync", put(handlers::sync))
        .route("/backlinks", get(handlers::backlinks))
}
