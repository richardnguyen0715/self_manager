//! `review` module — Sprint Review CRUD.
//!
//! Owns the `sprint_reviews` table and exposes two endpoints nested inside the
//! sprint router at `/api/sprints/:id/review`:
//!
//! | Method | Path                          | Handler          |
//! |--------|-------------------------------|------------------|
//! | `GET`  | `/api/sprints/:id/review`     | get review       |
//! | `PUT`  | `/api/sprints/:id/review`     | upsert review    |
//!
//! ## Responsibility
//!
//! - **Read** the review for a completed (or in-progress) sprint.
//! - **Upsert** the review: create it if absent, update it if present.
//!   On creation, `planned_points` is derived from the sprint's work items and
//!   `completed_points` from the sprint's stored column. On update, only fields
//!   present in the request body are changed.
//! - `velocity` is always recomputed: `(completed / planned) * 100`, clamped
//!   to `[0.0, 100.0]`.
//!
//! ## Mounting
//!
//! The `sprint` module nests `review::router()` under `/:id`:
//!
//! ```rust,ignore
//! // inside sprint::routes::router()
//! .nest("/:id", modules::review::router())
//! ```

mod handlers;
pub mod models;
mod routes;
pub mod service;

/// Re-export the module router for nesting inside `sprint::routes`.
pub use routes::router;
