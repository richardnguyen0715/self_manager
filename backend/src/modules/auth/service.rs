//! Auth module — business logic.
//!
//! All database access uses `sqlx::query!` / `sqlx::query_as!` macros so that
//! queries are verified against the schema at compile time.
//!
//! # Token storage strategy
//!
//! The raw refresh token string is **never** stored in the database in plain
//! form.  Instead we store the JWT **signature segment** — the third
//! dot-delimited component of the compact serialisation — as `token_hash`.
//!
//! A JWT signed with HS512 produces an 86-character base64url signature that is
//! a keyed HMAC over the header+payload.  It is:
//! - Cryptographically unique per token (collision probability negligible).
//! - Already bound to the claims via the HMAC key — equivalent to
//!   `HMAC(JWT_SECRET, header.payload)`.
//! - Extractable with no additional dependencies beyond the `jsonwebtoken`
//!   crate that is already a direct dependency.
//!
//! # Password hashing
//!
//! Argon2id is used via the [`argon2`] crate with the default (OWASP-recommended)
//! parameters.

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::shared::{
    config::Config,
    error::{AppError, AppResult},
    jwt,
};

#[allow(unused_imports)] // User and RefreshToken are sqlx query_as! target types
use super::models::{AuthResponse, RefreshToken, TokenPairResponse, User, UserProfile};

// ── Password helpers ───────────────────────────────────────────────────────────

/// Hash a plain-text password with Argon2id.
///
/// # Errors
///
/// Returns [`AppError::Internal`] if the hashing operation fails.
pub fn hash_password(password: &str) -> AppResult<String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|_| AppError::Internal)
}

/// Verify a plain-text password against an Argon2 PHC string.
///
/// Returns `true` when the password matches; `false` otherwise.
///
/// # Errors
///
/// Returns [`AppError::Internal`] if the stored hash is malformed.
pub fn verify_password(password: &str, hash: &str) -> AppResult<bool> {
    let parsed = PasswordHash::new(hash).map_err(|_| AppError::Internal)?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

// ── Token identity helper ──────────────────────────────────────────────────────

/// Extract the JWT signature segment from a compact JWT string.
///
/// A compact JWT has the form `header.payload.signature`.  The signature
/// segment produced by HS512 is an 86-character base64url string that acts as
/// a cryptographically unique, keyed identifier for the token — equivalent in
/// security to `HMAC(secret, header.payload)`.
///
/// # Panics
///
/// Panics if `token` does not contain two `.` separators; callers must only
/// pass strings returned by [`jwt::encode_refresh`], which always produce
/// well-formed compact JWTs.
fn jwt_signature(token: &str) -> &str {
    token
        .rsplitn(2, '.')
        .next()
        .expect("JWT must contain at least one '.' separator")
}

// ── Public service functions ───────────────────────────────────────────────────

/// Register a new user.
///
/// 1. Validates that the email is not already taken.
/// 2. Hashes the password.
/// 3. Inserts the user row.
/// 4. Creates default Kanban columns via the DB helper function.
/// 5. Issues token pair.
/// 6. Persists a hashed refresh token.
///
/// # Errors
///
/// - [`AppError::Conflict`] — email already registered.
/// - [`AppError::Internal`] — hashing or JWT failure.
/// - [`AppError::Db`] — unexpected database error.
pub async fn register(
    db: &PgPool,
    config: &Config,
    email: &str,
    password: &str,
    display_name: &str,
) -> AppResult<AuthResponse> {
    // Check for duplicate email.
    let exists: bool =
        sqlx::query_scalar!("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", email)
            .fetch_one(db)
            .await?
            .unwrap_or(false);

    if exists {
        return Err(AppError::Conflict("email already registered".to_owned()));
    }

    let password_hash = hash_password(password)?;

    // Insert user.
    let user = sqlx::query_as!(
        User,
        r#"
        INSERT INTO users (email, password_hash, display_name)
        VALUES ($1, $2, $3)
        RETURNING
            id, email, password_hash, display_name,
            avatar_url, timezone, created_at, updated_at
        "#,
        email,
        password_hash,
        display_name,
    )
    .fetch_one(db)
    .await?;

    // Seed default Kanban columns for the new user.
    // Insert the four default columns directly rather than calling the PL/pgSQL
    // helper, which returns void and cannot be used with sqlx's typed macros.
    sqlx::query!(
        r#"
        INSERT INTO kanban_columns (user_id, project_id, name, maps_to_status, position)
        VALUES
            ($1, NULL, 'Inbox',       'inbox'::task_status,       0),
            ($1, NULL, 'To Do',       'planned'::task_status,     1),
            ($1, NULL, 'In Progress', 'in_progress'::task_status, 2),
            ($1, NULL, 'Done',        'completed'::task_status,   3)
        ON CONFLICT DO NOTHING
        "#,
        user.id,
    )
    .execute(db)
    .await?;

    // Issue tokens.
    let (access_token, refresh_token) = issue_token_pair(db, config, user.id).await?;

    Ok(AuthResponse {
        access_token,
        refresh_token,
        user: UserProfile::from(user),
    })
}

/// Authenticate an existing user with email + password.
///
/// # Errors
///
/// - [`AppError::UnauthorizedMsg`] — user not found or password mismatch.
/// - [`AppError::Internal`] — hashing or JWT failure.
/// - [`AppError::Db`] — unexpected database error.
pub async fn login(
    db: &PgPool,
    config: &Config,
    email: &str,
    password: &str,
) -> AppResult<AuthResponse> {
    let user = sqlx::query_as!(
        User,
        r#"
        SELECT id, email, password_hash, display_name,
               avatar_url, timezone, created_at, updated_at
        FROM users
        WHERE email = $1
        "#,
        email,
    )
    .fetch_optional(db)
    .await?
    .ok_or_else(|| AppError::UnauthorizedMsg("invalid email or password".to_owned()))?;

    let valid = verify_password(password, &user.password_hash)?;
    if !valid {
        return Err(AppError::UnauthorizedMsg(
            "invalid email or password".to_owned(),
        ));
    }

    let (access_token, refresh_token) = issue_token_pair(db, config, user.id).await?;

    Ok(AuthResponse {
        access_token,
        refresh_token,
        user: UserProfile::from(user),
    })
}

/// Rotate the refresh token pair.
///
/// Validates the incoming refresh token, revokes it, and issues a fresh pair.
///
/// # Errors
///
/// - [`AppError::UnauthorizedMsg`] — token not found, revoked, or expired.
/// - [`AppError::Internal`] — JWT failure.
/// - [`AppError::Db`] — unexpected database error.
pub async fn refresh(
    db: &PgPool,
    config: &Config,
    raw_refresh_token: &str,
) -> AppResult<TokenPairResponse> {
    // Verify the JWT itself (signature + expiry + token_type = Refresh).
    let claims = jwt::decode_token(config, raw_refresh_token)?;
    if claims.token_type != crate::shared::jwt::TokenType::Refresh {
        return Err(AppError::UnauthorizedMsg(
            "expected a refresh token".to_owned(),
        ));
    }

    let token_hash = jwt_signature(raw_refresh_token);
    let now = Utc::now();

    // Look up the stored token.
    let stored = sqlx::query_as!(
        RefreshToken,
        r#"
        SELECT id, user_id, token_hash, expires_at, revoked, created_at
        FROM refresh_tokens
        WHERE token_hash = $1
        "#,
        token_hash,
    )
    .fetch_optional(db)
    .await?
    .ok_or_else(|| AppError::UnauthorizedMsg("refresh token not found".to_owned()))?;

    if stored.revoked {
        return Err(AppError::UnauthorizedMsg(
            "refresh token has been revoked".to_owned(),
        ));
    }

    if stored.expires_at <= now {
        return Err(AppError::UnauthorizedMsg(
            "refresh token has expired".to_owned(),
        ));
    }

    // Revoke the used token (one-time use).
    sqlx::query!(
        "UPDATE refresh_tokens SET revoked = true WHERE id = $1",
        stored.id
    )
    .execute(db)
    .await?;

    // Issue a fresh pair.
    let (access_token, new_refresh_token) = issue_token_pair(db, config, stored.user_id).await?;

    Ok(TokenPairResponse {
        access_token,
        refresh_token: new_refresh_token,
    })
}

/// Revoke the refresh token associated with the raw token string.
///
/// This is a best-effort operation: if the token is already revoked or not found,
/// the call is treated as a success (idempotent logout).
///
/// # Errors
///
/// Returns [`AppError::Db`] only on a genuine database failure.
pub async fn logout(db: &PgPool, raw_refresh_token: &str) -> AppResult<()> {
    let token_hash = jwt_signature(raw_refresh_token);

    sqlx::query!(
        "UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1",
        token_hash,
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Revoke **all** active refresh tokens for a user in a single statement.
///
/// This effectively logs the user out of every device. The operation is
/// idempotent — if all tokens are already revoked the call still succeeds.
///
/// # Errors
///
/// Returns [`AppError::Db`] on a genuine database failure.
pub async fn logout_all(db: &PgPool, user_id: Uuid) -> AppResult<()> {
    sqlx::query!(
        "UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false",
        user_id,
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Fetch the public profile for `user_id`.
///
/// # Errors
///
/// - [`AppError::NotFound`] — no user exists with that ID.
/// - [`AppError::Db`] — unexpected database error.
pub async fn get_me(db: &PgPool, user_id: Uuid) -> AppResult<UserProfile> {
    let user = sqlx::query_as!(
        User,
        r#"
        SELECT id, email, password_hash, display_name,
               avatar_url, timezone, created_at, updated_at
        FROM users
        WHERE id = $1
        "#,
        user_id,
    )
    .fetch_optional(db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(UserProfile::from(user))
}

// ── Private helpers ────────────────────────────────────────────────────────────

/// Encode a JWT access + refresh pair and persist the hashed refresh token.
async fn issue_token_pair(
    db: &PgPool,
    config: &Config,
    user_id: Uuid,
) -> AppResult<(String, String)> {
    let access_token = jwt::encode_access(config, user_id)?;
    let refresh_token = jwt::encode_refresh(config, user_id)?;

    let token_hash = jwt_signature(&refresh_token).to_owned();
    let expires_at = Utc::now() + chrono::Duration::seconds(config.refresh_token_ttl_secs as i64);

    sqlx::query!(
        r#"
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
        "#,
        user_id,
        token_hash,
        expires_at,
    )
    .execute(db)
    .await?;

    Ok((access_token, refresh_token))
}
