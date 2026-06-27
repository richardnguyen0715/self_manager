//! Calendar module — database row types and request/response DTOs.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

// ── Database row ──────────────────────────────────────────────────────────────

/// Full `calendar_events` row as returned by SQLx.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct CalendarEvent {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub all_day: bool,
    pub location: Option<String>,
    pub color: Option<String>,
    pub recurrence_rule: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

/// Body for `POST /api/calendar`.
#[derive(Debug, Deserialize, Validate)]
pub struct CreateEventRequest {
    #[validate(length(min = 1, max = 500, message = "title must be 1–500 characters"))]
    pub title: String,

    #[validate(length(max = 5000, message = "description must not exceed 5 000 characters"))]
    pub description: Option<String>,

    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,

    #[serde(default)]
    pub all_day: bool,

    #[validate(length(max = 500, message = "location must not exceed 500 characters"))]
    pub location: Option<String>,

    /// CSS hex color or named token, e.g. `"#3b82f6"`.
    #[validate(length(max = 50, message = "color must not exceed 50 characters"))]
    pub color: Option<String>,

    /// RFC 5545 RRULE string, e.g. `"FREQ=DAILY;COUNT=5"`.
    #[validate(length(
        max = 2000,
        message = "recurrence_rule must not exceed 2 000 characters"
    ))]
    pub recurrence_rule: Option<String>,

    /// Calendar-type UUIDs this event belongs to (0+). The event inherits its
    /// display colour and defaults from these types on the client.
    #[serde(default)]
    pub type_ids: Vec<Uuid>,
}

/// Body for `PATCH /api/calendar/:id`.
///
/// Every field is optional — only provided fields are written.
#[derive(Debug, Deserialize, Validate)]
pub struct UpdateEventRequest {
    #[validate(length(min = 1, max = 500, message = "title must be 1–500 characters"))]
    pub title: Option<String>,

    #[validate(length(max = 5000, message = "description must not exceed 5 000 characters"))]
    pub description: Option<Option<String>>,

    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,

    pub all_day: Option<bool>,

    #[validate(length(max = 500, message = "location must not exceed 500 characters"))]
    pub location: Option<Option<String>>,

    #[validate(length(max = 50, message = "color must not exceed 50 characters"))]
    pub color: Option<Option<String>>,

    #[validate(length(
        max = 2000,
        message = "recurrence_rule must not exceed 2 000 characters"
    ))]
    pub recurrence_rule: Option<Option<String>>,

    /// Replace the event's calendar-type assignments. Absent = leave unchanged;
    /// empty array = clear all assignments.
    pub type_ids: Option<Vec<Uuid>>,

    /// Replace the per-occurrence exclusion list (RFC-3339 start instants).
    /// Used by "delete only this instance" on recurring events.
    pub excluded_dates: Option<Vec<String>>,
}

/// Query parameters for `GET /api/calendar`.
#[derive(Debug, Deserialize)]
pub struct RangeQuery {
    /// Inclusive range start (RFC 3339).
    pub start: DateTime<Utc>,
    /// Exclusive range end (RFC 3339).
    pub end: DateTime<Utc>,
}

// ── Response DTOs ─────────────────────────────────────────────────────────────

/// A calendar event plus its assigned calendar-type UUIDs and per-occurrence
/// exclusions (RFC-3339 start instants skipped for recurring events).
#[derive(Debug, Serialize)]
pub struct EventWithTypes {
    #[serde(flatten)]
    pub event: CalendarEvent,
    pub type_ids: Vec<Uuid>,
    pub excluded_dates: Vec<String>,
}

/// Paginated list response envelope.
#[derive(Debug, Serialize)]
pub struct EventListResponse {
    pub events: Vec<EventWithTypes>,
    pub total: i64,
}
