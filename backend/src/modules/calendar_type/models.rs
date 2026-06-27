//! Calendar-type module — DB row + request DTOs.
//!
//! A "calendar type" is a user-defined category (Work, Personal, Health, …)
//! carrying shared config — colour, icon, and event defaults — that every event
//! of that type inherits.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

// ── DB row ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct CalendarType {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub color: String,
    pub icon: Option<String>,
    pub description: Option<String>,
    pub default_all_day: bool,
    pub default_reminder_minutes: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

/// Body for `POST /api/calendar-types`.
#[derive(Debug, Deserialize, Validate)]
pub struct CreateCalendarTypeRequest {
    #[validate(length(min = 1, max = 100, message = "name must be 1–100 characters"))]
    pub name: String,

    /// CSS hex colour, e.g. `"#3b82f6"`.
    #[validate(length(min = 1, max = 50, message = "color must be 1–50 characters"))]
    pub color: String,

    pub icon: Option<String>,

    #[validate(length(max = 2000, message = "description must not exceed 2 000 characters"))]
    pub description: Option<String>,

    #[serde(default)]
    pub default_all_day: bool,

    pub default_reminder_minutes: Option<i32>,
}

/// Body for `PATCH /api/calendar-types/:id` — every field optional.
#[derive(Debug, Deserialize, Validate)]
pub struct UpdateCalendarTypeRequest {
    #[validate(length(min = 1, max = 100, message = "name must be 1–100 characters"))]
    pub name: Option<String>,

    #[validate(length(min = 1, max = 50, message = "color must be 1–50 characters"))]
    pub color: Option<String>,

    pub icon: Option<Option<String>>,
    pub description: Option<Option<String>>,
    pub default_all_day: Option<bool>,
    pub default_reminder_minutes: Option<Option<i32>>,
}
