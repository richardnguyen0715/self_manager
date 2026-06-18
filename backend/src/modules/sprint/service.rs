//! Business logic for the `sprint` module.
//!
//! All public functions accept a reference to [`AppState`] and execute SQL
//! via `sqlx::query!` / `sqlx::query_as!` compile-time macros.
//!
//! # Key invariants enforced here
//!
//! - At most one `active` sprint per user; activate returns **409 Conflict** when
//!   another active sprint exists.
//! - Adding a work item to a sprint is rejected with **409** when
//!   `capacity_points > 0` and `planned + item.points > capacity_points`.
//! - Completing a sprint auto-creates a [`SprintReview`] row with velocity
//!   calculated as `completed_points / planned_points * 100`.
//! - Ownership is always enforced via `WHERE user_id = $n`.

use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    events::DomainEvent,
    state::AppState,
};

// Row types used as `query_as!` targets — appear unused when DATABASE_URL is
// absent (sqlx offline mode) but are required at compile time with a live DB.
#[allow(unused_imports)]
use super::models::{
    BurndownPoint, BurndownResponse, CompleteSprintRequest, CreateSprintRequest, ListSprintsQuery,
    RetrospectiveResponse, RetrospectiveRow, SprintListResponse, SprintResponse,
    SprintReviewResponse, SprintReviewRow, SprintRow, SprintStatus, UpdateSprintRequest,
    UpsertRetrospectiveRequest, UpsertReviewRequest, VelocityListResponse, VelocityPoint,
    WorkItemListItem, WorkItemListResponse, WorkItemStatusQuery,
};

// ── helpers ─────────────────────────────────────────────────────────────────────

#[inline]
fn clamp_limit(raw: Option<i64>) -> i64 {
    raw.unwrap_or(50).clamp(1, 200)
}

#[inline]
fn clamp_offset(raw: Option<i64>) -> i64 {
    raw.unwrap_or(0).max(0)
}

/// Fetch the derived scalars for a sprint row and assemble a `SprintResponse`.
async fn enrich_sprint(state: &AppState, row: SprintRow) -> AppResult<SprintResponse> {
    let sprint_id = row.id;

    let planned_points: i64 = sqlx::query_scalar!(
        r#"SELECT COALESCE(SUM(story_points), 0) FROM work_items WHERE sprint_id = $1"#,
        sprint_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    let committed_count: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM work_items WHERE sprint_id = $1",
        sprint_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    let done_count: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM work_items WHERE sprint_id = $1 AND status::text = 'done'",
        sprint_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    Ok(SprintResponse {
        id: row.id,
        user_id: row.user_id,
        project_id: row.project_id,
        name: row.name,
        goal_text: row.goal_text,
        start_date: row.start_date,
        end_date: row.end_date,
        capacity_points: row.capacity_points,
        status: row.status,
        velocity: row.velocity,
        completed_points: row.completed_points,
        planned_points,
        committed_count,
        done_count,
        created_at: row.created_at,
        updated_at: row.updated_at,
    })
}

// ── Sprint CRUD ──────────────────────────────────────────────────────────────────

/// List sprints for the authenticated user.
///
/// Optionally filtered by `status`. Ordered by `start_date DESC` (newest first).
///
/// # Errors
///
/// Returns [`AppError::Db`] on database failure.
pub async fn list_sprints(
    state: &AppState,
    user_id: Uuid,
    query: &ListSprintsQuery,
) -> AppResult<SprintListResponse> {
    let limit = clamp_limit(query.limit);
    let offset = clamp_offset(query.offset);

    // Use nullable-param pattern so project_id and status are both optional
    // without combinatorial query branches.
    let status_str = query.status.as_ref().map(SprintStatus::as_str);

    let rows = sqlx::query_as!(
        SprintRow,
        r#"
        SELECT
            id, user_id, project_id, name, goal_text,
            start_date, end_date, capacity_points,
            status::text AS "status!",
            velocity::float8 AS "velocity?", completed_points,
            created_at, updated_at
        FROM sprints
        WHERE user_id = $1
          AND ($2::uuid IS NULL OR project_id  = $2)
          AND ($3::text IS NULL OR status::text = $3)
        ORDER BY start_date DESC, created_at DESC
        LIMIT $4 OFFSET $5
        "#,
        user_id,
        query.project_id as Option<Uuid>,
        status_str as Option<&str>,
        limit,
        offset,
    )
    .fetch_all(&state.db)
    .await?;

    let total: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)
        FROM sprints
        WHERE user_id = $1
          AND ($2::uuid IS NULL OR project_id  = $2)
          AND ($3::text IS NULL OR status::text = $3)
        "#,
        user_id,
        query.project_id as Option<Uuid>,
        status_str as Option<&str>,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    let mut data = Vec::with_capacity(rows.len());
    for row in rows {
        data.push(enrich_sprint(state, row).await?);
    }

    Ok(SprintListResponse { data, total })
}

/// Create a new sprint.
///
/// # Errors
///
/// - [`AppError::Validation`] if `end_date < start_date`.
/// - [`AppError::Db`] on database failure.
pub async fn create_sprint(
    state: &AppState,
    user_id: Uuid,
    req: CreateSprintRequest,
) -> AppResult<SprintResponse> {
    if req.end_date < req.start_date {
        return Err(AppError::Validation(
            "end_date must be on or after start_date".into(),
        ));
    }

    let capacity = req.capacity_points.unwrap_or(0).max(0);

    let row = sqlx::query_as!(
        SprintRow,
        r#"
        INSERT INTO sprints (user_id, project_id, name, goal_text, start_date, end_date, capacity_points)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
            id, user_id, project_id, name, goal_text,
            start_date, end_date, capacity_points,
            status::text AS "status!",
            velocity::float8 AS "velocity?", completed_points,
            created_at, updated_at
        "#,
        user_id,
        req.project_id as Option<Uuid>,
        req.name,
        req.goal_text,
        req.start_date,
        req.end_date,
        capacity,
    )
    .fetch_one(&state.db)
    .await?;

    enrich_sprint(state, row).await
}

/// Fetch a single sprint by ID, enforcing ownership.
///
/// # Errors
///
/// - [`AppError::NotFound`] when no sprint with that ID belongs to the user.
/// - [`AppError::Db`] on database failure.
pub async fn get_sprint(
    state: &AppState,
    user_id: Uuid,
    sprint_id: Uuid,
) -> AppResult<SprintResponse> {
    let row = sqlx::query_as!(
        SprintRow,
        r#"
        SELECT
            id, user_id, project_id, name, goal_text,
            start_date, end_date, capacity_points,
            status::text AS "status!",
            velocity::float8 AS "velocity?", completed_points,
            created_at, updated_at
        FROM sprints
        WHERE id = $1 AND user_id = $2
        "#,
        sprint_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    enrich_sprint(state, row).await
}

/// Fetch the currently active sprint for a user (if any).
///
/// Returns `None` when no sprint has `status = 'active'`.
///
/// # Errors
///
/// Returns [`AppError::Db`] on database failure.
pub async fn get_active_sprint(
    state: &AppState,
    user_id: Uuid,
) -> AppResult<Option<SprintResponse>> {
    let row = sqlx::query_as!(
        SprintRow,
        r#"
        SELECT
            id, user_id, project_id, name, goal_text,
            start_date, end_date, capacity_points,
            status::text AS "status!",
            velocity::float8 AS "velocity?", completed_points,
            created_at, updated_at
        FROM sprints
        WHERE user_id = $1 AND status::text = 'active'
        LIMIT 1
        "#,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?;

    match row {
        Some(r) => Ok(Some(enrich_sprint(state, r).await?)),
        None => Ok(None),
    }
}

/// Partially update a sprint.
///
/// Only supplied fields are mutated; others retain their current values.
///
/// # Errors
///
/// - [`AppError::NotFound`] — sprint not found or belongs to a different user.
/// - [`AppError::Validation`] — `end_date < start_date` after merge.
/// - [`AppError::Db`] — database failure.
pub async fn update_sprint(
    state: &AppState,
    user_id: Uuid,
    sprint_id: Uuid,
    req: UpdateSprintRequest,
) -> AppResult<SprintResponse> {
    let current = sqlx::query_as!(
        SprintRow,
        r#"
        SELECT
            id, user_id, project_id, name, goal_text,
            start_date, end_date, capacity_points,
            status::text AS "status!",
            velocity::float8 AS "velocity?", completed_points,
            created_at, updated_at
        FROM sprints
        WHERE id = $1 AND user_id = $2
        "#,
        sprint_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let new_name = req.name.as_deref().unwrap_or(&current.name);
    let new_goal_text = if req.goal_text.is_some() {
        req.goal_text.as_deref()
    } else {
        current.goal_text.as_deref()
    };
    let new_start = req.start_date.unwrap_or(current.start_date);
    let new_end = req.end_date.unwrap_or(current.end_date);
    let new_capacity = req.capacity_points.unwrap_or(current.capacity_points).max(0);
    let new_status = req
        .status
        .as_ref()
        .map(SprintStatus::as_str)
        .unwrap_or(current.status.as_str());
    let new_project_id = if req.project_id.is_some() {
        req.project_id
    } else {
        current.project_id
    };

    if new_end < new_start {
        return Err(AppError::Validation(
            "end_date must be on or after start_date".into(),
        ));
    }

    let row = sqlx::query_as!(
        SprintRow,
        r#"
        UPDATE sprints
        SET
            project_id      = $3,
            name            = $4,
            goal_text       = $5,
            start_date      = $6,
            end_date        = $7,
            capacity_points = $8,
            status          = ($9::text)::sprint_status,
            updated_at      = now()
        WHERE id = $1 AND user_id = $2
        RETURNING
            id, user_id, project_id, name, goal_text,
            start_date, end_date, capacity_points,
            status::text AS "status!",
            velocity::float8 AS "velocity?", completed_points,
            created_at, updated_at
        "#,
        sprint_id,
        user_id,
        new_project_id as Option<Uuid>,
        new_name,
        new_goal_text,
        new_start,
        new_end,
        new_capacity,
        new_status,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    enrich_sprint(state, row).await
}

/// Delete a sprint by ID.
///
/// Work items that were in this sprint will have their `sprint_id` set to NULL
/// (backfilled to backlog) by the `ON DELETE SET NULL` DB constraint.
///
/// # Errors
///
/// - [`AppError::NotFound`] — sprint not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn delete_sprint(state: &AppState, user_id: Uuid, sprint_id: Uuid) -> AppResult<()> {
    let result = sqlx::query!(
        "DELETE FROM sprints WHERE id = $1 AND user_id = $2",
        sprint_id,
        user_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}

// ── Sprint state transitions ─────────────────────────────────────────────────────

/// Activate a sprint (status `planned` → `active`).
///
/// At most one active sprint per user is allowed; returns **409 Conflict** if
/// another sprint is already active.
///
/// # Errors
///
/// - [`AppError::NotFound`] — sprint not found or owned by a different user.
/// - [`AppError::Conflict`] — another active sprint already exists.
/// - [`AppError::Db`] — database failure.
pub async fn activate_sprint(
    state: &AppState,
    user_id: Uuid,
    sprint_id: Uuid,
) -> AppResult<SprintResponse> {
    // Verify ownership and current status.
    let current = sqlx::query_as!(
        SprintRow,
        r#"
        SELECT
            id, user_id, project_id, name, goal_text,
            start_date, end_date, capacity_points,
            status::text AS "status!",
            velocity::float8 AS "velocity?", completed_points,
            created_at, updated_at
        FROM sprints
        WHERE id = $1 AND user_id = $2
        "#,
        sprint_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    if current.status == "active" {
        return enrich_sprint(state, current).await;
    }

    // Guard: at most one active sprint per user (DB partial unique index also enforces).
    let other_active: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM sprints WHERE user_id = $1 AND status::text = 'active' AND id != $2)",
        user_id,
        sprint_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if other_active {
        return Err(AppError::Conflict(
            "another sprint is already active; complete it before activating a new one".into(),
        ));
    }

    let row = sqlx::query_as!(
        SprintRow,
        r#"
        UPDATE sprints
        SET status = 'active', updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING
            id, user_id, project_id, name, goal_text,
            start_date, end_date, capacity_points,
            status::text AS "status!",
            velocity::float8 AS "velocity?", completed_points,
            created_at, updated_at
        "#,
        sprint_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let _ = state.events.send(DomainEvent::SprintStarted {
        sprint_id: row.id,
        user_id,
    });

    enrich_sprint(state, row).await
}

/// Complete a sprint and auto-create a [`SprintReview`].
///
/// Computes `completed_points` from done work items, sets `velocity`, marks
/// the sprint as `completed`, and inserts a review row (upserted if one
/// already exists).
///
/// Emits [`DomainEvent::SprintCompleted`].
///
/// # Errors
///
/// - [`AppError::NotFound`] — sprint not found or owned by a different user.
/// - [`AppError::Conflict`] — sprint is not in `active` or `planned` status.
/// - [`AppError::Db`] — database failure.
pub async fn complete_sprint(
    state: &AppState,
    user_id: Uuid,
    sprint_id: Uuid,
    req: CompleteSprintRequest,
) -> AppResult<SprintReviewResponse> {
    // Verify ownership.
    let current = sqlx::query_as!(
        SprintRow,
        r#"
        SELECT
            id, user_id, project_id, name, goal_text,
            start_date, end_date, capacity_points,
            status::text AS "status!",
            velocity::float8 AS "velocity?", completed_points,
            created_at, updated_at
        FROM sprints
        WHERE id = $1 AND user_id = $2
        "#,
        sprint_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    if current.status == "completed" {
        return Err(AppError::Conflict("sprint is already completed".into()));
    }

    // Compute points from work items.
    let planned_points: i64 = sqlx::query_scalar!(
        "SELECT COALESCE(SUM(story_points), 0) FROM work_items WHERE sprint_id = $1",
        sprint_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    let completed_points: i64 = sqlx::query_scalar!(
        "SELECT COALESCE(SUM(story_points), 0) FROM work_items WHERE sprint_id = $1 AND status::text = 'done'",
        sprint_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    let velocity: f64 = if planned_points > 0 {
        (completed_points as f64 / planned_points as f64 * 100.0).clamp(0.0, 100.0)
    } else {
        0.0
    };

    // Update the sprint row.
    sqlx::query!(
        r#"
        UPDATE sprints
        SET
            status           = 'completed',
            completed_points = $3,
            velocity         = $4::float8,
            updated_at       = now()
        WHERE id = $1 AND user_id = $2
        "#,
        sprint_id,
        user_id,
        completed_points as i32,
        velocity,
    )
    .execute(&state.db)
    .await?;

    // Upsert the sprint review.
    let review = sqlx::query_as!(
        SprintReviewRow,
        r#"
        INSERT INTO sprint_reviews (user_id, sprint_id, planned_points, completed_points, velocity, summary)
        VALUES ($1, $2, $3, $4, $5::float8, $6)
        ON CONFLICT (sprint_id) DO UPDATE
        SET
            planned_points   = EXCLUDED.planned_points,
            completed_points = EXCLUDED.completed_points,
            velocity         = EXCLUDED.velocity,
            summary          = COALESCE(EXCLUDED.summary, sprint_reviews.summary),
            updated_at       = now()
        RETURNING
            id, user_id, sprint_id,
            planned_points, completed_points,
            velocity::float8 AS "velocity!: f64",
            summary, created_at, updated_at
        "#,
        user_id,
        sprint_id,
        planned_points as i32,
        completed_points as i32,
        velocity,
        req.summary,
    )
    .fetch_one(&state.db)
    .await?;

    let _ = state.events.send(DomainEvent::SprintCompleted {
        sprint_id,
        user_id,
        completed_points: completed_points as i32,
        velocity,
    });

    Ok(SprintReviewResponse::from(review))
}

// ── Work items under a sprint ────────────────────────────────────────────────────

/// List work items in a sprint, optionally filtered by status.
///
/// # Errors
///
/// - [`AppError::NotFound`] — sprint not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn list_sprint_work_items(
    state: &AppState,
    user_id: Uuid,
    sprint_id: Uuid,
    query: &WorkItemStatusQuery,
) -> AppResult<WorkItemListResponse> {
    // Verify sprint ownership.
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

    let (rows, total) = if let Some(status) = &query.status {
        let rows = sqlx::query_as!(
            WorkItemListItem,
            r#"
            SELECT
                wi.id,
                wi.project_id,
                wi.epic_id,
                wi.sprint_id,
                wi.type::text  AS "type!",
                wi.title,
                wi.status::text    AS "status!",
                wi.priority::text  AS "priority!",
                wi.story_points,
                wi.due_date,
                wi.position,
                COUNT(sub.id)                                       AS "subtask_count!: i64",
                COUNT(sub.id) FILTER (WHERE sub.is_done = true)    AS "done_subtask_count!: i64",
                wi.created_at,
                wi.updated_at
            FROM work_items wi
            LEFT JOIN work_item_subtasks sub ON sub.work_item_id = wi.id
            WHERE wi.sprint_id = $1 AND wi.user_id = $2 AND wi.status::text = $3
            GROUP BY wi.id
            ORDER BY wi.position ASC, wi.created_at ASC
            "#,
            sprint_id,
            user_id,
            status,
        )
        .fetch_all(&state.db)
        .await?;

        let total: i64 = sqlx::query_scalar!(
            "SELECT COUNT(*) FROM work_items WHERE sprint_id = $1 AND user_id = $2 AND status::text = $3",
            sprint_id,
            user_id,
            status,
        )
        .fetch_one(&state.db)
        .await?
        .unwrap_or(0);

        (rows, total)
    } else {
        let rows = sqlx::query_as!(
            WorkItemListItem,
            r#"
            SELECT
                wi.id,
                wi.project_id,
                wi.epic_id,
                wi.sprint_id,
                wi.type::text  AS "type!",
                wi.title,
                wi.status::text    AS "status!",
                wi.priority::text  AS "priority!",
                wi.story_points,
                wi.due_date,
                wi.position,
                COUNT(sub.id)                                       AS "subtask_count!: i64",
                COUNT(sub.id) FILTER (WHERE sub.is_done = true)    AS "done_subtask_count!: i64",
                wi.created_at,
                wi.updated_at
            FROM work_items wi
            LEFT JOIN work_item_subtasks sub ON sub.work_item_id = wi.id
            WHERE wi.sprint_id = $1 AND wi.user_id = $2
            GROUP BY wi.id
            ORDER BY wi.position ASC, wi.created_at ASC
            "#,
            sprint_id,
            user_id,
        )
        .fetch_all(&state.db)
        .await?;

        let total: i64 = sqlx::query_scalar!(
            "SELECT COUNT(*) FROM work_items WHERE sprint_id = $1 AND user_id = $2",
            sprint_id,
            user_id,
        )
        .fetch_one(&state.db)
        .await?
        .unwrap_or(0);

        (rows, total)
    };

    Ok(WorkItemListResponse { data: rows, total })
}

// ── Burndown ─────────────────────────────────────────────────────────────────────

/// Generate a burndown chart for a sprint.
///
/// Returns one data point per day from `start_date` to `end_date`.
/// `remaining_points` at a given date = total points minus the sum of
/// `story_points` of work items completed on or before that date.
/// `ideal_points` follows a linear decline from `total_points` to `0`.
///
/// # Errors
///
/// - [`AppError::NotFound`] — sprint not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn get_burndown(
    state: &AppState,
    user_id: Uuid,
    sprint_id: Uuid,
) -> AppResult<BurndownResponse> {
    let sprint = sqlx::query_as!(
        SprintRow,
        r#"
        SELECT
            id, user_id, project_id, name, goal_text,
            start_date, end_date, capacity_points,
            status::text AS "status!",
            velocity::float8 AS "velocity?", completed_points,
            created_at, updated_at
        FROM sprints
        WHERE id = $1 AND user_id = $2
        "#,
        sprint_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let total_points: i64 = sqlx::query_scalar!(
        "SELECT COALESCE(SUM(story_points), 0) FROM work_items WHERE sprint_id = $1",
        sprint_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    // Build a series of dates from start_date to end_date.
    struct DayBurn {
        day: chrono::NaiveDate,
        done_on_day: i64,
    }

    let day_rows = sqlx::query_as!(
        DayBurn,
        r#"
        SELECT
            d.day::date AS "day!",
            COALESCE(SUM(wi.story_points), 0) AS "done_on_day!: i64"
        FROM generate_series($1::date, $2::date, '1 day'::interval) AS d(day)
        LEFT JOIN work_items wi
            ON wi.sprint_id = $3
            AND wi.status::text = 'done'
            AND wi.completed_at::date = d.day::date
        GROUP BY d.day
        ORDER BY d.day ASC
        "#,
        sprint.start_date,
        sprint.end_date,
        sprint_id,
    )
    .fetch_all(&state.db)
    .await?;

    let total_days = day_rows.len().max(1) as f64;
    let total_points_f = total_points as f64;

    let mut remaining = total_points;
    let points: Vec<BurndownPoint> = day_rows
        .into_iter()
        .enumerate()
        .map(|(i, dr)| {
            remaining -= dr.done_on_day;
            let ideal = (total_points_f * (1.0 - (i + 1) as f64 / total_days)).max(0.0);
            BurndownPoint {
                date: dr.day,
                remaining_points: remaining.max(0),
                ideal_points: ideal,
            }
        })
        .collect();

    Ok(BurndownResponse {
        sprint_id,
        start_date: sprint.start_date,
        end_date: sprint.end_date,
        total_points,
        points,
    })
}

// ── Velocity ─────────────────────────────────────────────────────────────────────

/// Return velocity data for the last N completed sprints.
///
/// Velocity = `completed_points / planned_points * 100` clamped to `[0, 100]`.
/// Ordered by `end_date ASC` (oldest first) for chart display.
///
/// # Errors
///
/// Returns [`AppError::Db`] on database failure.
pub async fn get_velocity(
    state: &AppState,
    user_id: Uuid,
    last: Option<i64>,
) -> AppResult<VelocityListResponse> {
    let n = last.unwrap_or(6).clamp(1, 50);

    struct VelocityRow {
        id: Uuid,
        name: String,
        planned_points: i64,
        completed_points: i32,
        velocity: Option<f64>,
    }

    let rows = sqlx::query_as!(
        VelocityRow,
        r#"
        SELECT
            s.id AS "id!",
            s.name AS "name!",
            COALESCE(SUM(wi.story_points), 0) AS "planned_points!: i64",
            s.completed_points AS "completed_points!",
            s.velocity AS "velocity?: f64"
        FROM sprints s
        LEFT JOIN work_items wi ON wi.sprint_id = s.id
        WHERE s.user_id = $1 AND s.status::text = 'completed'
        GROUP BY s.id
        ORDER BY s.end_date DESC
        LIMIT $2
        "#,
        user_id,
        n,
    )
    .fetch_all(&state.db)
    .await?;

    // Reverse to chronological order for charting.
    let mut data: Vec<VelocityPoint> = rows
        .into_iter()
        .rev()
        .map(|r| {
            let vel = if r.planned_points > 0 {
                (r.completed_points as f64 / r.planned_points as f64 * 100.0).clamp(0.0, 100.0)
            } else {
                r.velocity.unwrap_or(0.0)
            };
            VelocityPoint {
                sprint_id: r.id,
                sprint_name: r.name,
                planned_points: r.planned_points,
                completed_points: r.completed_points,
                velocity: vel,
            }
        })
        .collect();

    // Ensure slice is sorted by original end_date order (already reversed above).
    data.reverse();
    data.reverse(); // no-op net; collected rev() already chronological

    Ok(VelocityListResponse { data })
}

// ── Sprint Review ────────────────────────────────────────────────────────────────

/// Fetch the sprint review for a sprint.
///
/// # Errors
///
/// - [`AppError::NotFound`] — no review exists or sprint not owned by user.
/// - [`AppError::Db`] — database failure.
pub async fn get_review(
    state: &AppState,
    user_id: Uuid,
    sprint_id: Uuid,
) -> AppResult<SprintReviewResponse> {
    // Verify sprint ownership.
    let sprint_exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM sprints WHERE id = $1 AND user_id = $2)",
        sprint_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !sprint_exists {
        return Err(AppError::NotFound);
    }

    let row = sqlx::query_as!(
        SprintReviewRow,
        r#"
        SELECT
            id, user_id, sprint_id,
            planned_points, completed_points,
            velocity::float8 AS "velocity!: f64",
            summary, created_at, updated_at
        FROM sprint_reviews
        WHERE sprint_id = $1 AND user_id = $2
        "#,
        sprint_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(SprintReviewResponse::from(row))
}

/// Upsert the sprint review (idempotent PUT).
///
/// # Errors
///
/// - [`AppError::NotFound`] — sprint not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn upsert_review(
    state: &AppState,
    user_id: Uuid,
    sprint_id: Uuid,
    req: UpsertReviewRequest,
) -> AppResult<SprintReviewResponse> {
    // Verify sprint ownership.
    let sprint_exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM sprints WHERE id = $1 AND user_id = $2)",
        sprint_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !sprint_exists {
        return Err(AppError::NotFound);
    }

    // Compute current planned/completed points for the review.
    let planned_points: i64 = sqlx::query_scalar!(
        "SELECT COALESCE(SUM(story_points), 0) FROM work_items WHERE sprint_id = $1",
        sprint_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    let completed_points: i64 = sqlx::query_scalar!(
        "SELECT COALESCE(SUM(story_points), 0) FROM work_items WHERE sprint_id = $1 AND status::text = 'done'",
        sprint_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    let velocity: f64 = if planned_points > 0 {
        (completed_points as f64 / planned_points as f64 * 100.0).clamp(0.0, 100.0)
    } else {
        0.0
    };

    let row = sqlx::query_as!(
        SprintReviewRow,
        r#"
        INSERT INTO sprint_reviews (user_id, sprint_id, planned_points, completed_points, velocity, summary)
        VALUES ($1, $2, $3, $4, $5::float8, $6)
        ON CONFLICT (sprint_id) DO UPDATE
        SET
            planned_points   = EXCLUDED.planned_points,
            completed_points = EXCLUDED.completed_points,
            velocity         = EXCLUDED.velocity,
            summary          = COALESCE(EXCLUDED.summary, sprint_reviews.summary),
            updated_at       = now()
        RETURNING
            id, user_id, sprint_id,
            planned_points, completed_points,
            velocity::float8 AS "velocity!: f64",
            summary, created_at, updated_at
        "#,
        user_id,
        sprint_id,
        planned_points as i32,
        completed_points as i32,
        velocity,
        req.summary,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(SprintReviewResponse::from(row))
}

// ── Retrospective ────────────────────────────────────────────────────────────────

/// Fetch the retrospective for a sprint.
///
/// # Errors
///
/// - [`AppError::NotFound`] — no retro exists or sprint not owned by user.
/// - [`AppError::Db`] — database failure.
pub async fn get_retrospective(
    state: &AppState,
    user_id: Uuid,
    sprint_id: Uuid,
) -> AppResult<RetrospectiveResponse> {
    let sprint_exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM sprints WHERE id = $1 AND user_id = $2)",
        sprint_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !sprint_exists {
        return Err(AppError::NotFound);
    }

    let row = sqlx::query_as!(
        RetrospectiveRow,
        r#"
        SELECT
            id, user_id, sprint_id,
            went_well, went_wrong, action_items,
            created_at, updated_at
        FROM retrospectives
        WHERE sprint_id = $1 AND user_id = $2
        "#,
        sprint_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(RetrospectiveResponse::from(row))
}

/// Upsert a retrospective (idempotent PUT).
///
/// # Errors
///
/// - [`AppError::NotFound`] — sprint not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn upsert_retrospective(
    state: &AppState,
    user_id: Uuid,
    sprint_id: Uuid,
    req: UpsertRetrospectiveRequest,
) -> AppResult<RetrospectiveResponse> {
    let sprint_exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM sprints WHERE id = $1 AND user_id = $2)",
        sprint_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !sprint_exists {
        return Err(AppError::NotFound);
    }

    let action_items = req
        .action_items
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));

    let row = sqlx::query_as!(
        RetrospectiveRow,
        r#"
        INSERT INTO retrospectives (user_id, sprint_id, went_well, went_wrong, action_items)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (sprint_id) DO UPDATE
        SET
            went_well    = COALESCE(EXCLUDED.went_well,   retrospectives.went_well),
            went_wrong   = COALESCE(EXCLUDED.went_wrong,  retrospectives.went_wrong),
            action_items = EXCLUDED.action_items,
            updated_at   = now()
        RETURNING
            id, user_id, sprint_id,
            went_well, went_wrong, action_items,
            created_at, updated_at
        "#,
        user_id,
        sprint_id,
        req.went_well,
        req.went_wrong,
        action_items,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(RetrospectiveResponse::from(row))
}
