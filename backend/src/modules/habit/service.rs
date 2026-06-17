//! Habit module — business-logic layer.
//!
//! All database I/O uses `sqlx::query!` / `sqlx::query_as!` macros for
//! compile-time query verification.  `NUMERIC(10,2)` columns are cast to
//! `DOUBLE PRECISION` at the SQL level so they decode cleanly as `f64` without
//! requiring the optional `bigdecimal` sqlx feature.

use chrono::{Datelike, Duration, NaiveDate, NaiveTime, Utc};
use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    events::DomainEvent,
    state::AppState,
};

#[allow(unused_imports)] // HabitType is a sqlx type-override annotation target
use super::models::{
    CreateHabitRequest, Habit, HabitFrequency, HabitLog, HabitLogResponse, HabitResponse,
    HabitType, LogHabitRequest, UpdateHabitRequest,
};

// ── Private helpers ───────────────────────────────────────────────────────────

/// Parse an optional `"HH:MM"` string into a [`NaiveTime`].
fn parse_time_opt(s: &Option<String>) -> AppResult<Option<NaiveTime>> {
    match s {
        None => Ok(None),
        Some(t) => NaiveTime::parse_from_str(t, "%H:%M")
            .map(Some)
            .map_err(|_| AppError::Validation(format!("reminder_time '{t}' must be HH:MM"))),
    }
}

/// Format an optional [`NaiveTime`] as `"HH:MM"`.
fn fmt_time_opt(t: Option<NaiveTime>) -> Option<String> {
    t.map(|v| v.format("%H:%M").to_string())
}

// ── Streak / completion-rate ───────────────────────────────────────────────────

/// Current streak in completed periods (days or weeks) ending today.
///
/// Allows the current period to still be in-progress (not yet logged).
fn calc_streak(habit: &Habit, logs: &[HabitLog]) -> i32 {
    let today = Utc::now().date_naive();

    match habit.frequency {
        HabitFrequency::Daily | HabitFrequency::Custom => {
            let completed: std::collections::HashSet<NaiveDate> = logs
                .iter()
                .filter(|l| l.completed)
                .map(|l| l.log_date)
                .collect();

            // Allow today to still be open.
            let start = if completed.contains(&today) {
                today
            } else {
                today - Duration::days(1)
            };

            let mut streak = 0i32;
            let mut cursor = start;
            loop {
                if completed.contains(&cursor) {
                    streak += 1;
                    cursor -= Duration::days(1);
                } else {
                    break;
                }
            }
            streak
        }

        HabitFrequency::Weekly => {
            let completed_weeks: std::collections::HashSet<(i32, u32)> = logs
                .iter()
                .filter(|l| l.completed)
                .map(|l| (l.log_date.year(), l.log_date.iso_week().week()))
                .collect();

            let this_week = (today.year(), today.iso_week().week());
            let offset = if completed_weeks.contains(&this_week) {
                0i64
            } else {
                1
            };

            let mut streak = 0i32;
            let mut w = offset;
            loop {
                let d = today - Duration::weeks(w);
                let key = (d.year(), d.iso_week().week());
                if completed_weeks.contains(&key) {
                    streak += 1;
                    w += 1;
                } else {
                    break;
                }
            }
            streak
        }
    }
}

/// Completion rate over the last 30 days (inclusive), returned as 0.0–1.0.
fn calc_completion_rate_30d(habit: &Habit, logs: &[HabitLog]) -> f64 {
    let today = Utc::now().date_naive();
    let start = today - Duration::days(29);

    let applicable: Vec<NaiveDate> = (0i64..30)
        .map(|i| start + Duration::days(i))
        .filter(|d| match habit.frequency {
            HabitFrequency::Daily => true,
            HabitFrequency::Weekly => d.weekday() == chrono::Weekday::Mon,
            HabitFrequency::Custom => habit.frequency_days.as_deref().map_or(true, |days| {
                days.contains(&(d.weekday().num_days_from_sunday() as i32))
            }),
        })
        .collect();

    let total = applicable.len();
    if total == 0 {
        return 0.0;
    }

    let done_dates: std::collections::HashSet<NaiveDate> = logs
        .iter()
        .filter(|l| l.completed && l.log_date >= start && l.log_date <= today)
        .map(|l| l.log_date)
        .collect();

    let done = applicable.iter().filter(|d| done_dates.contains(d)).count();
    done as f64 / total as f64
}

// ── Shared query fragments ────────────────────────────────────────────────────

/// Fetch the 30-day log window for `habit_id` (used for stats enrichment).
async fn fetch_recent_logs(state: &AppState, habit_id: Uuid) -> AppResult<Vec<HabitLog>> {
    let rows = sqlx::query_as!(
        HabitLog,
        r#"
        SELECT
            id,
            habit_id,
            user_id,
            log_date,
            value::DOUBLE PRECISION  AS "value!: f64",
            completed,
            note,
            created_at,
            updated_at
        FROM habit_logs
        WHERE habit_id = $1
          AND log_date >= (CURRENT_DATE - INTERVAL '30 days')
        ORDER BY log_date DESC
        "#,
        habit_id
    )
    .fetch_all(&state.db)
    .await?;
    Ok(rows)
}

/// Attach live streak + completion_rate stats to a [`Habit`] row and return a
/// [`HabitResponse`].
async fn enrich(state: &AppState, habit: Habit) -> AppResult<HabitResponse> {
    let logs = fetch_recent_logs(state, habit.id).await?;
    let current_streak = calc_streak(&habit, &logs);
    let completion_rate_30d = calc_completion_rate_30d(&habit, &logs);
    let reminder_time = fmt_time_opt(habit.reminder_time);

    Ok(HabitResponse {
        id: habit.id,
        user_id: habit.user_id,
        name: habit.name,
        description: habit.description,
        habit_type: habit.habit_type,
        target_value: habit.target_value,
        frequency: habit.frequency,
        frequency_days: habit.frequency_days,
        reminder_time,
        color: habit.color,
        icon: habit.icon,
        archived: habit.archived,
        position: habit.position,
        current_streak,
        completion_rate_30d,
        created_at: habit.created_at,
        updated_at: habit.updated_at,
    })
}

fn log_to_response(log: HabitLog) -> HabitLogResponse {
    HabitLogResponse {
        id: log.id,
        habit_id: log.habit_id,
        log_date: log.log_date,
        value: log.value,
        completed: log.completed,
        note: log.note,
        created_at: log.created_at,
        updated_at: log.updated_at,
    }
}

// ── Public service API ────────────────────────────────────────────────────────

/// List active habits for `user_id`, ordered by position then creation date.
pub async fn list_habits(state: &AppState, user_id: Uuid) -> AppResult<Vec<HabitResponse>> {
    let rows = sqlx::query_as!(
        Habit,
        r#"
        SELECT
            id,
            user_id,
            name,
            description,
            habit_type      AS "habit_type: HabitType",
            target_value::DOUBLE PRECISION AS "target_value!: f64",
            frequency       AS "frequency: HabitFrequency",
            frequency_days,
            reminder_time,
            color,
            icon,
            archived,
            position,
            created_at,
            updated_at
        FROM habits
        WHERE user_id = $1
          AND archived = false
        ORDER BY position ASC, created_at ASC
        "#,
        user_id
    )
    .fetch_all(&state.db)
    .await?;

    let mut out = Vec::with_capacity(rows.len());
    for row in rows {
        out.push(enrich(state, row).await?);
    }
    Ok(out)
}

/// Fetch a single habit, asserting ownership.
pub async fn get_habit(
    state: &AppState,
    user_id: Uuid,
    habit_id: Uuid,
) -> AppResult<HabitResponse> {
    let habit = sqlx::query_as!(
        Habit,
        r#"
        SELECT
            id,
            user_id,
            name,
            description,
            habit_type      AS "habit_type: HabitType",
            target_value::DOUBLE PRECISION AS "target_value!: f64",
            frequency       AS "frequency: HabitFrequency",
            frequency_days,
            reminder_time,
            color,
            icon,
            archived,
            position,
            created_at,
            updated_at
        FROM habits
        WHERE id = $1 AND user_id = $2
        "#,
        habit_id,
        user_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    enrich(state, habit).await
}

/// Create a new habit.
pub async fn create_habit(
    state: &AppState,
    user_id: Uuid,
    req: CreateHabitRequest,
) -> AppResult<HabitResponse> {
    // Validate custom-frequency constraints.
    if req.frequency == HabitFrequency::Custom {
        match req.frequency_days.as_deref() {
            None | Some([]) => {
                return Err(AppError::Validation(
                    "frequency_days required when frequency is 'custom'".to_owned(),
                ));
            }
            Some(days) => {
                if days.iter().any(|&d| !(0..=6).contains(&d)) {
                    return Err(AppError::Validation(
                        "each frequency_days value must be 0–6".to_owned(),
                    ));
                }
            }
        }
    }

    let target = req.target_value.unwrap_or(1.0);
    if target < 1.0 {
        return Err(AppError::Validation(
            "target_value must be at least 1".to_owned(),
        ));
    }

    let reminder = parse_time_opt(&req.reminder_time)?;
    let position = req.position.unwrap_or(0);

    let habit = sqlx::query_as!(
        Habit,
        r#"
        INSERT INTO habits (
            user_id, name, description, habit_type, target_value,
            frequency, frequency_days, reminder_time, color, icon, position
        )
        VALUES ($1, $2, $3, $4, $5::NUMERIC, $6, $7, $8, $9, $10, $11)
        RETURNING
            id,
            user_id,
            name,
            description,
            habit_type      AS "habit_type: HabitType",
            target_value::DOUBLE PRECISION AS "target_value!: f64",
            frequency       AS "frequency: HabitFrequency",
            frequency_days,
            reminder_time,
            color,
            icon,
            archived,
            position,
            created_at,
            updated_at
        "#,
        user_id,
        req.name,
        req.description,
        req.habit_type as HabitType,
        target as f64,
        req.frequency as HabitFrequency,
        req.frequency_days.as_deref(),
        reminder,
        req.color,
        req.icon,
        position,
    )
    .fetch_one(&state.db)
    .await?;

    enrich(state, habit).await
}

/// Partially update a habit (only supplied fields are changed).
pub async fn update_habit(
    state: &AppState,
    user_id: Uuid,
    habit_id: Uuid,
    req: UpdateHabitRequest,
) -> AppResult<HabitResponse> {
    // Fetch existing row (also asserts ownership).
    let existing = sqlx::query_as!(
        Habit,
        r#"
        SELECT
            id,
            user_id,
            name,
            description,
            habit_type      AS "habit_type: HabitType",
            target_value::DOUBLE PRECISION AS "target_value!: f64",
            frequency       AS "frequency: HabitFrequency",
            frequency_days,
            reminder_time,
            color,
            icon,
            archived,
            position,
            created_at,
            updated_at
        FROM habits
        WHERE id = $1 AND user_id = $2
        "#,
        habit_id,
        user_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // Merge incoming values with existing ones.
    let new_name = req.name.unwrap_or(existing.name);
    let new_description = req.description.unwrap_or(existing.description);
    let new_habit_type = req.habit_type.unwrap_or(existing.habit_type);
    let new_target = req.target_value.unwrap_or(existing.target_value);
    let new_frequency = req.frequency.unwrap_or(existing.frequency);
    let new_freq_days = req.frequency_days.unwrap_or(existing.frequency_days);
    let new_archived = req.archived.unwrap_or(existing.archived);
    let new_position = req.position.unwrap_or(existing.position);
    let new_color = req.color.unwrap_or(existing.color);
    let new_icon = req.icon.unwrap_or(existing.icon);

    // reminder_time: outer None = not supplied; outer Some = overwrite (possibly clear).
    let new_reminder: Option<NaiveTime> = match req.reminder_time {
        None => existing.reminder_time,
        Some(inner) => parse_time_opt(&inner)?,
    };

    if new_frequency == HabitFrequency::Custom
        && new_freq_days.as_deref().map_or(true, |v| v.is_empty())
    {
        return Err(AppError::Validation(
            "frequency_days required when frequency is 'custom'".to_owned(),
        ));
    }

    let habit = sqlx::query_as!(
        Habit,
        r#"
        UPDATE habits
        SET
            name            = $3,
            description     = $4,
            habit_type      = $5,
            target_value    = $6::NUMERIC,
            frequency       = $7,
            frequency_days  = $8,
            reminder_time   = $9,
            color           = $10,
            icon            = $11,
            archived        = $12,
            position        = $13,
            updated_at      = now()
        WHERE id = $1 AND user_id = $2
        RETURNING
            id,
            user_id,
            name,
            description,
            habit_type      AS "habit_type: HabitType",
            target_value::DOUBLE PRECISION AS "target_value!: f64",
            frequency       AS "frequency: HabitFrequency",
            frequency_days,
            reminder_time,
            color,
            icon,
            archived,
            position,
            created_at,
            updated_at
        "#,
        habit_id,
        user_id,
        new_name,
        new_description,
        new_habit_type as HabitType,
        new_target as f64,
        new_frequency as HabitFrequency,
        new_freq_days.as_deref(),
        new_reminder,
        new_color,
        new_icon,
        new_archived,
        new_position,
    )
    .fetch_one(&state.db)
    .await?;

    enrich(state, habit).await
}

/// Permanently delete a habit and all associated logs (FK cascade).
pub async fn delete_habit(state: &AppState, user_id: Uuid, habit_id: Uuid) -> AppResult<()> {
    let res = sqlx::query!(
        "DELETE FROM habits WHERE id = $1 AND user_id = $2",
        habit_id,
        user_id
    )
    .execute(&state.db)
    .await?;

    if res.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

/// Soft-delete a habit by setting `archived = true`.
pub async fn archive_habit(
    state: &AppState,
    user_id: Uuid,
    habit_id: Uuid,
) -> AppResult<HabitResponse> {
    update_habit(
        state,
        user_id,
        habit_id,
        UpdateHabitRequest {
            archived: Some(true),
            name: None,
            description: None,
            habit_type: None,
            target_value: None,
            frequency: None,
            frequency_days: None,
            reminder_time: None,
            color: None,
            icon: None,
            position: None,
        },
    )
    .await
}

// ── Habit logs ────────────────────────────────────────────────────────────────

/// List log entries for a habit in the `[from, to]` date range.
pub async fn list_logs(
    state: &AppState,
    user_id: Uuid,
    habit_id: Uuid,
    from: NaiveDate,
    to: NaiveDate,
) -> AppResult<Vec<HabitLogResponse>> {
    // Assert ownership.
    let exists = sqlx::query_scalar!(
        "SELECT 1 AS one FROM habits WHERE id = $1 AND user_id = $2",
        habit_id,
        user_id
    )
    .fetch_optional(&state.db)
    .await?;

    if exists.is_none() {
        return Err(AppError::NotFound);
    }

    let rows = sqlx::query_as!(
        HabitLog,
        r#"
        SELECT
            id,
            habit_id,
            user_id,
            log_date,
            value::DOUBLE PRECISION AS "value!: f64",
            completed,
            note,
            created_at,
            updated_at
        FROM habit_logs
        WHERE habit_id = $1
          AND user_id  = $2
          AND log_date BETWEEN $3 AND $4
        ORDER BY log_date DESC
        "#,
        habit_id,
        user_id,
        from,
        to,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows.into_iter().map(log_to_response).collect())
}

/// Upsert a log entry; emits [`DomainEvent::HabitCompleted`] when value meets
/// the habit's target.
pub async fn log_habit(
    state: &AppState,
    user_id: Uuid,
    habit_id: Uuid,
    req: LogHabitRequest,
) -> AppResult<HabitLogResponse> {
    let log_date = NaiveDate::parse_from_str(&req.log_date, "%Y-%m-%d")
        .map_err(|_| AppError::Validation("log_date must be YYYY-MM-DD".to_owned()))?;

    // Assert ownership and fetch target in one query.
    let target: f64 = sqlx::query_scalar!(
        r#"
        SELECT target_value::DOUBLE PRECISION AS "target_value!: f64"
        FROM habits
        WHERE id = $1 AND user_id = $2
        "#,
        habit_id,
        user_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let completed = req.value >= target;

    let log = sqlx::query_as!(
        HabitLog,
        r#"
        INSERT INTO habit_logs (habit_id, user_id, log_date, value, completed, note)
        VALUES ($1, $2, $3, $4::NUMERIC, $5, $6)
        ON CONFLICT (habit_id, log_date)
        DO UPDATE SET
            value      = EXCLUDED.value,
            completed  = EXCLUDED.completed,
            note       = EXCLUDED.note,
            updated_at = now()
        RETURNING
            id,
            habit_id,
            user_id,
            log_date,
            value::DOUBLE PRECISION AS "value!: f64",
            completed,
            note,
            created_at,
            updated_at
        "#,
        habit_id,
        user_id,
        log_date,
        req.value as f64,
        completed,
        req.note,
    )
    .fetch_one(&state.db)
    .await?;

    if log.completed {
        let _ = state.events.send(DomainEvent::HabitCompleted {
            habit_id,
            user_id,
            date: req.log_date,
        });
    }

    Ok(log_to_response(log))
}

/// Delete a specific log entry by ID.
pub async fn delete_log(
    state: &AppState,
    user_id: Uuid,
    habit_id: Uuid,
    log_id: Uuid,
) -> AppResult<()> {
    let res = sqlx::query!(
        "DELETE FROM habit_logs WHERE id = $1 AND habit_id = $2 AND user_id = $3",
        log_id,
        habit_id,
        user_id
    )
    .execute(&state.db)
    .await?;

    if res.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}
