//! `habit` module — habit tracking with check/count/duration types,
//! configurable frequency, streak calculation, and completion-rate analytics.
//!
//! # Sub-modules
//!
//! - [`models`]   — domain structs, DB row types, request/response DTOs.
//! - [`service`]  — business logic; owns all SQL queries.
//! - [`handlers`] — Axum handler functions (thin HTTP → service bridge).
//! - [`routes`]   — router construction; wires handlers to REST paths.
//!
//! # Router contract
//!
//! [`router()`] returns an `axum::Router<AppState>` mounted at `/api/habits`
//! by `main.rs`.

pub mod handlers;
pub mod models;
pub mod routes;
pub mod service;

use axum::Router;

use crate::shared::state::AppState;

/// Construct the habit module router.
///
/// Delegates to [`routes::router`] so that `modules/mod.rs` only needs to
/// call `habit::router()`.
pub fn router() -> Router<AppState> {
    routes::router()
}
