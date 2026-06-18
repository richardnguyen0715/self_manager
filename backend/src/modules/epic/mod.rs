//! `epic` module — Epic CRUD under an Initiative, with progress rollup.
//!
//! Mounted at `/api/epics` by `main.rs`.
//!
//! An Epic represents a multi-sprint body of work that lives under an
//! [`Initiative`][crate::modules::initiative]. Its response carries three
//! derived fields computed from child `work_items`:
//! - `progress` — `{ total_items, done_items, completion_rate }`
//! - `total_points` — sum of `story_points` of all child work items
//! - `done_points` — sum of `story_points` of done child work items
//!
//! # Endpoints
//!
//! | Method   | Path                        | Handler                    |
//! |----------|-----------------------------|----------------------------|
//! | `GET`    | `/`                         | list epics                 |
//! | `POST`   | `/`                         | create epic                |
//! | `GET`    | `/:id`                      | get epic (with progress)   |
//! | `PATCH`  | `/:id`                      | update epic (partial)      |
//! | `DELETE` | `/:id`                      | delete epic                |
//! | `GET`    | `/:id/work-items`           | list work items under epic |

mod handlers;
pub mod models;
mod routes;
pub mod service;

/// Re-export the module router for mounting in `main.rs`.
pub use routes::router;
