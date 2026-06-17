//! Realtime module — route definitions.
//!
//! Mounted by `main.rs` at the root `/ws` path (not under `/api`).
//! The single route this module exposes is:
//!
//! | Method | Path | Description |
//! |--------|------|-------------|
//! | `GET`  | `/ws` | WebSocket upgrade endpoint (auth via `?token=<jwt>`) |
//!
//! Because the router is nested at `/ws` in `main.rs`, the handler is
//! registered at `/` within this router, which resolves to `GET /ws`.

use axum::{routing, Router};

use crate::shared::state::AppState;

use super::handlers;

/// Build the realtime module router.
///
/// Called once at startup from `main.rs`, which mounts it at `/ws`.
pub fn router() -> Router<AppState> {
    Router::new().route("/", routing::get(handlers::ws_handler))
}
