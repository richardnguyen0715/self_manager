//! `notification` module — in-app notification CRUD, unread count, batch
//! read, and Apalis reminder-scheduling stubs.
//!
//! # Responsibilities
//!
//! - REST endpoints mounted at `/api/notifications`.
//! - [`service::NotificationService`] handles all DB access.
//! - Background domain-event listener: subscribes to the broadcast channel on
//!   [`AppState`] and reacts to relevant [`crate::shared::events::DomainEvent`]
//!   variants (e.g., `TaskCompleted` triggers a system confirmation notification).
//! - Apalis job-processing stubs: [`service::NotificationService::process_deadline_reminder`],
//!   `process_habit_reminder`, and `process_time_block_reminder` are called from
//!   background workers; they contain the notification-insertion logic so workers
//!   can be wired in a separate binary without duplicating business rules.
//!
//! # Module layout
//!
//! ```text
//! notification/
//!   mod.rs      — public surface: router() + event listener spawn
//!   models.rs   — DB types, DTOs, Apalis job payloads
//!   service.rs  — all DB operations and domain logic
//!   handlers.rs — Axum route handlers
//!   routes.rs   — route wiring
//! ```

pub mod handlers;
pub mod models;
pub mod routes;
pub mod service;

use crate::shared::{events::DomainEvent, state::AppState};
use service::NotificationService;

/// Returns the Axum router for this module.
///
/// Mounted at `/api/notifications` by `main.rs`.
pub fn router() -> axum::Router<AppState> {
    routes::router()
}

/// Spawn a background task that listens on the domain-event broadcast channel
/// and reacts to events that require notification side-effects.
///
/// This function is intentionally **not** called from `main.rs` automatically
/// because the foundation owns `main.rs`. Instead, it is designed to be called
/// from a module initialisation function or at the end of startup once
/// `AppState` is available. If the foundation wishes to drive this, it can
/// add a call after `AppState::new(...)`.
///
/// The spawned task runs for the lifetime of the process. If the broadcast
/// channel is closed (all senders dropped) the loop exits cleanly.
pub fn spawn_event_listener(state: AppState) {
    tokio::spawn(async move {
        let mut rx = state.events.subscribe();

        loop {
            match rx.recv().await {
                Ok(event) => handle_domain_event(&state, event).await,
                Err(tokio::sync::broadcast::error::RecvError::Lagged(skipped)) => {
                    tracing::warn!(
                        skipped,
                        "notification event listener lagged; some events were missed"
                    );
                    // Continue — we recover by processing future events.
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                    tracing::info!("notification event channel closed; listener exiting");
                    break;
                }
            }
        }
    });
}

/// Dispatch a single [`DomainEvent`] to the appropriate service method.
async fn handle_domain_event(state: &AppState, event: DomainEvent) {
    match event {
        DomainEvent::TaskCompleted { task_id, user_id } => {
            if let Err(err) =
                NotificationService::on_task_completed(&state.db, task_id, user_id).await
            {
                tracing::error!(%err, %task_id, %user_id, "failed to create task-completed notification");
            }
        }

        // Habit and time-block completion acknowledgements are handled by the
        // dedicated reminder jobs. CalendarEventReminder, ProjectCompleted,
        // and GoalCompleted are tracked by the analytics module; no extra
        // notification side-effect is needed here beyond what the scheduler
        // jobs already produce.
        DomainEvent::HabitCompleted { .. }
        | DomainEvent::TimeBlockFinished { .. }
        | DomainEvent::ProjectCompleted { .. }
        | DomainEvent::CalendarEventReminder { .. }
        | DomainEvent::GoalCompleted { .. }
        // Agile OS events — no notification side-effect needed here; handled by
        // analytics / realtime modules.
        | DomainEvent::WorkItemCompleted { .. }
        | DomainEvent::SprintStarted { .. }
        | DomainEvent::SprintCompleted { .. } => {}
    }
}
