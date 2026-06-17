//! Calendar module.
//!
//! Owns the `calendar_events` table and exposes REST endpoints for creating,
//! reading, updating, and deleting calendar events, including day/week/month
//! range queries.
//!
//! Mounted at `/api/calendar` by `main.rs`.

pub mod handlers;
pub mod models;
pub mod routes;
pub mod service;

pub use routes::router;
