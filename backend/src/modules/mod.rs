//! Module registry for the modular-monolith backend.
//!
//! Each sub-module exposes a `pub fn router() -> axum::Router<AppState>` that
//! `main.rs` mounts under the appropriate path prefix.
//!
//! Foundation owns this file. Module agents own only their own sub-directory.

pub mod analytics;
pub mod auth;
pub mod backlog;
pub mod board_column;
pub mod calendar;
pub mod calendar_type;
pub mod dashboard;
pub mod database;
pub mod doc_comment;
pub mod doc_search;
pub mod public_docs;
pub mod epic;
pub mod goal;
pub mod habit;
pub mod initiative;
pub mod notification;
pub mod organization;
pub mod page;
pub mod project;
pub mod realtime;
pub mod retrospective;
pub mod review;
pub mod search;
pub mod settings;
pub mod space;
pub mod sprint;
pub mod task;
pub mod timeblock;
pub mod trash;
pub mod work_item;
