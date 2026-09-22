//! SFU server entry point.

use lumyx_sfu::app::{AppState, build_router};
use lumyx_sfu::config::Config;

#[tokio::main]
async fn main() {
    // rustls voit deux fournisseurs cryptographiques dans l'arbre de
    // dependances — `ring`, tire par axum-server et sqlx, et `aws-lc-rs`, tire
    // par str0m — et refuse d'en choisir un seul, ce qui faisait paniquer le
    // serveur au premier appel TLS. On tranche pour aws-lc-rs : c'est celui que
    // str0m utilise deja pour DTLS, donc un seul backend fait le vrai travail.
    rustls::crypto::aws_lc_rs::default_provider()
        .install_default()
        .expect("fournisseur cryptographique rustls");

    let config = Config::from_env();

    tracing_subscriber::fmt()
        .with_env_filter(config.log_filter.clone())
        .init();

    tracing::info!("🚀 Lumyx SFU démarrage...");

    let tls =
        axum_server::tls_rustls::RustlsConfig::from_pem_file(&config.cert_path, &config.key_path)
            .await
            .unwrap_or_else(|e| {
                // Les certificats ne sont pas versionnés : sur un dépôt fraîchement
                // cloné, c'est le premier mur. Autant donner la commande.
                eprintln!("❌ Certificat TLS illisible : {e}");
                eprintln!("   cert : {}", config.cert_path.display());
                eprintln!("   clé  : {}", config.key_path.display());
                eprintln!();
                eprintln!("   Générer les certificats de dev une fois :");
                eprintln!("     mkcert -install && cd apps/sfu && mkcert localhost 127.0.0.1");
                eprintln!("   Ou pointer ailleurs avec SFU_CERT_PATH / SFU_KEY_PATH.");
                std::process::exit(1);
            });

    let addr = config.bind_addr;
    let app = build_router(AppState::new(config));

    tracing::info!("✅ Serveur HTTPS sur https://{}", addr);

    axum_server::bind_rustls(addr, tls)
        .serve(app.into_make_service())
        .await
        .expect("serveur HTTPS");
}
