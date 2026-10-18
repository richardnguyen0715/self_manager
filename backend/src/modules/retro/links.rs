//! Polymorphic retro links: target validation, title/href resolution, CRUD
//! and backlinks. `retro_links.target_id` has no FK, so every target is
//! checked against its own table (and owner) here.

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    state::AppState,
};

use super::{
    models::{CreateLinkRequest, LinkResolved, RELATIONS, TARGET_TYPES},
    service,
};

/// Title / subtitle / href of a link target, as shown in the UI.
pub struct Lookup {
    pub title: Option<String>,
    pub subtitle: Option<String>,
    pub href: Option<String>,
}

/// Owner-checked lookup of a target row. `Ok(None)` when the row does not
/// exist or belongs to someone else (or is soft-deleted where applicable).
pub async fn lookup(
    state: &AppState,
    user_id: Uuid,
    target_type: &str,
    target_id: Uuid,
) -> AppResult<Option<Lookup>> {
    // (title, subtitle) per target type; `href` is derived below.
    let sql = match target_type {
        "work_item" => {
            "SELECT title, status::text FROM work_items \
             WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL"
        }
        "sprint" => "SELECT name, status::text FROM sprints WHERE id = $1 AND user_id = $2",
        "project" => {
            "SELECT name, status::text FROM projects \
             WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL"
        }
        "epic" => "SELECT title, status::text FROM epics WHERE id = $1 AND user_id = $2",
        "initiative" => "SELECT title, status::text FROM initiatives WHERE id = $1 AND user_id = $2",
        "goal" => "SELECT title, status::text FROM goals WHERE id = $1 AND user_id = $2",
        "habit" => "SELECT name, habit_type::text FROM habits WHERE id = $1 AND user_id = $2",
        "doc" => "SELECT title, NULL::text FROM pages WHERE id = $1 AND user_id = $2",
        "retro" => "SELECT title, kind FROM retros WHERE id = $1 AND user_id = $2",
        _ => return Ok(None),
    };

    let row: Option<(String, Option<String>)> = sqlx::query_as(sql)
        .bind(target_id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?;

    let Some((title, subtitle)) = row else {
        return Ok(None);
    };

    let href = match target_type {
        "work_item" => Some(format!("/work-items/{target_id}")),
        "sprint" => Some(format!("/sprints/{target_id}")),
        "project" => Some("/projects".to_string()),
        "epic" | "initiative" | "goal" => Some("/goals".to_string()),
        "habit" => Some("/habits".to_string()),
        "retro" => Some(format!("/retros/{target_id}")),
        "doc" => {
            let space: Option<Uuid> =
                sqlx::query_scalar("SELECT space_id FROM pages WHERE id = $1 AND user_id = $2")
                    .bind(target_id)
                    .bind(user_id)
                    .fetch_optional(&state.db)
                    .await?;
            space.map(|s| format!("/docs/{s}/{target_id}"))
        }
        _ => None,
    };

    // A "doc" subtitle is not meaningful; keep it empty.
    let subtitle = if target_type == "doc" { None } else { subtitle };

    Ok(Some(Lookup {
        title: Some(title),
        subtitle,
        href,
    }))
}

#[derive(sqlx::FromRow)]
struct LinkRow {
    id: Uuid,
    target_type: String,
    target_id: Uuid,
    relation: String,
    #[allow(dead_code)]
    created_at: DateTime<Utc>,
}

fn resolved(row: LinkRow, found: Option<Lookup>) -> LinkResolved {
    let (title, subtitle, href) = match found {
        Some(f) => (f.title, f.subtitle, f.href),
        None => (None, None, None),
    };
    LinkResolved {
        id: row.id,
        target_type: row.target_type,
        target_id: row.target_id,
        relation: row.relation,
        title,
        subtitle,
        href,
    }
}

/// All links of a retro, resolved. Dangling targets (deleted rows) come back
/// with null title/subtitle/href instead of failing the whole detail view.
pub async fn list_for_retro(
    state: &AppState,
    user_id: Uuid,
    retro_id: Uuid,
) -> AppResult<Vec<LinkResolved>> {
    let rows: Vec<LinkRow> = sqlx::query_as(
        "SELECT id, target_type, target_id, relation, created_at \
         FROM retro_links WHERE retro_id = $1 ORDER BY created_at, id",
    )
    .bind(retro_id)
    .fetch_all(&state.db)
    .await?;

    let mut out = Vec::with_capacity(rows.len());
    for row in rows {
        let found = lookup(state, user_id, &row.target_type, row.target_id).await?;
        out.push(resolved(row, found));
    }
    Ok(out)
}

/// Create a link. Returns `(link, created)`; a duplicate returns the existing
/// link with `created = false`.
pub async fn create(
    state: &AppState,
    user_id: Uuid,
    retro_id: Uuid,
    req: CreateLinkRequest,
) -> AppResult<(LinkResolved, bool)> {
    service::load_record(state, user_id, retro_id).await?;

    if !TARGET_TYPES.contains(&req.target_type.as_str()) {
        return Err(AppError::Validation(format!(
            "target_type must be one of: {}",
            TARGET_TYPES.join(", ")
        )));
    }
    let relation = req.relation.unwrap_or_else(|| "about".to_string());
    if !RELATIONS.contains(&relation.as_str()) {
        return Err(AppError::Validation(format!(
            "relation must be one of: {}",
            RELATIONS.join(", ")
        )));
    }
    if req.target_type == "retro" && req.target_id == retro_id {
        return Err(AppError::Validation(
            "a retro cannot link to itself".to_string(),
        ));
    }

    let found = lookup(state, user_id, &req.target_type, req.target_id)
        .await?
        .ok_or_else(|| AppError::NotFoundMsg("link target not found".to_string()))?;

    let inserted: Option<LinkRow> = sqlx::query_as(
        "INSERT INTO retro_links (retro_id, target_type, target_id, relation) \
         VALUES ($1, $2, $3, $4) \
         ON CONFLICT (retro_id, target_type, target_id, relation) DO NOTHING \
         RETURNING id, target_type, target_id, relation, created_at",
    )
    .bind(retro_id)
    .bind(&req.target_type)
    .bind(req.target_id)
    .bind(&relation)
    .fetch_optional(&state.db)
    .await?;

    if let Some(row) = inserted {
        return Ok((resolved(row, Some(found)), true));
    }

    let existing: LinkRow = sqlx::query_as(
        "SELECT id, target_type, target_id, relation, created_at FROM retro_links \
         WHERE retro_id = $1 AND target_type = $2 AND target_id = $3 AND relation = $4",
    )
    .bind(retro_id)
    .bind(&req.target_type)
    .bind(req.target_id)
    .bind(&relation)
    .fetch_one(&state.db)
    .await?;
    Ok((resolved(existing, Some(found)), false))
}

pub async fn delete(state: &AppState, user_id: Uuid, link_id: Uuid) -> AppResult<()> {
    let result = sqlx::query(
        "DELETE FROM retro_links l USING retros r \
         WHERE l.id = $1 AND r.id = l.retro_id AND r.user_id = $2",
    )
    .bind(link_id)
    .bind(user_id)
    .execute(&state.db)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}
