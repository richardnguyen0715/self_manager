//! Data models and DTOs for the `doc_comment` module.
//!
//! # DB schema (from `migrations/0007_docs.sql`)
//!
//! ```sql
//! page_comments (
//!   id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
//!   page_id    uuid        NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
//!   user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
//!   body       text        NOT NULL,
//!   created_at timestamptz NOT NULL DEFAULT now()
//! )
//! ```
//!
//! Comments are flat (no threading) and ordered oldest-first.
//! Deletion is author-only; the service enforces `user_id = auth.user_id`.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

// ── DB row ─────────────────────────────────────────────────────────────────────

/// Full `page_comments` row, mapped directly from the database.
///
/// Used as both the internal query result and the JSON response shape; all
/// fields are public so the service layer can construct responses without an
/// additional mapping step.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct PageComment {
    /// Primary key.
    pub id: Uuid,
    /// The page this comment belongs to.
    pub page_id: Uuid,
    /// The user who authored this comment.
    pub user_id: Uuid,
    /// Comment text; 1–10 000 characters.
    pub body: String,
    /// Wall-clock time the comment was created (immutable).
    pub created_at: DateTime<Utc>,
}

// ── Request DTOs ───────────────────────────────────────────────────────────────

/// Body for `POST /api/pages/:id/comments`.
///
/// # Validation
///
/// - `body` must be between 1 and 10 000 characters (inclusive).
///
/// # Example
///
/// ```json
/// { "body": "Great write-up!" }
/// ```
#[derive(Debug, Deserialize, Validate)]
pub struct CreateCommentRequest {
    /// The comment text; 1–10 000 characters.
    #[validate(length(min = 1, max = 10_000, message = "body must be 1–10 000 characters"))]
    pub body: String,
}
