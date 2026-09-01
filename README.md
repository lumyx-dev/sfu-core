# Lumyx SFU

Serveur de conférence WebRTC (SFU) en Rust, sur [str0m](https://github.com/algesten/str0m).

Les peers publient leur flux audio/vidéo vers le serveur, qui le redistribue
aux autres participants — un envoi montant par peer au lieu d'un maillage.

## Démarrer

Les certificats de dev ne sont pas versionnés — à générer une fois, avec
[mkcert](https://github.com/FiloSottile/mkcert) :

```bash
mkcert -install && mkcert localhost 127.0.0.1
```

```bash
cargo run
```

Le serveur écoute sur `https://localhost:3000`. Ouvrir cette adresse dans
plusieurs onglets et rejoindre la même room pour un essai de bout en bout :
chaque participant voit tous les autres.

## Configuration

| Variable | Défaut |
| --- | --- |
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

Trois niveaux, du plus rapide au plus fidèle :

| Cible | Ce qui est couvert |
| --- | --- |
| `tests/forwarding.rs` | routage RTP sans réseau — la couche média ne parle qu'au trait `RtpSink`, que les tests implémentent en mémoire |
| `tests/negotiation.rs` | la danse SDP, un `Rtc` str0m jouant le navigateur en face d'une `PeerConnection` |
| `tests/room.rs` | une room entière de bout en bout — ICE, DTLS, SRTP et média réels, sockets simulées — à 3, 5, 10 et 15 participants |

Et de vrais navigateurs, pour ce que str0m ne peut pas simuler — la façon dont
Chrome interprète une re-offer :

```bash
cargo run &
bun scripts/browser-check.ts 5      # 5 onglets Chrome headless dans la même room
```

Le script vérifie que chaque onglet affiche bien N-1 vignettes distantes
portant de la vidéo décodée. `CHROME_BIN` pointe le binaire à utiliser.

Architecture et points connus : [CONTEXT.md](CONTEXT.md).

Présentation du projet : [README racine](../../README.md) · Contribuer :
[CONTRIBUTING.md](../../CONTRIBUTING.md).
