//! Unified application error type.
//!
//! [`AppError`] implements [`axum::response::IntoResponse`] so that handlers
//! can return `Result<_, AppError>` and the framework serialises errors
//! automatically into:
//!
//! ```json
//! { "error": "NOT_FOUND", "message": "resource not found" }
//! ```

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

/// All error variants that the application can produce.
#[derive(Debug, Error)]
pub enum AppError {
    /// 404 — a requested resource could not be located.
    #[error("resource not found")]
    NotFound,

    /// 404 with a custom message.
    #[error("{0}")]
    NotFoundMsg(String),

    /// 401 — missing, expired, or invalid credentials / token.
    #[error("unauthorized")]
    Unauthorized,

    /// 401 with a custom message.
    #[error("{0}")]
    UnauthorizedMsg(String),

    /// 403 — authenticated but not permitted.
    #[error("forbidden")]
    Forbidden,

    /// 422 — user input failed validation.
    #[error("{0}")]
    Validation(String),

    /// 409 — a unique constraint or business rule conflict.
    #[error("{0}")]
    Conflict(String),

    /// 500 — unrecoverable internal error.
    #[error("internal server error")]
    Internal,

    /// 500 wrapping an [`anyhow::Error`] for ad-hoc internal errors.
    #[error("{0:#}")]
    InternalMsg(#[from] anyhow::Error),

    /// 500 wrapping a SQLx database error.
    #[error("database error: {0}")]
    Db(#[from] sqlx::Error),
}

impl AppError {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::NotFound | Self::NotFoundMsg(_) => StatusCode::NOT_FOUND,
            Self::Unauthorized | Self::UnauthorizedMsg(_) => StatusCode::UNAUTHORIZED,
            Self::Forbidden => StatusCode::FORBIDDEN,
            Self::Validation(_) => StatusCode::UNPROCESSABLE_ENTITY,
            Self::Conflict(_) => StatusCode::CONFLICT,
            Self::Internal | Self::InternalMsg(_) | Self::Db(_) => {
                StatusCode::INTERNAL_SERVER_ERROR
            }
        }
    }

    fn error_code(&self) -> &'static str {
        match self {
            Self::NotFound | Self::NotFoundMsg(_) => "NOT_FOUND",
            Self::Unauthorized | Self::UnauthorizedMsg(_) => "UNAUTHORIZED",
            Self::Forbidden => "FORBIDDEN",
            Self::Validation(_) => "VALIDATION_ERROR",
            Self::Conflict(_) => "CONFLICT",
            Self::Internal | Self::InternalMsg(_) | Self::Db(_) => "INTERNAL_SERVER_ERROR",
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = self.status_code();
        let code = self.error_code();
        let message = self.to_string();

        // Never leak internal details in the response body — but log the real
        // cause server-side so 500s are diagnosable.
        let safe_message = match &self {
            Self::Internal | Self::InternalMsg(_) | Self::Db(_) => {
                tracing::error!(error = %message, code = %code, "request failed (5xx)");
                "an unexpected error occurred".to_owned()
            }
            _ => message,
        };

        let body = Json(json!({
            "error": code,
            "message": safe_message,
        }));

        (status, body).into_response()
    }
}

/// Convenience alias used throughout handler return types.
pub type AppResult<T> = Result<T, AppError>;
