//! `mention` module — the generic `@mention` graph.
//!
//! Editors (work item descriptions, doc pages, retro notes) store the targets
//! they reference in the `mentions` table via `PUT /api/mentions/sync`. The
//! picker uses `search`, chips use `resolve` (live titles) and "Mentioned in"
//! uses `backlinks`. Design: `design/mentions-and-retro-notes.md`, section 3-4.
//! Mounted at `/api/mentions` by `main.rs`.

mod handlers;
pub mod models;
mod routes;
pub mod service;

pub use routes::router;
