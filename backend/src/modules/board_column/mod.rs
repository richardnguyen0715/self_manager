//! `board_column` module — User-defined board columns with CRUD and drag-reorder.
//!
//! Mounted at `/api/board-columns` by `main.rs`.
//!
//! Columns replace the hardcoded status-based board grouping. The five seeded
//! defaults mirror the existing `work_item_status` enum values so that
//! Backlog / Sprints / Reviews / Analytics views remain unaffected — those
//! views still use the `status` enum column directly.
//!
//! # Endpoints
//!
//! | Method   | Path          | Description                              |
//! |----------|---------------|------------------------------------------|
//! | `GET`    | `/`           | List columns (lazy seed + backfill)      |
//! | `POST`   | `/`           | Create a custom column                   |
//! | `PATCH`  | `/:id`        | Rename / recolor / change wip_limit      |
//! | `DELETE` | `/:id`        | Delete (items reassigned / cleared)      |
//! | `PUT`    | `/reorder`    | Bulk position update                     |

mod handlers;
pub mod models;
mod routes;
pub mod service;

/// Re-export the module router for mounting in `main.rs`.
pub use routes::router;
