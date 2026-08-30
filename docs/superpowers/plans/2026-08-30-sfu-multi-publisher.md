# SFU multi-publisher — Implementation Plan

**Statut : livré.** Les neuf tâches sont implémentées et commitées. Vérifié le 2026-08-30 :
`cargo test` 98 tests verts (6 suites), `cargo clippy --all-targets` sans warning. Le détail
de ce que l'exécution a révélé au-delà du plan est en fin de document.

**Goal:** Un subscriber reçoit un flux distinct et décodable par publisher, quel que soit le nombre de peers dans la room.

**Architecture :** une m-line sortante par (subscriber, track publié), allouée par le SFU via `SdpApi::add_media` et négociée par re-offer. Le `DownTrack` cesse d'être un réécriveur d'en-tête inerte : il devient l'aiguillage qui remplace le `mid` source par le `mid` de destination. Les `UpTrack` sont indexés par `(peer_id, mid)` et non plus par `peer_id`, un peer publiant audio **et** vidéo.

**Tech Stack :** Rust 2024, str0m 0.23.1 (mode média), tokio, axum, dashmap.

**Spec :** ce document (le diagnostic amont est dans `apps/sfu/CONTEXT.md`, section « Points connus »).

## Contraintes globales

- str0m reste en **mode média** (`Event::MediaData` / `Writer::write`), jamais en `rtp_mode`.
- `media/` ne dépend jamais de `transport/` : la frontière reste le trait `RtpSink`.
- Le chemin chaud (`forward_rtp`) reste **synchrone et sans allocation** par paquet : pas de négociation, pas de `String`, pas de lock await.
- Les files média restent bornées à 128 et jettent (`try_send`).
- Commentaires et messages de log en français, doc de code en anglais — comme l'existant.
- `cargo clippy --all-targets` sans warning, `cargo test` vert à chaque commit.

---

## Le défaut corrigé

`PeerConnection::write_rtp` utilisait `packet.mid`, le mid **du publisher**, comme clé du writer sur la connexion **du subscriber**. Tous les clients ayant la même SDP (`0` = audio, `1` = vidéo), deux publishers écrivaient dans la même m-line sortante → deux flux encodés entrelacés dans un seul décodeur.

Corollaire : le SFU n'appelait `sdp_api()` qu'une fois (`handle_offer`), donc aucune m-line supplémentaire ne pouvait exister.

---

## Structure de fichiers

| Fichier | Responsabilité | Action |
|---|---|---|
| `src/media/track.rs` | `TrackKey { peer_id, mid }`, l'identité d'un track publié | **créer** |
| `src/media/packet.rs` | `RtpPacketData` : porte `PayloadParams` au lieu d'un `u8`, perd les champs inertes | modifier |
| `src/media/down_track.rs` | aiguillage : réécrit `mid` vers la m-line du subscriber | réécrire |
| `src/media/up_track.rs` | flux publié, indexé par `TrackKey` | modifier |
| `src/media/engine.rs` | fanout par track, plus d'abonnement paresseux dans le chemin chaud | modifier |
| `src/media/sink.rs` | `request_keyframe(mid)` | modifier |
| `src/transport/peer_connection.rs` | allocation de m-lines, re-offer, `accept_answer`, PLI par mid | modifier |
| `src/transport/event_loop.rs` | émet `TransportEvent` (track ajouté / média / PLI demandée) | modifier |
| `src/transport/sink.rs` | `PeerSink::request_keyframe(mid)` | modifier |
| `src/signaling/negotiation.rs` | machine à états de renégociation, tâche unique | **créer** |
| `src/signaling/messages.rs` | `ClientMessage::SfuAnswer` | modifier |
| `src/signaling/dispatch.rs` | route Join / SfuAnswer / Leave vers le négociateur | modifier |
| `src/signaling/session.rs` | enregistre le peer auprès du négociateur, pompe les `TransportEvent`, compte les métriques | modifier |
| `src/app.rs` | `AppState.negotiator` | modifier |
| `assets/test.html` | publication `sendonly`, gestion du re-offer, une vignette par publisher | modifier |
| `tests/forwarding.rs` | tests de routage adaptés + non-régression multi-publishers | modifier |
| `tests/negotiation.rs` | dance SDP str0m ↔ str0m, 3 peers | **créer** |
| `benches/forwarding.rs` | adapté à la nouvelle API | modifier |

---

## Task 1 : `TrackKey` et le paquet

**Files:** créer `src/media/track.rs` ; modifier `src/media/packet.rs`, `src/media/mod.rs`.

**Produces:**
```rust
pub struct TrackKey { pub peer_id: Arc<str>, pub mid: Mid }   // Clone, Debug, PartialEq, Eq, Hash
impl TrackKey { pub fn new(peer_id: Arc<str>, mid: Mid) -> Self }

pub struct RtpPacketData {
    pub params: PayloadParams,   // Copy — les paramètres codec côté publisher
    pub payload: Arc<[u8]>,
    pub is_keyframe: bool,
    pub mid: Mid,                // source à l'entrée, destination après DownTrack
    pub network_time: Instant,
    pub rtp_time: u64,
    pub is_video: bool,
}
```

Disparaissent : `payload_type: u8`, `sequence_number`, `timestamp`, `ssrc`. Ils n'atteignaient jamais le réseau (str0m régénère l'en-tête) et `payload_type >= 96` était une heuristique fausse pour classer l'audio/vidéo.

`params` remplace `payload_type` parce que le PT n'est pas portable d'un peer à l'autre : `Writer::match_params` fait la correspondance codec → PT local côté subscriber.

- [x] Écrire `track.rs` + tests d'égalité/hash (deux mids différents du même peer ⇒ clés différentes).
- [x] Réécrire `RtpPacketData`, exporter `TrackKey` dans `media/mod.rs`.
- [x] `cargo check` (les autres modules cassent : normal, ils sont repris aux tâches suivantes).

---

## Task 2 : `DownTrack` aiguilleur

**Files:** `src/media/down_track.rs`.

```rust
pub struct DownTrack {
    pub subscriber_id: Arc<str>,
    /// M-line allouée sur la connexion du subscriber pour cette source.
    target_mid: Mid,
    sink: Arc<dyn RtpSink>,
}

impl DownTrack {
    pub fn new(subscriber_id: Arc<str>, target_mid: Mid, sink: Arc<dyn RtpSink>) -> Self;
    pub fn target_mid(&self) -> Mid;
    pub fn write_rtp(&self, packet: &RtpPacketData) {
        let mut out = packet.clone();
        out.mid = self.target_mid;
        self.sink.write_rtp(out);
    }
}
```

La réécriture SSRC/seq/timestamp disparaît : elle était documentée comme inerte, et le `DownTrack` a désormais un vrai travail — c'est lui qui porte la destination.

- [x] Test : `write_rtp` remplace le mid source par `target_mid` et laisse le payload partagé (`Arc::as_ptr` identique).

---

## Task 3 : moteur indexé par track

**Files:** `src/media/up_track.rs`, `src/media/engine.rs`, `src/media/sink.rs`.

```rust
pub trait RtpSink: Send + Sync {
    fn write_rtp(&self, packet: RtpPacketData);
    /// PLI sur une m-line entrante de ce peer.
    fn request_keyframe(&self, mid: Mid);
}

pub struct UpTrack { pub key: TrackKey, pub is_video: bool, /* down_tracks: DashMap<Arc<str>, Arc<DownTrack>> */ }

impl ForwardingEngine {
    pub fn add_peer(&self, room_id: String, peer_id: Arc<str>, sink: Arc<dyn RtpSink>);
    pub fn remove_peer(&self, peer_id: &str);
    pub fn publish_track(&self, key: TrackKey, is_video: bool) -> Arc<UpTrack>;   // idempotent
    pub fn subscribe(&self, key: &TrackKey, subscriber: &Arc<str>, target_mid: Mid) -> bool;
    pub fn forward_rtp(&self, from_peer_id: &str, packet: RtpPacketData) -> usize; // nb d'écritures
    pub fn tracks_in_room(&self, room_id: &str) -> Vec<(TrackKey, bool)>;
    pub fn tracks_of(&self, peer_id: &str) -> Vec<(TrackKey, bool)>;
    pub fn peers_in_room(&self, room_id: &str) -> Vec<Arc<str>>;
    pub fn room_of(&self, peer_id: &str) -> Option<String>;
    pub fn sink_of(&self, peer_id: &str) -> Option<Arc<dyn RtpSink>>;
    pub fn up_track(&self, key: &TrackKey) -> Option<Arc<UpTrack>>;
    pub fn peer_count(&self) -> usize;
    pub fn room_count(&self) -> usize;
}
```

`forward_rtp` ne crée plus d'abonnement : il n'a plus le droit, l'abonnement demande une allocation de m-line donc une négociation asynchrone. Il crée encore l'`UpTrack` paresseusement (un paquet ne doit pas se perdre si `MediaAdded` s'est perdu), mais sans effet de bord réseau. Il retourne le nombre d'écritures, que la couche session convertit en métrique.

- [x] Adapter `tests/forwarding.rs` : deux publishers → un subscriber, mids de destination distincts.
- [x] `cargo test --test forwarding`.

---

## Task 4 : allocation de m-lines et re-offer

**Files:** `src/transport/peer_connection.rs`.

État ajouté :
```rust
/// Kind de chaque m-line entrante (horloge RTP + classement audio/vidéo).
rx_kind: HashMap<Mid, MediaKind>,
/// Abonnements demandés, pas encore offerts.
queued: Vec<(TrackKey, MediaKind)>,
/// Abonnements offerts, en attente de l'answer.
offered: Vec<(TrackKey, Mid)>,
/// M-line locale déjà allouée par track source.
allocated: HashMap<TrackKey, Mid>,
/// Offer en vol — une seule à la fois, sinon glare.
pending_offer: Option<SdpPendingOffer>,
```

```rust
/// Demande une m-line pour un track distant. `false` si déjà connue.
pub fn queue_subscription(&mut self, key: TrackKey, kind: MediaKind) -> bool;
/// Alloue les m-lines en attente et construit la re-offer. `None` si rien à
/// faire ou si une offer est déjà en vol.
pub fn negotiate(&mut self) -> Option<String>;
/// Applique l'answer et rend les tracks devenus écrivables.
pub fn accept_answer(&mut self, sdp: &str) -> Result<Vec<(TrackKey, Mid)>>;
/// Ferme les m-lines qui portaient les tracks d'un publisher parti.
pub fn drop_source(&mut self, publisher: &str) -> bool;
/// PLI sur une m-line entrante.
pub fn request_keyframe(&mut self, mid: Mid);
```

`negotiate` :
```rust
if self.pending_offer.is_some() || self.queued.is_empty() { return None; }
let mut api = self.rtc.sdp_api();
let mut offered = Vec::new();
for (key, kind) in self.queued.drain(..) {
    let mid = api.add_media(kind, Direction::SendOnly,
        Some(key.peer_id.to_string()),                       // msid stream_id = publisher
        Some(format!("{}#{}", key.peer_id, key.mid)), None); // track_id
    offered.push((key, mid));
}
let (offer, pending) = api.apply()?;
self.pending_offer = Some(pending);
self.offered = offered;
Some(offer.to_sdp_string())
```

Le `stream_id` porte l'identifiant du publisher : côté navigateur c'est `event.streams[0].id`, donc le client sait à qui appartient chaque vignette sans message supplémentaire.

`write_rtp` : la garde `tx_streams` disparaît. `self.rtc.writer(mid)` est déjà la garde autoritaire — str0m n'inscrit la m-line dans la session qu'à l'application de l'answer (`apply_answer` → `add_new_lines`), donc les paquets arrivés avant la fin de la négociation sont jetés proprement. Le PT est résolu par `writer.match_params(packet.params)`, avec repli sur le premier PT de la m-line.

`request_keyframe` : `self.rtc.direct_api().stream_rx_by_mid(mid, None)` remplace la boucle sur `rx_ssrcs`, qui n'était plus alimentée depuis le passage à `Event::MediaData`. `rx_ssrcs` est supprimé.

- [x] Test : `negotiate()` sur deux tracks produit une offer à 2 m-lines `a=sendonly` avec les bons `a=msid`.
- [x] Test : une seconde `negotiate()` sans answer renvoie `None` (pas de glare).
- [x] Test : `queue_subscription` du même track deux fois renvoie `false` la seconde.

---

## Task 5 : le négociateur

**Files:** créer `src/signaling/negotiation.rs` ; modifier `src/signaling/mod.rs`, `src/app.rs`.

```rust
pub enum NegotiationEvent {
    TrackPublished { peer: Arc<str>, mid: Mid, kind: MediaKind },
    PeerJoined { peer: Arc<str>, room_id: String },
    AnswerReceived { peer: Arc<str>, sdp: String },
    KeyframeRequested { peer: Arc<str>, mid: Mid },
    PeerLeft { peer: Arc<str> },
}

pub struct Negotiator { /* engine, peers: DashMap<Arc<str>, PeerHandle>, tx */ }
struct PeerHandle { conn: Arc<Mutex<PeerConnection>>, signaling: Sender<ServerMessage> }

impl Negotiator {
    pub fn new(engine: Arc<ForwardingEngine>) -> Arc<Self>;   // spawne sa tâche
    pub fn register(&self, peer: Arc<str>, conn: ..., signaling: ...);
    pub fn unregister(&self, peer: &str);
    pub fn notify(&self, event: NegotiationEvent);
}
```

Une **tâche unique** consomme les événements en série : la renégociation est une machine à états, la sérialiser supprime toute course entre deux publishers qui apparaissent au même instant.

| Événement | Traitement |
|---|---|
| `TrackPublished` | `engine.publish_track` ; pour chaque autre peer de la room : `queue_subscription` + `drive` |
| `PeerJoined` | abonne le nouveau à tous les tracks de la room, et tous les présents aux tracks qu'il publie déjà |
| `AnswerReceived` | `accept_answer` → pour chaque `(key, mid)` : `engine.subscribe(key, peer, mid)` puis PLI vers le publisher ; puis `drive` (les abonnements mis en file pendant l'offer) |
| `KeyframeRequested` | remonte la PLI du subscriber vers le publisher du track servi sur ce mid |
| `PeerLeft` | `drop_source` chez les autres + `drive` |

`drive(peer)` = `conn.lock().negotiate()` → `signaling.send(ServerMessage::SfuOffer { sdp })`.

- [x] Test : deux peers, un track publié → une `SfuOffer` part vers le second.
- [x] Test : un track publié pendant qu'une offer est en vol n'en produit pas une seconde ; elle part après l'answer.

---

## Task 6 : câblage transport ↔ signaling

**Files:** `src/transport/event_loop.rs`, `src/transport/sink.rs`, `src/signaling/session.rs`, `src/signaling/dispatch.rs`, `src/signaling/messages.rs`.

```rust
pub enum TransportEvent {
    TrackAdded { peer: Arc<str>, mid: Mid, kind: MediaKind },
    Media { peer: Arc<str>, packet: RtpPacketData },
    KeyframeRequested { peer: Arc<str>, mid: Mid },
}
```

`event_loop::handle_event` :
- `MediaAdded` → `rx_kind.insert`, émet `TrackAdded` (`tx_streams` supprimé) ;
- `MediaData` → `Media` (`params` résolus via `rtc.codec_config()`, `is_keyframe` via `data.contiguous` remplacé par la vraie information : `MediaData` n'expose pas le type de frame en mode média, donc le champ est retiré du paquet et le keyframe est demandé, pas déduit) ;
- `KeyframeRequest` → `KeyframeRequested`.

`ClientMessage::SfuAnswer { sdp }` est ajouté au protocole ; `dispatch` le route vers `Negotiator::notify(AnswerReceived)`. `Join` notifie `PeerJoined`, `Leave` notifie `PeerLeft`.

`session::handle_socket` enregistre le peer auprès du négociateur et le désenregistre au teardown ; la pompe de forwarding compte les métriques :
```rust
let written = engine.forward_rtp(&peer, packet);
if written > 0 { metrics.record_rtp(len as u64 * written as u64); }
```
Cela répare le point 3 de `CONTEXT.md` : `/metrics` affichait 0 en permanence.

- [x] `cargo test`, `cargo clippy --all-targets`.

---

## Task 7 : le client de test

**Files:** `apps/sfu/assets/test.html`.

- publication en `direction: 'sendonly'` (le SFU ne partage plus la m-line de publication) ;
- `sfu_offer` **serveur → client** : `setRemoteDescription` → `createAnswer` → `sfu_answer` ;
- `ontrack` : une vignette par `event.streams[0].id` (= peer_id du publisher), ignorée si `streams` est vide ;
- `peer_left` retire la vignette ; `ended`/`mute` aussi ;
- grille responsive 1 → N.

- [x] Vérification manuelle à 3 onglets.

---

## Task 8 : tests d'intégration de la négociation

**Files:** créer `tests/negotiation.rs`.

Deux instances `Rtc` jouent le navigateur face à un `PeerConnection` du SFU, en mémoire, sans UDP :
- le « navigateur » offre `sendonly` audio+vidéo → le SFU répond ;
- le SFU alloue deux m-lines pour un publisher tiers et re-offre → le navigateur répond ;
- assertion : `rtc.media(mid).is_some()` pour chaque mid alloué, et `writer(mid)` existe ;
- assertion clé : les mids alloués pour deux publishers différents sont **distincts**.

- [x] `cargo test --test negotiation`.

---

## Task 9 : documentation

**Files:** `apps/sfu/CONTEXT.md`, `apps/sfu/README.md`.

- décrire la nouvelle boucle de négociation et le tableau des indices ;
- retirer des « points connus » ce qui est corrigé (1, 2, 3) ;
- documenter ce qui reste (une socket UDP par peer, pas de simulcast, pas de BWE).

---

## Ce que l'exécution a ajouté au plan

Trois défauts que le plan n'avait pas prévus, chacun trouvé par un niveau de
test que le précédent ne pouvait pas atteindre.

### 1. Le cloisonnement par room n'était pas vérifié à l'entrée (tests Rust)

`ForwardingEngine::subscribe` ne comparait pas la room du publisher à celle du
subscriber : il faisait confiance à l'appelant. Le négociateur ne demande jamais
un abonnement inter-room, donc rien ne se voyait — mais c'est la seule porte
d'entrée de la table de routage, et un flux qui traverse une room est une fuite.
La vérification est désormais dans `subscribe`.

### 2. Une vignette fantôme pendant la renégociation (Chrome)

Pendant la rafale d'arrivées, Chrome peut faire remonter un `ontrack` dont le
`msid` n'est pas encore résolu, sous un identifiant qu'il fabrique lui-même. Le
client créait alors une vignette que rien ne remplissait jamais. Il n'affiche
plus que les tracks dont le `streams[0].id` est un peer que le SFU a annoncé
dans la room.

Invisible dans `tests/room.rs` : le harnais str0m ne fabrique pas d'identifiant
de secours, et l'assertion ne comptait que les m-lines ayant porté du média.

### 3. La task de négociation se bloquait à la première room qui se vide (Chrome)

Le vrai défaut, et le plus grave. `PeerLeft` parcourait la `DashMap` des peers
en place ; un itérateur `DashMap` garde le verrou de son shard, le corps de la
boucle `await`, et `Negotiator::unregister` — appelé au teardown de chaque
session — demande le verrou en écriture sur le même shard. Les deux se sont
rencontrés pendant la déconnexion groupée d'une room de 15, la task s'est
bloquée, et **plus aucun peer n'a été câblé jusqu'au redémarrage du serveur**.

Le symptôme n'apparaissait pas sur la room qui plantait, mais sur la *suivante* :
tout le monde rejoignait, personne ne voyait personne, et aucune erreur nulle
part. Diagnostiqué par `sample` sur le processus vivant — `unregister` bloqué
dans `lock_exclusive_slow`.

Corrigé par `snapshot_except`, couvert par
`a_room_emptying_does_not_wedge_the_negotiation_task` (multi-thread, 40 peers,
départs concurrents : le test passe en 0,1 s avec le correctif et échoue en 10 s
sans). Au passage, l'envoi d'une re-offer est devenu borné : cette task négocie
pour tout le serveur, et un peer qui ne lit plus son canal ne doit pas pouvoir
geler les abonnements de tous les autres.

## Vérification

| Niveau | Résultat |
|---|---|
| `cargo test` | 98 tests |
| `cargo clippy --all-targets` | aucun warning |
| `tests/room.rs` — bout en bout, ICE/DTLS/SRTP réels | 3, 5, 10, 15 participants |
| `scripts/browser-check.ts` — Chrome headless | 3, 5, 10, 15 participants, enchaînés sur une même instance |

Contre-épreuves : le mid de destination retiré de `DownTrack` fait échouer
`tests/room.rs` ; l'itération en place restaurée fait échouer le test de
liveness du négociateur.
