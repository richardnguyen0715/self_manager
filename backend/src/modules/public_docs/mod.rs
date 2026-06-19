//! `public_docs` module — Unauthenticated public page serving.
//!
//! Mounted at `/api/public` by `main.rs` **outside** the authenticated
//! sub-router, so no `AuthUser` extractor is ever invoked on these routes.
//!
//! Visibility is enforced at the SQL layer: every query includes an
//! `is_public = true` predicate and will return `404` for any page that is
//! private, regardless of whether the caller supplies credentials.
//!
//! # Endpoints
//!
//! | Method | Path                          | Handler                         |
//! |--------|-------------------------------|---------------------------------|
//! | GET    | `/pages/:slug`                | single public page + children   |
//! | GET    | `/pages/:slug/tree`           | full public descendant subtree  |
//!
//! # Security model
//!
//! - `is_public = false` pages are never included in any query result.
//! - No authentication header is required or inspected.
//! - No ownership (`user_id`) filter is applied — public pages are visible
//!   to the entire internet by design.
//! - The `public_slug` uniqueness constraint (`CREATE UNIQUE INDEX … WHERE
//!   public_slug IS NOT NULL`) in migration `0008_docs_v2.sql` ensures that
//!   slugs are globally unambiguous.

mod handlers;
pub mod models;
mod routes;
pub mod service;

/// Re-export the module router for mounting in `main.rs`.
pub use routes::router;
