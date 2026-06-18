//! `work_item` module — Work Item CRUD and subtask management.
//!
//! Supersedes the legacy `task` module as the primary unit of work in the
//! Personal Agile OS. Legacy `tasks` rows are backfilled into `work_items`
//! via `migrations/0003_agile.sql`.
//!
//! Mounted at `/api/work-items` by `main.rs`.
//!
//! # Endpoints
//!
//! | Method   | Path                                  | Handler           |
//! |----------|---------------------------------------|-------------------|
//! | `GET`    | `/`                                   | list work items   |
//! | `POST`   | `/`                                   | create work item  |
//! | `GET`    | `/:id`                                | get work item     |
//! | `PATCH`  | `/:id`                                | update work item  |
//! | `DELETE` | `/:id`                                | delete work item  |
//! | `PATCH`  | `/:id/status`                         | set status        |
//! | `PATCH`  | `/:id/points`                         | set story points  |
//! | `PATCH`  | `/:id/column`                         | set board column  |
//! | `PATCH`  | `/:id/sprint`                         | move to sprint    |
//! | `PATCH`  | `/:id/backlog`                        | move to backlog   |
//! | `GET`    | `/:id/subtasks`                       | list subtasks     |
//! | `POST`   | `/:id/subtasks`                       | add subtask       |
//! | `PATCH`  | `/:id/subtasks/:subtask_id`           | update subtask    |
//! | `DELETE` | `/:id/subtasks/:subtask_id`           | delete subtask    |

mod handlers;
pub mod models;
mod routes;
pub mod service;

/// Re-export the module router for mounting in `main.rs`.
pub use routes::router;
