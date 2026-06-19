//! `space` module — Space CRUD for the Confluence-style Docs feature.
//!
//! A Space is a user-owned container of pages. Spaces may optionally be
//! associated with a project via the nullable `project_id` foreign key.
//!
//! Mounted at `/api/spaces` by `main.rs`.
//!
//! # Endpoints
//!
//! | Method   | Path          | Handler         |
//! |----------|---------------|-----------------|
//! | `GET`    | `/`           | list spaces     |
//! | `POST`   | `/`           | create space    |
//! | `GET`    | `/:id`        | get space       |
//! | `PATCH`  | `/:id`        | update space    |
//! | `DELETE` | `/:id`        | delete space    |

mod handlers;
pub mod models;
mod routes;
pub mod service;

/// Re-export the module router for mounting in `main.rs`.
pub use routes::router;
