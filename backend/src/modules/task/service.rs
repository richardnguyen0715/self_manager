//! Task module — business logic layer.
//!
//! All database access goes through `sqlx::query!` / `sqlx::query_as!` macros
//! against the shared `AppState.db` pool. Domain events are published via
//! `AppState.events`.

use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    events::DomainEvent,
    state::AppState,
};

use super::models::{
    AttachTagRequest, CreateSubtaskRequest, CreateTagRequest, CreateTaskRequest, ListTasksQuery,
    Subtask, Tag, Task, TaskPriority, TaskResponse, TaskStatus, UpdateSubtaskRequest,
    UpdateTagRequest, UpdateTaskRequest,
};

// ── Private helpers ────────────────────────────────────────────────────────────

/// Load the subtasks and tags for a given task and wrap them into a
/// [`TaskResponse`].
async fn enrich(db: &PgPool, task: Task) -> AppResult<TaskResponse> {
    let subtasks = sqlx::query_as!(
        Subtask,
        r#"SELECT id, task_id, title, is_done, position, created_at, updated_at
           FROM subtasks
           WHERE task_id = $1
           ORDER BY position ASC, created_at ASC"#,
        task.id
    )
    .fetch_all(db)
    .await?;

    let tags = sqlx::query_as!(
        Tag,
        r#"SELECT t.id, t.user_id, t.name, t.color, t.created_at, t.updated_at
           FROM tags t
           JOIN task_tags tt ON tt.tag_id = t.id
           WHERE tt.task_id = $1
           ORDER BY t.name ASC"#,
        task.id
    )
    .fetch_all(db)
    .await?;

    Ok(TaskResponse {
        task,
        subtasks,
        tags,
    })
}

// ── Task CRUD ──────────────────────────────────────────────────────────────────

/// Fetch a paginated list of tasks for the authenticated user.
pub async fn list_tasks(
    state: &AppState,
    user_id: Uuid,
    query: &ListTasksQuery,
) -> AppResult<Vec<Task>> {
    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let offset = query.offset.unwrap_or(0).max(0);

    // Build a dynamic query. SQLx compile-time checking requires static SQL, so
    // we use the `query_as!` macro only for the simple common path and fall back
    // to `sqlx::query_as` (runtime) when optional filters are present.
    //
    // To keep things safe we still parameterise every value.
    let tasks = sqlx::query_as!(
        Task,
        r#"SELECT
               t.id,
               t.user_id,
               t.project_id,
               t.title,
               t.description,
               t.priority    AS "priority: TaskPriority",
               t.status      AS "status: TaskStatus",
               t.due_date,
               t.start_date,
               t.estimated_time,
               t.actual_time,
               t.recurrence_rule,
               t.completed_at,
               t.position,
               t.created_at,
               t.updated_at
           FROM tasks t
           WHERE t.user_id = $1
             AND ($2::uuid    IS NULL OR t.project_id = $2)
             AND ($3::task_status IS NULL OR t.status  = $3)
             AND ($4::task_priority IS NULL OR t.priority = $4)
             AND ($5::timestamptz IS NULL OR t.due_date <= $5)
             AND ($6::timestamptz IS NULL OR t.due_date >= $6)
             AND ($7::uuid IS NULL OR EXISTS (
                     SELECT 1 FROM task_tags tt
                     WHERE tt.task_id = t.id AND tt.tag_id = $7
                 ))
           ORDER BY t.position ASC, t.created_at DESC
           LIMIT $8 OFFSET $9"#,
        user_id,
        query.project_id as Option<Uuid>,
        query.status.clone() as Option<TaskStatus>,
        query.priority.clone() as Option<TaskPriority>,
        query.due_before as Option<chrono::DateTime<Utc>>,
        query.due_after as Option<chrono::DateTime<Utc>>,
        query.tag_id as Option<Uuid>,
        limit,
        offset,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(tasks)
}

/// Fetch a single task owned by `user_id`, enriched with subtasks and tags.
pub async fn get_task(state: &AppState, user_id: Uuid, task_id: Uuid) -> AppResult<TaskResponse> {
    let task = sqlx::query_as!(
        Task,
        r#"SELECT
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
           WHERE id = $1 AND user_id = $2"#,
        task_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    enrich(&state.db, task).await
}

/// Create a new task, optionally attaching existing tag IDs.
pub async fn create_task(
    state: &AppState,
    user_id: Uuid,
    req: &CreateTaskRequest,
) -> AppResult<TaskResponse> {
    let priority = req.priority.clone().unwrap_or(TaskPriority::Medium);
    let status = req.status.clone().unwrap_or(TaskStatus::Inbox);

    let task = sqlx::query_as!(
        Task,
        r#"INSERT INTO tasks (
               user_id, project_id, title, description,
               priority, status, due_date, start_date,
               estimated_time, recurrence_rule
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING
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
               updated_at"#,
        user_id,
        req.project_id as Option<Uuid>,
        req.title,
        req.description.clone() as Option<String>,
        priority as TaskPriority,
        status as TaskStatus,
        req.due_date as Option<chrono::DateTime<Utc>>,
        req.start_date as Option<chrono::DateTime<Utc>>,
        req.estimated_time as Option<i32>,
        req.recurrence_rule.clone() as Option<String>,
    )
    .fetch_one(&state.db)
    .await?;

    // Attach requested tags, silently ignoring IDs that don't belong to this user.
    if let Some(tag_ids) = &req.tag_ids {
        for tag_id in tag_ids {
            let _ = sqlx::query!(
                r#"INSERT INTO task_tags (task_id, tag_id)
                   SELECT $1, t.id FROM tags t
                   WHERE t.id = $2 AND t.user_id = $3
                   ON CONFLICT DO NOTHING"#,
                task.id,
                tag_id,
                user_id,
            )
            .execute(&state.db)
            .await?;
        }
    }

    enrich(&state.db, task).await
}

/// Update mutable fields of an existing task.
///
/// If the status transitions to `completed` this function:
/// 1. Sets `completed_at = now()`.
/// 2. Emits a [`DomainEvent::TaskCompleted`].
pub async fn update_task(
    state: &AppState,
    user_id: Uuid,
    task_id: Uuid,
    req: &UpdateTaskRequest,
) -> AppResult<TaskResponse> {
    // Fetch current row to detect status transitions.
    let current = sqlx::query_as!(
        Task,
        r#"SELECT
               id, user_id, project_id, title, description,
               priority    AS "priority: TaskPriority",
               status      AS "status: TaskStatus",
               due_date, start_date, estimated_time, actual_time,
               recurrence_rule, completed_at, position, created_at, updated_at
           FROM tasks
           WHERE id = $1 AND user_id = $2"#,
        task_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let new_status = req.status.clone().unwrap_or_else(|| current.status.clone());
    let completing = new_status == TaskStatus::Completed && current.status != TaskStatus::Completed;
    let completed_at: Option<chrono::DateTime<Utc>> = if completing {
        Some(Utc::now())
    } else if new_status != TaskStatus::Completed {
        // Un-completing: clear the timestamp.
        None
    } else {
        current.completed_at
    };

    let updated = sqlx::query_as!(
        Task,
        r#"UPDATE tasks SET
               title            = COALESCE($3, title),
               description      = COALESCE($4, description),
               priority         = COALESCE($5, priority),
               status           = COALESCE($6, status),
               project_id       = COALESCE($7, project_id),
               due_date         = COALESCE($8, due_date),
               start_date       = COALESCE($9, start_date),
               estimated_time   = COALESCE($10, estimated_time),
               actual_time      = COALESCE($11, actual_time),
               recurrence_rule  = COALESCE($12, recurrence_rule),
               position         = COALESCE($13, position),
               completed_at     = $14
           WHERE id = $1 AND user_id = $2
           RETURNING
               id, user_id, project_id, title, description,
               priority    AS "priority: TaskPriority",
               status      AS "status: TaskStatus",
               due_date, start_date, estimated_time, actual_time,
               recurrence_rule, completed_at, position, created_at, updated_at"#,
        task_id,
        user_id,
        req.title.clone() as Option<String>,
        req.description.clone() as Option<String>,
        req.priority.clone() as Option<TaskPriority>,
        req.status.clone() as Option<TaskStatus>,
        req.project_id as Option<Uuid>,
        req.due_date as Option<chrono::DateTime<Utc>>,
        req.start_date as Option<chrono::DateTime<Utc>>,
        req.estimated_time as Option<i32>,
        req.actual_time as Option<i32>,
        req.recurrence_rule.clone() as Option<String>,
        req.position as Option<i32>,
        completed_at as Option<chrono::DateTime<Utc>>,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    if completing {
        // Best-effort: ignore lagged receivers.
        let _ = state
            .events
            .send(DomainEvent::TaskCompleted { task_id, user_id });
    }

    enrich(&state.db, updated).await
}

/// Delete a task; returns [`AppError::NotFound`] if it doesn't exist or belongs
/// to a different user.
pub async fn delete_task(state: &AppState, user_id: Uuid, task_id: Uuid) -> AppResult<()> {
    let result = sqlx::query!(
        "DELETE FROM tasks WHERE id = $1 AND user_id = $2",
        task_id,
        user_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

// ── Subtasks ───────────────────────────────────────────────────────────────────

/// Assert the task belongs to `user_id`; errors otherwise.
async fn assert_task_owner(db: &PgPool, user_id: Uuid, task_id: Uuid) -> AppResult<()> {
    let exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM tasks WHERE id = $1 AND user_id = $2)",
        task_id,
        user_id,
    )
    .fetch_one(db)
    .await?
    .unwrap_or(false);

    if exists {
        Ok(())
    } else {
        Err(AppError::NotFound)
    }
}

pub async fn list_subtasks(
    state: &AppState,
    user_id: Uuid,
    task_id: Uuid,
) -> AppResult<Vec<Subtask>> {
    assert_task_owner(&state.db, user_id, task_id).await?;

    let subtasks = sqlx::query_as!(
        Subtask,
        r#"SELECT id, task_id, title, is_done, position, created_at, updated_at
           FROM subtasks
           WHERE task_id = $1
           ORDER BY position ASC, created_at ASC"#,
        task_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(subtasks)
}

pub async fn create_subtask(
    state: &AppState,
    user_id: Uuid,
    task_id: Uuid,
    req: &CreateSubtaskRequest,
) -> AppResult<Subtask> {
    assert_task_owner(&state.db, user_id, task_id).await?;

    let subtask = sqlx::query_as!(
        Subtask,
        r#"INSERT INTO subtasks (task_id, title)
           VALUES ($1, $2)
           RETURNING id, task_id, title, is_done, position, created_at, updated_at"#,
        task_id,
        req.title,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(subtask)
}

pub async fn update_subtask(
    state: &AppState,
    user_id: Uuid,
    task_id: Uuid,
    subtask_id: Uuid,
    req: &UpdateSubtaskRequest,
) -> AppResult<Subtask> {
    assert_task_owner(&state.db, user_id, task_id).await?;

    let subtask = sqlx::query_as!(
        Subtask,
        r#"UPDATE subtasks SET
               title    = COALESCE($3, title),
               is_done  = COALESCE($4, is_done),
               position = COALESCE($5, position)
           WHERE id = $2 AND task_id = $1
           RETURNING id, task_id, title, is_done, position, created_at, updated_at"#,
        task_id,
        subtask_id,
        req.title.clone() as Option<String>,
        req.is_done as Option<bool>,
        req.position as Option<i32>,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(subtask)
}

pub async fn delete_subtask(
    state: &AppState,
    user_id: Uuid,
    task_id: Uuid,
    subtask_id: Uuid,
) -> AppResult<()> {
    assert_task_owner(&state.db, user_id, task_id).await?;

    let result = sqlx::query!(
        "DELETE FROM subtasks WHERE id = $1 AND task_id = $2",
        subtask_id,
        task_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

// ── Tags ───────────────────────────────────────────────────────────────────────

pub async fn list_tags(state: &AppState, user_id: Uuid) -> AppResult<Vec<Tag>> {
    let tags = sqlx::query_as!(
        Tag,
        r#"SELECT id, user_id, name, color, created_at, updated_at
           FROM tags
           WHERE user_id = $1
           ORDER BY name ASC"#,
        user_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(tags)
}

pub async fn create_tag(state: &AppState, user_id: Uuid, req: &CreateTagRequest) -> AppResult<Tag> {
    let tag = sqlx::query_as!(
        Tag,
        r#"INSERT INTO tags (user_id, name, color)
           VALUES ($1, $2, $3)
           RETURNING id, user_id, name, color, created_at, updated_at"#,
        user_id,
        req.name,
        req.color.clone() as Option<String>,
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        // unique constraint: tags_user_name_key
        if let sqlx::Error::Database(ref de) = e {
            if de.constraint() == Some("tags_user_name_key") {
                return AppError::Conflict(format!("a tag named '{}' already exists", req.name));
            }
        }
        AppError::Db(e)
    })?;

    Ok(tag)
}

pub async fn update_tag(
    state: &AppState,
    user_id: Uuid,
    tag_id: Uuid,
    req: &UpdateTagRequest,
) -> AppResult<Tag> {
    let tag = sqlx::query_as!(
        Tag,
        r#"UPDATE tags SET
               name  = COALESCE($3, name),
               color = COALESCE($4, color)
           WHERE id = $1 AND user_id = $2
           RETURNING id, user_id, name, color, created_at, updated_at"#,
        tag_id,
        user_id,
        req.name.clone() as Option<String>,
        req.color.clone() as Option<String>,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(tag)
}

pub async fn delete_tag(state: &AppState, user_id: Uuid, tag_id: Uuid) -> AppResult<()> {
    let result = sqlx::query!(
        "DELETE FROM tags WHERE id = $1 AND user_id = $2",
        tag_id,
        user_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

// ── Task–tag associations ──────────────────────────────────────────────────────

pub async fn attach_tag(
    state: &AppState,
    user_id: Uuid,
    task_id: Uuid,
    req: &AttachTagRequest,
) -> AppResult<()> {
    assert_task_owner(&state.db, user_id, task_id).await?;

    // Verify the tag belongs to this user.
    let tag_exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM tags WHERE id = $1 AND user_id = $2)",
        req.tag_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !tag_exists {
        return Err(AppError::NotFoundMsg("tag not found".to_owned()));
    }

    sqlx::query!(
        r#"INSERT INTO task_tags (task_id, tag_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING"#,
        task_id,
        req.tag_id,
    )
    .execute(&state.db)
    .await?;

    Ok(())
}

pub async fn detach_tag(
    state: &AppState,
    user_id: Uuid,
    task_id: Uuid,
    tag_id: Uuid,
) -> AppResult<()> {
    assert_task_owner(&state.db, user_id, task_id).await?;

    sqlx::query!(
        "DELETE FROM task_tags WHERE task_id = $1 AND tag_id = $2",
        task_id,
        tag_id,
    )
    .execute(&state.db)
    .await?;

    Ok(())
}
