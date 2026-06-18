//! Axum request handlers for the `work_item` module.
//!
//! All routes require a valid `Authorization: Bearer <access-token>` header;
//! the [`AuthUser`] extractor enforces this at the framework level.
//!
//! Handlers are thin: extract → validate → delegate to [`service`] → respond.

use axum::{
    extract::{Multipart, Path, Query, State},
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
    models::{
        Attachment, CreateLinkRequest, CreateSubtaskRequest, CreateWebLinkRequest,
        CreateWorkItemRequest, ListWorkItemsQuery, MoveToBacklogRequest, MoveToSprintRequest,
        SetColumnRequest, SetPointsRequest, SetStatusRequest, UpdateSubtaskRequest,
        UpdateWorkItemRequest, WebLink, WorkItemLink, WorkItemListResponse, WorkItemResponse,
        WorkItemSubtask,
    },
    service,
};

/// Absolute path to the uploads directory.
///
/// Resolved relative to the backend workspace root at compile-time.
const UPLOADS_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/uploads");

// ── GET /api/work-items ────────────────────────────────────────────────────────

/// List work items for the authenticated user.
///
/// Supports optional query params:
/// - `sprint_id` — filter by sprint (absent = all including backlog)
/// - `epic_id`   — filter by epic
/// - `status`    — filter by status string
/// - `type`      — filter by work item type
/// - `priority`  — filter by priority
/// - `limit`     — page size (default 50, max 200)
/// - `offset`    — zero-based offset (default 0)
pub async fn list_work_items(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ListWorkItemsQuery>,
) -> AppResult<Json<WorkItemListResponse>> {
    let list = service::list_work_items(&state, auth.user_id, &query).await?;
    Ok(Json(list))
}

// ── POST /api/work-items ───────────────────────────────────────────────────────

/// Create a new work item for the authenticated user.
///
/// Returns `201 Created` with the full work item (subtasks will be empty).
pub async fn create_work_item(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreateWorkItemRequest>,
) -> AppResult<(StatusCode, Json<WorkItemResponse>)> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let item = service::create_work_item(&state, auth.user_id, body).await?;
    Ok((StatusCode::CREATED, Json(item)))
}

// ── GET /api/work-items/:id ────────────────────────────────────────────────────

/// Fetch a single work item with its subtasks.
///
/// Returns `404 Not Found` when the item does not exist or belongs to a
/// different user.
pub async fn get_work_item(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(item_id): Path<Uuid>,
) -> AppResult<Json<WorkItemResponse>> {
    let item = service::get_work_item(&state, auth.user_id, item_id).await?;
    Ok(Json(item))
}

// ── PATCH /api/work-items/:id ──────────────────────────────────────────────────

/// Partially update a work item.
///
/// Only fields present in the JSON body are modified.
pub async fn update_work_item(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(item_id): Path<Uuid>,
    Json(body): Json<UpdateWorkItemRequest>,
) -> AppResult<Json<WorkItemResponse>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let item = service::update_work_item(&state, auth.user_id, item_id, body).await?;
    Ok(Json(item))
}

// ── DELETE /api/work-items/:id ─────────────────────────────────────────────────

/// Delete a work item by its UUID.
///
/// Returns `204 No Content` on success. Subtasks are cascade-deleted.
pub async fn delete_work_item(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(item_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::delete_work_item(&state, auth.user_id, item_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── PATCH /api/work-items/:id/status ──────────────────────────────────────────

/// Set the status of a work item.
///
/// Automatically manages `completed_at` on `done` transitions.
pub async fn set_status(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(item_id): Path<Uuid>,
    Json(body): Json<SetStatusRequest>,
) -> AppResult<Json<WorkItemResponse>> {
    let item = service::set_status(&state, auth.user_id, item_id, body).await?;
    Ok(Json(item))
}

// ── PATCH /api/work-items/:id/points ──────────────────────────────────────────

/// Set story points on a work item (1, 3, 5, 8, or null).
///
/// Returns `422 Unprocessable Entity` for out-of-range values.
pub async fn set_points(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(item_id): Path<Uuid>,
    Json(body): Json<SetPointsRequest>,
) -> AppResult<Json<WorkItemResponse>> {
    let item = service::set_points(&state, auth.user_id, item_id, body).await?;
    Ok(Json(item))
}

// ── PATCH /api/work-items/:id/sprint ──────────────────────────────────────────

/// Move a work item into a sprint.
///
/// Returns `409 Conflict` if the sprint's capacity would be exceeded.
pub async fn move_to_sprint(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(item_id): Path<Uuid>,
    Json(body): Json<MoveToSprintRequest>,
) -> AppResult<Json<WorkItemResponse>> {
    let item = service::move_to_sprint(&state, auth.user_id, item_id, body).await?;
    Ok(Json(item))
}

// ── PATCH /api/work-items/:id/column ──────────────────────────────────────────

/// Assign a work item to a board column (or clear the assignment with `null`).
///
/// When the target column has a non-null `mapped_status` the item's `status`
/// field is also updated so enum-based views stay consistent.
///
/// Returns the full work item with subtasks.
pub async fn set_column(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(item_id): Path<Uuid>,
    Json(body): Json<SetColumnRequest>,
) -> AppResult<Json<WorkItemResponse>> {
    let item = service::set_column(&state, auth.user_id, item_id, body).await?;
    Ok(Json(item))
}

// ── PATCH /api/work-items/:id/backlog ─────────────────────────────────────────

/// Move a work item to the backlog (clears `sprint_id`).
pub async fn move_to_backlog(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(item_id): Path<Uuid>,
    Json(body): Json<MoveToBacklogRequest>,
) -> AppResult<Json<WorkItemResponse>> {
    let item = service::move_to_backlog(&state, auth.user_id, item_id, body).await?;
    Ok(Json(item))
}

// ── GET /api/work-items/:id/subtasks ──────────────────────────────────────────

/// List all subtasks for a work item.
///
/// Returns `404 Not Found` when the parent work item does not exist or belongs
/// to a different user.
pub async fn list_subtasks(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(item_id): Path<Uuid>,
) -> AppResult<Json<Vec<WorkItemSubtask>>> {
    let subtasks = service::list_subtasks(&state, auth.user_id, item_id).await?;
    Ok(Json(subtasks))
}

// ── POST /api/work-items/:id/subtasks ─────────────────────────────────────────

/// Add a subtask to a work item.
///
/// Returns `201 Created` with the new subtask.
pub async fn add_subtask(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(item_id): Path<Uuid>,
    Json(body): Json<CreateSubtaskRequest>,
) -> AppResult<(StatusCode, Json<WorkItemSubtask>)> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let subtask = service::add_subtask(&state, auth.user_id, item_id, body).await?;
    Ok((StatusCode::CREATED, Json(subtask)))
}

// ── PATCH /api/work-items/:id/subtasks/:subtask_id ────────────────────────────

/// Update a subtask's title, completion, or position.
pub async fn update_subtask(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((item_id, subtask_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateSubtaskRequest>,
) -> AppResult<Json<WorkItemSubtask>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let subtask = service::update_subtask(&state, auth.user_id, item_id, subtask_id, body).await?;
    Ok(Json(subtask))
}

// ── DELETE /api/work-items/:id/subtasks/:subtask_id ───────────────────────────

/// Delete a subtask.
///
/// Returns `204 No Content` on success.
pub async fn delete_subtask(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((item_id, subtask_id)): Path<(Uuid, Uuid)>,
) -> AppResult<StatusCode> {
    service::delete_subtask(&state, auth.user_id, item_id, subtask_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── GET /api/work-items/:id/links ─────────────────────────────────────────────

/// List all work-item links for a given work item.
///
/// Returns `404 Not Found` when the parent work item does not exist or belongs
/// to a different user.
pub async fn list_links(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(item_id): Path<Uuid>,
) -> AppResult<Json<Vec<WorkItemLink>>> {
    let links = service::list_links(&state, auth.user_id, item_id).await?;
    Ok(Json(links))
}

// ── POST /api/work-items/:id/links ────────────────────────────────────────────

/// Create a link between two work items.
///
/// Returns `201 Created` with the new link.
/// Returns `422` when source == target.
/// Returns `409` when the link already exists.
pub async fn create_link(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(item_id): Path<Uuid>,
    Json(body): Json<CreateLinkRequest>,
) -> AppResult<(StatusCode, Json<WorkItemLink>)> {
    let link = service::create_link(&state, auth.user_id, item_id, body).await?;
    Ok((StatusCode::CREATED, Json(link)))
}

// ── DELETE /api/work-items/:id/links/:link_id ─────────────────────────────────

/// Delete a work-item link.
///
/// Returns `204 No Content` on success.
pub async fn delete_link(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((item_id, link_id)): Path<(Uuid, Uuid)>,
) -> AppResult<StatusCode> {
    service::delete_link(&state, auth.user_id, item_id, link_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── GET /api/work-items/:id/web-links ─────────────────────────────────────────

/// List all web links for a given work item.
pub async fn list_web_links(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(item_id): Path<Uuid>,
) -> AppResult<Json<Vec<WebLink>>> {
    let links = service::list_web_links(&state, auth.user_id, item_id).await?;
    Ok(Json(links))
}

// ── POST /api/work-items/:id/web-links ────────────────────────────────────────

/// Attach a web link to a work item.
///
/// Returns `201 Created` with the new web link.
pub async fn create_web_link(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(item_id): Path<Uuid>,
    Json(body): Json<CreateWebLinkRequest>,
) -> AppResult<(StatusCode, Json<WebLink>)> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let link = service::create_web_link(&state, auth.user_id, item_id, body).await?;
    Ok((StatusCode::CREATED, Json(link)))
}

// ── DELETE /api/work-items/:id/web-links/:link_id ─────────────────────────────

/// Delete a web link.
///
/// Returns `204 No Content` on success.
pub async fn delete_web_link(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((item_id, link_id)): Path<(Uuid, Uuid)>,
) -> AppResult<StatusCode> {
    service::delete_web_link(&state, auth.user_id, item_id, link_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── GET /api/work-items/:id/attachments ───────────────────────────────────────

/// List all file attachments for a given work item.
pub async fn list_attachments(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(item_id): Path<Uuid>,
) -> AppResult<Json<Vec<Attachment>>> {
    let uploads_dir = std::path::Path::new(UPLOADS_DIR);
    let attachments = service::list_attachments(&state, auth.user_id, item_id).await?;
    // uploads_dir used only for the delete path; listing doesn't touch disk.
    let _ = uploads_dir;
    Ok(Json(attachments))
}

// ── POST /api/work-items/:id/attachments ──────────────────────────────────────

/// Upload a file attachment for a work item.
///
/// Expects `multipart/form-data` with a `file` field.
/// Returns `201 Created` with the new attachment.
/// Returns `422` when the `file` field is missing.
pub async fn create_attachment(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(item_id): Path<Uuid>,
    mut multipart: Multipart,
) -> AppResult<(StatusCode, Json<Attachment>)> {
    let uploads_dir = std::path::Path::new(UPLOADS_DIR);

    let mut file_bytes: Option<bytes::Bytes> = None;
    let mut filename: Option<String> = None;
    let mut mime_type: Option<String> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        AppError::Validation(format!("multipart error: {e}"))
    })? {
        let field_name = field.name().unwrap_or("").to_owned();
        if field_name == "file" {
            filename = field
                .file_name()
                .map(ToOwned::to_owned)
                .or_else(|| Some("upload".to_owned()));
            mime_type = field.content_type().map(ToOwned::to_owned);
            let data = field.bytes().await.map_err(|e| {
                AppError::Validation(format!("failed to read file field: {e}"))
            })?;
            file_bytes = Some(data);
            break; // only consume the first `file` field
        }
    }

    let bytes = file_bytes.ok_or_else(|| {
        AppError::Validation("multipart field 'file' is required".to_owned())
    })?;
    let original_filename = filename.unwrap_or_else(|| "upload".to_owned());

    let attachment = service::create_attachment(
        &state,
        auth.user_id,
        item_id,
        uploads_dir,
        original_filename,
        mime_type,
        bytes,
    )
    .await?;

    Ok((StatusCode::CREATED, Json(attachment)))
}

// ── DELETE /api/work-items/:id/attachments/:att_id ────────────────────────────

/// Delete a file attachment and remove it from disk (best-effort).
///
/// Returns `204 No Content` on success.
pub async fn delete_attachment(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((item_id, att_id)): Path<(Uuid, Uuid)>,
) -> AppResult<StatusCode> {
    let uploads_dir = std::path::Path::new(UPLOADS_DIR);
    service::delete_attachment(&state, auth.user_id, item_id, att_id, uploads_dir).await?;
    Ok(StatusCode::NO_CONTENT)
}
