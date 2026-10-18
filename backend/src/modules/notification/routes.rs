//! Route wiring for the `notification` module.
//!
//! All routes are mounted under `/api/notifications` by `main.rs`.
//!
//! | Method   | Path                               | Handler                  | Auth |
//! |----------|------------------------------------|--------------------------|------|
//! | GET      | `/`                                | list_notifications       | yes  |
//! | GET      | `/unread-count`                    | get_unread_count         | yes  |
//! | GET      | `/:id`                             | get_notification         | yes  |
//! | POST     | `/`                                | create_notification      | yes  |
//! | PATCH    | `/:id`                             | update_notification      | yes  |
//! | POST     | `/:id/read`                        | mark_notification_read   | yes  |
//! | POST     | `/mark-all-read`                   | mark_all_read            | yes  |
//! | DELETE   | `/:id`                             | delete_notification      | yes  |
//! | POST     | `/push/subscribe`                  | push_subscribe           | yes  |
//! | POST     | `/push/unsubscribe`                | push_unsubscribe         | yes  |

use axum::{
    routing::{get, post},
    Router,
};

use crate::shared::state::AppState;

use super::handlers::{
    create_notification, delete_notification, get_notification, get_unread_count,
    list_notifications, mark_all_read, mark_notification_read, push_subscribe, push_unsubscribe,
    snooze_notification, unsnooze_notification, update_notification,
};

/// Build and return the notification module router.
///
/// Mounted at `/api/notifications` in `main.rs`.
pub fn router() -> Router<AppState> {
    Router::new()
        // Collection routes
        .route("/", get(list_notifications).post(create_notification))
        // Batch action — must come before `/:id` to avoid shadowing
        .route("/unread-count", get(get_unread_count))
        .route("/mark-all-read", post(mark_all_read))
        // Browser Push subscription routes — static prefix, must precede `/:id`
        .route("/push/subscribe", post(push_subscribe))
        .route("/push/unsubscribe", post(push_unsubscribe))
        // Individual resource routes
        .route(
            "/:id",
            get(get_notification)
                .patch(update_notification)
                .delete(delete_notification),
        )
        .route("/:id/read", post(mark_notification_read))
        .route("/:id/snooze", post(snooze_notification))
        .route("/:id/unsnooze", post(unsnooze_notification))
}
