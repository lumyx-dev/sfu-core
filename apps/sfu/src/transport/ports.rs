//! Where a peer's UDP socket gets its port.
//!
//! Par défaut le noyau choisit — un port éphémère par peer, ce que le SFU a
//! toujours fait. En conteneur ça ne marche pas : un port tiré au hasard ne
//! peut pas être publié à l'avance, donc le média ne traverse pas le bridge
//! Docker. D'où la plage bornée, que le compose publie en 1:1.

use crate::error::{Result, SfuError};
use std::ops::RangeInclusive;
use std::sync::atomic::{AtomicU16, Ordering};
use tokio::net::UdpSocket;

#[derive(Debug)]
pub struct PortAllocator {
    /// `None` : port éphémère, choisi par le noyau.
    range: Option<RangeInclusive<u16>>,
    /// Prochain port à essayer. Repartir du début de la plage à chaque peer
    /// ferait rescanner tous les ports déjà pris — quadratique en nombre de
    /// participants, là où le curseur tombe sur un port libre du premier coup
    /// dans le cas courant.
    cursor: AtomicU16,
}

impl PortAllocator {
    /// Kernel-chosen port — the behaviour that predates the range.
    pub fn ephemeral() -> Self {
        PortAllocator {
            range: None,
            cursor: AtomicU16::new(0),
        }
    }

    /// Ports taken from `range`, in order, wrapping around.
    pub fn over(range: RangeInclusive<u16>) -> Self {
        let start = *range.start();
        PortAllocator {
            range: Some(range),
            cursor: AtomicU16::new(start),
        }
    }

    /// Builds from the configured range. An absent range means ephemeral.
    pub fn from_config(range: Option<RangeInclusive<u16>>) -> Self {
        match range {
            Some(r) => PortAllocator::over(r),
            None => PortAllocator::ephemeral(),
        }
    }

    /// Binds a UDP socket on every interface, on a port this allocator picks.
    ///
    /// Returns [`SfuError::Transport`] when the range holds no free port —
    /// a peer refused, rather than a panic that takes the server with it.
    pub async fn bind(&self) -> Result<UdpSocket> {
        let Some(range) = &self.range else {
            return UdpSocket::bind("0.0.0.0:0")
                .await
                .map_err(|e| SfuError::Transport(e.to_string()));
        };

        let (min, max) = (*range.start(), *range.end());
        let span = (max - min) as u32 + 1;
        let from = self.cursor.load(Ordering::Relaxed).clamp(min, max);

        for step in 0..span {
            let offset = ((from - min) as u32 + step) % span;
            let port = min + offset as u16;

            if let Ok(socket) = UdpSocket::bind(("0.0.0.0", port)).await {
                let next = if port == max { min } else { port + 1 };
                self.cursor.store(next, Ordering::Relaxed);
                return Ok(socket);
            }
        }

        Err(SfuError::Transport(format!(
            "plage UDP {}-{} saturée : aucun port libre",
            min, max
        )))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Un port libre, obtenu en laissant le noyau en choisir un puis en
    /// relâchant la socket. Les tests de plage ont besoin d'un port dont ils
    /// savent qu'il est disponible, sans en coder un en dur qui entrerait en
    /// collision avec un service de la machine.
    async fn free_port() -> u16 {
        let probe = UdpSocket::bind("0.0.0.0:0").await.expect("bind sonde");
        probe.local_addr().expect("adresse locale").port()
    }

    #[tokio::test]
    async fn sans_plage_le_port_est_ephemere() {
        let socket = PortAllocator::ephemeral().bind().await.expect("bind");
        assert_ne!(socket.local_addr().unwrap().port(), 0);
    }

    #[tokio::test]
    async fn avec_une_plage_le_port_en_fait_partie() {
        let base = free_port().await;
        let allocator = PortAllocator::over(base..=base + 2);

        let socket = allocator.bind().await.expect("bind");
        let port = socket.local_addr().unwrap().port();

        assert!(
            (base..=base + 2).contains(&port),
            "port hors plage : {port}"
        );
    }

    #[tokio::test]
    async fn une_plage_saturee_rend_une_erreur_transport() {
        let port = free_port().await;
        // On occupe nous-mêmes le seul port de la plage : la saturation est
        // alors certaine, sans dépendre de ce que fait la machine à côté.
        let _occupant = UdpSocket::bind(("0.0.0.0", port)).await.expect("occuper");

        let err = PortAllocator::over(port..=port)
            .bind()
            .await
            .expect_err("la plage est pleine");

        assert!(matches!(err, SfuError::Transport(_)), "erreur : {err:?}");
    }

    #[tokio::test]
    async fn un_port_libere_est_reutilisable() {
        let port = free_port().await;
        let allocator = PortAllocator::over(port..=port);

        let first = allocator.bind().await.expect("premier bind");
        drop(first);

        allocator
            .bind()
            .await
            .expect("second bind apres liberation");
    }

    #[tokio::test]
    async fn le_curseur_ne_rend_pas_deux_fois_le_meme_port() {
        let base = free_port().await;
        let allocator = PortAllocator::over(base..=base + 3);

        let a = allocator.bind().await.expect("bind a");
        let b = allocator.bind().await.expect("bind b");

        assert_ne!(
            a.local_addr().unwrap().port(),
            b.local_addr().unwrap().port()
        );
    }
}
