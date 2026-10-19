//! Custom property module — DB rows, response shapes and request DTOs.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Maximum property name length (characters, after trimming).
pub const MAX_NAME_LEN: usize = 60;
/// Maximum number of properties a single project may hold.
pub const MAX_PROPERTIES_PER_PROJECT: i64 = 30;
/// Maximum option label length (characters, after trimming).
pub const MAX_OPTION_LABEL_LEN: usize = 60;
/// Maximum option id length (characters).
pub const MAX_OPTION_ID_LEN: usize = 40;
/// Maximum length of `text` values and `url` values (characters).
pub const MAX_TEXT_LEN: usize = 2000;

/// Every supported property type, as stored in `custom_properties.type`.
pub const PROPERTY_TYPES: [&str; 7] = [
    "text",
    "number",
    "select",
    "multi_select",
    "date",
    "checkbox",
    "url",
];

// ── Options ───────────────────────────────────────────────────────────────────

/// One choice of a `select` / `multi_select` property.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PropertyOption {
    pub id: String,
    pub label: String,
    pub color: Option<String>,
}

// ── DB row / response ─────────────────────────────────────────────────────────

/// Raw DB row for `custom_properties` (options stored as jsonb).
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct CustomPropertyRow {
    pub id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    #[sqlx(rename = "type")]
    pub kind: String,
    pub options: sqlx::types::Json<Vec<PropertyOption>>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// API shape of a custom property.
#[derive(Debug, Clone, Serialize)]
pub struct CustomProperty {
    pub id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub options: Vec<PropertyOption>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<CustomPropertyRow> for CustomProperty {
    fn from(row: CustomPropertyRow) -> Self {
        Self {
            id: row.id,
            project_id: row.project_id,
            name: row.name,
            kind: row.kind,
            options: row.options.0,
            position: row.position,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

/// One stored value of a work item, keyed by property (work item implied).
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct WorkItemPropertyValue {
    pub property_id: Uuid,
    pub value: serde_json::Value,
}

/// One stored value across a project's work items.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct ProjectPropertyValue {
    pub work_item_id: Uuid,
    pub property_id: Uuid,
    pub value: serde_json::Value,
}

/// Response for `PUT /work-items/:work_item_id/:property_id`.
/// `value` is `null` when the stored value was cleared.
#[derive(Debug, Clone, Serialize)]
pub struct PropertyValueResponse {
    pub property_id: Uuid,
    pub value: serde_json::Value,
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

/// Query for `GET /api/custom-properties` and `GET /api/custom-properties/values`.
#[derive(Debug, Deserialize)]
pub struct ProjectQuery {
    pub project_id: Uuid,
}

/// One option in a create / update body. `id` is generated when absent.
#[derive(Debug, Clone, Deserialize)]
pub struct OptionInput {
    pub id: Option<String>,
    pub label: String,
    pub color: Option<String>,
}

/// Body for `POST /api/custom-properties`.
#[derive(Debug, Deserialize)]
pub struct CreatePropertyRequest {
    pub project_id: Uuid,
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub options: Option<Vec<OptionInput>>,
}

/// Body for `PATCH /api/custom-properties/:id` — every field optional.
/// `type` is immutable: it may be sent, but only with its current value.
#[derive(Debug, Deserialize)]
pub struct UpdatePropertyRequest {
    pub name: Option<String>,
    #[serde(rename = "type")]
    pub kind: Option<String>,
    pub options: Option<Vec<OptionInput>>,
    pub position: Option<i32>,
}

/// Body for `PUT /api/custom-properties/work-items/:work_item_id/:property_id`.
/// `null` (or a missing `value`) clears the stored value.
#[derive(Debug, Deserialize)]
pub struct SetPropertyValueRequest {
    #[serde(default)]
    pub value: Option<serde_json::Value>,
}
