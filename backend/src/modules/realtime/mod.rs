//! `realtime` module — WebSocket endpoint for live UI updates.
//!
//! # Overview
//!
//! This module exposes a single WebSocket endpoint at `GET /ws`.  After
//! authentication the server pushes [`models::ServerMessage`]s to the client
//! whenever a [`crate::shared::events::DomainEvent`] fires that belongs to the
//! authenticated user.  This lets the frontend (Kanban board, Calendar, Task
//! list, …) react immediately without polling.
//!
//! # Authentication
//!
//! The browser `WebSocket` API does not support custom HTTP headers, so the
//! client passes its JWT access token as a query-string parameter:
//!
//! ```text
//! wss://api.example.com/ws?token=<access_jwt>
//! ```
//!
//! The handler validates the token before accepting the upgrade.  If the token
//! is absent or invalid a plain HTTP 401 is returned.
//!
//! # Message protocol
//!
//! All messages are JSON-encoded text frames.
//!
//! Client → server:
//! - `{"type":"ping"}` — keepalive probe.
//!
//! Server → client:
//! - `{"type":"connected","user_id":"<uuid>"}` — sent once on connection.
//! - `{"type":"pong"}` — response to a ping.
//! - `{"type":"event","kind":"<event_kind>", …}` — domain event notification.
//! - `{"type":"error","message":"…"}` — non-fatal server-side error.

pub mod handlers;
pub mod models;
pub mod routes;
pub mod service;

pub use routes::router;
