//! Shared application state threaded through every Axum handler via
//! [`axum::extract::State`].
//!
//! [`AppState`] is cheap to clone — it holds only reference-counted handles.

use sqlx::PgPool;
use tokio::sync::broadcast;

use crate::shared::{config::Config, events::DomainEvent};

/// Capacity of the broadcast channel for [`DomainEvent`]s.
///
/// A lagging receiver will receive a [`tokio::sync::broadcast::error::RecvError::Lagged`]
/// error rather than blocking publishers.
pub const EVENT_CHANNEL_CAPACITY: usize = 1_024;

/// Global shared state injected into every route handler.
#[derive(Clone)]
pub struct AppState {
    /// PostgreSQL connection pool (runtime-tokio-rustls).
    pub db: PgPool,

    /// Redis connection manager (automatic reconnection, multiplexed).
    pub redis: redis::aio::ConnectionManager,

    /// Loaded once at startup; never mutated at runtime.
    pub config: Config,

    /// Domain event bus. Clone the sender to publish; call `.subscribe()` to receive.
    pub events: broadcast::Sender<DomainEvent>,
}

impl AppState {
    /// Construct a new [`AppState`].
    ///
    /// The broadcast channel is created here so that the capacity constant is
    /// enforced in a single place.
    #[must_use]
    pub fn new(db: PgPool, redis: redis::aio::ConnectionManager, config: Config) -> Self {
        let (events, _) = broadcast::channel(EVENT_CHANNEL_CAPACITY);
        Self {
            db,
            redis,
            config,
            events,
        }
    }
}
