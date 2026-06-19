//! Business logic for the `public_docs` module.
//!
//! All queries are **unauthenticated**: there is no `user_id` / `AuthUser`
//! parameter. Visibility is governed solely by `is_public = true` in SQL.
//! Private or draft pages are never returned.
//!
//! # SQL conventions (matching the rest of the codebase)
//!
//! - `jsonb` columns → `col AS "col: serde_json::Value"`
//! - nullable `text` columns → returned as `Option<String>` by SQLx automatically
//! - `is_public` is `boolean NOT NULL` → no cast required; plain `bool` bind

use uuid::Uuid;

use crate::shared::{error::AppError, error::AppResult, state::AppState};

use super::models::{
    PublicPageFlatRow, PublicPageRef, PublicPageResponse, PublicPageRow, PublicPageTreeNode,
};

// ── helpers ────────────────────────────────────────────────────────────────────

/// Recursively assemble [`PublicPageFlatRow`] records into a
/// [`PublicPageTreeNode`] forest, depth-capped to prevent unbounded recursion
/// on data with cyclic parent references.
fn build_tree(rows: &[PublicPageFlatRow], parent_id: Option<Uuid>, depth: u16) -> Vec<PublicPageTreeNode> {
    if depth > 64 {
        return Vec::new();
    }
    let mut nodes: Vec<PublicPageTreeNode> = rows
        .iter()
        .filter(|r| r.parent_id == parent_id)
        .collect::<Vec<_>>()
        // sort by position, then stable by id so the tree is deterministic
        .into_iter()
        .map(|r| PublicPageTreeNode {
            id: r.id,
            title: r.title.clone(),
            icon: r.icon.clone(),
            public_slug: r.public_slug.clone(),
            children: build_tree(rows, Some(r.id), depth + 1),
        })
        .collect();

    // Sort by position ascending for deterministic navigation order.
    nodes.sort_by_key(|n| {
        rows.iter()
            .find(|r| r.id == n.id)
            .map_or(0, |r| r.position)
    });
    nodes
}

// ── Public page queries ────────────────────────────────────────────────────────

/// Fetch a single public page by its `public_slug`.
///
/// Returns [`AppError::NotFound`] when:
/// - No page with the given slug exists.
/// - The page exists but `is_public = false`.
///
/// On success, also fetches direct children that are themselves `is_public = true`
/// and returns them as `children` in the response.
pub async fn get_public_page(state: &AppState, slug: &str) -> AppResult<PublicPageResponse> {
    // Fetch the page — must be public.
    let page = sqlx::query_as!(
        PublicPageRow,
        r#"
        SELECT
            id,
            title,
            icon,
            cover_url,
            content AS "content: serde_json::Value",
            updated_at
        FROM pages
        WHERE public_slug = $1
          AND is_public   = true
          AND status      = 'published'
          AND is_template = false
        "#,
        slug,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // Fetch direct public children.
    let child_rows = sqlx::query_as!(
        PublicPageFlatRow,
        r#"
        SELECT id, parent_id, title, icon, public_slug, position
        FROM pages
        WHERE parent_id = $1
          AND is_public = true
          AND status = 'published'
          AND is_template = false
        ORDER BY position ASC, created_at ASC
        "#,
        page.id,
    )
    .fetch_all(&state.db)
    .await?;

    let children: Vec<PublicPageRef> = child_rows
        .into_iter()
        .map(|r| PublicPageRef {
            id: r.id,
            title: r.title,
            icon: r.icon,
            public_slug: r.public_slug,
        })
        .collect();

    Ok(PublicPageResponse {
        id: page.id,
        title: page.title,
        icon: page.icon,
        cover_url: page.cover_url,
        content: page.content,
        updated_at: page.updated_at,
        children,
    })
}

/// Return the full public descendant subtree for a page identified by `slug`.
///
/// Only pages where `is_public = true` participate in the tree (non-public
/// descendants are excluded entirely — they act as a visibility cut-off for
/// their own subtrees too).
///
/// Returns [`AppError::NotFound`] when the root page is not public.
pub async fn get_public_page_tree(
    state: &AppState,
    slug: &str,
) -> AppResult<Vec<PublicPageTreeNode>> {
    // Resolve the root page id first, enforcing is_public.
    let root_id: Uuid = sqlx::query_scalar!(
        r#"
        SELECT id
        FROM pages
        WHERE public_slug = $1
          AND is_public   = true
          AND status      = 'published'
          AND is_template = false
        "#,
        slug,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // Fetch every public descendant in the subtree using a recursive CTE.
    // We do NOT recurse through non-public pages: the CTE joins only on
    // `is_public = true` children, so a private page severs its entire subtree.
    let flat = sqlx::query_as!(
        PublicPageFlatRow,
        r#"
        WITH RECURSIVE subtree AS (
            -- Anchor: direct public children of the root
            SELECT id, parent_id, title, icon, public_slug, position
            FROM pages
            WHERE parent_id = $1
              AND is_public  = true
              AND status = 'published'
              AND is_template = false

            UNION ALL

            -- Recursive step: public children of already-selected nodes
            SELECT p.id, p.parent_id, p.title, p.icon, p.public_slug, p.position
            FROM pages p
            JOIN subtree s ON p.parent_id = s.id
            WHERE p.is_public = true
              AND p.status = 'published'
              AND p.is_template = false
        )
        SELECT
            id            AS "id!",
            parent_id,
            title         AS "title!",
            icon,
            public_slug,
            position      AS "position!"
        FROM subtree
        ORDER BY position ASC
        "#,
        root_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(build_tree(&flat, Some(root_id), 0))
}
