//! Business logic for the `project` module.
//!
//! All public functions accept `&AppState` (cheap clone of Arc-backed handles)
//! and the authenticated `user_id`, enforcing row-level ownership before every
//! mutation.  SQL is executed via `sqlx::query!` / `sqlx::query_as!` for
//! compile-time verification against the live schema.
//!
//! Domain events are published on state.events so that the `analytics` and
//! `notification` modules can react without coupling.

use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    events::DomainEvent,
    state::AppState,
};

#[allow(unused_imports)] // Project is a sqlx query_as! target type
use super::models::{
    CreateProjectRequest, ListProjectsQuery, Project, ProjectProgress, ProjectResponse,
    ProjectStatus, ReorderProjectsRequest, UpdateProjectRequest,
};

// ── Progress helper ───────────────────────────────────────────────────────────

/// Fetch task-count statistics for one project.
async fn fetch_progress(state: &AppState, project_id: Uuid) -> AppResult<ProjectProgress> {
    let row = sqlx::query!(
        r#"
        SELECT
            COUNT(*)                                        AS "total_tasks!: i64",
            COUNT(*) FILTER (WHERE status = 'completed')   AS "completed_tasks!: i64"
        FROM tasks
        WHERE project_id = $1
          AND deleted_at IS NULL
        "#,
        project_id
    )
    .fetch_one(&state.db)
    .await?;

    let total = row.total_tasks;
    let completed = row.completed_tasks;
    let rate = if total == 0 {
        0.0_f64
    } else {
        completed as f64 / total as f64
    };

    Ok(ProjectProgress {
        total_tasks: total,
        completed_tasks: completed,
        completion_rate: rate,
    })
}

// ── Service functions ─────────────────────────────────────────────────────────

/// Return all projects belonging to `user_id`, optionally filtered.
pub async fn list_projects(
    state: &AppState,
    user_id: Uuid,
    query: ListProjectsQuery,
) -> AppResult<Vec<ProjectResponse>> {
    // Build a dynamic query.  Because sqlx macro queries require static SQL we
    // use query_as! with explicit NULLable parameters (Postgres allows $n IS NULL
    // OR col = $n pattern for optional filters).
    let rows = sqlx::query_as!(
        Project,
        r#"
        SELECT
            id,
            user_id,
            goal_id,
            name,
            description,
            color,
            deadline,
            status  AS "status: ProjectStatus",
            position,
            organization_id,
            deleted_at,
            created_at,
            updated_at
        FROM projects
        WHERE user_id = $1
          AND deleted_at IS NULL
          AND ($2::project_status IS NULL OR status = $2)
          AND ($3::uuid IS NULL OR goal_id = $3)
        ORDER BY position ASC, created_at ASC
        "#,
        user_id,
        query.status as Option<ProjectStatus>,
        query.goal_id
    )
    .fetch_all(&state.db)
    .await?;

    let mut result = Vec::with_capacity(rows.len());
    for project in rows {
        let progress = fetch_progress(state, project.id).await?;
        result.push(ProjectResponse::from_parts(project, progress));
    }
    Ok(result)
}

/// Fetch one project by id, enforcing ownership.
pub async fn get_project(
    state: &AppState,
    user_id: Uuid,
    project_id: Uuid,
) -> AppResult<ProjectResponse> {
    let project = sqlx::query_as!(
        Project,
        r#"
        SELECT
            id,
            user_id,
            goal_id,
            name,
            description,
            color,
            deadline,
            status  AS "status: ProjectStatus",
            position,
            organization_id,
            deleted_at,
            created_at,
            updated_at
        FROM projects
        WHERE id = $1 AND user_id = $2
          AND deleted_at IS NULL
        "#,
        project_id,
        user_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let progress = fetch_progress(state, project.id).await?;
    Ok(ProjectResponse::from_parts(project, progress))
}

/// Insert a new project and return the full response.
pub async fn create_project(
    state: &AppState,
    user_id: Uuid,
    req: CreateProjectRequest,
) -> AppResult<ProjectResponse> {
    // Verify goal ownership when goal_id is supplied.
    if let Some(goal_id) = req.goal_id {
        let exists = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM goals WHERE id = $1 AND user_id = $2)",
            goal_id,
            user_id
        )
        .fetch_one(&state.db)
        .await?
        .unwrap_or(false);

        if !exists {
            return Err(AppError::NotFoundMsg(
                "goal not found or does not belong to you".to_owned(),
            ));
        }
    }

    let project = sqlx::query_as!(
        Project,
        r#"
        INSERT INTO projects (user_id, goal_id, name, description, color, deadline, position)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
            id,
            user_id,
            goal_id,
            name,
            description,
            color,
            deadline,
            status  AS "status: ProjectStatus",
            position,
            organization_id,
            deleted_at,
            created_at,
            updated_at
        "#,
        user_id,
        req.goal_id,
        req.name,
        req.description,
        req.color,
        req.deadline,
        req.position.unwrap_or(0)
    )
    .fetch_one(&state.db)
    .await?;

    let progress = ProjectProgress {
        total_tasks: 0,
        completed_tasks: 0,
        completion_rate: 0.0,
    };
    Ok(ProjectResponse::from_parts(project, progress))
}

/// Apply a partial update to an existing project.
pub async fn update_project(
    state: &AppState,
    user_id: Uuid,
    project_id: Uuid,
    req: UpdateProjectRequest,
) -> AppResult<ProjectResponse> {
    // Ensure the row exists and belongs to this user first.
    let existing = sqlx::query_as!(
        Project,
        r#"
        SELECT
            id,
            user_id,
            goal_id,
            name,
            description,
            color,
            deadline,
            status  AS "status: ProjectStatus",
            position,
            organization_id,
            deleted_at,
            created_at,
            updated_at
        FROM projects
        WHERE id = $1 AND user_id = $2
          AND deleted_at IS NULL
        "#,
        project_id,
        user_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // Validate new goal_id ownership when it's being changed.
    let new_goal_id = match req.goal_id {
        Some(gid) => {
            let exists = sqlx::query_scalar!(
                "SELECT EXISTS(SELECT 1 FROM goals WHERE id = $1 AND user_id = $2)",
                gid,
                user_id
            )
            .fetch_one(&state.db)
            .await?
            .unwrap_or(false);

            if !exists {
                return Err(AppError::NotFoundMsg(
                    "goal not found or does not belong to you".to_owned(),
                ));
            }
            Some(Some(gid))
        }
        // `None` in the request means "don't change goal_id".
        None => None,
    };

    // Validate new organization_id ownership when it's being assigned.
    // `req.organization_id` is `Option<Option<Uuid>>`:
    //   None             → leave organization_id unchanged
    //   Some(None)       → unassign (set to NULL)
    //   Some(Some(oid))  → assign to `oid` (must belong to this user)
    if let Some(Some(oid)) = req.organization_id {
        let exists = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM organizations WHERE id = $1 AND user_id = $2)",
            oid,
            user_id
        )
        .fetch_one(&state.db)
        .await?
        .unwrap_or(false);

        if !exists {
            return Err(AppError::NotFoundMsg(
                "organization not found or does not belong to you".to_owned(),
            ));
        }
    }

    let project = sqlx::query_as!(
        Project,
        r#"
        UPDATE projects SET
            name            = COALESCE($3, name),
            description     = COALESCE($4, description),
            color           = COALESCE($5, color),
            deadline        = COALESCE($6, deadline),
            goal_id         = CASE WHEN $7 THEN $8 ELSE goal_id END,
            status          = COALESCE($9, status),
            position        = COALESCE($10, position),
            organization_id = CASE WHEN $11 THEN $12 ELSE organization_id END,
            updated_at      = now()
        WHERE id = $1 AND user_id = $2
          AND deleted_at IS NULL
        RETURNING
            id,
            user_id,
            goal_id,
            name,
            description,
            color,
            deadline,
            status  AS "status: ProjectStatus",
            position,
            organization_id,
            deleted_at,
            created_at,
            updated_at
        "#,
        project_id,                          // $1
        user_id,                             // $2
        req.name,                            // $3
        req.description,                     // $4
        req.color,                           // $5
        req.deadline,                        // $6
        new_goal_id.is_some(),               // $7  bool: should we update goal_id?
        new_goal_id.flatten(),               // $8  new goal_id value (may be NULL)
        req.status.clone() as Option<ProjectStatus>, // $9
        req.position,                        // $10
        req.organization_id.is_some(),       // $11 bool: should we update organization_id?
        req.organization_id.flatten(),       // $12 new organization_id value (may be NULL)
    )
    .fetch_one(&state.db)
    .await?;

    // Emit ProjectCompleted when the status transitions to 'completed'.
    if req.status == Some(ProjectStatus::Completed) && existing.status != ProjectStatus::Completed {
        let _ = state.events.send(DomainEvent::ProjectCompleted {
            project_id,
            user_id,
        });
    }

    let progress = fetch_progress(state, project.id).await?;
    Ok(ProjectResponse::from_parts(project, progress))
}

/// Soft-delete a project owned by `user_id` (moves it to the Trash).
///
/// Sets `deleted_at = now()` so the row vanishes from all normal views while
/// remaining recoverable via [`restore_project`] or removable via
/// [`purge_project`]. Already soft-deleted rows are treated as not found.
pub async fn delete_project(state: &AppState, user_id: Uuid, project_id: Uuid) -> AppResult<()> {
    let result = sqlx::query!(
        "UPDATE projects SET deleted_at = now(), updated_at = now()
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL",
        project_id,
        user_id
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

/// Restore a soft-deleted project (clears `deleted_at`).
///
/// Only matches rows that are currently in the Trash (`deleted_at IS NOT NULL`).
pub async fn restore_project(state: &AppState, user_id: Uuid, project_id: Uuid) -> AppResult<()> {
    let result = sqlx::query!(
        "UPDATE projects SET deleted_at = NULL, updated_at = now()
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL",
        project_id,
        user_id
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

/// Permanently delete a project owned by `user_id` (hard DELETE, irreversible).
///
/// Cascaded by the DB: tasks whose `project_id` points here will have their
/// `project_id` set to NULL (ON DELETE SET NULL), kanban_columns will be
/// deleted (ON DELETE CASCADE). Purge is allowed regardless of soft-delete
/// state so a project can be removed directly or emptied from the Trash.
pub async fn purge_project(state: &AppState, user_id: Uuid, project_id: Uuid) -> AppResult<()> {
    let result = sqlx::query!(
        "DELETE FROM projects WHERE id = $1 AND user_id = $2",
        project_id,
        user_id
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

/// Bulk-update `position` for a set of projects belonging to `user_id`.
///
/// Executes inside a single transaction.  Any id that doesn't belong to the
/// caller is silently skipped (the UPDATE simply matches 0 rows).
pub async fn reorder_projects(
    state: &AppState,
    user_id: Uuid,
    req: ReorderProjectsRequest,
) -> AppResult<()> {
    let mut tx = state.db.begin().await?;

    for item in req.items {
        sqlx::query!(
            "UPDATE projects SET position = $3, updated_at = now()
             WHERE id = $1 AND user_id = $2",
            item.id,
            user_id,
            item.position
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}
