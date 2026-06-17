//! Calendar module — route wiring.
//!
//! Exposes [`router`] which is consumed by `main.rs` and mounted at
//! `/api/calendar`.

use axum::{routing::get, Router};

use crate::shared::state::AppState;

use super::handlers;

/// Build and return the calendar module's [`Router`].
///
/// Mount point (set by `main.rs`): `/api/calendar`
///
/// | Method   | Path                  | Handler            |
/// |----------|-----------------------|--------------------|
/// | `GET`    | `/`                   | [`handlers::list_events`] — range query (`?start=&end=`) |
/// | `POST`   | `/`                   | [`handlers::create_event`] |
/// | `GET`    | `/:id`                | [`handlers::get_event`] |
/// | `PATCH`  | `/:id`                | [`handlers::update_event`] |
/// | `DELETE` | `/:id`                | [`handlers::delete_event`] |
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(handlers::list_events).post(handlers::create_event))
        .route(
            "/:id",
            get(handlers::get_event)
                .patch(handlers::update_event)
                .delete(handlers::delete_event),
        )
}
