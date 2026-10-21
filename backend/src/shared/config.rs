//! Application configuration loaded from environment variables.
//!
//! All required variables are validated at startup via [`Config::from_env`].
//! Optional variables (R2, Resend) are represented as `Option<String>` so that
//! the server can boot without them while running in development.

use std::env;

use anyhow::{Context, Result};

/// Top-level application configuration.
///
/// Constructed once at startup and stored inside [`crate::shared::state::AppState`].
#[derive(Clone, Debug)]
pub struct Config {
    // ── Server ────────────────────────────────────────────────────────────────
    pub host: String,
    pub port: u16,

    // ── Database ──────────────────────────────────────────────────────────────
    pub database_url: String,

    // ── Redis ─────────────────────────────────────────────────────────────────
    pub redis_url: String,

    // ── JWT ───────────────────────────────────────────────────────────────────
    /// HMAC-SHA512 signing secret. Must be at least 32 bytes in production.
    pub jwt_secret: String,
    /// Access token time-to-live in seconds (default: 900 = 15 min).
    pub access_token_ttl_secs: u64,
    /// Refresh token time-to-live in seconds (default: 2 592 000 = 30 days).
    pub refresh_token_ttl_secs: u64,

    // ── Cloudflare R2 (optional) ──────────────────────────────────────────────
    pub r2_account_id: Option<String>,
    pub r2_access_key_id: Option<String>,
    pub r2_secret_access_key: Option<String>,
    pub r2_bucket: Option<String>,
    pub r2_public_url: Option<String>,

    // ── Resend email (optional) ───────────────────────────────────────────────
    pub resend_api_key: Option<String>,
    pub email_from: Option<String>,

    // ── CORS ──────────────────────────────────────────────────────────────────
    /// Comma-separated allowed origins (`CORS_ORIGINS`). Empty = allow any origin
    /// (development only; set this in production).
    pub cors_origins: Vec<String>,
}

impl Config {
    /// Load configuration from environment variables.
    ///
    /// # Errors
    ///
    /// Returns an error if any required variable is absent or cannot be parsed.
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_owned()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "8080".to_owned())
                .parse::<u16>()
                .context("PORT must be a valid u16")?,

            database_url: env::var("DATABASE_URL").context("DATABASE_URL is required")?,
            redis_url: env::var("REDIS_URL").context("REDIS_URL is required")?,

            jwt_secret: {
                let secret = env::var("JWT_SECRET").context("JWT_SECRET is required")?;
                anyhow::ensure!(
                    secret.len() >= 32 && !secret.to_ascii_lowercase().starts_with("change_me"),
                    "JWT_SECRET must be at least 32 bytes and must not be a CHANGE_ME placeholder"
                );
                secret
            },
            access_token_ttl_secs: env::var("ACCESS_TOKEN_TTL_SECS")
                .unwrap_or_else(|_| "900".to_owned())
                .parse::<u64>()
                .context("ACCESS_TOKEN_TTL_SECS must be a valid u64")?,
            refresh_token_ttl_secs: env::var("REFRESH_TOKEN_TTL_SECS")
                .unwrap_or_else(|_| "2592000".to_owned())
                .parse::<u64>()
                .context("REFRESH_TOKEN_TTL_SECS must be a valid u64")?,

            r2_account_id: env::var("R2_ACCOUNT_ID").ok().filter(|s| !s.is_empty()),
            r2_access_key_id: env::var("R2_ACCESS_KEY_ID").ok().filter(|s| !s.is_empty()),
            r2_secret_access_key: env::var("R2_SECRET_ACCESS_KEY")
                .ok()
                .filter(|s| !s.is_empty()),
            r2_bucket: env::var("R2_BUCKET").ok().filter(|s| !s.is_empty()),
            r2_public_url: env::var("R2_PUBLIC_URL").ok().filter(|s| !s.is_empty()),

            resend_api_key: env::var("RESEND_API_KEY").ok().filter(|s| !s.is_empty()),
            email_from: env::var("EMAIL_FROM").ok().filter(|s| !s.is_empty()),

            cors_origins: env::var("CORS_ORIGINS")
                .unwrap_or_default()
                .split(',')
                .map(|o| o.trim().to_owned())
                .filter(|o| !o.is_empty())
                .collect(),
        })
    }

    /// Convenience: socket address string for binding the HTTP server.
    #[must_use]
    pub fn socket_addr(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}
