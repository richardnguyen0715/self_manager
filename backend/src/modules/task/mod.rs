//! `task` module — Task CRUD, subtasks, tags, recurring tasks, and status transitions.
//!
//! Mounted at `/api/tasks` by `main.rs`. Tag management lives here too, exposed
//! at `/api/tasks/tags`, because tags are a concern owned by this module.
//!
//! # Emitted events
//! - [`DomainEvent::TaskCompleted`] — fired when a task's status transitions to
//!   `completed`.

pub mod handlers;
pub mod models;
pub mod routes;
pub mod service;

pub use routes::router;
