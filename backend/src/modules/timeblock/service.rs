//! Business logic for the `timeblock` module.
//!
//! All database access uses `sqlx::query!` / `sqlx::query_as!` for
//! compile-time SQL verification. The service layer owns ownership/auth
//! enforcement (every query filters on `user_id`) and emits [`DomainEvent`]s
//! where appropriate.

use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    events::DomainEvent,
    state::AppState,
};

#[allow(unused_imports)] // FocusMode is a sqlx type-override annotation target
use super::models::{
    CreateTimeBlockRequest, FinishFocusSessionRequest, FocusMode, FocusSession,
    ListTimeBlocksQuery, StartFocusSessionRequest, TimeBlock, TimeBlockList, TimeBlockSummary,
    UpdateTimeBlockRequest,
};

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_PAGE_SIZE: i64 = 200;
const DEFAULT_PAGE_SIZE: i64 = 50;

// ── Time block CRUD ────────────────────────────────────────────────────────────

/// Create a new time block owned by `user_id`.
///
/// Validates that `end_time > start_time` before hitting the database (the DB
/// constraint is the authoritative check, but catching it here yields a cleaner
/// 422 instead of a 500).
pub async fn create_time_block(
    state: &AppState,
    user_id: Uuid,
    req: CreateTimeBlockRequest,
) -> AppResult<TimeBlock> {
    if req.end_time <= req.start_time {
        return Err(AppError::Validation(
            "end_time must be after start_time".to_owned(),
        ));
    }

    // Verify task belongs to this user when a link is requested.
    if let Some(task_id) = req.task_id {
        verify_task_ownership(state, user_id, task_id).await?;
    }

    let block = sqlx::query_as!(
        TimeBlock,
        r#"
        INSERT INTO time_blocks (user_id, task_id, title, start_time, end_time, color)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
            id, user_id, task_id, title,
            start_time, end_time, actual_start, actual_end,
            color, created_at, updated_at
        "#,
        user_id,
        req.task_id,
        req.title,
        req.start_time,
        req.end_time,
        req.color,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(block)
}

/// Return a paginated list of time blocks for `user_id`.
pub async fn list_time_blocks(
    state: &AppState,
    user_id: Uuid,
    query: ListTimeBlocksQuery,
) -> AppResult<TimeBlockList> {
    let limit = query
        .limit
        .unwrap_or(DEFAULT_PAGE_SIZE)
        .clamp(1, MAX_PAGE_SIZE);
    let offset = query.offset.unwrap_or(0).max(0);

    // Count total matching rows.
    let total = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) AS "count!"
        FROM time_blocks
        WHERE user_id   = $1
          AND ($2::timestamptz IS NULL OR start_time >= $2)
          AND ($3::timestamptz IS NULL OR end_time   <= $3)
          AND ($4::uuid        IS NULL OR task_id    = $4)
        "#,
        user_id,
        query.from,
        query.to,
        query.task_id,
    )
    .fetch_one(&state.db)
    .await?;

    let rows = sqlx::query_as!(
        TimeBlock,
        r#"
        SELECT
            id, user_id, task_id, title,
            start_time, end_time, actual_start, actual_end,
            color, created_at, updated_at
        FROM time_blocks
        WHERE user_id   = $1
          AND ($2::timestamptz IS NULL OR start_time >= $2)
          AND ($3::timestamptz IS NULL OR end_time   <= $3)
          AND ($4::uuid        IS NULL OR task_id    = $4)
        ORDER BY start_time ASC
        LIMIT  $5
        OFFSET $6
        "#,
        user_id,
        query.from,
        query.to,
        query.task_id,
        limit,
        offset,
    )
    .fetch_all(&state.db)
    .await?;

    let items: Vec<TimeBlockSummary> = rows.into_iter().map(TimeBlockSummary::from).collect();

    Ok(TimeBlockList {
        items,
        total,
        offset,
        limit,
    })
}

/// Fetch a single time block by id, enforcing ownership.
pub async fn get_time_block(
    state: &AppState,
    user_id: Uuid,
    block_id: Uuid,
) -> AppResult<TimeBlock> {
    let block = sqlx::query_as!(
        TimeBlock,
        r#"
        SELECT
            id, user_id, task_id, title,
            start_time, end_time, actual_start, actual_end,
            color, created_at, updated_at
        FROM time_blocks
        WHERE id = $1
        "#,
        block_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    if block.user_id != user_id {
        return Err(AppError::Forbidden);
    }

    Ok(block)
}

/// Partial update of a time block. Only supplied fields are written.
pub async fn update_time_block(
    state: &AppState,
    user_id: Uuid,
    block_id: Uuid,
    req: UpdateTimeBlockRequest,
) -> AppResult<TimeBlock> {
    // Fetch existing to apply partial updates and re-validate ordering.
    let existing = get_time_block(state, user_id, block_id).await?;

    let new_title = req.title.unwrap_or(existing.title);
    let new_start = req.start_time.unwrap_or(existing.start_time);
    let new_end = req.end_time.unwrap_or(existing.end_time);

    if new_end <= new_start {
        return Err(AppError::Validation(
            "end_time must be after start_time".to_owned(),
        ));
    }

    // `task_id` field: None means "don't touch it"; Some(None) means "unlink";
    // Some(Some(id)) means "re-link to this task".
    let new_task_id: Option<Uuid> = match req.task_id {
        None => existing.task_id,
        Some(None) => None,
        Some(Some(id)) => {
            verify_task_ownership(state, user_id, id).await?;
            Some(id)
        }
    };

    let new_color: Option<String> = match req.color {
        None => existing.color,
        Some(inner) => inner,
    };

    let block = sqlx::query_as!(
        TimeBlock,
        r#"
        UPDATE time_blocks
        SET
            title      = $2,
            start_time = $3,
            end_time   = $4,
            task_id    = $5,
            color      = $6,
            updated_at = now()
        WHERE id = $1
        RETURNING
            id, user_id, task_id, title,
            start_time, end_time, actual_start, actual_end,
            color, created_at, updated_at
        "#,
        block_id,
        new_title,
        new_start,
        new_end,
        new_task_id,
        new_color,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(block)
}

/// Delete a time block owned by `user_id`.
///
/// Associated `focus_sessions` rows have `ON DELETE SET NULL` on the FK, so
/// they are retained for analytics.
pub async fn delete_time_block(state: &AppState, user_id: Uuid, block_id: Uuid) -> AppResult<()> {
    // Ownership check first.
    get_time_block(state, user_id, block_id).await?;

    sqlx::query!("DELETE FROM time_blocks WHERE id = $1", block_id,)
        .execute(&state.db)
        .await?;

    Ok(())
}

// ── Focus sessions ─────────────────────────────────────────────────────────────

/// Start a new focus session, optionally linked to a time block.
///
/// Records `actual_start` on the parent time block when a `time_block_id` is
/// provided and that field is not already set.
pub async fn start_focus_session(
    state: &AppState,
    user_id: Uuid,
    block_id: Uuid,
    req: StartFocusSessionRequest,
) -> AppResult<FocusSession> {
    // Verify ownership of the time block.
    get_time_block(state, user_id, block_id).await?;

    // Guard: reject if there is already an active (not yet ended) session on
    // this block to avoid overlapping timers.
    let active_count = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) AS "count!"
        FROM focus_sessions
        WHERE time_block_id = $1
          AND ended_at IS NULL
        "#,
        block_id,
    )
    .fetch_one(&state.db)
    .await?;

    if active_count > 0 {
        return Err(AppError::Conflict(
            "a focus session is already active for this time block".to_owned(),
        ));
    }

    let session = sqlx::query_as!(
        FocusSession,
        r#"
        INSERT INTO focus_sessions (user_id, time_block_id, mode)
        VALUES ($1, $2, $3)
        RETURNING
            id, user_id, time_block_id,
            mode AS "mode: crate::modules::timeblock::models::FocusMode",
            started_at, paused_at, ended_at,
            duration_seconds, created_at, updated_at
        "#,
        user_id,
        block_id,
        req.mode as FocusMode,
    )
    .fetch_one(&state.db)
    .await?;

    // Record `actual_start` on the time block if it hasn't been set yet.
    sqlx::query!(
        r#"
        UPDATE time_blocks
        SET actual_start = now(), updated_at = now()
        WHERE id = $1 AND actual_start IS NULL
        "#,
        block_id,
    )
    .execute(&state.db)
    .await?;

    Ok(session)
}

/// Pause an active focus session by recording `paused_at = now()`.
pub async fn pause_focus_session(
    state: &AppState,
    user_id: Uuid,
    block_id: Uuid,
    session_id: Uuid,
) -> AppResult<FocusSession> {
    let session = fetch_session_owned(state, user_id, block_id, session_id).await?;

    if session.ended_at.is_some() {
        return Err(AppError::Conflict("session has already ended".to_owned()));
    }
    if session.paused_at.is_some() {
        return Err(AppError::Conflict("session is already paused".to_owned()));
    }

    let updated = sqlx::query_as!(
        FocusSession,
        r#"
        UPDATE focus_sessions
        SET paused_at  = now(),
            updated_at = now()
        WHERE id = $1
        RETURNING
            id, user_id, time_block_id,
            mode AS "mode: crate::modules::timeblock::models::FocusMode",
            started_at, paused_at, ended_at,
            duration_seconds, created_at, updated_at
        "#,
        session_id,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(updated)
}

/// Resume a previously paused session by clearing `paused_at`.
pub async fn resume_focus_session(
    state: &AppState,
    user_id: Uuid,
    block_id: Uuid,
    session_id: Uuid,
) -> AppResult<FocusSession> {
    let session = fetch_session_owned(state, user_id, block_id, session_id).await?;

    if session.ended_at.is_some() {
        return Err(AppError::Conflict("session has already ended".to_owned()));
    }
    if session.paused_at.is_none() {
        return Err(AppError::Conflict("session is not paused".to_owned()));
    }

    let updated = sqlx::query_as!(
        FocusSession,
        r#"
        UPDATE focus_sessions
        SET paused_at  = NULL,
            updated_at = now()
        WHERE id = $1
        RETURNING
            id, user_id, time_block_id,
            mode AS "mode: crate::modules::timeblock::models::FocusMode",
            started_at, paused_at, ended_at,
            duration_seconds, created_at, updated_at
        "#,
        session_id,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(updated)
}

/// Finish a focus session.
///
/// Sets `ended_at = now()`, stores caller-reported `duration_seconds`, updates
/// `actual_end` on the parent time block, and emits [`DomainEvent::TimeBlockFinished`].
pub async fn finish_focus_session(
    state: &AppState,
    user_id: Uuid,
    block_id: Uuid,
    session_id: Uuid,
    req: FinishFocusSessionRequest,
) -> AppResult<FocusSession> {
    let session = fetch_session_owned(state, user_id, block_id, session_id).await?;

    if session.ended_at.is_some() {
        return Err(AppError::Conflict("session has already ended".to_owned()));
    }

    let updated = sqlx::query_as!(
        FocusSession,
        r#"
        UPDATE focus_sessions
        SET ended_at         = now(),
            paused_at        = NULL,
            duration_seconds = $2,
            updated_at       = now()
        WHERE id = $1
        RETURNING
            id, user_id, time_block_id,
            mode AS "mode: crate::modules::timeblock::models::FocusMode",
            started_at, paused_at, ended_at,
            duration_seconds, created_at, updated_at
        "#,
        session_id,
        req.duration_seconds,
    )
    .fetch_one(&state.db)
    .await?;

    // Stamp actual_end on the time block.
    sqlx::query!(
        r#"
        UPDATE time_blocks
        SET actual_end = now(), updated_at = now()
        WHERE id = $1
        "#,
        block_id,
    )
    .execute(&state.db)
    .await?;

    // Emit domain event — ignore send errors (no subscribers is fine).
    let duration = req.duration_seconds.max(0) as u32;
    let _ = state.events.send(DomainEvent::TimeBlockFinished {
        time_block_id: block_id,
        user_id,
        duration_secs: duration,
    });

    Ok(updated)
}

/// List all focus sessions for a given time block, newest first.
pub async fn list_focus_sessions(
    state: &AppState,
    user_id: Uuid,
    block_id: Uuid,
) -> AppResult<Vec<FocusSession>> {
    // Ownership check.
    get_time_block(state, user_id, block_id).await?;

    let sessions = sqlx::query_as!(
        FocusSession,
        r#"
        SELECT
            id, user_id, time_block_id,
            mode AS "mode: crate::modules::timeblock::models::FocusMode",
            started_at, paused_at, ended_at,
            duration_seconds, created_at, updated_at
        FROM focus_sessions
        WHERE time_block_id = $1
        ORDER BY started_at DESC
        "#,
        block_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(sessions)
}

// ── Private helpers ────────────────────────────────────────────────────────────

/// Verify that `task_id` exists in the `tasks` table and belongs to `user_id`.
async fn verify_task_ownership(state: &AppState, user_id: Uuid, task_id: Uuid) -> AppResult<()> {
    let exists = sqlx::query_scalar!(
        r#"
        SELECT EXISTS (
            SELECT 1 FROM tasks WHERE id = $1 AND user_id = $2
        ) AS "exists!"
        "#,
        task_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?;

    if !exists {
        return Err(AppError::NotFoundMsg(format!(
            "task {task_id} not found or does not belong to you"
        )));
    }

    Ok(())
}

/// Fetch a focus session, checking both user ownership and that it belongs to
/// the expected time block.
async fn fetch_session_owned(
    state: &AppState,
    user_id: Uuid,
    block_id: Uuid,
    session_id: Uuid,
) -> AppResult<FocusSession> {
    let session = sqlx::query_as!(
        FocusSession,
        r#"
        SELECT
            id, user_id, time_block_id,
            mode AS "mode: crate::modules::timeblock::models::FocusMode",
            started_at, paused_at, ended_at,
            duration_seconds, created_at, updated_at
        FROM focus_sessions
        WHERE id = $1
        "#,
        session_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    if session.user_id != user_id {
        return Err(AppError::Forbidden);
    }

    // Also verify the session is actually linked to the requested block.
    let linked_block = session.time_block_id.ok_or(AppError::NotFound)?;
    if linked_block != block_id {
        return Err(AppError::NotFound);
    }

    Ok(session)
}
