//! `manage-my-life` — modular-monolith HTTP server entry point.
//!
//! Startup sequence:
//! 1. Load `.env` (if present) and parse environment variables into [`Config`].
//! 2. Initialise structured `tracing` logging.
//! 3. Connect to PostgreSQL and run pending migrations.
//! 4. Connect to Redis.
//! 5. Build [`AppState`] (includes the domain-event broadcast channel).
//! 6. Mount every module router.
//! 7. Attach CORS and trace middleware layers.
//! 8. Bind and serve on `HOST:PORT`.

use std::net::SocketAddr;

use axum::{
    http::{header, Method},
    Router,
};
use tower_http::{
    cors::{Any, CorsLayer},
    services::ServeDir,
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

mod modules;
mod shared;

use shared::{config::Config, db, redis, state::AppState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // ── 1. Load .env ──────────────────────────────────────────────────────────
    // `dotenvy` silently skips the file when it doesn't exist (production).
    let _ = dotenvy::dotenv();

    // ── 2. Tracing ────────────────────────────────────────────────────────────
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| {
            "manage_my_life=debug,tower_http=debug,sqlx=warn"
                .parse()
                .unwrap()
        }))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // ── 3. Config ─────────────────────────────────────────────────────────────
    let config = Config::from_env()?;

    // ── Ensure uploads directory exists ──────────────────────────────────────
    let uploads_dir = concat!(env!("CARGO_MANIFEST_DIR"), "/uploads");
    std::fs::create_dir_all(uploads_dir)?;
    tracing::info!(path = uploads_dir, "uploads directory ready");
    tracing::info!(host = %config.host, port = %config.port, "configuration loaded");

    // ── 4. PostgreSQL ─────────────────────────────────────────────────────────
    let db = db::connect(&config.database_url).await?;

    tracing::info!("running database migrations");
    sqlx::migrate!("./migrations").run(&db).await?;
    tracing::info!("migrations complete");

    // ── 5. Redis ──────────────────────────────────────────────────────────────
    let redis = redis::connect(&config.redis_url).await?;

    // ── 6. AppState ───────────────────────────────────────────────────────────
    let state = AppState::new(db, redis, config.clone());

    // ── 7. Router ─────────────────────────────────────────────────────────────
    let api_router = Router::new()
        // ── Legacy (kept) ─────────────────────────────────────────────────────
        .nest("/auth",          modules::auth::router())
        .nest("/tasks",         modules::task::router())
        .nest("/projects",      modules::project::router())
        .nest("/goals",         modules::goal::router())
        .nest("/habits",        modules::habit::router())
        .nest("/calendar",      modules::calendar::router())
        .nest("/timeblocks",    modules::timeblock::router())
        .nest("/analytics",     modules::analytics::router())
        .nest("/notifications", modules::notification::router())
        .nest("/settings",      modules::settings::router())
        .nest("/search",        modules::search::router())
        .nest("/dashboard",     modules::dashboard::router())
        // ── Agile OS (new) ────────────────────────────────────────────────────
        .nest("/initiatives",   modules::initiative::router())
        .nest("/epics",         modules::epic::router())
        .nest("/sprints",       modules::sprint::router())
        .nest("/work-items",    modules::work_item::router())
        .nest("/backlog",       modules::backlog::router())
        // ── Board columns (dynamic board) ─────────────────────────────────────
        .nest("/board-columns", modules::board_column::router());

    let app = Router::new()
        .nest("/api", api_router)
        .nest("/ws", modules::realtime::router())
        // ── Static file serving for uploads ───────────────────────────────────
        .nest_service("/uploads", ServeDir::new(uploads_dir))
        // ── CORS ──────────────────────────────────────────────────────────────
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods([
                    Method::GET,
                    Method::POST,
                    Method::PUT,
                    Method::PATCH,
                    Method::DELETE,
                    Method::OPTIONS,
                ])
                .allow_headers([
                    header::AUTHORIZATION,
                    header::CONTENT_TYPE,
                    header::ACCEPT,
                    header::ORIGIN,
                ]),
        )
        // ── Request tracing ───────────────────────────────────────────────────
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    // ── 8. Bind and serve ─────────────────────────────────────────────────────
    let addr: SocketAddr = config.socket_addr().parse()?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!(%addr, "server listening");

    axum::serve(listener, app).await?;

    Ok(())
}
