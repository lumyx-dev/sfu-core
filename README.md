# Sightline SFU

Serveur de conférence WebRTC (SFU) en Rust, sur [str0m](https://github.com/algesten/str0m).

Les peers publient leur flux audio/vidéo vers le serveur, qui le redistribue
aux autres participants — un envoi montant par peer au lieu d'un maillage.

## Démarrer

```bash
cargo run
```

Le serveur écoute sur `https://localhost:3000` avec les certificats de dev du
dépôt. Ouvrir cette adresse dans deux navigateurs et rejoindre la même room
pour un essai de bout en bout.

## Configuration

| Variable | Défaut |
|---|---|
| `SFU_BIND_ADDR` | `0.0.0.0:3000` |
| `SFU_CERT_PATH` | `localhost+1.pem` |
| `SFU_KEY_PATH` | `localhost+1-key.pem` |
| `SFU_ICE_HOST` | `127.0.0.1` |
| `SFU_LOG` | `debug` |
| `SFU_SERVE_TEST_CLIENT` | `true` |

## Tests

```bash
cargo test
cargo clippy --all-targets
```

Le routage RTP se teste sans réseau : la couche média ne parle qu'au trait
`RtpSink`, que les tests implémentent en mémoire. Voir `tests/forwarding.rs`.

Architecture et points connus : [CONTEXT.md](CONTEXT.md).
