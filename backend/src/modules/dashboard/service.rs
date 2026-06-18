//! Dashboard service — aggregates today's view across all data domains.
//!
//! All queries are read-only.  No domain events are emitted because the
//! dashboard only reads data; mutations belong to the owning modules.
//!
//! # Performance notes
//!
//! - Each section (tasks, habits, events, time blocks) runs as a separate
//!   query.  They could be parallelised with `tokio::join!` but are kept
//!   sequential here to keep the query plan predictable and to avoid
//!   saturating the connection pool on a cold load.
//! - Streak calculation is done in Rust over the last 90 days of habit logs
//!   fetched in one batch, which is cheaper than a per-habit recursive CTE.

use chrono::{NaiveDate, Utc};
use uuid::Uuid;

use crate::shared::{error::AppResult, state::AppState};

#[allow(unused_imports)]
// DashHabitType/DashTaskPriority/DashTaskStatus are sqlx type-override annotation targets
use super::models::{
    DashHabitType, DashTaskPriority, DashTaskStatus, DashboardEvent, DashboardHabit,
    DashboardResponse, DashboardTask, DashboardTimeBlock, GoalProgress, GoalProgressRow,
    HabitWithLog, QuickStats, RawSprintTimeBlock, SprintDashboardResponse, SprintDashboardTimeBlock,
    SprintSummary, StreakRow, WorkItemListItem,
};

// ── Public API ────────────────────────────────────────────────────────────────

/// Build the full dashboard snapshot for `user_id` on `date`.
///
/// `date` defaults to today (UTC) when the caller passes `None`.
pub async fn get_dashboard(
    state: &AppState,
    user_id: Uuid,
    date: Option<NaiveDate>,
) -> AppResult<DashboardResponse> {
    let target = date.unwrap_or_else(|| Utc::now().date_naive());

    // Run all sections; errors propagate immediately via `?`.
    let tasks = fetch_tasks(state, user_id, target).await?;
    let habits = fetch_habits(state, user_id, target).await?;
    let events = fetch_events(state, user_id, target).await?;
    let time_blocks = fetch_time_blocks(state, user_id, target).await?;
    let stats = fetch_quick_stats(state, user_id, target, &habits).await?;

    Ok(DashboardResponse {
        date: target,
        stats,
        tasks,
        habits,
        events,
        time_blocks,
    })
}

/// Return only the quick-stats section (lighter endpoint).
pub async fn get_quick_stats(
    state: &AppState,
    user_id: Uuid,
    date: Option<NaiveDate>,
) -> AppResult<QuickStats> {
    let target = date.unwrap_or_else(|| Utc::now().date_naive());
    // Habits are needed for the completion-rate and best-streak fields.
    let habits = fetch_habits(state, user_id, target).await?;
    fetch_quick_stats(state, user_id, target, &habits).await
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

/// Fetch tasks that are relevant to the dashboard for `date`:
/// - Due on `date` (any non-archived/completed status).
/// - Overdue (due_date < today start, not completed/archived).
/// - Currently `in_progress` (regardless of due date).
///
/// Capped at 50 rows ordered by priority, then due date.
async fn fetch_tasks(
    state: &AppState,
    user_id: Uuid,
    date: NaiveDate,
) -> AppResult<Vec<DashboardTask>> {
    // Convert NaiveDate to the start/end of day as UTC timestamps.
    let day_start = date.and_hms_opt(0, 0, 0).expect("valid time").and_utc();
    let day_end = date.and_hms_opt(23, 59, 59).expect("valid time").and_utc();
    let now = Utc::now();

    let rows = sqlx::query_as!(
        DashboardTask,
        r#"SELECT
               t.id,
               t.title,
               t.priority   AS "priority: DashTaskPriority",
               t.status     AS "status: DashTaskStatus",
               t.due_date,
               t.estimated_time,
               t.project_id,
               p.name       AS project_name
           FROM tasks t
           LEFT JOIN projects p ON p.id = t.project_id
           WHERE t.user_id = $1
             AND t.status NOT IN ('completed', 'archived')
             AND (
                 -- due today
                 (t.due_date >= $2 AND t.due_date <= $3)
                 -- overdue
                 OR t.due_date < $4
                 -- in-progress regardless of due date
                 OR t.status = 'in_progress'
             )
           ORDER BY
               CASE t.priority
                   WHEN 'critical' THEN 0
                   WHEN 'high'     THEN 1
                   WHEN 'medium'   THEN 2
                   WHEN 'low'      THEN 3
               END ASC,
               t.due_date ASC NULLS LAST,
               t.created_at DESC
           LIMIT 50"#,
        user_id,
        day_start,
        day_end,
        now,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

// ── Habits ────────────────────────────────────────────────────────────────────

/// Fetch active habits together with today's log (if any), then compute
/// per-habit streak over the last 90 days of logs.
async fn fetch_habits(
    state: &AppState,
    user_id: Uuid,
    date: NaiveDate,
) -> AppResult<Vec<DashboardHabit>> {
    // 1. Fetch habits + today's log in one LEFT JOIN.
    //    NUMERIC(10,2) columns are cast to DOUBLE PRECISION to avoid requiring
    //    the optional `bigdecimal` SQLx feature.
    let raw: Vec<HabitWithLog> = sqlx::query_as!(
        HabitWithLog,
        r#"SELECT
               h.id,
               h.name,
               h.habit_type                          AS "habit_type: DashHabitType",
               h.target_value::DOUBLE PRECISION      AS "target_value!: f64",
               h.color,
               h.icon,
               hl.value::DOUBLE PRECISION            AS "logged_value: f64",
               hl.completed                          AS log_completed
           FROM habits h
           LEFT JOIN habit_logs hl
               ON hl.habit_id = h.id
               AND hl.log_date = $2
           WHERE h.user_id = $1
             AND h.archived = false
           ORDER BY h.position ASC, h.created_at ASC"#,
        user_id,
        date,
    )
    .fetch_all(&state.db)
    .await?;

    if raw.is_empty() {
        return Ok(Vec::new());
    }

    // 2. Fetch the last 90 days of log completions for all habits in one query.
    let since = date - chrono::Duration::days(90);
    let habit_ids: Vec<Uuid> = raw.iter().map(|h| h.id).collect();

    let streak_logs: Vec<StreakRow> = sqlx::query_as!(
        StreakRow,
        r#"SELECT habit_id, log_date, completed
           FROM habit_logs
           WHERE user_id   = $1
             AND habit_id  = ANY($2)
             AND log_date >= $3
             AND log_date <= $4
           ORDER BY habit_id ASC, log_date DESC"#,
        user_id,
        &habit_ids,
        since,
        date,
    )
    .fetch_all(&state.db)
    .await?;

    // 3. Build a map from habit_id -> streak length.
    use std::collections::HashMap;
    let mut streaks: HashMap<Uuid, i32> = HashMap::with_capacity(raw.len());
    {
        // Group log dates per habit (only completed logs count for streak).
        let mut per_habit: HashMap<Uuid, Vec<NaiveDate>> = HashMap::new();
        for row in &streak_logs {
            if row.completed {
                per_habit
                    .entry(row.habit_id)
                    .or_default()
                    .push(row.log_date);
            }
        }
        // Each habit's dates come from the query ordered DESC; compute streak.
        for &habit_id in &habit_ids {
            let dates = per_habit.get(&habit_id);
            let streak = compute_streak(dates.map(Vec::as_slice).unwrap_or(&[]), date);
            streaks.insert(habit_id, streak);
        }
    }

    // 4. Assemble the response structs.
    let mut result = Vec::with_capacity(raw.len());
    for h in raw {
        let completed = h.log_completed.unwrap_or(false);
        let current_streak = streaks.get(&h.id).copied().unwrap_or(0);

        result.push(DashboardHabit {
            id: h.id,
            name: h.name,
            habit_type: h.habit_type,
            target_value: h.target_value,
            logged_value: h.logged_value,
            completed,
            current_streak,
            color: h.color,
            icon: h.icon,
        });
    }

    Ok(result)
}

/// Compute the backward-consecutive-days streak ending on `today`.
///
/// `dates` is a slice of completed log dates (any order; a `HashSet` is built
/// internally for O(1) lookup).  A gap of even one day resets the streak to 0.
fn compute_streak(dates: &[NaiveDate], today: NaiveDate) -> i32 {
    use std::collections::HashSet;

    let set: HashSet<NaiveDate> = dates.iter().copied().collect();
    let mut streak = 0i32;
    let mut cursor = today;

    loop {
        if set.contains(&cursor) {
            streak += 1;
            match cursor.pred_opt() {
                Some(prev) => cursor = prev,
                None => break,
            }
        } else {
            break;
        }
    }

    streak
}

// ── Calendar events ───────────────────────────────────────────────────────────

/// Fetch all calendar events that overlap with `date` (UTC day boundaries).
async fn fetch_events(
    state: &AppState,
    user_id: Uuid,
    date: NaiveDate,
) -> AppResult<Vec<DashboardEvent>> {
    let day_start = date.and_hms_opt(0, 0, 0).expect("valid time").and_utc();
    let day_end = date.and_hms_opt(23, 59, 59).expect("valid time").and_utc();

    let events = sqlx::query_as!(
        DashboardEvent,
        r#"SELECT
               id,
               title,
               start_time,
               end_time,
               all_day,
               location,
               color
           FROM calendar_events
           WHERE user_id = $1
             AND start_time <= $3
             AND end_time   >= $2
           ORDER BY start_time ASC, all_day DESC"#,
        user_id,
        day_start,
        day_end,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(events)
}

// ── Time blocks ───────────────────────────────────────────────────────────────

/// Intermediate DB row for time blocks before we compute derived fields.
#[derive(sqlx::FromRow)]
struct RawTimeBlock {
    id: Uuid,
    title: String,
    start_time: chrono::DateTime<Utc>,
    end_time: chrono::DateTime<Utc>,
    task_id: Option<Uuid>,
    task_title: Option<String>,
    color: Option<String>,
    /// Sum of duration_seconds from finished focus sessions, if any.
    actual_focus_seconds: Option<i64>,
}

/// Fetch time blocks that start on `date` (UTC).
async fn fetch_time_blocks(
    state: &AppState,
    user_id: Uuid,
    date: NaiveDate,
) -> AppResult<Vec<DashboardTimeBlock>> {
    let day_start = date.and_hms_opt(0, 0, 0).expect("valid time").and_utc();
    let day_end = date.and_hms_opt(23, 59, 59).expect("valid time").and_utc();

    let raw = sqlx::query_as!(
        RawTimeBlock,
        r#"SELECT
               tb.id,
               tb.title,
               tb.start_time,
               tb.end_time,
               tb.task_id,
               t.title       AS task_title,
               tb.color,
               SUM(fs.duration_seconds)::bigint AS actual_focus_seconds
           FROM time_blocks tb
           LEFT JOIN tasks t
               ON t.id = tb.task_id
           LEFT JOIN focus_sessions fs
               ON fs.time_block_id = tb.id
               AND fs.ended_at IS NOT NULL
           WHERE tb.user_id = $1
             AND tb.start_time >= $2
             AND tb.start_time <= $3
           GROUP BY tb.id, tb.title, tb.start_time, tb.end_time,
                    tb.task_id, t.title, tb.color
           ORDER BY tb.start_time ASC"#,
        user_id,
        day_start,
        day_end,
    )
    .fetch_all(&state.db)
    .await?;

    let blocks = raw
        .into_iter()
        .map(|r| {
            let estimated_minutes = (r.end_time - r.start_time).num_minutes();
            let actual_focus_minutes = r.actual_focus_seconds.map(|s| s / 60);
            DashboardTimeBlock {
                id: r.id,
                title: r.title,
                start_time: r.start_time,
                end_time: r.end_time,
                estimated_minutes,
                actual_focus_minutes,
                task_id: r.task_id,
                task_title: r.task_title,
                color: r.color,
            }
        })
        .collect();

    Ok(blocks)
}

// ── Quick stats ───────────────────────────────────────────────────────────────

/// Aggregate the quick-stat numbers for the target date.
///
/// `habits` is passed in already-fetched to avoid a second round-trip.
async fn fetch_quick_stats(
    state: &AppState,
    user_id: Uuid,
    date: NaiveDate,
    habits: &[DashboardHabit],
) -> AppResult<QuickStats> {
    let day_start = date.and_hms_opt(0, 0, 0).expect("valid time").and_utc();
    let day_end = date.and_hms_opt(23, 59, 59).expect("valid time").and_utc();
    let now = Utc::now();

    // Tasks completed today.
    let tasks_done_today: i64 = sqlx::query_scalar!(
        r#"SELECT COUNT(*)
           FROM tasks
           WHERE user_id     = $1
             AND status      = 'completed'
             AND completed_at >= $2
             AND completed_at <= $3"#,
        user_id,
        day_start,
        day_end,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    // Overdue tasks: past due date and not completed/archived.
    let tasks_overdue: i64 = sqlx::query_scalar!(
        r#"SELECT COUNT(*)
           FROM tasks
           WHERE user_id  = $1
             AND due_date < $2
             AND status NOT IN ('completed', 'archived')"#,
        user_id,
        now,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    // Focus minutes today from completed focus sessions.
    let focus_minutes_today: i64 = sqlx::query_scalar!(
        r#"SELECT COALESCE(SUM(duration_seconds), 0)::bigint
           FROM focus_sessions
           WHERE user_id    = $1
             AND ended_at  >= $2
             AND ended_at  <= $3
             AND duration_seconds IS NOT NULL"#,
        user_id,
        day_start,
        day_end,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0)
        / 60;

    // Pomodoro sessions today (any focus_mode, ended today).
    let pomodoro_sessions_today: i64 = sqlx::query_scalar!(
        r#"SELECT COUNT(*)
           FROM focus_sessions
           WHERE user_id   = $1
             AND ended_at >= $2
             AND ended_at <= $3
             AND ended_at IS NOT NULL"#,
        user_id,
        day_start,
        day_end,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    // Derive habit stats from the already-loaded habits slice — no extra query.
    let best_habit_streak = habits.iter().map(|h| h.current_streak).max().unwrap_or(0);

    let habit_completion_rate_today = if habits.is_empty() {
        None
    } else {
        let completed = habits.iter().filter(|h| h.completed).count() as f64;
        let total = habits.len() as f64;
        Some(completed / total)
    };

    Ok(QuickStats {
        tasks_done_today,
        tasks_overdue,
        best_habit_streak,
        focus_minutes_today,
        pomodoro_sessions_today,
        habit_completion_rate_today,
    })
}

// ── Sprint-centric dashboard ──────────────────────────────────────────────────

/// Build the sprint-centric dashboard snapshot for `user_id` on `date`.
///
/// Aggregates:
/// - The active sprint (if any) with derived `planned_points`, `done_count`.
/// - Sprint progress percentage.
/// - Goal progress rollup across the work-item hierarchy.
/// - Today's time blocks (both legacy `task_id` and new `work_item_id`).
/// - Overdue work items (past `due_date`, status != `done`).
/// - Active habits with today's completion status.
///
/// # Errors
///
/// Returns [`crate::shared::error::AppError::Db`] on any database failure.
pub async fn get_sprint_dashboard(
    state: &AppState,
    user_id: Uuid,
    date: Option<NaiveDate>,
) -> AppResult<SprintDashboardResponse> {
    let target = date.unwrap_or_else(|| Utc::now().date_naive());

    // Parallelise all sections — they are independent reads.
    let (sprint_opt, goal_progress, today_blocks, overdue_items, habits) = tokio::try_join!(
        fetch_active_sprint(state, user_id),
        fetch_goal_progress(state, user_id),
        fetch_sprint_time_blocks(state, user_id, target),
        fetch_overdue_work_items(state, user_id),
        fetch_habits(state, user_id, target),
    )?;

    // Compute sprint progress percentage from work items in the active sprint.
    let sprint_progress_pct = if let Some(ref sprint) = sprint_opt {
        compute_sprint_progress(state, sprint.id).await?
    } else {
        0.0_f64
    };

    Ok(SprintDashboardResponse {
        date: target,
        active_sprint: sprint_opt,
        sprint_progress_pct,
        goal_progress,
        today_time_blocks: today_blocks,
        overdue_work_items: overdue_items,
        habits,
    })
}

// ── Section fetchers ──────────────────────────────────────────────────────────

/// Fetch the single active sprint for `user_id`, or `None` when no sprint is
/// active.
async fn fetch_active_sprint(
    state: &AppState,
    user_id: Uuid,
) -> AppResult<Option<SprintSummary>> {
    // velocity is stored as NUMERIC(5,2); cast to f64 for the response.
    let row = sqlx::query_as!(
        SprintSummary,
        r#"SELECT
               id,
               user_id,
               name,
               goal_text,
               start_date,
               end_date,
               capacity_points,
               status::text        AS "status!",
               velocity::float8    AS "velocity: f64",
               completed_points,
               created_at,
               updated_at
           FROM sprints
           WHERE user_id = $1
             AND status::text = 'active'
           LIMIT 1"#,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?;

    Ok(row)
}

/// Compute the completion percentage of work items belonging to a sprint.
///
/// Returns a value in [0.0, 100.0].  Returns 0.0 when the sprint has no items.
async fn compute_sprint_progress(state: &AppState, sprint_id: Uuid) -> AppResult<f64> {
    struct Counts {
        total: i64,
        done: i64,
    }

    let row = sqlx::query!(
        r#"SELECT
               COUNT(*)                                         AS "total!: i64",
               COUNT(*) FILTER (WHERE status::text = 'done')   AS "done!: i64"
           FROM work_items
           WHERE sprint_id = $1"#,
        sprint_id,
    )
    .fetch_one(&state.db)
    .await?;

    let counts = Counts {
        total: row.total,
        done: row.done,
    };

    if counts.total == 0 {
        return Ok(0.0);
    }

    Ok((counts.done as f64 / counts.total as f64) * 100.0)
}

/// Compute per-goal completion rate from work items under goals → initiatives
/// → epics → work_items.
///
/// Only `active` goals for the user are included.
async fn fetch_goal_progress(
    state: &AppState,
    user_id: Uuid,
) -> AppResult<Vec<GoalProgress>> {
    // Aggregate done/total work items for each goal via the
    // goals → initiatives → epics → work_items chain.
    let rows: Vec<GoalProgressRow> = sqlx::query_as!(
        GoalProgressRow,
        r#"SELECT
               g.id                                             AS "goal_id!",
               g.title                                          AS "title!",
               COUNT(wi.id)                                     AS "total_items!: i64",
               COUNT(wi.id) FILTER (WHERE wi.status::text = 'done')
                                                                AS "done_items!: i64"
           FROM goals g
           LEFT JOIN initiatives ini
               ON ini.goal_id = g.id AND ini.user_id = g.user_id
           LEFT JOIN epics e
               ON e.initiative_id = ini.id AND e.user_id = g.user_id
           LEFT JOIN work_items wi
               ON wi.epic_id = e.id AND wi.user_id = g.user_id
           WHERE g.user_id    = $1
             AND g.status::text = 'active'
           GROUP BY g.id, g.title
           ORDER BY g.position ASC, g.created_at ASC"#,
        user_id,
    )
    .fetch_all(&state.db)
    .await?;

    let progress = rows
        .into_iter()
        .map(|r| {
            let completion_rate = if r.total_items == 0 {
                0.0_f64
            } else {
                r.done_items as f64 / r.total_items as f64
            };
            GoalProgress {
                goal_id: r.goal_id,
                title: r.title,
                completion_rate,
            }
        })
        .collect();

    Ok(progress)
}

/// Fetch time blocks that start on `date` (UTC), joining both the legacy
/// `tasks` table (via `task_id`) and the new `work_items` table (via
/// `work_item_id` added in 0003).
async fn fetch_sprint_time_blocks(
    state: &AppState,
    user_id: Uuid,
    date: NaiveDate,
) -> AppResult<Vec<SprintDashboardTimeBlock>> {
    let day_start = date.and_hms_opt(0, 0, 0).expect("valid time").and_utc();
    let day_end = date.and_hms_opt(23, 59, 59).expect("valid time").and_utc();

    let raw: Vec<RawSprintTimeBlock> = sqlx::query_as!(
        RawSprintTimeBlock,
        r#"SELECT
               tb.id,
               tb.title,
               tb.start_time,
               tb.end_time,
               tb.task_id,
               t.title          AS task_title,
               tb.work_item_id,
               wi.title         AS work_item_title,
               tb.color,
               SUM(fs.duration_seconds)::bigint AS actual_focus_seconds
           FROM time_blocks tb
           LEFT JOIN tasks t
               ON t.id = tb.task_id
           LEFT JOIN work_items wi
               ON wi.id = tb.work_item_id
           LEFT JOIN focus_sessions fs
               ON fs.time_block_id = tb.id
               AND fs.ended_at IS NOT NULL
           WHERE tb.user_id      = $1
             AND tb.start_time  >= $2
             AND tb.start_time  <= $3
           GROUP BY tb.id, tb.title, tb.start_time, tb.end_time,
                    tb.task_id, t.title,
                    tb.work_item_id, wi.title,
                    tb.color
           ORDER BY tb.start_time ASC"#,
        user_id,
        day_start,
        day_end,
    )
    .fetch_all(&state.db)
    .await?;

    let blocks = raw
        .into_iter()
        .map(|r| {
            let estimated_minutes = (r.end_time - r.start_time).num_minutes();
            let actual_focus_minutes = r.actual_focus_seconds.map(|s| s / 60);
            SprintDashboardTimeBlock {
                id: r.id,
                title: r.title,
                start_time: r.start_time,
                end_time: r.end_time,
                estimated_minutes,
                actual_focus_minutes,
                task_id: r.task_id,
                task_title: r.task_title,
                work_item_id: r.work_item_id,
                work_item_title: r.work_item_title,
                color: r.color,
            }
        })
        .collect();

    Ok(blocks)
}

/// Fetch work items that are past their `due_date` and not yet `done`,
/// capped at 50, ordered by `due_date ASC` (most overdue first).
async fn fetch_overdue_work_items(
    state: &AppState,
    user_id: Uuid,
) -> AppResult<Vec<WorkItemListItem>> {
    let now = Utc::now();

    let rows = sqlx::query_as!(
        WorkItemListItem,
        r#"SELECT
               wi.id,
               wi.epic_id,
               wi.sprint_id,
               wi.type::text                                             AS "type!",
               wi.title,
               wi.status::text                                           AS "status!",
               wi.priority::text                                         AS "priority!",
               wi.story_points,
               wi.due_date,
               wi.position,
               COUNT(sub.id)                                             AS "subtask_count!: i64",
               COUNT(sub.id) FILTER (WHERE sub.is_done = true)          AS "done_subtask_count!: i64",
               wi.created_at,
               wi.updated_at
           FROM work_items wi
           LEFT JOIN work_item_subtasks sub ON sub.work_item_id = wi.id
           WHERE wi.user_id        = $1
             AND wi.due_date      < $2
             AND wi.status::text  != 'done'
           GROUP BY wi.id
           ORDER BY wi.due_date ASC NULLS LAST
           LIMIT 50"#,
        user_id,
        now,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}
