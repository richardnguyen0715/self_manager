//! Business logic for the `initiative` module.
//!
//! All public functions accept a reference to [`AppState`] and execute raw SQL
//! via `sqlx::query!` / `sqlx::query_as!` (compile-time checked).
//!
//! # Ownership
//!
//! Every query includes `AND user_id = $n`; a missing row returns
//! [`AppError::NotFound`] rather than leaking existence information to another
//! user.
//!
//! # Enum-as-text pattern
//!
//! The `initiative_status` and `epic_status` postgres enums are handled
//! without `sqlx::Type` derivation:
//! - **SELECT** – `status::text AS "status!"`
//! - **INSERT / UPDATE** – `($n::text)::initiative_status`
//! - **WHERE filter** – `status::text = $n`

use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    state::AppState,
};

use super::models::{
    CreateInitiativeRequest, EpicListResponse, Initiative, InitiativeEpicSummary,
    InitiativeListResponse, InitiativeResponse, InitiativeStatus, ListInitiativesQuery,
    UpdateInitiativeRequest,
};

// ── helpers ─────────────────────────────────────────────────────────────────────

/// Clamp `limit` to `[1, 200]` and default to 50.
#[inline]
fn clamp_limit(raw: Option<i64>) -> i64 {
    raw.unwrap_or(50).clamp(1, 200)
}

/// Default `offset` to 0, floor at 0.
#[inline]
fn clamp_offset(raw: Option<i64>) -> i64 {
    raw.unwrap_or(0).max(0)
}

// ── public service functions ─────────────────────────────────────────────────────

/// Fetch a paginated list of initiatives for the authenticated user.
///
/// Optionally filters by `goal_id` and/or `status`. Results are ordered by
/// `position ASC`, then `created_at ASC` for stable pagination.
///
/// # Errors
///
/// Returns [`AppError::Db`] on database failure.
pub async fn list_initiatives(
    state: &AppState,
    user_id: Uuid,
    query: &ListInitiativesQuery,
) -> AppResult<InitiativeListResponse> {
    let limit = clamp_limit(query.limit);
    let offset = clamp_offset(query.offset);

    // Build the filter combination from the optional query params.
    // We use four explicit branches to keep compile-time query checking intact
    // rather than resorting to runtime query building.
    let (rows, total) = match (&query.goal_id, &query.status) {
        (Some(goal_id), Some(status)) => {
            let status_str = status.as_str();
            let rows = sqlx::query_as!(
                Initiative,
                r#"
                SELECT
                    id, user_id, goal_id, title, description,
                    status::text AS "status!",
                    color, position, created_at, updated_at
                FROM initiatives
                WHERE user_id = $1
                  AND goal_id = $2
                  AND status::text = $3
                ORDER BY position ASC, created_at ASC
                LIMIT $4 OFFSET $5
                "#,
                user_id,
                goal_id,
                status_str,
                limit,
                offset,
            )
            .fetch_all(&state.db)
            .await?;

            let total: i64 = sqlx::query_scalar!(
                r#"
                SELECT COUNT(*)
                FROM initiatives
                WHERE user_id = $1 AND goal_id = $2 AND status::text = $3
                "#,
                user_id,
                goal_id,
                status_str,
            )
            .fetch_one(&state.db)
            .await?
            .unwrap_or(0);

            (rows, total)
        }

        (Some(goal_id), None) => {
            let rows = sqlx::query_as!(
                Initiative,
                r#"
                SELECT
                    id, user_id, goal_id, title, description,
                    status::text AS "status!",
                    color, position, created_at, updated_at
                FROM initiatives
                WHERE user_id = $1 AND goal_id = $2
                ORDER BY position ASC, created_at ASC
                LIMIT $3 OFFSET $4
                "#,
                user_id,
                goal_id,
                limit,
                offset,
            )
            .fetch_all(&state.db)
            .await?;

            let total: i64 = sqlx::query_scalar!(
                "SELECT COUNT(*) FROM initiatives WHERE user_id = $1 AND goal_id = $2",
                user_id,
                goal_id,
            )
            .fetch_one(&state.db)
            .await?
            .unwrap_or(0);

            (rows, total)
        }

        (None, Some(status)) => {
            let status_str = status.as_str();
            let rows = sqlx::query_as!(
                Initiative,
                r#"
                SELECT
                    id, user_id, goal_id, title, description,
                    status::text AS "status!",
                    color, position, created_at, updated_at
                FROM initiatives
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
                "SELECT COUNT(*) FROM initiatives WHERE user_id = $1 AND status::text = $2",
                user_id,
                status_str,
            )
            .fetch_one(&state.db)
            .await?
            .unwrap_or(0);

            (rows, total)
        }

        (None, None) => {
            let rows = sqlx::query_as!(
                Initiative,
                r#"
                SELECT
                    id, user_id, goal_id, title, description,
                    status::text AS "status!",
                    color, position, created_at, updated_at
                FROM initiatives
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

            let total: i64 = sqlx::query_scalar!(
                "SELECT COUNT(*) FROM initiatives WHERE user_id = $1",
                user_id,
            )
            .fetch_one(&state.db)
            .await?
            .unwrap_or(0);

            (rows, total)
        }
    };

    Ok(InitiativeListResponse {
        data: rows.into_iter().map(InitiativeResponse::from).collect(),
        total,
    })
}

/// Create a new initiative for the authenticated user.
///
/// Verifies that the referenced `goal_id` belongs to the requesting user
/// before inserting; returns [`AppError::NotFound`] if the goal is missing or
/// owned by someone else.
///
/// # Errors
///
/// - [`AppError::NotFound`] — referenced goal not found or not owned by this user.
/// - [`AppError::Db`] — database failure.
pub async fn create_initiative(
    state: &AppState,
    user_id: Uuid,
    req: CreateInitiativeRequest,
) -> AppResult<InitiativeResponse> {
    // Verify goal ownership.
    let goal_exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM goals WHERE id = $1 AND user_id = $2)",
        req.goal_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !goal_exists {
        return Err(AppError::NotFound);
    }

    let status = req
        .status
        .as_ref()
        .map(InitiativeStatus::as_str)
        .unwrap_or("active");

    let position = req.position.unwrap_or(0);

    let initiative = sqlx::query_as!(
        Initiative,
        r#"
        INSERT INTO initiatives (user_id, goal_id, title, description, status, color, position)
        VALUES ($1, $2, $3, $4, ($5::text)::initiative_status, $6, $7)
        RETURNING
            id, user_id, goal_id, title, description,
            status::text AS "status!",
            color, position, created_at, updated_at
        "#,
        user_id,
        req.goal_id,
        req.title,
        req.description,
        status,
        req.color,
        position,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(InitiativeResponse::from(initiative))
}

/// Fetch a single initiative by ID, enforcing ownership.
///
/// # Errors
///
/// - [`AppError::NotFound`] — no initiative with that ID exists for this user.
/// - [`AppError::Db`] — database failure.
pub async fn get_initiative(
    state: &AppState,
    user_id: Uuid,
    initiative_id: Uuid,
) -> AppResult<InitiativeResponse> {
    let initiative = sqlx::query_as!(
        Initiative,
        r#"
        SELECT
            id, user_id, goal_id, title, description,
            status::text AS "status!",
            color, position, created_at, updated_at
        FROM initiatives
        WHERE id = $1 AND user_id = $2
        "#,
        initiative_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(InitiativeResponse::from(initiative))
}

/// Partially update an initiative; only provided fields are mutated.
///
/// When `goal_id` is provided, the new goal must also belong to the same user.
///
/// # Errors
///
/// - [`AppError::NotFound`] — initiative not found / belongs to a different user,
///   or the new goal_id is not owned by this user.
/// - [`AppError::Db`] — database failure.
pub async fn update_initiative(
    state: &AppState,
    user_id: Uuid,
    initiative_id: Uuid,
    req: UpdateInitiativeRequest,
) -> AppResult<InitiativeResponse> {
    // Fetch current state so we can coalesce absent fields.
    let current = sqlx::query_as!(
        Initiative,
        r#"
        SELECT
            id, user_id, goal_id, title, description,
            status::text AS "status!",
            color, position, created_at, updated_at
        FROM initiatives
        WHERE id = $1 AND user_id = $2
        "#,
        initiative_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // When changing goal_id, verify the new goal belongs to this user.
    if let Some(new_goal_id) = req.goal_id {
        let goal_exists: bool = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM goals WHERE id = $1 AND user_id = $2)",
            new_goal_id,
            user_id,
        )
        .fetch_one(&state.db)
        .await?
        .unwrap_or(false);

        if !goal_exists {
            return Err(AppError::NotFound);
        }
    }

    // Coalesce request fields onto current values.
    let new_goal_id = req.goal_id.unwrap_or(current.goal_id);
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
    let new_status = req
        .status
        .as_ref()
        .map(InitiativeStatus::as_str)
        .unwrap_or(current.status.as_str())
        .to_owned();
    let new_color = if req.color.is_some() {
        req.color.clone()
    } else {
        current.color.clone()
    };
    let new_position = req.position.unwrap_or(current.position);

    let updated = sqlx::query_as!(
        Initiative,
        r#"
        UPDATE initiatives
        SET
            goal_id     = $3,
            title       = $4,
            description = $5,
            status      = ($6::text)::initiative_status,
            color       = $7,
            position    = $8,
            updated_at  = now()
        WHERE id = $1 AND user_id = $2
        RETURNING
            id, user_id, goal_id, title, description,
            status::text AS "status!",
            color, position, created_at, updated_at
        "#,
        initiative_id,
        user_id,
        new_goal_id,
        new_title,
        new_description,
        new_status,
        new_color,
        new_position,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(InitiativeResponse::from(updated))
}

/// Delete an initiative by ID, enforcing ownership.
///
/// Epics that belong to this initiative are cascade-deleted by the database
/// `ON DELETE CASCADE` constraint.
///
/// # Errors
///
/// - [`AppError::NotFound`] — initiative not found or owned by a different user.
/// - [`AppError::Db`] — database failure.
pub async fn delete_initiative(
    state: &AppState,
    user_id: Uuid,
    initiative_id: Uuid,
) -> AppResult<()> {
    let result = sqlx::query!(
        "DELETE FROM initiatives WHERE id = $1 AND user_id = $2",
        initiative_id,
        user_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}

/// List all epics that belong to a specific initiative, enforcing ownership of
/// the initiative itself.
///
/// Returns lightweight epic summaries ordered by `position ASC, created_at ASC`.
///
/// # Errors
///
/// - [`AppError::NotFound`] — initiative not found or not owned by this user.
/// - [`AppError::Db`] — database failure.
pub async fn list_initiative_epics(
    state: &AppState,
    user_id: Uuid,
    initiative_id: Uuid,
) -> AppResult<EpicListResponse> {
    // Verify the initiative belongs to this user.
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM initiatives WHERE id = $1 AND user_id = $2)",
        initiative_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound);
    }

    let rows = sqlx::query_as!(
        InitiativeEpicSummary,
        r#"
        SELECT
            id, user_id, initiative_id, title, description,
            status::text AS "status!",
            start_date, due_date, color, position, created_at, updated_at
        FROM epics
        WHERE initiative_id = $1 AND user_id = $2
        ORDER BY position ASC, created_at ASC
        "#,
        initiative_id,
        user_id,
    )
    .fetch_all(&state.db)
    .await?;

    let total = rows.len() as i64;

    Ok(EpicListResponse { data: rows, total })
}
