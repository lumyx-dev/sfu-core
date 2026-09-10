//! Postgres integration. Skipped unless `SFU_TEST_DATABASE_URL` is set.
//!
//! Not `#[ignore]`: gating on the variable keeps a single `cargo test`
//! command working both with and without a database, which is what the
//! optional-persistence promise requires.

use chrono::Utc;
use lumyx_sfu::config::TelemetryConfig;
use lumyx_sfu::telemetry::tasks::spawn_writer;
use lumyx_sfu::telemetry::{
    Batch, Entry, EventKind, EventRecord, PeerSample, PgWriter, QueueSink, TelemetrySink,
    TrackKind, TrackSample,
};
use serde_json::json;
use std::sync::Arc;
use std::time::Duration;
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
    Some(
        PgWriter::connect(&cfg, "0.1.0-test")
            .await
            .expect("connexion"),
    )
}

#[tokio::test]
async fn migrations_apply_and_the_instance_row_exists() {
    let Some(w) = writer().await else { return };

    let (count,): (i64,) = sqlx::query_as("select count(*) from telemetry.instance where id = $1")
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
    let connection = Uuid::new_v4();
    let now = Utc::now();

    let batch = Batch::from_entries(vec![
        Entry::RoomOpened {
            id: room,
            name: "test-room".into(),
            at: now,
        },
        Entry::PeerJoined {
            id: peer,
            peer_id: connection,
            room_id: room,
            at: now,
        },
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
async fn a_connection_visiting_two_rooms_produces_two_peer_rows_sharing_one_peer_id() {
    // Le point entier de la Task 6 review, finding 3 : `on conflict (id) do
    // nothing` doit voir deux `id` différents, jamais deux insertions du même
    // id — sans quoi la seconde room où ce connecteur apparaît serait avalée
    // en silence par la déduplication.
    let Some(w) = writer().await else { return };

    let connection = Uuid::new_v4();
    let room_a = Uuid::new_v4();
    let room_b = Uuid::new_v4();
    let occupancy_a = Uuid::new_v4();
    let occupancy_b = Uuid::new_v4();
    let now = Utc::now();

    w.write(&Batch::from_entries(vec![
        Entry::RoomOpened {
            id: room_a,
            name: "room-a".into(),
            at: now,
        },
        Entry::PeerJoined {
            id: occupancy_a,
            peer_id: connection,
            room_id: room_a,
            at: now,
        },
        Entry::RoomOpened {
            id: room_b,
            name: "room-b".into(),
            at: now,
        },
        Entry::PeerJoined {
            id: occupancy_b,
            peer_id: connection,
            room_id: room_b,
            at: now,
        },
    ]))
    .await
    .expect("écriture des deux occupations");

    let rows: Vec<(Uuid, Uuid)> = sqlx::query_as(
        "select id, room_id from telemetry.peers where peer_id = $1 order by room_id",
    )
    .bind(connection)
    .fetch_all(w.pool())
    .await
    .expect("requête");

    let mut expected = vec![(occupancy_a, room_a), (occupancy_b, room_b)];
    expected.sort_by_key(|(_, room)| *room);
    assert_eq!(
        rows, expected,
        "une ligne par occupation, toutes deux rattachées à la même connexion"
    );
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
    let connection = Uuid::new_v4();
    let track = Uuid::new_v4();
    let now = Utc::now();
    w.write(&Batch::from_entries(vec![
        Entry::RoomOpened {
            id: room,
            name: "orpheline".into(),
            at: now,
        },
        Entry::PeerJoined {
            id: peer,
            peer_id: connection,
            room_id: room,
            at: now,
        },
        // Un track resté publié : sans lui, la branche `tracks` de
        // `recover_open_sessions` pourrait disparaître sans faire échouer ce
        // test (room + peer suffisent déjà à satisfaire une simple `>= 2`).
        Entry::TrackPublished {
            id: track,
            peer_id: peer,
            mid: "0".into(),
            kind: TrackKind::Audio,
            at: now,
        },
    ]))
    .await
    .expect("écriture");

    let closed = w.recover_open_sessions().await.expect("reprise");
    // Exactement trois lignes restées ouvertes : la room, le peer, le track.
    // Une assertion exacte fait échouer ce test si une des trois branches
    // disparaît silencieusement, ce qu'une simple `>=` ne détecterait pas.
    assert_eq!(
        closed, 3,
        "la room, le peer et le track restés ouverts doivent être fermés"
    );

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

    let (ended,): (Option<chrono::DateTime<Utc>>,) =
        sqlx::query_as("select ended_at from telemetry.tracks where id = $1")
            .bind(track)
            .fetch_one(w.pool())
            .await
            .expect("requête");
    assert!(
        ended.is_some(),
        "un track resté publié doit être fermé aussi"
    );
}

/// Une room et un peer pour porter les entités qui en dépendent. Les
/// timestamps sont sans conséquence dans ces tests : seule leur cohérence
/// relative aux clés primaires compte.
async fn room_and_peer(w: &PgWriter) -> (Uuid, Uuid) {
    let room = Uuid::new_v4();
    let peer = Uuid::new_v4();
    let connection = Uuid::new_v4();
    let now = Utc::now();
    w.write(&Batch::from_entries(vec![
        Entry::RoomOpened {
            id: room,
            name: "support".into(),
            at: now,
        },
        Entry::PeerJoined {
            id: peer,
            peer_id: connection,
            room_id: room,
            at: now,
        },
    ]))
    .await
    .expect("room + peer de support");
    (room, peer)
}

#[derive(sqlx::FromRow, Debug, PartialEq)]
struct TrackSampleRow {
    bytes: i64,
    packets: i64,
    nacks: i32,
    plis: i32,
    firs: i32,
    jitter_ms: Option<f32>,
    loss: Option<f32>,
    rtt_ms: Option<f32>,
}

#[tokio::test]
async fn a_track_sample_round_trips_every_column_without_transposition() {
    let Some(w) = writer().await else { return };
    let (_, peer) = room_and_peer(&w).await;

    let track = Uuid::new_v4();
    let t1 = Utc::now();
    let t2 = t1 + chrono::Duration::seconds(1);

    w.write(&Batch::from_entries(vec![Entry::TrackPublished {
        id: track,
        peer_id: peer,
        mid: "0".into(),
        kind: TrackKind::Video,
        at: t1,
    }]))
    .await
    .expect("publication du track");

    // Des valeurs toutes différentes : une transposition entre deux colonnes
    // adjacentes de même type (nacks/plis, par exemple) doit faire échouer
    // l'assertion, ce qu'une même valeur partout ne détecterait pas.
    w.write(&Batch::from_entries(vec![Entry::TrackSample(
        TrackSample {
            track_id: track,
            at: t1,
            bytes: 11,
            packets: 22,
            nacks: 3,
            plis: 4,
            firs: 5,
            jitter_ms: Some(6.6),
            loss: Some(0.7),
            rtt_ms: Some(8.8),
        },
    )]))
    .await
    .expect("échantillon complet");

    // Un second échantillon sans aucun rapport RTCP reçu : les trois colonnes
    // optionnelles doivent rester `null`, pas `0.0`.
    w.write(&Batch::from_entries(vec![Entry::TrackSample(
        TrackSample {
            track_id: track,
            at: t2,
            bytes: 111,
            packets: 222,
            nacks: 33,
            plis: 44,
            firs: 55,
            jitter_ms: None,
            loss: None,
            rtt_ms: None,
        },
    )]))
    .await
    .expect("échantillon sans rtcp");

    let row1: TrackSampleRow = sqlx::query_as(
        "select bytes, packets, nacks, plis, firs, jitter_ms, loss, rtt_ms
         from telemetry.track_samples where track_id = $1 and at = $2",
    )
    .bind(track)
    .bind(t1)
    .fetch_one(w.pool())
    .await
    .expect("requête échantillon 1");
    assert_eq!(
        row1,
        TrackSampleRow {
            bytes: 11,
            packets: 22,
            nacks: 3,
            plis: 4,
            firs: 5,
            jitter_ms: Some(6.6),
            loss: Some(0.7),
            rtt_ms: Some(8.8),
        }
    );

    let row2: TrackSampleRow = sqlx::query_as(
        "select bytes, packets, nacks, plis, firs, jitter_ms, loss, rtt_ms
         from telemetry.track_samples where track_id = $1 and at = $2",
    )
    .bind(track)
    .bind(t2)
    .fetch_one(w.pool())
    .await
    .expect("requête échantillon 2");
    assert_eq!(
        row2,
        TrackSampleRow {
            bytes: 111,
            packets: 222,
            nacks: 33,
            plis: 44,
            firs: 55,
            jitter_ms: None,
            loss: None,
            rtt_ms: None,
        }
    );
}

#[derive(sqlx::FromRow, Debug, PartialEq)]
struct PeerSampleRow {
    bytes_rx: i64,
    bytes_tx: i64,
    transport_bytes_rx: i64,
    transport_bytes_tx: i64,
    egress_loss: Option<f32>,
    bwe_bps: Option<i64>,
}

#[tokio::test]
async fn a_peer_sample_round_trips_every_column_without_transposition() {
    let Some(w) = writer().await else { return };
    let (_, peer) = room_and_peer(&w).await;
    let at = Utc::now();

    // Encore des valeurs toutes différentes, y compris `bytes_rx`/`bytes_tx`
    // et les deux compteurs "transport_" : ce sont les paires les plus
    // faciles à intervertir par erreur dans `pg.rs`.
    w.write(&Batch::from_entries(vec![Entry::PeerSample(PeerSample {
        peer_id: peer,
        at,
        bytes_rx: 101,
        bytes_tx: 102,
        transport_bytes_rx: 103,
        transport_bytes_tx: 104,
        egress_loss: Some(0.55),
        bwe_bps: Some(123_456),
    })]))
    .await
    .expect("échantillon peer");

    let row: PeerSampleRow = sqlx::query_as(
        "select bytes_rx, bytes_tx, transport_bytes_rx, transport_bytes_tx, egress_loss, bwe_bps
         from telemetry.peer_samples where peer_id = $1 and at = $2",
    )
    .bind(peer)
    .bind(at)
    .fetch_one(w.pool())
    .await
    .expect("requête échantillon peer");
    assert_eq!(
        row,
        PeerSampleRow {
            bytes_rx: 101,
            bytes_tx: 102,
            transport_bytes_rx: 103,
            transport_bytes_tx: 104,
            egress_loss: Some(0.55),
            bwe_bps: Some(123_456),
        }
    );
}

#[derive(sqlx::FromRow, Debug)]
struct EventRow {
    kind: String,
    severity: String,
    room_id: Option<Uuid>,
    peer_id: Option<Uuid>,
    track_id: Option<Uuid>,
    payload: serde_json::Value,
}

#[tokio::test]
async fn an_event_round_trips_kind_severity_and_payload() {
    let Some(w) = writer().await else { return };

    // Des marqueurs uniques plutôt que des ids réels : `events` n'a pas de
    // clé étrangère sur room_id/peer_id/track_id (§6.3), donc n'importe quel
    // uuid identifie la ligne sans polluer une autre table.
    let room_marker = Uuid::new_v4();
    let peer_marker = Uuid::new_v4();
    let track_marker = Uuid::new_v4();
    let at = Utc::now();
    let payload = json!({"metric": "loss", "value": 0.42});

    // `ThresholdBreached` porte une sévérité "critical" par défaut, pas
    // "info" : ça vérifie que la sévérité écrite est bien celle du kind, pas
    // une valeur par défaut codée en dur dans `write`.
    let event = EventRecord::new(EventKind::ThresholdBreached, at)
        .room(room_marker)
        .peer(peer_marker)
        .track(track_marker)
        .payload(payload.clone());

    w.write(&Batch::from_entries(vec![Entry::Event(event)]))
        .await
        .expect("événement");

    let row: EventRow = sqlx::query_as(
        "select kind::text, severity::text, room_id, peer_id, track_id, payload
         from telemetry.events where peer_id = $1",
    )
    .bind(peer_marker)
    .fetch_one(w.pool())
    .await
    .expect("requête événement");

    assert_eq!(row.kind, "threshold_breached");
    assert_eq!(row.severity, "critical");
    assert_eq!(row.room_id, Some(room_marker));
    assert_eq!(row.peer_id, Some(peer_marker));
    assert_eq!(row.track_id, Some(track_marker));
    assert_eq!(row.payload, payload);
}

#[tokio::test]
async fn a_track_moves_through_published_codec_and_ended() {
    let Some(w) = writer().await else { return };
    let (_, peer) = room_and_peer(&w).await;

    let track = Uuid::new_v4();
    let published_at = Utc::now();
    let ended_at = published_at + chrono::Duration::seconds(30);

    w.write(&Batch::from_entries(vec![Entry::TrackPublished {
        id: track,
        peer_id: peer,
        mid: "1".into(),
        kind: TrackKind::Video,
        at: published_at,
    }]))
    .await
    .expect("publication");

    w.write(&Batch::from_entries(vec![Entry::TrackCodec {
        id: track,
        codec: "vp8".into(),
        clock_rate: 90_000,
    }]))
    .await
    .expect("codec");

    w.write(&Batch::from_entries(vec![Entry::TrackEnded {
        id: track,
        at: ended_at,
    }]))
    .await
    .expect("fin");

    let (kind, codec, clock_rate, ended): (
        String,
        Option<String>,
        Option<i32>,
        Option<chrono::DateTime<Utc>>,
    ) = sqlx::query_as(
        "select kind::text, codec, clock_rate, ended_at from telemetry.tracks where id = $1",
    )
    .bind(track)
    .fetch_one(w.pool())
    .await
    .expect("requête track");

    assert_eq!(kind, "video");
    assert_eq!(codec.as_deref(), Some("vp8"));
    assert_eq!(clock_rate, Some(90_000));
    assert_eq!(ended, Some(ended_at));
}

#[tokio::test]
async fn peer_left_and_ice_state_round_trip() {
    let Some(w) = writer().await else { return };
    let (_, peer) = room_and_peer(&w).await;
    let at = Utc::now();

    w.write(&Batch::from_entries(vec![
        Entry::IceState {
            peer_id: peer,
            state: "disconnected".into(),
            at,
        },
        Entry::PeerLeft {
            id: peer,
            at,
            close_code: Some(1006),
        },
    ]))
    .await
    .expect("écriture");

    let (left, close_code, ice_state): (
        Option<chrono::DateTime<Utc>>,
        Option<i32>,
        Option<String>,
    ) = sqlx::query_as("select left_at, close_code, ice_state from telemetry.peers where id = $1")
        .bind(peer)
        .fetch_one(w.pool())
        .await
        .expect("requête peer");

    assert_eq!(left, Some(at));
    assert_eq!(close_code, Some(1006));
    assert_eq!(ice_state.as_deref(), Some("disconnected"));
}

/// Interroge la base jusqu'à ce que la room apparaisse ou que le délai
/// expire. La tâche d'écriture tourne en arrière-plan : une seule requête
/// serait presque toujours suffisante mais rendrait le test aléatoire par
/// nature — on préfère un scrutin borné à un `sleep` fixe.
async fn poll_room_name(pool: &sqlx::PgPool, room: Uuid, timeout: Duration) -> Option<String> {
    let deadline = tokio::time::Instant::now() + timeout;
    loop {
        let row: Option<(String,)> =
            sqlx::query_as("select name from telemetry.rooms where id = $1")
                .bind(room)
                .fetch_optional(pool)
                .await
                .expect("requête");
        if let Some((name,)) = row {
            return Some(name);
        }
        if tokio::time::Instant::now() >= deadline {
            return None;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
}

#[tokio::test]
async fn entries_queued_through_the_sink_reach_the_database() {
    let Some(w) = writer().await else { return };
    let w = Arc::new(w);

    let metrics = lumyx_sfu::metrics::Metrics::new();
    let (sink, rx) = QueueSink::new(64, metrics.clone());
    // Un intervalle court : le test attend un tick, pas une seconde entière.
    spawn_writer(w.clone(), rx, Duration::from_millis(50));

    let room = Uuid::new_v4();
    let peer = Uuid::new_v4();
    let connection = Uuid::new_v4();
    let now = Utc::now();

    // Un cycle de vie minimal mais significatif — ouverture de room puis
    // arrivée d'un peer — poussé par la file plutôt que par `PgWriter::write`
    // directement : c'est le chemin bout-en-bout que cette tâche assemble.
    sink.record(Entry::RoomOpened {
        id: room,
        name: "queue-e2e".into(),
        at: now,
    });
    sink.record(Entry::PeerJoined {
        id: peer,
        peer_id: connection,
        room_id: room,
        at: now,
    });

    let name = poll_room_name(w.pool(), room, Duration::from_millis(500))
        .await
        .expect("la room doit apparaître après au moins un intervalle d'écriture");
    assert_eq!(name, "queue-e2e");

    let (room_of_peer,): (Uuid,) =
        sqlx::query_as("select room_id from telemetry.peers where id = $1")
            .bind(peer)
            .fetch_one(w.pool())
            .await
            .expect("requête peer");
    assert_eq!(room_of_peer, room);
}

#[tokio::test]
async fn dropping_the_sink_flushes_pending_entries_before_shutdown() {
    let Some(w) = writer().await else { return };
    let w = Arc::new(w);

    let metrics = lumyx_sfu::metrics::Metrics::new();
    // Intervalle volontairement long : si l'écriture n'arrivait que par le
    // tick, ce test se contenterait d'attendre le tick. Il ne peut passer que
    // grâce au chemin d'arrêt propre (flush avant break), ce qui est
    // précisément ce qu'on veut vérifier ici.
    let (sink, rx) = QueueSink::new(64, metrics.clone());
    spawn_writer(w.clone(), rx, Duration::from_secs(60));

    let room = Uuid::new_v4();
    let now = Utc::now();
    sink.record(Entry::RoomOpened {
        id: room,
        name: "shutdown-flush".into(),
        at: now,
    });

    // Seul moyen de faire tomber le dernier `Sender` : abandonner le sink
    // lui-même, qui le possède. `rx.recv()` ne rend `None` qu'à ce prix, ce
    // qui déclenche le flush du chemin d'arrêt propre.
    drop(sink);

    let name = poll_room_name(w.pool(), room, Duration::from_millis(500))
        .await
        .expect("l'arrêt propre doit vider la file avant de sortir, sans attendre le tick");
    assert_eq!(name, "shutdown-flush");
}
