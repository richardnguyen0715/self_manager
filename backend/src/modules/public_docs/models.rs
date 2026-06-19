//! Data models and DTOs for the `public_docs` module.
//!
//! All types here represent **public, unauthenticated** views of pages.
//! Only pages where `is_public = true` are ever included.
//!
//! No `AuthUser` is referenced; ownership is replaced by the `is_public`
//! SQL predicate.

use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

// ── DB projection rows ─────────────────────────────────────────────────────────

/// Minimal row fetched for a public page child reference.
///
/// Used by both `GET /pages/:slug` (direct children array) and
/// `GET /pages/:slug/tree` (recursive subtree assembly).
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct PublicPageFlatRow {
    pub id: Uuid,
    pub parent_id: Option<Uuid>,
    pub title: String,
    pub icon: Option<String>,
    pub public_slug: Option<String>,
    pub position: i32,
}

/// Full projection of a single public page row.
#[derive(Debug, sqlx::FromRow)]
pub struct PublicPageRow {
    pub id: Uuid,
    pub title: String,
    pub icon: Option<String>,
    pub cover_url: Option<String>,
    /// TipTap JSON document.
    pub content: serde_json::Value,
    pub updated_at: DateTime<Utc>,
}

// ── Response DTOs ──────────────────────────────────────────────────────────────

/// A reference to a public child page embedded in [`PublicPageResponse`].
///
/// Corresponds to the `PublicPageRef` TypeScript type.
#[derive(Debug, Serialize)]
pub struct PublicPageRef {
    pub id: Uuid,
    pub title: String,
    pub icon: Option<String>,
    pub public_slug: Option<String>,
}

/// Full response for `GET /pages/:slug`.
///
/// Corresponds to the `PublicPage` TypeScript type.
#[derive(Debug, Serialize)]
pub struct PublicPageResponse {
    pub id: Uuid,
    pub title: String,
    pub icon: Option<String>,
    pub cover_url: Option<String>,
    pub content: serde_json::Value,
    pub updated_at: DateTime<Utc>,
    /// Direct children that are themselves `is_public = true`.
    pub children: Vec<PublicPageRef>,
}

/// A node in the public subtree returned by `GET /pages/:slug/tree`.
///
/// Corresponds to `PublicPageTreeNode` on the frontend.
#[derive(Debug, Serialize)]
pub struct PublicPageTreeNode {
    pub id: Uuid,
    pub title: String,
    pub icon: Option<String>,
    pub public_slug: Option<String>,
    pub children: Vec<PublicPageTreeNode>,
}
