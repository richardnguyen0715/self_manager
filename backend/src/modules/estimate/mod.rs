//! `estimate` module — static catalog of estimate systems.
//!
//! A project picks one system (`projects.estimate_system`) that defines which
//! `work_items.story_points` values are allowed and how they are labelled. The
//! catalog is static Rust data; the stored value stays an int.
//!
//! Mounted at `/api/estimate-systems` by `main.rs`.

pub mod models;
mod handlers;
mod routes;
pub mod service;

pub use routes::router;
