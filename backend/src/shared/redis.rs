//! Redis connection manager initialisation.
//!
//! We use [`redis::aio::ConnectionManager`] which provides:
//! - automatic reconnection on transient failures
//! - multiplexed I/O (no exclusive lock per command)
//! - cheap `Clone` — a single manager is shared via [`AppState`]

use anyhow::{Context, Result};
use redis::aio::ConnectionManager;

/// Create a [`ConnectionManager`] from the given `redis_url`.
///
/// The manager tests connectivity before returning, so startup fails fast if
/// Redis is unavailable.
///
/// # Errors
///
/// Returns an error if the URL is invalid or Redis refuses the connection.
pub async fn connect(redis_url: &str) -> Result<ConnectionManager> {
    let client = redis::Client::open(redis_url).context("invalid REDIS_URL")?;

    let manager = ConnectionManager::new(client)
        .await
        .context("failed to connect to Redis")?;

    tracing::info!("Redis connection manager established");
    Ok(manager)
}
