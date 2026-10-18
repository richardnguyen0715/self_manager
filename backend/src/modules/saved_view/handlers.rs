//! Axum handlers for the `saved_view` module. Thin: extract → validate →
//! delegate to [`service`] → respond. All routes require auth.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;
use validator::Validate;

use crate::shared::{
    error::{AppError, AppResult},
    extractors::AuthUser,
    state::AppState,
};

use super::{
    models::{CreateSavedViewRequest, ListSavedViewsQuery, SavedView, UpdateSavedViewRequest},
    service,
};

pub async fn list_saved_views(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ListSavedViewsQuery>,
) -> AppResult<Json<Vec<SavedView>>> {
    Ok(Json(service::list(&state, auth.user_id, &query).await?))
}

pub async fn create_saved_view(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreateSavedViewRequest>,
) -> AppResult<(StatusCode, Json<SavedView>)> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let view = service::create(&state, auth.user_id, body).await?;
    Ok((StatusCode::CREATED, Json(view)))
}

pub async fn update_saved_view(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateSavedViewRequest>,
) -> AppResult<Json<SavedView>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    Ok(Json(service::update(&state, auth.user_id, id, body).await?))
}

pub async fn delete_saved_view(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::delete(&state, auth.user_id, id).await?;
    Ok(StatusCode::NO_CONTENT)
}
