//! Data models and DTOs for the `page` module.
//!
//! # DB schema
//!
//! Original columns from `migrations/0007_docs.sql`:
//! ```sql
//! pages (
//!   id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//!   space_id     uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
//!   parent_id    uuid REFERENCES pages(id) ON DELETE CASCADE,
//!   user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
//!   title        text NOT NULL DEFAULT 'Untitled',
//!   kind         text NOT NULL DEFAULT 'page' CHECK (kind IN ('page', 'whiteboard')),
//!   content      jsonb NOT NULL DEFAULT '{}'::jsonb,
//!   excalidraw   jsonb,
//!   status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
//!   position     int  NOT NULL DEFAULT 0,
//!   created_at   timestamptz NOT NULL DEFAULT now(),
//!   updated_at   timestamptz NOT NULL DEFAULT now(),
//!   published_at timestamptz
//! )
//! ```
//!
//! New Notion-parity columns added via `migrations/0008_docs_v2.sql`:
//! ```sql
//!   icon        text,
//!   cover_url   text,
//!   is_public   boolean NOT NULL DEFAULT false,
//!   public_slug text (UNIQUE partial index where NOT NULL),
//!   is_template boolean NOT NULL DEFAULT false
//! ```
//!
//! `kind` and `status` are plain `text` with CHECK constraints (enum-as-text
//! convention). They are bound and read as plain `&str` / `String`.
//! `content` and `excalidraw` are `jsonb`, mapped to `serde_json::Value`.
//!
//! # `page_links` (backlinks, `0008_docs_v2.sql`)
//! ```sql
//! page_links (
//!   id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//!   source_page_id uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
//!   target_page_id uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
//!   user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
//!   created_at     timestamptz NOT NULL DEFAULT now(),
//!   UNIQUE (source_page_id, target_page_id)
//! )
//! ```

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

// ── DB rows ────────────────────────────────────────────────────────────────────

/// Full `pages` row as returned from the database (including V2 columns).
///
/// `content` and `excalidraw` are opaque `jsonb`; the backend stores and
/// returns them as-is without further schema validation.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Page {
    pub id: Uuid,
    pub space_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub user_id: Uuid,
    pub title: String,
    /// Plain text; one of `"page"` | `"whiteboard"`.
    pub kind: String,
    /// TipTap JSON doc (kind=page) or `'{}'` (kind=whiteboard).
    pub content: serde_json::Value,
    /// Excalidraw scene (kind=whiteboard); `None` for page kind.
    pub excalidraw: Option<serde_json::Value>,
    /// Plain text; one of `"draft"` | `"published"`.
    pub status: String,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub published_at: Option<DateTime<Utc>>,
    // ── V2 additions ────────────────────────────────────────────────────────
    /// Emoji character or `null`.
    pub icon: Option<String>,
    /// `/uploads/<file>` or external URL; set by the cover upload endpoint.
    pub cover_url: Option<String>,
    /// When `true` the page is readable at `/api/public/pages/<public_slug>`.
    pub is_public: bool,
    /// Unique slug for the public site URL; minted on first `is_public = true`.
    pub public_slug: Option<String>,
    /// Template pages are excluded from the normal tree.
    pub is_template: bool,
}

/// Full `page_versions` row.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct PageVersion {
    pub id: Uuid,
    pub page_id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub content: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

/// One row of the `page_links` table (directed backlink edge).
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct PageLink {
    pub id: Uuid,
    pub source_page_id: Uuid,
    pub target_page_id: Uuid,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
}

// ── Response DTOs ──────────────────────────────────────────────────────────────

/// Full page response serialised to JSON (includes V2 fields).
#[derive(Debug, Serialize)]
pub struct PageResponse {
    pub id: Uuid,
    pub space_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub user_id: Uuid,
    pub title: String,
    pub kind: String,
    pub content: serde_json::Value,
    pub excalidraw: Option<serde_json::Value>,
    pub status: String,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub published_at: Option<DateTime<Utc>>,
    pub icon: Option<String>,
    pub cover_url: Option<String>,
    pub is_public: bool,
    pub public_slug: Option<String>,
    pub is_template: bool,
}

impl From<Page> for PageResponse {
    fn from(p: Page) -> Self {
        Self {
            id: p.id,
            space_id: p.space_id,
            parent_id: p.parent_id,
            user_id: p.user_id,
            title: p.title,
            kind: p.kind,
            content: p.content,
            excalidraw: p.excalidraw,
            status: p.status,
            position: p.position,
            created_at: p.created_at,
            updated_at: p.updated_at,
            published_at: p.published_at,
            icon: p.icon,
            cover_url: p.cover_url,
            is_public: p.is_public,
            public_slug: p.public_slug,
            is_template: p.is_template,
        }
    }
}

/// Tree node returned by `GET /api/pages?space_id=<uuid>`.
///
/// Includes `children` recursively; no content/excalidraw blobs.
#[derive(Debug, Serialize)]
pub struct PageTreeNode {
    pub id: Uuid,
    pub space_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub title: String,
    pub kind: String,
    pub status: String,
    pub position: i32,
    pub icon: Option<String>,
    pub is_public: bool,
    pub is_template: bool,
    pub children: Vec<PageTreeNode>,
}

/// Flat row fetched from the DB before tree assembly.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct PageFlatRow {
    pub id: Uuid,
    pub space_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub title: String,
    pub kind: String,
    pub status: String,
    pub position: i32,
    pub icon: Option<String>,
    pub is_public: bool,
    pub is_template: bool,
}

/// Search result returned by `GET /api/pages/search?q=`.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PageSearchResult {
    pub id: Uuid,
    pub space_id: Uuid,
    pub title: String,
    pub kind: String,
    pub icon: Option<String>,
}

/// Version summary (no content body) for list endpoints.
#[derive(Debug, Serialize)]
pub struct PageVersionSummary {
    pub id: Uuid,
    pub page_id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub created_at: DateTime<Utc>,
}

/// Full version response including content.
#[derive(Debug, Serialize)]
pub struct PageVersionResponse {
    pub id: Uuid,
    pub page_id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub content: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

impl From<PageVersion> for PageVersionResponse {
    fn from(v: PageVersion) -> Self {
        Self {
            id: v.id,
            page_id: v.page_id,
            user_id: v.user_id,
            title: v.title,
            content: v.content,
            created_at: v.created_at,
        }
    }
}

impl From<PageVersion> for PageVersionSummary {
    fn from(v: PageVersion) -> Self {
        Self {
            id: v.id,
            page_id: v.page_id,
            user_id: v.user_id,
            title: v.title,
            created_at: v.created_at,
        }
    }
}

/// Response body for the image / cover upload endpoints.
#[derive(Debug, Serialize)]
pub struct ImageUploadResponse {
    pub url: String,
}

/// Response for `POST /:id/public` — public toggle state.
#[derive(Debug, Serialize)]
pub struct PagePublicStateResponse {
    pub is_public: bool,
    pub public_slug: Option<String>,
}

/// Backlink item returned by `GET /:id/backlinks`.
///
/// One entry per source page that contains a `@page` mention pointing at this page.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PageBacklink {
    pub source_page_id: Uuid,
    pub title: String,
    pub space_id: Uuid,
}

/// Outbound link reference returned by `GET /:id/links`.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PageLinkRef {
    pub target_page_id: Uuid,
    pub title: String,
    pub space_id: Uuid,
}

// ── Request DTOs ───────────────────────────────────────────────────────────────

/// Query params for `GET /api/pages` — `space_id` is required.
#[derive(Debug, Deserialize)]
pub struct ListPagesQuery {
    pub space_id: Uuid,
}

/// Query params for `GET /api/pages/search`.
#[derive(Debug, Deserialize)]
pub struct SearchPagesQuery {
    /// Search term; matched with pg_trgm similarity on `title`.
    pub q: String,
    /// Optional space scope; `None` = search across all spaces owned by user.
    pub space_id: Option<Uuid>,
}

/// Query params for `GET /api/pages/templates`.
#[derive(Debug, Deserialize)]
pub struct ListTemplatesQuery {
    /// Optional space scope; `None` = templates across all user's spaces.
    pub space_id: Option<Uuid>,
}

/// Body for `POST /api/pages`.
#[derive(Debug, Deserialize, Validate)]
pub struct CreatePageRequest {
    /// Target space; required.
    pub space_id: Uuid,
    /// Optional parent page; `None` = top-level.
    pub parent_id: Option<Uuid>,
    /// Initial title; defaults to `"Untitled"` when absent.
    #[validate(length(min = 1, max = 1000, message = "title must be 1–1000 characters"))]
    pub title: Option<String>,
    /// `"page"` (default) or `"whiteboard"`.
    pub kind: Option<String>,
}

/// Body for `PATCH /api/pages/:id` — all fields optional (autosave path).
///
/// V2 additions: `icon`, `cover_url`.
#[derive(Debug, Deserialize, Validate)]
pub struct UpdatePageRequest {
    #[validate(length(min = 1, max = 1000, message = "title must be 1–1000 characters"))]
    pub title: Option<String>,
    /// Replacement TipTap JSON doc (kind=page).
    pub content: Option<serde_json::Value>,
    /// `"page"` or `"whiteboard"`.
    pub kind: Option<String>,
    /// Replacement Excalidraw scene (kind=whiteboard).
    pub excalidraw: Option<serde_json::Value>,
    /// Sibling ordering position.
    pub position: Option<i32>,
    /// Reparent to a different page within the same space.
    pub parent_id: Option<Uuid>,
    // ── V2 additions ────────────────────────────────────────────────────────
    /// Emoji icon character; `None` = keep current; `Some("")` clears it.
    pub icon: Option<String>,
    /// Cover image URL; `None` = keep current; `Some("")` clears it.
    pub cover_url: Option<String>,
}

/// Body for `POST /api/pages/move`.
#[derive(Debug, Deserialize)]
pub struct MovePageRequest {
    /// The page to move.
    pub id: Uuid,
    /// New parent; `None` = promote to top-level.
    pub parent_id: Option<Uuid>,
    /// New position among siblings.
    pub position: i32,
}

/// Body for `POST /api/pages/:id/public`.
#[derive(Debug, Deserialize)]
pub struct SetPagePublicRequest {
    /// `true` = publish as public site; `false` = unpublish.
    pub public: bool,
}

/// Body for `POST /api/pages/from-template`.
#[derive(Debug, Deserialize, Validate)]
pub struct CreateFromTemplateRequest {
    pub space_id: Uuid,
    pub template_id: Uuid,
    pub parent_id: Option<Uuid>,
    #[validate(length(min = 1, max = 1000, message = "title must be 1–1000 characters"))]
    pub title: Option<String>,
}
