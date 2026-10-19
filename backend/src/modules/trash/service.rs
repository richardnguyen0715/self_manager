//! Business logic for the `trash` module.
//!
//! Selects soft-deleted rows (`deleted_at IS NOT NULL`) scoped to the
//! authenticated user, ordered newest-deleted first. Reuses the list/response
//! item shapes from the `work_item`, `task`, and `project` modules so the trash
//! view is byte-compatible with the live views the client already renders.

use serde::Serialize;
use uuid::Uuid;

use crate::shared::{error::AppResult, state::AppState};

// Reuse existing list/response shapes — do NOT redefine them here.
// `Project` (the raw DB row) is not `Serialize`, so the public-facing
// `ProjectResponse` is used for the trash projects array; it is the same shape
// returned by `GET /api/projects` and matches the frontend `Project` type.
use crate::modules::project::models::{Project, ProjectProgress, ProjectResponse, ProjectStatus};
use crate::modules::task::models::{Task, TaskPriority, TaskStatus};
use crate::modules::work_item::models::WorkItemListItem;

/// Aggregated recycle-bin payload returned by `GET /api/trash`.
///
/// Arrays reuse the same item shapes as the live list endpoints.
#[derive(Debug, Serialize)]
pub struct TrashResponse {
    pub work_items: Vec<WorkItemListItem>,
    pub tasks: Vec<Task>,
    pub projects: Vec<ProjectResponse>,
}

/// Fetch every soft-deleted row for `user_id`, newest-deleted first.
pub async fn get_trash(state: &AppState, user_id: Uuid) -> AppResult<TrashResponse> {
    let work_items = fetch_deleted_work_items(state, user_id).await?;
    let tasks = fetch_deleted_tasks(state, user_id).await?;
    let projects = fetch_deleted_projects(state, user_id).await?;

    Ok(TrashResponse {
        work_items,
        tasks,
        projects,
    })
}

/// Soft-deleted work items, ordered by `deleted_at DESC`.
///
/// Mirrors the `list_work_items` projection (incl. subtask counts) but filters
/// to `deleted_at IS NOT NULL` instead of excluding deleted rows.
async fn fetch_deleted_work_items(
    state: &AppState,
    user_id: Uuid,
) -> AppResult<Vec<WorkItemListItem>> {
    let rows = sqlx::query_as!(
        WorkItemListItem,
        r#"
        SELECT
            wi.id,
            wi.project_id,
            wi.epic_id,
            wi.sprint_id,
            wi.type::text      AS "item_type!",
            wi.title,
            wi.status::text    AS "status!",
            wi.priority::text  AS "priority!",
            wi.story_points,
            wi.start_date,
            wi.due_date,
            wi.position,
            wi.column_id,
            wi.labels          AS "labels!: Vec<String>",
            wi.pinned_fields   AS "pinned_fields!: Vec<String>",
            wi.github_repo,
            wi.github_branch,
            wi.github_pr,
            COUNT(s.id)                          AS "subtask_count!: i64",
            COUNT(s.id) FILTER (WHERE s.is_done) AS "done_subtask_count!: i64",
            COALESCE((SELECT p.key FROM projects p WHERE p.id = wi.project_id), 'WI')
                || '-' || wi.seq_id                 AS "key?",
            wi.seq_id                               AS "seq_id?",
            wi.created_at,
            wi.updated_at
        FROM work_items wi
        LEFT JOIN work_item_subtasks s ON s.work_item_id = wi.id
        WHERE wi.user_id = $1
          AND wi.deleted_at IS NOT NULL
        GROUP BY wi.id
        ORDER BY wi.deleted_at DESC
        "#,
        user_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

/// Soft-deleted tasks, ordered by `deleted_at DESC`.
///
/// Returns the full [`Task`] row (matching the `list_tasks` shape).
async fn fetch_deleted_tasks(state: &AppState, user_id: Uuid) -> AppResult<Vec<Task>> {
    let rows = sqlx::query_as!(
        Task,
        r#"
        SELECT
            id,
            user_id,
            project_id,
            title,
            description,
            priority    AS "priority: TaskPriority",
            status      AS "status: TaskStatus",
            due_date,
            start_date,
            estimated_time,
            actual_time,
            recurrence_rule,
            completed_at,
            position,
            created_at,
            updated_at
        FROM tasks
        WHERE user_id = $1
          AND deleted_at IS NOT NULL
        ORDER BY deleted_at DESC
        "#,
        user_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

/// Soft-deleted projects, ordered by `deleted_at DESC`.
///
/// Returns [`ProjectResponse`] (the same shape as `GET /api/projects`), with a
/// task-count progress snapshot attached per project.
async fn fetch_deleted_projects(
    state: &AppState,
    user_id: Uuid,
) -> AppResult<Vec<ProjectResponse>> {
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
            key,
            estimate_system,
            created_at,
            updated_at
        FROM projects
        WHERE user_id = $1
          AND deleted_at IS NOT NULL
        ORDER BY deleted_at DESC
        "#,
        user_id,
    )
    .fetch_all(&state.db)
    .await?;

    let mut result = Vec::with_capacity(rows.len());
    for project in rows {
        let progress = fetch_project_progress(state, project.id).await?;
        result.push(ProjectResponse::from_parts(project, progress));
    }
    Ok(result)
}

/// Task-count snapshot for a single project (mirrors the `project` module's
/// private `fetch_progress` helper, which is not re-exported).
async fn fetch_project_progress(state: &AppState, project_id: Uuid) -> AppResult<ProjectProgress> {
    let row = sqlx::query!(
        r#"
        SELECT
            COUNT(*)                                      AS "total_tasks!: i64",
            COUNT(*) FILTER (WHERE status = 'completed')  AS "completed_tasks!: i64"
        FROM tasks
        WHERE project_id = $1
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
