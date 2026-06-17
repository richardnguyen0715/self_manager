//! Axum request extractors for authenticated routes.
//!
//! [`AuthUser`] can be added as a handler parameter to require a valid JWT
//! access token in the `Authorization: Bearer <token>` header.
//!
//! ```rust,ignore
//! async fn get_profile(
//!     auth: AuthUser,
//!     State(state): State<AppState>,
//! ) -> AppResult<Json<Profile>> {
//!     let user_id = auth.user_id; // Uuid
//!     …
//! }
//! ```

use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{request::Parts, HeaderMap},
};

use crate::shared::{
    error::AppError,
    jwt::{decode_token, TokenType},
    state::AppState,
};

/// Represents an authenticated user extracted from the JWT bearer token.
///
/// The extractor validates:
/// 1. Presence of `Authorization: Bearer <token>` header.
/// 2. JWT signature and expiry.
/// 3. That the token type is [`TokenType::Access`] (not a refresh token).
#[derive(Clone, Debug)]
pub struct AuthUser {
    /// The authenticated user's UUID (`sub` claim of the JWT).
    pub user_id: uuid::Uuid,
}

#[async_trait]
impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let headers: &HeaderMap = &parts.headers;

        let bearer = headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .ok_or_else(|| AppError::UnauthorizedMsg("missing Bearer token".to_owned()))?;

        let claims = decode_token(&state.config, bearer)?;

        if claims.token_type != TokenType::Access {
            return Err(AppError::UnauthorizedMsg(
                "expected an access token".to_owned(),
            ));
        }

        Ok(Self {
            user_id: claims.sub,
        })
    }
}

/// Optional authentication — succeeds even when no token is present.
///
/// Useful for routes that behave differently for authenticated vs anonymous users.
#[derive(Clone, Debug)]
pub struct MaybeAuthUser(pub Option<AuthUser>);

#[async_trait]
impl FromRequestParts<AppState> for MaybeAuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        match AuthUser::from_request_parts(parts, state).await {
            Ok(user) => Ok(Self(Some(user))),
            Err(AppError::UnauthorizedMsg(_)) | Err(AppError::Unauthorized) => Ok(Self(None)),
            Err(err) => Err(err),
        }
    }
}
