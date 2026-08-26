use rand::RngExt;
use std::sync::Arc;
use std::sync::atomic::{AtomicU16, AtomicU32, Ordering};

/// Représente un flux RTP reçu d'un publisher
#[derive(Debug, Clone)]
pub struct RtpPacketData {
    pub payload_type: u8,
    pub sequence_number: u16,
    pub timestamp: u32,
    pub ssrc: u32,
    pub payload: Vec<u8>,
    pub is_keyframe: bool,
    pub mid: String,
    pub network_time: std::time::Instant,
    pub rtp_time: u64,
    pub is_video: bool,
}

/// UpTrack — reçoit les paquets RTP d'un publisher
pub struct UpTrack {
    pub track_id: String,
    pub peer_id: String,
    pub is_video: bool,
    /// liste des DownTracks abonnés à ce flux
    down_tracks: Arc<dashmap::DashMap<String, Arc<DownTrack>>>,
}

impl UpTrack {
    pub fn new(track_id: String, peer_id: String, is_video: bool) -> Self {
        UpTrack {
            track_id,
            peer_id,
            is_video,
            down_tracks: Arc::new(dashmap::DashMap::new()),
        }
    }

    pub fn get_down_track(&self, peer_id: &str) -> Option<Arc<DownTrack>> {
        self.down_tracks.get(peer_id).map(|d| d.clone())
    }

    /// Ajoute un subscriber
    pub fn add_subscriber(&self, peer_id: String, down_track: Arc<DownTrack>) {
        self.down_tracks.insert(peer_id, down_track);
    }

    /// Retire un subscriber
    pub fn remove_subscriber(&self, peer_id: &str) {
        self.down_tracks.remove(peer_id);
    }

    /// Forward un paquet RTP à tous les subscribers
    pub fn forward(&self, packet: &RtpPacketData) {
        for entry in self.down_tracks.iter() {
            entry.value().write_rtp(packet);
        }
    }

    pub fn subscriber_count(&self) -> usize {
        self.down_tracks.len()
    }
}

/// DownTrack — forward les paquets RTP vers un subscriber
/// avec remapping SSRC + sequence number + timestamp
pub struct DownTrack {
    pub peer_id: String,
    pub track_id: String,

    /// SSRC unique généré pour ce DownTrack
    ssrc: u32,

    /// Séquence RTP indépendante par subscriber
    sequence_number: AtomicU16,

    /// Offset de timestamp pour la synchronisation
    timestamp_offset: AtomicU32,

    /// Canal pour envoyer les paquets remappés
    sender: tokio::sync::mpsc::UnboundedSender<RtpPacketData>,
}

impl DownTrack {
    pub fn new(
        peer_id: String,
        track_id: String,
        sender: tokio::sync::mpsc::UnboundedSender<RtpPacketData>,
    ) -> Self {
        let mut rng = rand::rng();

        DownTrack {
            peer_id,
            track_id,
            ssrc: rng.random::<u32>(), // SSRC unique aléatoire
            sequence_number: AtomicU16::new(rng.random::<u16>()), // séquence aléatoire
            timestamp_offset: AtomicU32::new(rng.random::<u32>()), // offset aléatoire
            sender,
        }
    }

    /// Réécrit et forward le paquet RTP
    pub fn write_rtp(&self, packet: &RtpPacketData) {
        let seq = self.sequence_number.fetch_add(1, Ordering::Relaxed);
        let ts_offset = self.timestamp_offset.load(Ordering::Relaxed);

        let rewritten = RtpPacketData {
            payload_type: packet.payload_type,
            sequence_number: seq, // séquence locale
            timestamp: packet.timestamp.wrapping_add(ts_offset), // timestamp remappé
            ssrc: self.ssrc,      // SSRC local unique
            payload: packet.payload.clone(),
            is_keyframe: packet.is_keyframe,
            mid: packet.mid.clone(),
            network_time: packet.network_time,
            is_video: packet.is_video,
            rtp_time: packet.rtp_time,
        };

        let _ = self.sender.send(rewritten);
    }
}
