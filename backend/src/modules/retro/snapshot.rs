//! Live metric snapshot for a retro period and scope (design section 4).
//!
//! Every query is scoped to `user_id`. Dates are evaluated in the user's
//! timezone (`users.timezone`). The output is stored as the retro's
//! `snapshot` jsonb on open / refresh / complete.

use std::collections::{HashMap, HashSet};

use chrono::NaiveDate;
use serde_json::{json, Value as JsonValue};
use uuid::Uuid;

use crate::shared::{error::AppResult, state::AppState};

use super::links;

/// Max work items listed in `completed_items.items`.
const MAX_ITEMS: i64 = 20;
/// Max habit streaks listed in `habits.streaks`.
const MAX_STREAKS: usize = 5;
/// How far back habit logs are read to compute streaks.
const STREAK_LOOKBACK_DAYS: i32 = 400;

/// The user's IANA timezone (falls back to UTC).
pub async fn user_tz(state: &AppState, user_id: Uuid) -> AppResult<String> {
    let tz: Option<String> = sqlx::query_scalar("SELECT timezone FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?;
    Ok(tz.unwrap_or_else(|| "UTC".to_string()))
}

/// Today's date in the given timezone.
pub async fn today_in(state: &AppState, tz: &str) -> AppResult<NaiveDate> {
    let today: NaiveDate = sqlx::query_scalar("SELECT (now() AT TIME ZONE $1)::date")
        .bind(tz)
        .fetch_one(&state.db)
        .await?;
    Ok(today)
}

/// Predicate on alias `wi` (work_items) selecting the rows of a scope.
/// `ph` is the placeholder that carries the scope id (NULL = unscoped).
fn wi_scope_clause(scope_type: &str, ph: &str) -> String {
    let cond = match scope_type {
        "sprint" => format!("wi.sprint_id = {ph}"),
        "project" => format!("wi.project_id = {ph}"),
        "epic" => format!("wi.epic_id = {ph}"),
        "initiative" => {
            format!("wi.epic_id IN (SELECT e.id FROM epics e WHERE e.initiative_id = {ph})")
        }
        "goal" => format!(
            "(wi.project_id IN (SELECT p.id FROM projects p WHERE p.goal_id = {ph}) \
             OR wi.epic_id IN (SELECT e.id FROM epics e \
             JOIN initiatives i ON i.id = e.initiative_id WHERE i.goal_id = {ph}))"
        ),
        "work_item" => format!("wi.id = {ph}"),
        "habit" => "FALSE".to_string(),
        _ => "TRUE".to_string(),
    };
    format!("(({ph}::uuid IS NULL) OR ({cond}))")
}

fn round(value: f64, places: i32) -> f64 {
    let factor = 10f64.powi(places);
    (value * factor).round() / factor
}

/// Compute the snapshot for `[from, to]` and the given scope.
pub async fn compute(
    state: &AppState,
    user_id: Uuid,
    from: NaiveDate,
    to: NaiveDate,
    scope_type: &str,
    scope_id: Option<Uuid>,
) -> AppResult<JsonValue> {
    let tz = user_tz(state, user_id).await?;
    let today = today_in(state, &tz).await?;
    // Habit logs cannot exist in the future, so cap the habit window at today.
    let eff_to = if to < today { to } else { today };

    let completed = completed_items_block(state, user_id, &tz, from, to, scope_type, scope_id).await?;
    let overdue = overdue_count(state, user_id, &tz, to, scope_type, scope_id).await?;
    let habits = habits_block(state, user_id, from, eff_to, scope_type, scope_id).await?;
    let focus = focus_block(state, user_id, &tz, from, to).await?;

    let sprint = match (scope_type, scope_id) {
        ("sprint", Some(id)) => sprint_block(state, user_id, id).await?,
        _ => JsonValue::Null,
    };
    let scope = match (scope_type, scope_id) {
        ("project" | "epic" | "initiative" | "goal" | "work_item", Some(id)) => {
            scope_block(state, user_id, scope_type, id).await?
        }
        _ => JsonValue::Null,
    };

    Ok(json!({
        "range": { "from": from, "to": to },
        "completed_items": completed,
        "overdue": { "count": overdue },
        "habits": habits,
        "focus": focus,
        "sprint": sprint,
        "scope": scope,
    }))
}

async fn completed_items_block(
    state: &AppState,
    user_id: Uuid,
    tz: &str,
    from: NaiveDate,
    to: NaiveDate,
    scope_type: &str,
    scope_id: Option<Uuid>,
) -> AppResult<JsonValue> {
    let clause = wi_scope_clause(scope_type, "$5");
    let base = format!(
        "FROM work_items wi LEFT JOIN projects p ON p.id = wi.project_id \
         WHERE wi.user_id = $1 AND wi.deleted_at IS NULL AND wi.completed_at IS NOT NULL \
         AND (wi.completed_at AT TIME ZONE $2)::date BETWEEN $3 AND $4 AND {clause}"
    );

    let by_type_sql = format!(
        "SELECT wi.type::text, COUNT(*)::bigint, COALESCE(SUM(wi.story_points), 0)::bigint {base} \
         GROUP BY wi.type"
    );
    let rows: Vec<(String, i64, i64)> = sqlx::query_as(&by_type_sql)
        .bind(user_id)
        .bind(tz)
        .bind(from)
        .bind(to)
        .bind(scope_id)
        .fetch_all(&state.db)
        .await?;

    let mut by_type = serde_json::Map::new();
    let mut count: i64 = 0;
    let mut points: i64 = 0;
    for (kind, n, pts) in rows {
        by_type.insert(kind, json!(n));
        count += n;
        points += pts;
    }

    let items_sql = format!(
        "SELECT wi.id, wi.title, p.key, wi.seq_id {base} \
         ORDER BY wi.completed_at DESC LIMIT {MAX_ITEMS}"
    );
    let items: Vec<(Uuid, String, Option<String>, Option<i32>)> = sqlx::query_as(&items_sql)
        .bind(user_id)
        .bind(tz)
        .bind(from)
        .bind(to)
        .bind(scope_id)
        .fetch_all(&state.db)
        .await?;

    let items: Vec<JsonValue> = items
        .into_iter()
        .map(|(id, title, prefix, seq)| {
            let key = seq.map(|s| format!("{}-{}", prefix.unwrap_or_else(|| "WI".into()), s));
            json!({ "id": id, "title": title, "key": key })
        })
        .collect();

    Ok(json!({
        "count": count,
        "points": points,
        "by_type": by_type,
        "items": items,
    }))
}

async fn overdue_count(
    state: &AppState,
    user_id: Uuid,
    tz: &str,
    to: NaiveDate,
    scope_type: &str,
    scope_id: Option<Uuid>,
) -> AppResult<i64> {
    let clause = wi_scope_clause(scope_type, "$4");
    let sql = format!(
        "SELECT COUNT(*)::bigint FROM work_items wi \
         WHERE wi.user_id = $1 AND wi.deleted_at IS NULL AND wi.status <> 'done' \
         AND wi.due_date IS NOT NULL AND (wi.due_date AT TIME ZONE $2)::date <= $3 AND {clause}"
    );
    let n: i64 = sqlx::query_scalar(&sql)
        .bind(user_id)
        .bind(tz)
        .bind(to)
        .bind(scope_id)
        .fetch_one(&state.db)
        .await?;
    Ok(n)
}

async fn habits_block(
    state: &AppState,
    user_id: Uuid,
    from: NaiveDate,
    eff_to: NaiveDate,
    scope_type: &str,
    scope_id: Option<Uuid>,
) -> AppResult<JsonValue> {
    // Only a habit-scoped retro narrows the habit set; other scopes use all habits.
    let habit_filter: Option<Uuid> = if scope_type == "habit" { scope_id } else { None };

    let active: Vec<(Uuid, String)> = sqlx::query_as(
        "SELECT id, name FROM habits \
         WHERE user_id = $1 AND NOT archived AND ($2::uuid IS NULL OR id = $2) \
         ORDER BY position, created_at",
    )
    .bind(user_id)
    .bind(habit_filter)
    .fetch_all(&state.db)
    .await?;

    let days: i64 = if eff_to >= from {
        (eff_to - from).num_days() + 1
    } else {
        0
    };

    let (logged_days, completed_pairs): (i64, i64) = sqlx::query_as(
        "SELECT COUNT(DISTINCT hl.log_date)::bigint, \
                COUNT(DISTINCT (hl.habit_id::text || '|' || hl.log_date::text)) \
                    FILTER (WHERE hl.completed)::bigint \
         FROM habit_logs hl JOIN habits h ON h.id = hl.habit_id \
         WHERE h.user_id = $1 AND NOT h.archived AND ($2::uuid IS NULL OR h.id = $2) \
         AND hl.log_date BETWEEN $3 AND $4",
    )
    .bind(user_id)
    .bind(habit_filter)
    .bind(from)
    .bind(eff_to)
    .fetch_one(&state.db)
    .await?;

    let rate = if !active.is_empty() && days > 0 {
        let possible = active.len() as f64 * days as f64;
        Some(round(completed_pairs as f64 / possible, 4))
    } else {
        None
    };

    let mut streaks: Vec<(Uuid, String, usize)> = Vec::new();
    if !active.is_empty() {
        let logs: Vec<(Uuid, NaiveDate)> = sqlx::query_as(&format!(
            "SELECT hl.habit_id, hl.log_date FROM habit_logs hl JOIN habits h ON h.id = hl.habit_id \
             WHERE h.user_id = $1 AND NOT h.archived AND ($2::uuid IS NULL OR h.id = $2) \
             AND hl.completed AND hl.log_date <= $3 \
             AND hl.log_date > $3 - {STREAK_LOOKBACK_DAYS}"
        ))
        .bind(user_id)
        .bind(habit_filter)
        .bind(eff_to)
        .fetch_all(&state.db)
        .await?;

        let mut by_habit: HashMap<Uuid, HashSet<NaiveDate>> = HashMap::new();
        for (habit_id, day) in logs {
            by_habit.entry(habit_id).or_default().insert(day);
        }

        for (habit_id, name) in &active {
            let Some(set) = by_habit.get(habit_id) else {
                continue;
            };
            // Today may not be logged yet; the streak then counts from yesterday.
            let mut day = eff_to;
            if !set.contains(&day) {
                match day.pred_opt() {
                    Some(prev) => day = prev,
                    None => continue,
                }
            }
            let mut n = 0usize;
            while set.contains(&day) {
                n += 1;
                match day.pred_opt() {
                    Some(prev) => day = prev,
                    None => break,
                }
            }
            if n > 0 {
                streaks.push((*habit_id, name.clone(), n));
            }
        }
        streaks.sort_by(|a, b| b.2.cmp(&a.2).then_with(|| a.1.cmp(&b.1)));
        streaks.truncate(MAX_STREAKS);
    }

    let streaks: Vec<JsonValue> = streaks
        .into_iter()
        .map(|(id, name, n)| json!({ "habit_id": id, "name": name, "streak": n }))
        .collect();

    Ok(json!({
        "rate": rate,
        "logged_days": logged_days,
        "streaks": streaks,
    }))
}

async fn focus_block(
    state: &AppState,
    user_id: Uuid,
    tz: &str,
    from: NaiveDate,
    to: NaiveDate,
) -> AppResult<JsonValue> {
    let (seconds, sessions): (i64, i64) = sqlx::query_as(
        "SELECT COALESCE(SUM(fs.duration_seconds), 0)::bigint, COUNT(*)::bigint \
         FROM focus_sessions fs \
         WHERE fs.user_id = $1 AND (fs.started_at AT TIME ZONE $2)::date BETWEEN $3 AND $4",
    )
    .bind(user_id)
    .bind(tz)
    .bind(from)
    .bind(to)
    .fetch_one(&state.db)
    .await?;

    Ok(json!({
        "minutes": round(seconds as f64 / 60.0, 1),
        "sessions": sessions,
    }))
}

async fn sprint_block(state: &AppState, user_id: Uuid, sprint_id: Uuid) -> AppResult<JsonValue> {
    let row: Option<(Uuid, String, Option<f64>, i64, i64)> = sqlx::query_as(
        "SELECT s.id, s.name, s.velocity::float8, \
                (SELECT COALESCE(SUM(wi.story_points), 0)::bigint FROM work_items wi \
                  WHERE wi.sprint_id = s.id AND wi.deleted_at IS NULL), \
                (SELECT COALESCE(SUM(wi.story_points), 0)::bigint FROM work_items wi \
                  WHERE wi.sprint_id = s.id AND wi.deleted_at IS NULL AND wi.status = 'done') \
         FROM sprints s WHERE s.id = $1 AND s.user_id = $2",
    )
    .bind(sprint_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?;

    Ok(match row {
        Some((id, name, velocity, committed, completed)) => json!({
            "id": id,
            "name": name,
            "committed_points": committed,
            "completed_points": completed,
            "velocity": velocity,
        }),
        None => JsonValue::Null,
    })
}

async fn scope_block(
    state: &AppState,
    user_id: Uuid,
    scope_type: &str,
    scope_id: Uuid,
) -> AppResult<JsonValue> {
    let clause = wi_scope_clause(scope_type, "$2");
    let sql = format!(
        "SELECT COUNT(*)::bigint, COUNT(*) FILTER (WHERE wi.status = 'done')::bigint \
         FROM work_items wi \
         WHERE wi.user_id = $1 AND wi.deleted_at IS NULL AND {clause}"
    );
    let (total, done): (i64, i64) = sqlx::query_as(&sql)
        .bind(user_id)
        .bind(scope_id)
        .fetch_one(&state.db)
        .await?;

    let label = links::lookup(state, user_id, scope_type, scope_id)
        .await?
        .and_then(|found| found.title);

    Ok(json!({
        "type": scope_type,
        "id": scope_id,
        "label": label,
        "total_items": total,
        "done_items": done,
    }))
}
