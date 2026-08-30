//! SFU server configuration.
//!
//! Every value can be overridden through an environment variable; the
//! defaults reproduce the historical hard-coded behaviour.

use std::net::SocketAddr;
use std::path::PathBuf;

/// Crate directory, used to resolve the default paths (certificates, test
/// client).
const MANIFEST_DIR: &str = env!("CARGO_MANIFEST_DIR");

#[derive(Debug, Clone)]
pub struct Config {
    /// HTTPS listen address.
    pub bind_addr: SocketAddr,
    /// TLS certificate in PEM format.
    pub cert_path: PathBuf,
    /// TLS private key in PEM format.
    pub key_path: PathBuf,
    /// Host advertised in the local ICE candidates.
    pub ice_host: String,
    /// `tracing-subscriber` filter.
    pub log_filter: String,
    /// Serves `assets/test.html` on `/`. Handy in dev, turn it off in prod.
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
    /// Builds the configuration from the environment, falling back to the
    /// defaults for every variable that is missing or invalid.
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

    /// Path to the HTML test client.
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
