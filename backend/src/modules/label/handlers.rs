//! Axum handlers for the `label` module. Thin: extract → delegate to
//! [`service`] → respond. All routes require auth.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;

use crate::shared::{
    error::AppResult,
    extractors::AuthUser,
    state::AppState,
};

use super::{
    models::{CreateLabelRequest, Label, ListLabelsQuery, UpdateLabelRequest},
    service,
};

pub async fn list_labels(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ListLabelsQuery>,
) -> AppResult<Json<Vec<Label>>> {
    Ok(Json(
        service::list(&state, auth.user_id, query.project_id).await?,
    ))
}

pub async fn create_label(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreateLabelRequest>,
) -> AppResult<(StatusCode, Json<Label>)> {
    let label = service::create(&state, auth.user_id, body).await?;
    Ok((StatusCode::CREATED, Json(label)))
}

pub async fn update_label(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateLabelRequest>,
) -> AppResult<Json<Label>> {
    Ok(Json(service::update(&state, auth.user_id, id, body).await?))
}

pub async fn delete_label(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::delete(&state, auth.user_id, id).await?;
    Ok(StatusCode::NO_CONTENT)
}
