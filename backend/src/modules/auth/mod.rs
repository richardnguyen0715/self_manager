//! Auth module.
//!
//! Responsible for:
//! - User registration and login.
//! - JWT access token (15 min) and refresh token (30 days) issuance.
//! - Refresh token rotation and revocation.
//! - Authenticated user profile retrieval.
//!
//! # Database tables owned by this module
//!
//! - `users` — account credentials and profile.
//! - `refresh_tokens` — hashed refresh tokens with expiry and revocation flag.
//!
//! # Endpoints
//!
//! All paths are relative to `/api/auth` (prefix set by `main.rs`):
//!
//! | Method | Path        | Description                                |
//! |--------|-------------|--------------------------------------------|
//! | POST   | /register   | Create a new account, returns token pair   |
//! | POST   | /login      | Authenticate, returns token pair           |
//! | POST   | /refresh    | Rotate refresh token, returns new pair     |
//! | POST   | /logout     | Revoke refresh token (requires access JWT) |
//! | POST   | /logout-all | Revoke all refresh tokens for the user     |
//! | GET    | /me         | Return authenticated user's profile        |

pub mod handlers;
pub mod models;
pub mod routes;
pub mod service;

pub use routes::router;
