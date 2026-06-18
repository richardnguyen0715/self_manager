//! Auth module — route wiring.
//!
//! Mounts all auth endpoints relative to the prefix that `main.rs` nests this
//! router under (`/api/auth`):
//!
//! | Method | Path              | Handler                        | Auth required |
//! |--------|-------------------|--------------------------------|---------------|
//! | POST   | /register         | [`handlers::register`]         | No            |
//! | POST   | /login            | [`handlers::login`]            | No            |
//! | POST   | /refresh          | [`handlers::refresh`]          | No            |
//! | POST   | /logout           | [`handlers::logout`]           | Yes (access)  |
//! | POST   | /logout-all       | [`handlers::logout_all`]       | Yes (access)  |
//! | GET    | /me               | [`handlers::me`]               | Yes (access)  |
//! | PATCH  | /me               | [`handlers::update_me`]        | Yes (access)  |
//! | POST   | /me/avatar        | [`handlers::upload_avatar`]    | Yes (access)  |
//! | DELETE | /me/avatar        | [`handlers::delete_avatar`]    | Yes (access)  |

use axum::{
    routing::{get, post},
    Router,
};

use crate::shared::state::AppState;

use super::handlers;

/// Construct the auth sub-router.
///
/// All routes are relative to the `/api/auth` prefix set by `main.rs`.
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/register", post(handlers::register))
        .route("/login", post(handlers::login))
        .route("/refresh", post(handlers::refresh))
        .route("/logout", post(handlers::logout))
        .route("/logout-all", post(handlers::logout_all))
        .route("/me", get(handlers::me).patch(handlers::update_me))
        .route(
            "/me/avatar",
            post(handlers::upload_avatar).delete(handlers::delete_avatar),
        )
}
