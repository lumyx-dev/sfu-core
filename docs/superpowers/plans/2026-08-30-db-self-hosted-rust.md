# Socle de persistance self-hosted (Rust) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le SFU persiste sa télémétrie dans Postgres quand `SFU_DATABASE_URL` est présente, et se comporte exactement comme aujourd'hui quand elle ne l'est pas.

**Architecture :** un trait `TelemetrySink` **synchrone qui n'écrit jamais** — il met en file et jette quand la file est pleine, exactement comme `RtpSink`. Deux implémentations : `NoopSink` (persistance désactivée) et `QueueSink` (mise en file bornée). Toute l'I/O vit dans une tâche d'écriture qui groupe une seconde d'entrées en un lot et l'écrit en une transaction. Le chemin chaud n'est pas touché.

**Tech Stack :** Rust 2024, sqlx 0.8 (Postgres, migrations embarquées), chrono, uuid, str0m 0.23.1, tokio, dashmap.

**Spec :** `docs/superpowers/specs/2026-08-30-db-self-hosted-design.md` — le plan argumente depuis la spec, lisez les deux.

**Suite :** un second plan couvrira `packages/db` (Drizzle, schéma `app`, verrou de schéma, requêtes de lecture) et l'évaluation des seuils d'alerte, qui dépend de la table `app.alert_rules`.

## Global Constraints

- **Sans `SFU_DATABASE_URL`, le comportement est identique à aujourd'hui**, `cargo test` compris. Aucun test existant ne doit exiger Postgres.
- **Le chemin chaud reste intact.** `forward_rtp` reste synchrone, sans allocation, sans I/O. Aucune tâche de télémétrie ne prend un verrou qu'il détient.
- **`media/` ne dépend jamais de `transport/`.** La télémétrie ne réintroduit pas cette dépendance.
- **Une base ne dégrade jamais un appel.** Toute file de télémétrie est bornée et jette ; jamais de `send().await`, jamais de file non bornée.
- **Commentaires et messages de log en français, documentation de code en anglais** — comme tout l'existant.
- `cargo clippy --all-targets` sans warning et `cargo test` vert à chaque commit.
- Les tests d'intégration Postgres sont **conditionnés** à `SFU_TEST_DATABASE_URL`. Absente, ils s'arrêtent immédiatement en succès après un `eprintln!` explicite. Ils ne sont jamais `#[ignore]`, pour rester exécutables en CI par une simple variable.

---

## Structure de fichiers

| Fichier | Responsabilité | Action |
|---|---|---|
| `src/config.rs` | sept variables `SFU_*` de télémétrie | modifier |
| `src/telemetry/mod.rs` | racine du module, `Telemetry` (façade + registres) | **créer** |
| `src/telemetry/entry.rs` | `Entry`, `TrackKind`, `EventKind`, `Severity` — ce qui peut être écrit | **créer** |
| `src/telemetry/sink.rs` | trait `TelemetrySink`, `NoopSink`, `MemorySink` (tests), `QueueSink` | **créer** |
| `src/telemetry/batch.rs` | `Batch::from_entries` — regroupement pur, testable sans base | **créer** |
| `src/telemetry/pg.rs` | `PgWriter` : ouverture du pool, migrations, écriture d'un `Batch` | **créer** |
| `src/telemetry/sampler.rs` | cumuls str0m → deltas, conversion du jitter en ms | **créer** |
| `src/telemetry/retention.rs` | DDL de partition (pure), rollup, purge | **créer** |
| `src/telemetry/tasks.rs` | les tâches tokio : écriture, maintenance, rollup | **créer** |
| `migrations/0001_telemetry.sql` | le schéma `telemetry` | **créer** |
| `src/metrics/mod.rs` | compteur `telemetry_entries_dropped` | modifier |
| `src/room/manager.rs` | `Room::session_id`, `JoinOutcome`, `LeaveOutcome` | modifier |
| `src/transport/peer_connection.rs` | `set_stats_interval`, `rx_clock_rate` | modifier |
| `src/transport/event_loop.rs` | trois variantes `TransportEvent` de statistiques | modifier |
| `src/signaling/session.rs` | émission du cycle de vie et des échantillons | modifier |
| `src/signaling/dispatch.rs` | émission de `RoomOpened` / `PeerJoined` | modifier |
| `src/app.rs` | `AppState.telemetry`, démarrage des tâches | modifier |
| `tests/telemetry_pg.rs` | intégration Postgres, conditionnée par variable | **créer** |
| `README.md`, `CONTEXT.md` | les nouvelles variables, le nouveau chemin d'écriture | modifier |

---

## Task 1 : les sept variables de configuration

**Files:**
- Modify: `apps/sfu/src/config.rs`

**Interfaces:**
- Produces:
```rust
pub struct TelemetryConfig {
    pub database_url: Option<String>,
    pub instance_name: String,
    pub region: String,
    pub sample_interval: Duration,
    pub retention_raw: Duration,
    pub retention_rollup: Duration,
    pub queue_depth: usize,
}
impl Config { pub telemetry: TelemetryConfig }
```

- [ ] **Step 1: Écrire le test qui échoue**

Dans le `mod tests` existant de `src/config.rs` :

```rust
#[test]
fn telemetry_is_off_by_default() {
    let c = Config::default();
    assert!(c.telemetry.database_url.is_none());
    assert_eq!(c.telemetry.region, "local");
    assert_eq!(c.telemetry.sample_interval, Duration::from_secs(1));
    assert_eq!(c.telemetry.retention_raw, Duration::from_secs(24 * 3600));
    assert_eq!(c.telemetry.retention_rollup, Duration::from_secs(30 * 24 * 3600));
    assert_eq!(c.telemetry.queue_depth, 256);
}

#[test]
fn durations_are_parsed_as_seconds() {
    // Les durées se lisent en secondes, comme partout ailleurs dans l'écosystème
    // douze-facteurs : `SFU_RETENTION_RAW=3600` vaut une heure.
    assert_eq!(parse_secs("3600", Duration::from_secs(1)), Duration::from_secs(3600));
    // Une valeur illisible retombe sur le défaut plutôt que de refuser de démarrer :
    // c'est la règle déjà appliquée par tout `from_env` de ce fichier.
    assert_eq!(parse_secs("douze", Duration::from_secs(7)), Duration::from_secs(7));
    // Zéro est refusé : une rétention nulle purgerait la table à chaque passage.
    assert_eq!(parse_secs("0", Duration::from_secs(7)), Duration::from_secs(7));
}
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `rtk cargo test -p sfu --lib config`
Expected: FAIL — `no field telemetry on type Config`, `cannot find function parse_secs`

- [ ] **Step 3: Implémenter**

En haut de `src/config.rs`, ajouter `use std::time::Duration;`.

```rust
/// Telemetry persistence settings.
///
/// `database_url` absent means persistence is off: the SFU keeps everything in
/// memory, exactly as it did before this module existed.
#[derive(Debug, Clone)]
pub struct TelemetryConfig {
    pub database_url: Option<String>,
    /// Displayed instance name. Defaults to the hostname.
    pub instance_name: String,
    /// Instance-level region label. Never a per-peer attribute.
    pub region: String,
    /// Sampling cadence, also passed to str0m's `set_stats_interval`.
    pub sample_interval: Duration,
    /// How long the raw 1 s tables are kept.
    pub retention_raw: Duration,
    /// How long the 1 min rollup and the events are kept.
    pub retention_rollup: Duration,
    /// Bounded queue depth, in entries, before telemetry starts dropping.
    pub queue_depth: usize,
}

impl Default for TelemetryConfig {
    fn default() -> Self {
        TelemetryConfig {
            database_url: None,
            instance_name: hostname(),
            region: "local".to_string(),
            sample_interval: Duration::from_secs(1),
            retention_raw: Duration::from_secs(24 * 3600),
            retention_rollup: Duration::from_secs(30 * 24 * 3600),
            queue_depth: 256,
        }
    }
}

/// The machine's hostname, or `sightline-sfu` when it cannot be read.
///
/// No dependency for this: `hostname(3)` through `std` does not exist, and
/// pulling a crate to read one string would be disproportionate.
fn hostname() -> String {
    std::process::Command::new("hostname")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "sightline-sfu".to_string())
}

/// Reads a duration expressed in seconds, falling back to `default` when the
/// value is missing, unparseable or zero.
fn parse_secs(raw: &str, default: Duration) -> Duration {
    match raw.parse::<u64>() {
        Ok(s) if s > 0 => Duration::from_secs(s),
        _ => default,
    }
}
```

Puis, dans `Config`, ajouter le champ `pub telemetry: TelemetryConfig`, dans `Default` la ligne `telemetry: TelemetryConfig::default()`, et dans `from_env` :

```rust
telemetry: TelemetryConfig {
    // Une chaîne vide vaut absente : `SFU_DATABASE_URL=` dans un .env ne doit
    // pas activer la persistance sur une URL invalide.
    database_url: std::env::var("SFU_DATABASE_URL").ok().filter(|v| !v.is_empty()),
    instance_name: std::env::var("SFU_INSTANCE_NAME")
        .unwrap_or(defaults.telemetry.instance_name),
    region: std::env::var("SFU_REGION").unwrap_or(defaults.telemetry.region),
    sample_interval: std::env::var("SFU_SAMPLE_INTERVAL")
        .map(|v| parse_secs(&v, defaults.telemetry.sample_interval))
        .unwrap_or(defaults.telemetry.sample_interval),
    retention_raw: std::env::var("SFU_RETENTION_RAW")
        .map(|v| parse_secs(&v, defaults.telemetry.retention_raw))
        .unwrap_or(defaults.telemetry.retention_raw),
    retention_rollup: std::env::var("SFU_RETENTION_ROLLUP")
        .map(|v| parse_secs(&v, defaults.telemetry.retention_rollup))
        .unwrap_or(defaults.telemetry.retention_rollup),
    queue_depth: std::env::var("SFU_TELEMETRY_QUEUE")
        .ok()
        .and_then(|v| v.parse().ok())
        .filter(|d| *d > 0)
        .unwrap_or(defaults.telemetry.queue_depth),
},
```

Note : `defaults` est déplacé par ces expressions. Construire `let defaults = Config::default();` en début de `from_env` comme aujourd'hui, et lire `defaults.telemetry` **en dernier** dans la structure, ou cloner : `let dt = defaults.telemetry.clone();` puis lire `dt`. Prendre la seconde option, plus lisible.

- [ ] **Step 4: Lancer les tests**

Run: `rtk cargo test -p sfu --lib config && rtk cargo clippy --all-targets`
Expected: PASS, aucun warning. `defaults_match_historical_hardcoded_values` doit toujours passer.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/sfu/src/config.rs
rtk git commit -m "feat(sfu): configuration de la telemetrie (sept variables SFU_)"
```

---

## Task 2 : `Entry`, `TelemetrySink` et ses implémentations sans I/O

C'est le cœur de la conception : un trait synchrone qui ne fait jamais d'I/O, comme `RtpSink`. Tout ce qui suit dans ce plan se teste sans Postgres grâce à lui.

**Files:**
- Create: `apps/sfu/src/telemetry/mod.rs`, `apps/sfu/src/telemetry/entry.rs`, `apps/sfu/src/telemetry/sink.rs`
- Modify: `apps/sfu/src/lib.rs`

**Interfaces:**
- Produces:
```rust
pub enum TrackKind { Audio, Video }
pub enum Severity { Info, Warning, Critical }
pub enum EventKind { InstanceStarted, InstanceRecovered, RoomCreated, RoomEnded,
                     PeerJoined, PeerLeft, TrackPublished, TrackEnded,
                     IceConnected, IceDisconnected, IceFailed, Renegotiated,
                     ThresholdBreached, ThresholdCleared }
pub enum Entry { RoomOpened{..}, RoomClosed{..}, PeerJoined{..}, PeerLeft{..},
                 TrackPublished{..}, TrackCodec{..}, TrackEnded{..},
                 TrackSample(TrackSample), PeerSample(PeerSample), Event(EventRecord) }
pub trait TelemetrySink: Send + Sync { fn record(&self, entry: Entry); }
pub struct NoopSink;
pub struct MemorySink;  impl MemorySink { pub fn drain(&self) -> Vec<Entry> }
```

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `apps/sfu/src/telemetry/sink.rs` avec, pour l'instant, uniquement son `mod tests` :

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
    fn the_noop_sink_swallows_everything() {
        // Aucune assertion possible sur un puits : ce test existe pour qu'un
        // futur NoopSink qui paniquerait ou allouerait soit repéré.
        let sink = NoopSink;
        for _ in 0..1000 {
            sink.record(a_track());
        }
    }

    #[test]
    fn the_memory_sink_keeps_what_it_is_given_in_order() {
        let sink = MemorySink::new();
        let first = a_track();
        let second = a_track();
        let (id_first, id_second) = (entry_id(&first), entry_id(&second));

        sink.record(first);
        sink.record(second);

        let drained = sink.drain();
        assert_eq!(drained.len(), 2);
        assert_eq!(entry_id(&drained[0]), id_first);
        assert_eq!(entry_id(&drained[1]), id_second);
    }

    #[test]
    fn draining_empties_the_memory_sink() {
        let sink = MemorySink::new();
        sink.record(a_track());
        assert_eq!(sink.drain().len(), 1);
        assert_eq!(sink.drain().len(), 0);
    }

    fn entry_id(e: &Entry) -> Uuid {
        match e {
            Entry::TrackPublished { id, .. } => *id,
            _ => panic!("le test ne fabrique que des TrackPublished"),
        }
    }
}
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `rtk cargo test -p sfu --lib telemetry`
Expected: FAIL — le module `telemetry` n'existe pas.

- [ ] **Step 3: Ajouter les dépendances**

```bash
cd apps/sfu
cargo add chrono --features serde
cargo add sqlx --no-default-features --features runtime-tokio,tls-rustls,postgres,uuid,chrono,migrate
```

Vérifier ensuite dans `Cargo.toml` que `uuid` porte bien la feature `v4` (elle y est déjà) et que sqlx a résolu en 0.8.x. `cargo build` doit passer.

- [ ] **Step 4: Écrire `entry.rs`**

```rust
//! What the SFU can hand to telemetry.
//!
//! One flat enum rather than a method per record type: the queue between the
//! producers and the writer carries a single type, and adding a record later
//! means adding a variant, not widening a trait every implementation has to
//! follow.

use chrono::{DateTime, Utc};
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrackKind {
    Audio,
    Video,
}

impl TrackKind {
    /// The `telemetry.track_kind` label this maps to.
    pub fn as_str(self) -> &'static str {
        match self {
            TrackKind::Audio => "audio",
            TrackKind::Video => "video",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Severity {
    Info,
    Warning,
    Critical,
}

impl Severity {
    pub fn as_str(self) -> &'static str {
        match self {
            Severity::Info => "info",
            Severity::Warning => "warning",
            Severity::Critical => "critical",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EventKind {
    InstanceStarted,
    InstanceRecovered,
    RoomCreated,
    RoomEnded,
    PeerJoined,
    PeerLeft,
    TrackPublished,
    TrackEnded,
    IceConnected,
    IceDisconnected,
    IceFailed,
    Renegotiated,
    ThresholdBreached,
    ThresholdCleared,
}

impl EventKind {
    pub fn as_str(self) -> &'static str {
        match self {
            EventKind::InstanceStarted => "instance_started",
            EventKind::InstanceRecovered => "instance_recovered",
            EventKind::RoomCreated => "room_created",
            EventKind::RoomEnded => "room_ended",
            EventKind::PeerJoined => "peer_joined",
            EventKind::PeerLeft => "peer_left",
            EventKind::TrackPublished => "track_published",
            EventKind::TrackEnded => "track_ended",
            EventKind::IceConnected => "ice_connected",
            EventKind::IceDisconnected => "ice_disconnected",
            EventKind::IceFailed => "ice_failed",
            EventKind::Renegotiated => "renegotiated",
            EventKind::ThresholdBreached => "threshold_breached",
            EventKind::ThresholdCleared => "threshold_cleared",
        }
    }

    /// The severity a given kind carries by default.
    pub fn severity(self) -> Severity {
        match self {
            EventKind::IceFailed | EventKind::ThresholdBreached => Severity::Critical,
            EventKind::IceDisconnected => Severity::Warning,
            _ => Severity::Info,
        }
    }
}

/// One second of a track, as **deltas** — never cumulative counters.
///
/// str0m reports totals since the start of the connection; the sampler
/// subtracts the previous reading. A delta sums and averages over any window;
/// a total needs a window function on every query and goes wrong the moment a
/// row is missing, which will happen since the queue drops.
#[derive(Debug, Clone, PartialEq)]
pub struct TrackSample {
    pub track_id: Uuid,
    pub at: DateTime<Utc>,
    pub bytes: i64,
    pub packets: i64,
    pub nacks: i32,
    pub plis: i32,
    pub firs: i32,
    /// Converted from RTP clock units. `None` until a report has arrived.
    pub jitter_ms: Option<f32>,
    /// Fraction between 0 and 1.
    pub loss: Option<f32>,
    pub rtt_ms: Option<f32>,
}

/// One second of a peer's transport, as deltas.
#[derive(Debug, Clone, PartialEq)]
pub struct PeerSample {
    pub peer_id: Uuid,
    pub at: DateTime<Utc>,
    pub bytes_rx: i64,
    pub bytes_tx: i64,
    pub transport_bytes_rx: i64,
    pub transport_bytes_tx: i64,
    pub egress_loss: Option<f32>,
    pub bwe_bps: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct EventRecord {
    pub at: DateTime<Utc>,
    pub kind: EventKind,
    pub severity: Severity,
    pub room_id: Option<Uuid>,
    pub peer_id: Option<Uuid>,
    pub track_id: Option<Uuid>,
    pub payload: Value,
}

impl EventRecord {
    /// An event with the kind's default severity and an empty payload.
    pub fn new(kind: EventKind, at: DateTime<Utc>) -> Self {
        EventRecord {
            at,
            kind,
            severity: kind.severity(),
            room_id: None,
            peer_id: None,
            track_id: None,
            payload: Value::Object(Default::default()),
        }
    }

    pub fn room(mut self, id: Uuid) -> Self {
        self.room_id = Some(id);
        self
    }

    pub fn peer(mut self, id: Uuid) -> Self {
        self.peer_id = Some(id);
        self
    }

    pub fn track(mut self, id: Uuid) -> Self {
        self.track_id = Some(id);
        self
    }

    pub fn payload(mut self, payload: Value) -> Self {
        self.payload = payload;
        self
    }
}

#[derive(Debug, Clone)]
pub enum Entry {
    RoomOpened {
        id: Uuid,
        name: String,
        at: DateTime<Utc>,
    },
    RoomClosed {
        id: Uuid,
        at: DateTime<Utc>,
        /// `"empty"` or `"instance_restart"`.
        reason: &'static str,
    },
    PeerJoined {
        id: Uuid,
        room_id: Uuid,
        at: DateTime<Utc>,
    },
    PeerLeft {
        id: Uuid,
        at: DateTime<Utc>,
        close_code: Option<i32>,
    },
    IceState {
        peer_id: Uuid,
        state: String,
        at: DateTime<Utc>,
    },
    TrackPublished {
        id: Uuid,
        peer_id: Uuid,
        mid: String,
        kind: TrackKind,
        at: DateTime<Utc>,
    },
    /// Resolved on the track's first packet: `MediaAdded` does not carry the
    /// codec, only the first `PayloadParams` does.
    TrackCodec {
        id: Uuid,
        codec: String,
        clock_rate: i32,
    },
    TrackEnded {
        id: Uuid,
        at: DateTime<Utc>,
    },
    TrackSample(TrackSample),
    PeerSample(PeerSample),
    Event(EventRecord),
}
```

Ajouter `serde_json` est inutile : il est déjà dans `Cargo.toml`.

- [ ] **Step 5: Écrire `sink.rs`**

Au-dessus du `mod tests` déjà écrit à l'étape 1 :

```rust
//! Where telemetry entries go.
//!
//! The trait is **synchronous and never does I/O**, deliberately mirroring
//! `RtpSink`: producers call it from the middle of a lock or a hot loop, so it
//! may only enqueue. All database work happens in the writer task.
//!
//! `NoopSink` is what runs when persistence is off. Having it means no
//! `if let Some(db)` scattered across the codebase: there is always a sink.

use super::entry::Entry;
use std::sync::Mutex;

pub trait TelemetrySink: Send + Sync {
    /// Records an entry. Must never block and never fail.
    fn record(&self, entry: Entry);
}

/// Persistence disabled.
pub struct NoopSink;

impl TelemetrySink for NoopSink {
    fn record(&self, _entry: Entry) {}
}

/// Collects entries in memory, for tests.
#[derive(Default)]
pub struct MemorySink {
    entries: Mutex<Vec<Entry>>,
}

impl MemorySink {
    pub fn new() -> Self {
        Self::default()
    }

    /// Takes everything recorded so far, leaving the sink empty.
    pub fn drain(&self) -> Vec<Entry> {
        std::mem::take(&mut *self.entries.lock().expect("MemorySink non empoisonné"))
    }
}

impl TelemetrySink for MemorySink {
    fn record(&self, entry: Entry) {
        self.entries
            .lock()
            .expect("MemorySink non empoisonné")
            .push(entry);
    }
}
```

- [ ] **Step 6: Déclarer le module**

`apps/sfu/src/telemetry/mod.rs` :

```rust
//! Optional telemetry persistence.
//!
//! Off unless `SFU_DATABASE_URL` is set. The write path never touches the
//! media hot path: producers enqueue through [`TelemetrySink`], and a
//! background task batches one second of entries into a single transaction.

pub mod entry;
pub mod sink;

pub use entry::{Entry, EventKind, EventRecord, PeerSample, Severity, TrackKind, TrackSample};
pub use sink::{MemorySink, NoopSink, TelemetrySink};
```

Et dans `src/lib.rs`, ajouter `pub mod telemetry;` en gardant l'ordre alphabétique (entre `signaling` et `transport`).

- [ ] **Step 7: Lancer les tests**

Run: `rtk cargo test -p sfu --lib telemetry && rtk cargo clippy --all-targets`
Expected: PASS, aucun warning.

- [ ] **Step 8: Commit**

```bash
rtk git add apps/sfu/src/telemetry apps/sfu/src/lib.rs apps/sfu/Cargo.toml Cargo.lock
rtk git commit -m "feat(sfu): trait TelemetrySink et modele des entrees, sans I/O"
```

---

## Task 3 : le regroupement en lots, testé sans base

`Batch::from_entries` est une fonction pure. C'est elle qui rend la logique d'écriture testable sans Postgres — le même pari que l'`RtpSink` en mémoire pour le routage.

**Files:**
- Create: `apps/sfu/src/telemetry/batch.rs`
- Modify: `apps/sfu/src/telemetry/mod.rs`

**Interfaces:**
- Consumes: `Entry`, `TrackSample`, `PeerSample`, `EventRecord` (Task 2)
- Produces:
```rust
pub struct Batch {
    pub rooms_opened: Vec<(Uuid, String, DateTime<Utc>)>,
    pub rooms_closed: Vec<(Uuid, DateTime<Utc>, &'static str)>,
    pub peers_joined: Vec<(Uuid, Uuid, DateTime<Utc>)>,
    pub peers_left: Vec<(Uuid, DateTime<Utc>, Option<i32>)>,
    pub ice_states: Vec<(Uuid, String, DateTime<Utc>)>,
    pub tracks_published: Vec<(Uuid, Uuid, String, TrackKind, DateTime<Utc>)>,
    pub track_codecs: Vec<(Uuid, String, i32)>,
    pub tracks_ended: Vec<(Uuid, DateTime<Utc>)>,
    pub track_samples: Vec<TrackSample>,
    pub peer_samples: Vec<PeerSample>,
    pub events: Vec<EventRecord>,
}
impl Batch {
    pub fn from_entries(entries: Vec<Entry>) -> Self;
    pub fn is_empty(&self) -> bool;
    pub fn len(&self) -> usize;
    pub fn touched_rooms(&self) -> Vec<Uuid>;
}
```

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `apps/sfu/src/telemetry/batch.rs` :

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::telemetry::entry::{EventKind, EventRecord, TrackSample};
    use chrono::Utc;
    use uuid::Uuid;

    #[test]
    fn an_empty_batch_is_empty() {
        let b = Batch::from_entries(vec![]);
        assert!(b.is_empty());
        assert_eq!(b.len(), 0);
    }

    #[test]
    fn each_entry_lands_in_its_own_bucket() {
        let room = Uuid::new_v4();
        let peer = Uuid::new_v4();
        let now = Utc::now();

        let b = Batch::from_entries(vec![
            Entry::RoomOpened { id: room, name: "test-room".into(), at: now },
            Entry::PeerJoined { id: peer, room_id: room, at: now },
            Entry::Event(EventRecord::new(EventKind::RoomCreated, now).room(room)),
        ]);

        assert_eq!(b.rooms_opened.len(), 1);
        assert_eq!(b.peers_joined.len(), 1);
        assert_eq!(b.events.len(), 1);
        assert_eq!(b.tracks_published.len(), 0);
        assert_eq!(b.len(), 3);
        assert!(!b.is_empty());
    }

    #[test]
    fn the_order_inside_a_bucket_is_preserved() {
        // L'ordre compte : deux échantillons du même track à la même seconde
        // violeraient la clé primaire, et c'est le dernier qui doit gagner.
        let track = Uuid::new_v4();
        let now = Utc::now();
        let b = Batch::from_entries(vec![
            Entry::TrackSample(sample(track, now, 10)),
            Entry::TrackSample(sample(track, now, 20)),
        ]);
        assert_eq!(b.track_samples.len(), 2);
        assert_eq!(b.track_samples[0].bytes, 10);
        assert_eq!(b.track_samples[1].bytes, 20);
    }

    #[test]
    fn touched_rooms_deduplicates() {
        // La charge utile du NOTIFY ne doit pas répéter une room parce que
        // trois peers y ont bougé dans la même seconde.
        let a = Uuid::new_v4();
        let b_room = Uuid::new_v4();
        let now = Utc::now();
        let batch = Batch::from_entries(vec![
            Entry::RoomOpened { id: a, name: "a".into(), at: now },
            Entry::PeerJoined { id: Uuid::new_v4(), room_id: a, at: now },
            Entry::PeerJoined { id: Uuid::new_v4(), room_id: b_room, at: now },
            Entry::RoomClosed { id: a, at: now, reason: "empty" },
        ]);

        let mut touched = batch.touched_rooms();
        touched.sort();
        let mut expected = vec![a, b_room];
        expected.sort();
        assert_eq!(touched, expected);
    }

    fn sample(track_id: Uuid, at: chrono::DateTime<Utc>, bytes: i64) -> TrackSample {
        TrackSample {
            track_id,
            at,
            bytes,
            packets: 1,
            nacks: 0,
            plis: 0,
            firs: 0,
            jitter_ms: None,
            loss: None,
            rtt_ms: None,
        }
    }
}
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `rtk cargo test -p sfu --lib telemetry::batch`
Expected: FAIL — `cannot find type Batch`

- [ ] **Step 3: Implémenter**

Au-dessus du `mod tests` :

```rust
//! Grouping a second of entries into one write.
//!
//! Pure and synchronous, which is the point: the shape of what gets written is
//! tested without a database, exactly as RTP routing is tested without a
//! socket.

use super::entry::{Entry, EventRecord, PeerSample, TrackKind, TrackSample};
use chrono::{DateTime, Utc};
use std::collections::HashSet;
use uuid::Uuid;

#[derive(Debug, Default)]
pub struct Batch {
    pub rooms_opened: Vec<(Uuid, String, DateTime<Utc>)>,
    pub rooms_closed: Vec<(Uuid, DateTime<Utc>, &'static str)>,
    pub peers_joined: Vec<(Uuid, Uuid, DateTime<Utc>)>,
    pub peers_left: Vec<(Uuid, DateTime<Utc>, Option<i32>)>,
    pub ice_states: Vec<(Uuid, String, DateTime<Utc>)>,
    pub tracks_published: Vec<(Uuid, Uuid, String, TrackKind, DateTime<Utc>)>,
    pub track_codecs: Vec<(Uuid, String, i32)>,
    pub tracks_ended: Vec<(Uuid, DateTime<Utc>)>,
    pub track_samples: Vec<TrackSample>,
    pub peer_samples: Vec<PeerSample>,
    pub events: Vec<EventRecord>,
}

impl Batch {
    pub fn from_entries(entries: Vec<Entry>) -> Self {
        let mut b = Batch::default();
        for entry in entries {
            match entry {
                Entry::RoomOpened { id, name, at } => b.rooms_opened.push((id, name, at)),
                Entry::RoomClosed { id, at, reason } => b.rooms_closed.push((id, at, reason)),
                Entry::PeerJoined { id, room_id, at } => b.peers_joined.push((id, room_id, at)),
                Entry::PeerLeft { id, at, close_code } => b.peers_left.push((id, at, close_code)),
                Entry::IceState { peer_id, state, at } => b.ice_states.push((peer_id, state, at)),
                Entry::TrackPublished { id, peer_id, mid, kind, at } => {
                    b.tracks_published.push((id, peer_id, mid, kind, at))
                }
                Entry::TrackCodec { id, codec, clock_rate } => {
                    b.track_codecs.push((id, codec, clock_rate))
                }
                Entry::TrackEnded { id, at } => b.tracks_ended.push((id, at)),
                Entry::TrackSample(s) => b.track_samples.push(s),
                Entry::PeerSample(s) => b.peer_samples.push(s),
                Entry::Event(e) => b.events.push(e),
            }
        }
        b
    }

    pub fn len(&self) -> usize {
        self.rooms_opened.len()
            + self.rooms_closed.len()
            + self.peers_joined.len()
            + self.peers_left.len()
            + self.ice_states.len()
            + self.tracks_published.len()
            + self.track_codecs.len()
            + self.tracks_ended.len()
            + self.track_samples.len()
            + self.peer_samples.len()
            + self.events.len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// The rooms this batch touched, deduplicated — the `NOTIFY` payload.
    pub fn touched_rooms(&self) -> Vec<Uuid> {
        let mut seen: HashSet<Uuid> = HashSet::new();
        seen.extend(self.rooms_opened.iter().map(|(id, _, _)| *id));
        seen.extend(self.rooms_closed.iter().map(|(id, _, _)| *id));
        seen.extend(self.peers_joined.iter().map(|(_, room, _)| *room));
        seen.extend(self.events.iter().filter_map(|e| e.room_id));
        seen.into_iter().collect()
    }
}
```

Ajouter `pub mod batch;` et `pub use batch::Batch;` dans `telemetry/mod.rs`.

- [ ] **Step 4: Lancer les tests**

Run: `rtk cargo test -p sfu --lib telemetry && rtk cargo clippy --all-targets`
Expected: PASS, aucun warning.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/sfu/src/telemetry
rtk git commit -m "feat(sfu): regroupement des entrees de telemetrie en lots"
```

---

## Task 4 : les migrations et l'écriture Postgres

**Files:**
- Create: `apps/sfu/migrations/0001_telemetry.sql`, `apps/sfu/src/telemetry/pg.rs`, `apps/sfu/tests/telemetry_pg.rs`
- Modify: `apps/sfu/src/telemetry/mod.rs`

**Interfaces:**
- Consumes: `Batch` (Task 3), `TelemetryConfig` (Task 1)
- Produces:
```rust
pub struct PgWriter { pool: PgPool, instance_id: Uuid }
impl PgWriter {
    pub async fn connect(cfg: &TelemetryConfig, version: &str) -> Result<Self, sqlx::Error>;
    pub fn instance_id(&self) -> Uuid;
    pub fn pool(&self) -> &PgPool;
    pub async fn write(&self, batch: &Batch) -> Result<(), sqlx::Error>;
    pub async fn recover_open_sessions(&self) -> Result<u64, sqlx::Error>;
}
```

- [ ] **Step 1: Écrire la migration**

Créer `apps/sfu/migrations/0001_telemetry.sql`. Le contenu est le SQL de la spec, **§6.1, §6.2 et §6.3, copiés dans cet ordre**, précédés de `create schema if not exists telemetry;` et suivis des partitions initiales.

Trois précisions que la spec laisse à l'implémentation :

```sql
-- Les types doivent être créés une seule fois : sqlx applique chaque migration
-- une fois, mais `create type` n'a pas de `if not exists`.
do $$ begin
  create type telemetry.track_kind as enum ('audio', 'video');
exception when duplicate_object then null; end $$;

do $$ begin
  create type telemetry.severity as enum ('info', 'warning', 'critical');
exception when duplicate_object then null; end $$;
```

```sql
-- Une partition par défaut sur chaque table partitionnée : sans elle, une
-- insertion dont l'horodatage sort des partitions créées échoue et fait perdre
-- tout le lot. Avec elle, la ligne atterrit dans le fourre-tout et la tâche de
-- maintenance la signale. Perdre la granularité vaut mieux que perdre la donnée.
create table telemetry.track_samples_default    partition of telemetry.track_samples    default;
create table telemetry.peer_samples_default     partition of telemetry.peer_samples     default;
create table telemetry.track_samples_1m_default partition of telemetry.track_samples_1m default;
```

Les clés étrangères de `track_samples` vers `tracks` ne sont **pas** déclarées, conformément à la spec §6.2 : à 100 insertions par seconde la vérification référentielle est un coût récurrent pour une garantie qu'un écrivain unique rend inutile.

- [ ] **Step 2: Écrire le test d'intégration qui échoue**

Créer `apps/sfu/tests/telemetry_pg.rs` :

```rust
//! Postgres integration. Skipped unless `SFU_TEST_DATABASE_URL` is set.
//!
//! Not `#[ignore]`: gating on the variable keeps a single `cargo test`
//! command working both with and without a database, which is what the
//! optional-persistence promise requires.

use sfu::config::TelemetryConfig;
use sfu::telemetry::{Batch, Entry, PgWriter};
use chrono::Utc;
use uuid::Uuid;

/// Builds a writer against the test database, or `None` when it is absent.
async fn writer() -> Option<PgWriter> {
    let url = match std::env::var("SFU_TEST_DATABASE_URL") {
        Ok(u) if !u.is_empty() => u,
        _ => {
            eprintln!(
                "⏭️  SFU_TEST_DATABASE_URL absente — tests Postgres ignorés.\n\
                 　  Pour les lancer : SFU_TEST_DATABASE_URL=postgres://… cargo test"
            );
            return None;
        }
    };
    let cfg = TelemetryConfig {
        database_url: Some(url),
        // Un nom unique par exécution : les tests ne doivent pas se marcher
        // dessus sur `instance.name`, qui est unique.
        instance_name: format!("test-{}", Uuid::new_v4()),
        ..TelemetryConfig::default()
    };
    Some(PgWriter::connect(&cfg, "0.1.0-test").await.expect("connexion"))
}

#[tokio::test]
async fn migrations_apply_and_the_instance_row_exists() {
    let Some(w) = writer().await else { return };

    let (count,): (i64,) =
        sqlx::query_as("select count(*) from telemetry.instance where id = $1")
            .bind(w.instance_id())
            .fetch_one(w.pool())
            .await
            .expect("requête");

    assert_eq!(count, 1, "la connexion doit enregistrer son instance");
}

#[tokio::test]
async fn a_batch_lands_in_the_right_tables() {
    let Some(w) = writer().await else { return };

    let room = Uuid::new_v4();
    let peer = Uuid::new_v4();
    let now = Utc::now();

    let batch = Batch::from_entries(vec![
        Entry::RoomOpened { id: room, name: "test-room".into(), at: now },
        Entry::PeerJoined { id: peer, room_id: room, at: now },
    ]);
    w.write(&batch).await.expect("écriture");

    let (name,): (String,) = sqlx::query_as("select name from telemetry.rooms where id = $1")
        .bind(room)
        .fetch_one(w.pool())
        .await
        .expect("requête");
    assert_eq!(name, "test-room");

    let (room_of_peer,): (Uuid,) =
        sqlx::query_as("select room_id from telemetry.peers where id = $1")
            .bind(peer)
            .fetch_one(w.pool())
            .await
            .expect("requête");
    assert_eq!(room_of_peer, room);
}

#[tokio::test]
async fn closing_a_room_sets_its_end_and_reason() {
    let Some(w) = writer().await else { return };

    let room = Uuid::new_v4();
    let now = Utc::now();
    w.write(&Batch::from_entries(vec![Entry::RoomOpened {
        id: room,
        name: "fermeture".into(),
        at: now,
    }]))
    .await
    .expect("ouverture");

    w.write(&Batch::from_entries(vec![Entry::RoomClosed {
        id: room,
        at: now,
        reason: "empty",
    }]))
    .await
    .expect("fermeture");

    let (reason,): (Option<String>,) =
        sqlx::query_as("select ended_reason from telemetry.rooms where id = $1")
            .bind(room)
            .fetch_one(w.pool())
            .await
            .expect("requête");
    assert_eq!(reason.as_deref(), Some("empty"));
}

#[tokio::test]
async fn restarting_closes_the_sessions_the_previous_run_left_open() {
    let Some(w) = writer().await else { return };

    let room = Uuid::new_v4();
    let peer = Uuid::new_v4();
    let now = Utc::now();
    w.write(&Batch::from_entries(vec![
        Entry::RoomOpened { id: room, name: "orpheline".into(), at: now },
        Entry::PeerJoined { id: peer, room_id: room, at: now },
    ]))
    .await
    .expect("écriture");

    let closed = w.recover_open_sessions().await.expect("reprise");
    assert!(closed >= 2, "la room et le peer restés ouverts doivent être fermés");

    let (reason,): (Option<String>,) =
        sqlx::query_as("select ended_reason from telemetry.rooms where id = $1")
            .bind(room)
            .fetch_one(w.pool())
            .await
            .expect("requête");
    assert_eq!(reason.as_deref(), Some("instance_restart"));

    let (left,): (Option<chrono::DateTime<Utc>>,) =
        sqlx::query_as("select left_at from telemetry.peers where id = $1")
            .bind(peer)
            .fetch_one(w.pool())
            .await
            .expect("requête");
    assert!(left.is_some(), "un peer resté ouvert doit être fermé aussi");
}
```

- [ ] **Step 3: Lancer le test pour vérifier qu'il échoue**

```bash
docker run --rm -d --name sightline-pg -e POSTGRES_PASSWORD=sightline -p 5433:5432 postgres:17
export SFU_TEST_DATABASE_URL=postgres://postgres:sightline@localhost:5433/postgres
rtk cargo test -p sfu --test telemetry_pg
```
Expected: FAIL — `unresolved import sfu::telemetry::PgWriter`

- [ ] **Step 4: Implémenter `pg.rs`**

```rust
//! Postgres side of telemetry: pool, migrations, batch writes.
//!
//! Migrations are embedded in the binary and applied at startup. That is the
//! right self-hosted behaviour: the binary carries its schema, there is no
//! separate step to remember.

use super::batch::Batch;
use crate::config::TelemetryConfig;
use chrono::Utc;
use sqlx::postgres::{PgPool, PgPoolOptions};
use uuid::Uuid;

/// Embedded at compile time from `apps/sfu/migrations/`.
static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

pub struct PgWriter {
    pool: PgPool,
    instance_id: Uuid,
}

impl PgWriter {
    /// Opens the pool, applies the migrations, and registers this instance.
    ///
    /// The instance row is upserted on `name`, so restarting keeps the same
    /// `instance_id` and the history stays attached to it.
    pub async fn connect(cfg: &TelemetryConfig, version: &str) -> Result<Self, sqlx::Error> {
        let url = cfg
            .database_url
            .as_deref()
            .expect("connect n'est appelé que si database_url est présente");

        // Petit pool : un seul écrivain, plus deux connexions pour la
        // maintenance et le rollup. Rien ne justifie davantage.
        let pool = PgPoolOptions::new().max_connections(4).connect(url).await?;

        MIGRATOR.run(&pool).await?;

        let instance_id: Uuid = sqlx::query_scalar(
            "insert into telemetry.instance (id, name, region, version, started_at)
             values ($1, $2, $3, $4, $5)
             on conflict (name) do update
               set region = excluded.region,
                   version = excluded.version,
                   started_at = excluded.started_at
             returning id",
        )
        .bind(Uuid::new_v4())
        .bind(&cfg.instance_name)
        .bind(&cfg.region)
        .bind(version)
        .bind(Utc::now())
        .fetch_one(&pool)
        .await?;

        Ok(PgWriter { pool, instance_id })
    }

    pub fn instance_id(&self) -> Uuid {
        self.instance_id
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    /// Closes what a previous run left open.
    ///
    /// Without this, an abrupt stop leaves rooms and peers forever "active",
    /// and every screen lies. Returns how many rows were closed.
    pub async fn recover_open_sessions(&self) -> Result<u64, sqlx::Error> {
        let now = Utc::now();
        let mut tx = self.pool.begin().await?;
        let mut closed = 0u64;

        closed += sqlx::query(
            "update telemetry.tracks set ended_at = $2
             where instance_id = $1 and ended_at is null",
        )
        .bind(self.instance_id)
        .bind(now)
        .execute(&mut *tx)
        .await?
        .rows_affected();

        closed += sqlx::query(
            "update telemetry.peers set left_at = $2
             where instance_id = $1 and left_at is null",
        )
        .bind(self.instance_id)
        .bind(now)
        .execute(&mut *tx)
        .await?
        .rows_affected();

        closed += sqlx::query(
            "update telemetry.rooms set ended_at = $2, ended_reason = 'instance_restart'
             where instance_id = $1 and ended_at is null",
        )
        .bind(self.instance_id)
        .bind(now)
        .execute(&mut *tx)
        .await?
        .rows_affected();

        tx.commit().await?;
        Ok(closed)
    }

    /// Writes a whole batch in one transaction.
    ///
    /// Order matters: rooms before peers before tracks, because the foreign
    /// keys on the lifecycle tables are real. Samples carry no foreign key and
    /// go last.
    pub async fn write(&self, batch: &Batch) -> Result<(), sqlx::Error> {
        if batch.is_empty() {
            return Ok(());
        }
        let mut tx = self.pool.begin().await?;
        let iid = self.instance_id;

        for (id, name, at) in &batch.rooms_opened {
            sqlx::query(
                "insert into telemetry.rooms (id, instance_id, name, started_at)
                 values ($1, $2, $3, $4) on conflict (id) do nothing",
            )
            .bind(id).bind(iid).bind(name).bind(at)
            .execute(&mut *tx).await?;
        }

        for (id, at, reason) in &batch.rooms_closed {
            sqlx::query(
                "update telemetry.rooms set ended_at = $2, ended_reason = $3 where id = $1",
            )
            .bind(id).bind(at).bind(*reason)
            .execute(&mut *tx).await?;
        }

        for (id, room_id, at) in &batch.peers_joined {
            sqlx::query(
                "insert into telemetry.peers (id, instance_id, room_id, joined_at)
                 values ($1, $2, $3, $4) on conflict (id) do nothing",
            )
            .bind(id).bind(iid).bind(room_id).bind(at)
            .execute(&mut *tx).await?;
        }

        for (id, at, close_code) in &batch.peers_left {
            sqlx::query("update telemetry.peers set left_at = $2, close_code = $3 where id = $1")
                .bind(id).bind(at).bind(close_code)
                .execute(&mut *tx).await?;
        }

        for (peer_id, state, _at) in &batch.ice_states {
            sqlx::query("update telemetry.peers set ice_state = $2 where id = $1")
                .bind(peer_id).bind(state)
                .execute(&mut *tx).await?;
        }

        for (id, peer_id, mid, kind, at) in &batch.tracks_published {
            sqlx::query(
                "insert into telemetry.tracks (id, instance_id, peer_id, mid, kind, published_at)
                 values ($1, $2, $3, $4, $5::telemetry.track_kind, $6)
                 on conflict (peer_id, mid) do nothing",
            )
            .bind(id).bind(iid).bind(peer_id).bind(mid).bind(kind.as_str()).bind(at)
            .execute(&mut *tx).await?;
        }

        for (id, codec, clock_rate) in &batch.track_codecs {
            sqlx::query("update telemetry.tracks set codec = $2, clock_rate = $3 where id = $1")
                .bind(id).bind(codec).bind(clock_rate)
                .execute(&mut *tx).await?;
        }

        for (id, at) in &batch.tracks_ended {
            sqlx::query("update telemetry.tracks set ended_at = $2 where id = $1")
                .bind(id).bind(at)
                .execute(&mut *tx).await?;
        }

        for s in &batch.track_samples {
            sqlx::query(
                "insert into telemetry.track_samples
                   (instance_id, track_id, at, bytes, packets, nacks, plis, firs,
                    jitter_ms, loss, rtt_ms)
                 values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                 on conflict (track_id, at) do nothing",
            )
            .bind(iid).bind(s.track_id).bind(s.at)
            .bind(s.bytes).bind(s.packets)
            .bind(s.nacks).bind(s.plis).bind(s.firs)
            .bind(s.jitter_ms).bind(s.loss).bind(s.rtt_ms)
            .execute(&mut *tx).await?;
        }

        for s in &batch.peer_samples {
            sqlx::query(
                "insert into telemetry.peer_samples
                   (instance_id, peer_id, at, bytes_rx, bytes_tx,
                    transport_bytes_rx, transport_bytes_tx, egress_loss, bwe_bps)
                 values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                 on conflict (peer_id, at) do nothing",
            )
            .bind(iid).bind(s.peer_id).bind(s.at)
            .bind(s.bytes_rx).bind(s.bytes_tx)
            .bind(s.transport_bytes_rx).bind(s.transport_bytes_tx)
            .bind(s.egress_loss).bind(s.bwe_bps)
            .execute(&mut *tx).await?;
        }

        for e in &batch.events {
            sqlx::query(
                "insert into telemetry.events
                   (instance_id, at, kind, severity, room_id, peer_id, track_id, payload)
                 values ($1,$2,$3::telemetry.event_kind,$4::telemetry.severity,$5,$6,$7,$8)",
            )
            .bind(iid).bind(e.at).bind(e.kind.as_str()).bind(e.severity.as_str())
            .bind(e.room_id).bind(e.peer_id).bind(e.track_id).bind(&e.payload)
            .execute(&mut *tx).await?;
        }

        tx.commit().await
    }
}
```

**Sur le choix de `INSERT` plutôt que `COPY`** : à 100 lignes par seconde dans une transaction unique, `INSERT` tient largement, et il donne `on conflict do nothing` — indispensable, puisqu'un lot rejoué après une erreur réseau ne doit pas violer la clé primaire. `COPY` n'accepte pas `on conflict`. La spec parlait de `COPY` ; c'est un raffinement à mesurer si le profil le réclame, pas une exigence.

Ajouter dans `telemetry/mod.rs` : `pub mod pg;` et `pub use pg::PgWriter;`, sous `#[cfg(feature = ...)]`— non : sans feature, simplement `pub mod pg;`.

- [ ] **Step 5: Lancer les tests, avec puis sans base**

```bash
SFU_TEST_DATABASE_URL=postgres://postgres:sightline@localhost:5433/postgres \
  rtk cargo test -p sfu --test telemetry_pg
rtk cargo test -p sfu    # sans la variable : tout doit passer, les tests PG s'annoncent ignorés
rtk cargo clippy --all-targets
```
Expected: PASS dans les deux cas, aucun warning.

- [ ] **Step 6: Commit**

```bash
rtk git add apps/sfu/migrations apps/sfu/src/telemetry apps/sfu/tests/telemetry_pg.rs
rtk git commit -m "feat(sfu): schema telemetry, migrations embarquees et ecriture par lots"
```

---

## Task 5 : la file bornée et la tâche d'écriture

**Files:**
- Create: `apps/sfu/src/telemetry/tasks.rs`
- Modify: `apps/sfu/src/telemetry/sink.rs`, `apps/sfu/src/metrics/mod.rs`, `apps/sfu/src/telemetry/mod.rs`

**Interfaces:**
- Consumes: `Batch` (Task 3), `PgWriter` (Task 4), `Metrics`
- Produces:
```rust
pub struct QueueSink { tx: mpsc::Sender<Entry>, metrics: Arc<Metrics> }
impl QueueSink { pub fn new(depth: usize, metrics: Arc<Metrics>) -> (Arc<Self>, mpsc::Receiver<Entry>) }
impl Metrics { pub fn record_telemetry_drop(&self) }
pub fn spawn_writer(writer: Arc<PgWriter>, rx: mpsc::Receiver<Entry>, interval: Duration)
```

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `src/telemetry/sink.rs`, ajouter au `mod tests` :

```rust
#[test]
fn a_full_queue_drops_and_counts_instead_of_blocking() {
    let metrics = crate::metrics::Metrics::new();
    let (sink, _rx) = QueueSink::new(2, metrics.clone());

    // La file accepte deux entrées, puis jette. Aucun de ces appels ne doit
    // bloquer : ils viennent parfois du milieu d'un verrou.
    sink.record(a_track());
    sink.record(a_track());
    sink.record(a_track());
    sink.record(a_track());

    assert_eq!(metrics.snapshot().telemetry_entries_dropped, 2);
}

#[test]
fn nothing_is_dropped_while_the_queue_has_room() {
    let metrics = crate::metrics::Metrics::new();
    let (sink, _rx) = QueueSink::new(8, metrics.clone());
    sink.record(a_track());
    assert_eq!(metrics.snapshot().telemetry_entries_dropped, 0);
}
```

Dans `src/metrics/mod.rs`, ajouter au `mod tests` :

```rust
#[test]
fn telemetry_drops_are_counted_separately() {
    let m = Metrics::new();
    m.record_telemetry_drop();
    m.record_telemetry_drop();
    let snap = m.snapshot();
    assert_eq!(snap.telemetry_entries_dropped, 2);
    // Les compteurs média ne doivent pas bouger : /metrics doit rester lisible.
    assert_eq!(snap.rtp_packets_forwarded, 0);
}
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `rtk cargo test -p sfu --lib`
Expected: FAIL — `no method record_telemetry_drop`, `cannot find QueueSink`

- [ ] **Step 3: Étendre `Metrics`**

Dans `src/metrics/mod.rs`, ajouter le champ `pub telemetry_entries_dropped: AtomicU64` à `Metrics`, la méthode :

```rust
/// An entry telemetry could not enqueue.
///
/// Deliberate: a database must never be able to degrade a live call. Same
/// doctrine as the media queues.
pub fn record_telemetry_drop(&self) {
    self.telemetry_entries_dropped.fetch_add(1, Ordering::Relaxed);
}
```

et le champ correspondant dans `MetricsSnapshot` et dans `snapshot()`.

- [ ] **Step 4: Écrire `QueueSink`**

Dans `src/telemetry/sink.rs`, ajouter `use crate::metrics::Metrics;`, `use std::sync::Arc;`, `use tokio::sync::mpsc;` puis :

```rust
/// Enqueues towards the writer task, dropping when the queue is full.
///
/// `try_send`, never `send().await`: producers call this from synchronous
/// code and sometimes while holding a lock. Full means the entry is dropped,
/// deliberately — the same trade-off the media queues already make, for a
/// stronger reason: a database must never be able to degrade a live call.
pub struct QueueSink {
    tx: mpsc::Sender<Entry>,
    metrics: Arc<Metrics>,
}

impl QueueSink {
    /// Returns the sink and the receiving end the writer task consumes.
    pub fn new(depth: usize, metrics: Arc<Metrics>) -> (Arc<Self>, mpsc::Receiver<Entry>) {
        let (tx, rx) = mpsc::channel(depth);
        (Arc::new(QueueSink { tx, metrics }), rx)
    }
}

impl TelemetrySink for QueueSink {
    fn record(&self, entry: Entry) {
        if self.tx.try_send(entry).is_err() {
            // Une seule métrique, pas de log par entrée : sous rafale, logger
            // chaque perte coûterait plus cher que l'écriture qu'on évite.
            // La tâche d'écriture log une fois par rafale.
            self.metrics.record_telemetry_drop();
        }
    }
}
```

- [ ] **Step 5: Écrire la tâche d'écriture**

`src/telemetry/tasks.rs` :

```rust
//! The background tasks. None of them ever runs on the media hot path.

use super::batch::Batch;
use super::entry::Entry;
use super::pg::PgWriter;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc::Receiver;

/// Drains the queue and writes one batch per interval.
///
/// A write failure loses the batch and is logged once per burst: retrying
/// would grow the queue, and a queue that grows is the failure mode this whole
/// design exists to avoid.
pub fn spawn_writer(writer: Arc<PgWriter>, mut rx: Receiver<Entry>, interval: Duration) {
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(interval);
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        let mut pending: Vec<Entry> = Vec::new();
        let mut failing = false;

        loop {
            tokio::select! {
                received = rx.recv() => match received {
                    Some(entry) => pending.push(entry),
                    // Toutes les sources sont tombées : on écrit ce qui reste
                    // puis on sort. C'est le chemin de l'arrêt propre.
                    None => {
                        flush(&writer, &mut pending, &mut failing).await;
                        break;
                    }
                },
                _ = ticker.tick() => {
                    flush(&writer, &mut pending, &mut failing).await;
                }
            }
        }
        tracing::debug!("Télémétrie — task d'écriture terminée");
    });
}

async fn flush(writer: &PgWriter, pending: &mut Vec<Entry>, failing: &mut bool) {
    if pending.is_empty() {
        return;
    }
    let batch = Batch::from_entries(std::mem::take(pending));
    let size = batch.len();

    match writer.write(&batch).await {
        Ok(()) => {
            if *failing {
                *failing = false;
                tracing::info!("Télémétrie — écriture rétablie");
            }
        }
        Err(e) => {
            if !*failing {
                *failing = true;
                tracing::warn!("Télémétrie — écriture impossible, lot de {size} jeté : {e}");
            }
        }
    }
}
```

Ajouter `pub mod tasks;` dans `telemetry/mod.rs`, et `pub use sink::QueueSink;`.

- [ ] **Step 6: Lancer les tests**

Run: `rtk cargo test -p sfu && rtk cargo clippy --all-targets`
Expected: PASS, aucun warning.

- [ ] **Step 7: Commit**

```bash
rtk git add apps/sfu/src/telemetry apps/sfu/src/metrics/mod.rs
rtk git commit -m "feat(sfu): file bornee de telemetrie et task d'ecriture par lots"
```

---

## Task 6 : brancher le cycle de vie

C'est la tâche qui touche le plus de fichiers existants. Elle ne fait rien d'autre qu'émettre des `Entry` aux endroits où le SFU sait déjà ce qui se passe.

**Files:**
- Modify: `apps/sfu/src/room/manager.rs`, `apps/sfu/src/signaling/dispatch.rs`, `apps/sfu/src/signaling/session.rs`, `apps/sfu/src/app.rs`, `apps/sfu/src/telemetry/mod.rs`

**Interfaces:**
- Consumes: `TelemetrySink`, `Entry` (Task 2)
- Produces:
```rust
pub struct Room { pub id: String, pub session_id: Uuid, /* … */ }
pub struct JoinOutcome { pub occupants: Vec<String>, pub room_session: Uuid, pub room_created: bool }
pub struct LeaveOutcome { pub room_session: Uuid, pub room_dropped: bool }
impl RoomManager {
    pub fn join_room(&self, room_id: &str, peer: RoomPeer) -> JoinOutcome;
    pub fn leave_room(&self, peer_id: &str) -> Option<LeaveOutcome>;
}
pub struct Telemetry { /* sink + registre des tracks */ }
impl Telemetry {
    pub fn new(sink: Arc<dyn TelemetrySink>) -> Arc<Self>;
    pub fn record(&self, entry: Entry);
    pub fn track_id(&self, peer: Uuid, mid: &str) -> Uuid;   // crée à la demande, idempotent
    pub fn forget_peer(&self, peer: Uuid) -> Vec<Uuid>;      // les tracks à clore
}
impl AppState { pub telemetry: Arc<Telemetry> }
```

- [ ] **Step 1: Écrire les tests qui échouent**

Dans le `mod tests` de `src/room/manager.rs` :

```rust
#[test]
fn the_first_peer_creates_the_room_and_says_so() {
    let manager = RoomManager::new();
    let (peer, _rx) = a_peer("alice");
    let outcome = manager.join_room("salon", peer);
    assert!(outcome.room_created);
    assert!(outcome.occupants.is_empty());
}

#[test]
fn the_second_peer_does_not_create_the_room() {
    let manager = RoomManager::new();
    let (alice, _a) = a_peer("alice");
    let first = manager.join_room("salon", alice);
    let (bob, _b) = a_peer("bob");
    let second = manager.join_room("salon", bob);

    assert!(!second.room_created);
    // La session de room est la même tant que la room vit : c'est elle qui
    // porte l'identité en base.
    assert_eq!(second.room_session, first.room_session);
    assert_eq!(second.occupants, vec!["alice".to_string()]);
}

#[test]
fn the_last_departure_reports_the_room_as_dropped() {
    let manager = RoomManager::new();
    let (alice, _a) = a_peer("alice");
    let joined = manager.join_room("salon", alice);

    let left = manager.leave_room("alice").expect("alice était dans une room");
    assert!(left.room_dropped);
    assert_eq!(left.room_session, joined.room_session);
}

#[test]
fn a_departure_that_leaves_occupants_does_not_drop_the_room() {
    let manager = RoomManager::new();
    let (alice, _a) = a_peer("alice");
    manager.join_room("salon", alice);
    let (bob, _b) = a_peer("bob");
    manager.join_room("salon", bob);

    let left = manager.leave_room("alice").expect("alice était dans une room");
    assert!(!left.room_dropped);
}

#[test]
fn a_room_reused_after_emptying_gets_a_new_session() {
    // Décision 4.5 : une ligne de `rooms` est une période d'occupation. Deux
    // réunions successives du même nom ne doivent jamais fusionner.
    let manager = RoomManager::new();
    let (alice, _a) = a_peer("alice");
    let first = manager.join_room("salon", alice);
    manager.leave_room("alice");

    let (bob, _b) = a_peer("bob");
    let second = manager.join_room("salon", bob);
    assert_ne!(first.room_session, second.room_session);
}

#[test]
fn leaving_without_a_room_reports_nothing() {
    let manager = RoomManager::new();
    assert!(manager.leave_room("fantome").is_none());
}
```

`a_peer` est un helper à ajouter au `mod tests` s'il n'existe pas déjà sous ce nom — vérifier les helpers présents et réutiliser celui qui construit un `RoomPeer` avec son `Receiver`.

Dans `src/telemetry/mod.rs`, un `mod tests` :

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use uuid::Uuid;

    #[test]
    fn the_same_mid_of_a_peer_keeps_its_track_id() {
        let t = Telemetry::new(Arc::new(NoopSink));
        let peer = Uuid::new_v4();
        assert_eq!(t.track_id(peer, "0"), t.track_id(peer, "0"));
    }

    #[test]
    fn two_mids_of_a_peer_are_two_tracks() {
        let t = Telemetry::new(Arc::new(NoopSink));
        let peer = Uuid::new_v4();
        assert_ne!(t.track_id(peer, "0"), t.track_id(peer, "1"));
    }

    #[test]
    fn the_same_mid_of_two_peers_are_two_tracks() {
        let t = Telemetry::new(Arc::new(NoopSink));
        assert_ne!(t.track_id(Uuid::new_v4(), "0"), t.track_id(Uuid::new_v4(), "0"));
    }

    #[test]
    fn forgetting_a_peer_returns_its_tracks_and_frees_them() {
        let t = Telemetry::new(Arc::new(NoopSink));
        let peer = Uuid::new_v4();
        let audio = t.track_id(peer, "0");
        let video = t.track_id(peer, "1");

        let mut forgotten = t.forget_peer(peer);
        forgotten.sort();
        let mut expected = vec![audio, video];
        expected.sort();
        assert_eq!(forgotten, expected);

        // Le registre est vidé : un peer reconnecté sous le même uuid — ce qui
        // n'arrive pas, mais le registre ne doit pas fuir — repart à neuf.
        assert!(t.forget_peer(peer).is_empty());
        assert_ne!(t.track_id(peer, "0"), audio);
    }
}
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `rtk cargo test -p sfu --lib`
Expected: FAIL — `join_room` renvoie `Vec<String>`, `Telemetry` n'existe pas.

- [ ] **Step 3: Écrire `Telemetry`**

Dans `src/telemetry/mod.rs`, sous les `pub use` :

```rust
use dashmap::DashMap;
use std::sync::Arc;
use uuid::Uuid;

/// The façade the rest of the SFU talks to.
///
/// It owns the `(peer, mid) → track_id` registry, because samples arrive keyed
/// by mid while the database is keyed by a track uuid. The registry mirrors the
/// lifetime of the connection: entries are born when a track is published and
/// released when the peer leaves.
pub struct Telemetry {
    sink: Arc<dyn TelemetrySink>,
    tracks: DashMap<(Uuid, String), Uuid>,
}

impl Telemetry {
    pub fn new(sink: Arc<dyn TelemetrySink>) -> Arc<Self> {
        Arc::new(Telemetry {
            sink,
            tracks: DashMap::new(),
        })
    }

    pub fn record(&self, entry: Entry) {
        self.sink.record(entry);
    }

    /// The track uuid for `(peer, mid)`, minted on first use.
    pub fn track_id(&self, peer: Uuid, mid: &str) -> Uuid {
        *self
            .tracks
            .entry((peer, mid.to_string()))
            .or_insert_with(Uuid::new_v4)
    }

    /// Releases a peer's tracks and returns them, so the caller can close them.
    pub fn forget_peer(&self, peer: Uuid) -> Vec<Uuid> {
        let keys: Vec<(Uuid, String)> = self
            .tracks
            .iter()
            .filter(|e| e.key().0 == peer)
            .map(|e| e.key().clone())
            .collect();
        // On collecte les clés avant de retirer : itérer une DashMap en la
        // modifiant garde le verrou du shard, exactement le blocage documenté
        // dans CONTEXT.md pour le négociateur.
        keys.into_iter()
            .filter_map(|k| self.tracks.remove(&k).map(|(_, id)| id))
            .collect()
    }
}

/// Parses a peer_id into the uuid the schema uses.
///
/// Peer ids are minted by `http/ws.rs` with `Uuid::new_v4`, so this never
/// fails in practice; returning `Option` keeps telemetry from being able to
/// panic a session.
pub fn peer_uuid(peer_id: &str) -> Option<Uuid> {
    Uuid::parse_str(peer_id).ok()
}
```

- [ ] **Step 4: Faire parler `RoomManager`**

Dans `src/room/manager.rs` : ajouter `use uuid::Uuid;`, le champ `pub session_id: Uuid` à `Room` (initialisé par `Uuid::new_v4()` dans `Room::new`), et :

```rust
/// What a join tells the caller, so it can record the lifecycle.
pub struct JoinOutcome {
    pub occupants: Vec<String>,
    /// Identity of the room's current occupancy period.
    pub room_session: Uuid,
    pub room_created: bool,
}

/// What a departure tells the caller.
pub struct LeaveOutcome {
    pub room_session: Uuid,
    pub room_dropped: bool,
}
```

`join_room` devient :

```rust
pub fn join_room(&self, room_id: &str, peer: RoomPeer) -> JoinOutcome {
    let peer_id = peer.peer_id.clone();

    let previous = self.peer_room_index.get(&peer_id).map(|r| r.clone());
    if previous.is_some_and(|previous| previous != room_id) {
        self.leave_room(&peer_id);
    }

    let mut created = false;
    let room = self
        .rooms
        .entry(room_id.to_string())
        .or_insert_with(|| {
            created = true;
            Arc::new(Room::new(room_id.to_string()))
        })
        .clone();

    self.peer_room_index.insert(peer_id, room_id.to_string());

    JoinOutcome {
        occupants: room.add_peer(peer),
        room_session: room.session_id,
        room_created: created,
    }
}
```

`leave_room` devient :

```rust
pub fn leave_room(&self, peer_id: &str) -> Option<LeaveOutcome> {
    let (_, room_id) = self.peer_room_index.remove(peer_id)?;
    let room = self.rooms.get(&room_id)?.clone();

    room.remove_peer(peer_id);

    let dropped = room.is_empty();
    if dropped {
        self.rooms.remove(&room_id);
        tracing::info!("Room {} supprimée", room_id);
    }

    Some(LeaveOutcome {
        room_session: room.session_id,
        room_dropped: dropped,
    })
}
```

Attention : le `drop(room)` de la version actuelle disparaît parce qu'on clone l'`Arc<Room>` au lieu de tenir la `Ref` de la DashMap pendant le `remove`. C'est **nécessaire** : tenir la `Ref` pendant `self.rooms.remove` garde le verrou du shard qu'on modifie — la même famille de blocage que celle documentée dans `CONTEXT.md`.

Adapter tous les appelants et tous les tests existants de `manager.rs` qui attendaient `Vec<String>` ou `()`.

- [ ] **Step 5: Émettre depuis `dispatch` et `session`**

Dans `dispatch.rs`, là où `Join` est traité, après `state.rooms.join_room(...)` :

```rust
// Le cycle de vie n'est enregistré que si le peer_id est un uuid — il l'est
// toujours, `http/ws.rs` le génère. La télémétrie ne peut pas casser une session.
if let Some(peer_uuid) = crate::telemetry::peer_uuid(peer_id) {
    let now = chrono::Utc::now();
    if outcome.room_created {
        state.telemetry.record(Entry::RoomOpened {
            id: outcome.room_session,
            name: room_id.to_string(),
            at: now,
        });
        state.telemetry.record(Entry::Event(
            EventRecord::new(EventKind::RoomCreated, now).room(outcome.room_session),
        ));
    }
    state.telemetry.record(Entry::PeerJoined {
        id: peer_uuid,
        room_id: outcome.room_session,
        at: now,
    });
    state.telemetry.record(Entry::Event(
        EventRecord::new(EventKind::PeerJoined, now)
            .room(outcome.room_session)
            .peer(peer_uuid),
    ));
}
```

Dans `session.rs`, dans le teardown, **avant** `state.rooms.leave_room(&peer_id)` est appelé — remplacer par :

```rust
let departure = state.rooms.leave_room(&peer_id);

if let Some(peer_uuid) = crate::telemetry::peer_uuid(&peer_id) {
    let now = chrono::Utc::now();
    for track in state.telemetry.forget_peer(peer_uuid) {
        state.telemetry.record(Entry::TrackEnded { id: track, at: now });
    }
    state.telemetry.record(Entry::PeerLeft {
        id: peer_uuid,
        at: now,
        // Axum ne remonte pas le code de fermeture jusqu'ici : la boucle
        // `while let Some(Ok(msg))` avale `Message::Close(frame)`. Le récupérer
        // demanderait de restructurer la boucle ; c'est hors périmètre et la
        // colonne reste nullable pour cette raison.
        close_code: None,
    });
    if let Some(d) = &departure {
        state.telemetry.record(Entry::Event(
            EventRecord::new(EventKind::PeerLeft, now).room(d.room_session).peer(peer_uuid),
        ));
        if d.room_dropped {
            state.telemetry.record(Entry::RoomClosed {
                id: d.room_session,
                at: now,
                reason: "empty",
            });
            state.telemetry.record(Entry::Event(
                EventRecord::new(EventKind::RoomEnded, now).room(d.room_session),
            ));
        }
    }
}
```

Dans `spawn_transport_pump`, la branche `TrackAdded` émet aussi :

```rust
TransportEvent::TrackAdded { peer, mid, kind } => {
    if let Some(peer_uuid) = crate::telemetry::peer_uuid(&peer) {
        let mid_str = mid.to_string();
        let track_id = telemetry.track_id(peer_uuid, &mid_str);
        let now = chrono::Utc::now();
        telemetry.record(Entry::TrackPublished {
            id: track_id,
            peer_id: peer_uuid,
            mid: mid_str,
            kind: match kind {
                MediaKind::Audio => TrackKind::Audio,
                MediaKind::Video => TrackKind::Video,
            },
            at: now,
        });
        telemetry.record(Entry::Event(
            EventRecord::new(EventKind::TrackPublished, now).peer(peer_uuid).track(track_id),
        ));
    }
    negotiator.notify(NegotiationEvent::TrackPublished { peer, mid, kind });
}
```

`spawn_transport_pump` prend donc un paramètre `telemetry: Arc<Telemetry>` de plus.

- [ ] **Step 6: Câbler `AppState`**

Dans `src/app.rs`, ajouter `pub telemetry: Arc<Telemetry>` et, dans `AppState::new` :

```rust
// Sans URL, un NoopSink : il n'y a jamais de branche `Option` dans le reste
// du code, seulement un puits qui avale.
let telemetry = Telemetry::new(Arc::new(NoopSink));
```

Le branchement de `QueueSink` et des tâches se fera à la Task 8, quand `main` saura ouvrir la base — `AppState::new` est synchrone et ne peut pas `await`.

- [ ] **Step 7: Lancer les tests**

Run: `rtk cargo test -p sfu && rtk cargo clippy --all-targets`
Expected: PASS — 98 tests existants plus les nouveaux. Toute régression sur `tests/room.rs` signale une erreur dans la réécriture de `leave_room`.

- [ ] **Step 8: Commit**

```bash
rtk git add apps/sfu/src
rtk git commit -m "feat(sfu): enregistrement du cycle de vie rooms, peers et tracks"
```

---

## Task 7 : les statistiques str0m et les deltas

**Files:**
- Create: `apps/sfu/src/telemetry/sampler.rs`
- Modify: `apps/sfu/src/transport/peer_connection.rs`, `apps/sfu/src/transport/event_loop.rs`, `apps/sfu/src/signaling/session.rs`

**Interfaces:**
- Consumes: `TrackSample`, `PeerSample` (Task 2), `Telemetry` (Task 6)
- Produces:
```rust
pub fn jitter_to_ms(jitter_rtp_units: u32, clock_rate: u32) -> Option<f32>;
pub struct Sampler { /* derniers cumuls par mid et par peer */ }
impl Sampler {
    pub fn new() -> Self;
    pub fn ingress(&mut self, mid: &str, s: &IngressReading) -> Option<Deltas>;
    pub fn peer(&mut self, s: &PeerReading) -> Option<PeerDeltas>;
}
pub enum TransportEvent { /* … */ TrackStats{..}, PeerStats{..} }
```

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `src/telemetry/sampler.rs` :

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn jitter_converts_from_rtp_units_to_milliseconds() {
        // 48 kHz : 480 unités = 10 ms. C'est la conversion audio.
        assert_eq!(jitter_to_ms(480, 48_000), Some(10.0));
        // 90 kHz : 900 unités = 10 ms. C'est la conversion vidéo.
        assert_eq!(jitter_to_ms(900, 90_000), Some(10.0));
    }

    #[test]
    fn a_zero_clock_rate_yields_nothing_rather_than_infinity() {
        // Un clock rate inconnu vaut 0 ; diviser produirait +inf, que Postgres
        // accepterait en `real` et qui polluerait tous les graphes.
        assert_eq!(jitter_to_ms(480, 0), None);
    }

    #[test]
    fn the_first_reading_produces_no_delta() {
        // Un cumul seul ne dit rien : il faut deux relevés pour une différence.
        // Sans cette règle, le premier échantillon vaudrait le total depuis le
        // début de la connexion et écraserait l'échelle de tous les graphes.
        let mut s = Sampler::new();
        assert!(s.ingress("0", &reading(1000, 10, 1, 2, 3)).is_none());
    }

    #[test]
    fn the_second_reading_is_the_difference() {
        let mut s = Sampler::new();
        s.ingress("0", &reading(1000, 10, 1, 2, 3));
        let d = s.ingress("0", &reading(1500, 15, 2, 2, 4)).expect("un delta");
        assert_eq!(d.bytes, 500);
        assert_eq!(d.packets, 5);
        assert_eq!(d.nacks, 1);
        assert_eq!(d.plis, 0);
        assert_eq!(d.firs, 1);
    }

    #[test]
    fn a_counter_going_backwards_yields_zero_rather_than_a_negative() {
        // str0m ne fait pas repartir ses compteurs en arrière, mais une
        // renégociation qui remplace un flux le pourrait. Un octet négatif
        // rendrait toute somme fausse ; zéro est faux d'un échantillon.
        let mut s = Sampler::new();
        s.ingress("0", &reading(1000, 10, 0, 0, 0));
        let d = s.ingress("0", &reading(500, 5, 0, 0, 0)).expect("un delta");
        assert_eq!(d.bytes, 0);
        assert_eq!(d.packets, 0);
    }

    #[test]
    fn two_mids_are_sampled_independently() {
        let mut s = Sampler::new();
        s.ingress("0", &reading(1000, 10, 0, 0, 0));
        s.ingress("1", &reading(5000, 50, 0, 0, 0));
        let d = s.ingress("0", &reading(1100, 11, 0, 0, 0)).expect("un delta");
        assert_eq!(d.bytes, 100, "le mid 1 ne doit pas contaminer le mid 0");
    }

    fn reading(bytes: u64, packets: u64, nacks: u64, plis: u64, firs: u64) -> IngressReading {
        IngressReading { bytes, packets, nacks, plis, firs,
                         jitter: 0, clock_rate: 90_000, loss: None, rtt_ms: None }
    }
}
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `rtk cargo test -p sfu --lib telemetry::sampler`
Expected: FAIL — `cannot find function jitter_to_ms`

- [ ] **Step 3: Implémenter `sampler.rs`**

```rust
//! Turning str0m's cumulative counters into per-second deltas.
//!
//! Pure and synchronous: no str0m type crosses this boundary, which is what
//! lets the arithmetic — the part most likely to be wrong — be tested without
//! a peer connection.

use std::collections::HashMap;

/// One reading of an inbound m-line, as str0m reports it.
#[derive(Debug, Clone)]
pub struct IngressReading {
    pub bytes: u64,
    pub packets: u64,
    pub nacks: u64,
    pub plis: u64,
    pub firs: u64,
    /// Interarrival jitter, in RTP clock units.
    pub jitter: u32,
    /// The codec's clock rate, needed to make sense of `jitter`.
    pub clock_rate: u32,
    pub loss: Option<f32>,
    pub rtt_ms: Option<f32>,
}

/// One reading of a peer's transport.
#[derive(Debug, Clone)]
pub struct PeerReading {
    pub bytes_rx: u64,
    pub bytes_tx: u64,
    pub transport_bytes_rx: u64,
    pub transport_bytes_tx: u64,
    pub egress_loss: Option<f32>,
    pub bwe_bps: Option<i64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Deltas {
    pub bytes: i64,
    pub packets: i64,
    pub nacks: i32,
    pub plis: i32,
    pub firs: i32,
    pub jitter_ms: Option<f32>,
    pub loss: Option<f32>,
    pub rtt_ms: Option<f32>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PeerDeltas {
    pub bytes_rx: i64,
    pub bytes_tx: i64,
    pub transport_bytes_rx: i64,
    pub transport_bytes_tx: i64,
    pub egress_loss: Option<f32>,
    pub bwe_bps: Option<i64>,
}

/// Converts str0m's jitter into milliseconds.
///
/// str0m reports interarrival jitter in RTP clock units — 48 000 Hz for Opus,
/// 90 000 Hz for video. Getting this wrong is silent: the numbers stay
/// plausible while being off by nearly a factor of two.
pub fn jitter_to_ms(jitter_rtp_units: u32, clock_rate: u32) -> Option<f32> {
    if clock_rate == 0 {
        return None;
    }
    Some(jitter_rtp_units as f32 * 1000.0 / clock_rate as f32)
}

/// Subtracts `previous` from `current`, clamping at zero.
fn delta(current: u64, previous: u64) -> i64 {
    current.saturating_sub(previous) as i64
}

#[derive(Default)]
pub struct Sampler {
    ingress: HashMap<String, IngressReading>,
    peer: Option<PeerReading>,
}

impl Sampler {
    pub fn new() -> Self {
        Self::default()
    }

    /// Records a reading and returns the delta since the previous one.
    ///
    /// `None` on the very first reading: a cumulative total on its own says
    /// nothing, and emitting it would make the first sample equal the whole
    /// connection and wreck every chart's scale.
    pub fn ingress(&mut self, mid: &str, reading: &IngressReading) -> Option<Deltas> {
        let previous = self.ingress.insert(mid.to_string(), reading.clone())?;
        Some(Deltas {
            bytes: delta(reading.bytes, previous.bytes),
            packets: delta(reading.packets, previous.packets),
            nacks: delta(reading.nacks, previous.nacks) as i32,
            plis: delta(reading.plis, previous.plis) as i32,
            firs: delta(reading.firs, previous.firs) as i32,
            // Jitter, loss et RTT sont des états instantanés, pas des cumuls :
            // ils se lisent tels quels.
            jitter_ms: jitter_to_ms(reading.jitter, reading.clock_rate),
            loss: reading.loss,
            rtt_ms: reading.rtt_ms,
        })
    }

    pub fn peer(&mut self, reading: &PeerReading) -> Option<PeerDeltas> {
        let previous = self.peer.replace(reading.clone())?;
        Some(PeerDeltas {
            bytes_rx: delta(reading.bytes_rx, previous.bytes_rx),
            bytes_tx: delta(reading.bytes_tx, previous.bytes_tx),
            transport_bytes_rx: delta(reading.transport_bytes_rx, previous.transport_bytes_rx),
            transport_bytes_tx: delta(reading.transport_bytes_tx, previous.transport_bytes_tx),
            egress_loss: reading.egress_loss,
            bwe_bps: reading.bwe_bps,
        })
    }
}
```

- [ ] **Step 4: Activer les statistiques dans str0m**

Dans `src/transport/peer_connection.rs`, ligne 86, remplacer `Rtc::builder().build(Instant::now())` par :

```rust
rtc: Rtc::builder()
    // Sans cet appel, str0m n'émet jamais MediaIngressStats, MediaEgressStats
    // ni PeerStats : les statistiques sont désactivées par défaut. C'est la
    // seule raison pour laquelle jitter, loss et RTT n'existaient pas.
    .set_stats_interval(Some(stats_interval))
    .build(Instant::now()),
```

`PeerConnection::new` prend un paramètre `stats_interval: Duration` de plus, passé depuis `session.rs` avec `state.config.telemetry.sample_interval`.

Ajouter aussi un registre du clock rate par mid, alimenté au premier paquet — `MediaAdded` ne porte pas le codec, seul `PayloadParams` le porte :

```rust
/// Clock rate of each inbound m-line, learned from the first packet.
///
/// `MediaAdded` does not carry the codec; only `PayloadParams` does. Without
/// this the jitter cannot be converted.
rx_clock_rate: HashMap<Mid, u32>,
```

- [ ] **Step 5: Remonter les statistiques**

Dans `src/transport/event_loop.rs`, ajouter deux variantes à `TransportEvent` :

```rust
/// One second of statistics for an inbound m-line of this peer.
TrackStats {
    peer: Arc<str>,
    mid: Mid,
    reading: IngressReading,
},
/// One second of transport statistics for this peer.
PeerStats {
    peer: Arc<str>,
    reading: PeerReading,
},
```

et trois branches à `handle_event` :

```rust
Event::MediaIngressStats(s) => {
    let clock_rate = conn.rx_clock_rate.get(&s.mid).copied().unwrap_or(0);
    let reading = IngressReading {
        bytes: s.bytes,
        packets: s.packets,
        nacks: s.nacks,
        plis: s.plis,
        firs: s.firs,
        jitter: s.jitter,
        clock_rate,
        loss: s.loss,
        rtt_ms: s.rtt.map(|d| d.as_secs_f32() * 1000.0),
    };
    // Statistique : la jeter est sans conséquence, contrairement à une annonce
    // de track. Pas de log par perte.
    let _ = events.try_send(TransportEvent::TrackStats {
        peer: Arc::clone(&conn.peer_id),
        mid: s.mid,
        reading,
    });
}
Event::MediaEgressStats(_) => {
    // Le sens sortant est celui du subscriber, pas du publisher : l'attribuer
    // au track ici le compterait deux fois. Le débit sortant se reconstruit en
    // sommant les deltas entrants des tracks auxquels un peer est abonné, et
    // `PeerStats` porte déjà le total transport. Ignoré volontairement.
}
Event::PeerStats(s) => {
    let reading = PeerReading {
        bytes_rx: s.bytes_rx,
        bytes_tx: s.bytes_tx,
        transport_bytes_rx: s.peer_bytes_rx,
        transport_bytes_tx: s.peer_bytes_tx,
        egress_loss: s.egress_loss_fraction,
        bwe_bps: s.bwe_tx.map(|b| b.as_u64() as i64),
    };
    let _ = events.try_send(TransportEvent::PeerStats {
        peer: Arc::clone(&conn.peer_id),
        reading,
    });
}
```

Dans `Event::IceConnectionStateChange(state)`, ajouter l'émission d'un `TransportEvent` porteur de l'état, pour alimenter `peers.ice_state` et les events ICE. Vérifier les variantes exactes de `IceConnectionState` dans str0m 0.23.1 avec `rg "enum IceConnectionState" -A 12` dans le source du crate, et associer : `Connected` → `EventKind::IceConnected`, `Disconnected` → `IceDisconnected`, tout autre état terminal → `IceFailed`.

- [ ] **Step 6: Consommer dans la pompe de transport**

Dans `spawn_transport_pump` de `session.rs`, tenir un `Sampler` local à la tâche — un par peer, ce qui est exactement sa durée de vie — et convertir :

```rust
TransportEvent::TrackStats { peer, mid, reading } => {
    let Some(peer_uuid) = crate::telemetry::peer_uuid(&peer) else { continue };
    let mid_str = mid.to_string();
    if let Some(d) = sampler.ingress(&mid_str, &reading) {
        telemetry.record(Entry::TrackSample(TrackSample {
            track_id: telemetry.track_id(peer_uuid, &mid_str),
            at: chrono::Utc::now(),
            bytes: d.bytes,
            packets: d.packets,
            nacks: d.nacks,
            plis: d.plis,
            firs: d.firs,
            jitter_ms: d.jitter_ms,
            loss: d.loss,
            rtt_ms: d.rtt_ms,
        }));
    }
}
TransportEvent::PeerStats { peer, reading } => {
    let Some(peer_uuid) = crate::telemetry::peer_uuid(&peer) else { continue };
    if let Some(d) = sampler.peer(&reading) {
        telemetry.record(Entry::PeerSample(PeerSample {
            peer_id: peer_uuid,
            at: chrono::Utc::now(),
            bytes_rx: d.bytes_rx,
            bytes_tx: d.bytes_tx,
            transport_bytes_rx: d.transport_bytes_rx,
            transport_bytes_tx: d.transport_bytes_tx,
            egress_loss: d.egress_loss,
            bwe_bps: d.bwe_bps,
        }));
    }
}
```

Et dans la branche `Media`, résoudre le codec une fois par track :

```rust
// Le codec n'arrive qu'avec le premier paquet. Une seule entrée par track :
// `codec_seen` garde la trace pour ne pas émettre un UPDATE par paquet.
if codec_seen.insert(packet.mid) {
    if let Some(peer_uuid) = crate::telemetry::peer_uuid(&peer) {
        let spec = packet.params.spec();
        telemetry.record(Entry::TrackCodec {
            id: telemetry.track_id(peer_uuid, &packet.mid.to_string()),
            codec: format!("{:?}", spec.codec).to_lowercase(),
            // `clock_rate` est un `str0m::Frequency`, pas un entier : il
            // enveloppe un NonZeroU32 et se lit avec `.get()`.
            clock_rate: spec.clock_rate.get() as i32,
        });
    }
}
```

`codec_seen` est un `HashSet<Mid>` local à la tâche. Cette même valeur alimente `rx_clock_rate` côté `PeerConnection`.

- [ ] **Step 7: Lancer les tests**

Run: `rtk cargo test -p sfu && rtk cargo clippy --all-targets`
Expected: PASS, aucun warning. `tests/room.rs` doit rester vert : activer les statistiques ne change pas la négociation.

- [ ] **Step 8: Commit**

```bash
rtk git add apps/sfu/src
rtk git commit -m "feat(sfu): activer les stats str0m et echantillonner en deltas"
```

---

## Task 8 : rétention, rollup et démarrage complet

**Files:**
- Create: `apps/sfu/src/telemetry/retention.rs`
- Modify: `apps/sfu/src/telemetry/tasks.rs`, `apps/sfu/src/main.rs`, `apps/sfu/src/app.rs`, `apps/sfu/tests/telemetry_pg.rs`

**Interfaces:**
- Consumes: `PgWriter` (Task 4), `TelemetryConfig` (Task 1)
- Produces:
```rust
pub fn partition_name(table: &str, start: DateTime<Utc>, daily: bool) -> String;
pub fn create_partition_sql(table: &str, start: DateTime<Utc>, daily: bool) -> String;
pub fn spawn_maintenance(writer: Arc<PgWriter>, cfg: TelemetryConfig);
pub fn spawn_rollup(writer: Arc<PgWriter>);
impl AppState { pub async fn with_telemetry(config: Config) -> Self }
```

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `src/telemetry/retention.rs` :

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn at(y: i32, m: u32, d: u32, h: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(y, m, d, h, 0, 0).single().expect("date valide")
    }

    #[test]
    fn hourly_partitions_are_named_to_the_hour() {
        assert_eq!(
            partition_name("track_samples", at(2026, 8, 30, 14), false),
            "track_samples_2026083014"
        );
    }

    #[test]
    fn daily_partitions_are_named_to_the_day() {
        assert_eq!(
            partition_name("track_samples_1m", at(2026, 8, 30, 14), true),
            "track_samples_1m_20260830"
        );
    }

    #[test]
    fn the_ddl_covers_exactly_one_hour() {
        let sql = create_partition_sql("track_samples", at(2026, 8, 30, 14), false);
        assert!(sql.contains("from ('2026-08-30 14:00:00+00:00')"), "sql = {sql}");
        assert!(sql.contains("to ('2026-08-30 15:00:00+00:00')"), "sql = {sql}");
        // Idempotent : la tâche de maintenance repasse toutes les dix minutes
        // sur des heures qu'elle a déjà créées.
        assert!(sql.contains("if not exists"), "sql = {sql}");
    }

    #[test]
    fn a_daily_ddl_covers_exactly_one_day() {
        let sql = create_partition_sql("track_samples_1m", at(2026, 8, 30, 14), true);
        assert!(sql.contains("from ('2026-08-30 00:00:00+00:00')"), "sql = {sql}");
        assert!(sql.contains("to ('2026-08-31 00:00:00+00:00')"), "sql = {sql}");
    }
}
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `rtk cargo test -p sfu --lib telemetry::retention`
Expected: FAIL — `cannot find function partition_name`

- [ ] **Step 3: Implémenter `retention.rs`**

```rust
//! Retention by partition.
//!
//! Purging by `DELETE` would mean about 100 000 deletions a minute at 50 peers
//! and a bloat autovacuum would not keep up with. Dropping a partition is
//! instant and needs no vacuum, which is the whole reason these tables are
//! partitioned.

use chrono::{DateTime, Duration as ChronoDuration, DurationRound, Utc};

/// Name of the partition covering `start`.
pub fn partition_name(table: &str, start: DateTime<Utc>, daily: bool) -> String {
    let stamp = if daily {
        start.format("%Y%m%d").to_string()
    } else {
        start.format("%Y%m%d%H").to_string()
    };
    format!("{table}_{stamp}")
}

/// DDL creating the partition covering `start`. Idempotent.
pub fn create_partition_sql(table: &str, start: DateTime<Utc>, daily: bool) -> String {
    let span = if daily {
        ChronoDuration::days(1)
    } else {
        ChronoDuration::hours(1)
    };
    let from = start
        .duration_trunc(span)
        .expect("troncature sur une durée constante");
    let to = from + span;
    format!(
        "create table if not exists telemetry.{} partition of telemetry.{} \
         for values from ('{}') to ('{}')",
        partition_name(table, from, daily),
        table,
        from,
        to
    )
}
```

`duration_trunc` vient de `chrono::DurationRound` ; vérifier que le trait est importé.

Déclarer le module dans `telemetry/mod.rs` : `pub mod retention;` puis
`pub use retention::{create_partition_sql, partition_name};`.

- [ ] **Step 4: Écrire les tâches de fond**

Dans `tasks.rs`, ajouter :

```rust
/// Creates partitions ahead of time and drops the ones out of the window.
///
/// Six hours of lead: an insert into an uncovered range fails and costs the
/// whole batch, so the margin is deliberately generous.
pub fn spawn_maintenance(writer: Arc<PgWriter>, cfg: TelemetryConfig) {
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(Duration::from_secs(600));
        loop {
            ticker.tick().await;
            if let Err(e) = maintain(&writer, &cfg).await {
                tracing::warn!("Télémétrie — maintenance impossible : {e}");
            }
        }
    });
}

pub async fn maintain(writer: &PgWriter, cfg: &TelemetryConfig) -> Result<(), sqlx::Error> {
    let now = Utc::now();

    for hour in 0..6 {
        let at = now + ChronoDuration::hours(hour);
        for table in ["track_samples", "peer_samples"] {
            sqlx::query(&create_partition_sql(table, at, false))
                .execute(writer.pool())
                .await?;
        }
    }
    for day in 0..2 {
        let at = now + ChronoDuration::days(day);
        sqlx::query(&create_partition_sql("track_samples_1m", at, true))
            .execute(writer.pool())
            .await?;
    }

    drop_expired(writer, "track_samples", now, cfg.retention_raw, false).await?;
    drop_expired(writer, "peer_samples", now, cfg.retention_raw, false).await?;
    drop_expired(writer, "track_samples_1m", now, cfg.retention_rollup, true).await?;

    // `events` n'est pas partitionnée : quelques dizaines de lignes par session
    // de room, un DELETE y est sans conséquence.
    let cutoff = now - ChronoDuration::from_std(cfg.retention_rollup).expect("durée raisonnable");
    sqlx::query("delete from telemetry.events where at < $1")
        .bind(cutoff)
        .execute(writer.pool())
        .await?;

    Ok(())
}
```

```rust
/// Drops the partitions of `table` that fell out of the retention window.
///
/// The cutoff is decoded from the partition's own name rather than from
/// `pg_get_expr` on its bounds: the name is already a canonical timestamp, and
/// parsing it needs no catalog query.
async fn drop_expired(
    writer: &PgWriter,
    table: &str,
    now: DateTime<Utc>,
    retention: Duration,
    daily: bool,
) -> Result<(), sqlx::Error> {
    let cutoff = now - ChronoDuration::from_std(retention).expect("durée raisonnable");
    let (fmt, span) = if daily {
        ("%Y%m%d", ChronoDuration::days(1))
    } else {
        ("%Y%m%d%H", ChronoDuration::hours(1))
    };

    let names: Vec<String> = sqlx::query_scalar(
        "select table_name from information_schema.tables
         where table_schema = 'telemetry'
           and table_name like $1
           and table_name <> $2",
    )
    // `_` est un joker en LIKE : l'échapper évite que `track_samples_%` attrape
    // aussi les partitions de `track_samples_1m`.
    .bind(format!("{}\_%", table))
    .bind(format!("{table}_default"))
    .fetch_all(writer.pool())
    .await?;

    for name in names {
        let Some(stamp) = name.strip_prefix(&format!("{table}_")) else {
            continue;
        };
        // Un suffixe qui n'est pas un horodatage n'est pas une partition qu'on
        // a créée — `track_samples_1m` quand on balaie `track_samples`, par
        // exemple. On ne détruit que ce qu'on reconnaît.
        let Ok(naive) = chrono::NaiveDateTime::parse_from_str(
            &format!("{stamp}0000"),
            &format!("{fmt}%M%S"),
        ) else {
            continue;
        };
        let start = naive.and_utc();
        if start + span < cutoff {
            tracing::info!("Télémétrie — purge de la partition {name}");
            sqlx::query(&format!("drop table if exists telemetry.{name}"))
                .execute(writer.pool())
                .await?;
        }
    }
    Ok(())
}
```

La partition `_default` de chaque table est **exclue** du balayage : elle porte
les lignes hors plage, et sa disparition ferait échouer les insertions qui n'ont
pas trouvé de partition.

`spawn_rollup` s'exécute chaque minute et agrège la minute **précédente** — jamais la courante, qui est encore alimentée :

```rust
/// Aggregates the previous minute into the rollup table.
///
/// Never the current minute: it is still being written to, and a rollup row
/// covering half a minute would be silently wrong forever.
pub fn spawn_rollup(writer: Arc<PgWriter>) {
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(Duration::from_secs(60));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        loop {
            ticker.tick().await;
            if let Err(e) = sqlx::query(ROLLUP_SQL).execute(writer.pool()).await {
                tracing::warn!("Télémétrie — rollup impossible : {e}");
            }
        }
    });
}

const ROLLUP_SQL: &str = r#"..."#;   // le SQL ci-dessous, tel quel
```


```sql
insert into telemetry.track_samples_1m
  (instance_id, track_id, at, samples, bytes, packets, nacks, plis,
   jitter_ms_avg, jitter_ms_max, jitter_ms_p95,
   loss_avg, loss_max, loss_p95,
   rtt_ms_avg, rtt_ms_max, rtt_ms_p95)
select instance_id, track_id, date_trunc('minute', at), count(*),
       sum(bytes), sum(packets), sum(nacks), sum(plis),
       avg(jitter_ms), max(jitter_ms), percentile_cont(0.95) within group (order by jitter_ms),
       avg(loss),      max(loss),      percentile_cont(0.95) within group (order by loss),
       avg(rtt_ms),    max(rtt_ms),    percentile_cont(0.95) within group (order by rtt_ms)
from telemetry.track_samples
where at >= date_trunc('minute', now()) - interval '1 minute'
  and at <  date_trunc('minute', now())
group by instance_id, track_id, date_trunc('minute', at)
on conflict (track_id, at) do nothing
```

- [ ] **Step 5: Câbler le démarrage**

`AppState::new` reste synchrone avec un `NoopSink`. Ajouter à côté :

```rust
/// Builds the state and, when `SFU_DATABASE_URL` is set, starts persistence.
///
/// Failing to reach the database is **not fatal**: the SFU falls back to the
/// no-persistence mode, which is a supported and tested path. Refusing to
/// start would let a database outage take down a media server.
pub async fn with_telemetry(config: Config) -> Self {
    let mut state = AppState::new(config);

    let Some(_) = state.config.telemetry.database_url.as_ref() else {
        tracing::info!("Télémétrie désactivée (SFU_DATABASE_URL absente)");
        return state;
    };

    let version = env!("CARGO_PKG_VERSION");
    let writer = match PgWriter::connect(&state.config.telemetry, version).await {
        Ok(w) => Arc::new(w),
        Err(e) => {
            tracing::warn!("Télémétrie — base injoignable, mode sans persistance : {e}");
            return state;
        }
    };

    match writer.recover_open_sessions().await {
        Ok(0) => {}
        Ok(n) => tracing::info!("Télémétrie — {n} sessions orphelines fermées au démarrage"),
        Err(e) => tracing::warn!("Télémétrie — reprise impossible : {e}"),
    }

    // Les partitions de l'heure courante doivent exister avant la première
    // écriture, sinon le premier lot part dans la partition par défaut.
    if let Err(e) = tasks::maintain(&writer, &state.config.telemetry).await {
        tracing::warn!("Télémétrie — partitions initiales : {e}");
    }

    let (sink, rx) = QueueSink::new(state.config.telemetry.queue_depth, state.metrics.clone());
    state.telemetry = Telemetry::new(sink);

    tasks::spawn_writer(writer.clone(), rx, state.config.telemetry.sample_interval);
    tasks::spawn_maintenance(writer.clone(), (*state.config).telemetry.clone());
    tasks::spawn_rollup(writer);

    tracing::info!("✅ Télémétrie active");
    state
}
```

Dans `main.rs`, remplacer `AppState::new(config)` par `AppState::with_telemetry(config).await`.

- [ ] **Step 6: Ajouter le test d'intégration des partitions**

Dans `tests/telemetry_pg.rs` :

```rust
#[tokio::test]
async fn maintenance_creates_the_partitions_the_writer_needs() {
    let Some(w) = writer().await else { return };
    let cfg = sfu::config::TelemetryConfig::default();

    sfu::telemetry::tasks::maintain(&w, &cfg).await.expect("maintenance");

    let name = sfu::telemetry::retention::partition_name(
        "track_samples",
        chrono::Utc::now(),
        false,
    );
    let (exists,): (bool,) = sqlx::query_as(
        "select exists (select 1 from information_schema.tables
                        where table_schema = 'telemetry' and table_name = $1)",
    )
    .bind(&name)
    .fetch_one(w.pool())
    .await
    .expect("requête");

    assert!(exists, "la partition {name} de l'heure courante doit exister");
}
```

- [ ] **Step 7: Lancer les tests**

```bash
rtk cargo test -p sfu
SFU_TEST_DATABASE_URL=postgres://postgres:sightline@localhost:5433/postgres \
  rtk cargo test -p sfu
rtk cargo clippy --all-targets
```
Expected: PASS dans les deux cas, aucun warning.

- [ ] **Step 8: Commit**

```bash
rtk git add apps/sfu/src apps/sfu/tests
rtk git commit -m "feat(sfu): retention par partitions, rollup 1 min et demarrage de la telemetrie"
```

---

## Task 9 : `NOTIFY`, vérification de bout en bout et documentation

**Files:**
- Modify: `apps/sfu/src/telemetry/pg.rs`, `apps/sfu/README.md`, `apps/sfu/CONTEXT.md`, `README.md`

- [ ] **Step 1: Émettre le `NOTIFY`**

À la fin de `PgWriter::write`, **dans** la transaction, avant `tx.commit()` :

```rust
// Le dashboard écoute ce canal pour invalider son cache. Charge utile
// minimale : les rooms touchées, jamais des métriques. Les valeurs seconde par
// seconde voyagent sur le WebSocket du SFU, pas par la base.
let touched = batch.touched_rooms();
if !touched.is_empty() {
    let payload = serde_json::json!({ "rooms": touched }).to_string();
    // `pg_notify` plutôt que `NOTIFY` : la charge utile est un paramètre lié,
    // donc pas de SQL construit par concaténation.
    sqlx::query("select pg_notify('sightline_live', $1)")
        .bind(&payload)
        .execute(&mut *tx)
        .await?;
}
```

- [ ] **Step 2: Vérification manuelle de bout en bout**

```bash
docker run --rm -d --name sightline-pg -e POSTGRES_PASSWORD=sightline -p 5433:5432 postgres:17
cd apps/sfu
SFU_DATABASE_URL=postgres://postgres:sightline@localhost:5433/postgres \
SFU_INSTANCE_NAME=sfu-dev SFU_REGION=eu-west-3 \
  cargo run -p sfu --release
```

Ouvrir trois onglets sur https://localhost:3000, laisser tourner une minute, puis :

```sql
select name, started_at, ended_at from telemetry.rooms;
select count(*) from telemetry.peers;
select kind, mid, codec, clock_rate from telemetry.tracks;
select track_id, at, bytes, jitter_ms, loss, rtt_ms
  from telemetry.track_samples order by at desc limit 10;
select kind, at, payload from telemetry.events order by at desc limit 20;
```

Trois vérifications, chacune attrapant un défaut différent :
1. `jitter_ms` doit être de l'ordre de quelques millisecondes en local, jamais de plusieurs centaines — une valeur absurde signale une conversion ratée du clock rate (§15 de la spec).
2. `bytes` doit être un débit par seconde plausible (des dizaines de kilo-octets), pas un total croissant — un total signale que le calcul de delta ne s'applique pas.
3. Fermer les trois onglets : `rooms.ended_at` et `ended_reason = 'empty'` doivent se remplir en une seconde.

- [ ] **Step 3: Contre-épreuve — couper Postgres pendant un appel**

Avec trois onglets connectés et de la vidéo qui circule :

```bash
docker stop sightline-pg
```

La vidéo doit continuer sans interruption visible. `curl -k https://localhost:3000/metrics` doit montrer `telemetry_entries_dropped` qui monte, et les logs une seule ligne d'avertissement par rafale, pas une par lot. Puis `docker start sightline-pg` : l'écriture reprend et un `Télémétrie — écriture rétablie` apparaît.

C'est la vérification qui compte le plus dans ce plan : elle prouve la contrainte globale « une base ne dégrade jamais un appel ».

- [ ] **Step 4: Documenter**

Dans `apps/sfu/README.md` et la table de configuration du `README.md` racine, ajouter les sept variables de la Task 1 avec leurs défauts.

Dans le tableau « Project status » du `README.md` racine, corriger deux lignes devenues fausses :
- « Quality metrics (jitter, loss, RTT, NACK) » passe de ❌ Planned à ✅, avec la note : fournies par les statistiques de str0m, par track.
- ajouter une ligne « Persistance / historique » : ✅ optionnelle, Postgres, activée par `SFU_DATABASE_URL`.

Dans `apps/sfu/CONTEXT.md`, ajouter une section « Télémétrie » décrivant le chemin d'écriture, la règle de la file qui jette, et le fait que le chemin chaud n'écrit rien.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/sfu README.md
rtk git commit -m "feat(sfu): NOTIFY sur ecriture, documentation de la telemetrie"
```

---

## Ce que ce plan ne fait pas

- **Le schéma `app`** (`settings`, `alert_rules`, `alert_acks`, Better Auth) et `packages/db` : second plan.
- **L'évaluation des seuils d'alerte** : elle lit `app.alert_rules`, donc elle attend que ce schéma existe. Les variantes `ThresholdBreached` et `ThresholdCleared` de `EventKind` sont définies ici mais ne sont émises par personne — c'est délibéré, et c'est le seul endroit du plan où du code livré n'est pas encore exercé.
- **`peers.close_code`** reste toujours nul : la boucle `while let Some(Ok(msg))` de `session.rs` avale la frame de fermeture. Le récupérer demande de restructurer la boucle, ce qui n'a pas sa place dans un plan de persistance.
- **`COPY` à la place des `INSERT`** : à mesurer, pas à supposer (voir Task 4, Step 4).
- **Les rôles et les `grant` de la spec §5** ne sont créés par aucune migration.
  `create role` demande un superutilisateur, et une migration qui échoue faute de
  privilèges empêcherait le SFU de démarrer sur une base gérée. Les deux rôles et
  leurs droits sont une étape de déploiement : ils seront documentés dans le
  `README` de `packages/db`, au second plan, à côté du `docker compose` qui les
  applique.
