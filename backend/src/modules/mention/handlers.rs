//! Axum handlers for the `mention` module. Thin: extract → delegate to
//! [`service`] → respond. All routes require auth.

use axum::{
    extract::{Query, State},
    Json,
};

use crate::shared::{error::AppResult, extractors::AuthUser, state::AppState};

use super::{
    models::{
        Backlink, BacklinksQuery, ResolveQuery, ResolvedRef, SearchHit, SearchQuery, SyncRequest,
        SyncResult,
    },
    service,
};

pub async fn search(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> AppResult<Json<Vec<SearchHit>>> {
    Ok(Json(service::search(&state, auth.user_id, query).await?))
}

pub async fn resolve(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ResolveQuery>,
) -> AppResult<Json<Vec<ResolvedRef>>> {
    Ok(Json(service::resolve(&state, auth.user_id, query).await?))
}

pub async fn sync(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<SyncRequest>,
) -> AppResult<Json<SyncResult>> {
    Ok(Json(service::sync(&state, auth.user_id, body).await?))
}

pub async fn backlinks(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<BacklinksQuery>,
) -> AppResult<Json<Vec<Backlink>>> {
    Ok(Json(service::backlinks(&state, auth.user_id, query).await?))
}
