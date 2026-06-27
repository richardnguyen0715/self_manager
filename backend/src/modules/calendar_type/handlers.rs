//! Axum handlers for the `calendar_type` module. Thin: extract → validate →
//! delegate to [`service`] → respond. All routes require auth.

use axum::{
    extract::{Path, State},
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
    models::{CalendarType, CreateCalendarTypeRequest, UpdateCalendarTypeRequest},
    service,
};

pub async fn list_types(
    auth: AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<Vec<CalendarType>>> {
    Ok(Json(service::list(&state, auth.user_id).await?))
}

pub async fn create_type(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreateCalendarTypeRequest>,
) -> AppResult<(StatusCode, Json<CalendarType>)> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let t = service::create(&state, auth.user_id, body).await?;
    Ok((StatusCode::CREATED, Json(t)))
}

pub async fn get_type(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<CalendarType>> {
    Ok(Json(service::get(&state, auth.user_id, id).await?))
}

pub async fn update_type(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCalendarTypeRequest>,
) -> AppResult<Json<CalendarType>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    Ok(Json(service::update(&state, auth.user_id, id, body).await?))
}

pub async fn delete_type(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::delete(&state, auth.user_id, id).await?;
    Ok(StatusCode::NO_CONTENT)
}
