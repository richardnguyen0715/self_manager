//! `backlog` module — logical view over unscheduled work items.
//!
//! The backlog is **not** a separate database table; it is the subset of
//! `work_items` rows where `sprint_id IS NULL`.  This module exposes a single
//! read endpoint that lists those items, with optional `epic_id` filtering and
//! standard `limit`/`offset` pagination.
//!
//! Mounted at `/api/backlog` by `main.rs`.
//!
//! # Endpoints
//!
//! | Method | Path         | Handler        | Description                         |
//! |--------|--------------|----------------|-------------------------------------|
//! | `GET`  | `/`          | `list_backlog` | List backlog items (`sprint_id NULL`) |
//!
//! # Backlog flow
//!
//! ```text
//! Inbox  ──create──▶  Backlog (sprint_id = NULL)
//!                         │
//!                  sprint planning
//!                         │
//!                         ▼
//!                    Sprint  (sprint_id = <uuid>)
//! ```
//!
//! Moving an item from backlog into a sprint is handled by
//! `PATCH /api/work-items/:id/sprint` (the `work_item` module).  This module
//! only provides the read side.

mod handlers;
pub mod models;
mod routes;
pub mod service;

/// Re-export the module router for mounting in `main.rs`.
pub use routes::router;
