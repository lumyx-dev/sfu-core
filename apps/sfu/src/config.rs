//! SFU server configuration.
//!
//! Every value can be overridden through an environment variable; the
//! defaults reproduce the historical hard-coded behaviour.

use std::net::SocketAddr;
use std::ops::RangeInclusive;
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
    /// Range the peer UDP sockets are bound in.
    ///
    /// `None` means a kernel-chosen ephemeral port, the historical behaviour.
    /// A bounded range is what makes the media reachable from a container:
    /// only a range known in advance can be published by Docker.
    pub udp_ports: Option<RangeInclusive<u16>>,
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
            udp_ports: None,
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

/// The machine's hostname, or `lumyx-sfu` when it cannot be read.
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
        .unwrap_or_else(|| "lumyx-sfu".to_string())
}

/// Reads the UDP port range from its two variables.
///
/// Tout ce qui n'est pas une plage complète et cohérente vaut absent : une
/// seule des deux bornes, une borne illisible, un zéro, ou un minimum
/// au-dessus du maximum. Même règle que partout ailleurs dans ce fichier —
/// une valeur douteuse retombe sur le défaut plutôt que de refuser de
/// démarrer, et le défaut ici est le port éphémère.
fn parse_port_range(min: Option<String>, max: Option<String>) -> Option<RangeInclusive<u16>> {
    let min = min?.parse::<u16>().ok().filter(|p| *p > 0)?;
    let max = max?.parse::<u16>().ok().filter(|p| *p > 0)?;

    (min <= max).then_some(min..=max)
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
            udp_ports: parse_port_range(
                std::env::var("SFU_UDP_PORT_MIN").ok(),
                std::env::var("SFU_UDP_PORT_MAX").ok(),
            ),
            telemetry: TelemetryConfig {
                // Une chaîne vide vaut absente : `SFU_DATABASE_URL=` dans un .env ne
                // doit pas activer la persistance sur une URL invalide.
                database_url: std::env::var("SFU_DATABASE_URL")
                    .ok()
                    .filter(|v| !v.is_empty()),
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
        assert!(c.udp_ports.is_none());
    }

    #[test]
    fn a_complete_udp_range_is_read() {
        assert_eq!(
            parse_port_range(Some("40000".into()), Some("40063".into())),
            Some(40000..=40063)
        );
        // Une plage d'un seul port est valide : c'est un SFU à un participant,
        // pas une erreur de saisie.
        assert_eq!(
            parse_port_range(Some("40000".into()), Some("40000".into())),
            Some(40000..=40000)
        );
    }

    #[test]
    fn an_incomplete_or_inconsistent_udp_range_is_ignored() {
        let cases = [
            (None, None),
            (Some("40000".to_string()), None),
            (None, Some("40063".to_string())),
            // Bornes inversées : publier 40063-40000 n'a pas de sens, et
            // démarrer quand même sur un éphémère vaut mieux que refuser.
            (Some("40063".to_string()), Some("40000".to_string())),
            (Some("zero".to_string()), Some("40063".to_string())),
            // Le port 0 est justement ce qui demande un éphémère au noyau :
            // le lire comme une borne de plage n'aurait pas de sens.
            (Some("0".to_string()), Some("40063".to_string())),
            (Some("40000".to_string()), Some("99999".to_string())),
        ];

        for (min, max) in cases {
            assert_eq!(
                parse_port_range(min.clone(), max.clone()),
                None,
                "{min:?} {max:?}"
            );
        }
    }

    #[test]
    fn test_client_path_points_into_assets() {
        assert!(
            Config::default()
                .test_client_path()
                .ends_with("assets/test.html")
        );
    }

    #[test]
    fn telemetry_is_off_by_default() {
        let c = Config::default();
        assert!(c.telemetry.database_url.is_none());
        assert_eq!(c.telemetry.region, "local");
        assert_eq!(c.telemetry.sample_interval, Duration::from_secs(1));
        assert_eq!(c.telemetry.retention_raw, Duration::from_secs(24 * 3600));
        assert_eq!(
            c.telemetry.retention_rollup,
            Duration::from_secs(30 * 24 * 3600)
        );
        assert_eq!(c.telemetry.queue_depth, 256);
    }

    #[test]
    fn durations_are_parsed_as_seconds() {
        // Les durées se lisent en secondes, comme partout ailleurs dans l'écosystème
        // douze-facteurs : `SFU_RETENTION_RAW=3600` vaut une heure.
        assert_eq!(
            parse_secs("3600", Duration::from_secs(1)),
            Duration::from_secs(3600)
        );
        // Une valeur illisible retombe sur le défaut plutôt que de refuser de démarrer :
        // c'est la règle déjà appliquée par tout `from_env` de ce fichier.
        assert_eq!(
            parse_secs("douze", Duration::from_secs(7)),
            Duration::from_secs(7)
        );
        // Zéro est refusé : une rétention nulle purgerait la table à chaque passage.
        assert_eq!(
            parse_secs("0", Duration::from_secs(7)),
            Duration::from_secs(7)
        );
    }
}
