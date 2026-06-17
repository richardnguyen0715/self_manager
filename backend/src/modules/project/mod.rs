//! `project` module — CRUD, progress aggregation, and deadline management.
//!
//! Mounted by `main.rs` at `/api/projects`.
//!
//! ## Sub-modules
//!
//! | Module     | Responsibility                                    |
//! |------------|---------------------------------------------------|
//! | `models`   | DB row structs, DTOs, request/response types      |
//! | `service`  | Business logic, SQL queries, event publication    |
//! | `handlers` | Axum handlers: extract auth, call service, respond|
//! | `routes`   | Router wiring; exposes `router()`                 |

pub mod handlers;
pub mod models;
pub mod routes;
pub mod service;

pub use routes::router;
