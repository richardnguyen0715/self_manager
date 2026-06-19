//! Axum request handlers for the `doc_search` module.
//!
//! All routes require `Authorization: Bearer <access-token>`.
//!
//! # Endpoints
//!
//! | Method | Path      | Description                                  |
//! |--------|-----------|----------------------------------------------|
//! | GET    | `/search` | Unified page + database search for the user. |

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
    models::{DocSearchQuery, DocSearchResponse},
    service,
};

// ── GET /api/docs/search?q=&space_id? ─────────────────────────────────────────

/// Search pages and databases owned by the authenticated user.
///
/// Matches on page `title` (pg_trgm similarity) or `content` jsonb text
/// (ILIKE) and on database `title` or row `values` jsonb text (ILIKE).
///
/// `q` is required. `space_id` optionally scopes the search to a single space.
///
/// Returns `{ pages: PageSearchHit[], databases: DatabaseSearchHit[] }`.
pub async fn search_docs(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<DocSearchQuery>,
) -> AppResult<Json<DocSearchResponse>> {
    let result =
        service::search_docs(&state, auth.user_id, &query.q, query.space_id).await?;
    Ok(Json(result))
}
