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
