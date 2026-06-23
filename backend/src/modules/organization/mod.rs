//! `organization` module — personal grouping layer above projects.
//!
//! Mounted by `main.rs` at `/api/organizations`.
//!
//! ## Sub-modules
//!
//! | Module     | Responsibility                                    |
//! |------------|---------------------------------------------------|
//! | `models`   | DB row structs, DTOs, request/response types      |
//! | `service`  | Business logic, SQL queries                       |
//! | `handlers` | Axum handlers: extract auth, call service, respond|
//! | `routes`   | Router wiring; exposes `router()`                 |

pub mod handlers;
pub mod models;
pub mod routes;
pub mod service;

pub use routes::router;
