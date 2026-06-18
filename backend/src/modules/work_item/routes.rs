//! Route definitions for the `work_item` module.
//!
//! All routes are mounted under `/api/work-items` by `main.rs`.
//!
//! ```text
//! GET    /api/work-items                              list_work_items
//! POST   /api/work-items                              create_work_item
//! GET    /api/work-items/:id                          get_work_item
//! PATCH  /api/work-items/:id                          update_work_item
//! DELETE /api/work-items/:id                          delete_work_item
//! PATCH  /api/work-items/:id/status                   set_status
//! PATCH  /api/work-items/:id/points                   set_points
//! PATCH  /api/work-items/:id/column                   set_column
//! PATCH  /api/work-items/:id/sprint                   move_to_sprint
//! PATCH  /api/work-items/:id/backlog                  move_to_backlog
//! GET    /api/work-items/:id/subtasks                 list_subtasks
//! POST   /api/work-items/:id/subtasks                 add_subtask
//! PATCH  /api/work-items/:id/subtasks/:subtask_id     update_subtask
//! DELETE /api/work-items/:id/subtasks/:subtask_id     delete_subtask
//! GET    /api/work-items/:id/links                    list_links
//! POST   /api/work-items/:id/links                    create_link
//! DELETE /api/work-items/:id/links/:link_id           delete_link
//! GET    /api/work-items/:id/web-links                list_web_links
//! POST   /api/work-items/:id/web-links                create_web_link
//! DELETE /api/work-items/:id/web-links/:link_id       delete_web_link
//! GET    /api/work-items/:id/attachments              list_attachments
//! POST   /api/work-items/:id/attachments              create_attachment
//! DELETE /api/work-items/:id/attachments/:att_id      delete_attachment
//! ```

use axum::{
    routing::{delete, get, patch},
    Router,
};

use crate::shared::state::AppState;

use super::handlers;

/// Build the [`Router`] for this module.
///
/// `main.rs` nests this under `/api/work-items`:
///
/// ```rust,ignore
/// .nest("/work-items", modules::work_item::router())
/// ```
pub fn router() -> Router<AppState> {
    Router::new()
        // Collection
        .route("/", get(handlers::list_work_items).post(handlers::create_work_item))
        // Item CRUD
        .route(
            "/:id",
            get(handlers::get_work_item)
                .patch(handlers::update_work_item)
                .delete(handlers::delete_work_item),
        )
        // Sub-resource: status transition
        .route("/:id/status", patch(handlers::set_status))
        // Sub-resource: story points
        .route("/:id/points", patch(handlers::set_points))
        // Sub-resource: board column assignment
        .route("/:id/column", patch(handlers::set_column))
        // Sub-resource: sprint / backlog moves
        .route("/:id/sprint", patch(handlers::move_to_sprint))
        .route("/:id/backlog", patch(handlers::move_to_backlog))
        // Sub-resource: subtasks collection
        .route(
            "/:id/subtasks",
            get(handlers::list_subtasks).post(handlers::add_subtask),
        )
        // Sub-resource: individual subtask
        .route(
            "/:id/subtasks/:subtask_id",
            patch(handlers::update_subtask).delete(handlers::delete_subtask),
        )
        // Sub-resource: work-item links
        .route(
            "/:id/links",
            get(handlers::list_links).post(handlers::create_link),
        )
        .route(
            "/:id/links/:link_id",
            delete(handlers::delete_link),
        )
        // Sub-resource: web links
        .route(
            "/:id/web-links",
            get(handlers::list_web_links).post(handlers::create_web_link),
        )
        .route(
            "/:id/web-links/:link_id",
            delete(handlers::delete_web_link),
        )
        // Sub-resource: file attachments
        .route(
            "/:id/attachments",
            get(handlers::list_attachments).post(handlers::create_attachment),
        )
        .route(
            "/:id/attachments/:att_id",
            delete(handlers::delete_attachment),
        )
}
