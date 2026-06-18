//! Auth module — Axum request handlers.
//!
//! Each handler is a thin adapter between the HTTP layer and the service layer:
//! - deserialise + validate the request body,
//! - call the service function,
//! - return a typed JSON response or propagate [`AppError`].

use axum::{extract::{Multipart, State}, http::StatusCode, Json};
use validator::Validate;

use crate::shared::{
    error::{AppError, AppResult},
    extractors::AuthUser,
    state::AppState,
};

use super::{
    models::{
        AuthResponse, LoginRequest, RefreshRequest, RegisterRequest, TokenPairResponse,
        UpdateProfileRequest, UserProfile,
    },
    service,
};

/// Absolute path to the uploads directory (same constant used by work_item).
const UPLOADS_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/uploads");

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

// ── PATCH /api/auth/me ────────────────────────────────────────────────────────

/// Partially update the authenticated user's profile.
///
/// Accepts an optional `display_name` and/or `timezone`; unset fields keep
/// their current values (COALESCE semantics).  Returns the updated
/// [`UserProfile`].
///
/// # Errors
///
/// - 401 — missing or invalid access token.
/// - 404 — user record not found.
/// - 422 — validation failed.
/// - 500 — internal error.
pub async fn update_me(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<UpdateProfileRequest>,
) -> AppResult<Json<UserProfile>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let profile =
        service::update_profile(&state.db, auth.user_id, body.display_name, body.timezone).await?;
    Ok(Json(profile))
}

// ── POST /api/auth/me/avatar ──────────────────────────────────────────────────

/// Upload a new avatar image for the authenticated user.
///
/// Expects `multipart/form-data` with a single field named `file` whose
/// content-type starts with `image/`.  Saves the file to the `uploads/`
/// directory, sets `users.avatar_url`, and returns the updated [`UserProfile`].
///
/// # Errors
///
/// - 401 — missing or invalid access token.
/// - 404 — user record not found.
/// - 422 — `file` field missing or not an image MIME type.
/// - 500 — I/O or database error.
pub async fn upload_avatar(
    auth: AuthUser,
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> AppResult<Json<UserProfile>> {
    let mut file_bytes: Option<bytes::Bytes> = None;
    let mut original_filename: Option<String> = None;
    let mut mime_type: Option<String> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        AppError::Validation(format!("multipart error: {e}"))
    })? {
        if field.name().unwrap_or("") == "file" {
            original_filename = field
                .file_name()
                .map(ToOwned::to_owned)
                .or_else(|| Some("avatar".to_owned()));
            mime_type = field.content_type().map(ToOwned::to_owned);
            let data = field.bytes().await.map_err(|e| {
                AppError::Validation(format!("failed to read file field: {e}"))
            })?;
            file_bytes = Some(data);
            break;
        }
    }

    let bytes = file_bytes
        .ok_or_else(|| AppError::Validation("multipart field 'file' is required".to_owned()))?;

    // Validate MIME type.
    let mime = mime_type.unwrap_or_default();
    if !mime.starts_with("image/") {
        return Err(AppError::Validation(
            "uploaded file must be an image (image/* MIME type required)".to_owned(),
        ));
    }

    // Build a uuid-prefixed, sanitised filename.
    let raw_name = original_filename.unwrap_or_else(|| "avatar".to_owned());
    let sanitized: String = raw_name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let sanitized = sanitized.trim_matches('_');
    let sanitized = if sanitized.is_empty() { "avatar" } else { sanitized };

    let file_id = uuid::Uuid::new_v4();
    let stored_name = format!("{file_id}-{sanitized}");
    let uploads_dir = std::path::Path::new(UPLOADS_DIR);
    let full_path = uploads_dir.join(&stored_name);

    std::fs::create_dir_all(uploads_dir).map_err(|e| {
        AppError::InternalMsg(anyhow::anyhow!("failed to create uploads directory: {e}"))
    })?;

    tokio::fs::write(&full_path, &bytes).await.map_err(|e| {
        AppError::InternalMsg(anyhow::anyhow!(
            "failed to write avatar file {}: {e}",
            full_path.display()
        ))
    })?;

    let avatar_url = format!("/uploads/{stored_name}");
    let profile = service::set_avatar(&state.db, auth.user_id, avatar_url).await?;
    Ok(Json(profile))
}

// ── DELETE /api/auth/me/avatar ────────────────────────────────────────────────

/// Clear the authenticated user's avatar.
///
/// Sets `users.avatar_url` to NULL and attempts to remove the file from disk
/// (best-effort; disk errors are silently ignored).  Returns the updated
/// [`UserProfile`] with `avatar_url: null`.
///
/// # Errors
///
/// - 401 — missing or invalid access token.
/// - 404 — user record not found.
/// - 500 — database error.
pub async fn delete_avatar(
    auth: AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<UserProfile>> {
    let (old_url, profile) = service::clear_avatar(&state.db, auth.user_id).await?;

    // Best-effort: remove the old file from disk.
    if let Some(url) = old_url {
        // url is "/uploads/<filename>"; strip the leading "/uploads/" prefix.
        if let Some(filename) = url.strip_prefix("/uploads/") {
            let full_path = std::path::Path::new(UPLOADS_DIR).join(filename);
            let _ = tokio::fs::remove_file(&full_path).await;
        }
    }

    Ok(Json(profile))
}
