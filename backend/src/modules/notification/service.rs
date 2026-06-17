//! Notification service — all database operations and domain logic.
//!
//! This service is the single source of truth for creating, reading, and
//! updating notification rows. It also contains the reminder-scheduling stubs
//! that are called from Apalis background jobs.
//!
//! # Domain-event integration
//!
//! The service subscribes to the broadcast channel at the module level (see
//! [`super::mod`]). When [`crate::shared::events::DomainEvent::TaskCompleted`]
//! fires, a `system` notification is inserted to confirm completion. The
//! reminder jobs (`DeadlineReminderJob`, `HabitReminderJob`,
//! `TimeBlockReminderJob`) are the primary mechanism for scheduled reminders
//! and are driven by Apalis — the actual job _enqueueing_ lives here so that
//! the worker crate can call into this service.

use sqlx::PgPool;
use tracing::instrument;
use uuid::Uuid;

use crate::shared::error::AppError;

// `NotificationType` is used in sqlx::query_as! cast expressions (`as NotificationType`).
// The compiler reports it as unused when DATABASE_URL is absent (offline mode) because
// the macro expansions are not type-checked at that point.
#[allow(unused_imports)]
use super::models::{
    CreateNotificationRequest, DeadlineReminderJob, DeadlineReminderType, HabitReminderJob,
    ListNotificationsQuery, Notification, NotificationListResponse, NotificationResponse,
    NotificationType, PushSubscribeRequest, PushUnsubscribeRequest, TimeBlockReminderJob,
    UnreadCountResponse,
};

// ---------------------------------------------------------------------------
// Service struct
// ---------------------------------------------------------------------------

/// Stateless service: every method takes `&PgPool` directly so handlers can
/// pass `&state.db` without wrapping the pool in an extra `Arc`.
pub struct NotificationService;

impl NotificationService {
    // -----------------------------------------------------------------------
    // Queries
    // -----------------------------------------------------------------------

    /// List notifications for a user with optional unread filter + pagination.
    ///
    /// Returns [`NotificationListResponse`] containing the page items, the
    /// total row count (ignoring pagination), and the user-level unread count.
    #[instrument(skip(db), fields(user_id = %user_id))]
    pub async fn list(
        db: &PgPool,
        user_id: Uuid,
        query: &ListNotificationsQuery,
    ) -> Result<NotificationListResponse, AppError> {
        let page_size = query.page_size.clamp(1, 100) as i64;
        let offset = ((query.page.max(1) - 1) as i64) * page_size;

        // Total count matching the filter (pre-pagination).
        let total: i64 = if query.unread_only {
            sqlx::query_scalar!(
                r#"SELECT COUNT(*) FROM notifications
                   WHERE user_id = $1 AND read = false"#,
                user_id
            )
            .fetch_one(db)
            .await?
            .unwrap_or(0)
        } else {
            sqlx::query_scalar!(
                r#"SELECT COUNT(*) FROM notifications WHERE user_id = $1"#,
                user_id
            )
            .fetch_one(db)
            .await?
            .unwrap_or(0)
        };

        // User-level unread count (always, regardless of filter).
        let unread_count: i64 = sqlx::query_scalar!(
            r#"SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false"#,
            user_id
        )
        .fetch_one(db)
        .await?
        .unwrap_or(0);

        // Page of rows.
        let rows: Vec<Notification> = if query.unread_only {
            sqlx::query_as!(
                Notification,
                r#"SELECT
                    id,
                    user_id,
                    type AS "notification_type: NotificationType",
                    title,
                    body,
                    entity_id,
                    entity_table,
                    read,
                    scheduled_for,
                    sent_at,
                    created_at,
                    updated_at
                   FROM notifications
                   WHERE user_id = $1 AND read = false
                   ORDER BY created_at DESC
                   LIMIT $2 OFFSET $3"#,
                user_id,
                page_size,
                offset
            )
            .fetch_all(db)
            .await?
        } else {
            sqlx::query_as!(
                Notification,
                r#"SELECT
                    id,
                    user_id,
                    type AS "notification_type: NotificationType",
                    title,
                    body,
                    entity_id,
                    entity_table,
                    read,
                    scheduled_for,
                    sent_at,
                    created_at,
                    updated_at
                   FROM notifications
                   WHERE user_id = $1
                   ORDER BY created_at DESC
                   LIMIT $2 OFFSET $3"#,
                user_id,
                page_size,
                offset
            )
            .fetch_all(db)
            .await?
        };

        Ok(NotificationListResponse {
            items: rows.into_iter().map(NotificationResponse::from).collect(),
            total,
            page: query.page.max(1),
            page_size: query.page_size.clamp(1, 100),
            unread_count,
        })
    }

    /// Fetch a single notification by ID, scoped to the requesting user.
    #[instrument(skip(db), fields(user_id = %user_id, notification_id = %notification_id))]
    pub async fn get_by_id(
        db: &PgPool,
        user_id: Uuid,
        notification_id: Uuid,
    ) -> Result<NotificationResponse, AppError> {
        let row = sqlx::query_as!(
            Notification,
            r#"SELECT
                id,
                user_id,
                type AS "notification_type: NotificationType",
                title,
                body,
                entity_id,
                entity_table,
                read,
                scheduled_for,
                sent_at,
                created_at,
                updated_at
               FROM notifications
               WHERE id = $1 AND user_id = $2"#,
            notification_id,
            user_id
        )
        .fetch_optional(db)
        .await?
        .ok_or(AppError::NotFound)?;

        Ok(NotificationResponse::from(row))
    }

    /// Return only the unread count for a user (lightweight polling endpoint).
    #[instrument(skip(db), fields(user_id = %user_id))]
    pub async fn unread_count(db: &PgPool, user_id: Uuid) -> Result<UnreadCountResponse, AppError> {
        let count: i64 = sqlx::query_scalar!(
            r#"SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false"#,
            user_id
        )
        .fetch_one(db)
        .await?
        .unwrap_or(0);

        Ok(UnreadCountResponse {
            unread_count: count,
        })
    }

    // -----------------------------------------------------------------------
    // Mutations
    // -----------------------------------------------------------------------

    /// Create a new notification row (immediate or scheduled).
    ///
    /// Used both by the REST endpoint (for system/manual notifications) and
    /// by the reminder scheduler jobs internally.
    #[instrument(skip(db), fields(user_id = %user_id))]
    pub async fn create(
        db: &PgPool,
        user_id: Uuid,
        req: &CreateNotificationRequest,
    ) -> Result<NotificationResponse, AppError> {
        let row = sqlx::query_as!(
            Notification,
            r#"INSERT INTO notifications
                (user_id, type, title, body, entity_id, entity_table, scheduled_for)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING
                id,
                user_id,
                type AS "notification_type: NotificationType",
                title,
                body,
                entity_id,
                entity_table,
                read,
                scheduled_for,
                sent_at,
                created_at,
                updated_at"#,
            user_id,
            req.notification_type.clone() as NotificationType,
            req.title,
            req.body,
            req.entity_id,
            req.entity_table,
            req.scheduled_for
        )
        .fetch_one(db)
        .await?;

        Ok(NotificationResponse::from(row))
    }

    /// Mark a single notification as read or unread.
    #[instrument(skip(db), fields(user_id = %user_id, notification_id = %notification_id))]
    pub async fn mark_read(
        db: &PgPool,
        user_id: Uuid,
        notification_id: Uuid,
        read: bool,
    ) -> Result<NotificationResponse, AppError> {
        let row = sqlx::query_as!(
            Notification,
            r#"UPDATE notifications
               SET read = $3
               WHERE id = $1 AND user_id = $2
               RETURNING
                id,
                user_id,
                type AS "notification_type: NotificationType",
                title,
                body,
                entity_id,
                entity_table,
                read,
                scheduled_for,
                sent_at,
                created_at,
                updated_at"#,
            notification_id,
            user_id,
            read
        )
        .fetch_optional(db)
        .await?
        .ok_or(AppError::NotFound)?;

        Ok(NotificationResponse::from(row))
    }

    /// Mark **all** unread notifications for a user as read in a single UPDATE.
    #[instrument(skip(db), fields(user_id = %user_id))]
    pub async fn mark_all_read(db: &PgPool, user_id: Uuid) -> Result<u64, AppError> {
        let result = sqlx::query!(
            r#"UPDATE notifications SET read = true WHERE user_id = $1 AND read = false"#,
            user_id
        )
        .execute(db)
        .await?;

        Ok(result.rows_affected())
    }

    /// Delete a single notification scoped to the requesting user.
    #[instrument(skip(db), fields(user_id = %user_id, notification_id = %notification_id))]
    pub async fn delete(db: &PgPool, user_id: Uuid, notification_id: Uuid) -> Result<(), AppError> {
        let result = sqlx::query!(
            "DELETE FROM notifications WHERE id = $1 AND user_id = $2",
            notification_id,
            user_id
        )
        .execute(db)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound);
        }

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Scheduler job stubs — called by Apalis workers
    // -----------------------------------------------------------------------

    /// Process a deadline reminder job.
    ///
    /// Looks up the task, checks it is still incomplete and within the reminder
    /// window, then inserts a notification row. If the task has been completed
    /// or the window is stale the job is silently skipped (idempotent).
    ///
    /// # Note on Apalis integration
    ///
    /// The actual Apalis job definition and worker registration live outside
    /// this service to avoid coupling the web server startup to the worker
    /// binary. This method contains only the notification-insertion business
    /// logic and is thin enough to be called from any async context.
    #[instrument(skip(db))]
    pub async fn process_deadline_reminder(
        db: &PgPool,
        job: &DeadlineReminderJob,
    ) -> Result<(), AppError> {
        // Fetch task: must exist, belong to the user, and be incomplete.
        let task = sqlx::query!(
            r#"SELECT id, title, status::text AS status, due_date
               FROM tasks
               WHERE id = $1 AND user_id = $2
                 AND status NOT IN ('completed', 'archived')"#,
            job.task_id,
            job.user_id
        )
        .fetch_optional(db)
        .await?;

        let Some(task) = task else {
            // Task is already completed/archived or deleted — skip.
            tracing::debug!(
                task_id = %job.task_id,
                "deadline reminder skipped: task completed, archived, or not found"
            );
            return Ok(());
        };

        let notif_type = job.reminder_type.to_notification_type();
        let window_label = match job.reminder_type {
            DeadlineReminderType::OneDay => "1 day",
            DeadlineReminderType::TwoHours => "2 hours",
            DeadlineReminderType::ThirtyMinutes => "30 minutes",
        };

        let title = format!("Deadline in {window_label}: {}", task.title);
        let body = task.due_date.map(|d| format!("Due: {d}"));

        // Insert notification (ignore duplicates from repeated job execution).
        sqlx::query!(
            r#"INSERT INTO notifications
                (user_id, type, title, body, entity_id, entity_table, sent_at)
               VALUES ($1, $2, $3, $4, $5, 'tasks', now())
               ON CONFLICT DO NOTHING"#,
            job.user_id,
            notif_type as NotificationType,
            title,
            body,
            job.task_id,
        )
        .execute(db)
        .await?;

        tracing::info!(
            task_id = %job.task_id,
            user_id = %job.user_id,
            window = window_label,
            "deadline reminder notification created"
        );

        Ok(())
    }

    /// Process a habit reminder job.
    ///
    /// Looks up the habit, verifies it is active and not yet completed today,
    /// then inserts a notification row.
    #[instrument(skip(db))]
    pub async fn process_habit_reminder(
        db: &PgPool,
        job: &HabitReminderJob,
    ) -> Result<(), AppError> {
        let habit = sqlx::query!(
            "SELECT id, name FROM habits WHERE id = $1 AND user_id = $2 AND archived = false",
            job.habit_id,
            job.user_id
        )
        .fetch_optional(db)
        .await?;

        let Some(habit) = habit else {
            tracing::debug!(habit_id = %job.habit_id, "habit reminder skipped: habit not found or archived");
            return Ok(());
        };

        // Skip if the habit has already been completed today.
        let already_done: bool = sqlx::query_scalar!(
            r#"SELECT EXISTS(
                SELECT 1 FROM habit_logs
                WHERE habit_id = $1 AND log_date = CURRENT_DATE AND completed = true
            ) AS "exists!""#,
            job.habit_id
        )
        .fetch_one(db)
        .await?;

        if already_done {
            tracing::debug!(habit_id = %job.habit_id, "habit reminder skipped: already completed today");
            return Ok(());
        }

        sqlx::query!(
            r#"INSERT INTO notifications
                (user_id, type, title, body, entity_id, entity_table, sent_at)
               VALUES ($1, 'habit_reminder', $2, $3, $4, 'habits', now())
               ON CONFLICT DO NOTHING"#,
            job.user_id,
            format!("Habit reminder: {}", habit.name),
            format!("Don't forget to log your habit: {}", habit.name),
            job.habit_id,
        )
        .execute(db)
        .await?;

        tracing::info!(
            habit_id = %job.habit_id,
            user_id = %job.user_id,
            "habit reminder notification created"
        );

        Ok(())
    }

    /// Process a time-block reminder job (fires shortly before block starts).
    #[instrument(skip(db))]
    pub async fn process_time_block_reminder(
        db: &PgPool,
        job: &TimeBlockReminderJob,
    ) -> Result<(), AppError> {
        let block = sqlx::query!(
            "SELECT id, title, start_time FROM time_blocks WHERE id = $1 AND user_id = $2",
            job.time_block_id,
            job.user_id
        )
        .fetch_optional(db)
        .await?;

        let Some(block) = block else {
            tracing::debug!(time_block_id = %job.time_block_id, "time-block reminder skipped: not found");
            return Ok(());
        };

        sqlx::query!(
            r#"INSERT INTO notifications
                (user_id, type, title, body, entity_id, entity_table, sent_at)
               VALUES ($1, 'time_block_reminder', $2, $3, $4, 'time_blocks', now())
               ON CONFLICT DO NOTHING"#,
            job.user_id,
            format!("Time block starting soon: {}", block.title),
            format!("Scheduled start: {}", block.start_time),
            job.time_block_id,
        )
        .execute(db)
        .await?;

        tracing::info!(
            time_block_id = %job.time_block_id,
            user_id = %job.user_id,
            "time-block reminder notification created"
        );

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Browser Push subscriptions
    // -----------------------------------------------------------------------

    /// Register a browser push subscription for the authenticated user.
    ///
    /// If a row with the same `endpoint` already exists it is updated in place
    /// (e.g. keys rotation). The operation is idempotent.
    ///
    /// # Errors
    ///
    /// Returns [`AppError::Db`] on unexpected database errors.
    #[instrument(skip(db), fields(user_id = %user_id))]
    pub async fn push_subscribe(
        db: &PgPool,
        user_id: Uuid,
        req: &PushSubscribeRequest,
    ) -> Result<(), AppError> {
        sqlx::query!(
            r#"
            INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (endpoint) DO UPDATE
                SET user_id = EXCLUDED.user_id,
                    p256dh  = EXCLUDED.p256dh,
                    auth    = EXCLUDED.auth
            "#,
            user_id,
            req.endpoint,
            req.keys.p256dh,
            req.keys.auth,
        )
        .execute(db)
        .await?;

        Ok(())
    }

    /// Remove a browser push subscription identified by its endpoint URL.
    ///
    /// If no matching row is found the call succeeds silently (idempotent).
    ///
    /// # Errors
    ///
    /// Returns [`AppError::Db`] on unexpected database errors.
    #[instrument(skip(db), fields(user_id = %user_id))]
    pub async fn push_unsubscribe(
        db: &PgPool,
        user_id: Uuid,
        req: &PushUnsubscribeRequest,
    ) -> Result<(), AppError> {
        sqlx::query!(
            "DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2",
            req.endpoint,
            user_id,
        )
        .execute(db)
        .await?;

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Domain-event reaction helpers
    // -----------------------------------------------------------------------

    /// React to a [`crate::shared::events::DomainEvent::TaskCompleted`] event
    /// by inserting a `system` notification acknowledging the completion.
    ///
    /// Called from the background listener spawned in [`super::mod`].
    #[instrument(skip(db))]
    pub async fn on_task_completed(
        db: &PgPool,
        task_id: Uuid,
        user_id: Uuid,
    ) -> Result<(), AppError> {
        // Fetch task title for a meaningful notification body.
        let task = sqlx::query!(
            "SELECT title FROM tasks WHERE id = $1 AND user_id = $2",
            task_id,
            user_id
        )
        .fetch_optional(db)
        .await?;

        let title_str = task.map(|t| t.title).unwrap_or_else(|| "a task".to_owned());

        sqlx::query!(
            r#"INSERT INTO notifications
                (user_id, type, title, entity_id, entity_table, sent_at)
               VALUES ($1, 'system', $2, $3, 'tasks', now())"#,
            user_id,
            format!("Task completed: {title_str}"),
            task_id,
        )
        .execute(db)
        .await?;

        Ok(())
    }
}
