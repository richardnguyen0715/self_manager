//! `sprint` module — Sprint CRUD, activation, completion, burndown, and velocity.
//!
//! Mounted at `/api/sprints` by `main.rs`.
//!
//! # Endpoints
//!
//! | Method | Path | Handler |
//! |--------|------|---------|
//! | GET    | `/`                    | list sprints                         |
//! | POST   | `/`                    | create sprint                        |
//! | GET    | `/active`              | get currently active sprint (or 404) |
//! | GET    | `/velocity`            | velocity for last N completed sprints |
//! | GET    | `/:id`                 | get sprint (with derived fields)     |
//! | PATCH  | `/:id`                 | partial update sprint                |
//! | DELETE | `/:id`                 | delete sprint (204)                  |
//! | POST   | `/:id/activate`        | activate sprint; 409 if another active |
//! | POST   | `/:id/complete`        | complete sprint; auto-creates review |
//! | GET    | `/:id/work-items`      | list work items in sprint            |
//! | GET    | `/:id/burndown`        | burndown chart data                  |
//! | GET    | `/:id/review`          | get sprint review (or 404)           |
//! | PUT    | `/:id/review`          | upsert sprint review                 |
//! | GET    | `/:id/retrospective`   | get retrospective (or 404)           |
//! | PUT    | `/:id/retrospective`   | upsert retrospective                 |
//!
//! # Key business rules
//!
//! - At most one `active` sprint per user (DB partial unique index +
//!   service guard; returns **409 Conflict** on violation).
//! - Completing a sprint auto-inserts/upserts a [`models::SprintReviewResponse`]
//!   with `planned_points`, `completed_points`, and `velocity` (%).
//! - Emits [`crate::shared::events::DomainEvent::SprintStarted`] on activate
//!   and [`crate::shared::events::DomainEvent::SprintCompleted`] on complete.

mod handlers;
pub mod models;
mod routes;
pub mod service;

/// Re-export the module router for mounting in `main.rs`.
pub use routes::router;
