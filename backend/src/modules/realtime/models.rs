//! Realtime module — message types for the WebSocket protocol.
//!
//! Messages flowing from **server → client** are serialised as
//! [`ServerMessage`] (JSON).  Messages flowing from **client → server** are
//! deserialised as [`ClientMessage`] (JSON).
//!
//! The connection handshake relies on a JWT access token passed either as:
//! - `Authorization: Bearer <token>` HTTP header during the HTTP upgrade, or
//! - A `token` query-string parameter (fallback for browser WebSocket API which
//!   does not support custom headers).

use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Outbound (server → client) ─────────────────────────────────────────────────

/// Top-level envelope for every message the server pushes to a connected client.
///
/// The `type` field acts as a discriminator for the frontend to branch on.
#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    /// A domain event that the client should react to (e.g. refresh the task
    /// list, update the Kanban board, re-render the calendar).
    Event(EventPayload),

    /// Sent immediately after the WebSocket connection is accepted.
    Connected {
        /// The user ID that the server authenticated for this connection.
        user_id: Uuid,
    },

    /// Sent in response to a [`ClientMessage::Ping`].
    Pong,

    /// Sent when the server encounters an error it wants the client to know
    /// about without closing the connection.
    Error { message: String },
}

/// Payload carried inside a [`ServerMessage::Event`].
///
/// Mirrors [`crate::shared::events::DomainEvent`] but in a form suitable for
/// the wire (always includes the `user_id` so the frontend can correlate).
#[derive(Clone, Debug, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum EventPayload {
    TaskCompleted {
        task_id: Uuid,
        user_id: Uuid,
    },
    HabitCompleted {
        habit_id: Uuid,
        user_id: Uuid,
        date: String,
    },
    TimeBlockFinished {
        time_block_id: Uuid,
        user_id: Uuid,
        duration_secs: u32,
    },
    ProjectCompleted {
        project_id: Uuid,
        user_id: Uuid,
    },
    CalendarEventReminder {
        event_id: Uuid,
        user_id: Uuid,
    },
    GoalCompleted {
        goal_id: Uuid,
        user_id: Uuid,
    },
    // ── Agile OS ──────────────────────────────────────────────────────────────
    WorkItemCompleted {
        work_item_id: Uuid,
        user_id: Uuid,
        sprint_id: Option<Uuid>,
    },
    SprintStarted {
        sprint_id: Uuid,
        user_id: Uuid,
    },
    SprintCompleted {
        sprint_id: Uuid,
        user_id: Uuid,
        completed_points: i32,
        velocity: f64,
    },
}

// ── Inbound (client → server) ──────────────────────────────────────────────────

/// Top-level envelope for every message a connected client may send.
#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    /// Keepalive probe — the server responds with [`ServerMessage::Pong`].
    Ping,
}
