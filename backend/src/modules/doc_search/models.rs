//! Data models and DTOs for the `doc_search` module.
//!
//! Unified search across pages (title + content jsonb text) and databases
//! (title + row values jsonb text), scoped to the authenticated user.
//!
//! # Response shape
//!
//! ```json
//! {
//!   "pages": [
//!     { "id": "<uuid>", "space_id": "<uuid>", "title": "…", "icon": "📄", "snippet": "…" }
//!   ],
//!   "databases": [
//!     { "id": "<uuid>", "space_id": "<uuid>", "title": "…", "icon": null, "matched_rows": 3 }
//!   ]
//! }
//! ```

use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Response DTOs ──────────────────────────────────────────────────────────────

/// A single page hit returned by `GET /api/docs/search`.
///
/// `snippet` is a short excerpt from the page content text that contains the
/// query match. When the match is on the title, `snippet` is an empty string.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PageSearchHit {
    pub id: Uuid,
    pub space_id: Uuid,
    pub title: String,
    /// Emoji icon or `null`.
    pub icon: Option<String>,
    /// Short text excerpt from `content` that matched the query; empty when
    /// the match was on `title`.
    pub snippet: String,
}

/// A single database hit returned by `GET /api/docs/search`.
///
/// `matched_rows` is the count of rows whose `values::text` contains the query
/// string. When the match is on the database title, `matched_rows` is `0`.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DatabaseSearchHit {
    pub id: Uuid,
    pub space_id: Uuid,
    pub title: String,
    /// Emoji icon or `null`.
    pub icon: Option<String>,
    /// Number of rows whose serialised `values` contain the query string.
    pub matched_rows: i64,
}

/// Unified search response.
#[derive(Debug, Serialize)]
pub struct DocSearchResponse {
    pub pages: Vec<PageSearchHit>,
    pub databases: Vec<DatabaseSearchHit>,
}

// ── Request DTOs ───────────────────────────────────────────────────────────────

/// Query parameters for `GET /api/docs/search`.
///
/// `q` is required. `space_id` is optional; when absent the search spans all
/// pages and databases owned by the authenticated user.
#[derive(Debug, Deserialize)]
pub struct DocSearchQuery {
    /// Search term. Required; an empty string returns no results.
    pub q: String,
    /// Optional space filter. When provided, results are limited to this space.
    pub space_id: Option<Uuid>,
}
