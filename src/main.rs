mod metrics;
mod peer;
mod room;
mod signaling;

use axum::{
    Router,
    extract::{
        State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    response::{Html, IntoResponse},
    routing::get,
};
use axum_server::tls_rustls::RustlsConfig;
use futures::{sink::SinkExt, stream::StreamExt};
use metrics::Metrics;
use room::{RoomManager, RoomPeer};
use signaling::{ClientMessage, ServerMessage};
use std::{collections::HashMap, net::SocketAddr, sync::Arc};
use tokio::sync::{Mutex, broadcast};
use tower_http::cors::CorsLayer;
use uuid::Uuid;

use crate::peer::{ForwardingEngine, PeerConnection};

#[derive(Clone)]
struct AppState {
    rooms: Arc<RoomManager>,
    metrics: Arc<Metrics>,
    connections: Arc<Mutex<HashMap<String, Arc<Mutex<PeerConnection>>>>>,
    engine: Arc<ForwardingEngine>,
}

#[tokio::main]
async fn main() {
    println!("🚀 Sightline SFU démarrage...");

    tracing_subscriber::fmt().with_env_filter("debug").init();

    let state = AppState {
        rooms: Arc::new(RoomManager::new()),
        metrics: Metrics::new(),
        connections: Arc::new(Mutex::new(HashMap::new())),
        engine: ForwardingEngine::new(),
    };

    let app = Router::new()
        .route("/ws", get(ws_handler))
        .route("/health", get(health_handler))
        .route("/metrics", get(metrics_handler))
        .route("/", get(client_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let cert_path = format!("{}/localhost+1.pem", manifest_dir);
    let key_path = format!("{}/localhost+1-key.pem", manifest_dir);

    let config = RustlsConfig::from_pem_file(&cert_path, &key_path)
        .await
        .unwrap_or_else(|e| {
            eprintln!("❌ Certificat TLS introuvable ou illisible : {e}");
            eprintln!("   attendu : {cert_path}");
            eprintln!("            {key_path}");
            eprintln!();
            eprintln!("   Les certificats ne sont pas versionnés — génère-les une fois :");
            eprintln!("     mkcert -install && cd apps/sfu && mkcert localhost 127.0.0.1");
            std::process::exit(1);
        });

    let addr: SocketAddr = "0.0.0.0:3000".parse().unwrap();
    tracing::info!("✅ Serveur HTTPS sur https://localhost:3000");

    axum_server::bind_rustls(addr, config)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

async fn health_handler() -> impl IntoResponse {
    axum::Json(serde_json::json!({ "status": "ok", "version": "0.1.0" }))
}

async fn metrics_handler(State(state): State<AppState>) -> impl IntoResponse {
    axum::Json(serde_json::json!({
        "rooms": state.rooms.room_count(),
        "peers": state.rooms.peer_count(),
        "metrics": state.metrics.snapshot(),
    }))
}

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    let peer_id = Uuid::new_v4().to_string();
    state.metrics.record_connect();
    tracing::info!("Nouveau peer : {}", peer_id);

    ws.on_upgrade(move |socket| handle_socket(socket, peer_id, state))
}

async fn handle_socket(socket: WebSocket, peer_id: String, state: AppState) {
    let (mut ws_sender, mut ws_receiver) = socket.split();
    let (tx, mut rx) = broadcast::channel::<ServerMessage>(100);

    // crée la connexion WebRTC
    let conn = Arc::new(Mutex::new(
        PeerConnection::new(peer_id.clone(), tx.clone()).await,
    ));

    // canal RTP
    let (rtp_tx, mut rtp_rx) =
        tokio::sync::mpsc::unbounded_channel::<(String, peer::RtpPacketData)>();

    // lance la boucle WebRTC en background
    let conn_clone = conn.clone();
    let rtp_tx_clone = rtp_tx.clone();
    tokio::spawn(async move {
        PeerConnection::run(conn_clone, rtp_tx_clone).await;
    });

    // stocke la connexion
    {
        let mut connections = state.connections.lock().await;
        connections.insert(peer_id.clone(), conn.clone());
    }

    // ajoute le peer au ForwardingEngine
    state.engine.add_peer(peer_id.clone(), conn.clone());

    // task RTP → ForwardingEngine
    let engine_clone = state.engine.clone();
    let peer_id_rtp = peer_id.clone();
    tokio::spawn(async move {
        while let Some((from_peer_id, packet)) = rtp_rx.recv().await {
            engine_clone.forward_rtp(&from_peer_id, packet).await;
        }
        tracing::debug!("Peer {} — rtp task terminée", peer_id_rtp);
    });

    // task messages sortants WebSocket
    let peer_id_clone = peer_id.clone();
    tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            let json = match serde_json::to_string(&msg) {
                Ok(j) => j,
                Err(e) => {
                    tracing::error!("Erreur sérialisation : {}", e);
                    continue;
                }
            };
            if ws_sender.send(Message::Text(json.into())).await.is_err() {
                break;
            }
        }
        tracing::debug!("Peer {} — sender task terminée", peer_id_clone);
    });

    // envoie connected
    let _ = tx.send(ServerMessage::Connected {
        peer_id: peer_id.clone(),
    });

    // boucle principale
    while let Some(Ok(msg)) = ws_receiver.next().await {
        match msg {
            Message::Text(text) => match serde_json::from_str::<ClientMessage>(&text) {
                Ok(client_msg) => {
                    handle_message(client_msg, &peer_id, &tx, &state, &conn).await;
                }
                Err(e) => {
                    tracing::warn!("Message invalide : {}", e);
                    let _ = tx.send(ServerMessage::Error {
                        message: format!("Message invalide : {}", e),
                    });
                }
            },
            Message::Close(_) => break,
            _ => {}
        }
    }

    // nettoyage
    state.rooms.leave_room(&peer_id);
    state.engine.remove_peer(&peer_id);
    state.metrics.record_disconnect();
    {
        let mut connections = state.connections.lock().await;
        connections.remove(&peer_id);
    }
    tracing::info!("Peer {} déconnecté", peer_id);
}

async fn handle_message(
    msg: ClientMessage,
    peer_id: &str,
    tx: &broadcast::Sender<ServerMessage>,
    state: &AppState,
    conn: &Arc<Mutex<PeerConnection>>,
) {
    match msg {
        ClientMessage::Offer { sdp, .. } => {
            tracing::debug!("Peer {} — offer P2P reçue", peer_id);
        }
        ClientMessage::Join {
            room_id,
            peer_id: _,
        } => {
            let room_peer = RoomPeer {
                peer_id: peer_id.to_string(),
                sender: tx.clone(),
            };
            let existing_peers = state.rooms.join_room(&room_id, room_peer);
            let _ = tx.send(ServerMessage::JoinedRoom {
                room_id,
                peers: existing_peers,
            });
            tracing::info!("Peer {} a rejoint la room", peer_id);
        }

        ClientMessage::SfuOffer { sdp } => {
            tracing::info!("Peer {} — SFU offer reçue", peer_id);
            let mut c = conn.lock().await;
            match c.handle_offer(&sdp) {
                Ok(_) => tracing::info!("Peer {} — offer traitée ✅", peer_id),
                Err(e) => {
                    tracing::error!("Peer {} — erreur offer : {}", peer_id, e);
                    let _ = tx.send(ServerMessage::Error {
                        message: format!("Erreur offer : {}", e),
                    });
                }
            }
        }

        ClientMessage::SfuIceCandidate { candidate } => {
            tracing::debug!("Peer {} — ICE candidate reçu", peer_id);
            let mut c = conn.lock().await;
            c.add_remote_candidate(&candidate);
        }

        ClientMessage::Answer {
            sdp,
            target_peer_id,
        } => {
            state.rooms.send_to(
                &target_peer_id,
                ServerMessage::Offer {
                    sdp,
                    from_peer_id: peer_id.to_string(),
                },
            );
        }

        ClientMessage::IceCandidate {
            candidate,
            target_peer_id,
        } => {
            tracing::debug!("Peer {} — ICE candidate pour {}", peer_id, target_peer_id);
        }

        ClientMessage::Leave => {
            state.rooms.leave_room(peer_id);
            tracing::info!("Peer {} a quitté la room", peer_id);
        }
    }
}

async fn client_handler() -> Html<String> {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let path = format!("{}/test.html", manifest_dir);
    let html = std::fs::read_to_string(path)
        .unwrap_or_else(|_| String::from("<h1>test.html not found</h1>"));
    Html(html)
}
