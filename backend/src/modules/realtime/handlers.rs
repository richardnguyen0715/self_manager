//! Realtime module — WebSocket handler.
//!
//! # Authentication
//!
//! The standard [`crate::shared::extractors::AuthUser`] extractor cannot be
//! used here because the WebSocket upgrade is a GET request and browser
//! `WebSocket` objects do not support custom request headers.  Instead, the
//! client passes its JWT access token as the `token` query-string parameter:
//!
//! ```
//! wss://api.example.com/ws?token=<access_jwt>
//! ```
//!
//! The handler validates the token manually before accepting the upgrade.
//!
//! # Message flow
//!
//! ```text
//! client ──upgrade──► handler ──accept──► socket task
//!                                          │
//!                        ┌────────────────►│◄── domain event broadcast
//!                        │  forward events │    (filtered to this user_id)
//!                        └────────────────►│
//!                                          │
//!                         client ping ────►│──► pong
//!                         client close ───►│   (task exits cleanly)
//! ```
//!
//! Each connection spawns a dedicated Tokio task that owns the socket.  The
//! task subscribes to the [`tokio::sync::broadcast`] channel stored in
//! [`AppState`] and forwards only events that belong to the authenticated user.
//!
//! Lagging subscribers (slow clients) receive a `RecvError::Lagged` error —
//! the handler logs the dropped count and continues without disconnecting the
//! client.

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    response::IntoResponse,
};
use serde::Deserialize;
use tokio::sync::broadcast::error::RecvError;
use tracing::{debug, info, warn};
use uuid::Uuid;

use crate::shared::{
    error::AppError,
    jwt::{decode_token, TokenType},
    state::AppState,
};

use super::{
    models::{ClientMessage, ServerMessage},
    service::{domain_event_to_server_message, event_user_id},
};

// ── Query-string extractor ─────────────────────────────────────────────────────

/// Query parameters accepted on the `/ws` endpoint.
#[derive(Debug, Deserialize)]
pub struct WsQuery {
    /// JWT access token (required).
    pub token: Option<String>,
}

// ── Upgrade handler ────────────────────────────────────────────────────────────

/// `GET /ws?token=<jwt>`
///
/// Performs the HTTP → WebSocket upgrade after validating the bearer token
/// supplied in the query string.  Returns a plain 401 response (not a WebSocket
/// error frame) when the token is missing or invalid, so that the browser can
/// distinguish auth failures from server errors.
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<WsQuery>,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, AppError> {
    // Validate token before accepting the upgrade.
    let token = query
        .token
        .ok_or_else(|| AppError::UnauthorizedMsg("missing `token` query parameter".to_owned()))?;

    let claims = decode_token(&state.config, &token)?;

    if claims.token_type != TokenType::Access {
        return Err(AppError::UnauthorizedMsg(
            "expected an access token".to_owned(),
        ));
    }

    let user_id: Uuid = claims.sub;

    info!(%user_id, "WebSocket upgrade accepted");

    // Clone only what the spawned task needs.
    let mut rx = state.events.subscribe();

    Ok(ws.on_upgrade(move |socket| async move {
        handle_socket(socket, user_id, &mut rx).await;
    }))
}

// ── Per-connection task ────────────────────────────────────────────────────────

/// Drive a single WebSocket connection to completion.
///
/// The function returns (and the task exits) when either the client closes the
/// connection or the socket encounters an unrecoverable error.
async fn handle_socket(
    mut socket: WebSocket,
    user_id: Uuid,
    rx: &mut tokio::sync::broadcast::Receiver<crate::shared::events::DomainEvent>,
) {
    // Greet the client so it knows it is authenticated.
    if send_msg(&mut socket, &ServerMessage::Connected { user_id })
        .await
        .is_err()
    {
        return;
    }

    loop {
        tokio::select! {
            // ── Inbound from client ────────────────────────────────────────────
            maybe_msg = socket.recv() => {
                match maybe_msg {
                    None => {
                        // Socket closed cleanly by the client.
                        debug!(%user_id, "WebSocket closed by client");
                        break;
                    }
                    Some(Err(err)) => {
                        warn!(%user_id, %err, "WebSocket receive error");
                        break;
                    }
                    Some(Ok(raw)) => {
                        handle_client_message(&mut socket, user_id, raw).await;
                    }
                }
            }

            // ── Outbound from broadcast channel ───────────────────────────────
            recv_result = rx.recv() => {
                match recv_result {
                    Err(RecvError::Closed) => {
                        // Broadcast channel shut down — server is shutting down.
                        debug!(%user_id, "broadcast channel closed; closing WebSocket");
                        break;
                    }
                    Err(RecvError::Lagged(count)) => {
                        warn!(%user_id, count, "WebSocket subscriber lagged; dropped events");
                        // Continue — do not disconnect the client for being slow.
                    }
                    Ok(event) => {
                        // Only forward events that belong to this user.
                        if event_user_id(&event) != user_id {
                            continue;
                        }
                        if let Some(msg) = domain_event_to_server_message(&event) {
                            if send_msg(&mut socket, &msg).await.is_err() {
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    debug!(%user_id, "WebSocket task exiting");
}

/// Parse and respond to a single inbound [`ClientMessage`].
///
/// Unknown or malformed frames are silently discarded so that future client
/// versions can introduce new message types without breaking the connection.
async fn handle_client_message(socket: &mut WebSocket, user_id: Uuid, raw: Message) {
    let text = match raw {
        Message::Text(t) => t,
        Message::Close(_) => {
            debug!(%user_id, "received Close frame");
            return;
        }
        // Ping/Pong frames are handled transparently by the `axum::extract::ws`
        // layer; we only need to act on Text frames.
        _ => return,
    };

    let client_msg: ClientMessage = match serde_json::from_str(&text) {
        Ok(m) => m,
        Err(err) => {
            debug!(%user_id, %err, raw = %text, "unparseable client message; ignoring");
            return;
        }
    };

    match client_msg {
        ClientMessage::Ping => {
            let _ = send_msg(socket, &ServerMessage::Pong).await;
        }
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/// Serialise a [`ServerMessage`] and send it as a UTF-8 text frame.
///
/// Returns `Err(())` on any send failure so callers can break the connection
/// loop without propagating error details (they have already been logged by
/// the underlying transport layer).
async fn send_msg(socket: &mut WebSocket, msg: &ServerMessage) -> Result<(), ()> {
    let text = serde_json::to_string(msg).map_err(|err| {
        warn!(%err, "failed to serialise ServerMessage");
    })?;

    socket
        .send(Message::Text(text.into()))
        .await
        .map_err(|err| {
            debug!(%err, "WebSocket send failed");
        })
}
