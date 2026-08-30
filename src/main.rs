//! SFU server entry point.

use sfu::app::{AppState, build_router};
use sfu::config::Config;

#[tokio::main]
async fn main() {
    let config = Config::from_env();

    tracing_subscriber::fmt()
        .with_env_filter(config.log_filter.clone())
        .init();

    tracing::info!("🚀 Sightline SFU démarrage...");

    let tls = axum_server::tls_rustls::RustlsConfig::from_pem_file(
        &config.cert_path,
        &config.key_path,
    )
    .await
    .unwrap_or_else(|e| {
        panic!(
            "certificat TLS illisible ({} / {}) : {}",
            config.cert_path.display(),
            config.key_path.display(),
            e
        )
    });

    let addr = config.bind_addr;
    let app = build_router(AppState::new(config));

    tracing::info!("✅ Serveur HTTPS sur https://{}", addr);

    axum_server::bind_rustls(addr, tls)
        .serve(app.into_make_service())
        .await
        .expect("serveur HTTPS");
}
