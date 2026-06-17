//! Realtime module — service logic.
//!
//! This module does not issue database queries of its own; its sole
//! responsibility is to translate internal [`DomainEvent`]s arriving on the
//! broadcast channel into wire-ready [`ServerMessage`]s that the WebSocket
//! handler can serialise and send.

use crate::shared::events::DomainEvent;

use super::models::{EventPayload, ServerMessage};

/// Convert a [`DomainEvent`] into the corresponding [`ServerMessage`] that
/// should be forwarded to every connected client that belongs to the same user.
///
/// Returns `None` for event variants that should not be forwarded over
/// WebSocket (currently all known variants are forwarded, but the `Option`
/// keeps the API extensible).
#[must_use]
pub fn domain_event_to_server_message(event: &DomainEvent) -> Option<ServerMessage> {
    let payload = match event {
        DomainEvent::TaskCompleted { task_id, user_id } => EventPayload::TaskCompleted {
            task_id: *task_id,
            user_id: *user_id,
        },
        DomainEvent::HabitCompleted {
            habit_id,
            user_id,
            date,
        } => EventPayload::HabitCompleted {
            habit_id: *habit_id,
            user_id: *user_id,
            date: date.clone(),
        },
        DomainEvent::TimeBlockFinished {
            time_block_id,
            user_id,
            duration_secs,
        } => EventPayload::TimeBlockFinished {
            time_block_id: *time_block_id,
            user_id: *user_id,
            duration_secs: *duration_secs,
        },
        DomainEvent::ProjectCompleted {
            project_id,
            user_id,
        } => EventPayload::ProjectCompleted {
            project_id: *project_id,
            user_id: *user_id,
        },
        DomainEvent::CalendarEventReminder { event_id, user_id } => {
            EventPayload::CalendarEventReminder {
                event_id: *event_id,
                user_id: *user_id,
            }
        }
        DomainEvent::GoalCompleted { goal_id, user_id } => EventPayload::GoalCompleted {
            goal_id: *goal_id,
            user_id: *user_id,
        },
    };

    Some(ServerMessage::Event(payload))
}

/// Extract the `user_id` that a [`DomainEvent`] is addressed to so the
/// broadcast loop can filter events before forwarding them.
#[must_use]
pub fn event_user_id(event: &DomainEvent) -> uuid::Uuid {
    match event {
        DomainEvent::TaskCompleted { user_id, .. }
        | DomainEvent::HabitCompleted { user_id, .. }
        | DomainEvent::TimeBlockFinished { user_id, .. }
        | DomainEvent::ProjectCompleted { user_id, .. }
        | DomainEvent::CalendarEventReminder { user_id, .. }
        | DomainEvent::GoalCompleted { user_id, .. } => *user_id,
    }
}
