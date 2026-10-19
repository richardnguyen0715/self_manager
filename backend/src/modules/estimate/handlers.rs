//! Axum handlers for the `estimate` module. All routes require auth.

use axum::Json;

use crate::shared::extractors::AuthUser;

use super::models::EstimateSystem;
use super::service;

pub async fn list_estimate_systems(_auth: AuthUser) -> Json<Vec<EstimateSystem>> {
    Json(service::catalog().to_vec())
}
