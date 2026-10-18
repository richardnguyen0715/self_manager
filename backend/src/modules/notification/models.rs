//! Notification domain models, database row types, and request/response DTOs.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

// ---------------------------------------------------------------------------
// DB-mapped enum mirrors `notification_type` PostgreSQL enum
// ---------------------------------------------------------------------------

/// Mirrors the `notification_type` PostgreSQL enum defined in `0001_init.sql`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "notification_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum NotificationType {
    Deadline1d,
    Deadline2h,
    Deadline30m,
    HabitReminder,
    TimeBlockReminder,
    GoalDeadline,
    System,
}

// ---------------------------------------------------------------------------
// DB row — maps directly to `notifications` table
// ---------------------------------------------------------------------------

/// Full database row for the `notifications` table.
///
/// Used internally by [`super::service::NotificationService`] and returned as
/// the canonical API response after serialisation into [`NotificationResponse`].
#[derive(Clone, Debug, Serialize, sqlx::FromRow)]
pub struct Notification {
    pub id: Uuid,
    pub user_id: Uuid,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub notification_type: NotificationType,
    pub title: String,
    pub body: Option<String>,
    pub entity_id: Option<Uuid>,
    pub entity_table: Option<String>,
    pub read: bool,
    pub scheduled_for: Option<DateTime<Utc>>,
    pub sent_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Response DTO
// ---------------------------------------------------------------------------

/// Shape returned to the client for a single notification.
#[derive(Clone, Debug, Serialize)]
pub struct NotificationResponse {
    pub id: Uuid,
    #[serde(rename = "type")]
    pub notification_type: NotificationType,
    pub title: String,
    pub body: Option<String>,
    pub entity_id: Option<Uuid>,
    pub entity_table: Option<String>,
    pub read: bool,
    pub scheduled_for: Option<DateTime<Utc>>,
    pub sent_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Notification> for NotificationResponse {
    fn from(n: Notification) -> Self {
        Self {
            id: n.id,
            notification_type: n.notification_type,
            title: n.title,
            body: n.body,
            entity_id: n.entity_id,
            entity_table: n.entity_table,
            read: n.read,
            scheduled_for: n.scheduled_for,
            sent_at: n.sent_at,
            created_at: n.created_at,
            updated_at: n.updated_at,
        }
    }
}

// ---------------------------------------------------------------------------
// Paginated list response
// ---------------------------------------------------------------------------

/// Paginated list of notifications returned by `GET /api/notifications`.
#[derive(Clone, Debug, Serialize)]
pub struct NotificationListResponse {
    pub items: Vec<NotificationResponse>,
    /// Total row count matching the filter (before pagination).
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
    /// Number of unread notifications for this user (regardless of pagination).
    pub unread_count: i64,
}

// ---------------------------------------------------------------------------
// Request DTOs
// ---------------------------------------------------------------------------

/// Query parameters for `GET /api/notifications`.
#[derive(Clone, Debug, Deserialize)]
pub struct ListNotificationsQuery {
    /// Filter to unread-only when `true`. Defaults to `false` (return all).
    #[serde(default)]
    pub unread_only: bool,

    /// 1-based page number. Defaults to `1`.
    #[serde(default = "default_page")]
    pub page: u32,

    /// Items per page (1–100). Defaults to `20`.
    #[serde(default = "default_page_size")]
    pub page_size: u32,

    /// `true` lists only snoozed notifications; `false` (default) hides them.
    #[serde(default)]
    pub snoozed: bool,
}

/// Body for `POST /api/notifications/:id/snooze`.
#[derive(Clone, Debug, Deserialize)]
pub struct SnoozeNotificationRequest {
    /// RFC 3339 timestamp; the notification reappears after this moment.
    pub until: DateTime<Utc>,
}

fn default_page() -> u32 {
    1
}

fn default_page_size() -> u32 {
    20
}

/// Body for `POST /api/notifications` (internal/admin use; real reminders are
/// created by the scheduler job, but this endpoint supports manual creation for
/// system messages and testing).
#[derive(Clone, Debug, Deserialize, Validate)]
pub struct CreateNotificationRequest {
    #[serde(rename = "type")]
    pub notification_type: NotificationType,

    #[validate(length(min = 1, max = 255))]
    pub title: String,

    #[validate(length(max = 1000))]
    pub body: Option<String>,

    pub entity_id: Option<Uuid>,

    #[validate(length(max = 64))]
    pub entity_table: Option<String>,

    pub scheduled_for: Option<DateTime<Utc>>,
}

/// Body for `PATCH /api/notifications/:id` — partial update (mark read/unread).
#[derive(Clone, Debug, Deserialize, Validate)]
pub struct UpdateNotificationRequest {
    pub read: Option<bool>,
}

// ---------------------------------------------------------------------------
// Apalis background job types
// ---------------------------------------------------------------------------

/// Scheduler job payload: send deadline reminders for tasks due within a window.
///
/// This struct is serialised into the Apalis job queue and deserialized by the
/// worker. Fields are kept minimal — the worker re-fetches the task from the DB
/// to avoid stale data.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DeadlineReminderJob {
    pub task_id: Uuid,
    pub user_id: Uuid,
    /// Which reminder window this job covers.
    pub reminder_type: DeadlineReminderType,
}

/// Which deadline-proximity bucket triggered the reminder.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeadlineReminderType {
    OneDay,
    TwoHours,
    ThirtyMinutes,
}

impl DeadlineReminderType {
    /// Convert to the corresponding [`NotificationType`].
    #[must_use]
    pub fn to_notification_type(&self) -> NotificationType {
        match self {
            Self::OneDay => NotificationType::Deadline1d,
            Self::TwoHours => NotificationType::Deadline2h,
            Self::ThirtyMinutes => NotificationType::Deadline30m,
        }
    }
}

/// Scheduler job payload: send a habit reminder for a specific habit.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HabitReminderJob {
    pub habit_id: Uuid,
    pub user_id: Uuid,
}

/// Scheduler job payload: fire a time-block start reminder.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TimeBlockReminderJob {
    pub time_block_id: Uuid,
    pub user_id: Uuid,
}

// ---------------------------------------------------------------------------
// Unread count response
// ---------------------------------------------------------------------------

/// Lightweight response for `GET /api/notifications/unread-count`.
#[derive(Clone, Debug, Serialize)]
pub struct UnreadCountResponse {
    pub unread_count: i64,
}

// ---------------------------------------------------------------------------
// Browser Push subscription DTOs
// ---------------------------------------------------------------------------

/// The JSON keys produced by `PushSubscription.toJSON()` in the browser.
///
/// The `keys` object contains the `p256dh` and `auth` base64url strings.
#[derive(Clone, Debug, Deserialize)]
pub struct PushSubscriptionKeys {
    /// ECDH public key — base64url, from `PushSubscription.getKey('p256dh')`.
    pub p256dh: String,
    /// Authentication secret — base64url, from `PushSubscription.getKey('auth')`.
    pub auth: String,
}

/// Body for `POST /api/notifications/push/subscribe`.
///
/// Mirrors the object returned by the browser's `PushSubscription.toJSON()`.
#[derive(Clone, Debug, Deserialize)]
pub struct PushSubscribeRequest {
    /// The push service endpoint URL.
    pub endpoint: String,
    /// The `keys` sub-object.
    pub keys: PushSubscriptionKeys,
}

/// Body for `POST /api/notifications/push/unsubscribe`.
#[derive(Clone, Debug, Deserialize)]
pub struct PushUnsubscribeRequest {
    /// The endpoint URL identifying the subscription to remove.
    pub endpoint: String,
}
