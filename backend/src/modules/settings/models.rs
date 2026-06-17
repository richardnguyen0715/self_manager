//! Settings module — data models, request/response DTOs.
//!
//! Maps to the `user_preferences` table created in `0002_settings.sql`.

use serde::{Deserialize, Serialize};
use validator::Validate;

// ── Appearance ─────────────────────────────────────────────────────────────────

/// All valid theme values (mirrors the DB CHECK constraint).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Theme {
    Light,
    Dark,
    System,
}

impl Default for Theme {
    fn default() -> Self {
        Self::System
    }
}

/// All valid color-theme values (mirrors the DB CHECK constraint).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ColorTheme {
    Zinc,
    Slate,
    Blue,
    Green,
    Rose,
    Orange,
}

impl Default for ColorTheme {
    fn default() -> Self {
        Self::Zinc
    }
}

/// Appearance preferences returned by `GET /api/settings/appearance` and
/// `PATCH /api/settings/appearance`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppearancePreferences {
    pub theme: Theme,
    pub color_theme: ColorTheme,
    pub compact_mode: bool,
    pub show_completed_tasks: bool,
    /// 0 = Sunday, 1 = Monday.
    pub week_starts_on: i16,
}

impl Default for AppearancePreferences {
    fn default() -> Self {
        Self {
            theme: Theme::System,
            color_theme: ColorTheme::Zinc,
            compact_mode: false,
            show_completed_tasks: true,
            week_starts_on: 1,
        }
    }
}

/// Request body for `PATCH /api/settings/appearance`.
/// All fields are optional — only supplied fields are updated.
#[derive(Debug, Deserialize, Validate)]
pub struct UpdateAppearanceRequest {
    pub theme: Option<Theme>,
    pub color_theme: Option<ColorTheme>,
    pub compact_mode: Option<bool>,
    pub show_completed_tasks: Option<bool>,
    /// Must be 0 or 1.
    pub week_starts_on: Option<i16>,
}

// ── Notification preferences ───────────────────────────────────────────────────

/// Valid notification delivery channels.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NotificationChannel {
    InApp,
    BrowserPush,
}

/// The JSONB document stored in `user_preferences.notification_prefs`.
///
/// All fields carry sane defaults so that a missing or partial JSONB blob
/// still deserialises successfully.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationPrefsData {
    #[serde(default = "default_in_app_channel")]
    pub deadline_reminder_channels: Vec<NotificationChannel>,

    #[serde(default = "default_in_app_channel")]
    pub habit_reminder_channels: Vec<NotificationChannel>,

    #[serde(default = "default_in_app_channel")]
    pub time_block_reminder_channels: Vec<NotificationChannel>,

    /// Lead times in minutes, e.g. [1440, 120, 30].
    #[serde(default = "default_deadline_offsets")]
    pub deadline_reminder_offsets: Vec<i32>,

    /// "HH:MM" local time, or `null` to disable.
    #[serde(default)]
    pub habit_reminder_time: Option<String>,
}

fn default_in_app_channel() -> Vec<NotificationChannel> {
    vec![NotificationChannel::InApp]
}

fn default_deadline_offsets() -> Vec<i32> {
    vec![1440, 120, 30]
}

impl Default for NotificationPrefsData {
    fn default() -> Self {
        Self {
            deadline_reminder_channels: default_in_app_channel(),
            habit_reminder_channels: default_in_app_channel(),
            time_block_reminder_channels: default_in_app_channel(),
            deadline_reminder_offsets: default_deadline_offsets(),
            habit_reminder_time: None,
        }
    }
}

/// Notification preferences returned to the client.
///
/// Extends [`NotificationPrefsData`] with `browser_push_subscribed` which
/// is derived from the `push_subscriptions` table (not stored in the JSONB).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationPreferences {
    pub deadline_reminder_channels: Vec<NotificationChannel>,
    pub habit_reminder_channels: Vec<NotificationChannel>,
    pub time_block_reminder_channels: Vec<NotificationChannel>,
    pub deadline_reminder_offsets: Vec<i32>,
    /// "HH:MM" local time, or `null` to disable.
    pub habit_reminder_time: Option<String>,
    /// True when the user has at least one active push subscription.
    pub browser_push_subscribed: bool,
}

/// Request body for `PATCH /api/settings/notifications`.
/// All fields are optional.
#[derive(Debug, Deserialize, Validate)]
pub struct UpdateNotificationPrefsRequest {
    pub deadline_reminder_channels: Option<Vec<NotificationChannel>>,
    pub habit_reminder_channels: Option<Vec<NotificationChannel>>,
    pub time_block_reminder_channels: Option<Vec<NotificationChannel>>,
    pub deadline_reminder_offsets: Option<Vec<i32>>,
    /// Pass `null` to clear the reminder time.
    pub habit_reminder_time: Option<String>,
}

// ── Account management ─────────────────────────────────────────────────────────

/// Request body for `POST /api/settings/account/password`.
#[derive(Debug, Deserialize, Validate)]
pub struct ChangePasswordRequest {
    /// The user's current password (for verification).
    #[validate(length(min = 1, message = "current_password is required"))]
    pub current_password: String,

    /// The desired new password.
    #[validate(length(min = 8, message = "new_password must be at least 8 characters"))]
    pub new_password: String,
}

/// Request body for `POST /api/settings/account/delete`.
#[derive(Debug, Deserialize, Validate)]
pub struct DeleteAccountRequest {
    /// Password confirmation required before deletion.
    #[validate(length(min = 1, message = "password is required"))]
    pub password: String,
}
