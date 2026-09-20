//! Garde contre le retour du panic de provider cryptographique de rustls.
//!
//! rustls 0.23 refuse de deviner son provider au niveau du process quand zero ou deux des
//! features `ring` / `aws-lc-rs` sont compilees, et panique au premier usage :
//!
//! ```text
//! Could not automatically determine the process-level CryptoProvider from Rustls crate
//! features. Call CryptoProvider::install_default() before this point [...]
//! ```
//!
//! C'est arrive parce qu'`axum-server` et `sqlx` etaient tous deux declares avec leur alias
//! generique `tls-rustls`, qui ne resout pas sur le meme provider : aws-lc-rs pour le premier,
//! ring pour le second. Les deux features s'unifiaient sur le meme rustls 0.23.
//!
//! Pourquoi ce test a cette forme, et pas une autre :
//!
//! - **On ne peut pas asserter la configuration.** Les features d'une dependance ne sont pas
//!   observables depuis un `cfg!` de ce crate. L'invariant reel — exactement un provider — vit
//!   dans le graphe Cargo, pas dans le code ; il se verifie avec
//!   `cargo tree -e features | grep -c 'rustls feature "ring"'`, qui doit rendre 0.
//! - **On ne peut pas ajouter `rustls` en dev-dependency pour l'interroger.** Il faudrait lui
//!   donner une feature de provider, ce qui ajouterait ce provider au graphe du build de test
//!   et masquerait precisement le desequilibre qu'on cherche a detecter.
//! - **Pas de `#[should_panic]` inverse.** Le panic de rustls survient dans un `OnceCell` de
//!   process : il empoisonnerait les autres tests du meme binaire.
//!
//! Il reste donc a exercer le site d'appel qui paniquait : le chargement TLS de `main`.

use std::path::PathBuf;

fn manifest_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(name)
}

/// Charge la config TLS comme `main` le fait (`src/main.rs`, `RustlsConfig::from_pem_file`).
///
/// Avant le correctif, cet appel paniquait a la resolution du provider — donc avant meme
/// d'avoir lu les fichiers, et quel que soit leur contenu.
#[tokio::test]
async fn charge_la_config_tls_sans_paniquer_sur_le_provider() {
    let cert = manifest_path("localhost+1.pem");
    let key = manifest_path("localhost+1-key.pem");

    // Les certificats mkcert ne sont pas versionnes (`.gitignore` : `*.pem`). Sans eux, il
    // reste utile d'appeler `from_pem` avec des octets invalides : la resolution du provider
    // precede le parsing, donc le panic se declencherait quand meme s'il etait de retour,
    // tandis qu'un provider sain rend simplement une erreur de parsing.
    let result = if cert.exists() && key.exists() {
        axum_server::tls_rustls::RustlsConfig::from_pem_file(&cert, &key)
            .await
            .map(|_| ())
    } else {
        eprintln!("certificats locaux absents, repli sur un PEM invalide");
        match axum_server::tls_rustls::RustlsConfig::from_pem(b"pas un pem".to_vec(), b"non".to_vec())
            .await
        {
            // Une erreur de parsing est le resultat attendu dans ce repli : ce qu'on teste,
            // c'est d'etre arrive jusque-la sans panic.
            Err(_) => Ok(()),
            Ok(_) => Ok(()),
        }
    };

    assert!(
        result.is_ok(),
        "chargement TLS en echec : {:?}",
        result.err()
    );
}
