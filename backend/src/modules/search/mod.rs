//! `search` module — cross-entity full-text search.
//!
//! Mounted at `/api/search` by `main.rs`.  All routes are authenticated and
//! read-only; no state is mutated and no domain events are emitted.
//!
//! ## Architecture
//!
//! ```text
//! GET /api/search?q=…&kinds=…&limit=…
//!         │
//!         ▼
//!   handlers::search          ← validates input, extracts AuthUser
//!         │
//!         ▼
//!   service::search           ← issues ILIKE queries per entity kind
//!         │
//!         ▼
//!   models::SearchResponse    ← serialised as JSON
//! ```
//!
//! ## Indexes used
//!
//! - `idx_tasks_title_trgm` — GIN trigram index on `tasks.title` (fast ILIKE).
//! - Standard B-tree `user_id` indexes on all three tables (equality filter).

pub mod handlers;
pub mod models;
pub mod routes;
pub mod service;

pub use routes::router;
