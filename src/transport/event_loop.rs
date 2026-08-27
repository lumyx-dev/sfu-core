//! Boucle d'événements d'un peer : pompe str0m ↔ socket UDP.

use super::peer_connection::PeerConnection;
use crate::media::RtpPacketData;
use std::sync::Arc;
use std::time::{Duration, Instant};
use str0m::{Candidate, Event, Input, Output, media::MediaKind, net::Receive, net::Transmit};
use tokio::sync::Mutex;
use tokio::sync::mpsc::Sender;
use tokio::sync::mpsc::error::TrySendError;
use tokio::sync::oneshot;

/// Taille du tampon de réception UDP (MTU confortable).
const RECV_BUFFER_SIZE: usize = 2000;

/// Paquets entrants jetés faute de place dans la file du moteur de forwarding.
///
/// Journaliser chaque rejet noierait les logs : une file saturée en produit
/// autant que le publisher émet de paquets, soit des centaines par seconde.
/// Seule la première perte d'une rafale est tracée, avec le total cumulé ; la
/// rafale est close dès qu'un paquet repasse.
#[derive(Default)]
struct IngressDrops {
    total: u64,
    bursting: bool,
}

/// Fait tourner la connexion jusqu'à sa fermeture.
///
/// Alterne entre vider les sorties de str0m (transmissions, événements) et
/// attendre soit un datagramme entrant, soit l'échéance réclamée par str0m.
/// Les paquets média reçus sont poussés sur `rtp_tx` à destination du moteur
/// de forwarding.
///
/// `shutdown` est le signal d'arrêt émis par la session quand la WebSocket se
/// ferme. Il est armé dans le `select!` plutôt que consulté entre deux tours :
/// str0m réclame parfois des échéances lointaines, et la boucle doit sortir
/// sans attendre la prochaine. À sa réception la `Rtc` est fermée proprement
/// (`Rtc::disconnect`) et la boucle rend la main, libérant la socket UDP et sa
/// référence sur la [`PeerConnection`].
///
/// Les datagrammes produits par str0m ne sont pas émis sous le verrou : ils
/// sont accumulés puis envoyés une fois le `MutexGuard` relâché, pour que la
/// task d'écriture RTP du `PeerSink` ne reste pas bloquée derrière une rafale
/// d'appels système.
pub async fn run(
    conn: Arc<Mutex<PeerConnection>>,
    rtp_tx: Sender<(Arc<str>, RtpPacketData)>,
    mut shutdown: oneshot::Receiver<()>,
) {
    let (socket, local_addr, peer_id) = {
        let mut c = conn.lock().await;

        let local_addr = match c.local_ice_addr() {
            Ok(addr) => addr,
            Err(e) => {
                tracing::error!("Peer {} — adresse ICE locale : {}", c.peer_id, e);
                return;
            }
        };

        if let Ok(candidate) = Candidate::host(local_addr, "udp") {
            c.rtc.add_local_candidate(candidate);
        }

        (c.socket.clone(), local_addr, Arc::clone(&c.peer_id))
    };

    let mut buf = vec![0u8; RECV_BUFFER_SIZE];

    // Tampon des datagrammes à émettre, rempli sous verrou et vidé une fois le
    // verrou relâché. Réutilisé d'un tour à l'autre : `drain` le vide sans
    // rendre sa capacité, donc plus aucune allocation en régime établi.
    let mut outbound: Vec<Transmit> = Vec::new();
    let mut ingress_drops = IngressDrops::default();

    loop {
        let timeout = {
            let mut c = conn.lock().await;

            // Une `Rtc` fermée — par `disconnect` ou par un échec interne — ne
            // produit plus ni transmission ni événement, et ne rend qu'une
            // échéance « jamais ». Continuer reviendrait à dormir indéfiniment
            // en tenant la socket.
            if !c.rtc.is_alive() {
                tracing::debug!("Peer {} — Rtc fermée, arrêt de la boucle", c.peer_id);
                break;
            }

            loop {
                match c.rtc.poll_output() {
                    Ok(Output::Timeout(t)) => break t,
                    // Mis de côté, pas émis : voir la boucle d'envoi ci-dessous.
                    Ok(Output::Transmit(t)) => outbound.push(t),
                    Ok(Output::Event(event)) => {
                        handle_event(&mut c, event, &rtp_tx, &mut ingress_drops)
                    }
                    Err(e) => {
                        tracing::error!("Peer {} — poll_output : {}", c.peer_id, e);
                        return;
                    }
                }
            }
        };

        // Le `MutexGuard` est tombé à la ligne précédente : les appels système
        // d'émission ont lieu hors section critique, donc ingress et egress ne
        // sont plus sérialisés. L'ordre reste celui où str0m a produit les
        // datagrammes — `push` puis `drain` préservent le FIFO, et c'est un
        // protocole réseau : l'ordre compte.
        for transmit in outbound.drain(..) {
            let _ = socket
                .send_to(&transmit.contents, transmit.destination)
                .await;
        }

        let now = Instant::now();
        let duration = timeout.saturating_duration_since(now).max(Duration::ZERO);

        tokio::select! {
            // Un `Err` vaut un `Ok` : il signifie que la session a été lâchée
            // sans envoyer le signal, ce qui est tout autant une fin de vie.
            _ = &mut shutdown => {
                let mut c = conn.lock().await;
                c.rtc.disconnect();
                tracing::debug!("Peer {} — session terminée, Rtc fermée", c.peer_id);
                break;
            }
            result = socket.recv_from(&mut buf) => {
                match result {
                    Ok((len, addr)) => {
                        let mut c = conn.lock().await;
                        c.remote_addr = Some(addr);
                        if let Ok(contents) = buf[..len].try_into() {
                            let _ = c.rtc.handle_input(Input::Receive(
                                Instant::now(),
                                Receive {
                                    proto: str0m::net::Protocol::Udp,
                                    source: addr,
                                    destination: local_addr,
                                    contents,
                                },
                            ));
                        }
                    }
                    Err(e) => {
                        tracing::error!("Peer UDP error : {}", e);
                        break;
                    }
                }
            }
            _ = tokio::time::sleep(duration) => {
                let mut c = conn.lock().await;
                let _ = c.rtc.handle_input(Input::Timeout(Instant::now()));
            }
        }
    }

    // `socket` et le clone d'`Arc` sur la `PeerConnection` tombent ici : c'est
    // la première maille du démontage qui rend le descripteur UDP au système.
    tracing::debug!("Peer {} — boucle d'événements terminée", peer_id);
}

/// Traite un événement str0m.
fn handle_event(
    conn: &mut PeerConnection,
    event: Event,
    rtp_tx: &Sender<(Arc<str>, RtpPacketData)>,
    drops: &mut IngressDrops,
) {
    match event {
        Event::Connected => {
            tracing::info!("✅ Peer {} connecté (ICE + DTLS)", conn.peer_id);
        }
        Event::IceConnectionStateChange(state) => {
            tracing::info!("Peer {} ICE : {:?}", conn.peer_id, state);
        }
        Event::MediaAdded(media) => {
            tracing::info!(
                "✅ Peer {} media ajouté : {:?} mid={:?}",
                conn.peer_id,
                media.kind,
                media.mid
            );
            conn.tx_streams.insert(media.mid, media.kind);
            conn.mid_kind.insert(media.mid, media.kind);
        }
        Event::MediaData(data) => {
            let packet = to_packet(conn, data);
            // `Arc::clone` : le peer_id ne change jamais, l'émettre par paquet
            // n'a plus à le réallouer.
            match rtp_tx.try_send((Arc::clone(&conn.peer_id), packet)) {
                Ok(()) => drops.bursting = false,
                // Média temps réel : le moteur est en retard, ce paquet ne vaut
                // déjà plus rien. On le jette plutôt que d'attendre.
                Err(TrySendError::Full(_)) => {
                    drops.total += 1;
                    if !drops.bursting {
                        drops.bursting = true;
                        tracing::warn!(
                            "Peer {} — file de forwarding pleine, paquet entrant jeté (total {})",
                            conn.peer_id,
                            drops.total
                        );
                    }
                }
                // La session est partie : absorber en silence est le cas normal.
                Err(TrySendError::Closed(_)) => {}
            }
        }
        Event::KeyframeRequest(_) => {
            tracing::info!("Peer {} — keyframe request reçue", conn.peer_id);
        }
        _ => {}
    }
}

/// Convertit un `MediaData` str0m en paquet interne, en rebasant l'horodatage
/// sur l'horloge RTP du type de média (90 kHz vidéo, 48 kHz audio).
///
/// Le `MediaData` est consommé : son champ `data` — déjà un `Arc<[u8]>` — est
/// déplacé tel quel dans le paquet, sans conversion ni copie. C'est le même
/// type que celui attendu par `Writer::write` à la sortie, si bien que le
/// tampon reçu de str0m est celui qui lui est rendu.
fn to_packet(conn: &PeerConnection, data: str0m::media::MediaData) -> RtpPacketData {
    let mid = data.mid;
    let is_video = conn
        .mid_kind
        .get(&mid)
        .map(|k| *k == MediaKind::Video)
        .unwrap_or(false);

    let freq = if is_video {
        str0m::media::Frequency::NINETY_KHZ
    } else {
        str0m::media::Frequency::FORTY_EIGHT_KHZ
    };

    RtpPacketData {
        payload_type: *data.pt,
        sequence_number: 0,
        timestamp: data.time.as_seconds() as u32,
        ssrc: 0,
        payload: data.data,
        is_keyframe: data.contiguous,
        mid,
        network_time: data.network_time,
        rtp_time: data.time.rebase(freq).numer(),
        is_video,
    }
}
