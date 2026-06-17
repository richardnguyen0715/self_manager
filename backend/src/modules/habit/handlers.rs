//! Habit module — Axum request handlers.
//!
//! Every handler:
//! - Extracts [`AuthUser`] to enforce authentication.
//! - Delegates all business logic to [`super::service`].
//! - Returns `Result<Json<T>, AppError>` for uniform error serialisation.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{Duration, Utc};
use uuid::Uuid;
use validator::Validate;

use crate::shared::{
    error::{AppError, AppResult},
    extractors::AuthUser,
    state::AppState,
};

use super::{
    models::{
        CreateHabitRequest, HabitLogResponse, HabitResponse, LogHabitRequest, LogsQuery,
        UpdateHabitRequest,
    },
    service,
};

// ── Habit CRUD ────────────────────────────────────────────────────────────────

/// `GET /habits`
///
/// Returns all active (non-archived) habits for the authenticated user,
/// ordered by position then creation date.
pub async fn list_habits(
    auth: AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<Vec<HabitResponse>>> {
    let habits = service::list_habits(&state, auth.user_id).await?;
    Ok(Json(habits))
}

/// `GET /habits/:id`
///
/// Returns a single habit by ID.  Returns 404 if the habit does not belong
/// to the authenticated user.
pub async fn get_habit(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(habit_id): Path<Uuid>,
) -> AppResult<Json<HabitResponse>> {
    let habit = service::get_habit(&state, auth.user_id, habit_id).await?;
    Ok(Json(habit))
}

/// `POST /habits`
///
/// Creates a new habit.  Returns `201 Created` with the new resource.
pub async fn create_habit(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreateHabitRequest>,
) -> AppResult<(StatusCode, Json<HabitResponse>)> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let habit = service::create_habit(&state, auth.user_id, body).await?;
    Ok((StatusCode::CREATED, Json(habit)))
}

/// `PATCH /habits/:id`
///
/// Partially updates a habit.  Only supplied fields are modified.
pub async fn update_habit(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(habit_id): Path<Uuid>,
    Json(body): Json<UpdateHabitRequest>,
) -> AppResult<Json<HabitResponse>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let habit = service::update_habit(&state, auth.user_id, habit_id, body).await?;
    Ok(Json(habit))
}

/// `DELETE /habits/:id`
///
/// Permanently deletes a habit and all associated logs (FK cascade).
/// Returns `204 No Content` on success.
pub async fn delete_habit(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(habit_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::delete_habit(&state, auth.user_id, habit_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// `POST /habits/:id/archive`
///
/// Soft-deletes a habit by setting `archived = true`.
pub async fn archive_habit(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(habit_id): Path<Uuid>,
) -> AppResult<Json<HabitResponse>> {
    let habit = service::archive_habit(&state, auth.user_id, habit_id).await?;
    Ok(Json(habit))
}

// ── Habit logs ────────────────────────────────────────────────────────────────

/// `GET /habits/:id/logs`
///
/// Returns log entries for the given habit.  Accepts optional `from` and `to`
/// date query parameters (defaults: last 30 days).
pub async fn list_logs(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(habit_id): Path<Uuid>,
    Query(query): Query<LogsQuery>,
) -> AppResult<Json<Vec<HabitLogResponse>>> {
    let today = Utc::now().date_naive();
    let from = query.from.unwrap_or_else(|| today - Duration::days(29));
    let to = query.to.unwrap_or(today);

    if from > to {
        return Err(AppError::Validation(
            "'from' must not be after 'to'".to_owned(),
        ));
    }

    let logs = service::list_logs(&state, auth.user_id, habit_id, from, to).await?;
    Ok(Json(logs))
}

/// `POST /habits/:id/logs`
///
/// Upserts a log entry for the given habit on the specified date.
/// Returns `201 Created` with the created or updated log row.
pub async fn log_habit(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(habit_id): Path<Uuid>,
    Json(body): Json<LogHabitRequest>,
) -> AppResult<(StatusCode, Json<HabitLogResponse>)> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let log = service::log_habit(&state, auth.user_id, habit_id, body).await?;
    Ok((StatusCode::CREATED, Json(log)))
}

/// `DELETE /habits/:id/logs/:log_id`
///
/// Removes a specific log entry.  Returns `204 No Content`.
pub async fn delete_log(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((habit_id, log_id)): Path<(Uuid, Uuid)>,
) -> AppResult<StatusCode> {
    service::delete_log(&state, auth.user_id, habit_id, log_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
