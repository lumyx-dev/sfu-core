//! Point d'entrée WebSocket.

use crate::app::AppState;
use crate::signaling::handle_socket;
use axum::{
    extract::{State, ws::WebSocketUpgrade},
    response::IntoResponse,
};
use std::sync::Arc;
use uuid::Uuid;

/// Attribue un peer_id et bascule la connexion en session de signaling.
pub async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    // `Arc<str>` dès l'attribution : l'identifiant est immuable et suit chaque
    // paquet sur le chemin chaud, où le cloner ne doit rien allouer.
    let peer_id: Arc<str> = Arc::from(Uuid::new_v4().to_string());
    state.metrics.record_connect();
    tracing::info!("Nouveau peer : {}", peer_id);

    ws.on_upgrade(move |socket| handle_socket(socket, peer_id, state))
}
