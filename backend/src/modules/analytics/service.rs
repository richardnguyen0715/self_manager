//! Analytics service — all database interactions for the analytics module.
//!
//! # Design choices
//! - All queries use `sqlx::query!` / `sqlx::query_as!` for compile-time SQL
//!   checking.
//! - [`record_event`] is called by the background task that consumes
//!   [`DomainEvent`]s from the broadcast channel; it is not exposed via HTTP.
//! - Aggregation for daily/weekly/monthly stats reads from `daily_stats` when
//!   data is already materialised, and falls back to computing directly from
//!   `focus_sessions` / `tasks` / `habit_logs` when necessary.

use chrono::{NaiveDate, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::shared::error::AppResult;

use super::models::{
    CompletionRateResponse, DailyCompletionPoint, DailyStat, DailyStatPoint, DayFocusPoint,
    PeriodSummaryResponse, RefreshStatsResponse, TimeUsageResponse,
};

// ── Event ingestion ───────────────────────────────────────────────────────────

/// Append a raw analytics event row to `analytics_events`.
///
/// Called by the background listener task — never panics; errors are logged.
pub async fn record_event(
    db: &PgPool,
    user_id: Uuid,
    event_type: &str,
    entity_id: Option<Uuid>,
    metadata: Option<serde_json::Value>,
) -> AppResult<()> {
    sqlx::query!(
        r#"
        INSERT INTO analytics_events (user_id, event_type, entity_id, metadata)
        VALUES ($1, $2, $3, $4)
        "#,
        user_id,
        event_type,
        entity_id,
        metadata,
    )
    .execute(db)
    .await?;

    Ok(())
}

// ── Daily stats upsert ────────────────────────────────────────────────────────

/// Compute and upsert the `daily_stats` row for `(user_id, target_date)`.
///
/// This function is idempotent — calling it multiple times for the same date
/// is safe because it uses `ON CONFLICT DO UPDATE`.
///
/// The computation joins across:
/// - `tasks`          — counts completed and created tasks on that date.
/// - `focus_sessions` — sums duration_seconds → focus_minutes.
/// - `habit_logs`     — computes completion rate (completed / total scheduled).
/// - `focus_sessions` — counts pomodoro sessions (mode = 'pomodoro_25_5').
pub async fn upsert_daily_stats(
    db: &PgPool,
    user_id: Uuid,
    target_date: NaiveDate,
) -> AppResult<DailyStat> {
    // Tasks completed on target_date
    let tasks_completed: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) AS "count!"
        FROM   tasks
        WHERE  user_id     = $1
          AND  status      = 'completed'
          AND  completed_at::date = $2
        "#,
        user_id,
        target_date,
    )
    .fetch_one(db)
    .await?;

    // Tasks created on target_date
    let tasks_created: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) AS "count!"
        FROM   tasks
        WHERE  user_id    = $1
          AND  created_at::date = $2
        "#,
        user_id,
        target_date,
    )
    .fetch_one(db)
    .await?;

    // Total focus minutes from ended sessions on target_date
    let focus_seconds: Option<i64> = sqlx::query_scalar!(
        r#"
        SELECT COALESCE(SUM(duration_seconds), 0) AS "secs"
        FROM   focus_sessions
        WHERE  user_id   = $1
          AND  started_at::date = $2
          AND  ended_at  IS NOT NULL
        "#,
        user_id,
        target_date,
    )
    .fetch_one(db)
    .await?;
    let focus_minutes = (focus_seconds.unwrap_or(0) / 60) as i32;

    // Pomodoro sessions count
    let pomodoro_sessions: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) AS "count!"
        FROM   focus_sessions
        WHERE  user_id   = $1
          AND  started_at::date = $2
          AND  ended_at  IS NOT NULL
          AND  mode      = 'pomodoro_25_5'
        "#,
        user_id,
        target_date,
    )
    .fetch_one(db)
    .await?;

    // Habit completion rate: completed logs / total habit logs logged for that date
    let habit_rate: Option<f64> = sqlx::query_scalar!(
        r#"
        SELECT (CASE WHEN COUNT(*) = 0 THEN 0.0
                     ELSE SUM(CASE WHEN completed THEN 1.0 ELSE 0.0 END) / COUNT(*)
                END)::float8 AS "rate"
        FROM   habit_logs
        WHERE  user_id  = $1
          AND  log_date = $2
        "#,
        user_id,
        target_date,
    )
    .fetch_one(db)
    .await?;

    // numeric(5,4) column — pass as f64; Postgres accepts a float8 literal
    // for a numeric column without precision loss at this scale.
    let habit_completion_rate: f64 = habit_rate.unwrap_or(0.0).clamp(0.0, 1.0);

    // Upsert into daily_stats.
    // Cast habit_completion_rate back to float8 in RETURNING so SQLx maps it
    // to f64 on our DailyStat struct (avoids needing the bigdecimal feature).
    let row = sqlx::query_as!(
        DailyStat,
        r#"
        INSERT INTO daily_stats
            (user_id, stat_date, tasks_completed, tasks_created,
             focus_minutes, habit_completion_rate, pomodoro_sessions)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, stat_date) DO UPDATE
            SET tasks_completed       = EXCLUDED.tasks_completed,
                tasks_created         = EXCLUDED.tasks_created,
                focus_minutes         = EXCLUDED.focus_minutes,
                habit_completion_rate = EXCLUDED.habit_completion_rate,
                pomodoro_sessions     = EXCLUDED.pomodoro_sessions,
                updated_at            = now()
        RETURNING
            id,
            user_id,
            stat_date,
            tasks_completed,
            tasks_created,
            focus_minutes,
            habit_completion_rate::float8 AS "habit_completion_rate!: f64",
            pomodoro_sessions,
            created_at,
            updated_at
        "#,
        user_id,
        target_date,
        tasks_completed as i32,
        tasks_created as i32,
        focus_minutes,
        habit_completion_rate as f64,
        pomodoro_sessions as i32,
    )
    .fetch_one(db)
    .await?;

    Ok(row)
}

// ── Period summary ────────────────────────────────────────────────────────────

/// Aggregate `daily_stats` rows between `start` and `end` (inclusive) into a
/// single [`PeriodSummaryResponse`].
pub async fn get_period_summary(
    db: &PgPool,
    user_id: Uuid,
    start: NaiveDate,
    end: NaiveDate,
) -> AppResult<PeriodSummaryResponse> {
    let row = sqlx::query!(
        r#"
        SELECT
            COALESCE(SUM(tasks_completed), 0)              AS "tasks_completed!: i64",
            COALESCE(SUM(tasks_created),   0)              AS "tasks_created!: i64",
            COALESCE(SUM(focus_minutes),   0)              AS "focus_minutes!: i64",
            COALESCE(SUM(pomodoro_sessions), 0)            AS "pomodoro_sessions!: i64",
            COALESCE(AVG(habit_completion_rate)::float8, 0) AS "avg_habit_rate!: f64",
            COUNT(*)                                        AS "day_count!: i64"
        FROM   daily_stats
        WHERE  user_id   = $1
          AND  stat_date BETWEEN $2 AND $3
        "#,
        user_id,
        start,
        end,
    )
    .fetch_one(db)
    .await?;

    let day_count = row.day_count.max(1);
    let avg_tasks = row.tasks_completed as f64 / day_count as f64;

    Ok(PeriodSummaryResponse {
        start,
        end,
        tasks_completed: row.tasks_completed,
        tasks_created: row.tasks_created,
        focus_minutes: row.focus_minutes,
        pomodoro_sessions: row.pomodoro_sessions,
        avg_habit_completion_rate: row.avg_habit_rate,
        avg_tasks_completed_per_day: avg_tasks,
    })
}

// ── Daily time-series ─────────────────────────────────────────────────────────

/// Return all `daily_stats` rows within [start, end] as a time-series list.
pub async fn get_daily_series(
    db: &PgPool,
    user_id: Uuid,
    start: NaiveDate,
    end: NaiveDate,
) -> AppResult<Vec<DailyStatPoint>> {
    let rows = sqlx::query!(
        r#"
        SELECT
            stat_date,
            tasks_completed,
            tasks_created,
            focus_minutes,
            habit_completion_rate::float8 AS "habit_completion_rate!: f64",
            pomodoro_sessions
        FROM   daily_stats
        WHERE  user_id   = $1
          AND  stat_date BETWEEN $2 AND $3
        ORDER BY stat_date ASC
        "#,
        user_id,
        start,
        end,
    )
    .fetch_all(db)
    .await?;

    let series = rows
        .into_iter()
        .map(|r| DailyStatPoint {
            stat_date: r.stat_date,
            tasks_completed: r.tasks_completed,
            tasks_created: r.tasks_created,
            focus_minutes: r.focus_minutes,
            habit_completion_rate: r.habit_completion_rate,
            pomodoro_sessions: r.pomodoro_sessions,
        })
        .collect();

    Ok(series)
}

// ── Time usage breakdown ──────────────────────────────────────────────────────

/// Compute per-day focus minutes directly from `focus_sessions`.
///
/// Uses `focus_sessions` rather than `daily_stats` so that the endpoint
/// reflects live data even when daily stats haven't been refreshed yet.
pub async fn get_time_usage(
    db: &PgPool,
    user_id: Uuid,
    start: NaiveDate,
    end: NaiveDate,
) -> AppResult<TimeUsageResponse> {
    let rows = sqlx::query!(
        r#"
        SELECT
            started_at::date           AS "date!: NaiveDate",
            COALESCE(SUM(duration_seconds) / 60, 0) AS "focus_minutes!: i64"
        FROM   focus_sessions
        WHERE  user_id   = $1
          AND  started_at::date BETWEEN $2 AND $3
          AND  ended_at  IS NOT NULL
        GROUP BY started_at::date
        ORDER BY started_at::date ASC
        "#,
        user_id,
        start,
        end,
    )
    .fetch_all(db)
    .await?;

    let total: i64 = rows.iter().map(|r| r.focus_minutes).sum();

    let days = rows
        .into_iter()
        .map(|r| DayFocusPoint {
            date: r.date,
            focus_minutes: r.focus_minutes,
        })
        .collect();

    Ok(TimeUsageResponse {
        start,
        end,
        total_focus_minutes: total,
        days,
    })
}

// ── Completion rate ───────────────────────────────────────────────────────────

/// Compute task completion rate per day within [start, end].
///
/// `completion_rate` = tasks_completed / tasks_created for that day,
/// clamped to [0.0, 1.0].  Days with no tasks created show 0.0.
pub async fn get_completion_rate(
    db: &PgPool,
    user_id: Uuid,
    start: NaiveDate,
    end: NaiveDate,
) -> AppResult<CompletionRateResponse> {
    let rows = sqlx::query!(
        r#"
        SELECT
            stat_date,
            tasks_completed,
            tasks_created,
            CASE WHEN tasks_created = 0 THEN 0.0
                 ELSE LEAST(tasks_completed::float8 / tasks_created::float8, 1.0)
            END AS "completion_rate!: f64"
        FROM   daily_stats
        WHERE  user_id   = $1
          AND  stat_date BETWEEN $2 AND $3
        ORDER BY stat_date ASC
        "#,
        user_id,
        start,
        end,
    )
    .fetch_all(db)
    .await?;

    let total_completed: i64 = rows.iter().map(|r| i64::from(r.tasks_completed)).sum();
    let total_created: i64 = rows.iter().map(|r| i64::from(r.tasks_created)).sum();
    let days_with_completions = rows.iter().filter(|r| r.tasks_completed > 0).count() as f64;
    let total_days = rows.len().max(1) as f64;

    let overall_rate = if total_created == 0 {
        0.0
    } else {
        (total_completed as f64 / total_created as f64).min(1.0)
    };

    let daily = rows
        .into_iter()
        .map(|r| DailyCompletionPoint {
            stat_date: r.stat_date,
            tasks_completed: r.tasks_completed,
            tasks_created: r.tasks_created,
            completion_rate: r.completion_rate,
        })
        .collect();

    Ok(CompletionRateResponse {
        start,
        end,
        overall_task_completion_rate: overall_rate,
        active_days_rate: days_with_completions / total_days,
        daily,
    })
}

// ── On-demand refresh ─────────────────────────────────────────────────────────

/// Trigger an on-demand recompute of `daily_stats` for today (UTC).
///
/// Returns the freshly upserted row.
pub async fn refresh_today(db: &PgPool, user_id: Uuid) -> AppResult<RefreshStatsResponse> {
    let today = Utc::now().date_naive();
    let stats = upsert_daily_stats(db, user_id, today).await?;
    Ok(RefreshStatsResponse {
        refreshed_date: today,
        stats,
    })
}

/// Trigger an on-demand recompute for a specific date supplied by the caller.
pub async fn refresh_date(
    db: &PgPool,
    user_id: Uuid,
    target_date: NaiveDate,
) -> AppResult<RefreshStatsResponse> {
    let stats = upsert_daily_stats(db, user_id, target_date).await?;
    Ok(RefreshStatsResponse {
        refreshed_date: target_date,
        stats,
    })
}
