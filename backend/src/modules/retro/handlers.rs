//! Axum handlers for the `retro` module. Thin: extract → delegate to
//! [`service`] / [`links`] → respond. All routes require auth.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;

use crate::shared::{error::AppResult, extractors::AuthUser, state::AppState};

use super::{
    links,
    models::{
        ActionDto, ActionWithRetro, ActionsQuery, ByTargetQuery, CreateActionRequest,
        CreateEntryRequest, CreateLinkRequest, CreateTemplateRequest, EntryDto, LinkResolved,
        ListRetrosQuery, OpenRetroRequest, PatchActionRequest, PatchEntryRequest,
        PatchRetroRequest, PatchSectionRequest, RetroDetail, RetroPage, RetroSummary, SectionDto,
        TemplateDto, TrendPoint,
        TrendsQuery, UpdateTemplateRequest,
    },
    service,
};

// ── Templates ───────────────────────────────────────────────────────────────

pub async fn list_templates(
    auth: AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<Vec<TemplateDto>>> {
    Ok(Json(service::list_templates(&state, auth.user_id).await?))
}

pub async fn create_template(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreateTemplateRequest>,
) -> AppResult<(StatusCode, Json<TemplateDto>)> {
    let template = service::create_template(&state, auth.user_id, body).await?;
    Ok((StatusCode::CREATED, Json(template)))
}

pub async fn update_template(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTemplateRequest>,
) -> AppResult<Json<TemplateDto>> {
    Ok(Json(
        service::update_template(&state, auth.user_id, id, body).await?,
    ))
}

pub async fn delete_template(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::delete_template(&state, auth.user_id, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Retros ──────────────────────────────────────────────────────────────────

pub async fn open_retro(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<OpenRetroRequest>,
) -> AppResult<Json<RetroDetail>> {
    Ok(Json(service::open(&state, auth.user_id, body).await?))
}

pub async fn list_retros(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ListRetrosQuery>,
) -> AppResult<Json<RetroPage>> {
    Ok(Json(service::list(&state, auth.user_id, query).await?))
}

pub async fn trends(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<TrendsQuery>,
) -> AppResult<Json<Vec<TrendPoint>>> {
    Ok(Json(service::trends(&state, auth.user_id, query).await?))
}

pub async fn by_target(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ByTargetQuery>,
) -> AppResult<Json<Vec<RetroSummary>>> {
    Ok(Json(service::by_target(&state, auth.user_id, query).await?))
}

pub async fn get_retro(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<RetroDetail>> {
    Ok(Json(service::detail(&state, auth.user_id, id).await?))
}

pub async fn update_retro(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<PatchRetroRequest>,
) -> AppResult<Json<RetroDetail>> {
    Ok(Json(service::update(&state, auth.user_id, id, body).await?))
}

pub async fn delete_retro(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::delete(&state, auth.user_id, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn refresh_snapshot(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<RetroDetail>> {
    Ok(Json(
        service::refresh_snapshot(&state, auth.user_id, id).await?,
    ))
}

pub async fn complete_retro(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<RetroDetail>> {
    Ok(Json(service::complete(&state, auth.user_id, id).await?))
}

pub async fn reopen_retro(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<RetroDetail>> {
    Ok(Json(service::reopen(&state, auth.user_id, id).await?))
}

// ── Entries ─────────────────────────────────────────────────────────────────

pub async fn create_entry(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateEntryRequest>,
) -> AppResult<(StatusCode, Json<EntryDto>)> {
    let entry = service::create_entry(&state, auth.user_id, id, body).await?;
    Ok((StatusCode::CREATED, Json(entry)))
}

pub async fn update_section(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((retro_id, section_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<PatchSectionRequest>,
) -> AppResult<Json<SectionDto>> {
    Ok(Json(
        service::update_section_notes(&state, auth.user_id, retro_id, section_id, body).await?,
    ))
}

pub async fn update_entry(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(entry_id): Path<Uuid>,
    Json(body): Json<PatchEntryRequest>,
) -> AppResult<Json<EntryDto>> {
    Ok(Json(
        service::update_entry(&state, auth.user_id, entry_id, body).await?,
    ))
}

pub async fn delete_entry(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(entry_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::delete_entry(&state, auth.user_id, entry_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Links ───────────────────────────────────────────────────────────────────

pub async fn create_link(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateLinkRequest>,
) -> AppResult<(StatusCode, Json<LinkResolved>)> {
    let (link, created) = links::create(&state, auth.user_id, id, body).await?;
    let status = if created {
        StatusCode::CREATED
    } else {
        StatusCode::OK
    };
    Ok((status, Json(link)))
}

pub async fn delete_link(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(link_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    links::delete(&state, auth.user_id, link_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Actions ─────────────────────────────────────────────────────────────────

pub async fn list_actions(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ActionsQuery>,
) -> AppResult<Json<Vec<ActionWithRetro>>> {
    Ok(Json(service::list_actions(&state, auth.user_id, query).await?))
}

pub async fn create_action(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateActionRequest>,
) -> AppResult<(StatusCode, Json<ActionDto>)> {
    let action = service::create_action(&state, auth.user_id, id, body).await?;
    Ok((StatusCode::CREATED, Json(action)))
}

pub async fn update_action(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(action_id): Path<Uuid>,
    Json(body): Json<PatchActionRequest>,
) -> AppResult<Json<ActionDto>> {
    Ok(Json(
        service::update_action(&state, auth.user_id, action_id, body).await?,
    ))
}

pub async fn delete_action(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(action_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::delete_action(&state, auth.user_id, action_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn convert_action(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(action_id): Path<Uuid>,
) -> AppResult<Json<ActionDto>> {
    Ok(Json(
        service::convert_action(&state, auth.user_id, action_id).await?,
    ))
}
