//! Internal domain events broadcast across the application.
//!
//! Modules publish events by cloning the [`tokio::sync::broadcast::Sender`]
//! stored in [`crate::shared::state::AppState`] and calling `.send(event)`.
//!
//! Other modules (analytics, notification, …) subscribe via
//! `state.events.subscribe()` and react to events in background tasks.

use uuid::Uuid;

/// Every significant domain occurrence that other modules may react to.
///
/// Keep variants cheap to clone: use [`Uuid`] rather than full entity structs.
#[derive(Clone, Debug)]
pub enum DomainEvent {
    /// Emitted when a user marks a task as complete.
    TaskCompleted { task_id: Uuid, user_id: Uuid },

    /// Emitted when a user logs a habit completion for a given date.
    HabitCompleted {
        habit_id: Uuid,
        user_id: Uuid,
        /// ISO-8601 date string (YYYY-MM-DD) for which the habit was completed.
        date: String,
    },

    /// Emitted when a time-block session ends (timer reaches 0 or user stops it).
    TimeBlockFinished {
        time_block_id: Uuid,
        user_id: Uuid,
        /// Actual duration completed, in seconds.
        duration_secs: u32,
    },

    /// Emitted when a project is archived / completed.
    ProjectCompleted { project_id: Uuid, user_id: Uuid },

    /// Emitted when a calendar event reminder fires.
    CalendarEventReminder { event_id: Uuid, user_id: Uuid },

    /// Emitted when a goal's status transitions to `completed`.
    GoalCompleted { goal_id: Uuid, user_id: Uuid },

    // ── Agile OS events ───────────────────────────────────────────────────────

    /// A work item transitioned to `done`.
    ///
    /// Emitted by `work_item::service` when the item status is set to done.
    /// `sprint_id` is `None` when the item was in the backlog.
    WorkItemCompleted {
        work_item_id: Uuid,
        user_id: Uuid,
        sprint_id: Option<Uuid>,
    },

    /// A sprint was activated (status `planned` → `active`).
    ///
    /// Emitted by `sprint::service` on the activate action.
    /// At most one active sprint per user is enforced before this fires.
    SprintStarted { sprint_id: Uuid, user_id: Uuid },

    /// A sprint was completed and its review auto-created.
    ///
    /// Emitted by `sprint::service` on the complete action.
    /// `velocity` is the completion ratio in the range `[0.0, 100.0]`.
    SprintCompleted {
        sprint_id: Uuid,
        user_id: Uuid,
        completed_points: i32,
        velocity: f64,
    },
}
