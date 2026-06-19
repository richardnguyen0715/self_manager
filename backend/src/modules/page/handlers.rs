//! Axum request handlers for the `page` module.
//!
//! All routes require `Authorization: Bearer <access-token>`.
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
        CreatePageRequest, ImageUploadResponse, ListPagesQuery, MovePageRequest,
        PageResponse, PageSearchResult, PageTreeNode, PageVersionResponse, PageVersionSummary,
        SearchPagesQuery, UpdatePageRequest,
    },
    service,
};

/// Absolute path to the shared uploads directory.
const UPLOADS_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/uploads");

// ── GET /api/pages?space_id=<uuid> ───────────────────────────────────────────

/// Return all pages in a space as a nested tree (`PageTreeNode[]`).
///
/// `space_id` query parameter is required. Returns `404` when the space does
/// not exist or is not owned by the authenticated user.
pub async fn list_page_tree(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ListPagesQuery>,
) -> AppResult<Json<Vec<PageTreeNode>>> {
    let tree = service::list_page_tree(&state, auth.user_id, query.space_id).await?;
    Ok(Json(tree))
}

// ── GET /api/pages/search?q=&space_id? ───────────────────────────────────────

/// Search pages by title using pg_trgm similarity.
///
/// `q` is required. `space_id` is optional; when absent the search spans all
/// pages owned by the authenticated user.
pub async fn search_pages(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<SearchPagesQuery>,
) -> AppResult<Json<Vec<PageSearchResult>>> {
    let results =
        service::search_pages(&state, auth.user_id, &query.q, query.space_id).await?;
    Ok(Json(results))
}

// ── POST /api/pages/move ──────────────────────────────────────────────────────

/// Reparent a page within its space and/or change its sibling position.
///
/// Returns `422` when a cycle would be created or a cross-space move is
/// attempted.
pub async fn move_page(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<MovePageRequest>,
) -> AppResult<Json<PageResponse>> {
    let page = service::move_page(&state, auth.user_id, body).await?;
    Ok(Json(page))
}

// ── POST /api/pages ───────────────────────────────────────────────────────────

/// Create a new page under a space with an optional parent page.
///
/// Returns `201 Created` with the full page (draft status, empty content).
pub async fn create_page(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreatePageRequest>,
) -> AppResult<(StatusCode, Json<PageResponse>)> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let page = service::create_page(&state, auth.user_id, body).await?;
    Ok((StatusCode::CREATED, Json(page)))
}

// ── GET /api/pages/:id ────────────────────────────────────────────────────────

/// Fetch a single page with full content and excalidraw fields.
///
/// Returns `404` when the page does not exist or is not owned by the user.
pub async fn get_page(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(page_id): Path<Uuid>,
) -> AppResult<Json<PageResponse>> {
    let page = service::get_page(&state, auth.user_id, page_id).await?;
    Ok(Json(page))
}

// ── PATCH /api/pages/:id ──────────────────────────────────────────────────────

/// Partially update a page (autosave path). Bumps `updated_at`.
///
/// Only JSON fields present in the body are modified; absent fields are kept.
pub async fn update_page(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(page_id): Path<Uuid>,
    Json(body): Json<UpdatePageRequest>,
) -> AppResult<Json<PageResponse>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let page = service::update_page(&state, auth.user_id, page_id, body).await?;
    Ok(Json(page))
}

// ── DELETE /api/pages/:id ─────────────────────────────────────────────────────

/// Delete a page. Children, versions, and comments are cascade-deleted by the
/// database FK constraints.
///
/// Returns `204 No Content` on success.
pub async fn delete_page(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(page_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::delete_page(&state, auth.user_id, page_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── POST /api/pages/:id/publish ───────────────────────────────────────────────

/// Publish a page: `status → 'published'`, sets `published_at`, and creates a
/// `page_version` snapshot of the current content.
///
/// Returns `200 OK` with the updated page.
pub async fn publish_page(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(page_id): Path<Uuid>,
) -> AppResult<Json<PageResponse>> {
    let page = service::publish_page(&state, auth.user_id, page_id).await?;
    Ok(Json(page))
}

// ── GET /api/pages/:id/versions ───────────────────────────────────────────────

/// List version summaries for a page, newest first (no content body).
pub async fn list_versions(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(page_id): Path<Uuid>,
) -> AppResult<Json<Vec<PageVersionSummary>>> {
    let versions = service::list_versions(&state, auth.user_id, page_id).await?;
    Ok(Json(versions))
}

// ── POST /api/pages/:id/versions ──────────────────────────────────────────────

/// Explicitly save a version snapshot of the current page content.
///
/// Returns `201 Created` with the version summary.
pub async fn save_version(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(page_id): Path<Uuid>,
) -> AppResult<(StatusCode, Json<PageVersionSummary>)> {
    let summary = service::save_version(&state, auth.user_id, page_id).await?;
    Ok((StatusCode::CREATED, Json(summary)))
}

// ── GET /api/pages/:id/versions/:version_id ───────────────────────────────────

/// Fetch a single version by its ID (full content included).
pub async fn get_version(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((page_id, version_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<PageVersionResponse>> {
    let version = service::get_version(&state, auth.user_id, page_id, version_id).await?;
    Ok(Json(version))
}

// ── POST /api/pages/:id/versions/:version_id/restore ─────────────────────────

/// Restore a version: snapshot current content first, then overwrite the page
/// title + content with the version's data.
///
/// Returns `200 OK` with the updated page.
pub async fn restore_version(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((page_id, version_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<PageResponse>> {
    let page = service::restore_version(&state, auth.user_id, page_id, version_id).await?;
    Ok(Json(page))
}

// ── POST /api/pages/:id/images ────────────────────────────────────────────────

/// Upload an image for embedding in a page's editor content.
///
/// Expects `multipart/form-data` with a `file` field. Writes the file to the
/// shared `uploads/` directory and returns `{ "url": "/uploads/<file>" }`.
/// No database row is created; the URL is stored inline in the TipTap JSON.
///
/// Returns `201 Created`.
pub async fn upload_page_image(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(page_id): Path<Uuid>,
    mut multipart: Multipart,
) -> AppResult<(StatusCode, Json<ImageUploadResponse>)> {
    let uploads_dir = std::path::Path::new(UPLOADS_DIR);

    const MAX_IMAGE_BYTES: usize = 10 * 1024 * 1024; // 10 MB

    let mut file_bytes: Option<bytes::Bytes> = None;
    let mut filename: Option<String> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        AppError::Validation(format!("multipart error: {e}"))
    })? {
        let field_name = field.name().unwrap_or("").to_owned();
        if field_name == "file" {
            // Only accept images — the URL is embedded in user-rendered content.
            let content_type = field.content_type().unwrap_or("").to_owned();
            if !content_type.starts_with("image/") {
                return Err(AppError::Validation(format!(
                    "only image uploads are allowed (got '{content_type}')"
                )));
            }
            filename = field
                .file_name()
                .map(ToOwned::to_owned)
                .or_else(|| Some("image".to_owned()));
            let data = field.bytes().await.map_err(|e| {
                AppError::Validation(format!("failed to read file field: {e}"))
            })?;
            if data.is_empty() {
                return Err(AppError::Validation("uploaded file is empty".to_owned()));
            }
            if data.len() > MAX_IMAGE_BYTES {
                return Err(AppError::Validation(
                    "image exceeds the 10 MB limit".to_owned(),
                ));
            }
            file_bytes = Some(data);
            break;
        }
    }

    let bytes = file_bytes.ok_or_else(|| {
        AppError::Validation("multipart field 'file' is required".to_owned())
    })?;
    let original_filename = filename.unwrap_or_else(|| "image".to_owned());

    let url = service::upload_page_image(
        &state,
        auth.user_id,
        page_id,
        uploads_dir,
        original_filename,
        bytes,
    )
    .await?;

    Ok((StatusCode::CREATED, Json(ImageUploadResponse { url })))
}
