//! `retro` module — periodic reviews and retrospectives linked to any object.
//!
//! Design and API contract: `design/retro-system.md` (migration `0021_retros`).
//! Mounted at `/api/retros` by `main.rs`.

mod handlers;
mod links;
pub mod models;
mod routes;
mod service;
mod snapshot;

pub use routes::router;
