//! Destination d'un flux RTP sortant.

use super::packet::RtpPacketData;

/// Où [`crate::media::ForwardingEngine`] dépose les paquets destinés à un peer.
///
/// C'est la frontière entre la couche média et la couche transport : le moteur
/// de forwarding manipule des `Arc<dyn RtpSink>` sans jamais voir une
/// `PeerConnection`. L'implémentation de production est
/// [`crate::transport::PeerSink`] ; les tests injectent un sink en mémoire.
///
/// Les deux méthodes doivent être non bloquantes — elles sont appelées depuis
/// le chemin chaud, une fois par paquet et par subscriber.
pub trait RtpSink: Send + Sync {
    /// Remet un paquet au peer. Un sink fermé absorbe silencieusement.
    fn write_rtp(&self, packet: RtpPacketData);

    /// Demande une keyframe au peer (PLI).
    fn request_keyframe(&self);
}
