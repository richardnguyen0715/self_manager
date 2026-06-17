//! `analytics` module.
//!
//! # Responsibilities
//! - Ingest domain events from the broadcast channel into `analytics_events`.
//! - Maintain pre-aggregated `daily_stats` rows (upserted on every relevant
//!   domain event and on-demand via the HTTP API).
//! - Expose a REST API for daily/weekly/monthly productivity statistics,
//!   time-usage breakdown, and task completion rate.
//!
//! # Public surface
//! - [`router`] — called once by `main.rs` and mounted at `/api/analytics`.
//! - [`listener::spawn_listener`] — called once by `main.rs` to start the
//!   background domain-event consumer.
//!
//! # Submodules
//! | File          | Role                                    |
//! |---------------|-----------------------------------------|
//! | `models.rs`   | DB row types + request/response DTOs    |
//! | `service.rs`  | All SQL queries (pure business logic)   |
//! | `handlers.rs` | Axum handler functions                  |
//! | `routes.rs`   | Router wiring                           |
//! | `listener.rs` | Background domain-event consumer task   |

pub mod handlers;
pub mod listener;
pub mod models;
pub mod routes;
pub mod service;

use axum::Router;

use crate::shared::state::AppState;

/// Returns the analytics router mounted at `/api/analytics` by `main.rs`.
///
/// Also re-exports [`listener::spawn_listener`] so callers can start the
/// background task with a single `use` import.
pub fn router() -> Router<AppState> {
    routes::router()
}
