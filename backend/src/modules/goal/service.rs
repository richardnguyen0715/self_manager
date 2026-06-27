//! Business logic for the `goal` module.
//!
//! All public functions accept a reference to [`AppState`] and execute raw SQL
//! via `sqlx::query!` / `sqlx::query_as!` (compile-time checked).
//!
//! Domain events are emitted on the broadcast channel when relevant state
//! transitions occur (e.g. a goal reaches `completed` status).

use std::collections::HashMap;

use chrono::Utc;
use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    events::DomainEvent,
    state::AppState,
};

use super::models::{
    CreateGoalRequest, Goal, GoalListResponse, GoalProgress, GoalResponse, GoalStatus,
    ListGoalsQuery, UpdateGoalRequest,
};

// ── helpers ────────────────────────────────────────────────────────────────────

/// Clamp `limit` to [1, 200] and default to 50.
#[inline]
fn clamp_limit(raw: Option<i64>) -> i64 {
    raw.unwrap_or(50).clamp(1, 200)
}

/// Default offset to 0, floor at 0.
#[inline]
fn clamp_offset(raw: Option<i64>) -> i64 {
    raw.unwrap_or(0).max(0)
}

/// Fill each goal's `progress` by aggregating tasks across the goal's linked
/// projects. Uses the sqlx runtime API (no offline-cache regen needed).
async fn attach_progress(
    state: &AppState,
    user_id: Uuid,
    mut goals: Vec<GoalResponse>,
) -> AppResult<Vec<GoalResponse>> {
    if goals.is_empty() {
        return Ok(goals);
    }
    let ids: Vec<Uuid> = goals.iter().map(|g| g.id).collect();

    // (goal_id, total_projects, total_tasks, completed_tasks)
    let rows = sqlx::query_as::<_, (Uuid, i64, i64, i64)>(
        "SELECT p.goal_id, \
                COUNT(DISTINCT p.id)                                      AS total_projects, \
                COUNT(t.id)                                               AS total_tasks, \
                COUNT(t.id) FILTER (WHERE t.status::text = 'completed')   AS completed_tasks \
         FROM projects p \
         LEFT JOIN tasks t ON t.project_id = p.id \
         WHERE p.user_id = $1 AND p.goal_id = ANY($2) \
         GROUP BY p.goal_id",
    )
    .bind(user_id)
    .bind(&ids)
    .fetch_all(&state.db)
    .await?;

    let mut by_goal: HashMap<Uuid, (i64, i64, i64)> = HashMap::new();
    for (goal_id, projects, tasks, done) in rows {
        by_goal.insert(goal_id, (projects, tasks, done));
    }

    for g in goals.iter_mut() {
        if let Some(&(projects, tasks, done)) = by_goal.get(&g.id) {
            let percent = if tasks > 0 {
                ((done as f64 / tasks as f64) * 100.0).round() as i32
            } else {
                0
            };
            g.progress = GoalProgress {
                total_projects: projects,
                total_tasks: tasks,
                completed_tasks: done,
                percent,
            };
        }
    }
    Ok(goals)
}

// ── public service functions ───────────────────────────────────────────────────

/// Fetch a paginated list of goals for the authenticated user.
///
/// Optionally filters by `status`. Results are ordered by `position ASC`,
/// then `created_at ASC` for stable pagination.
///
/// # Errors
///
/// Returns [`AppError::Db`] on database failure.
pub async fn list_goals(
    state: &AppState,
    user_id: Uuid,
    query: &ListGoalsQuery,
) -> AppResult<GoalListResponse> {
    let limit = clamp_limit(query.limit);
    let offset = clamp_offset(query.offset);

    let (goals, total) = if let Some(status) = &query.status {
        let status_str = status.as_str();

        let rows = sqlx::query_as!(
            Goal,
            r#"
            SELECT
                id, user_id, title, description,
                target_date, status::text AS "status!",
                color, position, created_at, updated_at
            FROM goals
            WHERE user_id = $1 AND status::text = $2
            ORDER BY position ASC, created_at ASC
            LIMIT $3 OFFSET $4
            "#,
            user_id,
            status_str,
            limit,
            offset,
        )
        .fetch_all(&state.db)
        .await?;

        let total: i64 = sqlx::query_scalar!(
            "SELECT COUNT(*) FROM goals WHERE user_id = $1 AND status::text = $2",
            user_id,
            status_str,
        )
        .fetch_one(&state.db)
        .await?
        .unwrap_or(0);

        (rows, total)
    } else {
        let rows = sqlx::query_as!(
            Goal,
            r#"
            SELECT
                id, user_id, title, description,
                target_date, status::text AS "status!",
                color, position, created_at, updated_at
            FROM goals
            WHERE user_id = $1
            ORDER BY position ASC, created_at ASC
            LIMIT $2 OFFSET $3
            "#,
            user_id,
            limit,
            offset,
        )
        .fetch_all(&state.db)
        .await?;

        let total: i64 =
            sqlx::query_scalar!("SELECT COUNT(*) FROM goals WHERE user_id = $1", user_id)
                .fetch_one(&state.db)
                .await?
                .unwrap_or(0);

        (rows, total)
    };

    let data = attach_progress(
        state,
        user_id,
        goals.into_iter().map(GoalResponse::from).collect(),
    )
    .await?;

    Ok(GoalListResponse { data, total })
}

/// Create a new goal for the authenticated user.
///
/// # Errors
///
/// Returns [`AppError::Db`] on database failure.
pub async fn create_goal(
    state: &AppState,
    user_id: Uuid,
    req: CreateGoalRequest,
) -> AppResult<GoalResponse> {
    let status = req
        .status
        .as_ref()
        .map(GoalStatus::as_str)
        .unwrap_or("active");

    let position = req.position.unwrap_or(0);

    let goal = sqlx::query_as!(
        Goal,
        r#"
        INSERT INTO goals (user_id, title, description, target_date, status, color, position)
        VALUES ($1, $2, $3, $4, ($5::text)::goal_status, $6, $7)
        RETURNING
            id, user_id, title, description,
            target_date, status::text AS "status!",
            color, position, created_at, updated_at
        "#,
        user_id,
        req.title,
        req.description,
        req.target_date,
        status,
        req.color,
        position,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(GoalResponse::from(goal))
}

/// Fetch a single goal by ID, enforcing ownership.
///
/// # Errors
///
/// - [`AppError::NotFound`] when no goal with that ID exists for the user.
/// - [`AppError::Db`] on database failure.
pub async fn get_goal(state: &AppState, user_id: Uuid, goal_id: Uuid) -> AppResult<GoalResponse> {
    let goal = sqlx::query_as!(
        Goal,
        r#"
        SELECT
            id, user_id, title, description,
            target_date, status::text AS "status!",
            color, position, created_at, updated_at
        FROM goals
        WHERE id = $1 AND user_id = $2
        "#,
        goal_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let resp = attach_progress(state, user_id, vec![GoalResponse::from(goal)])
        .await?
        .pop()
        .expect("attach_progress preserves the single input goal");
    Ok(resp)
}

/// Partially update a goal; only provided fields are mutated.
///
/// Emits [`DomainEvent::GoalCompleted`] when the status transitions to
/// `completed`.
///
/// # Errors
///
/// - [`AppError::NotFound`] — goal not found or belongs to a different user.
/// - [`AppError::Db`] — database failure.
pub async fn update_goal(
    state: &AppState,
    user_id: Uuid,
    goal_id: Uuid,
    req: UpdateGoalRequest,
) -> AppResult<GoalResponse> {
    // Fetch current state so we can detect status transitions.
    let current = sqlx::query_as!(
        Goal,
        r#"
        SELECT
            id, user_id, title, description,
            target_date, status::text AS "status!",
            color, position, created_at, updated_at
        FROM goals
        WHERE id = $1 AND user_id = $2
        "#,
        goal_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // Build the new field values by coalescing request overrides onto current.
    let new_title = req.title.as_deref().unwrap_or(&current.title);
    let new_description = if req.description.is_some() {
        req.description.as_deref()
    } else {
        current.description.as_deref()
    };
    let new_target_date = if req.target_date.is_some() {
        req.target_date
    } else {
        current.target_date
    };
    let new_status = req
        .status
        .as_ref()
        .map(GoalStatus::as_str)
        .unwrap_or(current.status.as_str());
    let new_color = if req.color.is_some() {
        req.color.as_deref()
    } else {
        current.color.as_deref()
    };
    let new_position = req.position.unwrap_or(current.position);

    let updated = sqlx::query_as!(
        Goal,
        r#"
        UPDATE goals
        SET
            title       = $3,
            description = $4,
            target_date = $5,
            status      = ($6::text)::goal_status,
            color       = $7,
            position    = $8,
            updated_at  = now()
        WHERE id = $1 AND user_id = $2
        RETURNING
            id, user_id, title, description,
            target_date, status::text AS "status!",
            color, position, created_at, updated_at
        "#,
        goal_id,
        user_id,
        new_title,
        new_description,
        new_target_date,
        new_status,
        new_color,
        new_position,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // Emit domain event on completion transition.
    if current.status != "completed" && updated.status == "completed" {
        let _ = state.events.send(DomainEvent::GoalCompleted {
            goal_id: updated.id,
            user_id,
        });
    }

    Ok(GoalResponse::from(updated))
}

/// Delete a goal by ID, enforcing ownership.
///
/// Projects linked to this goal will have their `goal_id` set to NULL by the
/// database `ON DELETE SET NULL` constraint.
///
/// # Errors
///
/// - [`AppError::NotFound`] — goal not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn delete_goal(state: &AppState, user_id: Uuid, goal_id: Uuid) -> AppResult<()> {
    let result = sqlx::query!(
        "DELETE FROM goals WHERE id = $1 AND user_id = $2",
        goal_id,
        user_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}

/// Reorder a goal by updating its `position` column.
///
/// This is a lightweight alternative to updating the full goal, useful for
/// drag-and-drop reordering in the UI.
///
/// # Errors
///
/// - [`AppError::NotFound`] — goal not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn reorder_goal(
    state: &AppState,
    user_id: Uuid,
    goal_id: Uuid,
    position: i32,
) -> AppResult<GoalResponse> {
    let updated = sqlx::query_as!(
        Goal,
        r#"
        UPDATE goals
        SET position = $3, updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING
            id, user_id, title, description,
            target_date, status::text AS "status!",
            color, position, created_at, updated_at
        "#,
        goal_id,
        user_id,
        position,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(GoalResponse::from(updated))
}

/// List all projects that belong to a specific goal, enforcing that the goal
/// is owned by the requesting user.
///
/// Returns lightweight project summaries; the full project module owns the
/// canonical `Project` type.
///
/// # Errors
///
/// - [`AppError::NotFound`] — goal not found or not owned by this user.
/// - [`AppError::Db`] — database failure.
pub async fn list_goal_projects(
    state: &AppState,
    user_id: Uuid,
    goal_id: Uuid,
) -> AppResult<Vec<GoalProjectSummary>> {
    // Verify ownership first.
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM goals WHERE id = $1 AND user_id = $2)",
        goal_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound);
    }

    let rows = sqlx::query_as!(
        GoalProjectSummary,
        r#"
        SELECT
            id,
            name,
            description,
            color,
            deadline,
            status::text AS "status!",
            position,
            created_at,
            updated_at
        FROM projects
        WHERE goal_id = $1 AND user_id = $2
        ORDER BY position ASC, created_at ASC
        "#,
        goal_id,
        user_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

// ── nested response types ──────────────────────────────────────────────────────

/// Lightweight project summary returned by `GET /api/goals/:id/projects`.
///
/// The project module owns the full project model; this is intentionally
/// minimal to avoid cross-module coupling.
#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct GoalProjectSummary {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub deadline: Option<chrono::NaiveDate>,
    pub status: String,
    pub position: i32,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: chrono::DateTime<Utc>,
}
