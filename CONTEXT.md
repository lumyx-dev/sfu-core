# Sightline SFU — Contexte de développement

## Stack
- Rust + Tokio + Axum + str0m (WebRTC)
- str0m v0.23.1 en mode média (`MediaData`), pas `rtp_mode`
- Payload RTP porté en `Arc<[u8]>` de bout en bout : c'est le type que str0m
  rend (`MediaData.data`) et celui qu'il réclame (`Writer::write`), donc le
  tampon reçu est celui qui repart, partagé sans copie entre subscribers

## Architecture

Trois couches empilées, plus l'état partagé.

```
signaling/   protocole WebSocket JSON, cycle de vie des sessions
   ↓
media/       routage RTP — ne connaît que le trait RtpSink
   ↓
transport/   WebRTC + UDP (str0m) — une connexion par peer
```

| Chemin | Rôle |
|---|---|
| `src/main.rs` | bootstrap seul |
| `src/lib.rs` | racine du crate (permet les tests d'intégration) |
| `src/config.rs` | config, surchargeable par `SFU_*` |
| `src/error.rs` | `SfuError` |
| `src/app.rs` | `AppState` + `build_router` |
| `src/http/` | routes de service, upgrade WebSocket |
| `src/signaling/` | `messages` (protocole), `session` (cycle de vie), `dispatch` |
| `src/media/` | `engine` (forwarding), `up_track`/`down_track`, `sink` (trait), `packet` |
| `src/transport/` | `peer_connection` (str0m), `event_loop`, `sink` (`PeerSink`) |
| `src/room/` | `Room` + `RoomManager`, `RoomPeer` |
| `src/metrics/` | compteurs d'exploitation |

### La frontière média ↔ transport

`media/` ne dépend jamais de `transport/`. Le moteur de forwarding manipule
des `Arc<dyn RtpSink>` :

```rust
pub trait RtpSink: Send + Sync {
    fn write_rtp(&self, packet: RtpPacketData);
    fn request_keyframe(&self);
}
```

En production c'est `transport::PeerSink` (file mpsc + task d'écriture sur la
`PeerConnection`). En test c'est un sink en mémoire — d'où des tests de routage
sans socket, sans handshake et sans runtime asynchrone.

### Les files média jettent, elles n'accumulent pas

Les deux files du chemin média sont **bornées à 128 paquets** et écrivent en
`try_send` : le transport → moteur (`signaling/session`, flux entrant d'un seul
publisher) et le moteur → transport (`transport/sink`, écriture vers un peer).
Pleine, la file **jette le paquet** au lieu d'attendre.

C'est délibéré : sur du média temps réel un paquet vieux de plusieurs centaines
de millisecondes n'a plus de valeur, et l'accumuler ferait monter la mémoire et
la latence sans jamais rattraper le retard. À ~150 paquets/s pour de la vidéo
1080p, 128 paquets valent ~850 ms de média pour une source unique — moins côté
sink, dont la file est partagée par tous les publishers de la room (~425 ms à
deux, ~210 ms à quatre). Le plafond est choisi au-dessus d'une rafale de
keyframe (une IDR 1080p se fragmente sur une centaine de paquets MTU), pour
qu'un hoquet d'ordonnancement ne la tronque pas.

Le rejet n'est jamais silencieux : `PeerSink::dropped_packets()` expose un
compteur atomique, et chaque rafale de pertes est journalisée une fois — pas une
ligne par paquet. Ces compteurs ne remontent pas encore sur `/metrics`
(voir les points connus).

### Le peer_id sur le chemin chaud

`peer_id` est un `Arc<str>` de `http/ws` jusqu'à `media/engine` : il est
immuable et accompagne chaque paquet reçu, donc le cloner doit être un incrément
de compteur, pas une allocation. Les `room_id` restent des `String` — ils ne
sont touchés qu'aux transitions. `Arc<str>: Borrow<str>`, donc les recherches
par `&str` dans les `DashMap` fonctionnent sans conversion.

### Le cloisonnement par room

Le forwarding est scopé à la room. Le moteur indexe les sinks par room
(`rooms: room_id → (peer_id → sink)`, plus un index `peer_id → room_id`) : le
fanout itère sur les seuls membres de la room du publisher, sans balayer le
serveur. Le `room_id` reste une simple clé de regroupement — `media/` ne connaît
toujours pas `room/`.

L'enregistrement se fait au `Join`, pas à la connexion WebSocket :
`ForwardingEngine::add_peer(room_id, peer_id, sink)` est appelé depuis le
handler `ClientMessage::Join` de `signaling/dispatch`, qui reçoit le `PeerSink`
créé par `signaling/session`. `remove_peer` est appelé sur `Leave` et à la
déconnexion. Un peer qui n'a rejoint aucune room ne reçoit rien et ne diffuse
rien.

## Lancer

```bash
cargo run                        # https://localhost:3000, client de test sur /
cargo test                       # 68 tests
cargo clippy --all-targets
```

Variables : `SFU_BIND_ADDR`, `SFU_CERT_PATH`, `SFU_KEY_PATH`, `SFU_ICE_HOST`,
`SFU_LOG`, `SFU_SERVE_TEST_CLIENT`. Les défauts reproduisent le comportement
historique codé en dur.

Test manuel : ouvrir `https://localhost:3000` dans deux navigateurs, même room.

## État actuel
- ICE/DTLS/SRTP fonctionnel
- Forwarding vidéo/audio fonctionnel via `Writer::write()`, cloisonné par room
- Le départ d'un peer libère ses down_tracks chez les autres publishers
- Fonctionne bien à deux peers

## Points connus, non corrigés

Aucun n'affecte l'usage à deux peers.

1. **`request_keyframe` est sans effet.** Il itère sur `rx_ssrcs`, qui n'est
   plus alimenté depuis le passage de `Event::RtpPacket` à `Event::MediaData`
   (ce dernier n'expose pas les SSRC). L'escalier de PLI
   `[200, 500, 1000, 2000] ms` tourne donc à vide.

2. **Réécriture SSRC/seq/timestamp inerte.** `DownTrack::write_rtp` la calcule,
   mais `Writer::write()` régénère l'en-tête RTP. Conservée volontairement :
   elle redevient nécessaire en `rtp_mode`.

3. **`Metrics::record_rtp` / `record_keyframe` ne sont jamais appelés.** Les
   compteurs correspondants restent à zéro sur `/metrics`. Même angle mort pour
   le compteur de paquets jetés du `PeerSink` : il existe et se journalise, mais
   `media/` n'a pas accès à `Metrics` et l'y amener est un chantier à part.

4. ~~**`localhost+1-key.pem` est une clé privée committée.**~~ Corrigé : la paire
   est sortie du suivi git et `*.pem` / `*.key` sont ignorés. Chaque dev génère
   la sienne (`mkcert localhost 127.0.0.1`). La clé reste dans l'historique ;
   un `git filter-repo` avant l'ouverture du dépôt reste à faire.

5. **Une socket UDP par peer.** Suffisant ici ; les SFU en production
   démultiplexent sur une socket unique par ufrag ICE.
