# Instrumentation de qualité du SFU — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produire, par participant et par leg, une série temporelle de qualité média exploitable pendant une campagne de test, et écrire la matrice de scénarios et les seuils qui la jugent.

**Architecture:** str0m émet ses statistiques en événements une fois par seconde. Un `Sampler` pur les convertit en deltas ; la boucle d'événements du peer les emballe sur un canal dédié ; la pompe de transport résout les identifiants et les enregistre dans la façade `Telemetry` déjà existante. La sortie passe par un anneau borné en mémoire exposé en CSV/JSON, Postgres restant optionnel.

**Tech Stack:** Rust edition 2024, Tokio, Axum, str0m 0.23.1, sqlx/Postgres, criterion.

**Spec:** `docs/superpowers/specs/2026-09-11-instrumentation-qualite-sfu-design.md`

## Global Constraints

Copiées de la spec et de `CONTRIBUTING.md`. Elles s'appliquent implicitement à **chaque** tâche.

- **Langue.** Commentaires et messages de log en **français** ; identifiants, types et documentation publique en **anglais**. Convention existante du crate, à suivre sans mélanger.
- **Avant chaque commit :** `cargo test`, `cargo clippy --all-targets`, `cargo fmt`. Les trois sont propres aujourd'hui et doivent le rester.
- **Pas de `#[allow(dead_code)]`** pour faire taire un symbole : ou bien on le câble, ou bien on écrit en commentaire pourquoi il reste.
- **Commits conventionnels :** `feat(sfu): ...`, `fix(engine): ...`, `docs: ...`, `refactor(peer): ...`.
- **`media/` ne dépend jamais de `transport/`.** Aucun import de confort ne doit créer ce lien.
- **Ne jamais tenir un itérateur `DashMap` à travers un `await`.** A déjà bloqué la task de négociation jusqu'au redémarrage du serveur.
- **Le chemin média ne doit jamais bloquer.** `try_send`, jamais `send().await`, dans tout code appelé depuis la boucle d'événements d'un peer.
- **Deltas, jamais des cumuls.** Tout échantillon écrit dans `telemetry.*_samples` couvre la fenêtre, pas depuis le début de la connexion.
- **Tester à trois participants ou plus.** À N=2, beaucoup de logique SFU dégénère en « envoie-le à l'autre » et les tests passent sur du code cassé.
- **BWE éteinte** (décision D6) : `bwe_bps` reste `NULL` en Phase 0.

---

## Structure des fichiers

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `docs/phase-0/scenario-matrix.md` | Profils réseau, matrice, seuils, règle de verdict. Aucun code. | 1 |
| `apps/sfu/src/transport/sampler.rs` | **Créé.** Totaux str0m → deltas. Pur : pas d'horloge, pas d'E/S, pas de `telemetry/`. | 2 |
| `apps/sfu/src/transport/event_loop.rs` | Possède le `Sampler`, émet les `StatsEvent` sur un canal dédié. | 2, 3 |
| `apps/sfu/src/transport/peer_connection.rs` | Active `set_stats_interval` ; expose `rtp_clock(mid)`. | 2 |
| `apps/sfu/src/signaling/session.rs` | Crée le canal de stats ; la pompe résout les identifiants et enregistre. | 2, 3 |
| `apps/sfu/src/telemetry/entry.rs` | **Modifié.** `LegSample` + variante `Entry::LegSample`. | 3 |
| `apps/sfu/migrations/0002_leg_samples.sql` | **Créé.** Table partitionnée + partition par défaut. | 3 |
| `apps/sfu/src/telemetry/ring.rs` | **Créé.** `RingSink` borné, remplace `MemorySink`. | 4 |
| `apps/sfu/src/telemetry/tee.rs` | **Créé.** `TeeSink`, diffusion vers plusieurs sinks. | 4 |
| `apps/sfu/src/telemetry/csv.rs` | **Créé.** Sérialisation CSV des échantillons. | 4 |
| `apps/sfu/src/http/routes.rs` | Route d'export. | 4 |
| `apps/sfu/src/app.rs`, `src/main.rs` | `AppState::new(config, sink)`, champ `ring: Arc<RingSink>`, `spawn_writer`. | 4 |
| `apps/sfu/benches/forwarding.rs` | Coût par paquet, sampler branché vs débranché. | 5 |
| `CONTRIBUTING.md`, `README.md`, `apps/sfu/CONTEXT.md` | Réconciliation documentaire. | 6 |

---

## Task 1 : matrice de scénarios et seuils Phase 0 (LUM-552)

Aucun code. Livrable indépendant, mergeable seul.

**Files:**
- Create: `docs/phase-0/scenario-matrix.md`

**Interfaces:**
- Consumes: rien.
- Produces: le document que LUM-551 (harness) prend comme cahier des charges et que LUM-558 (campagne) publie.

- [ ] **Step 1 : écrire le document**

Rédigé **en anglais** (décision D7 : publié par LUM-558, et `CONTRIBUTING.md` impose l'anglais pour la documentation publique).

Reprendre intégralement le §4 de la spec, dans cet ordre : profils réseau (tableau P0–P4), matrice de scénarios (tableau des 21 cellules avec la colonne de statut), note de méthode sur la mesure de latence, seuils bloquants (tableau avec la colonne justification), relevés notés non bloquants, règle de verdict en bloc citation.

Trois éléments ne doivent pas être perdus en recopiant :

1. La note « la latence bouche-à-oreille n'est pas observable par le serveur ; la contribution transport est une borne inférieure ». Sans elle, un lecteur croit à une mesure complète.
2. La phrase « le gel vidéo n'est pas mesuré en Phase 0 » et pourquoi (les compteurs sont dans le navigateur, ils arrivent avec le ticket `client_stats`).
3. Le budget d'exécution : 21 cellules ≈ 3 h 50 par itération, 3 itérations > 11 h, **donc la matrice n'est pas exécutable à la main** — exigence d'automatisation portée par LUM-551.

- [ ] **Step 2 : relire contre les critères d'acceptation de LUM-552**

Trois questions, à se poser le document sous les yeux :
- La matrice est-elle versionnée avant toute exécution ? (oui par construction : ce commit précède le code)
- Chaque seuil est-il justifié en une phrase ? (5 seuils, 5 justifications, aucune vide)
- Un lecteur externe peut-il dire « Phase 0 franchie ou non » sur ce seul document ? (la règle de verdict doit nommer les cellules bloquantes et le nombre d'itérations)

- [ ] **Step 3 : commit**

```bash
git add docs/phase-0/scenario-matrix.md
git commit -m "docs: matrice de scénarios et seuils de passage Phase 0 (LUM-552)"
```

---

## Task 2 : échantillonner les statistiques str0m

**Files:**
- Create: `apps/sfu/src/transport/sampler.rs`
- Modify: `apps/sfu/src/transport/mod.rs`, `apps/sfu/src/transport/peer_connection.rs:86`, `apps/sfu/src/transport/event_loop.rs`, `apps/sfu/src/signaling/session.rs:41`
- Test: tests unitaires dans `apps/sfu/src/transport/sampler.rs`

**Interfaces:**
- Consumes: `str0m::stats::{MediaIngressStats, PeerStats}`, `crate::telemetry::{Telemetry, Entry, TrackSample, PeerSample, peer_uuid}`.
- Produces:
  - `transport::sampler::Sampler` — `new()`, `observe_ingress(&MediaIngressStats, Option<u32>, DateTime<Utc>) -> Option<StatsDelta>`, `observe_peer(&PeerStats, DateTime<Utc>) -> Option<PeerDelta>`, `forget(Mid)`
  - `transport::sampler::{StatsDelta, PeerDelta}` — champs publics listés ci-dessous
  - `transport::event_loop::StatsEvent` — variantes `Track { peer, mid, delta }` et `Peer { peer, delta }`
  - `PeerConnection::rtp_clock(Mid) -> Option<u32>`
  - `PeerConnection::new` gagne un 4ᵉ paramètre `stats_interval: Duration`
  - `event_loop::run` gagne un 4ᵉ paramètre `stats: Sender<StatsEvent>`

- [ ] **Step 1 : écrire les tests du sampler, qui échouent**

Créer `apps/sfu/src/transport/sampler.rs` avec **uniquement** le module de tests ci-dessous. Il ne compile pas : c'est voulu.

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;
    use str0m::stats::MediaIngressStats;

    fn at() -> DateTime<Utc> {
        DateTime::from_timestamp(1_760_000_000, 0).expect("horodatage fixe valide")
    }

    /// Des totaux str0m, tels qu'ils arrivent sur un `Event::MediaIngressStats`.
    fn ingress(mid: &str, bytes: u64, packets: u64, nacks: u64) -> MediaIngressStats {
        MediaIngressStats {
            mid: Mid::from(mid),
            rid: None,
            bytes,
            packets,
            firs: 0,
            plis: 0,
            nacks,
            jitter: 0,
            rtt: None,
            loss: None,
            timestamp: std::time::Instant::now(),
            remote: None,
        }
    }

    #[test]
    fn the_first_reading_yields_no_delta() {
        // Sans lecture précédente il n'y a pas de fenêtre : c'est un cas
        // nominal, pas une erreur.
        let mut s = Sampler::new();
        assert!(s.observe_ingress(&ingress("0", 1000, 10, 0), None, at()).is_none());
    }

    #[test]
    fn the_second_reading_is_the_difference_of_the_totals() {
        let mut s = Sampler::new();
        s.observe_ingress(&ingress("0", 1000, 10, 2), None, at());

        let d = s
            .observe_ingress(&ingress("0", 1600, 16, 3), None, at())
            .expect("un delta après deux lectures");

        assert_eq!(d.bytes, 600);
        assert_eq!(d.packets, 6);
        assert_eq!(d.nacks, 1);
    }

    #[test]
    fn two_mids_keep_separate_counters() {
        // Le piège : un seul état partagé ferait du delta du mid 1 la
        // différence avec le total du mid 0.
        let mut s = Sampler::new();
        s.observe_ingress(&ingress("0", 1000, 10, 0), None, at());
        s.observe_ingress(&ingress("1", 5000, 50, 0), None, at());

        let d0 = s.observe_ingress(&ingress("0", 1100, 11, 0), None, at()).expect("delta mid 0");
        let d1 = s.observe_ingress(&ingress("1", 5200, 52, 0), None, at()).expect("delta mid 1");

        assert_eq!(d0.bytes, 100);
        assert_eq!(d1.bytes, 200);
    }

    #[test]
    fn a_counter_going_backwards_yields_zero_not_a_negative() {
        // str0m ne remet pas ses compteurs à zéro, mais un delta négatif dans
        // une colonne `bigint not null` est un incident silencieux bien pire
        // que l'octet perdu par `saturating_sub`.
        let mut s = Sampler::new();
        s.observe_ingress(&ingress("0", 1000, 10, 0), None, at());

        let d = s.observe_ingress(&ingress("0", 400, 4, 0), None, at()).expect("un delta");
        assert_eq!(d.bytes, 0);
        assert_eq!(d.packets, 0);
    }

    #[test]
    fn jitter_converts_from_rtp_clock_units_to_milliseconds() {
        // 900 unités à 90 kHz valent 10 ms.
        let mut s = Sampler::new();
        let mut first = ingress("0", 0, 0, 0);
        first.jitter = 900;
        s.observe_ingress(&first, Some(90_000), at());

        let mut second = ingress("0", 100, 1, 0);
        second.jitter = 900;
        let d = s.observe_ingress(&second, Some(90_000), at()).expect("un delta");

        assert_eq!(d.jitter_ms, Some(10.0));
    }

    #[test]
    fn jitter_is_absent_when_the_clock_rate_is_unknown() {
        // Un événement de stats peut précéder le premier paquet : le mid n'est
        // pas encore dans `rx_kind`, donc l'horloge est inconnue. La colonne
        // est nullable exactement pour ça.
        let mut s = Sampler::new();
        let mut first = ingress("0", 0, 0, 0);
        first.jitter = 900;
        s.observe_ingress(&first, None, at());

        let mut second = ingress("0", 100, 1, 0);
        second.jitter = 900;
        let d = s.observe_ingress(&second, None, at()).expect("un delta");

        assert_eq!(d.jitter_ms, None);
    }

    #[test]
    fn rtt_converts_to_milliseconds_and_stays_absent_when_unreported() {
        let mut s = Sampler::new();
        s.observe_ingress(&ingress("0", 0, 0, 0), None, at());

        let mut with_rtt = ingress("0", 100, 1, 0);
        with_rtt.rtt = Some(Duration::from_millis(42));
        let d = s.observe_ingress(&with_rtt, None, at()).expect("un delta");
        assert_eq!(d.rtt_ms, Some(42.0));

        let d = s.observe_ingress(&ingress("0", 200, 2, 0), None, at()).expect("un delta");
        assert_eq!(d.rtt_ms, None);
    }

    #[test]
    fn forgetting_a_mid_restarts_it_from_scratch() {
        // Une m-line fermée puis réouverte ne doit pas produire un delta
        // calculé contre les totaux de la précédente.
        let mut s = Sampler::new();
        s.observe_ingress(&ingress("0", 1000, 10, 0), None, at());
        s.forget(Mid::from("0"));

        assert!(s.observe_ingress(&ingress("0", 50, 1, 0), None, at()).is_none());
    }

    #[test]
    fn the_sample_carries_the_timestamp_it_was_given() {
        // `now` est injecté et jamais lu à l'intérieur : c'est ce qui rend
        // toute conversion testable sans horloge.
        let mut s = Sampler::new();
        s.observe_ingress(&ingress("0", 0, 0, 0), None, at());
        let d = s.observe_ingress(&ingress("0", 1, 1, 0), None, at()).expect("un delta");
        assert_eq!(d.at, at());
    }
}
```

- [ ] **Step 2 : lancer les tests, vérifier qu'ils échouent**

```bash
cd apps/sfu && cargo test sampler
```
Attendu : erreurs de compilation — `Sampler`, `StatsDelta`, `Mid`, `DateTime` non résolus. C'est le signal que les tests testent bien quelque chose qui n'existe pas.

- [ ] **Step 3 : écrire le sampler**

Au-dessus du module de tests, dans le même fichier :

```rust
//! Conversion of str0m's statistics into telemetry deltas.
//!
//! Pure and synchronous: no clock, no I/O, no knowledge of `telemetry/`. The
//! sampler is handed totals and returns deltas; resolving identifiers and
//! recording them is the caller's job. Same doctrine as `RtpSink`: the
//! conversion is tested without a socket and without an async runtime.
//!
//! str0m reports totals since the connection started. The schema stores
//! deltas, deliberately: a delta sums and averages over any window, whereas a
//! total needs a window function on every query and goes wrong the moment a
//! row is missing — which will happen, since the telemetry queue drops.

use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::time::Duration;
use str0m::media::Mid;
use str0m::stats::{MediaIngressStats, PeerStats};

/// One sampling window of a track or a leg, as deltas.
#[derive(Debug, Clone, PartialEq)]
pub struct StatsDelta {
    pub at: DateTime<Utc>,
    pub bytes: i64,
    pub packets: i64,
    pub nacks: i32,
    pub plis: i32,
    pub firs: i32,
    /// Converted from RTP clock units. `None` when the clock rate is unknown.
    pub jitter_ms: Option<f32>,
    /// Fraction between 0 and 1.
    pub loss: Option<f32>,
    pub rtt_ms: Option<f32>,
}

/// One sampling window of a peer's transport, as deltas.
#[derive(Debug, Clone, PartialEq)]
pub struct PeerDelta {
    pub at: DateTime<Utc>,
    pub bytes_rx: i64,
    pub bytes_tx: i64,
    pub transport_bytes_rx: i64,
    pub transport_bytes_tx: i64,
    pub egress_loss: Option<f32>,
    pub bwe_bps: Option<i64>,
}

/// The previous reading's totals for one m-line.
#[derive(Default, Clone, Copy)]
struct Counters {
    bytes: u64,
    packets: u64,
    nacks: u64,
    plis: u64,
    firs: u64,
}

/// The previous reading's totals for a peer's transport.
#[derive(Default, Clone, Copy)]
struct PeerCounters {
    bytes_rx: u64,
    bytes_tx: u64,
    transport_bytes_rx: u64,
    transport_bytes_tx: u64,
}

/// Holds one peer's previous readings. One per connection, owned by that
/// connection's event loop.
#[derive(Default)]
pub struct Sampler {
    ingress: HashMap<Mid, Counters>,
    peer: Option<PeerCounters>,
}

impl Sampler {
    pub fn new() -> Self {
        Self::default()
    }

    /// A delta for one of the m-lines this peer publishes.
    ///
    /// Returns `None` on the first reading for a mid: without a previous one
    /// there is no window. `clock_rate` comes from
    /// [`PeerConnection::rtp_clock`](crate::transport::PeerConnection::rtp_clock).
    pub fn observe_ingress(
        &mut self,
        stats: &MediaIngressStats,
        clock_rate: Option<u32>,
        now: DateTime<Utc>,
    ) -> Option<StatsDelta> {
        let current = Counters {
            bytes: stats.bytes,
            packets: stats.packets,
            nacks: stats.nacks,
            plis: stats.plis,
            firs: stats.firs,
        };
        // `insert` rend la valeur précédente : le `?` couvre exactement le cas
        // « première lecture », en une expression et sans branche à part.
        let previous = self.ingress.insert(stats.mid, current)?;

        Some(StatsDelta {
            at: now,
            bytes: diff64(current.bytes, previous.bytes),
            packets: diff64(current.packets, previous.packets),
            nacks: diff32(current.nacks, previous.nacks),
            plis: diff32(current.plis, previous.plis),
            firs: diff32(current.firs, previous.firs),
            jitter_ms: jitter_ms(stats.jitter, clock_rate),
            loss: stats.loss,
            rtt_ms: stats.rtt.map(millis),
        })
    }

    /// A delta for the peer's transport as a whole.
    pub fn observe_peer(&mut self, stats: &PeerStats, now: DateTime<Utc>) -> Option<PeerDelta> {
        let current = PeerCounters {
            bytes_rx: stats.bytes_rx,
            bytes_tx: stats.bytes_tx,
            transport_bytes_rx: stats.peer_bytes_rx,
            transport_bytes_tx: stats.peer_bytes_tx,
        };
        let previous = self.peer.replace(current)?;

        Some(PeerDelta {
            at: now,
            bytes_rx: diff64(current.bytes_rx, previous.bytes_rx),
            bytes_tx: diff64(current.bytes_tx, previous.bytes_tx),
            transport_bytes_rx: diff64(current.transport_bytes_rx, previous.transport_bytes_rx),
            transport_bytes_tx: diff64(current.transport_bytes_tx, previous.transport_bytes_tx),
            egress_loss: stats.egress_loss_fraction,
            // Toujours `None` en Phase 0 : la BWE n'est pas activée sur le
            // `Rtc` (décision D6, elle appartient à LUM-578). La conversion
            // est écrite pour que l'activation n'ait rien à changer ici.
            bwe_bps: stats.bwe_tx.map(|b| b.as_u64() as i64),
        })
    }

    /// Drops an m-line's state. Without this, a mid closed and later reused
    /// would produce a delta measured against the previous m-line's totals.
    pub fn forget(&mut self, mid: Mid) {
        self.ingress.remove(&mid);
    }
}

/// `saturating_sub` sur le principe : str0m ne remet pas ses compteurs à zéro,
/// mais un delta négatif dans une colonne `not null` est un incident muet bien
/// pire que l'octet que cette garde coûte.
fn diff64(current: u64, previous: u64) -> i64 {
    current.saturating_sub(previous) as i64
}

fn diff32(current: u64, previous: u64) -> i32 {
    current.saturating_sub(previous).try_into().unwrap_or(i32::MAX)
}

fn millis(d: Duration) -> f32 {
    d.as_secs_f32() * 1000.0
}

/// Jitter is reported in RTP timestamp units, which only mean something with
/// the stream's clock rate. `None` rather than a wrong number when it is
/// unknown — the column is nullable for exactly this case.
fn jitter_ms(jitter: u32, clock_rate: Option<u32>) -> Option<f32> {
    let rate = clock_rate.filter(|r| *r > 0)?;
    Some(jitter as f32 * 1000.0 / rate as f32)
}
```

- [ ] **Step 4 : déclarer le module et lancer les tests**

Dans `apps/sfu/src/transport/mod.rs`, ajouter `pub mod sampler;` et `pub use sampler::{PeerDelta, Sampler, StatsDelta};` en suivant la forme des lignes déjà présentes.

```bash
cd apps/sfu && cargo test sampler
```
Attendu : les 9 tests passent.

- [ ] **Step 5 : commit du sampler seul**

```bash
git add apps/sfu/src/transport/sampler.rs apps/sfu/src/transport/mod.rs
git commit -m "feat(sfu): convertir les statistiques str0m en deltas"
```

- [ ] **Step 6 : allumer les statistiques sur le `Rtc`**

Dans `apps/sfu/src/transport/peer_connection.rs` :

Ajouter `use std::time::Duration;` aux imports. Changer la signature de `new` pour prendre un quatrième paramètre `stats_interval: Duration`, et la construction du `Rtc` (ligne 86) :

```rust
            // Sans cet appel, `stats_interval` vaut `None` et str0m n'émet
            // jamais `MediaIngressStats`, `MediaEgressStats` ni `PeerStats` :
            // tout le sous-système de mesure reste muet.
            rtc: Rtc::builder()
                .set_stats_interval(Some(stats_interval))
                .build(Instant::now()),
```

Ajouter la méthode d'horloge, à placer juste après `to_packet` :

```rust
    /// RTP clock rate, in Hz, of any m-line on this connection.
    ///
    /// Asks str0m rather than `rx_kind`, deliberately: `rx_kind` only holds
    /// the m-lines this peer **publishes**, and leg statistics arrive on
    /// outbound ones. `Rtc::media` knows both, so one method serves ingress
    /// and egress alike and there is no second registry to keep in step.
    ///
    /// Same values as [`Self::to_packet`] derives: 90 kHz for video, 48 kHz
    /// for audio.
    ///
    /// `None` while the m-line is unknown to str0m — a statistics event can
    /// arrive before the m-line is entered into the session — in which case
    /// the jitter simply stays unconverted, which the column allows.
    pub fn rtp_clock(&self, mid: Mid) -> Option<u32> {
        self.rtc.media(mid).map(|media| match media.kind() {
            MediaKind::Video => 90_000,
            MediaKind::Audio => 48_000,
        })
    }
```

- [ ] **Step 7 : corriger le commentaire mensonger de `config.rs`**

`apps/sfu/src/config.rs:57` affirme aujourd'hui que `sample_interval` est « also passed to str0m's `set_stats_interval` », ce qui était faux. Le Step 6 vient de le rendre vrai. Vérifier que le commentaire décrit bien le comportement obtenu et l'ajuster si besoin.

- [ ] **Step 8 : propager le paramètre depuis la session**

Dans `apps/sfu/src/signaling/session.rs:41`, l'appel à `PeerConnection::new` prend l'intervalle depuis la configuration :

```rust
        PeerConnection::new(
            Arc::clone(&peer_id),
            tx.clone(),
            state.config.ice_host.clone(),
            state.config.telemetry.sample_interval,
        )
        .await,
```

Corriger de la même façon tout appel à `PeerConnection::new` dans les tests (`cargo test` les désignera).

- [ ] **Step 9 : déclarer le canal dédié et les événements de stats**

Dans `apps/sfu/src/transport/event_loop.rs`, à côté de `TransportEvent` :

```rust
/// A statistics sample, on its way to telemetry.
///
/// **A channel of its own, separate from `TransportEvent`.** The media channel
/// is bounded at 128 and drops when full, which is right for real-time media
/// and exactly wrong here: under a degraded network — bursts of packets, hence
/// a saturated channel — the samples would be dropped precisely in the
/// scenarios that decide the Phase 0 gate.
///
/// The ordering constraint that justifies a single media channel — a track's
/// announcement must not overtake its packets — does not apply to a statistics
/// sample, which has no ordering relation to media at all.
#[derive(Debug)]
pub enum StatsEvent {
    /// One sampling window of a track this peer publishes.
    Track {
        peer: Arc<str>,
        mid: Mid,
        delta: StatsDelta,
    },
    /// One sampling window of this peer's transport.
    Peer { peer: Arc<str>, delta: PeerDelta },
}
```

Importer `use super::sampler::{PeerDelta, Sampler, StatsDelta};` et `use chrono::Utc;`.

- [ ] **Step 10 : câbler le sampler dans la boucle d'événements**

Toujours dans `event_loop.rs` :

`run` prend un paramètre supplémentaire `stats: Sender<StatsEvent>` et crée `let mut sampler = Sampler::new();` à côté de `let mut ingress_drops = IngressDrops::default();`. Les deux appels à `handle_event` reçoivent `&mut sampler` et `&stats`.

Ajouter les bras, avant le `_ => {}` final :

```rust
        Event::MediaIngressStats(s) => {
            let clock = conn.rtp_clock(s.mid);
            if let Some(delta) = sampler.observe_ingress(&s, clock, Utc::now()) {
                // `try_send` comme partout dans cette boucle : une mesure ne
                // doit jamais pouvoir retarder du média. Une profondeur de 64
                // pour un échantillon par seconde rend le rejet anormal, et
                // non nominal comme sur la file média.
                if stats.try_send(StatsEvent::Track {
                    peer: Arc::clone(&conn.peer_id),
                    mid: s.mid,
                    delta,
                })
                .is_err()
                {
                    tracing::debug!(
                        "Peer {} — échantillon de track perdu sur mid={}",
                        conn.peer_id,
                        s.mid
                    );
                }
            }
        }
        Event::PeerStats(s) => {
            if let Some(delta) = sampler.observe_peer(&s, Utc::now()) {
                let _ = stats.try_send(StatsEvent::Peer {
                    peer: Arc::clone(&conn.peer_id),
                    delta,
                });
            }
        }
```

- [ ] **Step 11 : créer le canal et consommer les deux côté session**

Dans `apps/sfu/src/signaling/session.rs`, après la création de `transport_tx` / `transport_rx` :

```rust
    // Profondeur 64 : un échantillon par seconde et par peer ne peut pas la
    // saturer. Séparé du canal média exprès — voir `StatsEvent`.
    let (stats_tx, stats_rx) = tokio::sync::mpsc::channel::<StatsEvent>(64);
    tokio::spawn(event_loop::run(
        conn.clone(),
        transport_tx,
        stats_tx,
        shutdown_rx,
    ));
```

`spawn_transport_pump` prend `stats_rx` en plus et sa boucle devient :

```rust
    tokio::spawn(async move {
        loop {
            tokio::select! {
                Some(event) = events.recv() => handle_transport_event(
                    &engine, &negotiator, &metrics, &telemetry, event
                ),
                Some(sample) = stats.recv() => record_stats(&telemetry, sample),
                // Les deux canaux fermés : plus aucun bras ne peut s'armer.
                else => break,
            }
        }
        tracing::debug!("Peer {} — task de transport terminée", peer_id);
    });
```

Extraire le `match event` existant dans `fn handle_transport_event(...)`, **sans en changer une ligne** : c'est un déplacement, pas une réécriture. Puis ajouter :

```rust
/// Enregistre un échantillon de statistiques.
///
/// L'occupation se résout comme pour `TrackAdded` : sans occupation mirée —
/// peer hors room, ou qui vient de la quitter — il n'y a rien à rattacher.
///
/// ⚠️ Synchrone exprès. `Telemetry::occupancy_of` et `track_id` prennent le
/// verrou d'un shard `DashMap`, et `Negotiator::unregister` demande le même en
/// écriture au teardown d'une session. Tenir l'un à travers un `await` a déjà
/// bloqué la task de négociation jusqu'au redémarrage du serveur.
fn record_stats(telemetry: &Telemetry, event: StatsEvent) {
    match event {
        StatsEvent::Track { peer, mid, delta } => {
            let Some(occupancy) = occupancy_for(telemetry, &peer) else {
                return;
            };
            let track_id = telemetry.track_id(occupancy, &mid.to_string());
            telemetry.record(Entry::TrackSample(TrackSample {
                track_id,
                at: delta.at,
                bytes: delta.bytes,
                packets: delta.packets,
                nacks: delta.nacks,
                plis: delta.plis,
                firs: delta.firs,
                jitter_ms: delta.jitter_ms,
                loss: delta.loss,
                rtt_ms: delta.rtt_ms,
            }));
        }
        StatsEvent::Peer { peer, delta } => {
            let Some(occupancy) = occupancy_for(telemetry, &peer) else {
                return;
            };
            telemetry.record(Entry::PeerSample(PeerSample {
                peer_id: occupancy,
                at: delta.at,
                bytes_rx: delta.bytes_rx,
                bytes_tx: delta.bytes_tx,
                transport_bytes_rx: delta.transport_bytes_rx,
                transport_bytes_tx: delta.transport_bytes_tx,
                egress_loss: delta.egress_loss,
                bwe_bps: delta.bwe_bps,
            }));
        }
    }
}

fn occupancy_for(telemetry: &Telemetry, peer: &str) -> Option<uuid::Uuid> {
    crate::telemetry::peer_uuid(peer).and_then(|id| telemetry.occupancy_of(id))
}
```

Compléter les imports de `session.rs` : `PeerSample`, `TrackSample` depuis `crate::telemetry`, et `StatsEvent` depuis `crate::transport`.

- [ ] **Step 12 : lancer toute la suite**

```bash
cd apps/sfu && cargo test && cargo clippy --all-targets && cargo fmt
```
Attendu : tout passe, clippy silencieux.

- [ ] **Step 13 : vérifier sur une vraie session — le sens de `bytes_rx` / `bytes_tx`**

⚠️ **Piège à lever ici, pas plus tard.** Dans str0m 0.23.1, les doc comments de `PeerStats` décrivent `peer_bytes_rx` comme « Total bytes transmitted » et `peer_bytes_tx` comme « Total bytes received » — l'inverse de ce que les noms de champs disent. Le code du Step 3 fait confiance aux **noms**. Il faut le vérifier empiriquement avant de bâtir des seuils dessus.

```bash
cd apps/sfu && SFU_LOG=info cargo run
```
Ouvrir **trois** onglets sur `https://localhost:3000`, même room, et laisser tourner ~30 s. Puis, avec un onglet qui publie et ne reçoit rien d'autre, comparer : un peer qui publie doit montrer `bytes_rx` nettement supérieur à `bytes_tx` du point de vue du SFU (le SFU reçoit sa publication).

Si l'observation contredit le code, inverser la correspondance dans `observe_peer` **et** écrire en commentaire que les doc comments de str0m sont trompeurs sur ce point — le prochain lecteur refera sinon exactement la même erreur.

- [ ] **Step 14 : commit**

```bash
git add apps/sfu/src apps/sfu/migrations
git commit -m "feat(sfu): échantillonner les statistiques de qualité par track et par peer"
```

---

## Task 3 : échantillons par leg

Un *leg* est le service d'un track source vers un abonné donné. C'est ce qui permet de voir « la vue qu'Alice a de Bob est dégradée alors que celle de Carol est saine » — l'affirmation produit du README.

**Files:**
- Create: `apps/sfu/migrations/0002_leg_samples.sql`
- Modify: `apps/sfu/src/telemetry/entry.rs`, `batch.rs`, `pg.rs`, `apps/sfu/src/transport/sampler.rs`, `event_loop.rs`, `apps/sfu/src/signaling/session.rs`
- Test: `apps/sfu/tests/telemetry_pg.rs`

**Interfaces:**
- Consumes: `StatsDelta` (Task 2), `PeerConnection::source_on(Mid) -> Option<TrackKey>` (existe déjà, `peer_connection.rs:258`), `Telemetry::{occupancy_of, track_id}`.
- Produces: `telemetry::LegSample`, `Entry::LegSample`, `Batch::leg_samples`, `StatsEvent::Leg { peer, source, delta }`, `Sampler::observe_egress`.

- [ ] **Step 1 : écrire les tests d'egress du sampler, qui échouent**

Dans le module de tests de `sampler.rs`, ajouter :

```rust
    use str0m::stats::{MediaEgressStats, RemoteIngressStats};

    fn egress(mid: &str, bytes: u64, plis: u64) -> MediaEgressStats {
        MediaEgressStats {
            mid: Mid::from(mid),
            rid: None,
            bytes,
            packets: 0,
            firs: 0,
            plis,
            nacks: 0,
            rtt: None,
            loss: None,
            timestamp: std::time::Instant::now(),
            remote: None,
        }
    }

    #[test]
    fn egress_deltas_are_tracked_separately_from_ingress() {
        // Le même mid peut désigner une m-line entrante et une sortante sur la
        // même connexion : un état partagé les mélangerait.
        let mut s = Sampler::new();
        s.observe_ingress(&ingress("0", 1000, 10, 0), None, at());
        s.observe_egress(&egress("0", 7000, 0), None, at());

        let d = s.observe_egress(&egress("0", 7500, 0), None, at()).expect("un delta d'egress");
        assert_eq!(d.bytes, 500);
    }

    #[test]
    fn egress_jitter_comes_from_the_remote_receiver_report() {
        // Sur un leg, le jitter qui compte est celui que l'abonné rapporte,
        // pas celui que le SFU mesure : c'est sa réception à lui qu'on juge.
        let mut s = Sampler::new();
        let mut first = egress("0", 0, 0);
        first.remote = Some(RemoteIngressStats {
            jitter: 1800,
            maximum_sequence_number: 0.into(),
            packets_lost: 0,
        });
        s.observe_egress(&first, Some(90_000), at());

        let mut second = egress("0", 100, 0);
        second.remote = Some(RemoteIngressStats {
            jitter: 1800,
            maximum_sequence_number: 0.into(),
            packets_lost: 0,
        });
        let d = s.observe_egress(&second, Some(90_000), at()).expect("un delta");

        assert_eq!(d.jitter_ms, Some(20.0));
    }

    #[test]
    fn egress_jitter_is_absent_without_a_remote_report() {
        let mut s = Sampler::new();
        s.observe_egress(&egress("0", 0, 0), Some(90_000), at());
        let d = s.observe_egress(&egress("0", 100, 0), Some(90_000), at()).expect("un delta");
        assert_eq!(d.jitter_ms, None);
    }
```

Si `RemoteIngressStats.maximum_sequence_number` n'accepte pas `0.into()`, consulter sa définition dans `str0m/src/stats.rs:171` et construire la valeur avec le constructeur qu'elle expose — le champ n'est pas lu par le sampler, seule la compilation du test en dépend.

- [ ] **Step 2 : lancer, vérifier l'échec**

```bash
cd apps/sfu && cargo test sampler
```
Attendu : `no method named observe_egress`.

- [ ] **Step 3 : implémenter `observe_egress`**

Dans `Sampler`, ajouter le champ `egress: HashMap<Mid, Counters>,` puis :

```rust
    /// A delta for one of the outbound m-lines this peer subscribes on.
    ///
    /// Kept in a map of its own: the same `Mid` can name an inbound and an
    /// outbound m-line on one connection, and sharing the state would compute
    /// each delta against the other's totals.
    ///
    /// The jitter reported here is the **remote receiver's**, carried by its
    /// RTCP receiver reports — on a leg, what matters is the subscriber's
    /// reception, not the SFU's.
    pub fn observe_egress(
        &mut self,
        stats: &MediaEgressStats,
        clock_rate: Option<u32>,
        now: DateTime<Utc>,
    ) -> Option<StatsDelta> {
        let current = Counters {
            bytes: stats.bytes,
            packets: stats.packets,
            nacks: stats.nacks,
            plis: stats.plis,
            firs: stats.firs,
        };
        let previous = self.egress.insert(stats.mid, current)?;

        Some(StatsDelta {
            at: now,
            bytes: diff64(current.bytes, previous.bytes),
            packets: diff64(current.packets, previous.packets),
            nacks: diff32(current.nacks, previous.nacks),
            plis: diff32(current.plis, previous.plis),
            firs: diff32(current.firs, previous.firs),
            jitter_ms: stats
                .remote
                .as_ref()
                .and_then(|r| jitter_ms(r.jitter, clock_rate)),
            loss: stats.loss,
            rtt_ms: stats.rtt.map(millis),
        })
    }
```

Étendre `forget` pour vider les deux registres : `self.ingress.remove(&mid); self.egress.remove(&mid);` et ajuster son doc comment en conséquence. Importer `MediaEgressStats`.

```bash
cd apps/sfu && cargo test sampler
```
Attendu : les 12 tests passent.

- [ ] **Step 4 : ajouter `LegSample` à la télémétrie**

Dans `apps/sfu/src/telemetry/entry.rs`, après `TrackSample` :

```rust
/// One second of one subscriber's view of one source track, as deltas.
///
/// A *leg* is the service of a source track to a given subscriber. It is not a
/// track: the outbound m-line it travels on belongs to the subscriber's
/// connection and names no published source. Keying it as a track would mint
/// phantom rows in `telemetry.tracks`.
///
/// This is what makes "Alice's view of Bob is degraded while Carol's is fine"
/// answerable — a per-track view cannot distinguish the two.
#[derive(Debug, Clone, PartialEq)]
pub struct LegSample {
    /// The subscriber's occupancy — references `telemetry.peers.id`.
    pub peer_id: Uuid,
    /// The source track served on this leg.
    pub track_id: Uuid,
    pub at: DateTime<Utc>,
    pub bytes: i64,
    pub packets: i64,
    pub nacks: i32,
    pub plis: i32,
    pub firs: i32,
    /// As reported by the remote receiver, converted from RTP clock units.
    pub jitter_ms: Option<f32>,
    /// Fraction between 0 and 1.
    pub loss: Option<f32>,
    pub rtt_ms: Option<f32>,
}
```

Ajouter la variante `LegSample(LegSample),` à l'enum `Entry`, et exporter `LegSample` depuis `telemetry/mod.rs`.

- [ ] **Step 5 : ajouter le lot et l'écriture**

`batch.rs` : champ `pub leg_samples: Vec<LegSample>,`, bras `Entry::LegSample(s) => b.leg_samples.push(s),`, et `+ self.leg_samples.len()` dans `len()`. Importer `LegSample`.

`pg.rs` : après la boucle `track_samples`, en calquant sa forme exactement :

```rust
        for s in &batch.leg_samples {
            sqlx::query(
                "insert into telemetry.leg_samples
                   (instance_id, peer_id, track_id, at, bytes, packets, nacks, plis, firs,
                    jitter_ms, loss, rtt_ms)
                 values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                 on conflict (peer_id, track_id, at) do nothing",
            )
            .bind(iid).bind(s.peer_id).bind(s.track_id).bind(s.at)
            .bind(s.bytes).bind(s.packets)
            .bind(s.nacks).bind(s.plis).bind(s.firs)
            .bind(s.jitter_ms).bind(s.loss).bind(s.rtt_ms)
            .execute(&mut *tx).await?;
        }
```

- [ ] **Step 6 : écrire la migration**

`apps/sfu/migrations/0002_leg_samples.sql` :

```sql
-- Un « leg » est le service d'un track source vers un abonné donné.
-- Ni un track (l'abonné ne publie rien), ni un peer (un abonné a autant de
-- legs que de sources) : d'où une table à part, clé par le couple.

create table telemetry.leg_samples (
  instance_id uuid        not null,
  peer_id     uuid        not null,   -- l'abonné (occupancy)
  track_id    uuid        not null,   -- le track source servi
  at          timestamptz not null,
  bytes       bigint      not null,   -- deltas sur la fenêtre, pas des cumuls
  packets     bigint      not null,
  nacks       integer     not null,
  plis        integer     not null,
  firs        integer     not null,
  jitter_ms   real,                   -- rapporté par le récepteur distant
  loss        real,                   -- fraction 0..1
  rtt_ms      real,
  primary key (peer_id, track_id, at)
) partition by range (at);
create index on telemetry.leg_samples (instance_id, at desc);

-- Partition par défaut, pour la raison déjà écrite dans 0001 : une insertion
-- hors des partitions créées échouerait et ferait perdre tout le lot. Perdre
-- la granularité vaut mieux que perdre la donnée.
create table telemetry.leg_samples_default partition of telemetry.leg_samples default;
```

- [ ] **Step 7 : test d'intégration Postgres**

Dans `apps/sfu/tests/telemetry_pg.rs`, calquer le cas `track_samples` existant (ligne ~319) : écrire deux `Entry::LegSample` pour le même abonné et deux sources différentes, relire, et vérifier que les deux lignes coexistent — c'est la propriété qui distingue un leg d'un track.

```bash
cd apps/sfu && cargo test --test telemetry_pg
```
Ces tests exigent une base ; s'ils sont ignorés faute de `SFU_TEST_DATABASE_URL`, suivre la convention déjà en place dans ce fichier.

- [ ] **Step 8 : émettre les legs depuis la boucle d'événements**

`event_loop.rs` — nouvelle variante :

```rust
    /// One sampling window of one source track as served to this subscriber.
    Leg {
        /// The subscriber.
        peer: Arc<str>,
        /// The source track, resolved from the outbound m-line.
        source: TrackKey,
        delta: StatsDelta,
    },
```

Et le bras d'événement :

```rust
        Event::MediaEgressStats(s) => {
            // `source_on` inverse `allocated` : cette m-line sortante sert le
            // track d'un autre peer. Sans cette résolution l'échantillon
            // n'aurait aucune source à qui être rattaché, et le rattacher au
            // mid sortant fabriquerait un track fantôme.
            let Some(source) = conn.source_on(s.mid) else {
                return;
            };
            // `rtp_clock` interroge str0m, qui connaît aussi les m-lines
            // sortantes : la même méthode sert l'ingress et l'egress.
            let clock = conn.rtp_clock(s.mid);
            if let Some(delta) = sampler.observe_egress(&s, clock, Utc::now()) {
                let _ = stats.try_send(StatsEvent::Leg {
                    peer: Arc::clone(&conn.peer_id),
                    source,
                    delta,
                });
            }
        }
```

Noter le `return` dans le `let ... else` : `handle_event` rend `()`, donc sortir du bras se fait par `return`. Si le corps de `handle_event` est structuré autrement au moment de l'écriture, adapter — la règle est de ne rien émettre quand la source est introuvable, pas d'utiliser ce mot-clé précisément.

**Pourquoi l'horloge se résout ici sans difficulté** : `rtp_clock` (Task 2) interroge `Rtc::media(mid)`, qui connaît toutes les m-lines de la session — entrantes comme sortantes. Un registre local comme `rx_kind` n'aurait couvert que les m-lines publiées par ce peer, donc aucun leg.

- [ ] **Step 9 : enregistrer les legs côté session**

Dans `record_stats` de `session.rs` :

```rust
        StatsEvent::Leg { peer, source, delta } => {
            // Deux occupations différentes : celle de l'abonné porte
            // l'échantillon, celle du publisher identifie le track source.
            let Some(subscriber) = occupancy_for(telemetry, &peer) else {
                return;
            };
            let Some(publisher) = occupancy_for(telemetry, source.peer_id.as_ref()) else {
                return;
            };
            let track_id = telemetry.track_id(publisher, &source.mid.to_string());
            telemetry.record(Entry::LegSample(LegSample {
                peer_id: subscriber,
                track_id,
                at: delta.at,
                bytes: delta.bytes,
                packets: delta.packets,
                nacks: delta.nacks,
                plis: delta.plis,
                firs: delta.firs,
                jitter_ms: delta.jitter_ms,
                loss: delta.loss,
                rtt_ms: delta.rtt_ms,
            }));
        }
```

- [ ] **Step 10 : suite complète et commit**

```bash
cd apps/sfu && cargo test && cargo clippy --all-targets && cargo fmt
git add apps/sfu
git commit -m "feat(telemetry): échantillons de qualité par leg"
```

---

## Task 4 : export de campagne et câblage Postgres

**Files:**
- Create: `apps/sfu/src/telemetry/ring.rs`, `apps/sfu/src/telemetry/tee.rs`, `apps/sfu/src/telemetry/csv.rs`
- Modify: `apps/sfu/src/telemetry/{mod,sink}.rs`, `apps/sfu/src/config.rs`, `apps/sfu/src/app.rs`, `apps/sfu/src/main.rs`, `apps/sfu/src/http/routes.rs`, `apps/sfu/src/signaling/dispatch.rs:220-221`

**Interfaces:**
- Consumes: `TelemetrySink`, `Entry`, `Batch`, `PgWriter`, `QueueSink`, `tasks::spawn_writer`.
- Produces: `telemetry::RingSink` (`new(capacity)`, `drain()`, `snapshot()`), `telemetry::TeeSink` (`new(Vec<Arc<dyn TelemetrySink>>)`), `telemetry::csv::samples_to_csv(&[Entry]) -> String`, `AppState::new(config, sink)`, route `GET /telemetry/samples`.

- [ ] **Step 1 : tests de `RingSink`, qui échouent**

Créer `apps/sfu/src/telemetry/ring.rs` avec seulement :

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::telemetry::entry::{Entry, TrackKind};
    use chrono::Utc;
    use uuid::Uuid;

    fn a_track() -> Entry {
        Entry::TrackPublished {
            id: Uuid::new_v4(),
            peer_id: Uuid::new_v4(),
            mid: "0".to_string(),
            kind: TrackKind::Video,
            at: Utc::now(),
        }
    }

    #[test]
    fn it_keeps_what_it_is_given_in_order() {
        let sink = RingSink::new(8);
        sink.record(a_track());
        sink.record(a_track());
        assert_eq!(sink.drain().len(), 2);
    }

    #[test]
    fn draining_empties_it() {
        let sink = RingSink::new(8);
        sink.record(a_track());
        assert_eq!(sink.drain().len(), 1);
        assert_eq!(sink.drain().len(), 0);
    }

    #[test]
    fn a_full_ring_evicts_the_oldest_rather_than_refusing_the_newest() {
        // Sur une campagne longue, la fenêtre récente est ce qui intéresse :
        // refuser la nouvelle entrée figerait l'anneau sur le début de la
        // session, exactement l'inverse de ce qu'on veut relever.
        let sink = RingSink::new(2);
        sink.record(a_track());
        let second = a_track();
        let third = a_track();
        let (id_second, id_third) = (entry_id(&second), entry_id(&third));
        sink.record(second);
        sink.record(third);

        let kept = sink.drain();
        assert_eq!(kept.len(), 2);
        assert_eq!(entry_id(&kept[0]), id_second);
        assert_eq!(entry_id(&kept[1]), id_third);
    }

    #[test]
    fn a_snapshot_does_not_empty_the_ring() {
        // L'export HTTP lit sans consommer : deux `curl` successifs pendant un
        // scénario ne doivent pas se voler les échantillons l'un à l'autre.
        let sink = RingSink::new(8);
        sink.record(a_track());
        assert_eq!(sink.snapshot().len(), 1);
        assert_eq!(sink.snapshot().len(), 1);
    }

    #[test]
    #[should_panic(expected = "capacité")]
    fn a_zero_capacity_ring_is_refused() {
        // Un anneau de capacité nulle avale tout en silence : c'est le pire
        // mode de défaillance pour une chaîne de mesure.
        RingSink::new(0);
    }

    fn entry_id(e: &Entry) -> Uuid {
        match e {
            Entry::TrackPublished { id, .. } => *id,
            _ => panic!("le test ne fabrique que des TrackPublished"),
        }
    }
}
```

- [ ] **Step 2 : lancer, vérifier l'échec**

```bash
cd apps/sfu && cargo test ring
```
Attendu : `RingSink` non résolu.

- [ ] **Step 3 : implémenter `RingSink`**

```rust
//! A bounded in-memory buffer of telemetry entries.
//!
//! This is the campaign's export path: a scenario runs, the harness reads the
//! ring over HTTP, and nothing depends on a database being up. It replaces the
//! former unbounded `MemorySink` — the tests now exercise the production type,
//! so a bug here is caught by the telemetry tests already in place rather than
//! by a new test nobody re-runs.

use super::entry::Entry;
use super::sink::TelemetrySink;
use std::collections::VecDeque;
use std::sync::Mutex;

pub struct RingSink {
    entries: Mutex<VecDeque<Entry>>,
    capacity: usize,
}

impl RingSink {
    /// Panics on a capacity of zero: a ring that silently swallows everything
    /// is the worst failure mode a measurement chain can have, and it would
    /// only be noticed when the campaign produced an empty file.
    pub fn new(capacity: usize) -> Self {
        assert!(capacity > 0, "capacité d'anneau nulle");
        RingSink {
            entries: Mutex::new(VecDeque::with_capacity(capacity)),
            capacity,
        }
    }

    /// Takes everything held, leaving the ring empty.
    pub fn drain(&self) -> Vec<Entry> {
        let mut guard = self.entries.lock().expect("RingSink non empoisonné");
        guard.drain(..).collect()
    }

    /// Copies everything held, leaving the ring untouched — what the HTTP
    /// export reads, so that two successive reads during a scenario do not
    /// steal each other's samples.
    pub fn snapshot(&self) -> Vec<Entry> {
        self.entries
            .lock()
            .expect("RingSink non empoisonné")
            .iter()
            .cloned()
            .collect()
    }
}

impl TelemetrySink for RingSink {
    fn record(&self, entry: Entry) {
        let mut guard = self.entries.lock().expect("RingSink non empoisonné");
        if guard.len() == self.capacity {
            // La fenêtre récente est ce qu'on relève : évincer la plus
            // ancienne, jamais refuser la nouvelle.
            guard.pop_front();
        }
        guard.push_back(entry);
    }
}
```

`snapshot` exige `Entry: Clone` — il l'est déjà (`#[derive(Debug, Clone)]` sur `Entry`).

- [ ] **Step 4 : remplacer `MemorySink` partout**

Supprimer `MemorySink` de `telemetry/sink.rs` (struct, impl et ses deux tests, désormais couverts par `ring.rs`). Déclarer `pub mod ring;` et exporter `RingSink` dans `telemetry/mod.rs`, en retirant `MemorySink` de la ligne `pub use`.

Trois appelants survivent à la suppression et deviennent `RingSink::new(1024)` : `telemetry/mod.rs:201`, `:235` et `signaling/dispatch.rs:221`. Les deux autres (`sink.rs:113` et `:129`) disparaissent avec les tests de `MemorySink`, que `ring.rs` reprend. À une capacité de 1024 rien n'évince, donc les assertions `drain()` existantes restent vraies sans retouche.

```bash
cd apps/sfu && cargo test
```
Attendu : tout passe, y compris les tests de télémétrie déjà écrits — c'est le bénéfice recherché.

- [ ] **Step 5 : `TeeSink`**

Créer `apps/sfu/src/telemetry/tee.rs` :

```rust
//! Fan-out to several sinks.
//!
//! The ring serves the campaign, the queue serves Postgres; both need the same
//! entries, and a producer should not have to know how many destinations there
//! are.

use super::entry::Entry;
use super::sink::TelemetrySink;
use std::sync::Arc;

pub struct TeeSink {
    sinks: Vec<Arc<dyn TelemetrySink>>,
}

impl TeeSink {
    pub fn new(sinks: Vec<Arc<dyn TelemetrySink>>) -> Self {
        TeeSink { sinks }
    }
}

impl TelemetrySink for TeeSink {
    fn record(&self, entry: Entry) {
        // `Entry` est `Clone` et les échantillons sont petits ; le coût est
        // payé une fois par seconde et par peer, jamais par paquet.
        for sink in &self.sinks {
            sink.record(entry.clone());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::telemetry::ring::RingSink;
    use crate::telemetry::entry::{Entry, TrackKind};
    use chrono::Utc;
    use uuid::Uuid;

    #[test]
    fn every_sink_receives_every_entry() {
        let a = Arc::new(RingSink::new(4));
        let b = Arc::new(RingSink::new(4));
        let tee = TeeSink::new(vec![a.clone(), b.clone()]);

        tee.record(Entry::TrackPublished {
            id: Uuid::new_v4(),
            peer_id: Uuid::new_v4(),
            mid: "0".to_string(),
            kind: TrackKind::Video,
            at: Utc::now(),
        });

        assert_eq!(a.drain().len(), 1);
        assert_eq!(b.drain().len(), 1);
    }
}
```

- [ ] **Step 6 : sérialisation CSV**

Créer `apps/sfu/src/telemetry/csv.rs`. Il expose `pub fn samples_to_csv(entries: &[Entry]) -> String`, qui ne retient que `TrackSample`, `PeerSample` et `LegSample` et rend un CSV à colonne `kind` discriminante :

```
kind,at,peer_id,track_id,bytes,packets,nacks,plis,firs,jitter_ms,loss,rtt_ms,bytes_rx,bytes_tx,transport_bytes_rx,transport_bytes_tx,egress_loss,bwe_bps
```

Règles, à tester :
- en-tête toujours émis, même sans aucune entrée ;
- un champ `Option::None` rend une chaîne vide, jamais `null` ni `0` — un zéro se confondrait avec une mesure réelle ;
- les entrées qui ne sont pas des échantillons sont ignorées sans erreur.

Écrire les tests **avant** l'implémentation, sur ces trois règles.

- [ ] **Step 7 : la capacité de l'anneau en configuration**

Dans `TelemetryConfig`, ajouter `pub ring_capacity: usize,` avec pour défaut **131 072** et la lecture de `SFU_TELEMETRY_RING`, en suivant exactement la forme de `queue_depth` (valeur illisible ou nulle → défaut). Documenter le dimensionnement en commentaire : à 8 participants, une seconde produit ~136 entrées (8 peer + 16 track + 112 leg), soit ~16 minutes de fenêtre. Étendre le test `telemetry_is_off_by_default` avec la nouvelle valeur.

- [ ] **Step 8 : choisir le sink au démarrage**

`AppState::new` **reste synchrone** et prend le sink : `pub fn new(config: Config, sink: Arc<dyn TelemetrySink>) -> Self`. Un seul constructeur, pas de variante `with_telemetry` à côté.

Mettre à jour ses deux appelants : `signaling/dispatch.rs:220` passe `Arc::new(NoopSink)`, et `main.rs` construit :

```rust
    // Sans URL de base, seul l'anneau : l'export de campagne ne dépend jamais
    // d'un Postgres debout, ni sur le harness ni sur la machine de déploiement.
    let ring = Arc::new(RingSink::new(config.telemetry.ring_capacity));
    let metrics = Metrics::new();

    let sink: Arc<dyn TelemetrySink> = match PgWriter::connect(&config.telemetry, env!("CARGO_PKG_VERSION")).await {
        Ok(writer) => {
            let (queue, rx) = QueueSink::new(config.telemetry.queue_depth, metrics.clone());
            tasks::spawn_writer(Arc::new(writer), rx, config.telemetry.sample_interval);
            Arc::new(TeeSink::new(vec![ring.clone(), queue]))
        }
        Err(e) => {
            // Une base injoignable ne doit pas empêcher un SFU de servir des
            // appels : on perd la persistance, pas le service.
            tracing::warn!("Télémétrie — persistance désactivée : {e}");
            ring.clone()
        }
    };
```

Adapter à la signature réelle de `PgWriter::connect` (`pg.rs:26`), et ne tenter la connexion que si `config.telemetry.database_url.is_some()`. Le `ring` doit rester accessible à `AppState` pour la route d'export — l'ajouter comme champ `pub ring: Arc<RingSink>`.

- [ ] **Step 9 : la route d'export**

Dans `http/routes.rs` :

```rust
/// Time series of the samples still held in the ring.
///
/// `format=csv` is what the campaign harness consumes; `format=json` is for
/// reading by hand. Reading does not consume: two successive reads during one
/// scenario see the same samples.
pub async fn telemetry_samples(
    State(state): State<AppState>,
    Query(params): Query<SamplesQuery>,
) -> impl IntoResponse {
    let entries = state.ring.snapshot();
    match params.format.as_deref() {
        Some("json") => axum::Json(/* ... */).into_response(),
        _ => (
            [(axum::http::header::CONTENT_TYPE, "text/csv; charset=utf-8")],
            crate::telemetry::csv::samples_to_csv(&entries),
        )
            .into_response(),
    }
}
```

CSV par défaut : c'est le format de la campagne, et un `curl` sans paramètre doit donner ce qui sert. Monter la route dans `build_router` : `.route("/telemetry/samples", get(http::routes::telemetry_samples))`.

Le paramètre `since` annoncé dans la spec se filtre sur `at` ; si l'implémenter demande plus que quelques lignes, le livrer dans ce même commit reste préférable à le reporter — le harness s'en sert pour ne pas relire toute la fenêtre entre deux cellules.

- [ ] **Step 10 : la vérification en 60 secondes**

```bash
cd apps/sfu && cargo run
```
Ouvrir **trois** onglets sur `https://localhost:3000`, même room, attendre ~15 s, puis :

```bash
curl -k "https://localhost:3000/telemetry/samples?format=csv" | head -20
```

Attendu : un en-tête, puis des lignes `track`, `peer` et `leg` dont `bytes` et `packets` sont non nuls et varient d'une seconde à l'autre. Trois participants, pas deux : les lignes `leg` n'ont de sens qu'à partir de là.

Si le fichier est vide, le coupable est presque toujours l'un de ces trois : `set_stats_interval` non appelé (Task 2 Step 6), sink resté `NoopSink` (Step 8), ou occupation non mirée — un peer qui n'a rejoint aucune room ne produit aucun échantillon, par construction.

- [ ] **Step 11 : suite complète et commit**

```bash
cd apps/sfu && cargo test && cargo clippy --all-targets && cargo fmt
git add apps/sfu
git commit -m "feat(telemetry): export de campagne en CSV et câblage de la persistance"
```

---

## Task 5 : mesurer le coût de l'instrumentation

Critère d'acceptation de LUM-553 : « L'overhead CPU de la collecte est mesuré et jugé acceptable ». La propriété à verrouiller est que **le sampler ne fait aucun travail par paquet** — il ne s'exécute que sur l'événement de statistiques, une fois par seconde. Le bench transforme cette affirmation en test.

**Files:**
- Modify: `apps/sfu/benches/forwarding.rs`
- Create: `docs/phase-0/instrumentation-cost.md`

**Interfaces:**
- Consumes: `Sampler`, le harness criterion existant.
- Produces: un chiffre publiable, cité par la campagne.

- [ ] **Step 1 : lire le bench existant**

```bash
cd apps/sfu && sed -n '1,80p' benches/forwarding.rs
```
Relever comment il construit son sink en mémoire et son fanout : le nouveau cas doit s'y calquer, pas inventer sa propre mise en place.

- [ ] **Step 2 : ajouter le cas de mesure**

Deux groupes criterion :

1. **`forward_rtp`** — le cas existant, inchangé, qui sert de référence.
2. **`sampler_observe`** — le coût d'un `observe_ingress` isolé, c'est-à-dire le coût réel payé une fois par seconde et par m-line.

Le second n'est pas une variante du premier : il mesure un chemin que le premier ne traverse jamais. C'est précisément ce que le bench doit démontrer.

```bash
cd apps/sfu && cargo bench
```

- [ ] **Step 3 : écrire le constat**

`docs/phase-0/instrumentation-cost.md`, en anglais (destiné à publication), trois éléments :
- le coût par paquet de `forward_rtp`, avant et après ce chantier — attendu identique aux barres d'erreur près ;
- le coût d'un `observe_ingress`, et son extrapolation : × (nombre de m-lines) × 1/seconde ;
- la conclusion en une phrase, avec les chiffres, pas une affirmation qualitative.

Si le coût par paquet **a** bougé de façon mesurable, ne pas publier le document : c'est qu'un appel au sampler a fui sur le chemin chaud. Le trouver et le sortir de là est le travail, pas l'arrondi du chiffre.

- [ ] **Step 4 : commit**

```bash
git add apps/sfu/benches docs/phase-0/instrumentation-cost.md
git commit -m "bench(sfu): coût de l'instrumentation de qualité"
```

---

## Task 6 : réconcilier les documents d'onboarding

Livrer une instrumentation maintenable dans un dépôt dont la porte d'entrée ment annule le bénéfice. Les contradictions ci-dessous sont constatées, pas supposées.

**Files:**
- Modify: `CONTRIBUTING.md`, `README.md`, `apps/sfu/CONTEXT.md`

- [ ] **Step 1 : corriger le compte de tests**

```bash
cd apps/sfu && cargo test 2>&1 | grep -E "^test result" 
```

Trois documents annoncent trois chiffres différents et les trois ont tort : `CONTRIBUTING.md` et `README.md` disent 68, `CONTEXT.md` dit 98. Reporter le chiffre réel dans les trois.

- [ ] **Step 2 : corriger « Good places to start » dans `CONTRIBUTING.md`**

- **Retirer** *Restore working keyframe requests* — `CONTEXT.md` déclare « PLI fonctionnelles, dans les deux sens ». Vérifier avant de retirer, puis retirer.
- **Retirer** *SDP renegotiation* — `CONTEXT.md` déclare « Renégociation à l'arrivée et au départ d'un participant ». Même vérification.
- **Retirer** *RTCP parsing for quality metrics* — c'est ce chantier. La ligne dit « This is the milestone the project is named after » ; elle doit migrer vers l'état courant, pas disparaître sans trace.
- **Corriger** l'affirmation « three of the five `/metrics` counters are permanently zero » : `CONTEXT.md` déclare `/metrics` alimenté. Vérifier laquelle des deux est vraie **en lançant le serveur**, puis écrire ce qui est constaté.

- [ ] **Step 3 : ajouter la section « la mesure » à `CONTEXT.md`**

Dans la forme des sections existantes — « La frontière média ↔ transport », « Les keyframes » — donc : le principe, le piège, et pourquoi c'est ainsi. Couvrir :

- str0m n'émet ses statistiques que si `set_stats_interval` est appelé ; c'est éteint par défaut et ça l'a été longtemps ici ;
- le `Sampler` est pur et reçoit son horloge, ce qui rend la conversion testable sans runtime ;
- les statistiques ont **leur propre canal**, et pourquoi : la file média jette sous rafale, donc elle aurait jeté les mesures exactement dans les scénarios qui décident du gate ;
- un *leg* n'est pas un track, et rattacher un mid sortant à un track fabriquerait des lignes fantômes ;
- l'anneau d'export, et la vérification en 60 secondes.

Réévaluer aussi le point connu n° 4 (« Les compteurs de paquets jetés du `PeerSink` ne remontent pas sur `/metrics` ») : ce chantier ne le corrige pas, mais l'obstacle qu'il décrit — « `media/` n'a pas accès à `Metrics` » — mérite d'être relu à la lumière du chemin que `record_stats` emprunte.

- [ ] **Step 4 : ajouter la vérification à la checklist pré-PR**

Dans la section « Before you open a PR » de `CONTRIBUTING.md`, après les commandes existantes :

```bash
# La chaîne de mesure, en 60 secondes : lancer, trois onglets sur la même room,
# puis vérifier que des chiffres sortent et qu'ils bougent.
cargo run
curl -k "https://localhost:3000/telemetry/samples?format=csv" | head
```

- [ ] **Step 5 : pointer la sémantique vers le code**

Ajouter dans `CONTEXT.md` que l'unité et la sémantique de chaque compteur sont les doc comments de `TrackSample`, `LegSample` et `PeerSample`, et **pas** une page markdown parallèle. Le seul élément que le markdown porte est la liste des colonnes toujours `NULL` et pourquoi : `bwe_bps` jusqu'à LUM-578.

La raison est sous nos yeux : trois documents annonçaient trois comptes de tests différents. Une seule source de vérité, ou elle diverge.

- [ ] **Step 6 : commit**

```bash
git add CONTRIBUTING.md README.md apps/sfu/CONTEXT.md
git commit -m "docs: réconcilier CONTRIBUTING, CONTEXT et README avec l'état réel"
```

---

## Après le plan

**Ticket de suite à créer dans Linear** (décision D4) : `client_stats` — message de signaling client → serveur portant `freezeCount`, `totalFreezesDuration`, `concealedSamples`, `jitterBufferDelay` par track entrant ; `Entry::ClientSample` ; poll `getStats()` dans `assets/test.html`. À revoir contre LUM-570 (figer le protocole de signaling v1).

Tant qu'il n'est pas fait, la campagne LUM-558 ne dispose pas des compteurs de gel : le §4.4 de la matrice le dit, et la règle de verdict reste franchissable sans.
