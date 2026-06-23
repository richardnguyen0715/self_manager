//! Data models, DTOs, and request/response types for the `organization` module.
//!
//! Database representation uses [`Organization`] (via `sqlx::FromRow`).
//! HTTP surface is [`OrganizationResponse`] plus the request bodies
//! [`CreateOrganizationRequest`] and [`UpdateOrganizationRequest`].

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

// ── Database row ──────────────────────────────────────────────────────────────

/// Raw row returned by `SELECT … FROM organizations`.
#[derive(Clone, Debug, FromRow)]
pub struct Organization {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── HTTP response ─────────────────────────────────────────────────────────────

/// Full organization payload returned to the client.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OrganizationResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Organization> for OrganizationResponse {
    fn from(org: Organization) -> Self {
        Self {
            id: org.id,
            user_id: org.user_id,
            name: org.name,
            description: org.description,
            color: org.color,
            position: org.position,
            created_at: org.created_at,
            updated_at: org.updated_at,
        }
    }
}

// ── Request bodies ────────────────────────────────────────────────────────────

/// `POST /api/organizations` body.
#[derive(Clone, Debug, Deserialize, Validate)]
pub struct CreateOrganizationRequest {
    /// Organization display name (1–200 characters).
    #[validate(length(min = 1, max = 200, message = "name must be 1–200 characters"))]
    pub name: String,

    /// Optional free-form description.
    #[validate(length(max = 2000, message = "description must be ≤ 2000 characters"))]
    pub description: Option<String>,

    /// Hex colour string, e.g. `"#3B82F6"`.
    #[validate(length(max = 20, message = "color must be ≤ 20 characters"))]
    pub color: Option<String>,

    /// Sort order hint; defaults to `0`.
    pub position: Option<i32>,
}

/// `PATCH /api/organizations/:id` body — every field is optional.
#[derive(Clone, Debug, Deserialize, Validate)]
pub struct UpdateOrganizationRequest {
    #[validate(length(min = 1, max = 200, message = "name must be 1–200 characters"))]
    pub name: Option<String>,

    #[validate(length(max = 2000, message = "description must be ≤ 2000 characters"))]
    pub description: Option<String>,

    #[validate(length(max = 20, message = "color must be ≤ 20 characters"))]
    pub color: Option<String>,

    pub position: Option<i32>,
}
