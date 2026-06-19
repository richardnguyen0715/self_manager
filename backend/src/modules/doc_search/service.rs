//! Business logic for the `doc_search` module.
//!
//! Implements `GET /api/docs/search` — unified search over pages (title +
//! content jsonb text) and databases (title + row values jsonb text), scoped
//! to the authenticated user.
//!
//! ## Page search strategy
//!
//! Two complementary strategies are combined with `UNION`:
//!
//! 1. **Title similarity** — pg_trgm `similarity(title, q) > 0.1`. Snippet is
//!    `''` (empty string).
//! 2. **Content text scan** — `content::text ILIKE '%<q>%'` on the jsonb blob
//!    serialised to text. A 160-character snippet is extracted with
//!    `SUBSTRING(content::text FROM 1 FOR 160)`. Template pages
//!    (`is_template = true`) are excluded from all results.
//!
//! ## Database search strategy
//!
//! Two strategies combined with `UNION`:
//!
//! 1. **Title similarity** — `similarity(title, q) > 0.1`. `matched_rows = 0`.
//! 2. **Row values scan** — COUNT of rows where `values::text ILIKE '%<q>%'`.
//!    Only databases with at least one matching row are included.
//!
//! ## SQLx notes
//!
//! - `icon` is a plain `text` nullable column added in migration 0008.
//! - `content` is `jsonb`; cast to `::text` inline for the ILIKE scan and
//!   snippet extraction.  We never return raw jsonb from these queries.
//! - `matched_rows` is `COUNT(*)` → `bigint` (`i64`); `FromRow` maps directly.
//! - `space_id` optional filter uses the `($n::uuid IS NULL OR col = $n)` idiom.
//! - `q` and `ilike_pattern` are two separate binds so the same query string
//!   can serve both the similarity call and the ILIKE pattern.

use uuid::Uuid;

use crate::shared::{
    error::AppResult,
    state::AppState,
};

use super::models::{DatabaseSearchHit, DocSearchResponse, PageSearchHit};

/// Maximum results returned per category.
const MAX_HITS: i64 = 50;

// ── public API ─────────────────────────────────────────────────────────────────

/// Search pages and databases owned by `user_id` for the query string `q`.
///
/// Both title similarity (pg_trgm) and full-text ILIKE on the serialised jsonb
/// are tried for each category; results are de-duplicated by id in the UNION.
///
/// Returns an empty `{ pages: [], databases: [] }` when `q` is blank.
///
/// # Errors
///
/// Returns [`crate::shared::error::AppError::Db`] on database failure.
pub async fn search_docs(
    state: &AppState,
    user_id: Uuid,
    q: &str,
    space_id: Option<Uuid>,
) -> AppResult<DocSearchResponse> {
    // Short-circuit: blank query always returns nothing.
    if q.trim().is_empty() {
        return Ok(DocSearchResponse {
            pages: Vec::new(),
            databases: Vec::new(),
        });
    }

    let pages = search_pages(state, user_id, q, space_id).await?;
    let databases = search_databases(state, user_id, q, space_id).await?;

    Ok(DocSearchResponse { pages, databases })
}

// ── private helpers ────────────────────────────────────────────────────────────

/// Search pages by title similarity (pg_trgm) or content text (ILIKE).
///
/// Template pages (`is_template = true`) are always excluded.
async fn search_pages(
    state: &AppState,
    user_id: Uuid,
    q: &str,
    space_id: Option<Uuid>,
) -> AppResult<Vec<PageSearchHit>> {
    // ILIKE pattern built once; both the pattern and the raw query are bound
    // separately so each arm can use the appropriate operator.
    let ilike_pattern = format!("%{q}%");

    // The UNION de-duplicates rows by id (set semantics). Both arms filter by
    // user_id and the optional space_id. Template pages are excluded globally.
    //
    // `icon` was added in migration 0008; pre-existing rows have `icon = NULL`
    // which is legal for the nullable column.
    //
    // `snippet` is aliased as a literal string in arm 1 and a SUBSTRING in
    // arm 2 so the outer SELECT sees a consistent column name.
    let rows = sqlx::query_as!(
        PageSearchHit,
        r#"
        SELECT
            id            AS "id!",
            space_id      AS "space_id!",
            title         AS "title!",
            icon,
            snippet       AS "snippet!"
        FROM (
            -- Arm 1: title similarity (pg_trgm)
            SELECT
                id,
                space_id,
                title,
                icon,
                ''::text AS snippet
            FROM pages
            WHERE user_id     = $1
              AND is_template = false
              AND ($2::uuid IS NULL OR space_id = $2)
              AND similarity(title, $3) > 0.1

            UNION

            -- Arm 2: content jsonb text ILIKE
            SELECT
                id,
                space_id,
                title,
                icon,
                COALESCE(SUBSTRING(content::text FROM 1 FOR 160), '')::text AS snippet
            FROM pages
            WHERE user_id     = $1
              AND is_template = false
              AND ($2::uuid IS NULL OR space_id = $2)
              AND content::text ILIKE $4
        ) results
        ORDER BY title
        LIMIT $5
        "#,
        user_id,                  // $1
        space_id as Option<Uuid>, // $2
        q,                        // $3  pg_trgm similarity operand
        ilike_pattern,            // $4  ILIKE pattern
        MAX_HITS,                 // $5
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

/// Search databases by title similarity (pg_trgm) or row values text (ILIKE).
async fn search_databases(
    state: &AppState,
    user_id: Uuid,
    q: &str,
    space_id: Option<Uuid>,
) -> AppResult<Vec<DatabaseSearchHit>> {
    let ilike_pattern = format!("%{q}%");

    let rows = sqlx::query_as!(
        DatabaseSearchHit,
        r#"
        SELECT
            id            AS "id!",
            space_id      AS "space_id!",
            title         AS "title!",
            icon,
            matched_rows  AS "matched_rows!"
        FROM (
            -- Arm 1: title similarity (pg_trgm)
            SELECT
                d.id,
                d.space_id,
                d.title,
                d.icon,
                0::bigint AS matched_rows
            FROM databases d
            WHERE d.user_id = $1
              AND ($2::uuid IS NULL OR d.space_id = $2)
              AND similarity(d.title, $3) > 0.1

            UNION

            -- Arm 2: databases with ≥1 row whose values text contains the query
            SELECT
                d.id,
                d.space_id,
                d.title,
                d.icon,
                COUNT(r.id) AS matched_rows
            FROM databases d
            JOIN database_rows r ON r.database_id = d.id
            WHERE d.user_id = $1
              AND ($2::uuid IS NULL OR d.space_id = $2)
              AND r.values::text ILIKE $4
            GROUP BY d.id, d.space_id, d.title, d.icon
            HAVING COUNT(r.id) > 0
        ) results
        ORDER BY title
        LIMIT $5
        "#,
        user_id,                  // $1
        space_id as Option<Uuid>, // $2
        q,                        // $3
        ilike_pattern,            // $4
        MAX_HITS,                 // $5
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}
