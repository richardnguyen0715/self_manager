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
    models::{DashboardDateQuery, DashboardResponse, QuickStats},
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
