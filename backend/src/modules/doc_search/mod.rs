//! `doc_search` module — Unified full-text search across pages and databases.
//!
//! Mounted at `/api/docs` by `main.rs`.
//!
//! # Endpoints
//!
//! | Method | Path      | Auth | Description                                         |
//! |--------|-----------|------|-----------------------------------------------------|
//! | GET    | `/search` | yes  | Unified search: pages (title + content) + databases |
//!
//! ## Search algorithm
//!
//! **Pages** — `user_id`-scoped UNION of:
//! - pg_trgm `title % $q` (similarity ≥ 0.15)
//! - `content::text ILIKE '%q%'` (jsonb blob serialised to text)
//!
//! Template pages (`is_template = true`) are excluded.
//! A 160-char snippet is extracted from the content arm.
//!
//! **Databases** — `user_id`-scoped UNION of:
//! - pg_trgm `title % $q`
//! - `database_rows.values::text ILIKE '%q%'` with COUNT(`matched_rows`)
//!
//! Both categories honour the optional `space_id` query parameter.
//! Results are capped at 50 per category.

mod handlers;
pub mod models;
mod routes;
pub mod service;

/// Re-export the module router for mounting in `main.rs`.
pub use routes::router;
