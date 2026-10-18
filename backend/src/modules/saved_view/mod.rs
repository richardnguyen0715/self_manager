//! `saved_view` module — Plane-style saved views (named filters + display
//! options) for work-item scopes.
//!
//! Mounted at `/api/saved-views` by `main.rs`.
//!
//! | Method   | Path   | Description                                  |
//! |----------|--------|----------------------------------------------|
//! | `GET`    | `/`    | List views (`?scope=&project_id=`)           |
//! | `POST`   | `/`    | Create a view appended at the end of scope   |
//! | `PATCH`  | `/:id` | Rename / replace filters, display, position  |
//! | `DELETE` | `/:id` | Delete a view                                |

mod handlers;
pub mod models;
mod routes;
pub mod service;

pub use routes::router;
