//! Business logic for the `estimate` module.
//!
//! Besides the catalog lookups, this module owns the per-project validation of
//! `work_items.story_points` used by the `work_item` service.

use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    state::AppState,
};

use super::models::{EstimateSystem, DEFAULT_SYSTEM_ID, SYSTEMS};

/// Full catalog, in display order.
pub fn catalog() -> &'static [EstimateSystem] {
    SYSTEMS
}

/// Look up a system by id.
pub fn find_system(id: &str) -> Option<&'static EstimateSystem> {
    SYSTEMS.iter().find(|s| s.id == id)
}

/// `true` when `id` names a known estimate system.
pub fn is_known_system(id: &str) -> bool {
    find_system(id).is_some()
}

/// Validate a story-points value against an estimate system.
///
/// Rules:
/// - `None` (clear) is always allowed.
/// - System `none` rejects any non-null value.
/// - Otherwise the value must be in the system's list, except when it equals
///   `current` (the value already stored, so unchanged values stay accepted
///   after a system change).
pub fn check_points(system_id: &str, points: Option<i32>, current: Option<i32>) -> AppResult<()> {
    let Some(value) = points else {
        return Ok(());
    };

    let system = find_system(system_id)
        .or_else(|| find_system(DEFAULT_SYSTEM_ID))
        .expect("default estimate system is in the catalog");

    let invalid = || {
        AppError::Validation(format!(
            "story_points {value} is not valid for estimate system {}",
            system.id
        ))
    };

    if system.id == "none" {
        return Err(invalid());
    }
    if current == Some(value) {
        return Ok(());
    }
    if system.values.iter().any(|v| v.value == value) {
        Ok(())
    } else {
        Err(invalid())
    }
}

/// Resolve the estimate system id of a project owned by `user_id`.
///
/// `None` (no project) and unknown/foreign projects resolve to the default
/// system.
pub async fn system_for_project(
    state: &AppState,
    user_id: Uuid,
    project_id: Option<Uuid>,
) -> AppResult<String> {
    let Some(pid) = project_id else {
        return Ok(DEFAULT_SYSTEM_ID.to_owned());
    };
    let system: Option<String> = sqlx::query_scalar(
        "SELECT estimate_system FROM projects WHERE id = $1 AND user_id = $2",
    )
    .bind(pid)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?;
    Ok(system
        .filter(|s| is_known_system(s))
        .unwrap_or_else(|| DEFAULT_SYSTEM_ID.to_owned()))
}
