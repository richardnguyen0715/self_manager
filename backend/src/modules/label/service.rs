//! Business logic for the `label` module.
//!
//! Uses runtime `sqlx::query*` (no compile-time macros). Every query is scoped
//! to `user_id`. Renames and deletes rewrite `work_items.labels` for the same
//! user (and, for project-scoped labels, only that project's work items) in the
//! same transaction as the label change.

use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    state::AppState,
};

use super::models::{CreateLabelRequest, Label, UpdateLabelRequest, MAX_NAME_LEN};

const SELECT_COLS: &str = "id, user_id, project_id, name, color, created_at";

/// Postgres SQLSTATE for unique_violation.
const UNIQUE_VIOLATION: &str = "23505";

// ── Validation helpers ──────────────────────────────────────────────────────

fn clean_name(raw: &str) -> AppResult<String> {
    let name = raw.trim();
    if name.is_empty() {
        return Err(AppError::Validation("name must not be empty".into()));
    }
    if name.chars().count() > MAX_NAME_LEN {
        return Err(AppError::Validation(format!(
            "name must not exceed {MAX_NAME_LEN} characters"
        )));
    }
    Ok(name.to_string())
}

fn clean_color(raw: &str) -> AppResult<String> {
    let c = raw.trim();
    let valid = c.len() == 7
        && c.starts_with('#')
        && c[1..].chars().all(|ch| ch.is_ascii_hexdigit());
    if !valid {
        return Err(AppError::Validation(
            "color must be a hex colour like #3b82f6".into(),
        ));
    }
    Ok(c.to_ascii_lowercase())
}

/// Maps a unique-index violation to a 409 with a friendly message.
fn map_unique(err: sqlx::Error) -> AppError {
    if let sqlx::Error::Database(ref db) = err {
        if db.code().as_deref() == Some(UNIQUE_VIOLATION) {
            return AppError::Conflict("a label with that name already exists".into());
        }
    }
    AppError::Db(err)
}

// ── Read ──────────────────────────────────────────────────────────────────────

pub async fn list(
    state: &AppState,
    user_id: Uuid,
    project_id: Option<Uuid>,
) -> AppResult<Vec<Label>> {
    let rows = match project_id {
        Some(pid) => {
            let sql = format!(
                "SELECT {SELECT_COLS} FROM labels \
                 WHERE user_id = $1 AND (project_id = $2 OR project_id IS NULL) \
                 ORDER BY lower(name) ASC"
            );
            sqlx::query_as::<_, Label>(&sql)
                .bind(user_id)
                .bind(pid)
                .fetch_all(&state.db)
                .await?
        }
        None => {
            let sql = format!(
                "SELECT {SELECT_COLS} FROM labels WHERE user_id = $1 ORDER BY lower(name) ASC"
            );
            sqlx::query_as::<_, Label>(&sql)
                .bind(user_id)
                .fetch_all(&state.db)
                .await?
        }
    };
    Ok(rows)
}

async fn get(state: &AppState, user_id: Uuid, id: Uuid) -> AppResult<Label> {
    let sql = format!("SELECT {SELECT_COLS} FROM labels WHERE id = $1 AND user_id = $2");
    sqlx::query_as::<_, Label>(&sql)
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)
}

// ── Write ──────────────────────────────────────────────────────────────────────

pub async fn create(
    state: &AppState,
    user_id: Uuid,
    req: CreateLabelRequest,
) -> AppResult<Label> {
    let name = clean_name(&req.name)?;
    let color = match req.color.as_deref() {
        Some(c) => clean_color(c)?,
        None => "#64748b".to_string(),
    };

    // A project-scoped label must reference a project the user owns.
    if let Some(pid) = req.project_id {
        let owned: Option<(Uuid,)> =
            sqlx::query_as("SELECT id FROM projects WHERE id = $1 AND user_id = $2")
                .bind(pid)
                .bind(user_id)
                .fetch_optional(&state.db)
                .await?;
        if owned.is_none() {
            return Err(AppError::NotFound);
        }
    }

    let sql = format!(
        "INSERT INTO labels (user_id, project_id, name, color) \
         VALUES ($1, $2, $3, $4) \
         RETURNING {SELECT_COLS}"
    );
    sqlx::query_as::<_, Label>(&sql)
        .bind(user_id)
        .bind(req.project_id)
        .bind(name)
        .bind(color)
        .fetch_one(&state.db)
        .await
        .map_err(map_unique)
}

pub async fn update(
    state: &AppState,
    user_id: Uuid,
    id: Uuid,
    req: UpdateLabelRequest,
) -> AppResult<Label> {
    let existing = get(state, user_id, id).await?;

    let new_name = match req.name.as_deref() {
        Some(n) => clean_name(n)?,
        None => existing.name.clone(),
    };
    let new_color = match req.color.as_deref() {
        Some(c) => clean_color(c)?,
        None => existing.color.clone(),
    };
    let renamed = new_name != existing.name;

    let mut tx = state.db.begin().await?;

    let updated = sqlx::query_as::<_, Label>(&format!(
        "UPDATE labels SET name = $1, color = $2 \
         WHERE id = $3 AND user_id = $4 \
         RETURNING {SELECT_COLS}"
    ))
    .bind(&new_name)
    .bind(&new_color)
    .bind(id)
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(map_unique)?
    .ok_or(AppError::NotFound)?;

    if renamed {
        // Rewrite the name inside every work item of this user that carries it.
        sqlx::query(
            "UPDATE work_items \
             SET labels = array_replace(labels, $1, $2) \
             WHERE user_id = $3 AND $1 = ANY (labels) \
               AND ($4::uuid IS NULL OR project_id = $4)",
        )
        .bind(&existing.name)
        .bind(&new_name)
        .bind(user_id)
        .bind(existing.project_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(updated)
}

pub async fn delete(state: &AppState, user_id: Uuid, id: Uuid) -> AppResult<()> {
    let existing = get(state, user_id, id).await?;

    let mut tx = state.db.begin().await?;

    // Strip the name from work items first, then drop the label row.
    sqlx::query(
        "UPDATE work_items \
         SET labels = array_remove(labels, $1) \
         WHERE user_id = $2 AND $1 = ANY (labels) \
           AND ($3::uuid IS NULL OR project_id = $3)",
    )
    .bind(&existing.name)
    .bind(user_id)
    .bind(existing.project_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query("DELETE FROM labels WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(())
}
