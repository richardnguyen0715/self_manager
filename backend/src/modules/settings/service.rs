//! Settings service — all database access for the settings module.
//!
//! This service owns the `user_preferences` table exclusively. The
//! `push_subscriptions` table is owned by the notification module service.
//!
//! All queries use `sqlx::query!` / `sqlx::query_as!` for compile-time
//! verification. Offline (no DATABASE_URL) the macros fall back to
//! runtime-only mode.

use sqlx::PgPool;
use tracing::instrument;
use uuid::Uuid;

use crate::{
    modules::auth::service as auth_service,
    shared::error::{AppError, AppResult},
};

use super::models::{
    AppearancePreferences, ColorTheme, NotificationPreferences, NotificationPrefsData, Theme,
    UpdateAppearanceRequest, UpdateNotificationPrefsRequest,
};

// ── Internal DB row ────────────────────────────────────────────────────────────

/// Raw row returned by queries against `user_preferences`.
struct PrefsRow {
    theme: String,
    color_theme: String,
    compact_mode: bool,
    show_completed_tasks: bool,
    week_starts_on: i16,
    notification_prefs: serde_json::Value,
}

// ── Helpers ────────────────────────────────────────────────────────────────────

fn parse_theme(s: &str) -> Theme {
    match s {
        "light" => Theme::Light,
        "dark" => Theme::Dark,
        _ => Theme::System,
    }
}

fn theme_str(t: &Theme) -> &'static str {
    match t {
        Theme::Light => "light",
        Theme::Dark => "dark",
        Theme::System => "system",
    }
}

fn parse_color_theme(s: &str) -> ColorTheme {
    match s {
        "slate" => ColorTheme::Slate,
        "blue" => ColorTheme::Blue,
        "green" => ColorTheme::Green,
        "rose" => ColorTheme::Rose,
        "orange" => ColorTheme::Orange,
        _ => ColorTheme::Zinc,
    }
}

fn color_theme_str(t: &ColorTheme) -> &'static str {
    match t {
        ColorTheme::Zinc => "zinc",
        ColorTheme::Slate => "slate",
        ColorTheme::Blue => "blue",
        ColorTheme::Green => "green",
        ColorTheme::Rose => "rose",
        ColorTheme::Orange => "orange",
    }
}

fn row_to_appearance(row: &PrefsRow) -> AppearancePreferences {
    AppearancePreferences {
        theme: parse_theme(&row.theme),
        color_theme: parse_color_theme(&row.color_theme),
        compact_mode: row.compact_mode,
        show_completed_tasks: row.show_completed_tasks,
        week_starts_on: row.week_starts_on,
    }
}

fn parse_notif_prefs(val: &serde_json::Value) -> NotificationPrefsData {
    serde_json::from_value(val.clone()).unwrap_or_default()
}

// ── Public service functions ───────────────────────────────────────────────────

/// Ensure a `user_preferences` row exists for the user, inserting defaults
/// if absent. Returns the raw preference row.
///
/// # Errors
///
/// Returns [`AppError::Db`] on unexpected database errors.
#[instrument(skip(db), fields(user_id = %user_id))]
async fn ensure_prefs_row(db: &PgPool, user_id: Uuid) -> AppResult<PrefsRow> {
    // Insert defaults if the row doesn't exist yet (idempotent).
    sqlx::query!(
        r#"
        INSERT INTO user_preferences (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
        "#,
        user_id,
    )
    .execute(db)
    .await?;

    let row = sqlx::query!(
        r#"
        SELECT theme, color_theme, compact_mode, show_completed_tasks,
               week_starts_on, notification_prefs
        FROM user_preferences
        WHERE user_id = $1
        "#,
        user_id,
    )
    .fetch_one(db)
    .await?;

    Ok(PrefsRow {
        theme: row.theme,
        color_theme: row.color_theme,
        compact_mode: row.compact_mode,
        show_completed_tasks: row.show_completed_tasks,
        week_starts_on: row.week_starts_on,
        notification_prefs: row.notification_prefs,
    })
}

/// Return the appearance preferences for a user.
///
/// Inserts a default row if none exists yet.
///
/// # Errors
///
/// Returns [`AppError::Db`] on database errors.
#[instrument(skip(db), fields(user_id = %user_id))]
pub async fn get_appearance(db: &PgPool, user_id: Uuid) -> AppResult<AppearancePreferences> {
    let row = ensure_prefs_row(db, user_id).await?;
    Ok(row_to_appearance(&row))
}

/// Partially update appearance preferences.
///
/// Only fields that are `Some` in the request are written.
///
/// # Errors
///
/// Returns [`AppError::Validation`] for invalid `week_starts_on` values, or
/// [`AppError::Db`] on database errors.
#[instrument(skip(db), fields(user_id = %user_id))]
pub async fn update_appearance(
    db: &PgPool,
    user_id: Uuid,
    req: &UpdateAppearanceRequest,
) -> AppResult<AppearancePreferences> {
    if let Some(ws) = req.week_starts_on {
        if ws != 0 && ws != 1 {
            return Err(AppError::Validation(
                "week_starts_on must be 0 (Sunday) or 1 (Monday)".to_owned(),
            ));
        }
    }

    // Ensure the row exists first.
    let existing = ensure_prefs_row(db, user_id).await?;

    // Merge: fall back to the stored value for each unset field.
    let new_theme = req
        .theme
        .as_ref()
        .map(theme_str)
        .unwrap_or_else(|| existing.theme.as_str())
        .to_owned();

    let new_color_theme = req
        .color_theme
        .as_ref()
        .map(color_theme_str)
        .unwrap_or_else(|| existing.color_theme.as_str())
        .to_owned();

    let new_compact = req.compact_mode.unwrap_or(existing.compact_mode);
    let new_show = req
        .show_completed_tasks
        .unwrap_or(existing.show_completed_tasks);
    let new_week = req.week_starts_on.unwrap_or(existing.week_starts_on);

    sqlx::query!(
        r#"
        UPDATE user_preferences
        SET theme                = $2,
            color_theme          = $3,
            compact_mode         = $4,
            show_completed_tasks = $5,
            week_starts_on       = $6,
            updated_at           = now()
        WHERE user_id = $1
        "#,
        user_id,
        new_theme,
        new_color_theme,
        new_compact,
        new_show,
        new_week,
    )
    .execute(db)
    .await?;

    Ok(AppearancePreferences {
        theme: parse_theme(&new_theme),
        color_theme: parse_color_theme(&new_color_theme),
        compact_mode: new_compact,
        show_completed_tasks: new_show,
        week_starts_on: new_week,
    })
}

/// Return the notification preferences for a user, including whether the user
/// has at least one active push subscription.
///
/// # Errors
///
/// Returns [`AppError::Db`] on database errors.
#[instrument(skip(db), fields(user_id = %user_id))]
pub async fn get_notification_prefs(
    db: &PgPool,
    user_id: Uuid,
) -> AppResult<NotificationPreferences> {
    let row = ensure_prefs_row(db, user_id).await?;
    let data = parse_notif_prefs(&row.notification_prefs);

    let push_subscribed: bool = sqlx::query_scalar!(
        r#"SELECT EXISTS(SELECT 1 FROM push_subscriptions WHERE user_id = $1) AS "exists!""#,
        user_id,
    )
    .fetch_one(db)
    .await?;

    Ok(NotificationPreferences {
        deadline_reminder_channels: data.deadline_reminder_channels,
        habit_reminder_channels: data.habit_reminder_channels,
        time_block_reminder_channels: data.time_block_reminder_channels,
        deadline_reminder_offsets: data.deadline_reminder_offsets,
        habit_reminder_time: data.habit_reminder_time,
        browser_push_subscribed: push_subscribed,
    })
}

/// Partially update notification preferences.
///
/// Only supplied fields are written; the rest are preserved from the
/// existing JSONB blob.
///
/// # Errors
///
/// Returns [`AppError::Db`] on database errors.
#[instrument(skip(db), fields(user_id = %user_id))]
pub async fn update_notification_prefs(
    db: &PgPool,
    user_id: Uuid,
    req: &UpdateNotificationPrefsRequest,
) -> AppResult<NotificationPreferences> {
    let row = ensure_prefs_row(db, user_id).await?;
    let mut data = parse_notif_prefs(&row.notification_prefs);

    // Merge only the provided fields.
    if let Some(ch) = &req.deadline_reminder_channels {
        data.deadline_reminder_channels = ch.clone();
    }
    if let Some(ch) = &req.habit_reminder_channels {
        data.habit_reminder_channels = ch.clone();
    }
    if let Some(ch) = &req.time_block_reminder_channels {
        data.time_block_reminder_channels = ch.clone();
    }
    if let Some(offsets) = &req.deadline_reminder_offsets {
        data.deadline_reminder_offsets = offsets.clone();
    }
    // `habit_reminder_time` uses `Option<String>`: `Some("HH:MM")` sets the
    // time, `Some("")` clears it (treated as null), and `None` means "field was
    // absent from the JSON body — leave unchanged". Frontend sends `null` in JSON
    // to clear, which serde decodes to `None` for `Option<String>`. To allow
    // clearing without a double-Option, the frontend can send `""` instead.
    if let Some(ref t) = req.habit_reminder_time {
        data.habit_reminder_time = if t.is_empty() { None } else { Some(t.clone()) };
    }

    let new_prefs_json = serde_json::to_value(&data).map_err(|_| AppError::Internal)?;

    sqlx::query!(
        r#"
        UPDATE user_preferences
        SET notification_prefs = $2,
            updated_at         = now()
        WHERE user_id = $1
        "#,
        user_id,
        new_prefs_json,
    )
    .execute(db)
    .await?;

    let push_subscribed: bool = sqlx::query_scalar!(
        r#"SELECT EXISTS(SELECT 1 FROM push_subscriptions WHERE user_id = $1) AS "exists!""#,
        user_id,
    )
    .fetch_one(db)
    .await?;

    Ok(NotificationPreferences {
        deadline_reminder_channels: data.deadline_reminder_channels,
        habit_reminder_channels: data.habit_reminder_channels,
        time_block_reminder_channels: data.time_block_reminder_channels,
        deadline_reminder_offsets: data.deadline_reminder_offsets,
        habit_reminder_time: data.habit_reminder_time,
        browser_push_subscribed: push_subscribed,
    })
}

/// Change the authenticated user's password.
///
/// 1. Fetches the current `password_hash` from `users`.
/// 2. Verifies `current_password` against it.
/// 3. Hashes `new_password` and writes it back.
///
/// # Errors
///
/// - [`AppError::UnauthorizedMsg`] — `current_password` does not match.
/// - [`AppError::NotFound`] — user row missing (should not happen in practice).
/// - [`AppError::Internal`] — hashing failure.
/// - [`AppError::Db`] — database error.
#[instrument(skip(db, current_password, new_password), fields(user_id = %user_id))]
pub async fn change_password(
    db: &PgPool,
    user_id: Uuid,
    current_password: &str,
    new_password: &str,
) -> AppResult<()> {
    // Fetch the stored hash.
    let row = sqlx::query!("SELECT password_hash FROM users WHERE id = $1", user_id,)
        .fetch_optional(db)
        .await?
        .ok_or(AppError::NotFound)?;

    // Verify current password.
    let valid = auth_service::verify_password(current_password, &row.password_hash)?;
    if !valid {
        return Err(AppError::UnauthorizedMsg(
            "current password is incorrect".to_owned(),
        ));
    }

    // Hash and persist the new password.
    let new_hash = auth_service::hash_password(new_password)?;

    sqlx::query!(
        "UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1",
        user_id,
        new_hash,
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Permanently delete the authenticated user's account after password confirmation.
///
/// The `users` table has `ON DELETE CASCADE` on all child tables so a single
/// DELETE is sufficient.
///
/// # Errors
///
/// - [`AppError::UnauthorizedMsg`] — `password` does not match.
/// - [`AppError::NotFound`] — user row missing.
/// - [`AppError::Internal`] — hashing failure.
/// - [`AppError::Db`] — database error.
#[instrument(skip(db, password), fields(user_id = %user_id))]
pub async fn delete_account(db: &PgPool, user_id: Uuid, password: &str) -> AppResult<()> {
    // Fetch the stored hash.
    let row = sqlx::query!("SELECT password_hash FROM users WHERE id = $1", user_id,)
        .fetch_optional(db)
        .await?
        .ok_or(AppError::NotFound)?;

    // Verify password before destroying the account.
    let valid = auth_service::verify_password(password, &row.password_hash)?;
    if !valid {
        return Err(AppError::UnauthorizedMsg(
            "password is incorrect".to_owned(),
        ));
    }

    // CASCADE handles all child rows.
    sqlx::query!("DELETE FROM users WHERE id = $1", user_id)
        .execute(db)
        .await?;

    Ok(())
}
