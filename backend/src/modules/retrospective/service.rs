//! Business logic for the `retrospective` module.
//!
//! All public functions accept a reference to [`AppState`] and execute raw SQL
//! via `sqlx::query!` / `sqlx::query_as!` (compile-time checked).
//!
//! # Ownership
//!
//! Every query joins on `sprints.user_id = $user_id` to enforce that the
//! authenticated user owns the sprint before reading or writing its retro.
//! A missing sprint or sprint belonging to a different user produces
//! [`AppError::NotFound`].
//!
//! # Upsert semantics
//!
//! `PUT /api/sprints/:id/retrospective` upserts: if no row exists for the
//! sprint it is inserted; if one already exists the provided fields overwrite
//! the current values (absent fields are defaulted to the stored value in the
//! `ON CONFLICT DO UPDATE` clause).

use serde_json::Value as JsonValue;
use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    state::AppState,
};

use super::models::{Retrospective, UpsertRetrospectiveRequest};

// ── public service functions ───────────────────────────────────────────────────

/// Fetch the retrospective for a sprint, enforcing ownership.
///
/// Returns [`AppError::NotFound`] when:
/// - The sprint does not exist.
/// - The sprint belongs to a different user.
/// - No retrospective has been created yet for this sprint.
///
/// # Errors
///
/// - [`AppError::NotFound`] — sprint not found / no retro yet.
/// - [`AppError::Db`] — database failure.
pub async fn get_retrospective(
    state: &AppState,
    user_id: Uuid,
    sprint_id: Uuid,
) -> AppResult<Retrospective> {
    // Validate sprint ownership first so we return a meaningful 404 rather than
    // silently returning nothing when the sprint itself does not exist.
    verify_sprint_ownership(state, user_id, sprint_id).await?;

    let retro = sqlx::query_as!(
        Retrospective,
        r#"
        SELECT
            id,
            user_id,
            sprint_id,
            went_well,
            went_wrong,
            action_items,
            created_at,
            updated_at
        FROM retrospectives
        WHERE sprint_id = $1 AND user_id = $2
        "#,
        sprint_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(retro)
}

/// Upsert the retrospective for a sprint.
///
/// - If no retrospective exists for `sprint_id`, a new row is inserted.
/// - If one already exists, the provided fields overwrite the stored values.
///   Fields omitted from the request body retain their current database values
///   via the `COALESCE` / `EXCLUDED` pattern in the `ON CONFLICT` clause.
///
/// Ownership is enforced: the sprint must belong to the authenticated user.
///
/// # Errors
///
/// - [`AppError::NotFound`] — sprint does not exist or belongs to a different user.
/// - [`AppError::Db`] — database failure.
pub async fn upsert_retrospective(
    state: &AppState,
    user_id: Uuid,
    sprint_id: Uuid,
    req: UpsertRetrospectiveRequest,
) -> AppResult<Retrospective> {
    // Validate sprint ownership first.
    verify_sprint_ownership(state, user_id, sprint_id).await?;

    // Resolve defaults for the INSERT path (first-time creation).
    let insert_action_items: JsonValue = req
        .action_items
        .clone()
        .unwrap_or_else(|| JsonValue::Array(vec![]));

    // For the UPDATE path we COALESCE with the incoming value so that omitted
    // fields keep their stored values. When `req.action_items` is Some we use
    // it; when None we fall back to the existing column value.
    let update_action_items: Option<JsonValue> = req.action_items;

    let retro = sqlx::query_as!(
        Retrospective,
        r#"
        INSERT INTO retrospectives (
            user_id,
            sprint_id,
            went_well,
            went_wrong,
            action_items
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT ON CONSTRAINT uq_retrospectives_sprint DO UPDATE
        SET
            went_well    = COALESCE($3,      retrospectives.went_well),
            went_wrong   = COALESCE($4,      retrospectives.went_wrong),
            action_items = COALESCE($6::jsonb, retrospectives.action_items),
            updated_at   = now()
        RETURNING
            id,
            user_id,
            sprint_id,
            went_well,
            went_wrong,
            action_items,
            created_at,
            updated_at
        "#,
        user_id,                       // $1
        sprint_id,                     // $2
        req.went_well,                 // $3  — Option<String>; NULL ⇒ coalesce keeps old
        req.went_wrong,                // $4  — Option<String>; NULL ⇒ coalesce keeps old
        insert_action_items,           // $5  — used in INSERT (defaults to [])
        update_action_items as Option<JsonValue>, // $6 — used in UPDATE COALESCE
    )
    .fetch_one(&state.db)
    .await?;

    Ok(retro)
}

// ── private helpers ────────────────────────────────────────────────────────────

/// Assert the sprint exists and belongs to `user_id`.
///
/// Returns [`AppError::NotFound`] when the sprint is missing or owned by
/// someone else.
async fn verify_sprint_ownership(
    state: &AppState,
    user_id: Uuid,
    sprint_id: Uuid,
) -> AppResult<()> {
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

    Ok(())
}
