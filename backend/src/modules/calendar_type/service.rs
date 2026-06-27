//! Business logic for the `calendar_type` module.
//!
//! Uses sqlx's **runtime** query API (`query_as::<_, T>(...).bind(..)`) rather
//! than the compile-time `query_as!` macro, so new tables don't require
//! regenerating the offline `.sqlx` query cache before the Docker build.
//!
//! Every query filters by `user_id` for ownership scoping.

use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    state::AppState,
};

use super::models::{CalendarType, CreateCalendarTypeRequest, UpdateCalendarTypeRequest};

const SELECT_COLS: &str = "id, user_id, name, color, icon, description, \
     default_all_day, default_reminder_minutes, created_at, updated_at";

// ── Read ──────────────────────────────────────────────────────────────────────

pub async fn list(state: &AppState, user_id: Uuid) -> AppResult<Vec<CalendarType>> {
    let sql = format!(
        "SELECT {SELECT_COLS} FROM calendar_types WHERE user_id = $1 ORDER BY created_at ASC"
    );
    let rows = sqlx::query_as::<_, CalendarType>(&sql)
        .bind(user_id)
        .fetch_all(&state.db)
        .await?;
    Ok(rows)
}

pub async fn get(state: &AppState, user_id: Uuid, id: Uuid) -> AppResult<CalendarType> {
    let sql = format!(
        "SELECT {SELECT_COLS} FROM calendar_types WHERE id = $1 AND user_id = $2"
    );
    sqlx::query_as::<_, CalendarType>(&sql)
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)
}

// ── Write ──────────────────────────────────────────────────────────────────────

pub async fn create(
    state: &AppState,
    user_id: Uuid,
    req: CreateCalendarTypeRequest,
) -> AppResult<CalendarType> {
    let sql = format!(
        "INSERT INTO calendar_types \
            (user_id, name, color, icon, description, default_all_day, default_reminder_minutes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) \
         RETURNING {SELECT_COLS}"
    );
    let row = sqlx::query_as::<_, CalendarType>(&sql)
        .bind(user_id)
        .bind(req.name)
        .bind(req.color)
        .bind(req.icon)
        .bind(req.description)
        .bind(req.default_all_day)
        .bind(req.default_reminder_minutes)
        .fetch_one(&state.db)
        .await?;
    Ok(row)
}

pub async fn update(
    state: &AppState,
    user_id: Uuid,
    id: Uuid,
    req: UpdateCalendarTypeRequest,
) -> AppResult<CalendarType> {
    // Load existing (enforces ownership) then resolve each optional field.
    let existing = get(state, user_id, id).await?;

    let name = req.name.unwrap_or(existing.name);
    let color = req.color.unwrap_or(existing.color);
    let icon = req.icon.unwrap_or(existing.icon);
    let description = req.description.unwrap_or(existing.description);
    let default_all_day = req.default_all_day.unwrap_or(existing.default_all_day);
    let default_reminder_minutes = req
        .default_reminder_minutes
        .unwrap_or(existing.default_reminder_minutes);

    let sql = format!(
        "UPDATE calendar_types \
         SET name = $1, color = $2, icon = $3, description = $4, \
             default_all_day = $5, default_reminder_minutes = $6, updated_at = now() \
         WHERE id = $7 AND user_id = $8 \
         RETURNING {SELECT_COLS}"
    );
    sqlx::query_as::<_, CalendarType>(&sql)
        .bind(name)
        .bind(color)
        .bind(icon)
        .bind(description)
        .bind(default_all_day)
        .bind(default_reminder_minutes)
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)
}

pub async fn delete(state: &AppState, user_id: Uuid, id: Uuid) -> AppResult<()> {
    let result = sqlx::query("DELETE FROM calendar_types WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user_id)
        .execute(&state.db)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}
