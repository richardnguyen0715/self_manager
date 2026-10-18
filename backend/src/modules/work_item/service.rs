//! Business logic for the `work_item` module.
//!
//! All public functions accept a reference to [`AppState`] and execute SQL
//! via `sqlx::query!` / `sqlx::query_as!` (compile-time checked).
//!
//! Enum columns use the **enum-as-text** pattern:
//! - SELECT: `col::text AS "col!"`
//! - Filter: `col::text = $n`
//! - Bind:   `($n::text)::enum_name`
//!
//! Domain events are emitted best-effort (`let _ = state.events.send(...)`).

use chrono::Utc;
use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    events::DomainEvent,
    state::AppState,
};

use super::models::{
    ActivityEntry,
    Attachment, AttachmentRow, CreateCommentRequest, CreateLinkRequest, CreateSubtaskRequest,
    CreateWebLinkRequest, CreateWorkItemRequest, ListWorkItemsQuery, MoveToBacklogRequest,
    MoveToSprintRequest, SetColumnRequest, SetPointsRequest, SetStatusRequest,
    UpdateSubtaskRequest, UpdateWorkItemRequest, WebLink, WorkItem, WorkItemComment,
    WorkItemLink, WorkItemListItem, WorkItemListResponse, WorkItemResponse, WorkItemSubtask,
};

// ── helpers ────────────────────────────────────────────────────────────────────

#[inline]
fn clamp_limit(raw: Option<i64>) -> i64 {
    raw.unwrap_or(50).clamp(1, 200)
}

#[inline]
fn clamp_offset(raw: Option<i64>) -> i64 {
    raw.unwrap_or(0).max(0)
}

/// Validate that `story_points` is one of {1, 3, 5, 8} or `None`.
fn validate_story_points(points: Option<i32>) -> AppResult<()> {
    match points {
        None | Some(1) | Some(3) | Some(5) | Some(8) => Ok(()),
        Some(v) => Err(AppError::Validation(format!(
            "story_points must be 1, 3, 5, 8, or null; got {v}"
        ))),
    }
}

/// Fetch the full `WorkItemResponse` (with subtasks) for a given `id` owned
/// by `user_id`. Used internally after mutations.
async fn fetch_work_item_with_subtasks(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
) -> AppResult<WorkItemResponse> {
    let item = sqlx::query_as!(
        WorkItem,
        r#"
        SELECT
            id, user_id, project_id, epic_id, sprint_id,
            type::text  AS "item_type!",
            title, description,
            status::text   AS "status!",
            priority::text AS "priority!",
            story_points, position,
            start_date, due_date, recurrence_rule, completed_at,
            column_id,
            labels AS "labels!: Vec<String>",
            pinned_fields AS "pinned_fields!: Vec<String>",
            github_repo, github_branch, github_pr,
            created_at, updated_at
        FROM work_items
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        "#,
        item_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let subtasks = sqlx::query_as!(
        WorkItemSubtask,
        r#"
        SELECT id, work_item_id, title, is_done, position, created_at, updated_at
        FROM work_item_subtasks
        WHERE work_item_id = $1
        ORDER BY position ASC, created_at ASC
        "#,
        item_id,
    )
    .fetch_all(&state.db)
    .await?;

    attach_item_key(state, work_item_into_response(item, subtasks)).await
}

/// Convert a raw [`WorkItem`] row and its subtasks into a [`WorkItemResponse`].
fn work_item_into_response(item: WorkItem, subtasks: Vec<WorkItemSubtask>) -> WorkItemResponse {
    WorkItemResponse {
        id: item.id,
        user_id: item.user_id,
        project_id: item.project_id,
        epic_id: item.epic_id,
        sprint_id: item.sprint_id,
        item_type: item.item_type,
        title: item.title,
        description: item.description,
        status: item.status,
        priority: item.priority,
        story_points: item.story_points,
        position: item.position,
        start_date: item.start_date,
        due_date: item.due_date,
        recurrence_rule: item.recurrence_rule,
        completed_at: item.completed_at,
        column_id: item.column_id,
        labels: item.labels,
        pinned_fields: item.pinned_fields,
        github_repo: item.github_repo,
        github_branch: item.github_branch,
        github_pr: item.github_pr,
        created_at: item.created_at,
        updated_at: item.updated_at,
        subtasks,
        key: None,
        seq_id: None,
    }
}

/// Fill `key` / `seq_id` on a response from the database.
///
/// `key` is `<projects.key or 'WI'>-<seq_id>`; items without a project use `WI`.
async fn attach_item_key(
    state: &AppState,
    mut resp: WorkItemResponse,
) -> AppResult<WorkItemResponse> {
    let row = sqlx::query_as::<_, (String, Option<i32>)>(
        r#"
        SELECT COALESCE(
                   (SELECT p.key FROM projects p WHERE p.id = wi.project_id),
                   'WI'
               ) AS prefix,
               wi.seq_id
          FROM work_items wi
         WHERE wi.id = $1
        "#,
    )
    .bind(resp.id)
    .fetch_optional(&state.db)
    .await?;

    if let Some((prefix, seq_id)) = row {
        resp.key = seq_id.map(|s| format!("{prefix}-{s}"));
        resp.seq_id = seq_id;
    }
    Ok(resp)
}

// ── Work Item CRUD ─────────────────────────────────────────────────────────────

/// Return a paginated list of work items for the authenticated user,
/// with optional filters for `sprint_id`, `epic_id`, `status`, `type`, and `priority`.
///
/// Each row includes `subtask_count` and `done_subtask_count` aggregates but
/// omits the subtask list for efficiency.
///
/// # Errors
///
/// Returns [`AppError::Db`] on database failure.
pub async fn list_work_items(
    state: &AppState,
    user_id: Uuid,
    query: &ListWorkItemsQuery,
) -> AppResult<WorkItemListResponse> {
    let limit = clamp_limit(query.limit);
    let offset = clamp_offset(query.offset);

    // Convert typed filter enums to &str; `None` = no filter.
    let status_str = query.status.as_ref().map(|s| s.as_str());
    let type_str = query.item_type.as_ref().map(|t| t.as_str());
    let priority_str = query.priority.as_ref().map(|p| p.as_str());

    // Dynamic filtering is not natively supported by `query_as!` when columns
    // are optional. We implement the three most-common filter combinations
    // (all-no-filter, sprint_id, epic_id) with explicit query branches, then
    // handle status/type/priority as optional text comparisons inside a single
    // general query that covers all remaining cases.
    //
    // To keep the code maintainable we use one parameterised query that accepts
    // nullable filter values; Postgres treats `$n IS NULL OR col::text = $n`
    // as "skip this filter when NULL".

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
          AND wi.deleted_at IS NULL
          AND ($2::uuid IS NULL OR wi.project_id = $2)
          AND ($3::uuid IS NULL OR wi.sprint_id  = $3)
          AND ($4::uuid IS NULL OR wi.epic_id    = $4)
          AND ($5::text IS NULL OR wi.status::text   = $5)
          AND ($6::text IS NULL OR wi.type::text     = $6)
          AND ($7::text IS NULL OR wi.priority::text = $7)
        GROUP BY wi.id
        ORDER BY wi.position ASC, wi.created_at ASC
        LIMIT $8 OFFSET $9
        "#,
        user_id,
        query.project_id as Option<Uuid>,
        query.sprint_id  as Option<Uuid>,
        query.epic_id    as Option<Uuid>,
        status_str   as Option<&str>,
        type_str     as Option<&str>,
        priority_str as Option<&str>,
        limit,
        offset,
    )
    .fetch_all(&state.db)
    .await?;

    let total: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)
        FROM work_items wi
        WHERE wi.user_id = $1
          AND wi.deleted_at IS NULL
          AND ($2::uuid IS NULL OR wi.project_id = $2)
          AND ($3::uuid IS NULL OR wi.sprint_id  = $3)
          AND ($4::uuid IS NULL OR wi.epic_id    = $4)
          AND ($5::text IS NULL OR wi.status::text   = $5)
          AND ($6::text IS NULL OR wi.type::text     = $6)
          AND ($7::text IS NULL OR wi.priority::text = $7)
        "#,
        user_id,
        query.project_id as Option<Uuid>,
        query.sprint_id  as Option<Uuid>,
        query.epic_id    as Option<Uuid>,
        status_str   as Option<&str>,
        type_str     as Option<&str>,
        priority_str as Option<&str>,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    Ok(WorkItemListResponse { data: rows, total })
}

/// Create a new work item for the authenticated user.
///
/// Validates story points (must be 1, 3, 5, 8, or `None`) and returns
/// the full item with an empty subtasks list.
///
/// # Errors
///
/// - [`AppError::Validation`] — invalid story_points value.
/// - [`AppError::Db`] — database failure.
pub async fn create_work_item(
    state: &AppState,
    user_id: Uuid,
    req: CreateWorkItemRequest,
) -> AppResult<WorkItemResponse> {
    validate_story_points(req.story_points)?;

    let item_type = req
        .item_type
        .as_ref()
        .map(|t| t.as_str())
        .unwrap_or("task");
    let status = req
        .status
        .as_ref()
        .map(|s| s.as_str())
        .unwrap_or("backlog");
    let priority = req
        .priority
        .as_ref()
        .map(|p| p.as_str())
        .unwrap_or("medium");
    let position = 0_i32;

    // Inherit the project from the sprint when not explicitly provided, so a
    // work item created inside a sprint (e.g. board quick-create) is never
    // orphaned with a NULL project_id and stays visible under project filters.
    let project_id: Option<Uuid> = match (req.project_id, req.sprint_id) {
        (Some(p), _) => Some(p),
        (None, Some(sprint_id)) => sqlx::query_scalar!(
            r#"SELECT project_id FROM sprints WHERE id = $1 AND user_id = $2"#,
            sprint_id,
            user_id,
        )
        .fetch_optional(&state.db)
        .await?
        .flatten(),
        (None, None) => None,
    };

    // Per-(user, project) sequence number for the human key (`MML-12`).
    // An advisory xact lock serializes concurrent creates for the same scope
    // so two inserts cannot compute the same MAX(seq_id) + 1.
    let mut tx = state.db.begin().await?;
    sqlx::query(
        "SELECT pg_advisory_xact_lock(hashtext($1::uuid::text || ':' || COALESCE($2::uuid::text, '')))",
    )
    .bind(user_id)
    .bind(project_id)
    .execute(&mut *tx)
    .await?;
    let seq_id: i32 = sqlx::query_scalar(
        "SELECT (COALESCE(MAX(seq_id), 0) + 1)::int FROM work_items \
         WHERE user_id = $1 AND project_id IS NOT DISTINCT FROM $2",
    )
    .bind(user_id)
    .bind(project_id)
    .fetch_one(&mut *tx)
    .await?;

    let item = sqlx::query_as!(
        WorkItem,
        r#"
        INSERT INTO work_items (
            user_id, project_id, epic_id, sprint_id, type, title, description,
            status, priority, story_points, position,
            start_date, due_date, recurrence_rule,
            labels, github_repo, github_branch, github_pr, seq_id
        )
        VALUES (
            $1, $2, $3, $4,
            ($5::text)::work_item_type,
            $6, $7,
            ($8::text)::work_item_status,
            ($9::text)::task_priority,
            $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
        )
        RETURNING
            id, user_id, project_id, epic_id, sprint_id,
            type::text     AS "item_type!",
            title, description,
            status::text   AS "status!",
            priority::text AS "priority!",
            story_points, position,
            start_date, due_date, recurrence_rule, completed_at,
            column_id,
            labels AS "labels!: Vec<String>",
            pinned_fields AS "pinned_fields!: Vec<String>",
            github_repo, github_branch, github_pr,
            created_at, updated_at
        "#,
        user_id,
        project_id as Option<Uuid>,
        req.epic_id    as Option<Uuid>,
        req.sprint_id  as Option<Uuid>,
        item_type,
        req.title,
        req.description,
        status,
        priority,
        req.story_points,
        position,
        req.start_date,
        req.due_date,
        req.recurrence_rule,
        &req.labels as &[String],
        req.github_repo,
        req.github_branch,
        req.github_pr,
        seq_id,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    record_activity(state, item.id, user_id, "created", None, None).await;

    attach_item_key(state, work_item_into_response(item, vec![])).await
}

/// Fetch a single work item with its subtasks, enforcing ownership.
///
/// # Errors
///
/// - [`AppError::NotFound`] — item not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn get_work_item(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
) -> AppResult<WorkItemResponse> {
    fetch_work_item_with_subtasks(state, user_id, item_id).await
}

/// Parse a human key such as `MML-12` into its uppercase prefix and sequence.
fn parse_item_key(raw: &str) -> Option<(String, i32)> {
    let (prefix, seq) = raw.trim().rsplit_once('-')?;
    let prefix = prefix.to_ascii_uppercase();
    if !(2..=5).contains(&prefix.len()) || !prefix.chars().all(|c| c.is_ascii_uppercase()) {
        return None;
    }
    let seq: i32 = seq.parse().ok().filter(|n| *n > 0)?;
    Some((prefix, seq))
}

/// Fetch a work item by its human key (e.g. `MML-12`), scoped to `user_id`.
///
/// Items without a project use the `WI` prefix. If a project key and the `WI`
/// prefix collide, the project's item wins.
///
/// # Errors
///
/// - [`AppError::Validation`] — the key is not `<2-5 letters>-<number>`.
/// - [`AppError::NotFound`] — no matching live item for this user.
/// - [`AppError::Db`] — database failure.
pub async fn get_work_item_by_key(
    state: &AppState,
    user_id: Uuid,
    raw_key: &str,
) -> AppResult<WorkItemResponse> {
    let (prefix, seq) = parse_item_key(raw_key)
        .ok_or_else(|| AppError::Validation("key must look like MML-12".to_owned()))?;

    let item_id: Uuid = sqlx::query_scalar(
        r#"
        SELECT wi.id
          FROM work_items wi
          LEFT JOIN projects p ON p.id = wi.project_id
         WHERE wi.user_id = $1
           AND wi.deleted_at IS NULL
           AND wi.seq_id = $3
           AND COALESCE(p.key, 'WI') = $2
         ORDER BY (wi.project_id IS NULL), wi.created_at
         LIMIT 1
        "#,
    )
    .bind(user_id)
    .bind(prefix)
    .bind(seq)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    fetch_work_item_with_subtasks(state, user_id, item_id).await
}

/// Partially update a work item; only provided fields are mutated.
///
/// Emits [`DomainEvent::WorkItemCompleted`] when `status` transitions to `done`.
///
/// # Errors
///
/// - [`AppError::Validation`] — invalid story_points.
/// - [`AppError::NotFound`] — item not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn update_work_item(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
    req: UpdateWorkItemRequest,
) -> AppResult<WorkItemResponse> {
    validate_story_points(req.story_points)?;

    // Fetch current row for coalescing.
    let current = sqlx::query_as!(
        WorkItem,
        r#"
        SELECT
            id, user_id, project_id, epic_id, sprint_id,
            type::text     AS "item_type!",
            title, description,
            status::text   AS "status!",
            priority::text AS "priority!",
            story_points, position,
            start_date, due_date, recurrence_rule, completed_at,
            column_id,
            labels AS "labels!: Vec<String>",
            pinned_fields AS "pinned_fields!: Vec<String>",
            github_repo, github_branch, github_pr,
            created_at, updated_at
        FROM work_items
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        "#,
        item_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let new_title = req
        .title
        .as_deref()
        .unwrap_or(current.title.as_str())
        .to_owned();
    let new_description = if req.description.is_some() {
        req.description.clone()
    } else {
        current.description.clone()
    };
    let new_type = req
        .item_type
        .as_ref()
        .map(|t| t.as_str())
        .unwrap_or(current.item_type.as_str())
        .to_owned();
    let new_status = req
        .status
        .as_ref()
        .map(|s| s.as_str())
        .unwrap_or(current.status.as_str())
        .to_owned();
    let new_priority = req
        .priority
        .as_ref()
        .map(|p| p.as_str())
        .unwrap_or(current.priority.as_str())
        .to_owned();
    let new_story_points = if req.story_points.is_some() {
        req.story_points
    } else {
        current.story_points
    };
    let new_position = req.position.unwrap_or(current.position);
    let new_due_date = if req.due_date.is_some() {
        req.due_date
    } else {
        current.due_date
    };
    let new_recurrence = if req.recurrence_rule.is_some() {
        req.recurrence_rule.clone()
    } else {
        current.recurrence_rule.clone()
    };

    // project_id / epic_id / sprint_id: explicit null vs absent is ambiguous in
    // JSON PATCH.  We treat a provided UUID as a change and absence as "keep
    // current".  Frontend must explicitly send `null` to clear the field.
    // serde deserialises absent keys as `None`, but we cannot distinguish
    // "absent" from "explicitly null" without `Option<Option<Uuid>>`.
    // For simplicity (matching goal module pattern), we keep current if None.
    let new_project_id = if req.project_id.is_some() {
        req.project_id
    } else {
        current.project_id
    };
    let new_epic_id = if req.epic_id.is_some() {
        req.epic_id
    } else {
        current.epic_id
    };
    let new_sprint_id = if req.sprint_id.is_some() {
        req.sprint_id
    } else {
        current.sprint_id
    };

    let new_start_date = if req.start_date.is_some() {
        req.start_date
    } else {
        current.start_date
    };
    let new_labels = req.labels.as_deref().unwrap_or(&current.labels).to_vec();
    let new_pinned_fields = req
        .pinned_fields
        .as_deref()
        .unwrap_or(&current.pinned_fields)
        .to_vec();
    let new_github_repo = if req.github_repo.is_some() {
        req.github_repo.clone()
    } else {
        current.github_repo.clone()
    };
    let new_github_branch = if req.github_branch.is_some() {
        req.github_branch.clone()
    } else {
        current.github_branch.clone()
    };
    let new_github_pr = if req.github_pr.is_some() {
        req.github_pr.clone()
    } else {
        current.github_pr.clone()
    };

    // Set `completed_at` when transitioning TO done; clear when transitioning away.
    let new_completed_at = if new_status == "done" && current.status != "done" {
        Some(Utc::now())
    } else if new_status != "done" {
        None
    } else {
        current.completed_at
    };

    let updated = sqlx::query_as!(
        WorkItem,
        r#"
        UPDATE work_items
        SET
            project_id      = $3,
            epic_id         = $4,
            sprint_id       = $5,
            type            = ($6::text)::work_item_type,
            title           = $7,
            description     = $8,
            status          = ($9::text)::work_item_status,
            priority        = ($10::text)::task_priority,
            story_points    = $11,
            position        = $12,
            start_date      = $13,
            due_date        = $14,
            recurrence_rule = $15,
            completed_at    = $16,
            labels          = $17,
            pinned_fields   = $21,
            github_repo     = $18,
            github_branch   = $19,
            github_pr       = $20,
            updated_at      = now()
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        RETURNING
            id, user_id, project_id, epic_id, sprint_id,
            type::text     AS "item_type!",
            title, description,
            status::text   AS "status!",
            priority::text AS "priority!",
            story_points, position,
            start_date, due_date, recurrence_rule, completed_at,
            column_id,
            labels AS "labels!: Vec<String>",
            pinned_fields AS "pinned_fields!: Vec<String>",
            github_repo, github_branch, github_pr,
            created_at, updated_at
        "#,
        item_id,
        user_id,
        new_project_id as Option<Uuid>,
        new_epic_id    as Option<Uuid>,
        new_sprint_id  as Option<Uuid>,
        new_type,
        new_title,
        new_description,
        new_status,
        new_priority,
        new_story_points,
        new_position,
        new_start_date,
        new_due_date,
        new_recurrence,
        new_completed_at,
        &new_labels as &[String],
        new_github_repo,
        new_github_branch,
        new_github_pr,
        &new_pinned_fields as &[String],
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // Emit domain event when transitioning to done.
    if current.status != "done" && updated.status == "done" {
        let _ = state.events.send(DomainEvent::WorkItemCompleted {
            work_item_id: updated.id,
            user_id,
            sprint_id: updated.sprint_id,
        });
    }

    // Record field changes to the activity log (best-effort, never blocks).
    let fmt_date =
        |d: &Option<chrono::DateTime<Utc>>| d.map(|x| x.format("%Y-%m-%d").to_string());
    record_change(state, item_id, user_id, "status", Some(current.status.clone()), Some(updated.status.clone())).await;
    record_change(state, item_id, user_id, "priority", Some(current.priority.clone()), Some(updated.priority.clone())).await;
    record_change(state, item_id, user_id, "title", Some(current.title.clone()), Some(updated.title.clone())).await;
    record_change(state, item_id, user_id, "due_date", fmt_date(&current.due_date), fmt_date(&updated.due_date)).await;
    record_change(state, item_id, user_id, "start_date", fmt_date(&current.start_date), fmt_date(&updated.start_date)).await;
    record_change(state, item_id, user_id, "story_points", current.story_points.map(|p| p.to_string()), updated.story_points.map(|p| p.to_string())).await;
    record_change(state, item_id, user_id, "sprint", current.sprint_id.map(|i| i.to_string()), updated.sprint_id.map(|i| i.to_string())).await;
    record_change(state, item_id, user_id, "parent", current.epic_id.map(|i| i.to_string()), updated.epic_id.map(|i| i.to_string())).await;

    let subtasks = sqlx::query_as!(
        WorkItemSubtask,
        r#"
        SELECT id, work_item_id, title, is_done, position, created_at, updated_at
        FROM work_item_subtasks
        WHERE work_item_id = $1
        ORDER BY position ASC, created_at ASC
        "#,
        item_id,
    )
    .fetch_all(&state.db)
    .await?;

    attach_item_key(state, work_item_into_response(updated, subtasks)).await
}

/// Soft-delete a work item, enforcing ownership.
///
/// Sets `deleted_at = now()` so the item disappears from normal views but can
/// be restored from the trash. Subtasks remain attached to the (hidden) item.
///
/// # Errors
///
/// - [`AppError::NotFound`] — item not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn delete_work_item(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
) -> AppResult<()> {
    let result = sqlx::query!(
        "UPDATE work_items SET deleted_at = now(), updated_at = now() \
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL",
        item_id,
        user_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}

/// Restore a soft-deleted work item, enforcing ownership.
///
/// Clears `deleted_at` so the item reappears in normal views.
///
/// # Errors
///
/// - [`AppError::NotFound`] — item not found, owned by a different user, or
///   not currently soft-deleted.
/// - [`AppError::Db`] — database failure.
pub async fn restore_work_item(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
) -> AppResult<()> {
    let result = sqlx::query!(
        "UPDATE work_items SET deleted_at = NULL, updated_at = now() \
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL",
        item_id,
        user_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}

/// Permanently delete a work item, enforcing ownership.
///
/// This is a real `DELETE` that cascade-deletes subtasks via the database FK
/// constraint. Unlike [`delete_work_item`], the row is gone for good.
///
/// # Errors
///
/// - [`AppError::NotFound`] — item not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn purge_work_item(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
) -> AppResult<()> {
    let result = sqlx::query!(
        "DELETE FROM work_items WHERE id = $1 AND user_id = $2",
        item_id,
        user_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}

// ── Status / Points / Sprint transitions ──────────────────────────────────────

/// Set the status of a work item.
///
/// Automatically sets `completed_at = now()` when transitioning to `done`
/// and clears it when moving away from `done`.
/// Emits [`DomainEvent::WorkItemCompleted`] on `done` transition.
///
/// # Errors
///
/// - [`AppError::NotFound`] — item not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn set_status(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
    req: SetStatusRequest,
) -> AppResult<WorkItemResponse> {
    let new_status = req.status.as_str();

    // Fetch current status for transition detection.
    let current_status: String = sqlx::query_scalar!(
        r#"SELECT status::text AS "status!" FROM work_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL"#,
        item_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let completed_at = if new_status == "done" && current_status != "done" {
        Some(Utc::now())
    } else if new_status != "done" {
        None
    } else {
        // Already done — preserve existing completed_at.
        sqlx::query_scalar!(
            "SELECT completed_at FROM work_items WHERE id = $1",
            item_id,
        )
        .fetch_one(&state.db)
        .await?
    };

    let updated = sqlx::query_as!(
        WorkItem,
        r#"
        UPDATE work_items wi
        SET
            status       = ($3::text)::work_item_status,
            completed_at = $4,
            -- Keep the board card in sync: move it to the column whose
            -- mapped_status matches the new status (same project scope).
            -- Falls back to the current column when no such column exists.
            column_id    = COALESCE(
                (SELECT bc.id FROM board_columns bc
                 WHERE bc.user_id = $2
                   AND bc.mapped_status = ($3::text)::work_item_status
                   AND (bc.project_id IS NOT DISTINCT FROM wi.project_id)
                 ORDER BY bc.position ASC
                 LIMIT 1),
                wi.column_id),
            updated_at   = now()
        WHERE wi.id = $1 AND wi.user_id = $2 AND wi.deleted_at IS NULL
        RETURNING
            id, user_id, project_id, epic_id, sprint_id,
            type::text     AS "item_type!",
            title, description,
            status::text   AS "status!",
            priority::text AS "priority!",
            story_points, position,
            start_date, due_date, recurrence_rule, completed_at,
            column_id,
            labels AS "labels!: Vec<String>",
            pinned_fields AS "pinned_fields!: Vec<String>",
            github_repo, github_branch, github_pr,
            created_at, updated_at
        "#,
        item_id,
        user_id,
        new_status,
        completed_at,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    if current_status != "done" && updated.status == "done" {
        let _ = state.events.send(DomainEvent::WorkItemCompleted {
            work_item_id: updated.id,
            user_id,
            sprint_id: updated.sprint_id,
        });
    }

    record_change(
        state,
        item_id,
        user_id,
        "status",
        Some(current_status),
        Some(updated.status.clone()),
    )
    .await;

    let subtasks = sqlx::query_as!(
        WorkItemSubtask,
        r#"
        SELECT id, work_item_id, title, is_done, position, created_at, updated_at
        FROM work_item_subtasks
        WHERE work_item_id = $1
        ORDER BY position ASC, created_at ASC
        "#,
        item_id,
    )
    .fetch_all(&state.db)
    .await?;

    attach_item_key(state, work_item_into_response(updated, subtasks)).await
}

/// Set story points on a work item.
///
/// Accepts 1, 3, 5, 8, or `null` (unestimated). Any other value returns 422.
///
/// # Errors
///
/// - [`AppError::Validation`] — invalid points value.
/// - [`AppError::NotFound`] — item not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn set_points(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
    req: SetPointsRequest,
) -> AppResult<WorkItemResponse> {
    validate_story_points(req.story_points)?;

    let updated = sqlx::query_as!(
        WorkItem,
        r#"
        UPDATE work_items
        SET story_points = $3, updated_at = now()
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        RETURNING
            id, user_id, project_id, epic_id, sprint_id,
            type::text     AS "item_type!",
            title, description,
            status::text   AS "status!",
            priority::text AS "priority!",
            story_points, position,
            start_date, due_date, recurrence_rule, completed_at,
            column_id,
            labels AS "labels!: Vec<String>",
            pinned_fields AS "pinned_fields!: Vec<String>",
            github_repo, github_branch, github_pr,
            created_at, updated_at
        "#,
        item_id,
        user_id,
        req.story_points,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let subtasks = sqlx::query_as!(
        WorkItemSubtask,
        r#"
        SELECT id, work_item_id, title, is_done, position, created_at, updated_at
        FROM work_item_subtasks
        WHERE work_item_id = $1
        ORDER BY position ASC, created_at ASC
        "#,
        item_id,
    )
    .fetch_all(&state.db)
    .await?;

    attach_item_key(state, work_item_into_response(updated, subtasks)).await
}

// ── bulk operations ────────────────────────────────────────────────────────────

/// Columns read under `FOR UPDATE` so a bulk update can compute each row's new
/// state (completed_at, labels, activity diffs) from its current values.
#[derive(Debug, sqlx::FromRow)]
struct BulkSnapshot {
    id: Uuid,
    sprint_id: Option<Uuid>,
    status: String,
    priority: String,
    story_points: Option<i32>,
    labels: Vec<String>,
    completed_at: Option<chrono::DateTime<Utc>>,
}

/// Trim labels, drop empties and duplicates while keeping first-seen order.
fn normalize_labels(raw: &[String]) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for label in raw {
        let t = label.trim();
        if !t.is_empty() && !out.iter().any(|x| x == t) {
            out.push(t.to_owned());
        }
    }
    out
}

/// Insert one `work_item_activity` row inside an open transaction when the
/// value actually changed (mirrors [`record_change`], but transactional).
async fn tx_record_change(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    work_item_id: Uuid,
    user_id: Uuid,
    field: &str,
    old: Option<String>,
    new: Option<String>,
) -> AppResult<()> {
    if old == new {
        return Ok(());
    }
    sqlx::query(
        "INSERT INTO work_item_activity \
         (id, work_item_id, user_id, field, old_value, new_value) \
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(Uuid::new_v4())
    .bind(work_item_id)
    .bind(user_id)
    .bind(field)
    .bind(old)
    .bind(new)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Apply a bulk `update` or `delete` to the caller's selected work items.
///
/// Only rows owned by `user_id` and not soft-deleted are touched. The whole
/// operation runs in a single transaction. Mirrors the single-item semantics:
/// `completed_at` follows status transitions, activity rows are written for
/// status / priority / story_points / sprint changes, and
/// [`DomainEvent::WorkItemCompleted`] is emitted for each item that becomes done.
///
/// # Errors
///
/// - [`AppError::Validation`] — empty patch, conflicting sprint flags, or
///   invalid story points.
/// - [`AppError::NotFoundMsg`] — target sprint not found / not owned.
/// - [`AppError::Db`] — database failure.
pub async fn bulk_work_items(
    state: &AppState,
    user_id: Uuid,
    req: super::models::BulkWorkItemRequest,
) -> AppResult<super::models::BulkWorkItemResponse> {
    use super::models::{BulkAction, BulkWorkItemResponse};

    let mut ids = req.ids;
    ids.sort_unstable();
    ids.dedup();

    match req.action {
        BulkAction::Delete => {
            let mut tx = state.db.begin().await?;
            let result = sqlx::query(
                "UPDATE work_items SET deleted_at = now(), updated_at = now() \
                 WHERE user_id = $1 AND id = ANY($2) AND deleted_at IS NULL",
            )
            .bind(user_id)
            .bind(&ids)
            .execute(&mut *tx)
            .await?;
            tx.commit().await?;
            Ok(BulkWorkItemResponse {
                updated: result.rows_affected(),
            })
        }
        BulkAction::Update => {
            let patch = req.patch.ok_or_else(|| {
                AppError::Validation("patch is required for action 'update'".to_owned())
            })?;
            bulk_update_items(state, user_id, &ids, patch).await
        }
    }
}

async fn bulk_update_items(
    state: &AppState,
    user_id: Uuid,
    ids: &[Uuid],
    patch: super::models::BulkPatch,
) -> AppResult<super::models::BulkWorkItemResponse> {
    use super::models::BulkWorkItemResponse;

    validate_story_points(patch.story_points)?;
    if patch.sprint_id.is_some() && patch.clear_sprint {
        return Err(AppError::Validation(
            "sprint_id and clear_sprint are mutually exclusive".to_owned(),
        ));
    }
    if patch.story_points.is_some() && patch.clear_story_points {
        return Err(AppError::Validation(
            "story_points and clear_story_points are mutually exclusive".to_owned(),
        ));
    }

    let add_labels = normalize_labels(&patch.add_labels);
    let remove_labels = normalize_labels(&patch.remove_labels);
    let has_change = patch.status.is_some()
        || patch.priority.is_some()
        || patch.item_type.is_some()
        || patch.sprint_id.is_some()
        || patch.clear_sprint
        || patch.story_points.is_some()
        || patch.clear_story_points
        || !add_labels.is_empty()
        || !remove_labels.is_empty();
    if !has_change {
        return Err(AppError::Validation(
            "patch must change at least one field".to_owned(),
        ));
    }

    if let Some(sprint_id) = patch.sprint_id {
        let exists = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM sprints WHERE id = $1 AND user_id = $2",
        )
        .bind(sprint_id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?;
        if exists.is_none() {
            return Err(AppError::NotFoundMsg("sprint not found".to_owned()));
        }
    }

    let mut tx = state.db.begin().await?;

    let snapshots = sqlx::query_as::<_, BulkSnapshot>(
        "SELECT id, sprint_id, status::text AS status, priority::text AS priority, \
                story_points, labels, completed_at \
         FROM work_items \
         WHERE user_id = $1 AND id = ANY($2) AND deleted_at IS NULL \
         FOR UPDATE",
    )
    .bind(user_id)
    .bind(ids)
    .fetch_all(&mut *tx)
    .await?;

    let mut completed_ids: Vec<(Uuid, Option<Uuid>)> = Vec::new();

    for cur in &snapshots {
        let new_status = patch
            .status
            .as_ref()
            .map(|s| s.as_str())
            .unwrap_or(cur.status.as_str())
            .to_owned();
        let new_priority = patch
            .priority
            .as_ref()
            .map(|p| p.as_str())
            .unwrap_or(cur.priority.as_str())
            .to_owned();
        let new_type = patch.item_type.as_ref().map(|t| t.as_str().to_owned());
        let new_sprint_id = if patch.clear_sprint {
            None
        } else {
            patch.sprint_id.or(cur.sprint_id)
        };
        let new_story_points = if patch.clear_story_points {
            None
        } else {
            patch.story_points.or(cur.story_points)
        };
        let mut new_labels = cur.labels.clone();
        new_labels.retain(|l| !remove_labels.contains(l));
        for label in &add_labels {
            if !new_labels.contains(label) {
                new_labels.push(label.clone());
            }
        }
        let status_changed = new_status != cur.status;

        // Same rule as set_status / update_work_item.
        let new_completed_at = if new_status == "done" && cur.status != "done" {
            Some(Utc::now())
        } else if new_status != "done" {
            None
        } else {
            cur.completed_at
        };

        sqlx::query(
            r#"
            UPDATE work_items wi
            SET
                status       = ($3::text)::work_item_status,
                priority     = ($4::text)::task_priority,
                type         = COALESCE(($5::text)::work_item_type, wi.type),
                sprint_id    = $6,
                story_points = $7,
                labels       = $8,
                completed_at = $9,
                column_id    = CASE WHEN $10::bool THEN COALESCE(
                    (SELECT bc.id FROM board_columns bc
                     WHERE bc.user_id = $2
                       AND bc.mapped_status = ($3::text)::work_item_status
                       AND (bc.project_id IS NOT DISTINCT FROM wi.project_id)
                     ORDER BY bc.position ASC
                     LIMIT 1),
                    wi.column_id)
                    ELSE wi.column_id END,
                updated_at   = now()
            WHERE wi.id = $1 AND wi.user_id = $2 AND wi.deleted_at IS NULL
            "#,
        )
        .bind(cur.id)
        .bind(user_id)
        .bind(&new_status)
        .bind(&new_priority)
        .bind(new_type)
        .bind(new_sprint_id)
        .bind(new_story_points)
        .bind(&new_labels)
        .bind(new_completed_at)
        .bind(status_changed)
        .execute(&mut *tx)
        .await?;

        if cur.status != "done" && new_status == "done" {
            completed_ids.push((cur.id, new_sprint_id));
        }

        tx_record_change(&mut tx, cur.id, user_id, "status", Some(cur.status.clone()), Some(new_status.clone())).await?;
        tx_record_change(&mut tx, cur.id, user_id, "priority", Some(cur.priority.clone()), Some(new_priority.clone())).await?;
        tx_record_change(&mut tx, cur.id, user_id, "story_points", cur.story_points.map(|p| p.to_string()), new_story_points.map(|p| p.to_string())).await?;
        tx_record_change(&mut tx, cur.id, user_id, "sprint", cur.sprint_id.map(|i| i.to_string()), new_sprint_id.map(|i| i.to_string())).await?;
    }

    tx.commit().await?;

    for (work_item_id, sprint_id) in completed_ids {
        let _ = state.events.send(DomainEvent::WorkItemCompleted {
            work_item_id,
            user_id,
            sprint_id,
        });
    }

    Ok(BulkWorkItemResponse {
        updated: snapshots.len() as u64,
    })
}

/// Move a work item to a sprint.
///
/// Validates sprint ownership and, when the sprint has `capacity_points > 0`,
/// checks that adding this item does not exceed capacity. Returns **409** if it
/// would overflow.
///
/// # Errors
///
/// - [`AppError::NotFound`] — work item or sprint not found / not owned.
/// - [`AppError::Conflict`] — sprint capacity would be exceeded.
/// - [`AppError::Db`] — database failure.
pub async fn move_to_sprint(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
    req: MoveToSprintRequest,
) -> AppResult<WorkItemResponse> {
    let sprint_id = req.sprint_id;

    // Verify sprint ownership and load capacity.
    let sprint = sqlx::query!(
        r#"
        SELECT capacity_points, status::text AS "status!"
        FROM sprints
        WHERE id = $1 AND user_id = $2
        "#,
        sprint_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // Load the item to know its story points and current sprint.
    let item = sqlx::query!(
        r#"
        SELECT sprint_id, story_points
        FROM work_items
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        "#,
        item_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // Capacity check: only enforce when capacity > 0 AND the item is not already
    // assigned to this sprint (re-ordering within the same sprint is allowed).
    if sprint.capacity_points > 0 && item.sprint_id != Some(sprint_id) {
        let item_points = item.story_points.unwrap_or(0);

        let planned: i64 = sqlx::query_scalar!(
            r#"
            SELECT COALESCE(SUM(COALESCE(story_points, 0)), 0)
            FROM work_items
            WHERE sprint_id = $1 AND deleted_at IS NULL
            "#,
            sprint_id,
        )
        .fetch_one(&state.db)
        .await?
        .unwrap_or(0);

        if planned + i64::from(item_points) > i64::from(sprint.capacity_points) {
            return Err(AppError::Conflict(format!(
                "adding this item ({item_points} pts) would exceed the sprint capacity \
                 ({} pts planned, {} pts cap)",
                planned, sprint.capacity_points
            )));
        }
    }

    let position = req.position.unwrap_or(0);

    let updated = sqlx::query_as!(
        WorkItem,
        r#"
        UPDATE work_items
        SET sprint_id = $3, position = $4, updated_at = now()
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        RETURNING
            id, user_id, project_id, epic_id, sprint_id,
            type::text     AS "item_type!",
            title, description,
            status::text   AS "status!",
            priority::text AS "priority!",
            story_points, position,
            start_date, due_date, recurrence_rule, completed_at,
            column_id,
            labels AS "labels!: Vec<String>",
            pinned_fields AS "pinned_fields!: Vec<String>",
            github_repo, github_branch, github_pr,
            created_at, updated_at
        "#,
        item_id,
        user_id,
        sprint_id as Uuid,
        position,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let subtasks = sqlx::query_as!(
        WorkItemSubtask,
        r#"
        SELECT id, work_item_id, title, is_done, position, created_at, updated_at
        FROM work_item_subtasks
        WHERE work_item_id = $1
        ORDER BY position ASC, created_at ASC
        "#,
        item_id,
    )
    .fetch_all(&state.db)
    .await?;

    attach_item_key(state, work_item_into_response(updated, subtasks)).await
}

/// Move a work item to the backlog (sets `sprint_id = NULL`).
///
/// # Errors
///
/// - [`AppError::NotFound`] — item not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn move_to_backlog(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
    req: MoveToBacklogRequest,
) -> AppResult<WorkItemResponse> {
    let position = req.position.unwrap_or(0);

    let updated = sqlx::query_as!(
        WorkItem,
        r#"
        UPDATE work_items
        SET sprint_id = NULL, position = $3, updated_at = now()
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        RETURNING
            id, user_id, project_id, epic_id, sprint_id,
            type::text     AS "item_type!",
            title, description,
            status::text   AS "status!",
            priority::text AS "priority!",
            story_points, position,
            start_date, due_date, recurrence_rule, completed_at,
            column_id,
            labels AS "labels!: Vec<String>",
            pinned_fields AS "pinned_fields!: Vec<String>",
            github_repo, github_branch, github_pr,
            created_at, updated_at
        "#,
        item_id,
        user_id,
        position,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let subtasks = sqlx::query_as!(
        WorkItemSubtask,
        r#"
        SELECT id, work_item_id, title, is_done, position, created_at, updated_at
        FROM work_item_subtasks
        WHERE work_item_id = $1
        ORDER BY position ASC, created_at ASC
        "#,
        item_id,
    )
    .fetch_all(&state.db)
    .await?;

    attach_item_key(state, work_item_into_response(updated, subtasks)).await
}

// ── Subtasks ───────────────────────────────────────────────────────────────────

/// List all subtasks for a work item, verifying item ownership.
///
/// # Errors
///
/// - [`AppError::NotFound`] — work item not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn list_subtasks(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
) -> AppResult<Vec<WorkItemSubtask>> {
    // Ownership check.
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM work_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL)",
        item_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound);
    }

    let rows = sqlx::query_as!(
        WorkItemSubtask,
        r#"
        SELECT id, work_item_id, title, is_done, position, created_at, updated_at
        FROM work_item_subtasks
        WHERE work_item_id = $1
        ORDER BY position ASC, created_at ASC
        "#,
        item_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

/// Add a subtask to a work item.
///
/// The new subtask is appended at `position = (max existing position) + 1`.
///
/// # Errors
///
/// - [`AppError::NotFound`] — work item not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn add_subtask(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
    req: CreateSubtaskRequest,
) -> AppResult<WorkItemSubtask> {
    // Ownership check.
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM work_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL)",
        item_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound);
    }

    // Position = next available slot.
    let next_position: i32 = sqlx::query_scalar!(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM work_item_subtasks WHERE work_item_id = $1",
        item_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    let subtask = sqlx::query_as!(
        WorkItemSubtask,
        r#"
        INSERT INTO work_item_subtasks (work_item_id, title, position)
        VALUES ($1, $2, $3)
        RETURNING id, work_item_id, title, is_done, position, created_at, updated_at
        "#,
        item_id,
        req.title,
        next_position,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(subtask)
}

/// Update a subtask, verifying that the parent item belongs to the user.
///
/// # Errors
///
/// - [`AppError::NotFound`] — subtask or parent item not found / not owned.
/// - [`AppError::Db`] — database failure.
pub async fn update_subtask(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
    subtask_id: Uuid,
    req: UpdateSubtaskRequest,
) -> AppResult<WorkItemSubtask> {
    // Verify item ownership.
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM work_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL)",
        item_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound);
    }

    // Fetch current subtask.
    let current = sqlx::query_as!(
        WorkItemSubtask,
        r#"
        SELECT id, work_item_id, title, is_done, position, created_at, updated_at
        FROM work_item_subtasks
        WHERE id = $1 AND work_item_id = $2
        "#,
        subtask_id,
        item_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let new_title = req
        .title
        .as_deref()
        .unwrap_or(current.title.as_str())
        .to_owned();
    let new_is_done = req.is_done.unwrap_or(current.is_done);
    let new_position = req.position.unwrap_or(current.position);

    let updated = sqlx::query_as!(
        WorkItemSubtask,
        r#"
        UPDATE work_item_subtasks
        SET title = $3, is_done = $4, position = $5, updated_at = now()
        WHERE id = $1 AND work_item_id = $2
        RETURNING id, work_item_id, title, is_done, position, created_at, updated_at
        "#,
        subtask_id,
        item_id,
        new_title,
        new_is_done,
        new_position,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(updated)
}

/// Delete a subtask, verifying that the parent item belongs to the user.
///
/// # Errors
///
/// - [`AppError::NotFound`] — subtask or parent item not found / not owned.
/// - [`AppError::Db`] — database failure.
pub async fn delete_subtask(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
    subtask_id: Uuid,
) -> AppResult<()> {
    // Verify item ownership.
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM work_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL)",
        item_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound);
    }

    let result = sqlx::query!(
        "DELETE FROM work_item_subtasks WHERE id = $1 AND work_item_id = $2",
        subtask_id,
        item_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}

// ── Column assignment ──────────────────────────────────────────────────────────

/// Set the board column for a work item.
///
/// If `req.column_id` is `Some(id)` the item is moved to that column and, when
/// the column has a non-null `mapped_status`, the item's `status` is also
/// updated to keep enum-based views (Backlog, Sprints, Reviews, Analytics)
/// consistent.
///
/// If `req.column_id` is `None` the column assignment is cleared.
///
/// Returns the flat [`WorkItemResponse`] (with subtasks).
///
/// # Errors
///
/// - [`AppError::NotFound`] — work item or target column not found / not owned.
/// - [`AppError::Db`] — database failure.
pub async fn set_column(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
    req: SetColumnRequest,
) -> AppResult<WorkItemResponse> {
    // Verify ownership of the work item.
    let item_exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM work_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL)",
        item_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !item_exists {
        return Err(AppError::NotFound);
    }

    // When a target column is given, look up its mapped_status and verify ownership.
    let mapped_status: Option<String> = if let Some(col_id) = req.column_id {
        let row = sqlx::query!(
            r#"
            SELECT mapped_status::text AS "mapped_status?"
            FROM board_columns
            WHERE id = $1 AND user_id = $2
            "#,
            col_id,
            user_id,
        )
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

        row.mapped_status
    } else {
        None
    };

    // Build the UPDATE. When mapped_status is present we also advance the
    // work item's status enum so enum-based views stay in sync.
    let updated = if let Some(ref new_status) = mapped_status {
        sqlx::query_as!(
            WorkItem,
            r#"
            UPDATE work_items
            SET column_id  = $3,
                status     = ($4::text)::work_item_status,
                updated_at = now()
            WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
            RETURNING
                id, user_id, project_id, epic_id, sprint_id,
                type::text     AS "item_type!",
                title, description,
                status::text   AS "status!",
                priority::text AS "priority!",
                story_points, position,
                start_date, due_date, recurrence_rule, completed_at,
                column_id,
                labels AS "labels!: Vec<String>",
                pinned_fields AS "pinned_fields!: Vec<String>",
                github_repo, github_branch, github_pr,
                created_at, updated_at
            "#,
            item_id,
            user_id,
            req.column_id as Option<Uuid>,
            new_status,
        )
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?
    } else {
        sqlx::query_as!(
            WorkItem,
            r#"
            UPDATE work_items
            SET column_id  = $3,
                updated_at = now()
            WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
            RETURNING
                id, user_id, project_id, epic_id, sprint_id,
                type::text     AS "item_type!",
                title, description,
                status::text   AS "status!",
                priority::text AS "priority!",
                story_points, position,
                start_date, due_date, recurrence_rule, completed_at,
                column_id,
                labels AS "labels!: Vec<String>",
                pinned_fields AS "pinned_fields!: Vec<String>",
                github_repo, github_branch, github_pr,
                created_at, updated_at
            "#,
            item_id,
            user_id,
            req.column_id as Option<Uuid>,
        )
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?
    };

    let subtasks = sqlx::query_as!(
        WorkItemSubtask,
        r#"
        SELECT id, work_item_id, title, is_done, position, created_at, updated_at
        FROM work_item_subtasks
        WHERE work_item_id = $1
        ORDER BY position ASC, created_at ASC
        "#,
        item_id,
    )
    .fetch_all(&state.db)
    .await?;

    attach_item_key(state, work_item_into_response(updated, subtasks)).await
}

// ── Nested list helpers (called by epic/sprint modules) ───────────────────────

/// List work items belonging to a specific sprint, verifying sprint ownership.
///
/// Accepts an optional `status` text filter. Returns the same
/// `{ data, total }` envelope as `list_work_items`.
///
/// # Errors
///
/// - [`AppError::NotFound`] — sprint not found or not owned by the user.
/// - [`AppError::Db`] — database failure.
pub async fn list_items_for_sprint(
    state: &AppState,
    user_id: Uuid,
    sprint_id: Uuid,
    status_filter: Option<&str>,
) -> AppResult<WorkItemListResponse> {
    // Ownership check on the sprint.
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM sprints WHERE id = $1 AND user_id = $2)",
        sprint_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound);
    }

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
        WHERE wi.sprint_id = $1
          AND wi.deleted_at IS NULL
          AND ($2::text IS NULL OR wi.status::text = $2)
        GROUP BY wi.id
        ORDER BY wi.position ASC, wi.created_at ASC
        "#,
        sprint_id,
        status_filter as Option<&str>,
    )
    .fetch_all(&state.db)
    .await?;

    let total: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)
        FROM work_items wi
        WHERE wi.sprint_id = $1
          AND wi.deleted_at IS NULL
          AND ($2::text IS NULL OR wi.status::text = $2)
        "#,
        sprint_id,
        status_filter as Option<&str>,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    Ok(WorkItemListResponse { data: rows, total })
}

/// List work items belonging to a specific epic, verifying epic ownership.
///
/// Accepts an optional `status` text filter.
///
/// # Errors
///
/// - [`AppError::NotFound`] — epic not found or not owned by the user.
/// - [`AppError::Db`] — database failure.
pub async fn list_items_for_epic(
    state: &AppState,
    user_id: Uuid,
    epic_id: Uuid,
    status_filter: Option<&str>,
) -> AppResult<WorkItemListResponse> {
    // Ownership check on the epic.
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM epics WHERE id = $1 AND user_id = $2)",
        epic_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound);
    }

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
        WHERE wi.epic_id = $1
          AND wi.deleted_at IS NULL
          AND ($2::text IS NULL OR wi.status::text = $2)
        GROUP BY wi.id
        ORDER BY wi.position ASC, wi.created_at ASC
        "#,
        epic_id,
        status_filter as Option<&str>,
    )
    .fetch_all(&state.db)
    .await?;

    let total: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)
        FROM work_items wi
        WHERE wi.epic_id = $1
          AND wi.deleted_at IS NULL
          AND ($2::text IS NULL OR wi.status::text = $2)
        "#,
        epic_id,
        status_filter as Option<&str>,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    Ok(WorkItemListResponse { data: rows, total })
}


// ── Work-item links ────────────────────────────────────────────────────────────

/// List all links attached to a work item, enforcing ownership.
///
/// Each result row is denormalised with the target item's title, type and status.
///
/// # Errors
///
/// - [`AppError::NotFound`] — work item not found or not owned by the user.
/// - [`AppError::Db`] — database failure.
pub async fn list_links(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
) -> AppResult<Vec<WorkItemLink>> {
    // Ownership check.
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM work_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL)",
        item_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound);
    }

    let rows = sqlx::query_as!(
        WorkItemLink,
        r#"
        SELECT
            l.id,
            l.work_item_id,
            l.target_work_item_id,
            l.link_type,
            t.title          AS "target_title!",
            t.type::text     AS "target_type!",
            t.status::text   AS "target_status!",
            l.created_at
        FROM work_item_links l
        JOIN work_items t ON t.id = l.target_work_item_id
        WHERE l.work_item_id = $1
        ORDER BY l.created_at ASC
        "#,
        item_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

/// Create a link between two work items.
///
/// Validates:
/// - The source work item is owned by `user_id`.
/// - The target work item is owned by `user_id`.
/// - Source and target are not the same item.
///
/// # Errors
///
/// - [`AppError::NotFound`] — source or target work item not found / not owned.
/// - [`AppError::Validation`] — target equals source.
/// - [`AppError::Conflict`] — link already exists.
/// - [`AppError::Db`] — database failure.
pub async fn create_link(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
    req: CreateLinkRequest,
) -> AppResult<WorkItemLink> {
    if item_id == req.target_work_item_id {
        return Err(AppError::Validation(
            "a work item cannot be linked to itself".to_owned(),
        ));
    }

    // Source ownership check.
    let source_exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM work_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL)",
        item_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !source_exists {
        return Err(AppError::NotFound);
    }

    // Target ownership check.
    let target_exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM work_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL)",
        req.target_work_item_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !target_exists {
        return Err(AppError::NotFound);
    }

    let link_type = req
        .link_type
        .as_deref()
        .unwrap_or("relates_to")
        .to_owned();

    let link = sqlx::query_as!(
        WorkItemLink,
        r#"
        WITH ins AS (
            INSERT INTO work_item_links (user_id, work_item_id, target_work_item_id, link_type)
            VALUES ($1, $2, $3, $4)
            RETURNING id, work_item_id, target_work_item_id, link_type, created_at
        )
        SELECT
            ins.id,
            ins.work_item_id,
            ins.target_work_item_id,
            ins.link_type,
            t.title         AS "target_title!",
            t.type::text    AS "target_type!",
            t.status::text  AS "target_status!",
            ins.created_at
        FROM ins
        JOIN work_items t ON t.id = ins.target_work_item_id
        "#,
        user_id,
        item_id,
        req.target_work_item_id as Uuid,
        link_type,
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            // Unique-constraint violation = 23505.
            if db_err.code().as_deref() == Some("23505") {
                return AppError::Conflict("link already exists".to_owned());
            }
        }
        AppError::Db(e)
    })?;

    Ok(link)
}

/// Delete a link by its id, enforcing ownership via the parent work item.
///
/// # Errors
///
/// - [`AppError::NotFound`] — link or work item not found / not owned.
/// - [`AppError::Db`] — database failure.
pub async fn delete_link(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
    link_id: Uuid,
) -> AppResult<()> {
    // Ownership check on the source work item.
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM work_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL)",
        item_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound);
    }

    let result = sqlx::query!(
        "DELETE FROM work_item_links WHERE id = $1 AND work_item_id = $2",
        link_id,
        item_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}

// ── Web links ─────────────────────────────────────────────────────────────────

/// List all web links attached to a work item.
///
/// # Errors
///
/// - [`AppError::NotFound`] — work item not found or not owned.
/// - [`AppError::Db`] — database failure.
pub async fn list_web_links(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
) -> AppResult<Vec<WebLink>> {
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM work_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL)",
        item_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound);
    }

    let rows = sqlx::query_as!(
        WebLink,
        r#"
        SELECT id, work_item_id, url, title, created_at
        FROM work_item_web_links
        WHERE work_item_id = $1
        ORDER BY created_at ASC
        "#,
        item_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

/// Attach a web link to a work item.
///
/// # Errors
///
/// - [`AppError::NotFound`] — work item not found or not owned.
/// - [`AppError::Db`] — database failure.
pub async fn create_web_link(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
    req: CreateWebLinkRequest,
) -> AppResult<WebLink> {
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM work_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL)",
        item_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound);
    }

    let link = sqlx::query_as!(
        WebLink,
        r#"
        INSERT INTO work_item_web_links (user_id, work_item_id, url, title)
        VALUES ($1, $2, $3, $4)
        RETURNING id, work_item_id, url, title, created_at
        "#,
        user_id,
        item_id,
        req.url,
        req.title,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(link)
}

/// Delete a web link by its id.
///
/// # Errors
///
/// - [`AppError::NotFound`] — link or work item not found / not owned.
/// - [`AppError::Db`] — database failure.
pub async fn delete_web_link(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
    link_id: Uuid,
) -> AppResult<()> {
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM work_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL)",
        item_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound);
    }

    let result = sqlx::query!(
        "DELETE FROM work_item_web_links WHERE id = $1 AND work_item_id = $2",
        link_id,
        item_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}

// ── Attachments ───────────────────────────────────────────────────────────────

/// List all file attachments for a work item.
///
/// # Errors
///
/// - [`AppError::NotFound`] — work item not found or not owned.
/// - [`AppError::Db`] — database failure.
pub async fn list_attachments(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
) -> AppResult<Vec<Attachment>> {
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM work_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL)",
        item_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound);
    }

    let rows = sqlx::query_as!(
        AttachmentRow,
        r#"
        SELECT id, work_item_id, filename, stored_path, mime_type, size_bytes, created_at
        FROM work_item_attachments
        WHERE work_item_id = $1
        ORDER BY created_at ASC
        "#,
        item_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows.into_iter().map(AttachmentRow::into_response).collect())
}

/// Store an uploaded file on disk and record the attachment in the database.
///
/// `uploads_dir` must be an absolute path to the uploads directory.
/// The file is saved as `<uuid>-<sanitized filename>` within that directory.
///
/// # Errors
///
/// - [`AppError::NotFound`] — work item not found or not owned.
/// - [`AppError::InternalMsg`] — I/O failure while writing the file.
/// - [`AppError::Db`] — database failure.
pub async fn create_attachment(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
    uploads_dir: &std::path::Path,
    original_filename: String,
    mime_type: Option<String>,
    bytes: bytes::Bytes,
) -> AppResult<Attachment> {
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM work_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL)",
        item_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound);
    }

    // Sanitize: keep only safe characters, collapse whitespace.
    let sanitized: String = original_filename
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let sanitized = sanitized.trim_matches('_').to_owned();
    let sanitized = if sanitized.is_empty() {
        "file".to_owned()
    } else {
        sanitized
    };

    let file_id = Uuid::new_v4();
    let stored_path = format!("{file_id}-{sanitized}");
    let full_path = uploads_dir.join(&stored_path);
    let size_bytes = bytes.len() as i64;

    // Ensure uploads directory exists.
    std::fs::create_dir_all(uploads_dir).map_err(|e| {
        AppError::InternalMsg(anyhow::anyhow!("failed to create uploads directory: {e}"))
    })?;

    tokio::fs::write(&full_path, &bytes).await.map_err(|e| {
        AppError::InternalMsg(anyhow::anyhow!(
            "failed to write upload file {}: {e}",
            full_path.display()
        ))
    })?;

    let row = sqlx::query_as!(
        AttachmentRow,
        r#"
        INSERT INTO work_item_attachments
            (user_id, work_item_id, filename, stored_path, mime_type, size_bytes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, work_item_id, filename, stored_path, mime_type, size_bytes, created_at
        "#,
        user_id,
        item_id,
        original_filename,
        stored_path,
        mime_type,
        size_bytes,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(row.into_response())
}

/// Delete an attachment record and remove the file from disk (best-effort).
///
/// # Errors
///
/// - [`AppError::NotFound`] — attachment or work item not found / not owned.
/// - [`AppError::Db`] — database failure.
pub async fn delete_attachment(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
    att_id: Uuid,
    uploads_dir: &std::path::Path,
) -> AppResult<()> {
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM work_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL)",
        item_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound);
    }

    // Fetch stored_path before deletion so we can remove the file.
    let row = sqlx::query!(
        "SELECT stored_path FROM work_item_attachments WHERE id = $1 AND work_item_id = $2",
        att_id,
        item_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    sqlx::query!(
        "DELETE FROM work_item_attachments WHERE id = $1 AND work_item_id = $2",
        att_id,
        item_id,
    )
    .execute(&state.db)
    .await?;

    // Best-effort file removal — ignore errors so the DB row is still gone.
    let full_path = uploads_dir.join(&row.stored_path);
    let _ = tokio::fs::remove_file(&full_path).await;

    Ok(())
}

// ── Comments ───────────────────────────────────────────────────────────────────

/// List all comments for a work item, verifying ownership of the parent item.
///
/// Returns comments ordered by `created_at ASC`, each joined with the author's
/// `display_name` from the `users` table.
///
/// # Errors
///
/// - [`AppError::NotFound`] — work item not found or not owned by the user.
/// - [`AppError::Db`] — database failure.
pub async fn list_comments(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
) -> AppResult<Vec<WorkItemComment>> {
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM work_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL)",
        item_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound);
    }

    let rows = sqlx::query_as!(
        WorkItemComment,
        r#"
        SELECT
            c.id,
            c.work_item_id,
            c.user_id,
            u.display_name AS "author_name!",
            c.body,
            c.created_at
        FROM work_item_comments c
        JOIN users u ON u.id = c.user_id
        WHERE c.work_item_id = $1
        ORDER BY c.created_at ASC
        "#,
        item_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

/// Add a comment to a work item.
///
/// The comment is attributed to `user_id` (the authenticated caller).
/// Returns the newly created comment, including the author's `display_name`.
///
/// # Errors
///
/// - [`AppError::NotFound`] — work item not found or not owned by the user.
/// - [`AppError::Db`] — database failure.
pub async fn create_comment(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
    req: CreateCommentRequest,
) -> AppResult<WorkItemComment> {
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM work_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL)",
        item_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound);
    }

    let comment = sqlx::query_as!(
        WorkItemComment,
        r#"
        WITH ins AS (
            INSERT INTO work_item_comments (work_item_id, user_id, body)
            VALUES ($1, $2, $3)
            RETURNING id, work_item_id, user_id, body, created_at
        )
        SELECT
            ins.id,
            ins.work_item_id,
            ins.user_id,
            u.display_name AS "author_name!",
            ins.body,
            ins.created_at
        FROM ins
        JOIN users u ON u.id = ins.user_id
        "#,
        item_id,
        user_id,
        req.body,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(comment)
}

/// Delete a comment, verifying that the comment belongs to the authenticated user
/// and that the parent work item is also owned by that user.
///
/// # Errors
///
/// - [`AppError::NotFound`] — comment or parent work item not found / not owned.
/// - [`AppError::Db`] — database failure.
pub async fn delete_comment(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
    comment_id: Uuid,
) -> AppResult<()> {
    // Verify work item ownership.
    let item_exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM work_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL)",
        item_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !item_exists {
        return Err(AppError::NotFound);
    }

    // Delete only the comment row that belongs to this user.
    let result = sqlx::query!(
        "DELETE FROM work_item_comments WHERE id = $1 AND work_item_id = $2 AND user_id = $3",
        comment_id,
        item_id,
        user_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}

// ─── Activity / change history ──────────────────────────────────────────────

/// Insert one activity row (best-effort; logs and swallows DB errors so a
/// history write never fails the user's actual mutation).
async fn record_activity(
    state: &AppState,
    work_item_id: Uuid,
    user_id: Uuid,
    field: &str,
    old_value: Option<String>,
    new_value: Option<String>,
) {
    let res = sqlx::query!(
        r#"INSERT INTO work_item_activity
               (id, work_item_id, user_id, field, old_value, new_value)
           VALUES ($1, $2, $3, $4, $5, $6)"#,
        Uuid::new_v4(),
        work_item_id,
        user_id,
        field,
        old_value,
        new_value,
    )
    .execute(&state.db)
    .await;
    if let Err(e) = res {
        tracing::warn!("failed to record work item activity: {e}");
    }
}

/// Record a field change only when the value actually changed.
async fn record_change(
    state: &AppState,
    work_item_id: Uuid,
    user_id: Uuid,
    field: &str,
    old: Option<String>,
    new: Option<String>,
) {
    if old != new {
        record_activity(state, work_item_id, user_id, field, old, new).await;
    }
}

/// List a work item's activity (most recent first).
///
/// # Errors
/// - [`AppError::Db`] — database failure.
pub async fn list_activity(
    state: &AppState,
    user_id: Uuid,
    item_id: Uuid,
) -> AppResult<Vec<ActivityEntry>> {
    let rows = sqlx::query_as!(
        ActivityEntry,
        r#"SELECT a.id, a.field, a.old_value, a.new_value, a.created_at
           FROM work_item_activity a
           JOIN work_items wi ON wi.id = a.work_item_id
           WHERE a.work_item_id = $1 AND wi.user_id = $2
           ORDER BY a.created_at DESC
           LIMIT 200"#,
        item_id,
        user_id,
    )
    .fetch_all(&state.db)
    .await?;
    Ok(rows)
}
