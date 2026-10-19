//! `custom_property` module — per-project custom fields on work items.
//!
//! A property belongs to one project and is typed (text, number, select,
//! multi_select, date, checkbox, url). Its values live in
//! `work_item_property_values`, one row per (work item, property).
//!
//! Mounted at `/api/custom-properties` by `main.rs`.

mod handlers;
pub mod models;
mod routes;
pub mod service;

pub use routes::router;
