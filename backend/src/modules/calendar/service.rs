//! Calendar module — business logic layer.
//!
//! All functions accept the full [`AppState`] and operate against the
//! `calendar_events` table via compile-time-checked `sqlx::query!` / `query_as!`
//! macros.  Domain events are broadcast where appropriate so that the
//! `notification` module can schedule reminders.

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    events::DomainEvent,
    state::AppState,
};

use super::models::{
    CalendarEvent, CreateEventRequest, EventListResponse, EventWithTypes, UpdateEventRequest,
};

// ── Calendar-type associations (runtime queries; no offline cache needed) ──────

/// Fetch the calendar-type UUIDs for each of `event_ids`, keyed by event id.
async fn fetch_type_ids(
    state: &AppState,
    event_ids: &[Uuid],
) -> AppResult<HashMap<Uuid, Vec<Uuid>>> {
    let mut map: HashMap<Uuid, Vec<Uuid>> = HashMap::new();
    if event_ids.is_empty() {
        return Ok(map);
    }
    let rows = sqlx::query_as::<_, (Uuid, Uuid)>(
        "SELECT event_id, calendar_type_id FROM event_calendar_types WHERE event_id = ANY($1)",
    )
    .bind(event_ids)
    .fetch_all(&state.db)
    .await?;
    for (event_id, type_id) in rows {
        map.entry(event_id).or_default().push(type_id);
    }
    Ok(map)
}

/// Replace an event's type assignments with `type_ids`, ignoring any id that
/// isn't a calendar type owned by `user_id`.
async fn set_event_types(
    state: &AppState,
    user_id: Uuid,
    event_id: Uuid,
    type_ids: &[Uuid],
) -> AppResult<()> {
    sqlx::query("DELETE FROM event_calendar_types WHERE event_id = $1")
        .bind(event_id)
        .execute(&state.db)
        .await?;
    if !type_ids.is_empty() {
        sqlx::query(
            "INSERT INTO event_calendar_types (event_id, calendar_type_id) \
             SELECT $1, id FROM calendar_types WHERE id = ANY($2) AND user_id = $3 \
             ON CONFLICT DO NOTHING",
        )
        .bind(event_id)
        .bind(type_ids)
        .bind(user_id)
        .execute(&state.db)
        .await?;
    }
    Ok(())
}

/// Wrap a single event with its current type assignments.
async fn with_types(state: &AppState, event: CalendarEvent) -> AppResult<EventWithTypes> {
    let map = fetch_type_ids(state, &[event.id]).await?;
    let type_ids = map.get(&event.id).cloned().unwrap_or_default();
    Ok(EventWithTypes { event, type_ids })
}

// ── Read ──────────────────────────────────────────────────────────────────────

/// Return all events for `user_id` whose `start_time` falls within
/// `[range_start, range_end)`.
///
/// Uses the composite index `idx_calendar_events_start_time`.
pub async fn list_events_in_range(
    state: &AppState,
    user_id: Uuid,
    range_start: DateTime<Utc>,
    range_end: DateTime<Utc>,
) -> AppResult<EventListResponse> {
    if range_end <= range_start {
        return Err(AppError::Validation("end must be after start".to_owned()));
    }

    let events = sqlx::query_as!(
        CalendarEvent,
        r#"
        SELECT id, user_id, title, description,
               start_time, end_time, all_day,
               location, color, recurrence_rule,
               created_at, updated_at
        FROM   calendar_events
        WHERE  user_id    = $1
          AND  start_time >= $2
          AND  start_time <  $3
        ORDER  BY start_time ASC
        "#,
        user_id,
        range_start,
        range_end,
    )
    .fetch_all(&state.db)
    .await?;

    // Recurring events whose anchor started *before* this window must also be
    // returned so the client can expand their occurrences into the range. The
    // macro query above only matched start_time >= range_start, so this picks
    // up the earlier recurring masters (disjoint set — no dedupe needed).
    let mut events = events;
    let recurring_before = sqlx::query_as::<_, CalendarEvent>(
        "SELECT id, user_id, title, description, start_time, end_time, all_day, \
                location, color, recurrence_rule, created_at, updated_at \
         FROM calendar_events \
         WHERE user_id = $1 AND recurrence_rule IS NOT NULL AND start_time < $2",
    )
    .bind(user_id)
    .bind(range_start)
    .fetch_all(&state.db)
    .await?;
    events.extend(recurring_before);

    // Attach calendar-type assignments in one batched query.
    let ids: Vec<Uuid> = events.iter().map(|e| e.id).collect();
    let mut type_map = fetch_type_ids(state, &ids).await?;
    let events: Vec<EventWithTypes> = events
        .into_iter()
        .map(|event| {
            let type_ids = type_map.remove(&event.id).unwrap_or_default();
            EventWithTypes { event, type_ids }
        })
        .collect();

    let total = events.len() as i64;
    Ok(EventListResponse { events, total })
}

/// Fetch a single event by ID, returning `AppError::NotFound` when absent or
/// owned by a different user.
pub async fn get_event(
    state: &AppState,
    user_id: Uuid,
    event_id: Uuid,
) -> AppResult<CalendarEvent> {
    sqlx::query_as!(
        CalendarEvent,
        r#"
        SELECT id, user_id, title, description,
               start_time, end_time, all_day,
               location, color, recurrence_rule,
               created_at, updated_at
        FROM   calendar_events
        WHERE  id      = $1
          AND  user_id = $2
        "#,
        event_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)
}

/// Like [`get_event`] but with the event's calendar-type assignments attached.
pub async fn get_event_with_types(
    state: &AppState,
    user_id: Uuid,
    event_id: Uuid,
) -> AppResult<EventWithTypes> {
    let event = get_event(state, user_id, event_id).await?;
    with_types(state, event).await
}

// ── Write ─────────────────────────────────────────────────────────────────────

/// Insert a new calendar event owned by `user_id`.
///
/// Emits [`DomainEvent::CalendarEventReminder`] so that the notification module
/// can schedule the configured reminder offsets (1 day / 2 h / 30 min before).
pub async fn create_event(
    state: &AppState,
    user_id: Uuid,
    req: CreateEventRequest,
) -> AppResult<EventWithTypes> {
    if req.end_time < req.start_time {
        return Err(AppError::Validation(
            "end_time must not be before start_time".to_owned(),
        ));
    }

    let event = sqlx::query_as!(
        CalendarEvent,
        r#"
        INSERT INTO calendar_events
            (user_id, title, description, start_time, end_time,
             all_day, location, color, recurrence_rule)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, user_id, title, description,
                  start_time, end_time, all_day,
                  location, color, recurrence_rule,
                  created_at, updated_at
        "#,
        user_id,
        req.title,
        req.description,
        req.start_time,
        req.end_time,
        req.all_day,
        req.location,
        req.color,
        req.recurrence_rule,
    )
    .fetch_one(&state.db)
    .await?;

    // Persist calendar-type assignments.
    set_event_types(state, user_id, event.id, &req.type_ids).await?;

    // Notify the event bus; the notification module subscribes and schedules
    // reminder notifications.  A send failure means no subscribers are listening
    // yet — that is not an error from the caller's perspective.
    let _ = state.events.send(DomainEvent::CalendarEventReminder {
        event_id: event.id,
        user_id,
    });

    with_types(state, event).await
}

/// Apply a partial update to a calendar event.
///
/// Only fields that are `Some` in the request are written; all others retain
/// their current database values.  Returns the full updated row.
pub async fn update_event(
    state: &AppState,
    user_id: Uuid,
    event_id: Uuid,
    req: UpdateEventRequest,
) -> AppResult<EventWithTypes> {
    // Load the existing row first — this enforces ownership and gives us current
    // values for fields the caller did not supply.
    let existing = get_event(state, user_id, event_id).await?;

    let new_title = req.title.unwrap_or(existing.title);
    let new_description = req.description.unwrap_or(existing.description);
    let new_start = req.start_time.unwrap_or(existing.start_time);
    let new_end = req.end_time.unwrap_or(existing.end_time);
    let new_all_day = req.all_day.unwrap_or(existing.all_day);
    let new_location = req.location.unwrap_or(existing.location);
    let new_color = req.color.unwrap_or(existing.color);
    let new_recurrence = req.recurrence_rule.unwrap_or(existing.recurrence_rule);

    if new_end < new_start {
        return Err(AppError::Validation(
            "end_time must not be before start_time".to_owned(),
        ));
    }

    let event = sqlx::query_as!(
        CalendarEvent,
        r#"
        UPDATE calendar_events
        SET    title           = $1,
               description     = $2,
               start_time      = $3,
               end_time        = $4,
               all_day         = $5,
               location        = $6,
               color           = $7,
               recurrence_rule = $8,
               updated_at      = now()
        WHERE  id      = $9
          AND  user_id = $10
        RETURNING id, user_id, title, description,
                  start_time, end_time, all_day,
                  location, color, recurrence_rule,
                  created_at, updated_at
        "#,
        new_title,
        new_description,
        new_start,
        new_end,
        new_all_day,
        new_location,
        new_color,
        new_recurrence,
        event_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?;

    // Replace type assignments only when the caller supplied them.
    if let Some(type_ids) = req.type_ids {
        set_event_types(state, user_id, event.id, &type_ids).await?;
    }

    with_types(state, event).await
}

/// Delete a calendar event owned by `user_id`.
///
/// Returns `AppError::NotFound` when the event does not exist or is owned by
/// a different user.
pub async fn delete_event(state: &AppState, user_id: Uuid, event_id: Uuid) -> AppResult<()> {
    let result = sqlx::query!(
        r#"
        DELETE FROM calendar_events
        WHERE  id      = $1
          AND  user_id = $2
        "#,
        event_id,
        user_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}

// ── Day / week / month convenience helpers ────────────────────────────────────

/// Return events for a single calendar day (midnight-to-midnight UTC).
pub async fn list_events_for_day(
    state: &AppState,
    user_id: Uuid,
    day: chrono::NaiveDate,
) -> AppResult<EventListResponse> {
    let start: DateTime<Utc> = day
        .and_hms_opt(0, 0, 0)
        .expect("midnight is always valid")
        .and_utc();
    let end: DateTime<Utc> = day
        .succ_opt()
        .expect("day successor is always valid")
        .and_hms_opt(0, 0, 0)
        .expect("midnight is always valid")
        .and_utc();
    list_events_in_range(state, user_id, start, end).await
}
