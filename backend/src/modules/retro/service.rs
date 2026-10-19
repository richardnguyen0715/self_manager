//! Business logic for the `retro` module. Runtime `sqlx::query*` only; every
//! query is scoped to `user_id` (other users' ids surface as 404).

use chrono::{Datelike, Duration, Months, NaiveDate};
use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    state::AppState,
};

use super::{
    links,
    models::*,
    snapshot,
};

const MAX_NAME_LEN: usize = 120;
const MAX_TITLE_LEN: usize = 200;
const MAX_TEXT_LEN: usize = 20_000;
const MAX_NOTES_LEN: usize = 100_000;
const MAX_ACTION_LEN: usize = 500;
const MAX_SECTIONS: usize = 30;
const MAX_SECTION_KEY_LEN: usize = 40;
const MAX_PROMPT_LEN: usize = 1_000;
const MAX_DESCRIPTION_LEN: usize = 500;

const ACTION_COLS: &str =
    "id, retro_id, text, status, due_date, work_item_id, carried_from_action_id, carry_count, completed_at";
const ENTRY_COLS: &str = "id, section_id, position, body, rating, mood, checked";
const SECTION_COLS: &str = "id, position, key, title, prompt, input_type, auto_source";
const RECORD_COLS: &str = "template_id, period_start, period_end, scope_type, scope_id, status, \
     summary, notes, snapshot, started_at, created_at, updated_at";
const TEMPLATE_COLS: &str =
    "id, user_id, name, kind, description, is_builtin, created_at, updated_at";

/// SQL for the scope object's display label, keyed by `r.scope_type`.
const SCOPE_LABEL_SQL: &str = "CASE r.scope_type \
    WHEN 'sprint' THEN (SELECT s.name FROM sprints s WHERE s.id = r.scope_id) \
    WHEN 'project' THEN (SELECT p.name FROM projects p WHERE p.id = r.scope_id) \
    WHEN 'epic' THEN (SELECT e.title FROM epics e WHERE e.id = r.scope_id) \
    WHEN 'initiative' THEN (SELECT i.title FROM initiatives i WHERE i.id = r.scope_id) \
    WHEN 'goal' THEN (SELECT g.title FROM goals g WHERE g.id = r.scope_id) \
    WHEN 'work_item' THEN (SELECT w.title FROM work_items w WHERE w.id = r.scope_id) \
    WHEN 'habit' THEN (SELECT h.name FROM habits h WHERE h.id = r.scope_id) \
    END";

/// `RetroSummary` projection. Callers append a WHERE clause over alias `r`.
fn summary_select() -> String {
    format!(
        "SELECT r.id, r.kind, r.title, r.period_start, r.period_end, r.scope_type, r.scope_id, \
         {SCOPE_LABEL_SQL} AS scope_label, r.status, r.rating, r.mood, \
         (SELECT COUNT(*) FROM retro_entries e WHERE e.retro_id = r.id)::bigint AS entries_count, \
         (SELECT COUNT(*) FROM retro_links l WHERE l.retro_id = r.id)::bigint AS links_count, \
         (SELECT COUNT(*) FROM retro_actions a WHERE a.retro_id = r.id AND a.status = 'open')::bigint \
             AS open_actions, \
         r.completed_at \
         FROM retros r"
    )
}

// ── Validation helpers ───────────────────────────────────────────────────────

fn check_enum(field: &str, value: &str, allowed: &[&str]) -> AppResult<()> {
    if allowed.contains(&value) {
        Ok(())
    } else {
        Err(AppError::Validation(format!(
            "{field} must be one of: {}",
            allowed.join(", ")
        )))
    }
}

fn check_score(field: &str, value: Option<i16>) -> AppResult<()> {
    match value {
        Some(v) if !(1..=5).contains(&v) => Err(AppError::Validation(format!(
            "{field} must be between 1 and 5"
        ))),
        _ => Ok(()),
    }
}

fn clean_text(field: &str, raw: &str, max: usize, allow_empty: bool) -> AppResult<String> {
    let value = raw.trim();
    if value.is_empty() && !allow_empty {
        return Err(AppError::Validation(format!("{field} must not be empty")));
    }
    if value.chars().count() > max {
        return Err(AppError::Validation(format!(
            "{field} must not exceed {max} characters"
        )));
    }
    Ok(value.to_string())
}

fn clean_optional_text(field: &str, raw: Option<String>, max: usize) -> AppResult<Option<String>> {
    match raw {
        Some(s) => {
            let v = clean_text(field, &s, max, true)?;
            Ok(if v.is_empty() { None } else { Some(v) })
        }
        None => Ok(None),
    }
}

fn check_sections(inputs: &[SectionInput]) -> AppResult<()> {
    if inputs.is_empty() || inputs.len() > MAX_SECTIONS {
        return Err(AppError::Validation(format!(
            "sections must contain between 1 and {MAX_SECTIONS} items"
        )));
    }
    let mut seen = std::collections::HashSet::new();
    for s in inputs {
        let key = s.key.trim();
        let valid_key = !key.is_empty()
            && key.len() <= MAX_SECTION_KEY_LEN
            && key
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_');
        if !valid_key {
            return Err(AppError::Validation(
                "section key must be lowercase letters, digits or underscores (max 40)".into(),
            ));
        }
        if !seen.insert(key.to_string()) {
            return Err(AppError::Validation(format!("duplicate section key '{key}'")));
        }
        clean_text("section title", &s.title, MAX_NAME_LEN, false)?;
        if let Some(p) = &s.prompt {
            clean_text("section prompt", p, MAX_PROMPT_LEN, true)?;
        }
        check_enum("input_type", &s.input_type, INPUT_TYPES)?;
        match (s.input_type.as_str(), s.auto_source.as_deref()) {
            ("auto_metrics", Some(src)) => check_enum("auto_source", src, AUTO_SOURCES)?,
            ("auto_metrics", None) => {}
            (_, Some(_)) => {
                return Err(AppError::Validation(
                    "auto_source is only allowed for input_type auto_metrics".into(),
                ))
            }
            (_, None) => {}
        }
    }
    Ok(())
}

// ── Period rules ───────────────────────────────────────────────────────────────

/// Fixed period containing `date` for the calendar cadences. `None` for kinds
/// without a fixed period (sprint / project / custom).
pub fn period_for(kind: &str, date: NaiveDate) -> Option<(NaiveDate, NaiveDate)> {
    match kind {
        "daily" => Some((date, date)),
        "weekly" => {
            let start = date - Duration::days(date.weekday().num_days_from_monday() as i64);
            Some((start, start + Duration::days(6)))
        }
        "monthly" => {
            let start = date.with_day(1)?;
            let next = start.checked_add_months(Months::new(1))?;
            Some((start, next - Duration::days(1)))
        }
        "quarterly" => {
            let first_month = ((date.month() - 1) / 3) * 3 + 1;
            let start = NaiveDate::from_ymd_opt(date.year(), first_month, 1)?;
            let next = start.checked_add_months(Months::new(3))?;
            Some((start, next - Duration::days(1)))
        }
        "yearly" => Some((
            NaiveDate::from_ymd_opt(date.year(), 1, 1)?,
            NaiveDate::from_ymd_opt(date.year(), 12, 31)?,
        )),
        _ => None,
    }
}

fn kind_label(kind: &str) -> String {
    let mut chars = kind.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}

fn default_title(
    kind: &str,
    scope_type: &str,
    start: NaiveDate,
    scope_label: Option<&str>,
) -> String {
    if scope_type != "none" {
        return format!(
            "{} retro — {}",
            kind_label(kind),
            scope_label.unwrap_or("Untitled")
        );
    }
    match kind {
        "daily" => format!("Daily — {start}"),
        "weekly" => {
            let iso = start.iso_week();
            format!("Week {}, {}", iso.week(), iso.year())
        }
        "monthly" => start.format("%B %Y").to_string(),
        "quarterly" => format!("Q{} {}", (start.month() - 1) / 3 + 1, start.year()),
        "yearly" => start.year().to_string(),
        _ => format!("{} retro — {start}", kind_label(kind)),
    }
}

// ── Templates ──────────────────────────────────────────────────────────────────

async fn template_sections(state: &AppState, template_id: Uuid) -> AppResult<Vec<SectionDto>> {
    let rows = sqlx::query_as::<_, SectionDto>(&format!(
        "SELECT {SECTION_COLS} FROM retro_template_sections \
         WHERE template_id = $1 ORDER BY position, key"
    ))
    .bind(template_id)
    .fetch_all(&state.db)
    .await?;
    Ok(rows)
}

pub async fn list_templates(state: &AppState, user_id: Uuid) -> AppResult<Vec<TemplateDto>> {
    let rows = sqlx::query_as::<_, TemplateRow>(&format!(
        "SELECT {TEMPLATE_COLS} FROM retro_templates \
         WHERE user_id = $1 OR is_builtin \
         ORDER BY is_builtin DESC, kind, name"
    ))
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    let mut out = Vec::with_capacity(rows.len());
    for template in rows {
        let sections = template_sections(state, template.id).await?;
        out.push(TemplateDto { template, sections });
    }
    Ok(out)
}

async fn insert_sections(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    template_id: Uuid,
    inputs: &[SectionInput],
) -> AppResult<()> {
    for (pos, s) in inputs.iter().enumerate() {
        let auto_source = match (s.input_type.as_str(), s.auto_source.as_deref()) {
            ("auto_metrics", None) => Some("all".to_string()),
            ("auto_metrics", Some(src)) => Some(src.to_string()),
            _ => None,
        };
        let prompt = clean_optional_text("section prompt", s.prompt.clone(), MAX_PROMPT_LEN)?;
        sqlx::query(
            "INSERT INTO retro_template_sections \
             (template_id, position, key, title, prompt, input_type, auto_source) \
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(template_id)
        .bind(pos as i32)
        .bind(s.key.trim())
        .bind(s.title.trim())
        .bind(prompt)
        .bind(&s.input_type)
        .bind(auto_source)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

pub async fn create_template(
    state: &AppState,
    user_id: Uuid,
    req: CreateTemplateRequest,
) -> AppResult<TemplateDto> {
    let name = clean_text("name", &req.name, MAX_NAME_LEN, false)?;
    check_enum("kind", &req.kind, KINDS)?;
    let description = clean_optional_text("description", req.description, MAX_DESCRIPTION_LEN)?;
    check_sections(&req.sections)?;

    let mut tx = state.db.begin().await?;
    let template = sqlx::query_as::<_, TemplateRow>(&format!(
        "INSERT INTO retro_templates (user_id, name, kind, description, is_builtin) \
         VALUES ($1, $2, $3, $4, false) RETURNING {TEMPLATE_COLS}"
    ))
    .bind(user_id)
    .bind(&name)
    .bind(&req.kind)
    .bind(description)
    .fetch_one(&mut *tx)
    .await?;
    insert_sections(&mut tx, template.id, &req.sections).await?;
    tx.commit().await?;

    let sections = template_sections(state, template.id).await?;
    Ok(TemplateDto { template, sections })
}

pub async fn update_template(
    state: &AppState,
    user_id: Uuid,
    template_id: Uuid,
    req: UpdateTemplateRequest,
) -> AppResult<TemplateDto> {
    // Own templates only: built-ins have user_id NULL and fall through to 404.
    let existing = sqlx::query_as::<_, TemplateRow>(&format!(
        "SELECT {TEMPLATE_COLS} FROM retro_templates WHERE id = $1 AND user_id = $2"
    ))
    .bind(template_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let name = match req.name {
        Some(n) => clean_text("name", &n, MAX_NAME_LEN, false)?,
        None => existing.name.clone(),
    };
    let description = match req.description {
        Some(d) => clean_optional_text("description", d, MAX_DESCRIPTION_LEN)?,
        None => existing.description.clone(),
    };

    let mut tx = state.db.begin().await?;
    let template = sqlx::query_as::<_, TemplateRow>(&format!(
        "UPDATE retro_templates SET name = $1, description = $2, updated_at = now() \
         WHERE id = $3 RETURNING {TEMPLATE_COLS}"
    ))
    .bind(&name)
    .bind(&description)
    .bind(template_id)
    .fetch_one(&mut *tx)
    .await?;

    if let Some(sections) = &req.sections {
        check_sections(sections)?;
        sqlx::query("DELETE FROM retro_template_sections WHERE template_id = $1")
            .bind(template_id)
            .execute(&mut *tx)
            .await?;
        insert_sections(&mut tx, template_id, sections).await?;
    }
    tx.commit().await?;

    let sections = template_sections(state, template.id).await?;
    Ok(TemplateDto { template, sections })
}

pub async fn delete_template(state: &AppState, user_id: Uuid, template_id: Uuid) -> AppResult<()> {
    let result = sqlx::query("DELETE FROM retro_templates WHERE id = $1 AND user_id = $2")
        .bind(template_id)
        .bind(user_id)
        .execute(&state.db)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

// ── Retro records & detail ────────────────────────────────────────────────────

/// Owner-checked load of the `retros` row (404 otherwise).
pub async fn load_record(state: &AppState, user_id: Uuid, retro_id: Uuid) -> AppResult<RetroRecord> {
    sqlx::query_as::<_, RetroRecord>(&format!(
        "SELECT {RECORD_COLS} FROM retros WHERE id = $1 AND user_id = $2"
    ))
    .bind(retro_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)
}

pub async fn detail(state: &AppState, user_id: Uuid, retro_id: Uuid) -> AppResult<RetroDetail> {
    let rec = load_record(state, user_id, retro_id).await?;

    let summary = sqlx::query_as::<_, RetroSummary>(&format!(
        "{} WHERE r.id = $1 AND r.user_id = $2",
        summary_select()
    ))
    .bind(retro_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let sections = sqlx::query_as::<_, SectionDto>(&format!(
        "SELECT {SECTION_COLS} FROM retro_sections WHERE retro_id = $1 ORDER BY position, key"
    ))
    .bind(retro_id)
    .fetch_all(&state.db)
    .await?;

    let entries = sqlx::query_as::<_, EntryDto>(&format!(
        "SELECT {ENTRY_COLS} FROM retro_entries WHERE retro_id = $1 ORDER BY position, created_at"
    ))
    .bind(retro_id)
    .fetch_all(&state.db)
    .await?;

    let links = links::list_for_retro(state, user_id, retro_id).await?;

    let actions = list_actions_for_retro(state, retro_id).await?;

    Ok(RetroDetail {
        retro: RetroHead {
            summary,
            template_id: rec.template_id,
            summary_text: rec.summary,
            notes: rec.notes,
            snapshot: rec.snapshot,
            started_at: rec.started_at,
            created_at: rec.created_at,
            updated_at: rec.updated_at,
        },
        sections,
        entries,
        links,
        actions,
    })
}

async fn list_actions_for_retro(state: &AppState, retro_id: Uuid) -> AppResult<Vec<ActionDto>> {
    let rows = sqlx::query_as::<_, ActionDto>(&format!(
        "SELECT {ACTION_COLS} FROM retro_actions WHERE retro_id = $1 ORDER BY position, created_at"
    ))
    .bind(retro_id)
    .fetch_all(&state.db)
    .await?;
    Ok(rows)
}

pub async fn list(
    state: &AppState,
    user_id: Uuid,
    q: ListRetrosQuery,
) -> AppResult<RetroPage> {
    if let Some(k) = &q.kind {
        check_enum("kind", k, KINDS)?;
    }
    if let Some(s) = &q.scope_type {
        check_enum("scope_type", s, SCOPE_TYPES)?;
    }
    if let Some(s) = &q.status {
        check_enum("status", s, RETRO_STATUSES)?;
    }
    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let offset = q.offset.unwrap_or(0).max(0);

    const FILTER: &str = "WHERE r.user_id = $1 \
        AND ($2::text IS NULL OR r.kind = $2) \
        AND ($3::text IS NULL OR r.scope_type = $3) \
        AND ($4::uuid IS NULL OR r.scope_id = $4) \
        AND ($5::text IS NULL OR r.status = $5) \
        AND ($6::date IS NULL OR r.period_start >= $6) \
        AND ($7::date IS NULL OR r.period_start <= $7)";

    let data = sqlx::query_as::<_, RetroSummary>(&format!(
        "{} {FILTER} ORDER BY r.period_start DESC, r.created_at DESC LIMIT $8 OFFSET $9",
        summary_select()
    ))
    .bind(user_id)
    .bind(&q.kind)
    .bind(&q.scope_type)
    .bind(q.scope_id)
    .bind(&q.status)
    .bind(q.from)
    .bind(q.to)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let total: i64 = sqlx::query_scalar(&format!(
        "SELECT COUNT(*)::bigint FROM retros r {FILTER}"
    ))
    .bind(user_id)
    .bind(&q.kind)
    .bind(&q.scope_type)
    .bind(q.scope_id)
    .bind(&q.status)
    .bind(q.from)
    .bind(q.to)
    .fetch_one(&state.db)
    .await?;

    Ok(RetroPage { data, total })
}

pub async fn by_target(
    state: &AppState,
    user_id: Uuid,
    q: ByTargetQuery,
) -> AppResult<Vec<RetroSummary>> {
    check_enum("target_type", &q.target_type, TARGET_TYPES)?;
    let rows = sqlx::query_as::<_, RetroSummary>(&format!(
        "{} WHERE r.user_id = $1 AND (\
            EXISTS (SELECT 1 FROM retro_links l \
                    WHERE l.retro_id = r.id AND l.target_type = $2 AND l.target_id = $3) \
            OR (r.scope_type = $2 AND r.scope_id = $3)) \
         ORDER BY r.period_start DESC, r.created_at DESC",
        summary_select()
    ))
    .bind(user_id)
    .bind(&q.target_type)
    .bind(q.target_id)
    .fetch_all(&state.db)
    .await?;
    Ok(rows)
}

pub async fn trends(state: &AppState, user_id: Uuid, q: TrendsQuery) -> AppResult<Vec<TrendPoint>> {
    if let Some(k) = &q.kind {
        check_enum("kind", k, KINDS)?;
    }
    let kind = q.kind.unwrap_or_else(|| "weekly".to_string());
    let limit = q.limit.unwrap_or(12).clamp(1, 100);

    let rows = sqlx::query_as::<_, TrendPoint>(
        "SELECT * FROM ( \
            SELECT r.id AS retro_id, r.period_start, r.title, r.rating, r.mood, \
                   (r.snapshot #>> '{completed_items,count}')::float8 AS completed_items, \
                   (r.snapshot #>> '{completed_items,points}')::float8 AS completed_points, \
                   (r.snapshot #>> '{habits,rate}')::float8 AS habit_rate, \
                   (r.snapshot #>> '{focus,minutes}')::float8 AS focus_minutes, \
                   r.created_at \
            FROM retros r \
            WHERE r.user_id = $1 AND r.kind = $2 \
            ORDER BY r.period_start DESC, r.created_at DESC \
            LIMIT $3 \
         ) recent ORDER BY period_start ASC, created_at ASC",
    )
    .bind(user_id)
    .bind(kind)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;
    Ok(rows)
}

pub async fn list_actions(
    state: &AppState,
    user_id: Uuid,
    q: ActionsQuery,
) -> AppResult<Vec<ActionWithRetro>> {
    let status = q.status.unwrap_or_else(|| "open".to_string());
    let filter: Option<String> = if status == "all" {
        None
    } else {
        check_enum("status", &status, ACTION_STATUSES)?;
        Some(status)
    };

    // An action that already has a carried successor is superseded: only the
    // newest link of each carry chain is listed.
    let rows = sqlx::query_as::<_, ActionWithRetro>(
        "SELECT a.id, a.retro_id, a.text, a.status, a.due_date, a.work_item_id, \
                a.carried_from_action_id, a.carry_count, a.completed_at, \
                r.title AS retro_title, r.kind AS retro_kind, r.period_start AS retro_period_start \
         FROM retro_actions a JOIN retros r ON r.id = a.retro_id \
         WHERE a.user_id = $1 AND ($2::text IS NULL OR a.status = $2) \
           AND NOT EXISTS (SELECT 1 FROM retro_actions n WHERE n.carried_from_action_id = a.id) \
         ORDER BY a.due_date NULLS LAST, a.created_at",
    )
    .bind(user_id)
    .bind(filter)
    .fetch_all(&state.db)
    .await?;
    Ok(rows)
}

/// Idempotent open: returns the existing retro for (kind, period, scope) or
/// creates it from the template, with carry-over, scope link and snapshot.
pub async fn open(state: &AppState, user_id: Uuid, req: OpenRetroRequest) -> AppResult<RetroDetail> {
    check_enum("kind", &req.kind, KINDS)?;
    let scope_type = req.scope_type.clone().unwrap_or_else(|| "none".to_string());
    check_enum("scope_type", &scope_type, SCOPE_TYPES)?;
    match (scope_type.as_str(), req.scope_id) {
        ("none", Some(_)) => {
            return Err(AppError::Validation(
                "scope_id requires a scope_type".into(),
            ))
        }
        ("none", None) => {}
        (_, None) => {
            return Err(AppError::Validation(
                "scope_id is required when scope_type is set".into(),
            ))
        }
        _ => {}
    }

    let tz = snapshot::user_tz(state, user_id).await?;
    let date = match req.date {
        Some(d) => d,
        None => snapshot::today_in(state, &tz).await?,
    };

    // Scope object: must exist and belong to the user.
    let scope_label = match req.scope_id {
        Some(sid) => {
            let found = links::lookup(state, user_id, &scope_type, sid)
                .await?
                .ok_or_else(|| AppError::NotFoundMsg("scope not found".into()))?;
            found.title
        }
        None => None,
    };

    let (start, end) = if scope_type == "sprint" {
        let sid = req.scope_id.unwrap_or_default();
        let dates: Option<(NaiveDate, NaiveDate)> = sqlx::query_as(
            "SELECT start_date, end_date FROM sprints WHERE id = $1 AND user_id = $2",
        )
        .bind(sid)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?;
        dates.ok_or(AppError::NotFound)?
    } else if let Some(p) = period_for(&req.kind, date) {
        p
    } else {
        let end = req.period_end.unwrap_or(date);
        if end < date {
            return Err(AppError::Validation(
                "period_end must not be before the date".into(),
            ));
        }
        (date, end)
    };

    if let Some(id) = find_existing(state, user_id, &req.kind, start, &scope_type, req.scope_id).await? {
        return detail(state, user_id, id).await;
    }

    let template_id: Option<Uuid> = match req.template_id {
        Some(tid) => {
            let ok: Option<Uuid> = sqlx::query_scalar(
                "SELECT id FROM retro_templates WHERE id = $1 AND (user_id = $2 OR is_builtin)",
            )
            .bind(tid)
            .bind(user_id)
            .fetch_optional(&state.db)
            .await?;
            Some(ok.ok_or(AppError::NotFoundMsg("template not found".into()))?)
        }
        None => {
            sqlx::query_scalar(
                "SELECT id FROM retro_templates WHERE is_builtin AND kind = $1 ORDER BY name LIMIT 1",
            )
            .bind(&req.kind)
            .fetch_optional(&state.db)
            .await?
        }
    };

    let title = match req.title {
        Some(t) => clean_text("title", &t, MAX_TITLE_LEN, false)?,
        None => default_title(&req.kind, &scope_type, start, scope_label.as_deref()),
    };

    let snapshot = snapshot::compute(state, user_id, start, end, &scope_type, req.scope_id).await?;

    let mut tx = state.db.begin().await?;
    let new_id: Option<Uuid> = sqlx::query_scalar(
        "INSERT INTO retros (user_id, template_id, kind, title, period_start, period_end, \
                             scope_type, scope_id, snapshot) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) \
         ON CONFLICT DO NOTHING RETURNING id",
    )
    .bind(user_id)
    .bind(template_id)
    .bind(&req.kind)
    .bind(&title)
    .bind(start)
    .bind(end)
    .bind(&scope_type)
    .bind(req.scope_id)
    .bind(&snapshot)
    .fetch_optional(&mut *tx)
    .await?;

    let Some(retro_id) = new_id else {
        // Lost a race with a concurrent open: return the row that won.
        tx.rollback().await?;
        let id = find_existing(state, user_id, &req.kind, start, &scope_type, req.scope_id)
            .await?
            .ok_or(AppError::Internal)?;
        return detail(state, user_id, id).await;
    };

    if let Some(tid) = template_id {
        sqlx::query(
            "INSERT INTO retro_sections \
             (retro_id, position, key, title, prompt, input_type, auto_source) \
             SELECT $1, position, key, title, prompt, input_type, auto_source \
             FROM retro_template_sections WHERE template_id = $2 ORDER BY position",
        )
        .bind(retro_id)
        .bind(tid)
        .execute(&mut *tx)
        .await?;
    }

    // Free-text sections always have their single entry ready to edit.
    sqlx::query(
        "INSERT INTO retro_entries (retro_id, section_id, position, body) \
         SELECT $1, s.id, 0, '' FROM retro_sections s \
         WHERE s.retro_id = $1 AND s.input_type = 'text'",
    )
    .bind(retro_id)
    .execute(&mut *tx)
    .await?;

    if scope_type != "none" {
        sqlx::query(
            "INSERT INTO retro_links (retro_id, target_type, target_id, relation) \
             VALUES ($1, $2, $3, 'about') ON CONFLICT DO NOTHING",
        )
        .bind(retro_id)
        .bind(&scope_type)
        .bind(req.scope_id)
        .execute(&mut *tx)
        .await?;
    }

    // Carry open actions from the previous retro of the same kind + scope.
    let previous: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM retros \
         WHERE user_id = $1 AND kind = $2 AND scope_type = $3 \
           AND scope_id IS NOT DISTINCT FROM $4 AND period_start < $5 AND id <> $6 \
         ORDER BY period_start DESC LIMIT 1",
    )
    .bind(user_id)
    .bind(&req.kind)
    .bind(&scope_type)
    .bind(req.scope_id)
    .bind(start)
    .bind(retro_id)
    .fetch_optional(&mut *tx)
    .await?;

    if let Some(prev) = previous {
        sqlx::query(
            "INSERT INTO retro_actions \
             (retro_id, user_id, text, status, due_date, carried_from_action_id, carry_count, position) \
             SELECT $1, a.user_id, a.text, 'open', a.due_date, a.id, a.carry_count + 1, a.position \
             FROM retro_actions a \
             WHERE a.retro_id = $2 AND a.status = 'open' \
             ORDER BY a.position, a.created_at",
        )
        .bind(retro_id)
        .bind(prev)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    detail(state, user_id, retro_id).await
}

async fn find_existing(
    state: &AppState,
    user_id: Uuid,
    kind: &str,
    period_start: NaiveDate,
    scope_type: &str,
    scope_id: Option<Uuid>,
) -> AppResult<Option<Uuid>> {
    let id = sqlx::query_scalar(
        "SELECT id FROM retros \
         WHERE user_id = $1 AND kind = $2 AND period_start = $3 AND scope_type = $4 \
           AND scope_id IS NOT DISTINCT FROM $5",
    )
    .bind(user_id)
    .bind(kind)
    .bind(period_start)
    .bind(scope_type)
    .bind(scope_id)
    .fetch_optional(&state.db)
    .await?;
    Ok(id)
}

pub async fn update(
    state: &AppState,
    user_id: Uuid,
    retro_id: Uuid,
    req: PatchRetroRequest,
) -> AppResult<RetroDetail> {
    let title = match &req.title {
        Some(t) => Some(clean_text("title", t, MAX_TITLE_LEN, false)?),
        None => None,
    };
    let (summary_set, summary_val) = match req.summary {
        Some(s) => (true, clean_optional_text("summary", s, MAX_TEXT_LEN)?),
        None => (false, None),
    };
    let (rating_set, rating_val) = match req.rating {
        Some(r) => {
            check_score("rating", r)?;
            (true, r)
        }
        None => (false, None),
    };
    let (mood_set, mood_val) = match req.mood {
        Some(m) => {
            check_score("mood", m)?;
            (true, m)
        }
        None => (false, None),
    };

    let (notes_set, notes_val) = match req.notes {
        Some(n) => (true, clean_optional_text("notes", n, MAX_NOTES_LEN)?),
        None => (false, None),
    };

    let result = sqlx::query(
        "UPDATE retros SET \
            title = COALESCE($3::text, title), \
            summary = CASE WHEN $4::bool THEN $5::text ELSE summary END, \
            rating = CASE WHEN $6::bool THEN $7::smallint ELSE rating END, \
            mood = CASE WHEN $8::bool THEN $9::smallint ELSE mood END, \
            notes = CASE WHEN $10::bool THEN $11::text ELSE notes END, \
            updated_at = now() \
         WHERE id = $1 AND user_id = $2",
    )
    .bind(retro_id)
    .bind(user_id)
    .bind(title)
    .bind(summary_set)
    .bind(summary_val)
    .bind(rating_set)
    .bind(rating_val)
    .bind(mood_set)
    .bind(mood_val)
    .bind(notes_set)
    .bind(notes_val)
    .execute(&state.db)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    detail(state, user_id, retro_id).await
}

pub async fn delete(state: &AppState, user_id: Uuid, retro_id: Uuid) -> AppResult<()> {
    let result = sqlx::query("DELETE FROM retros WHERE id = $1 AND user_id = $2")
        .bind(retro_id)
        .bind(user_id)
        .execute(&state.db)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

async fn store_snapshot(
    state: &AppState,
    user_id: Uuid,
    rec: &RetroRecord,
) -> AppResult<serde_json::Value> {
    snapshot::compute(
        state,
        user_id,
        rec.period_start,
        rec.period_end,
        &rec.scope_type,
        rec.scope_id,
    )
    .await
}

pub async fn refresh_snapshot(state: &AppState, user_id: Uuid, retro_id: Uuid) -> AppResult<RetroDetail> {
    let rec = load_record(state, user_id, retro_id).await?;
    if rec.status == "completed" {
        return Err(AppError::Conflict(
            "retro is completed; reopen it to refresh the snapshot".into(),
        ));
    }
    let snap = store_snapshot(state, user_id, &rec).await?;
    sqlx::query("UPDATE retros SET snapshot = $1, updated_at = now() WHERE id = $2")
        .bind(&snap)
        .bind(retro_id)
        .execute(&state.db)
        .await?;
    detail(state, user_id, retro_id).await
}

pub async fn complete(state: &AppState, user_id: Uuid, retro_id: Uuid) -> AppResult<RetroDetail> {
    let rec = load_record(state, user_id, retro_id).await?;
    if rec.status == "completed" {
        return detail(state, user_id, retro_id).await;
    }
    let snap = store_snapshot(state, user_id, &rec).await?;
    sqlx::query(
        "UPDATE retros SET status = 'completed', completed_at = now(), snapshot = $1, \
         updated_at = now() WHERE id = $2",
    )
    .bind(&snap)
    .bind(retro_id)
    .execute(&state.db)
    .await?;
    detail(state, user_id, retro_id).await
}

pub async fn reopen(state: &AppState, user_id: Uuid, retro_id: Uuid) -> AppResult<RetroDetail> {
    let rec = load_record(state, user_id, retro_id).await?;
    if rec.status == "draft" {
        return detail(state, user_id, retro_id).await;
    }
    sqlx::query(
        "UPDATE retros SET status = 'draft', completed_at = NULL, updated_at = now() WHERE id = $1",
    )
    .bind(retro_id)
    .execute(&state.db)
    .await?;
    detail(state, user_id, retro_id).await
}

// ── Entries ───────────────────────────────────────────────────────────────────

pub async fn create_entry(
    state: &AppState,
    user_id: Uuid,
    retro_id: Uuid,
    req: CreateEntryRequest,
) -> AppResult<EntryDto> {
    load_record(state, user_id, retro_id).await?;

    let in_retro: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM retro_sections WHERE id = $1 AND retro_id = $2",
    )
    .bind(req.section_id)
    .bind(retro_id)
    .fetch_optional(&state.db)
    .await?;
    if in_retro.is_none() {
        return Err(AppError::NotFoundMsg("section not found in this retro".into()));
    }

    let body = match req.body {
        Some(b) => clean_text("body", &b, MAX_TEXT_LEN, true)?,
        None => String::new(),
    };
    check_score("rating", req.rating)?;
    check_score("mood", req.mood)?;

    let position = match req.position {
        Some(p) => p,
        None => sqlx::query_scalar(
            "SELECT (COALESCE(MAX(position), -1) + 1)::int FROM retro_entries WHERE section_id = $1",
        )
        .bind(req.section_id)
        .fetch_one(&state.db)
        .await?,
    };

    let entry = sqlx::query_as::<_, EntryDto>(&format!(
        "INSERT INTO retro_entries (retro_id, section_id, position, body, rating, mood, checked) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING {ENTRY_COLS}"
    ))
    .bind(retro_id)
    .bind(req.section_id)
    .bind(position)
    .bind(body)
    .bind(req.rating)
    .bind(req.mood)
    .bind(req.checked.unwrap_or(false))
    .fetch_one(&state.db)
    .await?;
    Ok(entry)
}

pub async fn update_entry(
    state: &AppState,
    user_id: Uuid,
    entry_id: Uuid,
    req: PatchEntryRequest,
) -> AppResult<EntryDto> {
    let body = match req.body {
        Some(b) => Some(clean_text("body", &b, MAX_TEXT_LEN, true)?),
        None => None,
    };
    let (rating_set, rating_val) = match req.rating {
        Some(r) => {
            check_score("rating", r)?;
            (true, r)
        }
        None => (false, None),
    };
    let (mood_set, mood_val) = match req.mood {
        Some(m) => {
            check_score("mood", m)?;
            (true, m)
        }
        None => (false, None),
    };

    sqlx::query_as::<_, EntryDto>(
        "UPDATE retro_entries e SET \
            body = COALESCE($3::text, e.body), \
            rating = CASE WHEN $4::bool THEN $5::smallint ELSE e.rating END, \
            mood = CASE WHEN $6::bool THEN $7::smallint ELSE e.mood END, \
            checked = COALESCE($8::bool, e.checked), \
            position = COALESCE($9::int, e.position), \
            updated_at = now() \
         FROM retros r \
         WHERE e.id = $1 AND r.id = e.retro_id AND r.user_id = $2 \
         RETURNING e.id, e.section_id, e.position, e.body, e.rating, e.mood, e.checked",
    )
    .bind(entry_id)
    .bind(user_id)
    .bind(body)
    .bind(rating_set)
    .bind(rating_val)
    .bind(mood_set)
    .bind(mood_val)
    .bind(req.checked)
    .bind(req.position)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)
}

pub async fn delete_entry(state: &AppState, user_id: Uuid, entry_id: Uuid) -> AppResult<()> {
    let result = sqlx::query(
        "DELETE FROM retro_entries e USING retros r \
         WHERE e.id = $1 AND r.id = e.retro_id AND r.user_id = $2",
    )
    .bind(entry_id)
    .bind(user_id)
    .execute(&state.db)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

// ── Actions ───────────────────────────────────────────────────────────────────

pub async fn create_action(
    state: &AppState,
    user_id: Uuid,
    retro_id: Uuid,
    req: CreateActionRequest,
) -> AppResult<ActionDto> {
    load_record(state, user_id, retro_id).await?;
    let text = clean_text("text", &req.text, MAX_ACTION_LEN, false)?;

    let action = sqlx::query_as::<_, ActionDto>(&format!(
        "INSERT INTO retro_actions (retro_id, user_id, text, status, due_date, position) \
         VALUES ($1, $2, $3, 'open', $4, \
                 (SELECT COALESCE(MAX(position), -1) + 1 FROM retro_actions WHERE retro_id = $1)) \
         RETURNING {ACTION_COLS}"
    ))
    .bind(retro_id)
    .bind(user_id)
    .bind(text)
    .bind(req.due_date)
    .fetch_one(&state.db)
    .await?;
    Ok(action)
}

pub async fn update_action(
    state: &AppState,
    user_id: Uuid,
    action_id: Uuid,
    req: PatchActionRequest,
) -> AppResult<ActionDto> {
    let text = match req.text {
        Some(t) => Some(clean_text("text", &t, MAX_ACTION_LEN, false)?),
        None => None,
    };
    if let Some(s) = &req.status {
        check_enum("status", s, ACTION_STATUSES)?;
    }
    let (due_set, due_val) = match req.due_date {
        Some(d) => (true, d),
        None => (false, None),
    };

    sqlx::query_as::<_, ActionDto>(&format!(
        "UPDATE retro_actions a SET \
            text = COALESCE($3::text, a.text), \
            status = COALESCE($4::text, a.status), \
            due_date = CASE WHEN $5::bool THEN $6::date ELSE a.due_date END, \
            completed_at = CASE \
                WHEN $4::text = 'done' THEN COALESCE(a.completed_at, now()) \
                WHEN $4::text = 'open' THEN NULL \
                ELSE a.completed_at END, \
            updated_at = now() \
         WHERE a.id = $1 AND a.user_id = $2 \
         RETURNING {ACTION_COLS}"
    ))
    .bind(action_id)
    .bind(user_id)
    .bind(text)
    .bind(req.status)
    .bind(due_set)
    .bind(due_val)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)
}

pub async fn delete_action(state: &AppState, user_id: Uuid, action_id: Uuid) -> AppResult<()> {
    let result = sqlx::query("DELETE FROM retro_actions WHERE id = $1 AND user_id = $2")
        .bind(action_id)
        .bind(user_id)
        .execute(&state.db)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

/// Turn an action into a work item (task, backlog). Idempotent: an already
/// converted action returns unchanged.
pub async fn convert_action(state: &AppState, user_id: Uuid, action_id: Uuid) -> AppResult<ActionDto> {
    let action = sqlx::query_as::<_, ActionDto>(&format!(
        "SELECT {ACTION_COLS} FROM retro_actions WHERE id = $1 AND user_id = $2"
    ))
    .bind(action_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    if action.work_item_id.is_some() {
        return Ok(action);
    }

    let retro_id = action.retro_id;
    let rec = load_record(state, user_id, retro_id).await?;
    let project_id = if rec.scope_type == "project" {
        rec.scope_id
    } else {
        None
    };

    let mut tx = state.db.begin().await?;
    // Same advisory lock + sequence rule as the work_item module (MML-12 keys).
    sqlx::query(
        "SELECT pg_advisory_xact_lock(hashtext($1::uuid::text || ':' || COALESCE($2::uuid::text, '')))",
    )
    .bind(user_id)
    .bind(project_id)
    .execute(&mut *tx)
    .await?;
    let seq_id: i32 = sqlx::query_scalar(
        "SELECT (COALESCE(MAX(seq_id), 0) + 1)::int FROM work_items \
         WHERE user_id = $1 AND project_id IS NOT DISTINCT FROM $2",
    )
    .bind(user_id)
    .bind(project_id)
    .fetch_one(&mut *tx)
    .await?;

    let work_item_id: Uuid = sqlx::query_scalar(
        "INSERT INTO work_items (user_id, project_id, type, title, status, due_date, seq_id) \
         VALUES ($1, $2, 'task'::work_item_type, $3, 'backlog'::work_item_status, \
                 $4::date::timestamptz, $5) \
         RETURNING id",
    )
    .bind(user_id)
    .bind(project_id)
    .bind(&action.text)
    .bind(action.due_date)
    .bind(seq_id)
    .fetch_one(&mut *tx)
    .await?;

    let updated = sqlx::query_as::<_, ActionDto>(&format!(
        "UPDATE retro_actions SET work_item_id = $1, updated_at = now() \
         WHERE id = $2 RETURNING {ACTION_COLS}"
    ))
    .bind(work_item_id)
    .bind(action_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(updated)
}
