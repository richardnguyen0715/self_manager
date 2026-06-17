//! `goal` module — Goal CRUD and goal→projects hierarchy.
//!
//! Mounted at `/api/goals` by `main.rs`.
//!
//! # Endpoints
//!
//! | Method   | Path                      | Handler                  |
//! |----------|---------------------------|--------------------------|
//! | `GET`    | `/`                       | list goals               |
//! | `POST`   | `/`                       | create goal              |
//! | `GET`    | `/:id`                    | get goal                 |
//! | `PATCH`  | `/:id`                    | update goal (partial)    |
//! | `DELETE` | `/:id`                    | delete goal              |
//! | `PATCH`  | `/:id/position`           | reorder goal             |
//! | `GET`    | `/:id/projects`           | list projects under goal |

mod handlers;
pub mod models;
mod routes;
pub mod service;

/// Re-export the module router for mounting in `main.rs`.
pub use routes::router;
