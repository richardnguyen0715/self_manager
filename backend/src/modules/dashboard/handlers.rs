//! Dashboard HTTP handlers.
//!
//! All routes require a valid JWT access token extracted by [`AuthUser`].
//!
//! Handler pattern:
//! 1. Extract `auth.user_id` from the bearer token.
//! 2. Parse the optional `date` query string into a [`chrono::NaiveDate`].
//! 3. Delegate to the service layer.
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
    models::{DashboardDateQuery, DashboardResponse, QuickStats, SprintDashboardResponse},
    service,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Parse an optional `YYYY-MM-DD` date string into a [`NaiveDate`].
fn parse_optional_date(s: Option<&str>) -> AppResult<Option<NaiveDate>> {
    match s {
        None => Ok(None),
        Some(raw) => NaiveDate::parse_from_str(raw, "%Y-%m-%d")
            .map(Some)
            .map_err(|_| {
                AppError::Validation(format!("invalid date '{raw}'; expected YYYY-MM-DD"))
            }),
    }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/// `GET /api/dashboard`
///
/// Returns the full aggregated today view: tasks, habits, calendar events,
/// time blocks, and quick stats.
///
/// # Query parameters
/// - `date` (optional, `YYYY-MM-DD`): target date; defaults to today (UTC).
pub async fn get_dashboard(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<DashboardDateQuery>,
) -> AppResult<Json<DashboardResponse>> {
    let date = parse_optional_date(params.date.as_deref())?;
    let snapshot = service::get_dashboard(&state, auth.user_id, date).await?;
    Ok(Json(snapshot))
}

/// `GET /api/dashboard/stats`
///
/// Returns only the quick-stats section.  Cheaper to call when the client
/// needs to refresh counters without re-fetching all list data.
///
/// # Query parameters
/// - `date` (optional, `YYYY-MM-DD`): target date; defaults to today (UTC).
pub async fn get_stats(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<DashboardDateQuery>,
) -> AppResult<Json<QuickStats>> {
    let date = parse_optional_date(params.date.as_deref())?;
    let stats = service::get_quick_stats(&state, auth.user_id, date).await?;
    Ok(Json(stats))
}

// ── GET /api/dashboard/sprint ─────────────────────────────────────────────────

/// `GET /api/dashboard/sprint`
///
/// Returns the sprint-centric dashboard:
/// - Active sprint (if any) with capacity / progress info.
/// - `sprint_progress_pct` — percentage of sprint work items completed.
/// - `goal_progress` — per-goal completion rates computed from the
///   goals → initiatives → epics → work items hierarchy.
/// - `today_time_blocks` — time blocks starting today, enriched with both
///   legacy `task_id` and new `work_item_id`.
/// - `overdue_work_items` — up to 50 work items past their due date and
///   not yet done, ordered by oldest first.
/// - `habits` — active habits with today's completion status and streak.
///
/// # Query parameters
/// - `date` (optional, `YYYY-MM-DD`): target date; defaults to today (UTC).
pub async fn get_sprint_dashboard(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<DashboardDateQuery>,
) -> AppResult<Json<SprintDashboardResponse>> {
    let date = parse_optional_date(params.date.as_deref())?;
    let snapshot = service::get_sprint_dashboard(&state, auth.user_id, date).await?;
    Ok(Json(snapshot))
}
