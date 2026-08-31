//! Service routes.

use crate::app::AppState;
use axum::{
    extract::State,
    response::{Html, IntoResponse},
};

/// Liveness probe.
pub async fn health() -> impl IntoResponse {
    axum::Json(serde_json::json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

/// Operational counters.
pub async fn metrics(State(state): State<AppState>) -> impl IntoResponse {
    axum::Json(serde_json::json!({
        "rooms": state.rooms.room_count(),
        "peers": state.rooms.peer_count(),
        "metrics": state.metrics.snapshot(),
    }))
}

/// Test client shipped with the server. The route is mounted only when
/// `Config::serve_test_client` is enabled.
pub async fn test_client(State(state): State<AppState>) -> Html<String> {
    let path = state.config.test_client_path();
    match std::fs::read_to_string(&path) {
        Ok(html) => Html(html),
        Err(e) => {
            tracing::warn!("Client de test illisible ({}) : {}", path.display(), e);
            Html("<h1>test.html not found</h1>".to_string())
        }
    }
}
