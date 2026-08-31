# Lumyx SFU — Contexte de développement

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
| --- | --- |
| `src/main.rs` | bootstrap seul |
| `src/lib.rs` | racine du crate (permet les tests d'intégration) |
| `src/config.rs` | config, surchargeable par `SFU_*` |
| `src/error.rs` | `SfuError` |
| `src/app.rs` | `AppState` + `build_router` |
| `src/http/` | routes de service, upgrade WebSocket |
| `src/signaling/` | `messages` (protocole), `session` (cycle de vie), `dispatch`, `negotiation` |
| `src/media/` | `engine` (forwarding), `track` (clé), `up_track`/`down_track`, `sink` (trait), `packet` |
| `src/transport/` | `peer_connection` (str0m), `event_loop`, `sink` (`PeerSink`) |
| `src/room/` | `Room` + `RoomManager`, `RoomPeer` |
| `src/metrics/` | compteurs d'exploitation |

### La frontière média ↔ transport

`media/` ne dépend jamais de `transport/`. Le moteur de forwarding manipule
des `Arc<dyn RtpSink>` :

```rust
pub trait RtpSink: Send + Sync {
    fn write_rtp(&self, packet: RtpPacketData);
    fn request_keyframe(&self, mid: Mid);
}
```

En production c'est `transport::PeerSink` (file mpsc + task d'écriture sur la
`PeerConnection`). En test c'est un sink en mémoire — d'où des tests de routage
sans socket, sans handshake et sans runtime asynchrone.

### Une m-line sortante par source

C'est l'invariant central, et le seul dont la violation ne se voit pas dans les
logs : elle se voit à l'écran, sous forme de bouillie de macroblocs.

Un subscriber a besoin d'**une m-line par track source**. Deux publishers écrits
dans la même m-line arrivent au navigateur comme un seul flux RTP portant deux
encodages entrelacés, et le décodeur n'en tire rien. Or tous les navigateurs
numérotent leurs m-lines pareil (`0` audio, `1` vidéo) : le `mid` du publisher
ne désigne donc rien de globalement unique, et le réutiliser côté destination
faisait exactement cela.

D'où trois pièces :

1. **`media::TrackKey`** — `(peer_id, mid)`, l'identité d'un track publié. Les
   `UpTrack` sont indexés là-dessus et non par peer : un peer publie de l'audio
   *et* de la vidéo, et chacun a besoin de son propre fanout.
2. **`media::DownTrack`** — porte le `mid` alloué sur la connexion du
   subscriber, et le tamponne sur chaque paquet au passage. C'est son seul
   travail ; il ne réécrit plus ni SSRC, ni séquence, ni timestamp, que str0m
   régénère en mode média.
3. **`signaling::Negotiator`** — alloue ces m-lines et les négocie.

Le `stream_id` de chaque m-line ajoutée porte l'identifiant du publisher :
côté navigateur c'est `event.streams[0].id`, donc le client sait à qui
appartient chaque vignette sans message de signaling supplémentaire.

### La négociation

S'abonner n'est pas une décision de routage, c'est un aller-retour SDP. Le
chemin de forwarding étant synchrone et sans attente, il ne peut pas s'en
charger : le moteur n'apprend l'existence d'un abonnement qu'une fois celui-ci
établi (`ForwardingEngine::subscribe`), et tout ce qui y mène vit dans
`signaling/negotiation.rs`.

```
MediaAdded (publisher)  ─┐
Join (subscriber)       ─┼─→ Negotiator ─→ queue_subscription
Answer                  ─┘                      ↓
                                          negotiate() → sfu_offer
                                                ↓
                                          sfu_answer → accept_answer
                                                ↓
                                          engine.subscribe + PLI
```

**Une seule task** consomme ces événements, en série. La règle dure est
qu'il n'y a qu'une offer en vol par peer — str0m rejette une answer dont le
change id n'est plus courant — et sérialiser supprime toute course pour ce
créneau. Le travail par événement est un lock plus une construction de SDP,
jamais une attente réseau.

Deux pièges, tous deux payés une fois :

- **Rien ne doit tenir un itérateur `DashMap` à travers un `await`** dans ce
  fichier. Un itérateur garde le verrou de son shard ; `Negotiator::unregister`,
  appelé au teardown d'une session, demande le verrou en écriture sur le même
  shard. Les deux se sont rencontrés, la task de négociation s'est bloquée, et
  plus aucun peer n'a été câblé jusqu'au redémarrage du serveur. D'où
  `snapshot_except`, et le test `a_room_emptying_does_not_wedge_the_negotiation_task`.
- **L'envoi d'une re-offer est borné** (`OFFER_SEND_TIMEOUT`). Cette task
  négocie pour tout le serveur : un `send().await` non borné laisserait un peer
  qui ne lit plus son canal de signaling geler les abonnements de tous les
  autres.

### Les keyframes

Un abonné qui arrive en cours de flux ne décode rien tant que le publisher n'a
pas émis une image clé. La PLI est adressée **par mid** —
`direct_api().stream_rx_by_mid(mid, None)` — et non par SSRC : `Event::MediaData`
n'expose pas les SSRC, si bien que la liste que parcourait l'implémentation
précédente était vide depuis le passage en mode média. Toutes les demandes de
keyframe étaient sans effet.

La demande part de deux endroits : le `Negotiator`, quand un abonnement devient
actif, et le subscriber lui-même — son `Event::KeyframeRequest` est routé vers
le publisher du track servi sur cette m-line, le SFU n'ayant pas d'encodeur.

### Le type de payload n'est pas portable

Deux peers négocient chacun leur PT pour un même codec. `RtpPacketData` porte
donc les `PayloadParams` du publisher, et l'écriture demande à str0m le PT qui
désigne le même codec sur la m-line du subscriber (`Writer::match_params`).
Transmettre le PT tel quel étiquetterait, par exemple, un payload VP8 avec le
numéro que le subscriber a réservé à H.264.

### Le protocole de signaling

| Client → serveur | |
| --- | --- |
| `join` | rejoint une room |
| `sfu_offer` | offer initiale du client — il publie en `sendonly` |
| `sfu_answer` | **answer à une re-offer du SFU** |
| `sfu_ice_candidate` | candidat ICE |
| `leave` | quitte la room |

| Serveur → client | |
| --- | --- |
| `connected` | peer_id attribué |
| `joined_room` / `peer_joined` / `peer_left` | composition de la room |
| `sfu_answer` | réponse à l'offer du client |
| `sfu_offer` | **re-offer : la room a gagné ou perdu un track publié** |
| `error` | |

Le client publie en `sendonly` et jamais en `sendrecv` : ce qu'il émet et ce
qu'il reçoit sont des m-lines différentes. Les partager, c'est retomber sur le
défaut que tout ceci corrige.

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

La frontière est vérifiée dans `subscribe`, pas seulement respectée par
l'appelant : c'est la seule porte d'entrée de la table de routage, et un flux
qui traverse une room est une fuite, pas un bug d'aiguillage.

## Lancer

```bash
cargo run                        # https://localhost:3000, client de test sur /
cargo test                       # 98 tests
cargo clippy --all-targets
bun scripts/browser-check.ts 5   # QA dans 5 Chrome headless (serveur lancé)
```

Variables : `SFU_BIND_ADDR`, `SFU_CERT_PATH`, `SFU_KEY_PATH`, `SFU_ICE_HOST`,
`SFU_LOG`, `SFU_SERVE_TEST_CLIENT`. Les défauts reproduisent le comportement
historique codé en dur.

Test manuel : ouvrir `https://localhost:3000` dans plusieurs onglets, même
room. Chaque participant doit voir tous les autres, chacun sur sa vignette.

## État actuel

- ICE/DTLS/SRTP fonctionnel
- Forwarding audio/vidéo cloisonné par room, **une m-line sortante par source**
- Renégociation à l'arrivée et au départ d'un participant
- PLI fonctionnelles, dans les deux sens
- `/metrics` alimenté (paquets, octets, keyframes, connexions)
- Vérifié à 3, 5, 10 et 15 participants — en tests Rust de bout en bout et dans
  de vrais Chrome headless

## Points connus, non corrigés

1. **Deux allers-retours SDP à l'arrivée d'un peer.** L'audio et la vidéo sont
   annoncés par deux `MediaAdded` distincts ; le premier part en offer, le
   second attend l'answer. Correct, mais une offer de plus que nécessaire. Un
   court regroupement des annonces d'un même peer l'économiserait.

2. **Une socket UDP par peer.** Suffisant ici ; les SFU en production
   démultiplexent sur une socket unique par ufrag ICE.

3. **Pas de simulcast, pas d'estimation de bande passante.** Le SFU relaie une
   seule couche par track et ne s'adapte pas au débit disponible du subscriber.
   Une room large impose donc à chacun le débit du publisher.

4. **Les compteurs de paquets jetés du `PeerSink` ne remontent pas sur
   `/metrics`.** Ils existent et se journalisent, mais `media/` n'a pas accès à
   `Metrics` et l'y amener est un chantier à part.

5. ~~**`localhost+1-key.pem` est une clé privée committée.**~~ Corrigé : la paire
   est sortie du suivi git et `*.pem` / `*.key` sont ignorés. Chaque dev génère
   la sienne (`mkcert localhost 127.0.0.1`). La clé reste dans l'historique ;
   un `git filter-repo` avant l'ouverture du dépôt reste à faire.
