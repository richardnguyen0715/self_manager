//! `retrospective` module — Sprint retrospective upsert and retrieval.
//!
//! Mounted at `/api/sprints` by `main.rs`, contributing two endpoints:
//!
//! | Method | Path                                 | Handler              |
//! |--------|--------------------------------------|----------------------|
//! | `GET`  | `/sprints/:sprint_id/retrospective`  | get retrospective    |
//! | `PUT`  | `/sprints/:sprint_id/retrospective`  | upsert retrospective |
//!
//! # Design
//!
//! There is exactly one retrospective per sprint (`UNIQUE (sprint_id)` in the
//! DB). The `PUT` endpoint is an upsert: on first call it inserts; on
//! subsequent calls it merges the supplied fields onto the existing row (fields
//! omitted from the request body are preserved from the stored values).
//!
//! Ownership is enforced at the sprint level: the sprint must belong to the
//! authenticated user (`sprints.user_id = auth.user_id`) before any read or
//! write is allowed.

mod handlers;
pub mod models;
mod routes;
pub mod service;

/// Re-export the module router for mounting in `main.rs`.
pub use routes::router;
