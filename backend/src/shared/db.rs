//! PostgreSQL connection pool initialisation.

use anyhow::{Context, Result};
use sqlx::{postgres::PgPoolOptions, PgPool};

/// Create and validate a [`PgPool`] from the given `database_url`.
///
/// The pool is configured with conservative defaults suitable for a
/// single-process modular monolith:
///
/// - `max_connections`: 20 (override via env if needed)
/// - `min_connections`: 2 (keeps warm connections available)
/// - `acquire_timeout`: 5 seconds
///
/// # Errors
///
/// Returns an error if the URL is malformed or the database is unreachable.
pub async fn connect(database_url: &str) -> Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .min_connections(2)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(database_url)
        .await
        .context("failed to connect to PostgreSQL")?;

    tracing::info!("PostgreSQL pool established");
    Ok(pool)
}
