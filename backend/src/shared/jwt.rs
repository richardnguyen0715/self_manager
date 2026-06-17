//! JWT encoding and decoding.
//!
//! Two token types are issued:
//! - **Access token** — short-lived (15 min), carries [`TokenType::Access`].
//! - **Refresh token** — long-lived (30 days), carries [`TokenType::Refresh`].
//!
//! Both are signed with HS512 using the `JWT_SECRET` from [`Config`].
//!
//! # Example
//!
//! ```rust,ignore
//! let access = encode_access(&config, user_id)?;
//! let claims = decode(&config, &access)?;
//! assert_eq!(claims.token_type, TokenType::Access);
//! ```

use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::shared::{config::Config, error::AppError};

/// Discriminator embedded in every token so that access tokens cannot be used
/// where a refresh token is expected and vice-versa.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TokenType {
    Access,
    Refresh,
}

/// Standard JWT claims plus our custom fields.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Claims {
    /// Subject — the user's UUID.
    pub sub: Uuid,
    /// Expiry timestamp (Unix seconds).
    pub exp: u64,
    /// Issued-at timestamp (Unix seconds).
    pub iat: u64,
    /// Whether this is an access or refresh token.
    pub token_type: TokenType,
}

/// Encode a new **access token** for `user_id`.
///
/// # Errors
///
/// Returns [`AppError::Internal`] if JWT encoding fails (typically a bad secret).
pub fn encode_access(config: &Config, user_id: Uuid) -> Result<String, AppError> {
    encode_token(
        config,
        user_id,
        TokenType::Access,
        config.access_token_ttl_secs,
    )
}

/// Encode a new **refresh token** for `user_id`.
///
/// # Errors
///
/// Returns [`AppError::Internal`] if JWT encoding fails.
pub fn encode_refresh(config: &Config, user_id: Uuid) -> Result<String, AppError> {
    encode_token(
        config,
        user_id,
        TokenType::Refresh,
        config.refresh_token_ttl_secs,
    )
}

/// Decode and verify a token string.
///
/// Validates:
/// - Signature using `JWT_SECRET`
/// - Expiry (`exp` claim)
///
/// Returns the decoded [`Claims`] on success.
///
/// # Errors
///
/// Returns [`AppError::UnauthorizedMsg`] for any invalid or expired token.
pub fn decode_token(config: &Config, token: &str) -> Result<Claims, AppError> {
    let key = DecodingKey::from_secret(config.jwt_secret.as_bytes());
    let mut validation = Validation::new(jsonwebtoken::Algorithm::HS512);
    validation.validate_exp = true;

    decode::<Claims>(token, &key, &validation)
        .map(|data| data.claims)
        .map_err(|err| AppError::UnauthorizedMsg(format!("invalid token: {err}")))
}

// ── Private helpers ────────────────────────────────────────────────────────────

fn encode_token(
    config: &Config,
    user_id: Uuid,
    token_type: TokenType,
    ttl_secs: u64,
) -> Result<String, AppError> {
    let now = Utc::now().timestamp() as u64;
    let claims = Claims {
        sub: user_id,
        iat: now,
        exp: now + ttl_secs,
        token_type,
    };

    let key = EncodingKey::from_secret(config.jwt_secret.as_bytes());
    encode(&Header::new(jsonwebtoken::Algorithm::HS512), &claims, &key)
        .map_err(|_| AppError::Internal)
}
