//! Retro module — DB rows, response DTOs and request bodies.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value as JsonValue;
use sqlx::FromRow;
use uuid::Uuid;

pub const KINDS: &[&str] = &[
    "daily", "weekly", "monthly", "quarterly", "yearly", "sprint", "project", "custom",
];
pub const INPUT_TYPES: &[&str] = &["cards", "text", "rating", "mood", "checklist", "auto_metrics"];
pub const AUTO_SOURCES: &[&str] = &["completed_items", "habits", "focus", "sprint", "overdue", "all"];
pub const SCOPE_TYPES: &[&str] = &[
    "none", "sprint", "project", "epic", "initiative", "goal", "work_item", "habit",
];
pub const TARGET_TYPES: &[&str] = &[
    "work_item", "sprint", "project", "epic", "initiative", "goal", "habit", "doc", "retro",
];
pub const RELATIONS: &[&str] = &["about", "evidence", "action_source", "mentions"];
pub const ACTION_STATUSES: &[&str] = &["open", "done", "dropped"];
pub const RETRO_STATUSES: &[&str] = &["draft", "completed"];

/// Deserialises a JSON field into `Option<Option<T>>` so that an absent key
/// (`None`) can be told apart from an explicit `null` (`Some(None)`).
pub fn double_option<'de, D, T>(de: D) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Ok(Some(Option::<T>::deserialize(de)?))
}

// ── Templates ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct TemplateRow {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub name: String,
    pub kind: String,
    pub description: Option<String>,
    pub is_builtin: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A section, as stored on a template or copied onto a retro.
#[derive(Debug, Clone, FromRow, Serialize)]
pub struct SectionDto {
    pub id: Uuid,
    pub position: i32,
    pub key: String,
    pub title: String,
    pub prompt: Option<String>,
    pub input_type: String,
    pub auto_source: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TemplateDto {
    #[serde(flatten)]
    pub template: TemplateRow,
    pub sections: Vec<SectionDto>,
}

#[derive(Debug, Deserialize)]
pub struct SectionInput {
    pub key: String,
    pub title: String,
    #[serde(default)]
    pub prompt: Option<String>,
    pub input_type: String,
    #[serde(default)]
    pub auto_source: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTemplateRequest {
    pub name: String,
    pub kind: String,
    #[serde(default)]
    pub description: Option<String>,
    pub sections: Vec<SectionInput>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTemplateRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default, deserialize_with = "double_option")]
    pub description: Option<Option<String>>,
    #[serde(default)]
    pub sections: Option<Vec<SectionInput>>,
}

// ── Retros ───────────────────────────────────────────────────────────────────

/// List/summary row. Built by `service::SUMMARY_SQL`.
#[derive(Debug, Clone, FromRow, Serialize)]
pub struct RetroSummary {
    pub id: Uuid,
    pub kind: String,
    pub title: String,
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
    pub scope_type: String,
    pub scope_id: Option<Uuid>,
    pub scope_label: Option<String>,
    pub status: String,
    pub rating: Option<i16>,
    pub mood: Option<i16>,
    pub entries_count: i64,
    pub links_count: i64,
    pub open_actions: i64,
    pub completed_at: Option<DateTime<Utc>>,
}

/// Full `retros` row (only the columns the detail view and metrics need).
#[derive(Debug, Clone, FromRow)]
pub struct RetroRecord {
    pub template_id: Option<Uuid>,
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
    pub scope_type: String,
    pub scope_id: Option<Uuid>,
    pub status: String,
    pub summary: Option<String>,
    pub snapshot: JsonValue,
    pub started_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct RetroHead {
    #[serde(flatten)]
    pub summary: RetroSummary,
    pub template_id: Option<Uuid>,
    #[serde(rename = "summary")]
    pub summary_text: Option<String>,
    pub snapshot: JsonValue,
    pub started_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct RetroDetail {
    pub retro: RetroHead,
    pub sections: Vec<SectionDto>,
    pub entries: Vec<EntryDto>,
    pub links: Vec<LinkResolved>,
    pub actions: Vec<ActionDto>,
}

#[derive(Debug, Deserialize)]
pub struct OpenRetroRequest {
    pub kind: String,
    /// Any date inside the wanted period. Defaults to today (user timezone).
    pub date: Option<NaiveDate>,
    pub scope_type: Option<String>,
    pub scope_id: Option<Uuid>,
    pub template_id: Option<Uuid>,
    pub title: Option<String>,
    /// Only used for kinds without a fixed period (project / custom / no scope).
    pub period_end: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct ListRetrosQuery {
    pub kind: Option<String>,
    pub scope_type: Option<String>,
    pub scope_id: Option<Uuid>,
    pub status: Option<String>,
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct RetroPage {
    pub data: Vec<RetroSummary>,
    pub total: i64,
}

#[derive(Debug, Deserialize)]
pub struct TrendsQuery {
    pub kind: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct ByTargetQuery {
    pub target_type: String,
    pub target_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct PatchRetroRequest {
    pub title: Option<String>,
    #[serde(default, deserialize_with = "double_option")]
    pub summary: Option<Option<String>>,
    #[serde(default, deserialize_with = "double_option")]
    pub rating: Option<Option<i16>>,
    #[serde(default, deserialize_with = "double_option")]
    pub mood: Option<Option<i16>>,
}

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct TrendPoint {
    pub retro_id: Uuid,
    pub period_start: NaiveDate,
    pub title: String,
    pub rating: Option<i16>,
    pub mood: Option<i16>,
    pub completed_items: Option<f64>,
    pub completed_points: Option<f64>,
    pub habit_rate: Option<f64>,
    pub focus_minutes: Option<f64>,
}

// ── Entries ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct EntryDto {
    pub id: Uuid,
    pub section_id: Uuid,
    pub position: i32,
    pub body: String,
    pub rating: Option<i16>,
    pub mood: Option<i16>,
    pub checked: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateEntryRequest {
    pub section_id: Uuid,
    pub body: Option<String>,
    pub rating: Option<i16>,
    pub mood: Option<i16>,
    pub checked: Option<bool>,
    pub position: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct PatchEntryRequest {
    pub body: Option<String>,
    #[serde(default, deserialize_with = "double_option")]
    pub rating: Option<Option<i16>>,
    #[serde(default, deserialize_with = "double_option")]
    pub mood: Option<Option<i16>>,
    pub checked: Option<bool>,
    pub position: Option<i32>,
}

// ── Links ────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct LinkResolved {
    pub id: Uuid,
    pub target_type: String,
    pub target_id: Uuid,
    pub relation: String,
    pub title: Option<String>,
    pub subtitle: Option<String>,
    pub href: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLinkRequest {
    pub target_type: String,
    pub target_id: Uuid,
    pub relation: Option<String>,
}

// ── Actions ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct ActionDto {
    pub id: Uuid,
    pub retro_id: Uuid,
    pub text: String,
    pub status: String,
    pub due_date: Option<NaiveDate>,
    pub work_item_id: Option<Uuid>,
    pub carried_from_action_id: Option<Uuid>,
    pub carry_count: i32,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct ActionWithRetro {
    pub id: Uuid,
    pub retro_id: Uuid,
    pub text: String,
    pub status: String,
    pub due_date: Option<NaiveDate>,
    pub work_item_id: Option<Uuid>,
    pub carried_from_action_id: Option<Uuid>,
    pub carry_count: i32,
    pub completed_at: Option<DateTime<Utc>>,
    pub retro_title: String,
    pub retro_kind: String,
    pub retro_period_start: NaiveDate,
}

#[derive(Debug, Deserialize)]
pub struct ActionsQuery {
    /// `open` (default), `done`, `dropped` or `all`.
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateActionRequest {
    pub text: String,
    pub due_date: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct PatchActionRequest {
    pub text: Option<String>,
    pub status: Option<String>,
    #[serde(default, deserialize_with = "double_option")]
    pub due_date: Option<Option<NaiveDate>>,
}
