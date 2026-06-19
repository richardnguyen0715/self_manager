//! Business logic for the `database` module.
//!
//! All public functions accept `&AppState` and execute SQL via `sqlx::query!`
//! / `sqlx::query_as!` (compile-time checked).
//!
//! ## Conventions
//!
//! - `type` is a reserved keyword in SQL; every query aliases it as
//!   `type AS col_type`.
//! - Enum-as-text columns (`type`, `view_type`) are bound as `&str` and read
//!   as `String`.
//! - `jsonb` columns are mapped via `col AS "col: serde_json::Value"`.
//! - `.clone()` is used on non-Copy binds reused across statements.
//! - `expr as Type` casts are applied for nullable UUID binds.
//! - Ownership is enforced by joining through the `databases` table which
//!   carries `user_id`.

use uuid::Uuid;

use crate::shared::{
    error::{AppError, AppResult},
    state::AppState,
};

use super::models::{
    BatchUpdateRowsRequest, BoardGroup, CreateColumnRequest, CreateDatabaseRequest,
    CreateRowRequest, CreateViewRequest, Database, DatabaseColumn, DatabaseDetail, DatabaseRow,
    DatabaseView, UpdateColumnRequest, UpdateDatabaseRequest, UpdateRowRequest, UpdateViewRequest,
    ViewRowsResponse,
};

// ── Column-type validation ────────────────────────────────────────────────────

const VALID_COLUMN_TYPES: &[&str] = &[
    "text",
    "number",
    "date",
    "checkbox",
    "select",
    "multi_select",
    "status",
    "url",
];

const VALID_VIEW_TYPES: &[&str] = &["table", "board"];

fn validate_column_type(t: &str) -> AppResult<()> {
    if VALID_COLUMN_TYPES.contains(&t) {
        Ok(())
    } else {
        Err(AppError::Validation(format!(
            "column type must be one of {}, got '{t}'",
            VALID_COLUMN_TYPES.join("|")
        )))
    }
}

fn validate_view_type(t: &str) -> AppResult<()> {
    if VALID_VIEW_TYPES.contains(&t) {
        Ok(())
    } else {
        Err(AppError::Validation(format!(
            "view type must be one of {}, got '{t}'",
            VALID_VIEW_TYPES.join("|")
        )))
    }
}

// ── Ownership helpers ─────────────────────────────────────────────────────────

/// Assert `databases.id = db_id AND user_id = user_id`; return `NotFound` otherwise.
async fn assert_db_owned(state: &AppState, user_id: Uuid, db_id: Uuid) -> AppResult<()> {
    let exists: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM databases WHERE id = $1 AND user_id = $2)",
        db_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if exists {
        Ok(())
    } else {
        Err(AppError::NotFound)
    }
}

// ── Database CRUD ─────────────────────────────────────────────────────────────

/// List all databases in a space owned by `user_id`.
///
/// # Errors
///
/// - [`AppError::NotFound`] — space not found or not owned.
/// - [`AppError::Db`] — database failure.
pub async fn list_databases(
    state: &AppState,
    user_id: Uuid,
    space_id: Uuid,
) -> AppResult<Vec<Database>> {
    // Verify space ownership.
    let space_ok: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM spaces WHERE id = $1 AND user_id = $2)",
        space_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !space_ok {
        return Err(AppError::NotFound);
    }

    let rows = sqlx::query_as!(
        Database,
        r#"
        SELECT id, space_id, user_id, title, icon, created_at, updated_at
        FROM databases
        WHERE space_id = $1 AND user_id = $2
        ORDER BY created_at ASC
        "#,
        space_id,
        user_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

/// Create a new database in a space.
///
/// Seeds one `text` column named "Name" and one default `table` view.
///
/// # Errors
///
/// - [`AppError::NotFound`] — space not found or not owned.
/// - [`AppError::Db`] — database failure.
pub async fn create_database(
    state: &AppState,
    user_id: Uuid,
    req: CreateDatabaseRequest,
) -> AppResult<Database> {
    // Verify space ownership.
    let space_ok: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM spaces WHERE id = $1 AND user_id = $2)",
        req.space_id,
        user_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    if !space_ok {
        return Err(AppError::NotFound);
    }

    let title = req
        .title
        .as_deref()
        .unwrap_or("Untitled Database")
        .to_owned();

    let db = sqlx::query_as!(
        Database,
        r#"
        INSERT INTO databases (space_id, user_id, title, icon)
        VALUES ($1, $2, $3, $4)
        RETURNING id, space_id, user_id, title, icon, created_at, updated_at
        "#,
        req.space_id,
        user_id,
        title,
        req.icon,
    )
    .fetch_one(&state.db)
    .await?;

    // Seed default "Name" text column.
    let empty_options = serde_json::json!([]);
    sqlx::query!(
        r#"
        INSERT INTO database_columns (database_id, name, type, options, position)
        VALUES ($1, 'Name', 'text', $2, 0)
        "#,
        db.id,
        empty_options,
    )
    .execute(&state.db)
    .await?;

    // Seed default table view.
    let empty_config = serde_json::json!({});
    sqlx::query!(
        r#"
        INSERT INTO database_views (database_id, name, type, config, position)
        VALUES ($1, 'Default View', 'table', $2, 0)
        "#,
        db.id,
        empty_config,
    )
    .execute(&state.db)
    .await?;

    Ok(db)
}

/// Fetch a single database with its columns and views.
///
/// # Errors
///
/// - [`AppError::NotFound`] — database not found or not owned.
/// - [`AppError::Db`] — database failure.
pub async fn get_database(
    state: &AppState,
    user_id: Uuid,
    db_id: Uuid,
) -> AppResult<DatabaseDetail> {
    let db = sqlx::query_as!(
        Database,
        r#"
        SELECT id, space_id, user_id, title, icon, created_at, updated_at
        FROM databases
        WHERE id = $1 AND user_id = $2
        "#,
        db_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let columns = fetch_columns_for_db(state, db_id).await?;
    let views = fetch_views_for_db(state, db_id).await?;

    Ok(DatabaseDetail {
        database: db,
        columns,
        views,
    })
}

/// Update a database's title and/or icon.
///
/// # Errors
///
/// - [`AppError::NotFound`] — database not found or not owned.
/// - [`AppError::Db`] — database failure.
pub async fn update_database(
    state: &AppState,
    user_id: Uuid,
    db_id: Uuid,
    req: UpdateDatabaseRequest,
) -> AppResult<Database> {
    // Fetch current for coalescing.
    let current = sqlx::query_as!(
        Database,
        r#"
        SELECT id, space_id, user_id, title, icon, created_at, updated_at
        FROM databases
        WHERE id = $1 AND user_id = $2
        "#,
        db_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let new_title = req.title.unwrap_or(current.title);
    let new_icon = if req.icon.is_some() {
        req.icon
    } else {
        current.icon
    };

    let updated = sqlx::query_as!(
        Database,
        r#"
        UPDATE databases
        SET title      = $3,
            icon       = $4,
            updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING id, space_id, user_id, title, icon, created_at, updated_at
        "#,
        db_id,
        user_id,
        new_title,
        new_icon,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(updated)
}

/// Delete a database (cascades to columns, rows, views).
///
/// # Errors
///
/// - [`AppError::NotFound`] — database not found or not owned.
/// - [`AppError::Db`] — database failure.
pub async fn delete_database(state: &AppState, user_id: Uuid, db_id: Uuid) -> AppResult<()> {
    let result = sqlx::query!(
        "DELETE FROM databases WHERE id = $1 AND user_id = $2",
        db_id,
        user_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}

// ── Columns ───────────────────────────────────────────────────────────────────

/// Fetch all columns for a database, ordered by position.
async fn fetch_columns_for_db(state: &AppState, db_id: Uuid) -> AppResult<Vec<DatabaseColumn>> {
    let rows = sqlx::query_as!(
        DatabaseColumn,
        r#"
        SELECT
            id,
            database_id,
            name,
            type AS col_type,
            options AS "options: serde_json::Value",
            position,
            created_at
        FROM database_columns
        WHERE database_id = $1
        ORDER BY position ASC, created_at ASC
        "#,
        db_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

/// List all columns for a database (ownership checked through database).
///
/// # Errors
///
/// - [`AppError::NotFound`] — database not found or not owned.
/// - [`AppError::Db`] — database failure.
pub async fn list_columns(
    state: &AppState,
    user_id: Uuid,
    db_id: Uuid,
) -> AppResult<Vec<DatabaseColumn>> {
    assert_db_owned(state, user_id, db_id).await?;
    fetch_columns_for_db(state, db_id).await
}

/// Create a new column on a database.
///
/// # Errors
///
/// - [`AppError::NotFound`] — database not found or not owned.
/// - [`AppError::Validation`] — invalid column type.
/// - [`AppError::Db`] — database failure.
pub async fn create_column(
    state: &AppState,
    user_id: Uuid,
    db_id: Uuid,
    req: CreateColumnRequest,
) -> AppResult<DatabaseColumn> {
    assert_db_owned(state, user_id, db_id).await?;
    validate_column_type(&req.col_type)?;

    let options = req.options.unwrap_or_else(|| serde_json::json!([]));

    // Position: explicit or append.
    let position = if let Some(p) = req.position {
        p
    } else {
        sqlx::query_scalar!(
            r#"
            SELECT COALESCE(MAX(position), -1) + 1
            FROM database_columns
            WHERE database_id = $1
            "#,
            db_id,
        )
        .fetch_one(&state.db)
        .await?
        .unwrap_or(0)
    };

    let col_type = req.col_type.clone();

    let col = sqlx::query_as!(
        DatabaseColumn,
        r#"
        INSERT INTO database_columns (database_id, name, type, options, position)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
            id,
            database_id,
            name,
            type AS col_type,
            options AS "options: serde_json::Value",
            position,
            created_at
        "#,
        db_id,
        req.name,
        col_type as String,
        options,
        position,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(col)
}

/// Partially update a column (name, type, options, position).
///
/// # Errors
///
/// - [`AppError::NotFound`] — column or database not found / not owned.
/// - [`AppError::Validation`] — invalid column type.
/// - [`AppError::Db`] — database failure.
pub async fn update_column(
    state: &AppState,
    user_id: Uuid,
    db_id: Uuid,
    col_id: Uuid,
    req: UpdateColumnRequest,
) -> AppResult<DatabaseColumn> {
    assert_db_owned(state, user_id, db_id).await?;

    if let Some(ref t) = req.col_type {
        validate_column_type(t)?;
    }

    // Fetch current for coalescing.
    let current = sqlx::query_as!(
        DatabaseColumn,
        r#"
        SELECT
            id,
            database_id,
            name,
            type AS col_type,
            options AS "options: serde_json::Value",
            position,
            created_at
        FROM database_columns
        WHERE id = $1 AND database_id = $2
        "#,
        col_id,
        db_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let new_name = req.name.unwrap_or(current.name);
    let new_type = req.col_type.unwrap_or(current.col_type);
    let new_options = req.options.unwrap_or(current.options);
    let new_position = req.position.unwrap_or(current.position);

    let updated = sqlx::query_as!(
        DatabaseColumn,
        r#"
        UPDATE database_columns
        SET name     = $3,
            type     = $4,
            options  = $5,
            position = $6
        WHERE id = $1 AND database_id = $2
        RETURNING
            id,
            database_id,
            name,
            type AS col_type,
            options AS "options: serde_json::Value",
            position,
            created_at
        "#,
        col_id,
        db_id,
        new_name,
        new_type as String,
        new_options,
        new_position,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(updated)
}

/// Delete a column and strip its key from every row's `values` JSONB.
///
/// # Errors
///
/// - [`AppError::NotFound`] — column or database not found / not owned.
/// - [`AppError::Db`] — database failure.
pub async fn delete_column(
    state: &AppState,
    user_id: Uuid,
    db_id: Uuid,
    col_id: Uuid,
) -> AppResult<()> {
    assert_db_owned(state, user_id, db_id).await?;

    // Strip the column key from all row values JSONB.
    let col_key = col_id.to_string();
    sqlx::query!(
        r#"
        UPDATE database_rows
        SET values     = values - $2,
            updated_at = now()
        WHERE database_id = $1
        "#,
        db_id,
        col_key,
    )
    .execute(&state.db)
    .await?;

    let result = sqlx::query!(
        "DELETE FROM database_columns WHERE id = $1 AND database_id = $2",
        col_id,
        db_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}

// ── Rows ──────────────────────────────────────────────────────────────────────

/// List all rows for a database in position order (raw, unfiltered).
///
/// # Errors
///
/// - [`AppError::NotFound`] — database not found or not owned.
/// - [`AppError::Db`] — database failure.
pub async fn list_rows(
    state: &AppState,
    user_id: Uuid,
    db_id: Uuid,
) -> AppResult<Vec<DatabaseRow>> {
    assert_db_owned(state, user_id, db_id).await?;

    let rows = sqlx::query_as!(
        DatabaseRow,
        r#"
        SELECT
            id,
            database_id,
            values AS "values: serde_json::Value",
            position,
            created_at,
            updated_at
        FROM database_rows
        WHERE database_id = $1
        ORDER BY position ASC, created_at ASC
        "#,
        db_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

/// Create a new row on a database.
///
/// # Errors
///
/// - [`AppError::NotFound`] — database not found or not owned.
/// - [`AppError::Db`] — database failure.
pub async fn create_row(
    state: &AppState,
    user_id: Uuid,
    db_id: Uuid,
    req: CreateRowRequest,
) -> AppResult<DatabaseRow> {
    assert_db_owned(state, user_id, db_id).await?;

    let values = req.values.unwrap_or_else(|| serde_json::json!({}));

    let position = if let Some(p) = req.position {
        p
    } else {
        sqlx::query_scalar!(
            r#"
            SELECT COALESCE(MAX(position), -1) + 1
            FROM database_rows
            WHERE database_id = $1
            "#,
            db_id,
        )
        .fetch_one(&state.db)
        .await?
        .unwrap_or(0)
    };

    let row = sqlx::query_as!(
        DatabaseRow,
        r#"
        INSERT INTO database_rows (database_id, values, position)
        VALUES ($1, $2, $3)
        RETURNING
            id,
            database_id,
            values AS "values: serde_json::Value",
            position,
            created_at,
            updated_at
        "#,
        db_id,
        values,
        position,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(row)
}

/// Partially update a row (shallow-merge values, optionally reposition).
///
/// The incoming `values` object is shallow-merged into the existing `values`
/// using PostgreSQL's `||` operator, which replaces top-level keys.
///
/// # Errors
///
/// - [`AppError::NotFound`] — row or database not found / not owned.
/// - [`AppError::Db`] — database failure.
pub async fn update_row(
    state: &AppState,
    user_id: Uuid,
    db_id: Uuid,
    row_id: Uuid,
    req: UpdateRowRequest,
) -> AppResult<DatabaseRow> {
    assert_db_owned(state, user_id, db_id).await?;

    // Fetch current row for coalescing.
    let current = sqlx::query_as!(
        DatabaseRow,
        r#"
        SELECT
            id,
            database_id,
            values AS "values: serde_json::Value",
            position,
            created_at,
            updated_at
        FROM database_rows
        WHERE id = $1 AND database_id = $2
        "#,
        row_id,
        db_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // Shallow-merge: start from current, overlay incoming keys.
    let new_values = if let Some(incoming) = req.values {
        let mut merged = current.values.clone();
        if let (Some(m), Some(i)) = (merged.as_object_mut(), incoming.as_object()) {
            for (k, v) in i {
                m.insert(k.clone(), v.clone());
            }
        }
        merged
    } else {
        current.values
    };

    let new_position = req.position.unwrap_or(current.position);

    let updated = sqlx::query_as!(
        DatabaseRow,
        r#"
        UPDATE database_rows
        SET values     = $3,
            position   = $4,
            updated_at = now()
        WHERE id = $1 AND database_id = $2
        RETURNING
            id,
            database_id,
            values AS "values: serde_json::Value",
            position,
            created_at,
            updated_at
        "#,
        row_id,
        db_id,
        new_values,
        new_position,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(updated)
}

/// Batch-update multiple rows' values (used by Board drag-to-regroup).
///
/// Each update shallow-merges the supplied values into the existing row values.
/// Only rows belonging to `db_id` (and thus indirectly owned by `user_id`) are
/// touched. Rows not in the batch are left unchanged.
///
/// # Errors
///
/// - [`AppError::NotFound`] — database not found or not owned.
/// - [`AppError::Db`] — database failure.
pub async fn batch_update_rows(
    state: &AppState,
    user_id: Uuid,
    db_id: Uuid,
    req: BatchUpdateRowsRequest,
) -> AppResult<Vec<DatabaseRow>> {
    assert_db_owned(state, user_id, db_id).await?;

    let mut results = Vec::with_capacity(req.updates.len());

    for update in req.updates {
        // Fetch current to merge.
        let current = sqlx::query_as!(
            DatabaseRow,
            r#"
            SELECT
                id,
                database_id,
                values AS "values: serde_json::Value",
                position,
                created_at,
                updated_at
            FROM database_rows
            WHERE id = $1 AND database_id = $2
            "#,
            update.id,
            db_id,
        )
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

        let mut merged = current.values;
        if let (Some(m), Some(i)) = (merged.as_object_mut(), update.values.as_object()) {
            for (k, v) in i {
                m.insert(k.clone(), v.clone());
            }
        }

        let updated = sqlx::query_as!(
            DatabaseRow,
            r#"
            UPDATE database_rows
            SET values     = $3,
                updated_at = now()
            WHERE id = $1 AND database_id = $2
            RETURNING
                id,
                database_id,
                values AS "values: serde_json::Value",
                position,
                created_at,
                updated_at
            "#,
            update.id,
            db_id,
            merged,
        )
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

        results.push(updated);
    }

    Ok(results)
}

/// Delete a row.
///
/// # Errors
///
/// - [`AppError::NotFound`] — row or database not found / not owned.
/// - [`AppError::Db`] — database failure.
pub async fn delete_row(
    state: &AppState,
    user_id: Uuid,
    db_id: Uuid,
    row_id: Uuid,
) -> AppResult<()> {
    assert_db_owned(state, user_id, db_id).await?;

    let result = sqlx::query!(
        "DELETE FROM database_rows WHERE id = $1 AND database_id = $2",
        row_id,
        db_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}

// ── Views ─────────────────────────────────────────────────────────────────────

/// Fetch all views for a database in position order.
async fn fetch_views_for_db(state: &AppState, db_id: Uuid) -> AppResult<Vec<DatabaseView>> {
    let rows = sqlx::query_as!(
        DatabaseView,
        r#"
        SELECT
            id,
            database_id,
            name,
            type AS view_type,
            config AS "config: serde_json::Value",
            position,
            created_at,
            updated_at
        FROM database_views
        WHERE database_id = $1
        ORDER BY position ASC, created_at ASC
        "#,
        db_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

/// List all views for a database.
///
/// # Errors
///
/// - [`AppError::NotFound`] — database not found or not owned.
/// - [`AppError::Db`] — database failure.
pub async fn list_views(
    state: &AppState,
    user_id: Uuid,
    db_id: Uuid,
) -> AppResult<Vec<DatabaseView>> {
    assert_db_owned(state, user_id, db_id).await?;
    fetch_views_for_db(state, db_id).await
}

/// Create a new view on a database.
///
/// # Errors
///
/// - [`AppError::NotFound`] — database not found or not owned.
/// - [`AppError::Validation`] — invalid view type.
/// - [`AppError::Db`] — database failure.
pub async fn create_view(
    state: &AppState,
    user_id: Uuid,
    db_id: Uuid,
    req: CreateViewRequest,
) -> AppResult<DatabaseView> {
    assert_db_owned(state, user_id, db_id).await?;
    validate_view_type(&req.view_type)?;

    let config = req.config.unwrap_or_else(|| serde_json::json!({}));

    let position = if let Some(p) = req.position {
        p
    } else {
        sqlx::query_scalar!(
            r#"
            SELECT COALESCE(MAX(position), -1) + 1
            FROM database_views
            WHERE database_id = $1
            "#,
            db_id,
        )
        .fetch_one(&state.db)
        .await?
        .unwrap_or(0)
    };

    let view_type = req.view_type.clone();

    let view = sqlx::query_as!(
        DatabaseView,
        r#"
        INSERT INTO database_views (database_id, name, type, config, position)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
            id,
            database_id,
            name,
            type AS view_type,
            config AS "config: serde_json::Value",
            position,
            created_at,
            updated_at
        "#,
        db_id,
        req.name,
        view_type as String,
        config,
        position,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(view)
}

/// Partially update a view (name, config, position).
///
/// # Errors
///
/// - [`AppError::NotFound`] — view or database not found / not owned.
/// - [`AppError::Db`] — database failure.
pub async fn update_view(
    state: &AppState,
    user_id: Uuid,
    db_id: Uuid,
    view_id: Uuid,
    req: UpdateViewRequest,
) -> AppResult<DatabaseView> {
    assert_db_owned(state, user_id, db_id).await?;

    // Fetch current for coalescing.
    let current = sqlx::query_as!(
        DatabaseView,
        r#"
        SELECT
            id,
            database_id,
            name,
            type AS view_type,
            config AS "config: serde_json::Value",
            position,
            created_at,
            updated_at
        FROM database_views
        WHERE id = $1 AND database_id = $2
        "#,
        view_id,
        db_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let new_name = req.name.unwrap_or(current.name);
    let new_config = req.config.unwrap_or(current.config);
    let new_position = req.position.unwrap_or(current.position);

    let updated = sqlx::query_as!(
        DatabaseView,
        r#"
        UPDATE database_views
        SET name       = $3,
            config     = $4,
            position   = $5,
            updated_at = now()
        WHERE id = $1 AND database_id = $2
        RETURNING
            id,
            database_id,
            name,
            type AS view_type,
            config AS "config: serde_json::Value",
            position,
            created_at,
            updated_at
        "#,
        view_id,
        db_id,
        new_name,
        new_config,
        new_position,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(updated)
}

/// Delete a view.
///
/// # Errors
///
/// - [`AppError::NotFound`] — view or database not found / not owned.
/// - [`AppError::Db`] — database failure.
pub async fn delete_view(
    state: &AppState,
    user_id: Uuid,
    db_id: Uuid,
    view_id: Uuid,
) -> AppResult<()> {
    assert_db_owned(state, user_id, db_id).await?;

    let result = sqlx::query!(
        "DELETE FROM database_views WHERE id = $1 AND database_id = $2",
        view_id,
        db_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(())
}

// ── View rows (filtered + sorted + grouped server-side) ───────────────────────

/// Fetch rows for a view, applying the stored `config` (filters, sorts, board
/// grouping) server-side.
///
/// **Table view** → returns `ViewRowsResponse { rows: Some(...), groups: None }`.
///
/// **Board view** → groups rows by `config.group_by_column_id`; returns
/// `ViewRowsResponse { rows: None, groups: Some(...) }`.
///
/// Filtering: AND-combined conditions on `values->>'col_id'` text extractions.
/// Sorting: `ORDER BY` applied after filtering using jsonb text extraction.
/// Board grouping: bucket rows into named groups derived from the `group_by`
/// column's `options` array; rows with no matching option fall into a
/// `option_id: null` group.
///
/// # Errors
///
/// - [`AppError::NotFound`] — view or database not found / not owned.
/// - [`AppError::Db`] — database failure.
pub async fn get_view_rows(
    state: &AppState,
    user_id: Uuid,
    db_id: Uuid,
    view_id: Uuid,
) -> AppResult<ViewRowsResponse> {
    assert_db_owned(state, user_id, db_id).await?;

    // Load the view.
    let view = sqlx::query_as!(
        DatabaseView,
        r#"
        SELECT
            id,
            database_id,
            name,
            type AS view_type,
            config AS "config: serde_json::Value",
            position,
            created_at,
            updated_at
        FROM database_views
        WHERE id = $1 AND database_id = $2
        "#,
        view_id,
        db_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // Load all rows for this database (we filter/sort in Rust to avoid dynamic
    // SQL construction for the MVP; the row count per database is expected to be
    // manageable).
    let all_rows = sqlx::query_as!(
        DatabaseRow,
        r#"
        SELECT
            id,
            database_id,
            values AS "values: serde_json::Value",
            position,
            created_at,
            updated_at
        FROM database_rows
        WHERE database_id = $1
        ORDER BY position ASC, created_at ASC
        "#,
        db_id,
    )
    .fetch_all(&state.db)
    .await?;

    // Parse config.
    let config = &view.config;
    let filters = config
        .get("filters")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let sorts = config
        .get("sorts")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let group_by_col = config
        .get("group_by_column_id")
        .and_then(|v| v.as_str())
        .map(ToOwned::to_owned);

    // Apply filters.
    let filtered: Vec<DatabaseRow> = all_rows
        .into_iter()
        .filter(|row| apply_filters(row, &filters))
        .collect();

    // Apply sorts.
    let mut sorted = filtered;
    apply_sorts(&mut sorted, &sorts);

    // Return based on view type.
    if view.view_type == "board" {
        let groups = group_rows_for_board(state, db_id, sorted, group_by_col.as_deref()).await?;
        Ok(ViewRowsResponse {
            rows: None,
            groups: Some(groups),
        })
    } else {
        Ok(ViewRowsResponse {
            rows: Some(sorted),
            groups: None,
        })
    }
}

// ── Filter / sort / group helpers ─────────────────────────────────────────────

/// Apply AND-combined filters to a row. Returns `true` if the row passes all.
fn apply_filters(row: &DatabaseRow, filters: &[serde_json::Value]) -> bool {
    for filter in filters {
        let col_id = match filter.get("column_id").and_then(|v| v.as_str()) {
            Some(s) => s,
            None => continue,
        };
        let op = match filter.get("op").and_then(|v| v.as_str()) {
            Some(s) => s,
            None => continue,
        };
        let filter_value = filter.get("value");

        let cell_value = row.values.get(col_id);

        let passes = match op {
            "is_empty" => cell_value.map_or(true, |v| v.is_null() || v == ""),
            "is_not_empty" => cell_value.map_or(false, |v| !v.is_null() && v != ""),
            "eq" => {
                let fv = filter_value;
                cell_value == fv
            }
            "neq" => {
                let fv = filter_value;
                cell_value != fv
            }
            "contains" => {
                let needle = filter_value
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                cell_value
                    .and_then(|v| v.as_str())
                    .map_or(false, |s| s.contains(needle))
            }
            "gt" => compare_numeric(cell_value, filter_value, |a, b| a > b),
            "lt" => compare_numeric(cell_value, filter_value, |a, b| a < b),
            _ => true,
        };

        if !passes {
            return false;
        }
    }
    true
}

/// Compare numeric cell value against filter value using the supplied comparator.
fn compare_numeric(
    cell: Option<&serde_json::Value>,
    filter: Option<&serde_json::Value>,
    cmp: impl Fn(f64, f64) -> bool,
) -> bool {
    let a = cell.and_then(|v| v.as_f64()).unwrap_or(0.0);
    let b = filter.and_then(|v| v.as_f64()).unwrap_or(0.0);
    cmp(a, b)
}

/// Apply sorts in-order (stable sort, last sort wins for equal values).
fn apply_sorts(rows: &mut Vec<DatabaseRow>, sorts: &[serde_json::Value]) {
    // Apply from last to first so first sort dominates (stable).
    for sort in sorts.iter().rev() {
        let col_id = match sort.get("column_id").and_then(|v| v.as_str()) {
            Some(s) => s.to_owned(),
            None => continue,
        };
        let asc = sort
            .get("direction")
            .and_then(|v| v.as_str())
            .map_or(true, |d| d == "asc");

        rows.sort_by(|a, b| {
            let av = a.values.get(&col_id);
            let bv = b.values.get(&col_id);
            let ord = compare_json_values(av, bv);
            if asc {
                ord
            } else {
                ord.reverse()
            }
        });
    }
}

/// Total ordering for JSON cell values for sorting purposes.
///
/// Numbers are compared numerically; everything else is compared as strings
/// (booleans and dates included — ISO date strings sort correctly lexically).
fn compare_json_values(
    a: Option<&serde_json::Value>,
    b: Option<&serde_json::Value>,
) -> std::cmp::Ordering {
    use serde_json::Value;
    use std::cmp::Ordering;

    match (a, b) {
        (None, None) => Ordering::Equal,
        (None, Some(_)) => Ordering::Less,
        (Some(_), None) => Ordering::Greater,
        (Some(Value::Number(na)), Some(Value::Number(nb))) => {
            let fa = na.as_f64().unwrap_or(0.0);
            let fb = nb.as_f64().unwrap_or(0.0);
            fa.partial_cmp(&fb).unwrap_or(Ordering::Equal)
        }
        (Some(va), Some(vb)) => {
            let sa = value_as_sort_string(va);
            let sb = value_as_sort_string(vb);
            sa.cmp(&sb)
        }
    }
}

fn value_as_sort_string(v: &serde_json::Value) -> String {
    match v {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Bool(b) => b.to_string(),
        serde_json::Value::Null => String::new(),
        other => other.to_string(),
    }
}

/// Group a sorted list of rows for a Board view.
///
/// Fetches the `group_by` column's `options` array to build named groups, then
/// buckets each row by its cell value in that column. Rows whose cell value
/// doesn't match any option end up in the "no group" bucket (`option_id: null`).
async fn group_rows_for_board(
    state: &AppState,
    db_id: Uuid,
    rows: Vec<DatabaseRow>,
    group_by_col: Option<&str>,
) -> AppResult<Vec<BoardGroup>> {
    let col_id = match group_by_col {
        Some(c) => c,
        None => {
            // No group-by column — return a single group with all rows.
            return Ok(vec![BoardGroup {
                option_id: None,
                option_name: String::new(),
                rows,
            }]);
        }
    };

    // Load the group-by column to get its options.
    let col = sqlx::query!(
        r#"
        SELECT options AS "options: serde_json::Value"
        FROM database_columns
        WHERE id = $1 AND database_id = $2
        "#,
        Uuid::parse_str(col_id).map_err(|_| AppError::Validation(
            "group_by_column_id is not a valid UUID".to_owned()
        ))?,
        db_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // Build ordered group list from options.
    let options: Vec<(String, String)> = col
        .options
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|opt| {
            let id = opt.get("id").and_then(|v| v.as_str())?;
            let name = opt.get("name").and_then(|v| v.as_str()).unwrap_or("");
            Some((id.to_owned(), name.to_owned()))
        })
        .collect();

    // Build a map: option_id → index in groups vec.
    let mut groups: Vec<BoardGroup> = options
        .iter()
        .map(|(id, name)| BoardGroup {
            option_id: Some(id.clone()),
            option_name: name.clone(),
            rows: Vec::new(),
        })
        .collect();
    // "No group" at end.
    groups.push(BoardGroup {
        option_id: None,
        option_name: String::new(),
        rows: Vec::new(),
    });

    let no_group_idx = groups.len() - 1;

    // Bucket rows.
    for row in rows {
        let cell = row.values.get(col_id).and_then(|v| v.as_str()).map(ToOwned::to_owned);
        let target_idx = cell
            .as_deref()
            .and_then(|cell_val| options.iter().position(|(id, _)| id == cell_val))
            .unwrap_or(no_group_idx);
        groups[target_idx].rows.push(row);
    }

    Ok(groups)
}
