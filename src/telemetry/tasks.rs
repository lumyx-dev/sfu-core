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
