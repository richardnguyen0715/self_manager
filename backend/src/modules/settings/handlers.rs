//! Settings module — Axum request handlers.
//!
//! Each handler is a thin adapter:
//! - deserialises and validates the request body,
//! - calls the service function,
//! - returns a typed JSON response or propagates [`AppError`].

use axum::{extract::State, http::StatusCode, Json};
use validator::Validate;

use crate::shared::{
    error::{AppError, AppResult},
    extractors::AuthUser,
    state::AppState,
};

use super::{
    models::{
        AppearancePreferences, ChangePasswordRequest, DeleteAccountRequest,
        NotificationPreferences, UpdateAppearanceRequest, UpdateNotificationPrefsRequest,
    },
    service,
};

// ── GET /api/settings/appearance ─────────────────────────────────────────────

/// Return the appearance preferences for the authenticated user.
///
/// Inserts a default row if none exists.
///
/// # Errors
///
/// - 401 — missing or invalid access token.
/// - 500 — database error.
pub async fn get_appearance(
    auth: AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<AppearancePreferences>> {
    let prefs = service::get_appearance(&state.db, auth.user_id).await?;
    Ok(Json(prefs))
}

// ── PATCH /api/settings/appearance ───────────────────────────────────────────

/// Partially update appearance preferences.
///
/// Only fields present in the JSON body are updated; absent fields keep their
/// current value.
///
/// # Errors
///
/// - 401 — missing or invalid access token.
/// - 422 — invalid `week_starts_on` (must be 0 or 1).
/// - 500 — database error.
pub async fn update_appearance(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<UpdateAppearanceRequest>,
) -> AppResult<Json<AppearancePreferences>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let prefs = service::update_appearance(&state.db, auth.user_id, &body).await?;
    Ok(Json(prefs))
}

// ── GET /api/settings/notifications ──────────────────────────────────────────

/// Return the notification preferences for the authenticated user.
///
/// # Errors
///
/// - 401 — missing or invalid access token.
/// - 500 — database error.
pub async fn get_notification_prefs(
    auth: AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<NotificationPreferences>> {
    let prefs = service::get_notification_prefs(&state.db, auth.user_id).await?;
    Ok(Json(prefs))
}

// ── PATCH /api/settings/notifications ────────────────────────────────────────

/// Partially update notification preferences.
///
/// # Errors
///
/// - 401 — missing or invalid access token.
/// - 422 — validation failure.
/// - 500 — database error.
pub async fn update_notification_prefs(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<UpdateNotificationPrefsRequest>,
) -> AppResult<Json<NotificationPreferences>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let prefs = service::update_notification_prefs(&state.db, auth.user_id, &body).await?;
    Ok(Json(prefs))
}

// ── POST /api/settings/account/password ──────────────────────────────────────

/// Change the authenticated user's password.
///
/// Requires the current password for verification. Returns 204 on success.
///
/// # Errors
///
/// - 401 — incorrect current password or missing bearer token.
/// - 422 — validation failure (new_password < 8 chars, etc.).
/// - 500 — internal error (hashing or DB).
pub async fn change_password(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<ChangePasswordRequest>,
) -> AppResult<StatusCode> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    service::change_password(
        &state.db,
        auth.user_id,
        &body.current_password,
        &body.new_password,
    )
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

// ── POST /api/settings/account/delete ────────────────────────────────────────

/// Permanently delete the authenticated user's account.
///
/// Requires the account password as confirmation. All child rows are removed
/// via `ON DELETE CASCADE`. Returns 204 on success.
///
/// # Errors
///
/// - 401 — incorrect password or missing bearer token.
/// - 422 — validation failure.
/// - 500 — database error.
pub async fn delete_account(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<DeleteAccountRequest>,
) -> AppResult<StatusCode> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    service::delete_account(&state.db, auth.user_id, &body.password).await?;

    Ok(StatusCode::NO_CONTENT)
}
