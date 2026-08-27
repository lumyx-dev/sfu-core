//! Cycle de vie d'une session WebSocket.

use super::dispatch::handle_message;
use super::messages::{ClientMessage, ServerMessage};
use crate::app::AppState;
use crate::media::{ForwardingEngine, RtpPacketData, RtpSink};
use crate::transport::{PeerConnection, PeerSink, event_loop};
use axum::extract::ws::{Message, WebSocket};
use futures::sink::SinkExt;
use futures::stream::{SplitSink, StreamExt};
use std::sync::Arc;
use tokio::sync::mpsc::{self, Receiver};
use tokio::sync::{Mutex, oneshot};

/// Profondeur du canal de signaling sortant.
const SIGNALING_CHANNEL_CAPACITY: usize = 100;

/// Profondeur du canal des paquets entrants, du transport vers le moteur.
///
/// Ce canal ne porte que le flux d'un seul publisher — celui de ce peer. À
/// ~150 paquets/s pour de la vidéo 1080p, 128 paquets valent **~850 ms de
/// média**. Comme la file du `PeerSink` en sortie, il est borné et jette au
/// lieu d'accumuler : un paquet vieux de près d'une seconde n'a plus de valeur
/// pour un participant, et le laisser s'empiler ferait monter mémoire et
/// latence sans jamais rattraper le retard.
const RTP_INGRESS_CAPACITY: usize = 128;

/// Pilote une session de bout en bout : établit la connexion WebRTC, câble le
/// forwarding, boucle sur les messages entrants, puis nettoie à la fermeture.
pub async fn handle_socket(socket: WebSocket, peer_id: Arc<str>, state: AppState) {
    let (ws_sender, mut ws_receiver) = socket.split();
    // Canal borné multi-producteurs / mono-consommateur : tous les émetteurs de
    // signaling écrivent ici, seule la task de la WebSocket lit. Borné pour
    // qu'un client bloqué ne fasse pas enfler la mémoire.
    let (tx, rx) = mpsc::channel::<ServerMessage>(SIGNALING_CHANNEL_CAPACITY);

    let conn = Arc::new(Mutex::new(
        PeerConnection::new(
            Arc::clone(&peer_id),
            tx.clone(),
            state.config.ice_host.clone(),
        )
        .await,
    ));

    // Boucle WebRTC : sort les paquets média reçus sur `rtp_rx`.
    //
    // La boucle attend indéfiniment sur la socket et sur les échéances de
    // str0m ; rien dans son cycle de vie ne la relie à la WebSocket. Sans
    // signal explicite elle survivrait à la session, gardant vivants la `Rtc`
    // et le descripteur UDP. `shutdown_tx` est armé pour toute la durée de la
    // session et déclenché à sa sortie.
    let (rtp_tx, rtp_rx) =
        tokio::sync::mpsc::channel::<(Arc<str>, RtpPacketData)>(RTP_INGRESS_CAPACITY);
    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
    tokio::spawn(event_loop::run(conn.clone(), rtp_tx, shutdown_rx));

    // Le sink existe dès la connexion — la task d'écriture doit tourner avant
    // le premier paquet — mais le moteur ne le connaîtra qu'au `Join` : un peer
    // qui n'a rejoint aucune room ne reçoit rien et ne diffuse rien. Le garder
    // ici le maintient vivant pour toute la durée de la session.
    let sink: Arc<dyn RtpSink> = PeerSink::new(Arc::clone(&peer_id), conn.clone());

    spawn_forwarding_pump(state.engine.clone(), Arc::clone(&peer_id), rtp_rx);
    spawn_signaling_pump(Arc::clone(&peer_id), rx, ws_sender);

    let _ = tx
        .send(ServerMessage::Connected {
            peer_id: peer_id.to_string(),
        })
        .await;

    while let Some(Ok(msg)) = ws_receiver.next().await {
        match msg {
            Message::Text(text) => match serde_json::from_str::<ClientMessage>(&text) {
                Ok(client_msg) => {
                    handle_message(client_msg, &peer_id, &tx, &state, &conn, &sink).await
                }
                Err(e) => {
                    tracing::warn!("Message invalide : {}", e);
                    let _ = tx
                        .send(ServerMessage::Error {
                            message: format!("Message invalide : {}", e),
                        })
                        .await;
                }
            },
            Message::Close(_) => break,
            _ => {}
        }
    }

    // Ordre du démontage : la boucle d'événements d'abord — elle relâche la
    // socket et sa référence sur la `PeerConnection` —, puis les registres, qui
    // relâchent le `PeerSink` et les down_tracks que les autres publishers
    // tenaient sur lui. Le dernier `Arc` sur le sink tombe au retour de cette
    // fonction : sa file se ferme, sa task d'écriture sort, et la
    // `PeerConnection` — donc la socket UDP — est enfin détruite.
    let _ = shutdown_tx.send(());

    state.rooms.leave_room(&peer_id);
    state.engine.remove_peer(&peer_id);
    state.metrics.record_disconnect();
    tracing::info!("Peer {} déconnecté", peer_id);
}

/// Draine les paquets média du peer vers le moteur de forwarding.
fn spawn_forwarding_pump(
    engine: Arc<ForwardingEngine>,
    peer_id: Arc<str>,
    mut rtp_rx: Receiver<(Arc<str>, RtpPacketData)>,
) {
    tokio::spawn(async move {
        while let Some((from_peer_id, packet)) = rtp_rx.recv().await {
            engine.forward_rtp(&from_peer_id, packet);
        }
        tracing::debug!("Peer {} — task de forwarding terminée", peer_id);
    });
}

/// Sérialise et pousse les messages de signaling sur la WebSocket.
fn spawn_signaling_pump(
    peer_id: Arc<str>,
    mut rx: mpsc::Receiver<ServerMessage>,
    mut ws_sender: SplitSink<WebSocket, Message>,
) {
    tokio::spawn(async move {
        // `recv` ne rend `None` qu'une fois tous les émetteurs tombés : la task
        // ne peut plus mourir sur un retard de consommation.
        while let Some(msg) = rx.recv().await {
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
        tracing::debug!("Peer {} — task de signaling terminée", peer_id);
    });
}
