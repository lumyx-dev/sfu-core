//! Configuration du serveur SFU.
//!
//! Toutes les valeurs sont surchargeables par variable d'environnement ;
//! les défauts reproduisent le comportement historique codé en dur.

use std::net::SocketAddr;
use std::path::PathBuf;

/// Répertoire du crate, utilisé pour résoudre les chemins par défaut
/// (certificats, client de test).
const MANIFEST_DIR: &str = env!("CARGO_MANIFEST_DIR");

#[derive(Debug, Clone)]
pub struct Config {
    /// Adresse d'écoute HTTPS.
    pub bind_addr: SocketAddr,
    /// Certificat TLS au format PEM.
    pub cert_path: PathBuf,
    /// Clé privée TLS au format PEM.
    pub key_path: PathBuf,
    /// Hôte annoncé dans les candidats ICE locaux.
    pub ice_host: String,
    /// Filtre `tracing-subscriber`.
    pub log_filter: String,
    /// Sert `assets/test.html` sur `/`. Utile en dev, à couper en prod.
    pub serve_test_client: bool,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            bind_addr: "0.0.0.0:3000".parse().expect("adresse par défaut valide"),
            cert_path: PathBuf::from(format!("{}/localhost+1.pem", MANIFEST_DIR)),
            key_path: PathBuf::from(format!("{}/localhost+1-key.pem", MANIFEST_DIR)),
            ice_host: "127.0.0.1".to_string(),
            log_filter: "debug".to_string(),
            serve_test_client: true,
        }
    }
}

impl Config {
    /// Construit la configuration depuis l'environnement, en retombant sur
    /// les défauts pour chaque variable absente ou invalide.
    pub fn from_env() -> Self {
        let defaults = Config::default();

        Config {
            bind_addr: std::env::var("SFU_BIND_ADDR")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(defaults.bind_addr),
            cert_path: std::env::var("SFU_CERT_PATH")
                .map(PathBuf::from)
                .unwrap_or(defaults.cert_path),
            key_path: std::env::var("SFU_KEY_PATH")
                .map(PathBuf::from)
                .unwrap_or(defaults.key_path),
            ice_host: std::env::var("SFU_ICE_HOST").unwrap_or(defaults.ice_host),
            log_filter: std::env::var("SFU_LOG").unwrap_or(defaults.log_filter),
            serve_test_client: std::env::var("SFU_SERVE_TEST_CLIENT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(defaults.serve_test_client),
        }
    }

    /// Chemin du client de test HTML.
    pub fn test_client_path(&self) -> PathBuf {
        PathBuf::from(format!("{}/assets/test.html", MANIFEST_DIR))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_match_historical_hardcoded_values() {
        let c = Config::default();
        assert_eq!(c.bind_addr.to_string(), "0.0.0.0:3000");
        assert_eq!(c.ice_host, "127.0.0.1");
        assert_eq!(c.log_filter, "debug");
        assert!(c.serve_test_client);
        assert!(c.cert_path.ends_with("localhost+1.pem"));
        assert!(c.key_path.ends_with("localhost+1-key.pem"));
    }

    #[test]
    fn test_client_path_points_into_assets() {
        assert!(Config::default().test_client_path().ends_with("assets/test.html"));
    }
}
