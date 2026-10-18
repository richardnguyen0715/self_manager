//! `label` module — managed, coloured labels for work items (Plane-style).
//!
//! `work_items.labels` (text[]) stays the source of truth for assignment by
//! name; this module owns the colour and the rename / recolour / delete
//! management surface.
//!
//! Mounted at `/api/labels` by `main.rs`.

mod handlers;
pub mod models;
mod routes;
pub mod service;

pub use routes::router;
