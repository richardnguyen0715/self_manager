//! Axum request handlers for the `backlog` module.
//!
//! All routes require a valid `Authorization: Bearer <access-token>` header;
//! the [`AuthUser`] extractor validates the JWT and surfaces the caller's
//! `user_id`.
//!
//! Handlers are intentionally thin: they extract inputs, optionally validate,
//! and delegate entirely to [`service`].

use axum::{
    extract::{Query, State},
    Json,
};

use crate::shared::{
    error::AppResult,
    extractors::AuthUser,
    state::AppState,
};

use super::{
    models::{BacklogListResponse, ListBacklogQuery},
    service,
};

// ── GET /api/backlog ───────────────────────────────────────────────────────────

/// List all backlog items (work items with `sprint_id IS NULL`) for the
/// authenticated user.
///
/// # Query parameters
///
/// | param      | type   | required | description                            |
/// |------------|--------|----------|----------------------------------------|
/// | `epic_id`  | UUID   | no       | Filter by epic                         |
/// | `limit`    | i64    | no       | Page size (default 50, max 200)        |
/// | `offset`   | i64    | no       | Zero-based row offset (default 0)      |
///
/// # Response
///
/// `200 OK` — `{ "data": WorkItemListItem[], "total": number }`
///
/// # Example
///
/// ```http
/// GET /api/backlog?limit=20&offset=0
/// Authorization: Bearer <token>
/// ```
pub async fn list_backlog(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ListBacklogQuery>,
) -> AppResult<Json<BacklogListResponse>> {
    let list = service::list_backlog(&state, auth.user_id, &query).await?;
    Ok(Json(list))
}
