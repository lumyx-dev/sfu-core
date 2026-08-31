//! Identity of a track published into the SFU.

use std::sync::Arc;
use str0m::media::Mid;

/// A published track: the peer that publishes it, and the m-line it arrives on.
///
/// # Why the mid belongs in the key
///
/// A peer publishes several tracks at once — an audio one and a video one at
/// the very least — and every one of them needs its own outbound m-line on
/// each subscriber. Keying by `peer_id` alone conflated them, and the whole
/// routing table with them: two sources ended up sharing one destination
/// stream, which is the same thing as handing a decoder two interleaved
/// videos.
///
/// The `mid` used here is the **publisher's**, the one str0m reports on
/// `Event::MediaAdded` and carries on every `MediaData`. It never travels to a
/// subscriber as is: [`crate::media::DownTrack`] swaps it for the m-line
/// allocated on that subscriber's own connection.
///
/// `peer_id` is an `Arc<str>` for the same reason it is one everywhere else on
/// the hot path: the key is cloned per packet per subscriber, and that must be
/// a refcount bump rather than an allocation.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct TrackKey {
    pub peer_id: Arc<str>,
    pub mid: Mid,
}

impl TrackKey {
    pub fn new(peer_id: Arc<str>, mid: Mid) -> Self {
        TrackKey { peer_id, mid }
    }
}

impl std::fmt::Display for TrackKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}#{}", self.peer_id, self.mid)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn two_mids_of_the_same_peer_are_two_distinct_tracks() {
        let audio = TrackKey::new(Arc::from("alice"), Mid::from("0"));
        let video = TrackKey::new(Arc::from("alice"), Mid::from("1"));

        assert_ne!(audio, video);

        let mut set = HashSet::new();
        set.insert(audio);
        set.insert(video);
        assert_eq!(set.len(), 2, "l'audio et la vidéo d'un peer sont deux clés");
    }

    #[test]
    fn the_same_mid_of_two_peers_are_two_distinct_tracks() {
        // This is the collision the SFU used to have: every browser numbers its
        // m-lines the same way, so the mid alone identifies nothing.
        let alice = TrackKey::new(Arc::from("alice"), Mid::from("1"));
        let bob = TrackKey::new(Arc::from("bob"), Mid::from("1"));

        assert_ne!(alice, bob);
    }

    #[test]
    fn the_key_is_stable_across_clones() {
        let key = TrackKey::new(Arc::from("alice"), Mid::from("1"));
        assert_eq!(key.clone(), key);
    }
}
