//! Module registry for the modular-monolith backend.
//!
//! Each sub-module exposes a `pub fn router() -> axum::Router<AppState>` that
//! `main.rs` mounts under the appropriate path prefix.
//!
//! Foundation owns this file. Module agents own only their own sub-directory.

pub mod analytics;
pub mod auth;
pub mod calendar;
pub mod dashboard;
pub mod goal;
pub mod habit;
pub mod notification;
pub mod project;
pub mod realtime;
pub mod search;
pub mod settings;
pub mod task;
pub mod timeblock;
