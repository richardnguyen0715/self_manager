//! Axum handlers for the `custom_property` module. Thin: extract → delegate to
//! [`service`] → respond. All routes require auth.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;

use crate::shared::{error::AppResult, extractors::AuthUser, state::AppState};

use super::{
    models::{
        CreatePropertyRequest, CustomProperty, ProjectPropertyValue, ProjectQuery,
        PropertyValueResponse, SetPropertyValueRequest, UpdatePropertyRequest,
        WorkItemPropertyValue,
    },
    service,
};

pub async fn list_properties(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ProjectQuery>,
) -> AppResult<Json<Vec<CustomProperty>>> {
    Ok(Json(
        service::list_properties(&state, auth.user_id, query.project_id).await?,
    ))
}

pub async fn create_property(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreatePropertyRequest>,
) -> AppResult<(StatusCode, Json<CustomProperty>)> {
    let property = service::create_property(&state, auth.user_id, body).await?;
    Ok((StatusCode::CREATED, Json(property)))
}

pub async fn update_property(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePropertyRequest>,
) -> AppResult<Json<CustomProperty>> {
    Ok(Json(
        service::update_property(&state, auth.user_id, id, body).await?,
    ))
}

pub async fn delete_property(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::delete_property(&state, auth.user_id, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_project_values(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ProjectQuery>,
) -> AppResult<Json<Vec<ProjectPropertyValue>>> {
    Ok(Json(
        service::list_project_values(&state, auth.user_id, query.project_id).await?,
    ))
}

pub async fn list_work_item_values(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(work_item_id): Path<Uuid>,
) -> AppResult<Json<Vec<WorkItemPropertyValue>>> {
    Ok(Json(
        service::list_work_item_values(&state, auth.user_id, work_item_id).await?,
    ))
}

pub async fn set_value(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((work_item_id, property_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<SetPropertyValueRequest>,
) -> AppResult<Json<PropertyValueResponse>> {
    Ok(Json(
        service::set_value(&state, auth.user_id, work_item_id, property_id, body.value).await?,
    ))
}
