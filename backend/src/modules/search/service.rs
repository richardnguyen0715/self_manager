//! Business logic for cross-entity search.
//!
//! All queries use PostgreSQL's `pg_trgm` trigram indexes (created in
//! `migrations/0001_init.sql`) via `ILIKE`.  For tasks an explicit
//! `gin_trgm_ops` GIN index exists on `title`; projects and habits use
//! sequential ILIKE which will benefit from any future trigram indexes added
//! to those tables.
//!
//! The `search` module is **read-only** and never emits domain events.

use sqlx::PgPool;
use uuid::Uuid;

use crate::shared::error::AppResult;

use super::models::{EntityKind, HabitHit, ProjectHit, SearchResponse, TaskHit};

/// Execute a search across the requested entity kinds.
///
/// Each kind is queried independently so that per-kind limits are honoured and
/// the caller gets structured slices rather than a flat mixed list.
///
/// # Errors
///
/// Propagates [`crate::shared::error::AppError::Db`] on database failures.
pub async fn search(
    db: &PgPool,
    user_id: Uuid,
    query: &str,
    kinds: &[EntityKind],
    limit: i64,
) -> AppResult<SearchResponse> {
    // Wrap the user input as an ILIKE pattern once so every branch uses the
    // same escaped value.  We do NOT use `format!` to build SQL — all values
    // go through bind parameters.
    let pattern = format!("%{}%", query.replace('%', "\\%").replace('_', "\\_"));

    let mut tasks: Option<Vec<TaskHit>> = None;
    let mut projects: Option<Vec<ProjectHit>> = None;
    let mut habits: Option<Vec<HabitHit>> = None;

    for kind in kinds {
        match kind {
            EntityKind::Task => {
                let rows = sqlx::query_as!(
                    TaskHit,
                    r#"
                    SELECT
                        id,
                        title,
                        description,
                        priority::text   AS "priority!",
                        status::text     AS "status!",
                        due_date,
                        project_id,
                        created_at,
                        updated_at
                    FROM tasks
                    WHERE user_id = $1
                      AND (title ILIKE $2 OR description ILIKE $2)
                    ORDER BY
                        -- exact prefix first, then trigram rank via updated_at as tiebreak
                        (title ILIKE $3) DESC,
                        updated_at DESC
                    LIMIT $4
                    "#,
                    user_id,
                    pattern,
                    format!("{}%", query.replace('%', "\\%").replace('_', "\\_")),
                    limit,
                )
                .fetch_all(db)
                .await?;

                tasks = Some(rows);
            }

            EntityKind::Project => {
                let rows = sqlx::query_as!(
                    ProjectHit,
                    r#"
                    SELECT
                        id,
                        name,
                        description,
                        status::text  AS "status!",
                        deadline,
                        goal_id,
                        created_at,
                        updated_at
                    FROM projects
                    WHERE user_id = $1
                      AND (name ILIKE $2 OR description ILIKE $2)
                    ORDER BY
                        (name ILIKE $3) DESC,
                        updated_at DESC
                    LIMIT $4
                    "#,
                    user_id,
                    pattern,
                    format!("{}%", query.replace('%', "\\%").replace('_', "\\_")),
                    limit,
                )
                .fetch_all(db)
                .await?;

                projects = Some(rows);
            }

            EntityKind::Habit => {
                let rows = sqlx::query_as!(
                    HabitHit,
                    r#"
                    SELECT
                        id,
                        name,
                        description,
                        habit_type::text  AS "habit_type!",
                        frequency::text   AS "frequency!",
                        archived,
                        created_at,
                        updated_at
                    FROM habits
                    WHERE user_id = $1
                      AND archived = false
                      AND (name ILIKE $2 OR description ILIKE $2)
                    ORDER BY
                        (name ILIKE $3) DESC,
                        updated_at DESC
                    LIMIT $4
                    "#,
                    user_id,
                    pattern,
                    format!("{}%", query.replace('%', "\\%").replace('_', "\\_")),
                    limit,
                )
                .fetch_all(db)
                .await?;

                habits = Some(rows);
            }
        }
    }

    let total = tasks.as_ref().map_or(0, Vec::len)
        + projects.as_ref().map_or(0, Vec::len)
        + habits.as_ref().map_or(0, Vec::len);

    Ok(SearchResponse {
        query: query.to_owned(),
        total,
        tasks,
        projects,
        habits,
    })
}
