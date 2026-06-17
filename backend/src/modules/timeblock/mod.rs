//! `timeblock` module — time block CRUD, focus session lifecycle, and domain
//! event emission.
//!
//! # Responsibilities
//!
//! - CRUD for `time_blocks` (create, list, get, update, delete).
//! - Focus session lifecycle: start → pause → resume → finish.
//! - Link a time block to a task (verified to belong to the same user).
//! - Track estimated vs. actual duration via `actual_start` / `actual_end`.
//! - Emit [`crate::shared::events::DomainEvent::TimeBlockFinished`] on session
//!   completion so that analytics and notification modules can react.
//!
//! # Router contract
//!
//! `main.rs` mounts the router returned by [`router`] at `/api/timeblocks`.

pub mod handlers;
pub mod models;
pub mod routes;
pub mod service;

use axum::Router;

use crate::shared::state::AppState;

/// Returns the fully wired `timeblock` router.
///
/// Satisfies the contract required by `main.rs`: every module exposes
/// `pub fn router() -> axum::Router<AppState>`.
pub fn router() -> Router<AppState> {
    routes::router()
}
