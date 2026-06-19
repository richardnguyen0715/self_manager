//! Business logic for the `page` module.
//!
//! All public functions accept `&AppState` and execute SQL via `sqlx::query!`
//! / `sqlx::query_as!` (compile-time checked).
//!
//! `kind` and `status` are plain `text` columns with CHECK constraints.
//! They are bound and read as `String` / `&str` directly (no enum cast needed).
//!
//! `content` and `excalidraw` are `jsonb` and mapped to `serde_json::Value`
//! using the `AS "col: serde_json::Value"` override syntax.
//!
//! ## Backlink re-sync
//!
//! Every call to [`update_page`] that touches `content` triggers
//! [`resync_page_links`], which:
//! 1. Walks the TipTap JSON looking for `{ "type": "pageMention", "attrs": { "pageId": "<uuid>" } }` nodes.
//! 2. Deletes all existing `page_links` rows where `source_page_id = page_id`.
//! 3. Inserts one row per distinct `pageId` found, keyed by `(source, target)`.
//!
//! This is idempotent and consistent with the persisted document.

use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    state::AppState,
};

use super::models::{
    CreateFromTemplateRequest, CreatePageRequest, MovePageRequest, Page, PageBacklink,
    PageFlatRow, PageLinkRef, PagePublicStateResponse, PageResponse, PageSearchResult,
    PageTreeNode, PageVersion, PageVersionResponse, PageVersionSummary, SetPagePublicRequest,
    UpdatePageRequest,
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
            created_at, updated_at, published_at,
            icon, cover_url, is_public, public_slug, is_template
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
            icon: r.icon.clone(),
            is_public: r.is_public,
            is_template: r.is_template,
            children: build_tree_depth(rows, Some(r.id), depth + 1),
        })
        .collect()
}

/// Generate a URL-safe slug from a title string.
///
/// Converts to lowercase, replaces spaces/special chars with hyphens, collapses
/// consecutive hyphens, strips leading/trailing hyphens.
fn slugify(title: &str) -> String {
    let s: String = title
        .to_lowercase()
        .chars()
        .map(|c| {
            if c.is_alphanumeric() {
                c
            } else {
                '-'
            }
        })
        .collect();

    // Collapse multiple consecutive hyphens into one.
    let mut slug = String::with_capacity(s.len());
    let mut last_hyphen = false;
    for c in s.chars() {
        if c == '-' {
            if !last_hyphen {
                slug.push(c);
            }
            last_hyphen = true;
        } else {
            slug.push(c);
            last_hyphen = false;
        }
    }
    let slug = slug.trim_matches('-').to_owned();
    if slug.is_empty() {
        Uuid::new_v4().to_string()
    } else {
        slug
    }
}

/// Mint a unique public slug for a page, using its title as a base.
///
/// Appends an incrementing suffix (`-2`, `-3`, …) until the slug is unique.
async fn mint_public_slug(state: &AppState, title: &str) -> AppResult<String> {
    let base = slugify(title);

    // Try the base slug first, then append numeric suffixes.
    let mut candidate = base.clone();
    let mut suffix: u32 = 2;
    loop {
        let exists: bool = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM pages WHERE public_slug = $1)",
            candidate,
        )
        .fetch_one(&state.db)
        .await?
        .unwrap_or(false);

        if !exists {
            return Ok(candidate);
        }

        candidate = format!("{base}-{suffix}");
        suffix += 1;

        if suffix > 9999 {
            // Extremely unlikely; fall back to a UUID to avoid infinite loop.
            return Ok(format!("{base}-{}", Uuid::new_v4()));
        }
    }
}

/// Walk a TipTap JSON document and collect all `pageMention` node `pageId` attrs.
///
/// The TipTap JSON shape for a pageMention node is:
/// ```json
/// { "type": "pageMention", "attrs": { "pageId": "<uuid-string>" } }
/// ```
fn collect_page_mention_ids(content: &serde_json::Value) -> Vec<Uuid> {
    let mut ids = Vec::new();
    collect_page_mention_ids_inner(content, &mut ids);
    // Deduplicate while preserving first-occurrence order.
    let mut seen = std::collections::HashSet::new();
    ids.retain(|id| seen.insert(*id));
    ids
}

fn collect_page_mention_ids_inner(value: &serde_json::Value, out: &mut Vec<Uuid>) {
    match value {
        serde_json::Value::Object(map) => {
            if map.get("type").and_then(|v| v.as_str()) == Some("pageMention") {
                if let Some(attrs) = map.get("attrs").and_then(|v| v.as_object()) {
                    if let Some(page_id_str) = attrs.get("pageId").and_then(|v| v.as_str()) {
                        if let Ok(id) = Uuid::parse_str(page_id_str) {
                            out.push(id);
                        }
                    }
                }
            }
            // Recurse into all values (content array, children, etc.).
            for v in map.values() {
                collect_page_mention_ids_inner(v, out);
            }
        }
        serde_json::Value::Array(arr) => {
            for v in arr {
                collect_page_mention_ids_inner(v, out);
            }
        }
        _ => {}
    }
}

/// Delete all `page_links` for `source_page_id` and re-insert from `mention_ids`.
///
/// Ownership-checked: only target pages that also belong to `user_id` are inserted
/// (prevents linking to another user's pages, which would be unreachable anyway).
/// This is called from [`update_page`] after the content is saved.
async fn resync_page_links(
    state: &AppState,
    source_page_id: Uuid,
    user_id: Uuid,
    mention_ids: &[Uuid],
) -> AppResult<()> {
    // Delete all existing outbound links from this source page.
    sqlx::query!(
        "DELETE FROM page_links WHERE source_page_id = $1",
        source_page_id,
    )
    .execute(&state.db)
    .await?;

    // Re-insert one row per distinct target, subject to ownership check.
    for &target_id in mention_ids {
        // Skip self-links.
        if target_id == source_page_id {
            continue;
        }

        // Verify the target page exists and belongs to the same user.
        let target_ok: bool = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM pages WHERE id = $1 AND user_id = $2)",
            target_id,
            user_id,
        )
        .fetch_one(&state.db)
        .await?
        .unwrap_or(false);

        if !target_ok {
            continue;
        }

        sqlx::query!(
            r#"
            INSERT INTO page_links (source_page_id, target_page_id, user_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (source_page_id, target_page_id) DO NOTHING
            "#,
            source_page_id,
            target_id,
            user_id,
        )
        .execute(&state.db)
        .await?;
    }

    Ok(())
}

// ── Page CRUD ──────────────────────────────────────────────────────────────────

/// Return all pages in a space as a nested tree.
///
/// Template pages (`is_template = true`) are excluded from the tree; they are
/// returned only by the templates endpoint.
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
        SELECT id, space_id, parent_id, title, kind, status, position,
               icon, is_public, is_template
        FROM pages
        WHERE space_id = $1
          AND is_template = false
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
        SELECT id, space_id, title, kind, icon
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

/// List template pages for a user, optionally scoped to a space.
///
/// Template pages have `is_template = true`. They are excluded from the normal
/// page tree and only returned here.
///
/// # Errors
///
/// - [`AppError::Db`] — database failure.
pub async fn list_templates(
    state: &AppState,
    user_id: Uuid,
    space_id: Option<Uuid>,
) -> AppResult<Vec<PageResponse>> {
    let rows = sqlx::query_as!(
        Page,
        r#"
        SELECT
            id, space_id, parent_id, user_id, title, kind, status, position,
            content    AS "content: serde_json::Value",
            excalidraw AS "excalidraw: serde_json::Value",
            created_at, updated_at, published_at,
            icon, cover_url, is_public, public_slug, is_template
        FROM pages
        WHERE user_id = $1
          AND is_template = true
          AND ($2::uuid IS NULL OR space_id = $2)
        ORDER BY title ASC
        "#,
        user_id,
        space_id as Option<Uuid>,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows.into_iter().map(PageResponse::from).collect())
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
            created_at, updated_at, published_at,
            icon, cover_url, is_public, public_slug, is_template
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
/// their current values. When `content` is updated, `page_links` is re-synced
/// by extracting all `pageMention` node IDs.
///
/// V2: `icon` and `cover_url` can be set to `""` to clear them.
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
    let content_changed = req.content.is_some();
    let new_content = req.content.unwrap_or(current.content);
    let new_excalidraw = if req.excalidraw.is_some() {
        req.excalidraw
    } else {
        current.excalidraw
    };
    let new_position = req.position.unwrap_or(current.position);
    // Reparenting goes through `move_page` — PATCH only reorders within the current parent.
    let new_parent_id = current.parent_id;

    // V2: icon — None=keep, Some("")=clear, Some(emoji)=set.
    let new_icon: Option<String> = match req.icon {
        Some(ref s) if s.is_empty() => None, // explicit clear
        Some(s) => Some(s),
        None => current.icon,
    };
    // V2: cover_url — same semantics.
    let new_cover_url: Option<String> = match req.cover_url {
        Some(ref s) if s.is_empty() => None,
        Some(s) => Some(s),
        None => current.cover_url,
    };

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
            icon       = $9,
            cover_url  = $10,
            updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING
            id, space_id, parent_id, user_id, title, kind, status, position,
            content    AS "content: serde_json::Value",
            excalidraw AS "excalidraw: serde_json::Value",
            created_at, updated_at, published_at,
            icon, cover_url, is_public, public_slug, is_template
        "#,
        page_id,
        user_id,
        new_title,
        new_kind,
        new_content,
        new_excalidraw as Option<serde_json::Value>,
        new_position,
        new_parent_id as Option<Uuid>,
        new_icon,
        new_cover_url,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // Re-sync backlinks whenever the doc content changed.
    if content_changed {
        let mention_ids = collect_page_mention_ids(&updated.content);
        resync_page_links(state, page_id, user_id, &mention_ids).await?;
    }

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
            created_at, updated_at, published_at,
            icon, cover_url, is_public, public_slug, is_template
        "#,
        page_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(updated.into())
}

/// Toggle the public-site visibility flag for a page.
///
/// - `public = true`: sets `is_public = true`; if `public_slug` is currently
///   `NULL`, mints a new unique slug derived from the page title.
/// - `public = false`: sets `is_public = false`; the `public_slug` is kept so
///   re-publishing reuses the same URL.
///
/// # Errors
///
/// - [`AppError::NotFound`] — page not found or not owned.
/// - [`AppError::Db`] — database failure.
pub async fn set_page_public(
    state: &AppState,
    user_id: Uuid,
    page_id: Uuid,
    req: SetPagePublicRequest,
) -> AppResult<PagePublicStateResponse> {
    let page = fetch_page(state, user_id, page_id).await?;

    let new_slug = if req.public && page.public_slug.is_none() {
        Some(mint_public_slug(state, &page.title).await?)
    } else {
        // Keep existing slug (whether setting public or unpublishing).
        page.public_slug.clone()
    };

    sqlx::query!(
        r#"
        UPDATE pages
        SET is_public  = $3,
            public_slug = $4,
            updated_at  = now()
        WHERE id = $1 AND user_id = $2
        "#,
        page_id,
        user_id,
        req.public,
        new_slug,
    )
    .execute(&state.db)
    .await?;

    Ok(PagePublicStateResponse {
        is_public: req.public,
        public_slug: new_slug,
    })
}

/// Upload a cover image for a page and update `cover_url`.
///
/// Writes the file to `uploads_dir` and sets `pages.cover_url` to the returned
/// path. Returns the URL string.
///
/// # Errors
///
/// - [`AppError::NotFound`] — page not found or not owned.
/// - [`AppError::InternalMsg`] — I/O failure.
pub async fn upload_cover_image(
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

    let url = write_upload(uploads_dir, original_filename, bytes).await?;

    sqlx::query!(
        "UPDATE pages SET cover_url = $3, updated_at = now() WHERE id = $1 AND user_id = $2",
        page_id,
        user_id,
        url,
    )
    .execute(&state.db)
    .await?;

    Ok(url)
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
            created_at, updated_at, published_at,
            icon, cover_url, is_public, public_slug, is_template
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
            created_at, updated_at, published_at,
            icon, cover_url, is_public, public_slug, is_template
        "#,
        page_id,
        user_id,
        version.title,
        version.content,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // Re-sync backlinks from the restored content.
    let mention_ids = collect_page_mention_ids(&updated.content);
    resync_page_links(state, page_id, user_id, &mention_ids).await?;

    Ok(updated.into())
}

// ── Templates ──────────────────────────────────────────────────────────────────

/// Create a new page by deep-copying a template page's content.
///
/// Copies `content`, `icon`, and `cover_url` from the template into a new page
/// owned by `user_id`. The template must be owned by the same user.
///
/// # Errors
///
/// - [`AppError::NotFound`] — template or target space not found / not owned.
/// - [`AppError::Db`] — database failure.
pub async fn create_from_template(
    state: &AppState,
    user_id: Uuid,
    req: CreateFromTemplateRequest,
) -> AppResult<PageResponse> {
    // Fetch the template (must be owned by same user and be a template).
    let template = sqlx::query_as!(
        Page,
        r#"
        SELECT
            id, space_id, parent_id, user_id, title, kind, status, position,
            content    AS "content: serde_json::Value",
            excalidraw AS "excalidraw: serde_json::Value",
            created_at, updated_at, published_at,
            icon, cover_url, is_public, public_slug, is_template
        FROM pages
        WHERE id = $1 AND user_id = $2 AND is_template = true
        "#,
        req.template_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

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
        .unwrap_or(template.title.as_str())
        .to_owned();

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
        INSERT INTO pages
            (space_id, parent_id, user_id, title, kind, content, position, icon, cover_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING
            id, space_id, parent_id, user_id, title, kind, status, position,
            content    AS "content: serde_json::Value",
            excalidraw AS "excalidraw: serde_json::Value",
            created_at, updated_at, published_at,
            icon, cover_url, is_public, public_slug, is_template
        "#,
        req.space_id,
        req.parent_id as Option<Uuid>,
        user_id,
        title,
        template.kind,
        template.content,
        next_position,
        template.icon,
        template.cover_url,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(page.into())
}

// ── Backlinks ──────────────────────────────────────────────────────────────────

/// Return all pages that mention `page_id` (inbound backlinks).
///
/// Each entry is the source page that contains a `@page` mention pointing here.
///
/// # Errors
///
/// - [`AppError::NotFound`] — page not found or not owned.
/// - [`AppError::Db`] — database failure.
pub async fn list_backlinks(
    state: &AppState,
    user_id: Uuid,
    page_id: Uuid,
) -> AppResult<Vec<PageBacklink>> {
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
        PageBacklink,
        r#"
        SELECT pl.source_page_id, p.title, p.space_id
        FROM page_links pl
        JOIN pages p ON p.id = pl.source_page_id
        WHERE pl.target_page_id = $1
        ORDER BY p.title ASC
        "#,
        page_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

/// Return all pages that `page_id` mentions (outbound links).
///
/// # Errors
///
/// - [`AppError::NotFound`] — page not found or not owned.
/// - [`AppError::Db`] — database failure.
pub async fn list_outbound_links(
    state: &AppState,
    user_id: Uuid,
    page_id: Uuid,
) -> AppResult<Vec<PageLinkRef>> {
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
        PageLinkRef,
        r#"
        SELECT pl.target_page_id, p.title, p.space_id
        FROM page_links pl
        JOIN pages p ON p.id = pl.target_page_id
        WHERE pl.source_page_id = $1
        ORDER BY p.title ASC
        "#,
        page_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
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

    write_upload(uploads_dir, original_filename, bytes).await
}

// ── Shared upload helper ───────────────────────────────────────────────────────

/// Sanitize a filename, write bytes to `uploads_dir`, and return `/uploads/<stored-name>`.
async fn write_upload(
    uploads_dir: &std::path::Path,
    original_filename: String,
    bytes: bytes::Bytes,
) -> AppResult<String> {
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
        "file".to_owned()
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
            "failed to write file {}: {e}",
            full_path.display()
        ))
    })?;

    Ok(format!("/uploads/{stored_name}"))
}
