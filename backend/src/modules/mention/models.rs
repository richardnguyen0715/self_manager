//! Mention module — request DTOs and response shapes.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Object types that can be searched in the `@` picker, in display order.
pub const SEARCH_TYPES: &[&str] = &[
    "work_item", "doc", "sprint", "project", "epic", "initiative", "goal", "habit", "retro",
];
/// Object types that can contain mentions (the `source` of a mention row).
pub const SOURCE_TYPES: &[&str] = &["work_item", "doc", "retro"];

pub const DEFAULT_SEARCH_LIMIT: i64 = 8;
pub const MAX_SEARCH_LIMIT: i64 = 20;
pub const MAX_RESOLVE_REFS: usize = 100;
pub const MAX_SYNC_TARGETS: usize = 200;

// ── Requests ──────────────────────────────────────────────────────────────────

/// `GET /api/mentions/search`. `types` is comma-separated; `limit` is per type.
#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: Option<String>,
    pub types: Option<String>,
    pub limit: Option<i64>,
}

/// `GET /api/mentions/resolve?refs=work_item:<uuid>,doc:<uuid>`.
#[derive(Debug, Deserialize)]
pub struct ResolveQuery {
    pub refs: Option<String>,
}

/// `PUT /api/mentions/sync`. Replaces the mention set of one source.
#[derive(Debug, Deserialize)]
pub struct SyncRequest {
    pub source_type: String,
    pub source_id: Uuid,
    #[serde(default)]
    pub targets: Vec<TargetRef>,
}

/// One mention target. `id` is a string so that malformed ids are dropped
/// silently instead of failing the whole request.
#[derive(Debug, Deserialize)]
pub struct TargetRef {
    #[serde(rename = "type")]
    pub target_type: String,
    pub id: String,
}

/// `GET /api/mentions/backlinks`.
#[derive(Debug, Deserialize)]
pub struct BacklinksQuery {
    pub target_type: String,
    pub target_id: Uuid,
}

// ── Responses ─────────────────────────────────────────────────────────────────

/// One picker result. Serialised as `{ type, id, title, subtitle, href }`.
#[derive(Debug, Serialize)]
pub struct SearchHit {
    #[serde(rename = "type")]
    pub kind: String,
    pub id: Uuid,
    pub title: Option<String>,
    pub subtitle: Option<String>,
    pub href: Option<String>,
}

/// One resolved chip. Serialised as `{ type, id, title, subtitle, href, exists }`.
/// Missing / foreign / soft-deleted targets come back with `exists: false` and
/// null title, subtitle and href.
#[derive(Debug, Serialize)]
pub struct ResolvedRef {
    #[serde(rename = "type")]
    pub kind: String,
    pub id: Uuid,
    pub title: Option<String>,
    pub subtitle: Option<String>,
    pub href: Option<String>,
    pub exists: bool,
}

/// One "Mentioned in" entry. Serialised as
/// `{ source_type, source_id, title, subtitle, href, created_at }`.
#[derive(Debug, Serialize)]
pub struct Backlink {
    pub source_type: String,
    pub source_id: Uuid,
    pub title: Option<String>,
    pub subtitle: Option<String>,
    pub href: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// `PUT /api/mentions/sync` response: number of mentions stored for the source.
#[derive(Debug, Serialize)]
pub struct SyncResult {
    pub count: usize,
}
