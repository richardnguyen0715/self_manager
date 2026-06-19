//! Data models and DTOs for the `database` module.
//!
//! # DB schema (from `migrations/0008_docs_v2.sql`)
//!
//! ```sql
//! databases (
//!   id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//!   space_id   uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
//!   user_id    uuid NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
//!   title      text NOT NULL DEFAULT 'Untitled Database',
//!   icon       text,
//!   created_at timestamptz NOT NULL DEFAULT now(),
//!   updated_at timestamptz NOT NULL DEFAULT now()
//! )
//!
//! database_columns (
//!   id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//!   database_id uuid NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
//!   name        text NOT NULL,
//!   type        text NOT NULL CHECK (type IN ('text','number','date','checkbox',
//!                                    'select','multi_select','status','url')),
//!   options     jsonb NOT NULL DEFAULT '[]'::jsonb,
//!   position    int  NOT NULL DEFAULT 0,
//!   created_at  timestamptz NOT NULL DEFAULT now()
//! )
//!
//! database_rows (
//!   id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//!   database_id uuid NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
//!   values      jsonb NOT NULL DEFAULT '{}'::jsonb,
//!   position    int  NOT NULL DEFAULT 0,
//!   created_at  timestamptz NOT NULL DEFAULT now(),
//!   updated_at  timestamptz NOT NULL DEFAULT now()
//! )
//!
//! database_views (
//!   id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//!   database_id uuid NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
//!   name        text NOT NULL,
//!   type        text NOT NULL CHECK (type IN ('table','board')),
//!   config      jsonb NOT NULL DEFAULT '{}'::jsonb,
//!   position    int  NOT NULL DEFAULT 0,
//!   created_at  timestamptz NOT NULL DEFAULT now(),
//!   updated_at  timestamptz NOT NULL DEFAULT now()
//! )
//! ```
//!
//! Enum-as-text pattern: `type` columns are bound as `&str` and read as
//! `String`. `jsonb` columns map to `serde_json::Value` via the
//! `col AS "col: serde_json::Value"` override.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── DB rows ────────────────────────────────────────────────────────────────────

/// Full `databases` row.
#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Database {
    pub id: Uuid,
    pub space_id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub icon: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Full `database_columns` row.
///
/// `col_type` maps the `type` column (reserved keyword in Rust/SQL — aliased in
/// every query as `type AS col_type`).
#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct DatabaseColumn {
    pub id: Uuid,
    pub database_id: Uuid,
    pub name: String,
    /// Plain text; one of `text|number|date|checkbox|select|multi_select|status|url`.
    #[sqlx(rename = "col_type")]
    #[serde(rename = "type")]
    pub col_type: String,
    /// `select`/`multi_select`/`status` option list `[{id,name,color}]`; `[]` for scalar types.
    pub options: serde_json::Value,
    pub position: i32,
    pub created_at: DateTime<Utc>,
}

/// Full `database_rows` row.
#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct DatabaseRow {
    pub id: Uuid,
    pub database_id: Uuid,
    /// Map of `column_id → typed value`. Missing key = empty.
    pub values: serde_json::Value,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Full `database_views` row.
#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct DatabaseView {
    pub id: Uuid,
    pub database_id: Uuid,
    pub name: String,
    /// Plain text; one of `table|board`.
    #[sqlx(rename = "view_type")]
    #[serde(rename = "type")]
    pub view_type: String,
    /// Config blob — see contract for shape.
    pub config: serde_json::Value,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Response DTOs ──────────────────────────────────────────────────────────────

/// Compound response for `GET /api/databases/:id`.
#[derive(Debug, Serialize)]
pub struct DatabaseDetail {
    pub database: Database,
    pub columns: Vec<DatabaseColumn>,
    pub views: Vec<DatabaseView>,
}

/// One group entry in a Board view response.
#[derive(Debug, Serialize)]
pub struct BoardGroup {
    /// Option id string, or `null` for ungrouped rows.
    pub option_id: Option<String>,
    /// Human-readable option name (empty string for ungrouped).
    pub option_name: String,
    pub rows: Vec<DatabaseRow>,
}

/// Response body for `GET /api/databases/:id/views/:viewId/rows`.
///
/// Only one of `rows` (table) or `groups` (board) is populated, matching the
/// view type.
#[derive(Debug, Serialize)]
pub struct ViewRowsResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rows: Option<Vec<DatabaseRow>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub groups: Option<Vec<BoardGroup>>,
}

// ── Request DTOs ───────────────────────────────────────────────────────────────

/// Query params for `GET /api/databases`.
#[derive(Debug, Deserialize)]
pub struct ListDatabasesQuery {
    pub space_id: Uuid,
}

/// Body for `POST /api/databases`.
#[derive(Debug, Deserialize)]
pub struct CreateDatabaseRequest {
    pub space_id: Uuid,
    pub title: Option<String>,
    pub icon: Option<String>,
}

/// Body for `PATCH /api/databases/:id`.
#[derive(Debug, Deserialize)]
pub struct UpdateDatabaseRequest {
    pub title: Option<String>,
    pub icon: Option<String>,
}

/// Body for `POST /api/databases/:id/columns`.
#[derive(Debug, Deserialize)]
pub struct CreateColumnRequest {
    pub name: String,
    /// One of `text|number|date|checkbox|select|multi_select|status|url`.
    #[serde(rename = "type")]
    pub col_type: String,
    pub options: Option<serde_json::Value>,
    pub position: Option<i32>,
}

/// Body for `PATCH /api/databases/:id/columns/:colId`.
#[derive(Debug, Deserialize)]
pub struct UpdateColumnRequest {
    pub name: Option<String>,
    #[serde(rename = "type")]
    pub col_type: Option<String>,
    pub options: Option<serde_json::Value>,
    pub position: Option<i32>,
}

/// Body for `POST /api/databases/:id/rows`.
#[derive(Debug, Deserialize)]
pub struct CreateRowRequest {
    pub values: Option<serde_json::Value>,
    pub position: Option<i32>,
}

/// Body for `PATCH /api/databases/:id/rows/:rowId`.
#[derive(Debug, Deserialize)]
pub struct UpdateRowRequest {
    /// Shallow-merged into existing `values`.
    pub values: Option<serde_json::Value>,
    pub position: Option<i32>,
}

/// One entry in a batch row update.
#[derive(Debug, Deserialize)]
pub struct BatchRowUpdate {
    pub id: Uuid,
    pub values: serde_json::Value,
}

/// Body for `PATCH /api/databases/:id/rows` (batch).
#[derive(Debug, Deserialize)]
pub struct BatchUpdateRowsRequest {
    pub updates: Vec<BatchRowUpdate>,
}

/// Body for `POST /api/databases/:id/views`.
#[derive(Debug, Deserialize)]
pub struct CreateViewRequest {
    pub name: String,
    /// One of `table|board`.
    #[serde(rename = "type")]
    pub view_type: String,
    pub config: Option<serde_json::Value>,
    pub position: Option<i32>,
}

/// Body for `PATCH /api/databases/:id/views/:viewId`.
#[derive(Debug, Deserialize)]
pub struct UpdateViewRequest {
    pub name: Option<String>,
    pub config: Option<serde_json::Value>,
    pub position: Option<i32>,
}
