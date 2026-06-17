//! Task module — route definitions.
//!
//! All routes are auth-protected (enforced inside each handler via the
//! [`AuthUser`] extractor).
//!
//! Mounted by `main.rs`:
//! - `/api/tasks`   → this router
//! - `/api/tags`    → this router (tag management lives here, owned by task module)

use axum::{routing, Router};

use crate::shared::state::AppState;

use super::handlers;

/// Build the task-module router.
///
/// This function is called once at startup by `main.rs` which mounts it at
/// `/api/tasks`. Tag routes are added here too because tags are owned by the
/// task module and not independently mounted; the foundation wires them under
/// `/api/tasks` for now — the individual paths under that prefix handle tags.
pub fn router() -> Router<AppState> {
    Router::new()
        // ── Tasks ──────────────────────────────────────────────────────────────
        .route(
            "/",
            routing::get(handlers::list_tasks).post(handlers::create_task),
        )
        .route(
            "/:id",
            routing::get(handlers::get_task)
                .patch(handlers::update_task)
                .delete(handlers::delete_task),
        )
        // ── Subtasks (nested under task) ───────────────────────────────────────
        .route(
            "/:id/subtasks",
            routing::get(handlers::list_subtasks).post(handlers::create_subtask),
        )
        .route(
            "/:id/subtasks/:subtask_id",
            routing::patch(handlers::update_subtask).delete(handlers::delete_subtask),
        )
        // ── Task ↔ tag associations ────────────────────────────────────────────
        .route("/:id/tags", routing::post(handlers::attach_tag))
        .route("/:id/tags/:tag_id", routing::delete(handlers::detach_tag))
        // ── Standalone tag CRUD (under /api/tasks/tags for module ownership) ───
        .route(
            "/tags",
            routing::get(handlers::list_tags).post(handlers::create_tag),
        )
        .route(
            "/tags/:tag_id",
            routing::patch(handlers::update_tag).delete(handlers::delete_tag),
        )
}
