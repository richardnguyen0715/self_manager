//! Business logic for the `review` module.
//!
//! Owns the `sprint_reviews` table. All public functions accept a reference to
//! [`AppState`] and execute compile-time-checked SQL via `sqlx::query!` /
//! `sqlx::query_as!`.
//!
//! ## Ownership model
//!
//! Every query includes `user_id = $n` to prevent cross-user data access.
//! Sprint ownership is verified by joining through `sprints` — if the sprint
//! does not exist for the requesting user, the operation returns
//! [`AppError::NotFound`].
//!
//! ## Velocity calculation
//!
//! `velocity = (completed_points / planned_points) * 100.0`, clamped to
//! `[0.0, 100.0]`. When `planned_points = 0` the velocity is `0.0`.

use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    state::AppState,
};

use super::models::{SprintReview, SprintReviewResponse, UpsertReviewRequest};

// ── helpers ────────────────────────────────────────────────────────────────────

/// Compute velocity percentage, guarding against division by zero.
///
/// Returns a value in `[0.0, 100.0]`.
#[inline]
fn compute_velocity(planned: i32, completed: i32) -> f64 {
    if planned <= 0 {
        return 0.0;
    }
    let v = (completed as f64 / planned as f64) * 100.0;
    v.clamp(0.0, 100.0)
}

// ── public service functions ───────────────────────────────────────────────────

/// Fetch the sprint review for a given sprint, enforcing ownership.
///
/// Returns [`AppError::NotFound`] when:
/// - The sprint does not exist for this user, OR
/// - No review has been created yet for this sprint.
///
/// # Errors
///
/// - [`AppError::NotFound`] — sprint not owned by user, or review absent.
/// - [`AppError::Db`] — database failure.
pub async fn get_review(
    state: &AppState,
    user_id: Uuid,
    sprint_id: Uuid,
) -> AppResult<SprintReviewResponse> {
    // Verify that the sprint exists and belongs to this user before querying
    // the review. This gives a clear NOT_FOUND rather than a misleading "no
    // review" when the sprint itself is missing.
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

    let review = sqlx::query_as!(
        SprintReview,
        r#"
        SELECT
            id,
            user_id,
            sprint_id,
            planned_points,
            completed_points,
            velocity::float8 AS "velocity!: f64",
            summary,
            created_at,
            updated_at
        FROM sprint_reviews
        WHERE sprint_id = $1 AND user_id = $2
        "#,
        sprint_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(SprintReviewResponse::from(review))
}

/// Upsert the sprint review for a given sprint.
///
/// On **insert**: `planned_points` defaults to the sum of `story_points` of all
/// work items assigned to the sprint; `completed_points` defaults to the
/// sprint's stored `completed_points` column. `velocity` is derived.
///
/// On **update**: only fields present in the request override existing values;
/// `velocity` is always recomputed from the final `planned_points` and
/// `completed_points`.
///
/// # Errors
///
/// - [`AppError::NotFound`] — sprint not found or not owned by user.
/// - [`AppError::Db`] — database failure.
pub async fn upsert_review(
    state: &AppState,
    user_id: Uuid,
    sprint_id: Uuid,
    req: UpsertReviewRequest,
) -> AppResult<SprintReviewResponse> {
    // ── 1. Verify sprint ownership and fetch defaults ─────────────────────────

    struct SprintDefaults {
        completed_points: i32,
    }

    let sprint = sqlx::query_as!(
        SprintDefaults,
        r#"
        SELECT completed_points
        FROM sprints
        WHERE id = $1 AND user_id = $2
        "#,
        sprint_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // ── 2. Compute defaults for planned_points (Σ story_points of sprint items)

    let derived_planned: i64 = sqlx::query_scalar!(
        r#"
        SELECT COALESCE(SUM(story_points), 0)
        FROM work_items
        WHERE sprint_id = $1 AND user_id = $2
        "#,
        sprint_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    let derived_planned = derived_planned as i32;

    // ── 3. Check whether a review already exists ──────────────────────────────

    struct ExistingReview {
        id: Uuid,
        planned_points: i32,
        completed_points: i32,
        summary: Option<String>,
    }

    let existing = sqlx::query_as!(
        ExistingReview,
        r#"
        SELECT id, planned_points, completed_points, summary
        FROM sprint_reviews
        WHERE sprint_id = $1 AND user_id = $2
        "#,
        sprint_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?;

    let review = if let Some(existing) = existing {
        // ── UPDATE path ───────────────────────────────────────────────────────
        // Merge request overrides onto existing row values.
        let new_planned = req.planned_points.unwrap_or(existing.planned_points);
        let new_completed = req.completed_points.unwrap_or(existing.completed_points);
        let new_velocity = compute_velocity(new_planned, new_completed);
        let new_summary = if req.summary.is_some() {
            req.summary
        } else {
            existing.summary
        };

        sqlx::query_as!(
            SprintReview,
            r#"
            UPDATE sprint_reviews
            SET
                planned_points   = $3,
                completed_points = $4,
                velocity         = $5::float8,
                summary          = $6,
                updated_at       = now()
            WHERE id = $1 AND user_id = $2
            RETURNING
                id,
                user_id,
                sprint_id,
                planned_points,
                completed_points,
                velocity::float8 AS "velocity!: f64",
                summary,
                created_at,
                updated_at
            "#,
            existing.id,
            user_id,
            new_planned,
            new_completed,
            new_velocity,
            new_summary,
        )
        .fetch_one(&state.db)
        .await?
    } else {
        // ── INSERT path ───────────────────────────────────────────────────────
        // Use request overrides where given, otherwise fall back to derived
        // values from the sprint.
        let planned = req.planned_points.unwrap_or(derived_planned);
        let completed = req
            .completed_points
            .unwrap_or(sprint.completed_points);
        let velocity = compute_velocity(planned, completed);

        sqlx::query_as!(
            SprintReview,
            r#"
            INSERT INTO sprint_reviews
                (user_id, sprint_id, planned_points, completed_points, velocity, summary)
            VALUES ($1, $2, $3, $4, $5::float8, $6)
            RETURNING
                id,
                user_id,
                sprint_id,
                planned_points,
                completed_points,
                velocity::float8 AS "velocity!: f64",
                summary,
                created_at,
                updated_at
            "#,
            user_id,
            sprint_id,
            planned,
            completed,
            velocity,
            req.summary,
        )
        .fetch_one(&state.db)
        .await?
    };

    Ok(SprintReviewResponse::from(review))
}
