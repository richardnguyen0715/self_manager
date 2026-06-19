//! `doc_comment` module — Page-level comments for Confluence-style Docs.
//!
//! Owns the `page_comments` table. Routes are relative to `/pages` so they
//! merge cleanly with `page::router()` when the combined router is nested
//! under `/api/pages` in `main.rs`:
//!
//! ```rust,ignore
//! .nest("/pages", modules::page::router().merge(modules::doc_comment::router()))
//! ```
//!
//! # Endpoints (relative to `/api/pages`)
//!
//! | Method   | Path                           | Handler              |
//! |----------|--------------------------------|----------------------|
//! | `GET`    | `/:id/comments`                | list page comments   |
//! | `POST`   | `/:id/comments`                | create page comment  |
//! | `DELETE` | `/:id/comments/:comment_id`    | delete page comment  |

mod handlers;
pub mod models;
mod routes;
pub mod service;

/// Re-export the module router for merging with `page::router()` in `main.rs`.
pub use routes::router;
