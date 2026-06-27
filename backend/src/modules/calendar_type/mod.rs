//! `calendar_type` module — CRUD for user-defined Life Calendar categories.
//!
//! Mounted at `/api/calendar-types` by `main.rs`.

mod handlers;
pub mod models;
mod routes;
pub mod service;

pub use routes::router;
