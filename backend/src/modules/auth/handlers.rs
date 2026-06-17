//! Auth module — Axum request handlers.
//!
//! Each handler is a thin adapter between the HTTP layer and the service layer:
//! - deserialise + validate the request body,
//! - call the service function,
//! - return a typed JSON response or propagate [`AppError`].

use axum::{extract::State, http::StatusCode, Json};
use validator::Validate;

use crate::shared::{
    error::{AppError, AppResult},
    extractors::AuthUser,
    state::AppState,
};

use super::{
    models::{
        AuthResponse, LoginRequest, RefreshRequest, RegisterRequest, TokenPairResponse, UserProfile,
    },
    service,
};

// ── POST /api/auth/register ────────────────────────────────────────────────────

/// Register a new account.
///
/// Returns HTTP 201 with an [`AuthResponse`] containing both tokens and a user
/// profile on success.
///
/// # Errors
///
/// - 409 — email already taken.
/// - 422 — request body failed validation.
/// - 500 — internal error (password hashing or JWT).
pub async fn register(
    State(state): State<AppState>,
    Json(body): Json<RegisterRequest>,
) -> AppResult<(StatusCode, Json<AuthResponse>)> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let response = service::register(
        &state.db,
        &state.config,
        &body.email,
        &body.password,
        &body.display_name,
    )
    .await?;

    Ok((StatusCode::CREATED, Json(response)))
}

// ── POST /api/auth/login ───────────────────────────────────────────────────────

/// Authenticate with email + password.
///
/// Returns HTTP 200 with an [`AuthResponse`].
///
/// # Errors
///
/// - 401 — invalid credentials.
/// - 422 — request body failed validation.
/// - 500 — internal error.
pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> AppResult<Json<AuthResponse>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let response = service::login(&state.db, &state.config, &body.email, &body.password).await?;

    Ok(Json(response))
}

// ── POST /api/auth/refresh ─────────────────────────────────────────────────────

/// Exchange a valid refresh token for a new token pair.
///
/// The supplied refresh token is revoked immediately; a brand-new pair is
/// returned.  Clients must update their stored tokens.
///
/// # Errors
///
/// - 401 — token missing, revoked, or expired.
/// - 422 — request body failed validation.
/// - 500 — internal error.
pub async fn refresh(
    State(state): State<AppState>,
    Json(body): Json<RefreshRequest>,
) -> AppResult<Json<TokenPairResponse>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let response = service::refresh(&state.db, &state.config, &body.refresh_token).await?;

    Ok(Json(response))
}

// ── POST /api/auth/logout ──────────────────────────────────────────────────────

/// Revoke the supplied refresh token.
///
/// Requires a valid access token in the `Authorization` header so that only the
/// token's owner can revoke it.  Returns HTTP 204 No Content on success.
///
/// # Errors
///
/// - 401 — missing or invalid access token, or missing refresh token body.
/// - 422 — request body failed validation.
/// - 500 — internal error.
pub async fn logout(
    _auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<RefreshRequest>,
) -> AppResult<StatusCode> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    service::logout(&state.db, &body.refresh_token).await?;

    Ok(StatusCode::NO_CONTENT)
}

// ── POST /api/auth/logout-all ─────────────────────────────────────────────────

/// Revoke all active refresh tokens for the authenticated user.
///
/// This logs the user out of **every** device simultaneously. The current
/// access token remains valid until it expires naturally (short-lived, ≤ 15 min).
/// Returns HTTP 204 No Content on success.
///
/// # Errors
///
/// - 401 — missing or invalid access token.
/// - 500 — database error.
pub async fn logout_all(auth: AuthUser, State(state): State<AppState>) -> AppResult<StatusCode> {
    service::logout_all(&state.db, auth.user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── GET /api/auth/me ───────────────────────────────────────────────────────────

/// Return the profile of the currently authenticated user.
///
/// Requires a valid access token in the `Authorization` header.
///
/// # Errors
///
/// - 401 — missing or invalid access token.
/// - 404 — user record not found (should not happen in practice).
/// - 500 — internal error.
pub async fn me(auth: AuthUser, State(state): State<AppState>) -> AppResult<Json<UserProfile>> {
    let profile = service::get_me(&state.db, auth.user_id).await?;
    Ok(Json(profile))
}
