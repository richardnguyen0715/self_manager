//! Analytics HTTP handlers.
//!
//! All routes require a valid JWT access token — [`AuthUser`] is extracted from
//! the `Authorization: Bearer` header automatically by Axum.
//!
//! Every handler follows the pattern:
//! 1. Extract `auth.user_id` and validated query parameters.
//! 2. Parse date strings into [`chrono::NaiveDate`].
//! 3. Delegate business logic to the [`service`] layer.
//! 4. Return `Json(response)` or propagate [`AppError`].

use axum::{
    extract::{Query, State},
    Json,
};
use chrono::NaiveDate;

use crate::shared::{
    error::{AppError, AppResult},
    extractors::AuthUser,
    state::AppState,
};

use super::{
    models::{PeriodQuery, TimeUsageQuery},
    service,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

fn parse_date(s: &str) -> AppResult<NaiveDate> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .map_err(|_| AppError::Validation(format!("invalid date '{s}'; expected YYYY-MM-DD")))
}

fn validate_range(start: NaiveDate, end: NaiveDate) -> AppResult<()> {
    if start > end {
        return Err(AppError::Validation(
            "start date must not be after end date".to_owned(),
        ));
    }
    // Prevent excessively large windows (max 2 years) to protect DB performance.
    let span = (end - start).num_days();
    if span > 730 {
        return Err(AppError::Validation(
            "date range exceeds maximum of 730 days".to_owned(),
        ));
    }
    Ok(())
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/// `GET /api/analytics/summary?start=YYYY-MM-DD&end=YYYY-MM-DD`
///
/// Returns aggregated totals and averages for the specified period.
pub async fn get_summary(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<PeriodQuery>,
) -> AppResult<Json<super::models::PeriodSummaryResponse>> {
    let start = parse_date(&params.start)?;
    let end = parse_date(&params.end)?;
    validate_range(start, end)?;

    let summary = service::get_period_summary(&state.db, auth.user_id, start, end).await?;
    Ok(Json(summary))
}

/// `GET /api/analytics/daily?start=YYYY-MM-DD&end=YYYY-MM-DD`
///
/// Returns a time-series of daily stats rows within the window.
pub async fn get_daily_series(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<PeriodQuery>,
) -> AppResult<Json<Vec<super::models::DailyStatPoint>>> {
    let start = parse_date(&params.start)?;
    let end = parse_date(&params.end)?;
    validate_range(start, end)?;

    let series = service::get_daily_series(&state.db, auth.user_id, start, end).await?;
    Ok(Json(series))
}

/// `GET /api/analytics/time-usage?start=YYYY-MM-DD&end=YYYY-MM-DD`
///
/// Returns total focus minutes and a per-day breakdown derived from
/// `focus_sessions` (live data, not the materialized `daily_stats` cache).
pub async fn get_time_usage(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<TimeUsageQuery>,
) -> AppResult<Json<super::models::TimeUsageResponse>> {
    let start = parse_date(&params.start)?;
    let end = parse_date(&params.end)?;
    validate_range(start, end)?;

    let usage = service::get_time_usage(&state.db, auth.user_id, start, end).await?;
    Ok(Json(usage))
}

/// `GET /api/analytics/completion-rate?start=YYYY-MM-DD&end=YYYY-MM-DD`
///
/// Returns per-day task completion rates plus an overall rate for the window.
pub async fn get_completion_rate(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<PeriodQuery>,
) -> AppResult<Json<super::models::CompletionRateResponse>> {
    let start = parse_date(&params.start)?;
    let end = parse_date(&params.end)?;
    validate_range(start, end)?;

    let rate = service::get_completion_rate(&state.db, auth.user_id, start, end).await?;
    Ok(Json(rate))
}

/// `POST /api/analytics/refresh`
///
/// Triggers an on-demand recompute of `daily_stats` for today (UTC).
/// Idempotent — safe to call multiple times.
pub async fn refresh_today(
    auth: AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<super::models::RefreshStatsResponse>> {
    let result = service::refresh_today(&state.db, auth.user_id).await?;
    Ok(Json(result))
}

/// `POST /api/analytics/refresh/:date`
///
/// Triggers an on-demand recompute for the given date.
/// The date path segment is extracted by the routes layer and passed in.
pub async fn refresh_date(
    auth: AuthUser,
    State(state): State<AppState>,
    axum::extract::Path(date_str): axum::extract::Path<String>,
) -> AppResult<Json<super::models::RefreshStatsResponse>> {
    let target = parse_date(&date_str)?;
    let result = service::refresh_date(&state.db, auth.user_id, target).await?;
    Ok(Json(result))
}
