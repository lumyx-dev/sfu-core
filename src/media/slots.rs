//! Réserve de m-lines sortantes pré-négociées.

use std::sync::Mutex;
use str0m::media::Mid;

/// Les m-lines qu'un peer a négociées pour *recevoir*, et qui restent libres.
///
/// Un SFU doit écrire chaque flux distant sur une m-line distincte du
/// subscriber : deux publishers routés vers le même `Mid` produiraient un seul
/// flux RTP entrelaçant deux encodeurs, indécodable. La réserve attribue une
/// m-line par abonnement et la récupère à la fin.
///
/// Les m-lines sont ici **pré-négociées** : le client en déclare un lot dès son
/// offre initiale et le serveur y puise. Cela plafonne le nombre de flux qu'un
/// peer peut recevoir, mais évite toute renégociation en cours de session — le
/// serveur n'a jamais d'offre à émettre.
///
/// Verrous `std` et non `tokio` : les sections critiques sont un `push`/`pop`
/// de `Vec`, et les appelants sont synchrones (chemin chaud du forwarding).
pub struct SlotPool {
    audio: Mutex<Vec<Mid>>,
    video: Mutex<Vec<Mid>>,
}

impl Default for SlotPool {
    fn default() -> Self {
        Self::new()
    }
}

impl SlotPool {
    pub fn new() -> Self {
        SlotPool {
            audio: Mutex::new(Vec::new()),
            video: Mutex::new(Vec::new()),
        }
    }

    /// Déclare une m-line disponible. Appelé à la négociation, une fois par mid.
    pub fn offer(&self, mid: Mid, is_video: bool) {
        let mut free = self.lock(is_video);
        if !free.contains(&mid) {
            free.push(mid);
        }
    }

    /// Réserve une m-line libre, s'il en reste.
    pub fn take(&self, is_video: bool) -> Option<Mid> {
        self.lock(is_video).pop()
    }

    /// Rend une m-line à la réserve.
    pub fn release(&self, mid: Mid, is_video: bool) {
        let mut free = self.lock(is_video);
        if !free.contains(&mid) {
            free.push(mid);
        }
    }

    /// Nombre de m-lines encore libres pour ce type de média.
    pub fn free(&self, is_video: bool) -> usize {
        self.lock(is_video).len()
    }

    /// Un verrou empoisonné signifie qu'un porteur a paniqué ailleurs ; la
    /// réserve n'est qu'une liste de `Mid`, aucun invariant ne peut être
    /// à moitié écrit. On reprend la main plutôt que de propager la panique.
    fn lock(&self, is_video: bool) -> std::sync::MutexGuard<'_, Vec<Mid>> {
        let m = if is_video { &self.video } else { &self.audio };
        m.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mid(s: &str) -> Mid {
        Mid::from(s)
    }

    #[test]
    fn an_empty_pool_hands_out_nothing() {
        let pool = SlotPool::new();
        assert!(pool.take(true).is_none());
        assert!(pool.take(false).is_none());
    }

    #[test]
    fn a_taken_slot_is_no_longer_free() {
        let pool = SlotPool::new();
        pool.offer(mid("2"), true);

        assert_eq!(pool.free(true), 1);
        assert_eq!(pool.take(true), Some(mid("2")));
        assert_eq!(pool.free(true), 0);
    }

    #[test]
    fn each_take_hands_out_a_distinct_slot() {
        let pool = SlotPool::new();
        pool.offer(mid("2"), true);
        pool.offer(mid("3"), true);

        let first = pool.take(true).expect("un slot libre");
        let second = pool.take(true).expect("un second slot libre");

        assert_ne!(first, second, "deux abonnements ne partagent jamais un mid");
        assert!(pool.take(true).is_none());
    }

    #[test]
    fn audio_and_video_draw_from_separate_pools() {
        let pool = SlotPool::new();
        pool.offer(mid("0"), false);
        pool.offer(mid("1"), true);

        assert_eq!(pool.take(true), Some(mid("1")));
        assert_eq!(pool.take(true), None, "le slot audio ne sert pas la vidéo");
        assert_eq!(pool.take(false), Some(mid("0")));
    }

    #[test]
    fn a_released_slot_can_be_taken_again() {
        let pool = SlotPool::new();
        pool.offer(mid("2"), true);

        let slot = pool.take(true).expect("un slot libre");
        pool.release(slot, true);

        assert_eq!(pool.take(true), Some(slot));
    }

    #[test]
    fn offering_the_same_slot_twice_does_not_duplicate_it() {
        let pool = SlotPool::new();
        pool.offer(mid("2"), true);
        pool.offer(mid("2"), true);

        assert_eq!(pool.free(true), 1, "une renégociation ne doit pas dupliquer");
    }

    #[test]
    fn releasing_a_slot_twice_does_not_duplicate_it() {
        let pool = SlotPool::new();
        pool.offer(mid("2"), true);
        let slot = pool.take(true).expect("un slot libre");

        pool.release(slot, true);
        pool.release(slot, true);

        assert_eq!(pool.free(true), 1);
    }
}
