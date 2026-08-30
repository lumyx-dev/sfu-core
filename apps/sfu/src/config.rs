//! SFU server configuration.
//!
//! Every value can be overridden through an environment variable; the
//! defaults reproduce the historical hard-coded behaviour.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::time::Duration;

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
    /// Telemetry persistence settings.
    pub telemetry: TelemetryConfig,
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
            telemetry: TelemetryConfig::default(),
        }
    }
}

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

impl Config {
    /// Builds the configuration from the environment, falling back to the
    /// defaults for every variable that is missing or invalid.
    pub fn from_env() -> Self {
        let defaults = Config::default();
        let dt = defaults.telemetry.clone();

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
            telemetry: TelemetryConfig {
                // Une chaîne vide vaut absente : `SFU_DATABASE_URL=` dans un .env ne
                // doit pas activer la persistance sur une URL invalide.
                database_url: std::env::var("SFU_DATABASE_URL").ok().filter(|v| !v.is_empty()),
                instance_name: std::env::var("SFU_INSTANCE_NAME").unwrap_or(dt.instance_name),
                region: std::env::var("SFU_REGION").unwrap_or(dt.region),
                sample_interval: std::env::var("SFU_SAMPLE_INTERVAL")
                    .map(|v| parse_secs(&v, dt.sample_interval))
                    .unwrap_or(dt.sample_interval),
                retention_raw: std::env::var("SFU_RETENTION_RAW")
                    .map(|v| parse_secs(&v, dt.retention_raw))
                    .unwrap_or(dt.retention_raw),
                retention_rollup: std::env::var("SFU_RETENTION_ROLLUP")
                    .map(|v| parse_secs(&v, dt.retention_rollup))
                    .unwrap_or(dt.retention_rollup),
                queue_depth: std::env::var("SFU_TELEMETRY_QUEUE")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .filter(|d| *d > 0)
                    .unwrap_or(dt.queue_depth),
            },
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
}
