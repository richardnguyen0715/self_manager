//! Business logic for the `custom_property` module.
//!
//! Uses runtime `sqlx::query*` (no compile-time macros). Every query is scoped
//! to `user_id`; projects and work items must belong to the user (and not be
//! soft-deleted), otherwise the call returns 404. Option removals on PATCH clean
//! up stored values in the same transaction.

use std::collections::HashSet;

use chrono::NaiveDate;
use serde_json::Value;
use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    state::AppState,
};

use super::models::{
    CreatePropertyRequest, CustomProperty, CustomPropertyRow, OptionInput, ProjectPropertyValue,
    PropertyOption, PropertyValueResponse, UpdatePropertyRequest, WorkItemPropertyValue,
    MAX_NAME_LEN, MAX_OPTION_ID_LEN, MAX_OPTION_LABEL_LEN, MAX_PROPERTIES_PER_PROJECT,
    MAX_TEXT_LEN, PROPERTY_TYPES,
};

const SELECT_COLS: &str = "id, project_id, name, type, options, position, created_at, updated_at";

/// Postgres SQLSTATE for unique_violation.
const UNIQUE_VIOLATION: &str = "23505";

// ── Validation helpers ──────────────────────────────────────────────────────

fn clean_name(raw: &str) -> AppResult<String> {
    let name = raw.trim();
    if name.is_empty() {
        return Err(AppError::Validation("name must not be empty".into()));
    }
    if name.chars().count() > MAX_NAME_LEN {
        return Err(AppError::Validation(format!(
            "name must not exceed {MAX_NAME_LEN} characters"
        )));
    }
    Ok(name.to_string())
}

fn validate_kind(kind: &str) -> AppResult<()> {
    if PROPERTY_TYPES.contains(&kind) {
        Ok(())
    } else {
        Err(AppError::Validation(format!(
            "type must be one of: {}",
            PROPERTY_TYPES.join(", ")
        )))
    }
}

fn is_select_kind(kind: &str) -> bool {
    matches!(kind, "select" | "multi_select")
}

fn clean_color(raw: &str) -> AppResult<String> {
    let c = raw.trim();
    let valid =
        c.len() == 7 && c.starts_with('#') && c[1..].chars().all(|ch| ch.is_ascii_hexdigit());
    if !valid {
        return Err(AppError::Validation(
            "option color must be a hex colour like #3b82f6".into(),
        ));
    }
    Ok(c.to_ascii_lowercase())
}

fn clean_option_label(raw: &str) -> AppResult<String> {
    let label = raw.trim();
    if label.is_empty() {
        return Err(AppError::Validation(
            "option label must not be empty".into(),
        ));
    }
    if label.chars().count() > MAX_OPTION_LABEL_LEN {
        return Err(AppError::Validation(format!(
            "option label must not exceed {MAX_OPTION_LABEL_LEN} characters"
        )));
    }
    Ok(label.to_string())
}

/// Short random option id (8 hex chars) that does not collide with `taken`.
fn generate_option_id(taken: &mut HashSet<String>) -> String {
    loop {
        let id = Uuid::new_v4().simple().to_string()[..8].to_string();
        if taken.insert(id.clone()) {
            return id;
        }
    }
}

/// Validates the option list for a property of `kind`. `select` /
/// `multi_select` need at least one option with unique ids; other types take
/// no options. Missing ids are generated.
fn build_options(kind: &str, inputs: Vec<OptionInput>) -> AppResult<Vec<PropertyOption>> {
    if !is_select_kind(kind) {
        if inputs.is_empty() {
            return Ok(Vec::new());
        }
        return Err(AppError::Validation(
            "options are only allowed for select and multi_select properties".into(),
        ));
    }
    if inputs.is_empty() {
        return Err(AppError::Validation(
            "select and multi_select properties need at least one option".into(),
        ));
    }

    // Explicit ids first, so generated ids never collide with them.
    let mut taken: HashSet<String> = HashSet::new();
    let mut explicit_ids: Vec<Option<String>> = Vec::with_capacity(inputs.len());
    for input in &inputs {
        match input.id.as_deref().map(str::trim) {
            Some(id) if !id.is_empty() => {
                if id.chars().count() > MAX_OPTION_ID_LEN {
                    return Err(AppError::Validation(format!(
                        "option id must not exceed {MAX_OPTION_ID_LEN} characters"
                    )));
                }
                if !taken.insert(id.to_string()) {
                    return Err(AppError::Validation(format!(
                        "option id '{id}' is used more than once"
                    )));
                }
                explicit_ids.push(Some(id.to_string()));
            }
            _ => explicit_ids.push(None),
        }
    }

    let mut out = Vec::with_capacity(inputs.len());
    for (input, id) in inputs.iter().zip(explicit_ids) {
        let label = clean_option_label(&input.label)?;
        let color = match input.color.as_deref() {
            Some(c) => Some(clean_color(c)?),
            None => None,
        };
        let id = id.unwrap_or_else(|| generate_option_id(&mut taken));
        out.push(PropertyOption { id, label, color });
    }
    Ok(out)
}

/// Maps a unique-index violation to a 409 with a friendly message.
fn map_unique(err: sqlx::Error) -> AppError {
    if let sqlx::Error::Database(ref db) = err {
        if db.code().as_deref() == Some(UNIQUE_VIOLATION) {
            return AppError::Conflict("a property with that name already exists".into());
        }
    }
    AppError::Db(err)
}

/// Checks a value against the property's type (and options for select types).
fn validate_value(prop: &CustomProperty, value: &Value) -> AppResult<()> {
    let fail = |expected: &str| {
        AppError::Validation(format!(
            "value for property '{}' must be {expected}",
            prop.name
        ))
    };
    match prop.kind.as_str() {
        "text" => {
            let s = value.as_str().ok_or_else(|| fail("a string"))?;
            if s.chars().count() > MAX_TEXT_LEN {
                return Err(AppError::Validation(format!(
                    "value for property '{}' must not exceed {MAX_TEXT_LEN} characters",
                    prop.name
                )));
            }
        }
        "number" => {
            // serde_json numbers are always finite (no NaN / Infinity in JSON).
            if !value.is_number() {
                return Err(fail("a number"));
            }
        }
        "select" => {
            let id = value.as_str().ok_or_else(|| fail("an option id"))?;
            if !prop.options.iter().any(|o| o.id == id) {
                return Err(AppError::Validation(format!(
                    "'{id}' is not an option of property '{}'",
                    prop.name
                )));
            }
        }
        "multi_select" => {
            let ids = value
                .as_array()
                .ok_or_else(|| fail("an array of option ids"))?;
            let mut seen = HashSet::new();
            for v in ids {
                let id = v.as_str().ok_or_else(|| fail("an array of option ids"))?;
                if !prop.options.iter().any(|o| o.id == id) {
                    return Err(AppError::Validation(format!(
                        "'{id}' is not an option of property '{}'",
                        prop.name
                    )));
                }
                if !seen.insert(id) {
                    return Err(AppError::Validation(format!(
                        "option '{id}' is selected more than once"
                    )));
                }
            }
        }
        "date" => {
            let s = value.as_str().ok_or_else(|| fail("a date as YYYY-MM-DD"))?;
            let ok = s.len() == 10 && NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok();
            if !ok {
                return Err(fail("a date as YYYY-MM-DD"));
            }
        }
        "checkbox" => {
            if !value.is_boolean() {
                return Err(fail("a boolean"));
            }
        }
        "url" => {
            let s = value.as_str().ok_or_else(|| fail("a URL string"))?;
            let ok = (s.starts_with("http://") || s.starts_with("https://"))
                && s.chars().count() <= MAX_TEXT_LEN;
            if !ok {
                return Err(fail(
                    "an http:// or https:// URL of at most 2000 characters",
                ));
            }
        }
        other => {
            return Err(AppError::Validation(format!(
                "unknown property type '{other}'"
            )))
        }
    }
    Ok(())
}

// ── Ownership lookups ──────────────────────────────────────────────────────────

async fn assert_project_owned(state: &AppState, user_id: Uuid, project_id: Uuid) -> AppResult<()> {
    let row: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM projects WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL",
    )
    .bind(project_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?;
    row.map(|_| ()).ok_or(AppError::NotFound)
}

/// Returns the work item's `project_id` (may be NULL) after checking ownership.
async fn work_item_project(
    state: &AppState,
    user_id: Uuid,
    work_item_id: Uuid,
) -> AppResult<Option<Uuid>> {
    let row: Option<(Option<Uuid>,)> = sqlx::query_as(
        "SELECT project_id FROM work_items \
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL",
    )
    .bind(work_item_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?;
    row.map(|(p,)| p).ok_or(AppError::NotFound)
}

async fn get_property(state: &AppState, user_id: Uuid, id: Uuid) -> AppResult<CustomProperty> {
    let sql = format!("SELECT {SELECT_COLS} FROM custom_properties WHERE id = $1 AND user_id = $2");
    sqlx::query_as::<_, CustomPropertyRow>(&sql)
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
        .map(CustomProperty::from)
        .ok_or(AppError::NotFound)
}

// ── Property definitions ───────────────────────────────────────────────────────

pub async fn list_properties(
    state: &AppState,
    user_id: Uuid,
    project_id: Uuid,
) -> AppResult<Vec<CustomProperty>> {
    assert_project_owned(state, user_id, project_id).await?;
    let sql = format!(
        "SELECT {SELECT_COLS} FROM custom_properties \
         WHERE project_id = $1 AND user_id = $2 \
         ORDER BY position ASC, created_at ASC"
    );
    let rows = sqlx::query_as::<_, CustomPropertyRow>(&sql)
        .bind(project_id)
        .bind(user_id)
        .fetch_all(&state.db)
        .await?;
    Ok(rows.into_iter().map(CustomProperty::from).collect())
}

pub async fn create_property(
    state: &AppState,
    user_id: Uuid,
    req: CreatePropertyRequest,
) -> AppResult<CustomProperty> {
    let name = clean_name(&req.name)?;
    validate_kind(&req.kind)?;
    let options = build_options(&req.kind, req.options.unwrap_or_default())?;
    assert_project_owned(state, user_id, req.project_id).await?;

    let (count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM custom_properties WHERE project_id = $1")
            .bind(req.project_id)
            .fetch_one(&state.db)
            .await?;
    if count >= MAX_PROPERTIES_PER_PROJECT {
        return Err(AppError::Validation(format!(
            "a project can have at most {MAX_PROPERTIES_PER_PROJECT} custom properties"
        )));
    }

    // New properties are appended after the existing ones.
    let sql = format!(
        "INSERT INTO custom_properties (user_id, project_id, name, type, options, position) \
         VALUES ($1, $2, $3, $4, $5, $6) \
         RETURNING {SELECT_COLS}"
    );
    let row = sqlx::query_as::<_, CustomPropertyRow>(&sql)
        .bind(user_id)
        .bind(req.project_id)
        .bind(name)
        .bind(&req.kind)
        .bind(sqlx::types::Json(options))
        .bind(count as i32)
        .fetch_one(&state.db)
        .await
        .map_err(map_unique)?;
    Ok(row.into())
}

pub async fn update_property(
    state: &AppState,
    user_id: Uuid,
    id: Uuid,
    req: UpdatePropertyRequest,
) -> AppResult<CustomProperty> {
    let existing = get_property(state, user_id, id).await?;

    let name = match req.name.as_deref() {
        Some(n) => clean_name(n)?,
        None => existing.name.clone(),
    };
    if let Some(kind) = req.kind.as_deref() {
        if kind != existing.kind {
            return Err(AppError::Validation(
                "type cannot be changed after creation".into(),
            ));
        }
    }
    if let Some(pos) = req.position {
        if pos < 0 {
            return Err(AppError::Validation("position must be 0 or greater".into()));
        }
    }
    let options_changed = req.options.is_some();
    let options = match req.options {
        Some(inputs) => build_options(&existing.kind, inputs)?,
        None => existing.options.clone(),
    };
    let position = req.position.unwrap_or(existing.position);

    let mut tx = state.db.begin().await?;

    let sql = format!(
        "UPDATE custom_properties \
         SET name = $1, options = $2, position = $3, updated_at = now() \
         WHERE id = $4 AND user_id = $5 \
         RETURNING {SELECT_COLS}"
    );
    let row = sqlx::query_as::<_, CustomPropertyRow>(&sql)
        .bind(name)
        .bind(sqlx::types::Json(options))
        .bind(position)
        .bind(id)
        .bind(user_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(map_unique)?
        .ok_or(AppError::NotFound)?;

    // Drop stored values that reference removed option ids.
    if options_changed && is_select_kind(&existing.kind) {
        let kept: Vec<String> = row.options.0.iter().map(|o| o.id.clone()).collect();
        if existing.kind == "select" {
            sqlx::query(
                "DELETE FROM work_item_property_values \
                 WHERE property_id = $1 AND NOT ((value #>> '{}') = ANY($2::text[]))",
            )
            .bind(id)
            .bind(&kept)
            .execute(&mut *tx)
            .await?;
        } else {
            sqlx::query(
                "UPDATE work_item_property_values v \
                 SET value = COALESCE(( \
                         SELECT jsonb_agg(e.val ORDER BY e.ord) \
                         FROM jsonb_array_elements(v.value) WITH ORDINALITY AS e(val, ord) \
                         WHERE (e.val #>> '{}') = ANY($2::text[]) \
                     ), '[]'::jsonb), \
                     updated_at = now() \
                 WHERE v.property_id = $1 \
                   AND EXISTS ( \
                         SELECT 1 FROM jsonb_array_elements_text(v.value) AS t(x) \
                         WHERE NOT (t.x = ANY($2::text[])) \
                   )",
            )
            .bind(id)
            .bind(&kept)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;
    Ok(row.into())
}

pub async fn delete_property(state: &AppState, user_id: Uuid, id: Uuid) -> AppResult<()> {
    let result = sqlx::query("DELETE FROM custom_properties WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user_id)
        .execute(&state.db)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

// ── Values ─────────────────────────────────────────────────────────────────────

pub async fn list_project_values(
    state: &AppState,
    user_id: Uuid,
    project_id: Uuid,
) -> AppResult<Vec<ProjectPropertyValue>> {
    assert_project_owned(state, user_id, project_id).await?;
    let rows = sqlx::query_as::<_, ProjectPropertyValue>(
        "SELECT v.work_item_id, v.property_id, v.value \
         FROM work_item_property_values v \
         JOIN custom_properties p ON p.id = v.property_id \
         JOIN work_items wi ON wi.id = v.work_item_id \
         WHERE p.project_id = $1 AND p.user_id = $2 \
           AND wi.user_id = $2 AND wi.deleted_at IS NULL",
    )
    .bind(project_id)
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;
    Ok(rows)
}

pub async fn list_work_item_values(
    state: &AppState,
    user_id: Uuid,
    work_item_id: Uuid,
) -> AppResult<Vec<WorkItemPropertyValue>> {
    work_item_project(state, user_id, work_item_id).await?;
    let rows = sqlx::query_as::<_, WorkItemPropertyValue>(
        "SELECT v.property_id, v.value \
         FROM work_item_property_values v \
         JOIN custom_properties p ON p.id = v.property_id \
         WHERE v.work_item_id = $1 \
         ORDER BY p.position ASC, p.created_at ASC",
    )
    .bind(work_item_id)
    .fetch_all(&state.db)
    .await?;
    Ok(rows)
}

/// Sets (or, with `None` / JSON null, clears) one value. The property must
/// belong to the user and to the work item's project.
pub async fn set_value(
    state: &AppState,
    user_id: Uuid,
    work_item_id: Uuid,
    property_id: Uuid,
    value: Option<Value>,
) -> AppResult<PropertyValueResponse> {
    let item_project = work_item_project(state, user_id, work_item_id).await?;
    let prop = get_property(state, user_id, property_id).await?;
    if item_project != Some(prop.project_id) {
        return Err(AppError::Validation(format!(
            "property '{}' does not belong to this work item's project",
            prop.name
        )));
    }

    match value {
        None | Some(Value::Null) => {
            sqlx::query(
                "DELETE FROM work_item_property_values \
                 WHERE work_item_id = $1 AND property_id = $2",
            )
            .bind(work_item_id)
            .bind(property_id)
            .execute(&state.db)
            .await?;
            Ok(PropertyValueResponse {
                property_id,
                value: Value::Null,
            })
        }
        Some(v) => {
            validate_value(&prop, &v)?;
            sqlx::query(
                "INSERT INTO work_item_property_values (work_item_id, property_id, value) \
                 VALUES ($1, $2, $3) \
                 ON CONFLICT (work_item_id, property_id) \
                 DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
            )
            .bind(work_item_id)
            .bind(property_id)
            .bind(&v)
            .execute(&state.db)
            .await?;
            Ok(PropertyValueResponse {
                property_id,
                value: v,
            })
        }
    }
}
