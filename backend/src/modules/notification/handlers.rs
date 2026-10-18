//! Axum route handlers for the `notification` module.
//!
//! Every handler:
//! - Requires a valid JWT access token via [`AuthUser`].
//! - Delegates all DB work to [`super::service::NotificationService`].
//! - Returns `Result<Json<_>, AppError>` so [`AppError`] is serialised
//!   automatically by [`axum::response::IntoResponse`].

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use serde_json::json;
use uuid::Uuid;
use validator::Validate;

use crate::shared::{error::AppError, extractors::AuthUser, state::AppState};

use super::{
    models::{
        CreateNotificationRequest, ListNotificationsQuery, PushSubscribeRequest,
        PushUnsubscribeRequest, SnoozeNotificationRequest, UpdateNotificationRequest,
    },
    service::NotificationService,
};

// ---------------------------------------------------------------------------
// GET /api/notifications
// ---------------------------------------------------------------------------

/// List the authenticated user's notifications with optional pagination and
/// unread-only filtering.
///
/// ### Query parameters
/// | name         | type    | default | description                         |
/// |--------------|---------|---------|-------------------------------------|
/// | `unread_only`| bool    | `false` | Return only unread notifications    |
/// | `page`       | u32     | `1`     | 1-based page number                 |
/// | `page_size`  | u32     | `20`    | Items per page (clamped to 1–100)   |
pub async fn list_notifications(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ListNotificationsQuery>,
) -> Result<impl IntoResponse, AppError> {
    let result = NotificationService::list(&state.db, auth.user_id, &query).await?;
    Ok(Json(result))
}

// ---------------------------------------------------------------------------
// GET /api/notifications/unread-count
// ---------------------------------------------------------------------------

/// Return only the unread notification count — lightweight polling endpoint.
///
/// Clients that want to show a badge without fetching the full list should
/// use this endpoint.
pub async fn get_unread_count(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, AppError> {
    let result = NotificationService::unread_count(&state.db, auth.user_id).await?;
    Ok(Json(result))
}

// ---------------------------------------------------------------------------
// GET /api/notifications/:id
// ---------------------------------------------------------------------------

/// Fetch a single notification by ID.
///
/// Returns `404 NOT_FOUND` when the notification does not exist or belongs
/// to a different user.
pub async fn get_notification(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(notification_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let result = NotificationService::get_by_id(&state.db, auth.user_id, notification_id).await?;
    Ok(Json(result))
}

// ---------------------------------------------------------------------------
// POST /api/notifications
// ---------------------------------------------------------------------------

/// Create a new notification (manual or system use).
///
/// In production the scheduler jobs create reminder notifications automatically.
/// This endpoint is intended for system-generated messages and integration
/// tests.
pub async fn create_notification(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreateNotificationRequest>,
) -> Result<impl IntoResponse, AppError> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let result = NotificationService::create(&state.db, auth.user_id, &body).await?;
    Ok((StatusCode::CREATED, Json(result)))
}

// ---------------------------------------------------------------------------
// PATCH /api/notifications/:id
// ---------------------------------------------------------------------------

/// Partially update a notification (currently: toggle `read` state).
///
/// Returns `404 NOT_FOUND` when the notification does not exist or belongs
/// to a different user.
pub async fn update_notification(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(notification_id): Path<Uuid>,
    Json(body): Json<UpdateNotificationRequest>,
) -> Result<impl IntoResponse, AppError> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    // If `read` is not provided there is nothing to update.
    let read = body
        .read
        .ok_or_else(|| AppError::Validation("at least one field must be provided".to_owned()))?;

    let result =
        NotificationService::mark_read(&state.db, auth.user_id, notification_id, read).await?;
    Ok(Json(result))
}

// ---------------------------------------------------------------------------
// POST /api/notifications/:id/snooze
// ---------------------------------------------------------------------------

/// Snooze a notification until the given RFC 3339 timestamp.
///
/// `until` must be in the future. Returns `404` when the notification does not
/// belong to the caller.
pub async fn snooze_notification(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(notification_id): Path<Uuid>,
    Json(body): Json<SnoozeNotificationRequest>,
) -> Result<impl IntoResponse, AppError> {
    if body.until <= Utc::now() {
        return Err(AppError::Validation("until must be in the future".to_owned()));
    }
    let result =
        NotificationService::snooze(&state.db, auth.user_id, notification_id, body.until).await?;
    Ok(Json(result))
}

// ---------------------------------------------------------------------------
// POST /api/notifications/:id/unsnooze
// ---------------------------------------------------------------------------

/// Clear a notification's snooze, returning it to the inbox immediately.
pub async fn unsnooze_notification(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(notification_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let result = NotificationService::unsnooze(&state.db, auth.user_id, notification_id).await?;
    Ok(Json(result))
}

// ---------------------------------------------------------------------------
// POST /api/notifications/:id/read
// ---------------------------------------------------------------------------

/// Convenience endpoint: mark a single notification as **read**.
///
/// Equivalent to `PATCH /api/notifications/:id` with `{ "read": true }` but
/// easier to call from a frontend click handler.
pub async fn mark_notification_read(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(notification_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let result =
        NotificationService::mark_read(&state.db, auth.user_id, notification_id, true).await?;
    Ok(Json(result))
}

// ---------------------------------------------------------------------------
// POST /api/notifications/mark-all-read
// ---------------------------------------------------------------------------

/// Mark every unread notification for the authenticated user as read in one
/// batch operation.
pub async fn mark_all_read(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, AppError> {
    let affected = NotificationService::mark_all_read(&state.db, auth.user_id).await?;
    Ok(Json(json!({ "updated": affected })))
}

// ---------------------------------------------------------------------------
// DELETE /api/notifications/:id
// ---------------------------------------------------------------------------

/// Delete a single notification.
///
/// Returns `404 NOT_FOUND` when the notification does not exist or belongs
/// to a different user. Returns `204 No Content` on success.
pub async fn delete_notification(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(notification_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    NotificationService::delete(&state.db, auth.user_id, notification_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// POST /api/notifications/push/subscribe
// ---------------------------------------------------------------------------

/// Register a browser Web Push subscription for the authenticated user.
///
/// The request body must match the shape produced by
/// `PushSubscription.toJSON()` in the browser:
///
/// ```json
/// {
///   "endpoint": "https://fcm.googleapis.com/...",
///   "keys": {
///     "p256dh": "<base64url>",
///     "auth":   "<base64url>"
///   }
/// }
/// ```
///
/// Returns `204 No Content` on success. The operation is idempotent — if the
/// endpoint is already registered it is updated with the new keys.
pub async fn push_subscribe(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<PushSubscribeRequest>,
) -> Result<impl IntoResponse, AppError> {
    NotificationService::push_subscribe(&state.db, auth.user_id, &body).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// POST /api/notifications/push/unsubscribe
// ---------------------------------------------------------------------------

/// Remove a browser Web Push subscription identified by its endpoint URL.
///
/// The request body must contain the `endpoint` field:
///
/// ```json
/// { "endpoint": "https://fcm.googleapis.com/..." }
/// ```
///
/// Returns `204 No Content` on success. The operation is idempotent — if the
/// endpoint is not found the call still succeeds.
pub async fn push_unsubscribe(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<PushUnsubscribeRequest>,
) -> Result<impl IntoResponse, AppError> {
    NotificationService::push_unsubscribe(&state.db, auth.user_id, &body).await?;
    Ok(StatusCode::NO_CONTENT)
}
