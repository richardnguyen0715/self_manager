//! Business logic for the `mention` module. Runtime `sqlx::query*` only. Every
//! query is scoped to `user_id`; foreign or missing ids are never revealed.

use std::collections::HashSet;

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::{
    modules::retro::{links, models::TARGET_TYPES},
    shared::{
        error::{AppError, AppResult},
        state::AppState,
    },
};

use super::models::{
    Backlink, BacklinksQuery, ResolveQuery, ResolvedRef, SearchHit, SearchQuery, SyncRequest,
    SyncResult, DEFAULT_SEARCH_LIMIT, MAX_RESOLVE_REFS, MAX_SEARCH_LIMIT, MAX_SYNC_TARGETS,
    SEARCH_TYPES, SOURCE_TYPES,
};

// ── Per-type search SQL ───────────────────────────────────────────────────────
//
// Each query selects `(id, title, subtitle, href)` and takes:
//   $1 user_id, $2 ILIKE pattern (NULL = recents only), $3 limit.
// Results are ordered by most recently updated.

fn search_sql(kind: &str) -> &'static str {
    match kind {
        "work_item" => {
            "SELECT wi.id, wi.title, \
                 concat_ws(' · ', \
                     CASE WHEN wi.seq_id IS NOT NULL \
                          THEN COALESCE(p.key, 'WI') || '-' || wi.seq_id::text END, \
                     wi.status::text) AS subtitle, \
                 '/work-items/' || wi.id::text AS href \
             FROM work_items wi LEFT JOIN projects p ON p.id = wi.project_id \
             WHERE wi.user_id = $1 AND wi.deleted_at IS NULL \
               AND ($2::text IS NULL OR wi.title ILIKE $2 \
                    OR (COALESCE(p.key, 'WI') || '-' || wi.seq_id::text) ILIKE $2) \
             ORDER BY wi.updated_at DESC LIMIT $3"
        }
        "doc" => {
            "SELECT pg.id, pg.title, NULL::text AS subtitle, \
                 '/docs/' || pg.space_id::text || '/' || pg.id::text AS href \
             FROM pages pg \
             WHERE pg.user_id = $1 AND ($2::text IS NULL OR pg.title ILIKE $2) \
             ORDER BY pg.updated_at DESC LIMIT $3"
        }
        "sprint" => {
            "SELECT s.id, s.name AS title, s.status::text AS subtitle, \
                 '/sprints/' || s.id::text AS href \
             FROM sprints s \
             WHERE s.user_id = $1 AND ($2::text IS NULL OR s.name ILIKE $2) \
             ORDER BY s.updated_at DESC LIMIT $3"
        }
        "project" => {
            "SELECT pr.id, pr.name AS title, pr.status::text AS subtitle, \
                 '/projects' AS href \
             FROM projects pr \
             WHERE pr.user_id = $1 AND pr.deleted_at IS NULL \
               AND ($2::text IS NULL OR pr.name ILIKE $2) \
             ORDER BY pr.updated_at DESC LIMIT $3"
        }
        "epic" => {
            "SELECT e.id, e.title, e.status::text AS subtitle, '/goals' AS href \
             FROM epics e \
             WHERE e.user_id = $1 AND ($2::text IS NULL OR e.title ILIKE $2) \
             ORDER BY e.updated_at DESC LIMIT $3"
        }
        "initiative" => {
            "SELECT i.id, i.title, i.status::text AS subtitle, '/goals' AS href \
             FROM initiatives i \
             WHERE i.user_id = $1 AND ($2::text IS NULL OR i.title ILIKE $2) \
             ORDER BY i.updated_at DESC LIMIT $3"
        }
        "goal" => {
            "SELECT g.id, g.title, g.status::text AS subtitle, '/goals' AS href \
             FROM goals g \
             WHERE g.user_id = $1 AND ($2::text IS NULL OR g.title ILIKE $2) \
             ORDER BY g.updated_at DESC LIMIT $3"
        }
        "habit" => {
            "SELECT h.id, h.name AS title, h.habit_type::text AS subtitle, '/habits' AS href \
             FROM habits h \
             WHERE h.user_id = $1 AND ($2::text IS NULL OR h.name ILIKE $2) \
             ORDER BY h.updated_at DESC LIMIT $3"
        }
        // "retro" (validated by the caller).
        _ => {
            "SELECT r.id, r.title, r.kind AS subtitle, '/retros/' || r.id::text AS href \
             FROM retros r \
             WHERE r.user_id = $1 AND ($2::text IS NULL OR r.title ILIKE $2) \
             ORDER BY r.updated_at DESC LIMIT $3"
        }
    }
}

#[derive(sqlx::FromRow)]
struct HitRow {
    id: Uuid,
    title: Option<String>,
    subtitle: Option<String>,
    href: Option<String>,
}

/// `%q%` with LIKE metacharacters escaped (Postgres ILIKE escape is `\`).
fn like_pattern(q: &str) -> String {
    let escaped = q
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_");
    format!("%{escaped}%")
}

fn parse_types(raw: Option<&str>) -> AppResult<Vec<&'static str>> {
    let Some(raw) = raw else {
        return Ok(SEARCH_TYPES.to_vec());
    };
    let wanted: Vec<&str> = raw
        .split(',')
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .collect();
    for t in &wanted {
        if !SEARCH_TYPES.contains(t) {
            return Err(AppError::Validation(format!(
                "types must be among: {}",
                SEARCH_TYPES.join(", ")
            )));
        }
    }
    // Canonical display order, regardless of the order requested.
    Ok(SEARCH_TYPES
        .iter()
        .copied()
        .filter(|t| wanted.contains(t))
        .collect())
}

// ── Search ────────────────────────────────────────────────────────────────────

pub async fn search(
    state: &AppState,
    user_id: Uuid,
    query: SearchQuery,
) -> AppResult<Vec<SearchHit>> {
    let types = parse_types(query.types.as_deref())?;
    let limit = query
        .limit
        .unwrap_or(DEFAULT_SEARCH_LIMIT)
        .clamp(1, MAX_SEARCH_LIMIT);
    let pattern = query
        .q
        .as_deref()
        .map(str::trim)
        .filter(|q| !q.is_empty())
        .map(like_pattern);

    let mut out = Vec::new();
    for kind in types {
        let rows: Vec<HitRow> = sqlx::query_as(search_sql(kind))
            .bind(user_id)
            .bind(pattern.as_deref())
            .bind(limit)
            .fetch_all(&state.db)
            .await?;
        out.extend(rows.into_iter().map(|r| SearchHit {
            kind: kind.to_string(),
            id: r.id,
            title: r.title,
            subtitle: r.subtitle,
            href: r.href,
        }));
    }
    Ok(out)
}

// ── Resolve ───────────────────────────────────────────────────────────────────

/// Parses `type:uuid,type:uuid`. Types must be valid mention targets.
fn parse_refs(raw: &str) -> AppResult<Vec<(String, Uuid)>> {
    let mut refs = Vec::new();
    for part in raw.split(',').map(str::trim).filter(|p| !p.is_empty()) {
        let (kind, id) = part
            .split_once(':')
            .ok_or_else(|| AppError::Validation(format!("invalid ref '{part}'")))?;
        if !TARGET_TYPES.contains(&kind) {
            return Err(AppError::Validation(format!(
                "ref type must be among: {}",
                TARGET_TYPES.join(", ")
            )));
        }
        let id = Uuid::parse_str(id)
            .map_err(|_| AppError::Validation(format!("invalid ref id in '{part}'")))?;
        refs.push((kind.to_string(), id));
    }
    if refs.len() > MAX_RESOLVE_REFS {
        return Err(AppError::Validation(format!(
            "at most {MAX_RESOLVE_REFS} refs per request"
        )));
    }
    Ok(refs)
}

pub async fn resolve(
    state: &AppState,
    user_id: Uuid,
    query: ResolveQuery,
) -> AppResult<Vec<ResolvedRef>> {
    let raw = query
        .refs
        .ok_or_else(|| AppError::Validation("refs is required".to_string()))?;
    let refs = parse_refs(&raw)?;

    let mut out = Vec::with_capacity(refs.len());
    for (kind, id) in refs {
        let found = links::lookup(state, user_id, &kind, id).await?;
        let (title, subtitle, href, exists) = match found {
            Some(f) => (f.title, f.subtitle, f.href, true),
            None => (None, None, None, false),
        };
        out.push(ResolvedRef {
            kind,
            id,
            title,
            subtitle,
            href,
            exists,
        });
    }
    Ok(out)
}

// ── Sync ──────────────────────────────────────────────────────────────────────

/// Whether `source_type/source_id` exists and belongs to `user_id`.
async fn source_owned(
    state: &AppState,
    user_id: Uuid,
    source_type: &str,
    source_id: Uuid,
) -> AppResult<bool> {
    let sql = match source_type {
        "work_item" => {
            "SELECT EXISTS(SELECT 1 FROM work_items \
             WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL)"
        }
        "doc" => "SELECT EXISTS(SELECT 1 FROM pages WHERE id = $1 AND user_id = $2)",
        _ => "SELECT EXISTS(SELECT 1 FROM retros WHERE id = $1 AND user_id = $2)",
    };
    let owned: bool = sqlx::query_scalar(sql)
        .bind(source_id)
        .bind(user_id)
        .fetch_one(&state.db)
        .await?;
    Ok(owned)
}

/// Replaces the mention set of one source in a single transaction.
///
/// Invalid targets (unknown type, malformed id, foreign or missing object,
/// self-mention) are dropped silently. A source that does not belong to the
/// caller stores nothing; its own stale rows (if any) are cleared, so the
/// call still succeeds with `count: 0`.
pub async fn sync(
    state: &AppState,
    user_id: Uuid,
    req: SyncRequest,
) -> AppResult<SyncResult> {
    if !SOURCE_TYPES.contains(&req.source_type.as_str()) {
        return Err(AppError::Validation(format!(
            "source_type must be one of: {}",
            SOURCE_TYPES.join(", ")
        )));
    }
    if req.targets.len() > MAX_SYNC_TARGETS {
        return Err(AppError::Validation(format!(
            "at most {MAX_SYNC_TARGETS} targets per sync"
        )));
    }

    let owned = source_owned(state, user_id, &req.source_type, req.source_id).await?;

    let mut valid: Vec<(String, Uuid)> = Vec::new();
    if owned {
        let mut seen: HashSet<(String, Uuid)> = HashSet::new();
        for t in req.targets {
            let Ok(id) = Uuid::parse_str(&t.id) else {
                continue;
            };
            if !TARGET_TYPES.contains(&t.target_type.as_str()) {
                continue;
            }
            if t.target_type == req.source_type && id == req.source_id {
                continue;
            }
            if !seen.insert((t.target_type.clone(), id)) {
                continue;
            }
            if links::lookup(state, user_id, &t.target_type, id)
                .await?
                .is_some()
            {
                valid.push((t.target_type, id));
            }
        }
    }

    let (target_types, target_ids): (Vec<String>, Vec<Uuid>) = valid.iter().cloned().unzip();

    let mut tx = state.db.begin().await?;
    sqlx::query(
        "DELETE FROM mentions \
         WHERE user_id = $1 AND source_type = $2 AND source_id = $3",
    )
    .bind(user_id)
    .bind(&req.source_type)
    .bind(req.source_id)
    .execute(&mut *tx)
    .await?;

    if !valid.is_empty() {
        sqlx::query(
            "INSERT INTO mentions (user_id, source_type, source_id, target_type, target_id) \
             SELECT $1, $2, $3, t.tt, t.ti \
             FROM UNNEST($4::text[], $5::uuid[]) AS t(tt, ti) \
             ON CONFLICT (source_type, source_id, target_type, target_id) DO NOTHING",
        )
        .bind(user_id)
        .bind(&req.source_type)
        .bind(req.source_id)
        .bind(&target_types)
        .bind(&target_ids)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;

    Ok(SyncResult { count: valid.len() })
}

// ── Backlinks ─────────────────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct BacklinkRow {
    source_type: String,
    source_id: Uuid,
    created_at: DateTime<Utc>,
}

/// "Mentioned in": every live source that mentions the target, newest first.
/// Dangling sources (deleted or foreign rows) are skipped.
pub async fn backlinks(
    state: &AppState,
    user_id: Uuid,
    query: BacklinksQuery,
) -> AppResult<Vec<Backlink>> {
    if !TARGET_TYPES.contains(&query.target_type.as_str()) {
        return Err(AppError::Validation(format!(
            "target_type must be one of: {}",
            TARGET_TYPES.join(", ")
        )));
    }

    let rows: Vec<BacklinkRow> = sqlx::query_as(
        "SELECT source_type, source_id, created_at FROM mentions \
         WHERE user_id = $1 AND target_type = $2 AND target_id = $3 \
         ORDER BY created_at DESC, id",
    )
    .bind(user_id)
    .bind(&query.target_type)
    .bind(query.target_id)
    .fetch_all(&state.db)
    .await?;

    let mut out = Vec::with_capacity(rows.len());
    for row in rows {
        let Some(found) =
            links::lookup(state, user_id, &row.source_type, row.source_id).await?
        else {
            continue;
        };
        out.push(Backlink {
            source_type: row.source_type,
            source_id: row.source_id,
            title: found.title,
            subtitle: found.subtitle,
            href: found.href,
            created_at: row.created_at,
        });
    }
    Ok(out)
}
