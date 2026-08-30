//! Shared state and HTTP router assembly.

use crate::config::Config;
use crate::http;
use crate::media::ForwardingEngine;
use crate::metrics::Metrics;
use crate::room::RoomManager;
use axum::{Router, routing::get};
use std::sync::Arc;
use tower_http::cors::CorsLayer;

/// What every HTTP and WebSocket handler shares.
#[derive(Clone)]
pub struct AppState {
    pub rooms: Arc<RoomManager>,
    pub metrics: Arc<Metrics>,
    pub engine: Arc<ForwardingEngine>,
    pub config: Arc<Config>,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        AppState {
            rooms: Arc::new(RoomManager::new()),
            metrics: Metrics::new(),
            engine: ForwardingEngine::new(),
            config: Arc::new(config),
        }
    }
}

/// Assembles the server routes.
pub fn build_router(state: AppState) -> Router {
    let serve_test_client = state.config.serve_test_client;

    let mut router = Router::new()
        .route("/ws", get(http::ws::ws_handler))
        .route("/health", get(http::routes::health))
        .route("/metrics", get(http::routes::metrics));

    if serve_test_client {
        router = router.route("/", get(http::routes::test_client));
    }

    router.layer(CorsLayer::permissive()).with_state(state)
}
