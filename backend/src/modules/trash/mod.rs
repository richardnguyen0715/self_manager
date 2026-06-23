//! `trash` module — aggregates soft-deleted rows across `work_items`, `tasks`,
//! and `projects` into a single recycle-bin view.
//!
//! Mounted by `main.rs` at `/api/trash`.
//!
//! ## Sub-modules
//!
//! | Module     | Responsibility                                      |
//! |------------|-----------------------------------------------------|
//! | `service`  | SQL queries selecting rows with `deleted_at IS NOT NULL` |
//! | `handlers` | Axum handler: extract auth, call service, respond   |
//!
//! Response/list shapes are reused from the `work_item`, `task`, and `project`
//! modules — this module intentionally defines no DTOs of its own.

pub mod handlers;
pub mod service;

use axum::{routing::get, Router};

use crate::shared::state::AppState;

/// Build and return the trash module router.
///
/// | Method | Path | Handler    |
/// |--------|------|------------|
/// | GET    | /    | get_trash  |
pub fn router() -> Router<AppState> {
    Router::new().route("/", get(handlers::get_trash))
}
