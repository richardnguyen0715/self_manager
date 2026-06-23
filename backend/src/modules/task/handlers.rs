//! Task module — Axum handler functions.
//!
//! Every handler is `async fn` returning `AppResult<impl IntoResponse>`.
//! The `AuthUser` extractor enforces authentication; the body/query extractors
//! are validated before any database interaction.

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

use super::{models, service};

// ── Tasks ──────────────────────────────────────────────────────────────────────

/// `GET /api/tasks`
pub async fn list_tasks(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<models::ListTasksQuery>,
) -> AppResult<Json<Vec<models::Task>>> {
    let tasks = service::list_tasks(&state, auth.user_id, &query).await?;
    Ok(Json(tasks))
}

/// `POST /api/tasks`
pub async fn create_task(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<models::CreateTaskRequest>,
) -> AppResult<(StatusCode, Json<models::TaskResponse>)> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let resp = service::create_task(&state, auth.user_id, &body).await?;
    Ok((StatusCode::CREATED, Json(resp)))
}

/// `GET /api/tasks/:id`
pub async fn get_task(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(task_id): Path<Uuid>,
) -> AppResult<Json<models::TaskResponse>> {
    let resp = service::get_task(&state, auth.user_id, task_id).await?;
    Ok(Json(resp))
}

/// `PATCH /api/tasks/:id`
pub async fn update_task(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(task_id): Path<Uuid>,
    Json(body): Json<models::UpdateTaskRequest>,
) -> AppResult<Json<models::TaskResponse>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let resp = service::update_task(&state, auth.user_id, task_id, &body).await?;
    Ok(Json(resp))
}

/// `DELETE /api/tasks/:id` — soft-delete (moves the task to the recycle bin).
pub async fn delete_task(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(task_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::delete_task(&state, auth.user_id, task_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// `POST /api/tasks/:id/restore` — restore a soft-deleted task.
pub async fn restore_task(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(task_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::restore_task(&state, auth.user_id, task_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// `DELETE /api/tasks/:id/purge` — permanently delete a task (hard delete).
pub async fn purge_task(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(task_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::purge_task(&state, auth.user_id, task_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Subtasks ───────────────────────────────────────────────────────────────────

/// `GET /api/tasks/:id/subtasks`
pub async fn list_subtasks(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(task_id): Path<Uuid>,
) -> AppResult<Json<Vec<models::Subtask>>> {
    let items = service::list_subtasks(&state, auth.user_id, task_id).await?;
    Ok(Json(items))
}

/// `POST /api/tasks/:id/subtasks`
pub async fn create_subtask(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(task_id): Path<Uuid>,
    Json(body): Json<models::CreateSubtaskRequest>,
) -> AppResult<(StatusCode, Json<models::Subtask>)> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let subtask = service::create_subtask(&state, auth.user_id, task_id, &body).await?;
    Ok((StatusCode::CREATED, Json(subtask)))
}

/// `PATCH /api/tasks/:id/subtasks/:subtask_id`
pub async fn update_subtask(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((task_id, subtask_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<models::UpdateSubtaskRequest>,
) -> AppResult<Json<models::Subtask>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let subtask = service::update_subtask(&state, auth.user_id, task_id, subtask_id, &body).await?;
    Ok(Json(subtask))
}

/// `DELETE /api/tasks/:id/subtasks/:subtask_id`
pub async fn delete_subtask(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((task_id, subtask_id)): Path<(Uuid, Uuid)>,
) -> AppResult<StatusCode> {
    service::delete_subtask(&state, auth.user_id, task_id, subtask_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Task tags ──────────────────────────────────────────────────────────────────

/// `POST /api/tasks/:id/tags`
pub async fn attach_tag(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(task_id): Path<Uuid>,
    Json(body): Json<models::AttachTagRequest>,
) -> AppResult<StatusCode> {
    service::attach_tag(&state, auth.user_id, task_id, &body).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// `DELETE /api/tasks/:id/tags/:tag_id`
pub async fn detach_tag(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((task_id, tag_id)): Path<(Uuid, Uuid)>,
) -> AppResult<StatusCode> {
    service::detach_tag(&state, auth.user_id, task_id, tag_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Tags ───────────────────────────────────────────────────────────────────────

/// `GET /api/tags`
pub async fn list_tags(
    auth: AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<Vec<models::Tag>>> {
    let tags = service::list_tags(&state, auth.user_id).await?;
    Ok(Json(tags))
}

/// `POST /api/tags`
pub async fn create_tag(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<models::CreateTagRequest>,
) -> AppResult<(StatusCode, Json<models::Tag>)> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let tag = service::create_tag(&state, auth.user_id, &body).await?;
    Ok((StatusCode::CREATED, Json(tag)))
}

/// `PATCH /api/tags/:id`
pub async fn update_tag(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(tag_id): Path<Uuid>,
    Json(body): Json<models::UpdateTagRequest>,
) -> AppResult<Json<models::Tag>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let tag = service::update_tag(&state, auth.user_id, tag_id, &body).await?;
    Ok(Json(tag))
}

/// `DELETE /api/tags/:id`
pub async fn delete_tag(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(tag_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::delete_tag(&state, auth.user_id, tag_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
