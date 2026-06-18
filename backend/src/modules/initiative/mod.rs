//! `initiative` module — Initiative CRUD and initiative→epics hierarchy.
//!
//! Mounted at `/api/initiatives` by `main.rs`.
//!
//! An **Initiative** is a strategic bucket that lives under a [`Goal`] and
//! groups related [`Epic`]s (e.g. "Backend Mastery" under the goal
//! "Become Senior Engineer").
//!
//! # Endpoints
//!
//! | Method   | Path                      | Description                     |
//! |----------|---------------------------|---------------------------------|
//! | `GET`    | `/`                       | List initiatives (paginated)    |
//! | `POST`   | `/`                       | Create initiative               |
//! | `GET`    | `/:id`                    | Get initiative by ID            |
//! | `PATCH`  | `/:id`                    | Update initiative (partial)     |
//! | `DELETE` | `/:id`                    | Delete initiative               |
//! | `GET`    | `/:id/epics`              | List epics under this initiative|
//!
//! # Ownership invariant
//!
//! Every query enforces `user_id = <auth user>` so that users can only access
//! their own data. A missing or foreign row returns `404 Not Found`.
//!
//! # Enum-as-text pattern
//!
//! The `initiative_status` postgres enum is never registered as a SQLx type.
//! Services project it as `status::text AS "status!"`, filter with
//! `status::text = $n`, and bind inserts/updates via `($n::text)::initiative_status`.
//! The Rust model carries `pub status: String`; the typed [`InitiativeStatus`]
//! enum lives in the request/response layer only.

mod handlers;
pub mod models;
mod routes;
pub mod service;

/// Re-export the module router for mounting in `main.rs`.
pub use routes::router;
