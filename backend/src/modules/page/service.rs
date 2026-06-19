//! Business logic for the `page` module.
//!
//! All public functions accept `&AppState` and execute SQL via `sqlx::query!`
//! / `sqlx::query_as!` (compile-time checked).
//!
//! `kind` and `status` are plain `text` columns with CHECK constraints.
//! They are bound and read as `String` / `&str` directly (no enum cast needed).
//!
//! `content` and `excalidraw` are `jsonb` and mapped to `serde_json::Value`
//! using `sqlx::types::Json` or the `as "col: serde_json::Value"` override.

use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    state::AppState,
};

use super::models::{
    CreatePageRequest, MovePageRequest, Page, PageFlatRow, PageResponse, PageSearchResult,
    PageTreeNode, PageVersion, PageVersionResponse, PageVersionSummary, UpdatePageRequest,
};

// ── helpers ────────────────────────────────────────────────────────────────────

/// Fetch a single `Page` row owned by `user_id`, or return `NotFound`.
async fn fetch_page(state: &AppState, user_id: Uuid, page_id: Uuid) -> AppResult<Page> {
    sqlx::query_as!(
        Page,
        r#"
        SELECT
            id, space_id, parent_id, user_id, title, kind, status, position,
            content    AS "content: serde_json::Value",
            excalidraw AS "excalidraw: serde_json::Value",
            created_at, updated_at, published_at
        FROM pages
        WHERE id = $1 AND user_id = $2
        "#,
        page_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)
}

/// Snapshot the current content of `page_id` as a new `page_versions` row.
/// Called internally on publish and on explicit save-version.
async fn snapshot_version(
    state: &AppState,
    page_id: Uuid,
    user_id: Uuid,
    title: &str,
    content: &serde_json::Value,
) -> AppResult<PageVersion> {
    let version = sqlx::query_as!(
        PageVersion,
        r#"
        INSERT INTO page_versions (page_id, user_id, title, content)
        VALUES ($1, $2, $3, $4)
        RETURNING
            id, page_id, user_id, title,
            content AS "content: serde_json::Value",
            created_at
        "#,
        page_id,
        user_id,
        title,
        content,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(version)
}

/// Assemble a flat list of `PageFlatRow` into a nested `PageTreeNode` forest,
/// ordered by `position ASC, created_at ASC` (DB already returns them ordered).
fn build_tree(rows: Vec<PageFlatRow>, parent_id: Option<Uuid>) -> Vec<PageTreeNode> {
    build_tree_depth(&rows, parent_id, 0)
}

/// Depth-guarded tree assembly. The depth cap prevents unbounded recursion /
/// stack overflow if a parent cycle ever exists in the data.
fn build_tree_depth(
    rows: &[PageFlatRow],
    parent_id: Option<Uuid>,
    depth: u16,
) -> Vec<PageTreeNode> {
    if depth > 64 {
        return Vec::new();
    }
    rows.iter()
        .filter(|r| r.parent_id == parent_id)
        .map(|r| PageTreeNode {
            id: r.id,
            space_id: r.space_id,
            parent_id: r.parent_id,
            title: r.title.clone(),
            kind: r.kind.clone(),
            status: r.status.clone(),
            position: r.position,
            children: build_tree_depth(rows, Some(r.id), depth + 1),
        })
        .collect()
}

// ── Page CRUD ──────────────────────────────────────────────────────────────────

/// Return all pages in a space as a nested tree.
///
/// Fetches every flat row belonging to `space_id` (ownership via user_id on the
/// space), then assembles the recursive `PageTreeNode` forest in memory.
///
/// # Errors
///
/// - [`AppError::NotFound`] — space not found or not owned.
/// - [`AppError::Db`] — database failure.
pub async fn list_page_tree(
    state: &AppState,
    user_id: Uuid,
    space_id: Uuid,
) -> AppResult<Vec<PageTreeNode>> {
    // Ownership check on the space.
    let space_exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM spaces WHERE id = $1 AND user_id = $2)",
        space_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !space_exists {
        return Err(AppError::NotFound);
    }

    let rows = sqlx::query_as!(
        PageFlatRow,
        r#"
        SELECT id, space_id, parent_id, title, kind, status, position
        FROM pages
        WHERE space_id = $1
        ORDER BY position ASC, created_at ASC
        "#,
        space_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(build_tree(rows, None))
}

/// Search pages by title using pg_trgm similarity, scoped to `user_id`.
///
/// # Errors
///
/// - [`AppError::Db`] — database failure.
pub async fn search_pages(
    state: &AppState,
    user_id: Uuid,
    q: &str,
    space_id: Option<Uuid>,
) -> AppResult<Vec<PageSearchResult>> {
    let rows = sqlx::query_as!(
        PageSearchResult,
        r#"
        SELECT id, space_id, title, kind
        FROM pages
        WHERE user_id = $1
          AND ($2::uuid IS NULL OR space_id = $2)
          AND title % $3
        ORDER BY similarity(title, $3) DESC
        LIMIT 50
        "#,
        user_id,
        space_id as Option<Uuid>,
        q,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

/// Create a new page under a space, optionally under a parent page.
///
/// Returns the full `PageResponse` with default draft status and empty content.
///
/// # Errors
///
/// - [`AppError::NotFound`] — space not owned, or parent page not in the same space.
/// - [`AppError::Validation`] — invalid `kind` value.
/// - [`AppError::Db`] — database failure.
pub async fn create_page(
    state: &AppState,
    user_id: Uuid,
    req: CreatePageRequest,
) -> AppResult<PageResponse> {
    // Validate kind if provided.
    if let Some(ref k) = req.kind {
        if k != "page" && k != "whiteboard" {
            return Err(AppError::Validation(format!(
                "kind must be 'page' or 'whiteboard', got '{k}'"
            )));
        }
    }

    // Space ownership check.
    let space_exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM spaces WHERE id = $1 AND user_id = $2)",
        req.space_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !space_exists {
        return Err(AppError::NotFound);
    }

    // If a parent_id is given, verify it belongs to the same space.
    if let Some(pid) = req.parent_id {
        let parent_ok: bool = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM pages WHERE id = $1 AND space_id = $2)",
            pid,
            req.space_id,
        )
        .fetch_one(&state.db)
        .await?
        .unwrap_or(false);

        if !parent_ok {
            return Err(AppError::NotFound);
        }
    }

    let title = req
        .title
        .as_deref()
        .unwrap_or("Untitled")
        .to_owned();
    let kind = req.kind.as_deref().unwrap_or("page").to_owned();
    let empty_content = serde_json::json!({});

    // Position = next available slot among siblings.
    let next_position: i32 = sqlx::query_scalar!(
        r#"
        SELECT COALESCE(MAX(position), -1) + 1
        FROM pages
        WHERE space_id = $1
          AND ($2::uuid IS NULL OR parent_id = $2)
          AND ($2::uuid IS NOT NULL OR parent_id IS NULL)
        "#,
        req.space_id,
        req.parent_id as Option<Uuid>,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    let page = sqlx::query_as!(
        Page,
        r#"
        INSERT INTO pages (space_id, parent_id, user_id, title, kind, content, position)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
            id, space_id, parent_id, user_id, title, kind, status, position,
            content    AS "content: serde_json::Value",
            excalidraw AS "excalidraw: serde_json::Value",
            created_at, updated_at, published_at
        "#,
        req.space_id,
        req.parent_id as Option<Uuid>,
        user_id,
        title,
        kind,
        empty_content,
        next_position,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(page.into())
}

/// Fetch a single page by ID, enforcing ownership.
///
/// # Errors
///
/// - [`AppError::NotFound`] — page not found or not owned.
/// - [`AppError::Db`] — database failure.
pub async fn get_page(
    state: &AppState,
    user_id: Uuid,
    page_id: Uuid,
) -> AppResult<PageResponse> {
    let page = fetch_page(state, user_id, page_id).await?;
    Ok(page.into())
}

/// Partially update a page (autosave path). Bumps `updated_at`.
///
/// Only fields present in the request body are applied; absent fields keep
/// their current values.
///
/// # Errors
///
/// - [`AppError::NotFound`] — page not found or not owned.
/// - [`AppError::Validation`] — invalid `kind` value.
/// - [`AppError::Db`] — database failure.
pub async fn update_page(
    state: &AppState,
    user_id: Uuid,
    page_id: Uuid,
    req: UpdatePageRequest,
) -> AppResult<PageResponse> {
    if let Some(ref k) = req.kind {
        if k != "page" && k != "whiteboard" {
            return Err(AppError::Validation(format!(
                "kind must be 'page' or 'whiteboard', got '{k}'"
            )));
        }
    }

    let current = fetch_page(state, user_id, page_id).await?;

    let new_title = req
        .title
        .as_deref()
        .unwrap_or(current.title.as_str())
        .to_owned();
    let new_kind = req
        .kind
        .as_deref()
        .unwrap_or(current.kind.as_str())
        .to_owned();
    let new_content = req.content.unwrap_or(current.content);
    let new_excalidraw = if req.excalidraw.is_some() {
        req.excalidraw
    } else {
        current.excalidraw
    };
    let new_position = req.position.unwrap_or(current.position);
    // Reparenting is NOT done here — it goes through `move_page`, which validates
    // same-space + no-cycle. PATCH only reorders within the current parent, so a
    // malformed PATCH can never introduce a parent cycle.
    let new_parent_id = current.parent_id;

    let updated = sqlx::query_as!(
        Page,
        r#"
        UPDATE pages
        SET title      = $3,
            kind       = $4,
            content    = $5,
            excalidraw = $6,
            position   = $7,
            parent_id  = $8,
            updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING
            id, space_id, parent_id, user_id, title, kind, status, position,
            content    AS "content: serde_json::Value",
            excalidraw AS "excalidraw: serde_json::Value",
            created_at, updated_at, published_at
        "#,
        page_id,
        user_id,
        new_title,
        new_kind,
        new_content,
        new_excalidraw as Option<serde_json::Value>,
        new_position,
        new_parent_id as Option<Uuid>,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(updated.into())
}

/// Delete a page and its entire subtree (cascaded by DB FK ON DELETE CASCADE).
///
/// # Errors
///
/// - [`AppError::NotFound`] — page not found or not owned.
/// - [`AppError::Db`] — database failure.
pub async fn delete_page(state: &AppState, user_id: Uuid, page_id: Uuid) -> AppResult<()> {
    let result = sqlx::query!(
        "DELETE FROM pages WHERE id = $1 AND user_id = $2",
        page_id,
        user_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}

/// Transition a page from `draft` to `published`, set `published_at`, and
/// snapshot a `page_version` with the current title + content.
///
/// Idempotent: republishing a published page creates another snapshot and
/// refreshes `published_at`.
///
/// # Errors
///
/// - [`AppError::NotFound`] — page not found or not owned.
/// - [`AppError::Db`] — database failure.
pub async fn publish_page(
    state: &AppState,
    user_id: Uuid,
    page_id: Uuid,
) -> AppResult<PageResponse> {
    let page = fetch_page(state, user_id, page_id).await?;

    // Snapshot current content before publishing.
    snapshot_version(state, page_id, user_id, &page.title, &page.content).await?;

    let updated = sqlx::query_as!(
        Page,
        r#"
        UPDATE pages
        SET status       = 'published',
            published_at = now(),
            updated_at   = now()
        WHERE id = $1 AND user_id = $2
        RETURNING
            id, space_id, parent_id, user_id, title, kind, status, position,
            content    AS "content: serde_json::Value",
            excalidraw AS "excalidraw: serde_json::Value",
            created_at, updated_at, published_at
        "#,
        page_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(updated.into())
}

/// Reparent a page within its space and/or change its sibling position.
///
/// Validates:
/// - Page exists and is owned by `user_id`.
/// - If `parent_id` is given, it belongs to the same space as the page and is
///   not the page itself or any of its descendants (cycle prevention).
///
/// Returns `422` on cycle detection.
///
/// # Errors
///
/// - [`AppError::NotFound`] — page not found or not owned.
/// - [`AppError::Validation`] — cycle detected or cross-space move attempted.
/// - [`AppError::Db`] — database failure.
pub async fn move_page(
    state: &AppState,
    user_id: Uuid,
    req: MovePageRequest,
) -> AppResult<PageResponse> {
    let page = fetch_page(state, user_id, req.id).await?;

    if let Some(new_parent_id) = req.parent_id {
        // Cannot reparent to itself.
        if new_parent_id == req.id {
            return Err(AppError::Validation(
                "a page cannot be its own parent".to_owned(),
            ));
        }

        // Verify the prospective parent is in the same space.
        let parent_in_space: bool = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM pages WHERE id = $1 AND space_id = $2)",
            new_parent_id,
            page.space_id,
        )
        .fetch_one(&state.db)
        .await?
        .unwrap_or(false);

        if !parent_in_space {
            return Err(AppError::Validation(
                "cannot move a page to a parent in a different space".to_owned(),
            ));
        }

        // Cycle check: the new parent must not be a descendant of the page being moved.
        // Walk ancestors of `new_parent_id` upward; if we hit `req.id`, it's a cycle.
        let is_descendant: bool = sqlx::query_scalar!(
            r#"
            WITH RECURSIVE anc AS (
                SELECT id, parent_id FROM pages WHERE id = $1
                UNION ALL
                SELECT p.id, p.parent_id
                FROM pages p
                JOIN anc ON anc.parent_id = p.id
            )
            SELECT EXISTS(SELECT 1 FROM anc WHERE id = $2)
            "#,
            new_parent_id,
            req.id,
        )
        .fetch_one(&state.db)
        .await?
        .unwrap_or(false);

        if is_descendant {
            return Err(AppError::Validation(
                "cannot reparent a page under one of its descendants".to_owned(),
            ));
        }
    }

    let updated = sqlx::query_as!(
        Page,
        r#"
        UPDATE pages
        SET parent_id  = $3,
            position   = $4,
            updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING
            id, space_id, parent_id, user_id, title, kind, status, position,
            content    AS "content: serde_json::Value",
            excalidraw AS "excalidraw: serde_json::Value",
            created_at, updated_at, published_at
        "#,
        req.id,
        user_id,
        req.parent_id as Option<Uuid>,
        req.position,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(updated.into())
}

// ── Versions ───────────────────────────────────────────────────────────────────

/// List version summaries for a page (newest first, no content body).
///
/// # Errors
///
/// - [`AppError::NotFound`] — page not found or not owned.
/// - [`AppError::Db`] — database failure.
pub async fn list_versions(
    state: &AppState,
    user_id: Uuid,
    page_id: Uuid,
) -> AppResult<Vec<PageVersionSummary>> {
    // Ownership check.
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM pages WHERE id = $1 AND user_id = $2)",
        page_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound);
    }

    let rows = sqlx::query_as!(
        PageVersion,
        r#"
        SELECT id, page_id, user_id, title,
               content AS "content: serde_json::Value",
               created_at
        FROM page_versions
        WHERE page_id = $1
        ORDER BY created_at DESC
        "#,
        page_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows.into_iter().map(PageVersionSummary::from).collect())
}

/// Explicitly save a version snapshot of the current page content.
///
/// # Errors
///
/// - [`AppError::NotFound`] — page not found or not owned.
/// - [`AppError::Db`] — database failure.
pub async fn save_version(
    state: &AppState,
    user_id: Uuid,
    page_id: Uuid,
) -> AppResult<PageVersionSummary> {
    let page = fetch_page(state, user_id, page_id).await?;
    let version = snapshot_version(state, page_id, user_id, &page.title, &page.content).await?;
    Ok(PageVersionSummary::from(version))
}

/// Fetch a single version by its ID.
///
/// # Errors
///
/// - [`AppError::NotFound`] — version or page not found / not owned.
/// - [`AppError::Db`] — database failure.
pub async fn get_version(
    state: &AppState,
    user_id: Uuid,
    page_id: Uuid,
    version_id: Uuid,
) -> AppResult<PageVersionResponse> {
    // Ownership check on the page.
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM pages WHERE id = $1 AND user_id = $2)",
        page_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound);
    }

    let version = sqlx::query_as!(
        PageVersion,
        r#"
        SELECT id, page_id, user_id, title,
               content AS "content: serde_json::Value",
               created_at
        FROM page_versions
        WHERE id = $1 AND page_id = $2
        "#,
        version_id,
        page_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(PageVersionResponse::from(version))
}

/// Restore a version: snapshot the current page content first, then overwrite
/// the page's `title` and `content` with the version's data.
///
/// Returns the updated `PageResponse`.
///
/// # Errors
///
/// - [`AppError::NotFound`] — page or version not found / not owned.
/// - [`AppError::Db`] — database failure.
pub async fn restore_version(
    state: &AppState,
    user_id: Uuid,
    page_id: Uuid,
    version_id: Uuid,
) -> AppResult<PageResponse> {
    let page = fetch_page(state, user_id, page_id).await?;

    // Fetch the target version.
    let version = sqlx::query_as!(
        PageVersion,
        r#"
        SELECT id, page_id, user_id, title,
               content AS "content: serde_json::Value",
               created_at
        FROM page_versions
        WHERE id = $1 AND page_id = $2
        "#,
        version_id,
        page_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // Snapshot current content before overwriting so the user can undo the restore.
    snapshot_version(state, page_id, user_id, &page.title, &page.content).await?;

    // Overwrite title + content with the version's data.
    let updated = sqlx::query_as!(
        Page,
        r#"
        UPDATE pages
        SET title      = $3,
            content    = $4,
            updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING
            id, space_id, parent_id, user_id, title, kind, status, position,
            content    AS "content: serde_json::Value",
            excalidraw AS "excalidraw: serde_json::Value",
            created_at, updated_at, published_at
        "#,
        page_id,
        user_id,
        version.title,
        version.content,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(updated.into())
}

// ── Image upload ───────────────────────────────────────────────────────────────

/// Write an uploaded image file to disk and return its public URL.
///
/// No database row is created. The URL `/uploads/<stored-file>` is returned
/// to the editor, which embeds it as an `image` node `src` attribute inside
/// the TipTap JSON document.
///
/// # Errors
///
/// - [`AppError::NotFound`] — page not found or not owned.
/// - [`AppError::InternalMsg`] — I/O failure while writing the file.
pub async fn upload_page_image(
    state: &AppState,
    user_id: Uuid,
    page_id: Uuid,
    uploads_dir: &std::path::Path,
    original_filename: String,
    bytes: bytes::Bytes,
) -> AppResult<String> {
    // Ownership check.
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM pages WHERE id = $1 AND user_id = $2)",
        page_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound);
    }

    // Sanitize filename (same approach as work_item attachment).
    let sanitized: String = original_filename
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let sanitized = sanitized.trim_matches('_').to_owned();
    let sanitized = if sanitized.is_empty() {
        "image".to_owned()
    } else {
        sanitized
    };

    let file_id = uuid::Uuid::new_v4();
    let stored_name = format!("{file_id}-{sanitized}");
    let full_path = uploads_dir.join(&stored_name);

    std::fs::create_dir_all(uploads_dir).map_err(|e| {
        AppError::InternalMsg(anyhow::anyhow!("failed to create uploads directory: {e}"))
    })?;

    tokio::fs::write(&full_path, &bytes).await.map_err(|e| {
        AppError::InternalMsg(anyhow::anyhow!(
            "failed to write image file {}: {e}",
            full_path.display()
        ))
    })?;

    Ok(format!("/uploads/{stored_name}"))
}
