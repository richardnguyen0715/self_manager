//! Axum request handlers for the `search` module.
//!
//! Every handler in this file:
//! - Requires a valid JWT access token via [`AuthUser`].
//! - Validates query parameters before touching the database.
//! - Returns `Result<Json<_>, AppError>` — serialisation and error formatting
//!   are handled by the shared [`AppError`] `IntoResponse` impl.

use axum::{
    extract::{Query, State},
    Json,
};
use tracing::instrument;
use validator::Validate as _;

use crate::shared::{
    error::{AppError, AppResult},
    extractors::AuthUser,
    state::AppState,
};

use super::{models::SearchQuery, service};

/// `GET /api/search`
///
/// Performs a cross-entity search across tasks, projects, and habits that
/// belong to the authenticated user.
///
/// ### Query parameters
///
/// | Parameter | Type   | Default            | Description                                        |
/// |-----------|--------|--------------------|----------------------------------------------------|
/// | `q`       | string | required           | Search term (1–200 chars)                          |
/// | `kinds`   | string | `task,project,habit` | Comma-separated entity kinds to include          |
/// | `limit`   | int    | `20`               | Max results per kind (1–50)                        |
///
/// ### Response `200 OK`
///
/// ```json
/// {
///   "query": "meeting",
///   "total": 3,
///   "tasks": [ { "id": "...", "title": "Meeting notes", ... } ],
///   "projects": [],
///   "habits": []
/// }
/// ```
///
/// ### Errors
///
/// - `401 UNAUTHORIZED` — missing or invalid bearer token.
/// - `422 VALIDATION_ERROR` — `q` is empty or exceeds 200 characters.
/// - `500 INTERNAL_SERVER_ERROR` — database failure.
#[instrument(skip(state), fields(user_id = %auth.user_id))]
pub async fn search(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<SearchQuery>,
) -> AppResult<Json<super::models::SearchResponse>> {
    // Validate before touching the database.
    params
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let q = params.q.trim().to_owned();
    if q.is_empty() {
        return Err(AppError::Validation(
            "q must not be empty after trimming".to_owned(),
        ));
    }

    let kinds = params.parsed_kinds();
    let limit = params.effective_limit();

    let response = service::search(&state.db, auth.user_id, &q, &kinds, limit).await?;

    Ok(Json(response))
}
