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
