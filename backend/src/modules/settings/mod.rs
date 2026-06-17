//! `settings` module — user appearance preferences, notification preferences,
//! and account management (password change, account deletion).
//!
//! # Database tables owned by this module
//!
//! - `user_preferences` — appearance + notification prefs (JSONB), 1-1 with users.
//!
//! The `push_subscriptions` table is **owned by the notification module**; this
//! module queries it read-only to populate the `browser_push_subscribed` field.
//!
//! # Endpoints
//!
//! All paths are relative to `/api/settings` (prefix set by `main.rs`):
//!
//! | Method | Path                   | Description                          |
//! |--------|------------------------|--------------------------------------|
//! | GET    | /appearance            | Return appearance preferences        |
//! | PATCH  | /appearance            | Update appearance preferences        |
//! | GET    | /notifications         | Return notification preferences      |
//! | PATCH  | /notifications         | Update notification preferences      |
//! | POST   | /account/password      | Change password (verifies current)   |
//! | POST   | /account/delete        | Delete account (requires password)   |

pub mod handlers;
pub mod models;
pub mod routes;
pub mod service;

pub use routes::router;
