//! Axum request handlers for the `public_docs` module.
//!
//! **No `AuthUser` extractor is used here.** All handlers are intentionally
//! unauthenticated; visibility is enforced by the `is_public = true` SQL
//! predicate inside [`service`].
//!
//! # Routes
//!
//! | Method | Path                       | Handler                  |
//! |--------|----------------------------|--------------------------|
//! | GET    | `/pages/:slug`             | [`get_public_page`]       |
//! | GET    | `/pages/:slug/tree`        | [`get_public_page_tree`]  |

use axum::{
    extract::{Path, State},
    Json,
};

use crate::shared::{error::AppResult, state::AppState};

use super::{
    models::{PublicPageResponse, PublicPageTreeNode},
    service,
};

// ── GET /pages/:slug ──────────────────────────────────────────────────────────

/// Fetch a single public page by its URL slug.
///
/// Returns `404` when the slug does not match any page or the page is not
/// public (`is_public = false`).
///
/// # Response
///
/// [`PublicPageResponse`] — page metadata + TipTap content + direct public
/// children (id, title, icon, public_slug).
pub async fn get_public_page(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> AppResult<Json<PublicPageResponse>> {
    let page = service::get_public_page(&state, &slug).await?;
    Ok(Json(page))
}

// ── GET /pages/:slug/tree ─────────────────────────────────────────────────────

/// Return the full public descendant subtree for a page identified by its slug.
///
/// Useful for rendering a site-navigation sidebar. Only pages with
/// `is_public = true` are included; a non-public intermediate page severs
/// its entire subtree from the response.
///
/// Returns `404` when the slug does not exist or the root page is not public.
///
/// # Response
///
/// `Vec<`[`PublicPageTreeNode`]`>` — recursive tree of public descendants
/// (id, title, icon, public_slug, children[]).
pub async fn get_public_page_tree(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> AppResult<Json<Vec<PublicPageTreeNode>>> {
    let tree = service::get_public_page_tree(&state, &slug).await?;
    Ok(Json(tree))
}
