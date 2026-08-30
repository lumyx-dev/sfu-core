//! WebSocket entry point.

use crate::app::AppState;
use crate::signaling::handle_socket;
use axum::{
    extract::{State, ws::WebSocketUpgrade},
    response::IntoResponse,
};
use std::sync::Arc;
use uuid::Uuid;

/// Assigns a peer_id and hands the connection over to a signaling session.
pub async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    // `Arc<str>` from the moment it is assigned: the identifier is immutable
    // and follows every packet on the hot path, where cloning it must allocate
    // nothing.
    let peer_id: Arc<str> = Arc::from(Uuid::new_v4().to_string());
    state.metrics.record_connect();
    tracing::info!("Nouveau peer : {}", peer_id);

    ws.on_upgrade(move |socket| handle_socket(socket, peer_id, state))
}
