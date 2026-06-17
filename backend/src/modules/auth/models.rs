//! Auth module — data models, request/response DTOs.
//!
//! Structs in this file map directly to the `users` and `refresh_tokens` tables
//! defined in `migrations/0001_init.sql`.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

// ── Database row types ─────────────────────────────────────────────────────────

/// Full row from the `users` table.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub password_hash: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub timezone: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Full row from the `refresh_tokens` table.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct RefreshToken {
    pub id: Uuid,
    pub user_id: Uuid,
    pub token_hash: String,
    pub expires_at: DateTime<Utc>,
    pub revoked: bool,
    pub created_at: DateTime<Utc>,
}

// ── Request DTOs ───────────────────────────────────────────────────────────────

/// Body for `POST /api/auth/register`.
#[derive(Debug, Deserialize, Validate)]
pub struct RegisterRequest {
    /// Must be a valid email address.
    #[validate(email(message = "invalid email address"))]
    pub email: String,

    /// Minimum 8 characters.
    #[validate(length(min = 8, message = "password must be at least 8 characters"))]
    pub password: String,

    /// Human-readable name shown in the UI.
    #[validate(length(
        min = 1,
        max = 100,
        message = "display_name must be between 1 and 100 characters"
    ))]
    pub display_name: String,
}

/// Body for `POST /api/auth/login`.
#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(email(message = "invalid email address"))]
    pub email: String,

    #[validate(length(min = 1, message = "password is required"))]
    pub password: String,
}

/// Body for `POST /api/auth/refresh`.
#[derive(Debug, Deserialize, Validate)]
pub struct RefreshRequest {
    #[validate(length(min = 1, message = "refresh_token is required"))]
    pub refresh_token: String,
}

// ── Response DTOs ──────────────────────────────────────────────────────────────

/// Returned by register and login — contains both tokens and a user profile.
#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub user: UserProfile,
}

/// Returned by `POST /api/auth/refresh` — contains a new token pair.
#[derive(Debug, Serialize)]
pub struct TokenPairResponse {
    pub access_token: String,
    pub refresh_token: String,
}

/// Public user profile — never exposes `password_hash`.
#[derive(Debug, Serialize)]
pub struct UserProfile {
    pub id: Uuid,
    pub email: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub timezone: String,
    pub created_at: DateTime<Utc>,
}

impl From<User> for UserProfile {
    fn from(u: User) -> Self {
        Self {
            id: u.id,
            email: u.email,
            display_name: u.display_name,
            avatar_url: u.avatar_url,
            timezone: u.timezone,
            created_at: u.created_at,
        }
    }
}
