//! Route definitions for the `database` module.
//!
//! Mounted under `/api/databases` by `main.rs`:
//!
//! ```rust,ignore
//! .nest("/databases", modules::database::router())
//! ```
//!
//! ## Route table
//!
//! ```text
//! GET    /                                   list_databases
//! POST   /                                   create_database
//! GET    /:id                                get_database
//! PATCH  /:id                                update_database
//! DELETE /:id                                delete_database
//!
//! GET    /:id/columns                        list_columns
//! POST   /:id/columns                        create_column
//! PATCH  /:id/columns/:col_id                update_column
//! DELETE /:id/columns/:col_id                delete_column
//!
//! GET    /:id/rows                           list_rows
//! POST   /:id/rows                           create_row
//! PATCH  /:id/rows                           batch_update_rows   ← literal before /:row_id
//! PATCH  /:id/rows/:row_id                   update_row
//! DELETE /:id/rows/:row_id                   delete_row
//!
//! GET    /:id/views                          list_views
//! POST   /:id/views                          create_view
//! PATCH  /:id/views/:view_id                 update_view
//! DELETE /:id/views/:view_id                 delete_view
//! GET    /:id/views/:view_id/rows            get_view_rows
//! ```
//!
//! NOTE: The batch-update route `PATCH /:id/rows` and the single-row route
//! `PATCH /:id/rows/:row_id` share the same HTTP verb. Axum resolves them
//! correctly because `/:id/rows` (no further segment) is registered separately
//! from `/:id/rows/:row_id`.

use axum::{
    routing::{get, patch, post},
    Router,
};

use crate::shared::state::AppState;

use super::handlers;

/// Build the [`Router`] for the `database` module.
///
/// `main.rs` nests this under `/api/databases`:
///
/// ```rust,ignore
/// .nest("/databases", modules::database::router())
/// ```
pub fn router() -> Router<AppState> {
    Router::new()
        // ── Database collection ──────────────────────────────────────────────
        .route(
            "/",
            get(handlers::list_databases).post(handlers::create_database),
        )
        // ── Individual database ──────────────────────────────────────────────
        .route(
            "/:id",
            get(handlers::get_database)
                .patch(handlers::update_database)
                .delete(handlers::delete_database),
        )
        // ── Columns ──────────────────────────────────────────────────────────
        .route(
            "/:id/columns",
            get(handlers::list_columns).post(handlers::create_column),
        )
        .route(
            "/:id/columns/:col_id",
            patch(handlers::update_column).delete(handlers::delete_column),
        )
        // ── Rows ─────────────────────────────────────────────────────────────
        .route(
            "/:id/rows",
            get(handlers::list_rows)
                .post(handlers::create_row)
                // Batch update — no extra path segment; Axum differentiates from
                // /:id/rows/:row_id by segment count.
                .patch(handlers::batch_update_rows),
        )
        .route(
            "/:id/rows/:row_id",
            patch(handlers::update_row).delete(handlers::delete_row),
        )
        // ── Views ─────────────────────────────────────────────────────────────
        .route(
            "/:id/views",
            get(handlers::list_views).post(handlers::create_view),
        )
        .route(
            "/:id/views/:view_id",
            patch(handlers::update_view).delete(handlers::delete_view),
        )
        // View rows (filtered + sorted + grouped)
        .route(
            "/:id/views/:view_id/rows",
            get(handlers::get_view_rows),
        )
}
