//! Background task that consumes [`DomainEvent`]s and writes `analytics_events`
//! rows plus incremental `daily_stats` refreshes.
//!
//! Spawn once at startup via [`spawn_listener`].  The task loops forever,
//! recovering from transient errors rather than crashing.

use tokio::sync::broadcast;
use tracing::{error, warn};

use crate::shared::{events::DomainEvent, state::AppState};

use super::service;

/// Spawn the analytics event listener as a background [`tokio::task`].
///
/// The task holds a [`broadcast::Receiver`] and processes every
/// [`DomainEvent`] until the sender side is dropped (application shutdown).
///
/// # Lagging
/// If the task falls behind by more than the broadcast channel capacity
/// [`crate::shared::state::EVENT_CHANNEL_CAPACITY`] events, the receiver will
/// report a `Lagged` error.  We log a warning and continue — events in the gap
/// are skipped gracefully (analytics only; no critical path).
pub fn spawn_listener(state: AppState) {
    let mut rx: broadcast::Receiver<DomainEvent> = state.events.subscribe();

    tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(event) => {
                    if let Err(err) = handle_event(&state, event).await {
                        error!(error = %err, "analytics listener: failed to handle event");
                    }
                }
                Err(broadcast::error::RecvError::Lagged(n)) => {
                    warn!(
                        skipped = n,
                        "analytics listener: lagged behind broadcast channel; events skipped"
                    );
                }
                Err(broadcast::error::RecvError::Closed) => {
                    // Sender dropped → application is shutting down.
                    break;
                }
            }
        }
    });
}

/// Translate a single [`DomainEvent`] into:
/// 1. An `analytics_events` append.
/// 2. An incremental `daily_stats` upsert for today.
async fn handle_event(
    state: &AppState,
    event: DomainEvent,
) -> Result<(), crate::shared::error::AppError> {
    match event {
        DomainEvent::TaskCompleted { task_id, user_id } => {
            let metadata = serde_json::json!({ "task_id": task_id });
            service::record_event(
                &state.db,
                user_id,
                "task_completed",
                Some(task_id),
                Some(metadata),
            )
            .await?;

            // Refresh today's stats so the dashboard reflects the change quickly.
            let _ = service::refresh_today(&state.db, user_id).await;
        }

        DomainEvent::HabitCompleted {
            habit_id,
            user_id,
            date,
        } => {
            let metadata = serde_json::json!({ "habit_id": habit_id, "date": date });
            service::record_event(
                &state.db,
                user_id,
                "habit_completed",
                Some(habit_id),
                Some(metadata),
            )
            .await?;

            // Parse the date string so we can refresh that day's stats.
            if let Ok(naive) = chrono::NaiveDate::parse_from_str(&date, "%Y-%m-%d") {
                let _ = service::refresh_date(&state.db, user_id, naive).await;
            }
        }

        DomainEvent::TimeBlockFinished {
            time_block_id,
            user_id,
            duration_secs,
        } => {
            let metadata = serde_json::json!({ "time_block_id": time_block_id, "duration_secs": duration_secs });
            service::record_event(
                &state.db,
                user_id,
                "time_block_finished",
                Some(time_block_id),
                Some(metadata),
            )
            .await?;

            let _ = service::refresh_today(&state.db, user_id).await;
        }

        DomainEvent::ProjectCompleted {
            project_id,
            user_id,
        } => {
            let metadata = serde_json::json!({ "project_id": project_id });
            service::record_event(
                &state.db,
                user_id,
                "project_completed",
                Some(project_id),
                Some(metadata),
            )
            .await?;
        }

        DomainEvent::GoalCompleted { goal_id, user_id } => {
            let metadata = serde_json::json!({ "goal_id": goal_id });
            service::record_event(
                &state.db,
                user_id,
                "goal_completed",
                Some(goal_id),
                Some(metadata),
            )
            .await?;
        }

        // ── Agile OS events ───────────────────────────────────────────────────

        DomainEvent::WorkItemCompleted {
            work_item_id,
            user_id,
            sprint_id,
        } => {
            let metadata =
                serde_json::json!({ "work_item_id": work_item_id, "sprint_id": sprint_id });
            service::record_event(
                &state.db,
                user_id,
                "work_item_completed",
                Some(work_item_id),
                Some(metadata),
            )
            .await?;

            // Refresh daily stats so completion counts stay up-to-date.
            let _ = service::refresh_today(&state.db, user_id).await;
        }

        DomainEvent::SprintStarted { sprint_id, user_id } => {
            let metadata = serde_json::json!({ "sprint_id": sprint_id });
            service::record_event(
                &state.db,
                user_id,
                "sprint_started",
                Some(sprint_id),
                Some(metadata),
            )
            .await?;
        }

        DomainEvent::SprintCompleted {
            sprint_id,
            user_id,
            completed_points,
            velocity,
        } => {
            let metadata = serde_json::json!({
                "sprint_id": sprint_id,
                "completed_points": completed_points,
                "velocity": velocity,
            });
            service::record_event(
                &state.db,
                user_id,
                "sprint_completed",
                Some(sprint_id),
                Some(metadata),
            )
            .await?;
        }

        // CalendarEventReminder is not analytically significant — skip.
        DomainEvent::CalendarEventReminder { .. } => {}
    }

    Ok(())
}
