# Instrumentation de qualité du SFU — design

Date : 2026-09-11
Tickets : LUM-552, LUM-553 (epic LUM-529 — Gate Phase 0, stabilité en conditions réseau dégradées)
Statut : approuvé, prêt pour le plan d'implémentation

---

## 1. Objectif

Rendre mesurable le critère « stabilité démontrée en conditions réseau dégradées », en deux livrables indissociables :

- **LUM-552** — une matrice de scénarios et des seuils de passage chiffrés, écrits **avant** la première exécution de la campagne.
- **LUM-553** — l'instrumentation serveur qui produit les chiffres que ces seuils jugent.

L'ordre est contraignant : la matrice dicte quels compteurs l'instrumentation doit produire. L'inverse — instrumenter puis écrire les seuils — revient à ajuster la barre au résultat obtenu, ce que le ticket LUM-552 identifie nommément comme le risque à éviter.

Ces métriques servent deux fois : valider le gate Phase 0 maintenant, et alimenter le Dashboard OSS ensuite. C'est le différenciant produit revendiqué par le README — « observability built into the media path, not bolted on ».

---

## 2. État des lieux

Quatre constats établis par lecture du code, qui recadrent entièrement l'effort de LUM-553.

### 2.1 Le schéma de télémétrie est complet et testé

`src/telemetry/entry.rs` définit déjà `TrackSample` et `PeerSample` avec exactement les champs demandés par LUM-553 : `jitter_ms`, `loss`, `rtt_ms`, `nacks`, `plis`, `firs`, `bytes`, `packets`, `egress_loss`, `bwe_bps`. Le `PgWriter`, le batching et les tests d'intégration Postgres (`tests/telemetry_pg.rs`) existent et passent.

La doctrine est posée et correcte : les échantillons sont des **deltas** sur la fenêtre, jamais des cumuls — « a delta sums and averages over any window; a total needs a window function on every query and goes wrong the moment a row is missing, which will happen since the queue drops ».

### 2.2 Personne ne produit ces échantillons

`grep TrackSample` ne remonte que le schéma, le writer et leurs tests. Aucun producteur.

La cause tient en une ligne : `src/transport/peer_connection.rs:86` construit `Rtc::builder().build(...)`. Dans str0m 0.23.1, `RtcConfig::default()` pose `stats_interval: None` — **le sous-système de statistiques est éteint**. `Event::MediaIngressStats`, `Event::MediaEgressStats`, `Event::PeerStats` et `Event::EgressBitrateEstimate` ne sont jamais émis, et le `_ => {}` final de `transport/event_loop.rs::handle_event` les avalerait de toute façon.

### 2.3 Le chemin de persistance n'est jamais câblé

`src/app.rs:41` installe un `NoopSink` en dur, et `src/main.rs` ne construit jamais de `PgWriter` ni n'appelle `spawn_writer`. La variable `SFU_DATABASE_URL` est lue par `Config::from_env` et n'a aucun effet.

### 2.4 La documentation d'onboarding se contredit

- `src/config.rs:57` décrit `sample_interval` comme « also passed to str0m's `set_stats_interval` ». C'est faux : aucun appel n'existe.
- `CONTRIBUTING.md` et `README.md` annoncent **68 tests**, `apps/sfu/CONTEXT.md` en annonce **98**. Le crate en déclare **153**.
- `CONTRIBUTING.md` propose comme « good places to start » : *Restore working keyframe requests* et *SDP renegotiation*. `CONTEXT.md` déclare les deux fonctionnels (« PLI fonctionnelles, dans les deux sens », « Renégociation à l'arrivée et au départ d'un participant »).
- `CONTRIBUTING.md` affirme que « three of the five `/metrics` counters are permanently zero ». `CONTEXT.md` déclare `/metrics` alimenté.
- `CONTRIBUTING.md` liste « RTCP parsing for quality metrics — this is the milestone the project is named after » comme tâche ouverte. C'est LUM-553.

Un nouveau contributeur suivant `CONTRIBUTING.md` irait réparer ce qui fonctionne déjà.

**Conclusion.** LUM-553 n'est pas « concevoir une instrumentation ». C'est brancher un tuyau déjà posé, combler le seul vrai manque de schéma (les *legs*), fournir une sortie exploitable, et cesser de mentir dans les documents d'entrée.

---

## 3. Décisions actées

| # | Décision | Motif |
|---|---|---|
| D1 | Les compteurs de rendu abonné (`freeze`, `concealment`) remontent par un message de signaling `client_stats`, pas par un export navigateur séparé | Une seule série temporelle, même horloge, même `peer_id`. À faire pendant que le protocole est encore malléable, LUM-570 voulant le figer en v1 |
| D2 | L'export de campagne passe par un anneau borné en mémoire + endpoint HTTP, pas par Postgres | Le gate Phase 0 ne doit pas dépendre d'une base debout, ni sur le harness ni sur la machine Hetzner. Le sink Postgres est câblé pour de bon, mais reste optionnel |
| D3 | Les seuils viennent de références externes citables, l'audio est bloquant, la vidéo est notée | Seule façon de résister à l'auto-tromperie que LUM-552 redoute, et publiable tel quel dans LUM-558 |
| D4 | `client_stats` sort du périmètre de LUM-553 et devient un ticket de suite | Une PR touchant chemin média + protocole de signaling + schéma de base est irrelisable et viole la règle « Keep PRs focused » de `CONTRIBUTING.md` |
| D5 | La réconciliation `CONTRIBUTING.md` / `CONTEXT.md` / `README.md` est intégrée à ce chantier | Livrer une instrumentation maintenable dans un dépôt dont la porte d'entrée ment annule le bénéfice |
| D6 | La BWE (`enable_bwe`) reste éteinte ; `bwe_bps` reste `NULL` en Phase 0 | Appartient à LUM-578 (epic simulcast). Le schéma anticipe déjà ce cas : `-- null tant que la BWE n'est pas activée` |
| D7 | `docs/phase-0/scenario-matrix.md` est rédigé **en anglais** | Destiné à publication par LUM-558, et `CONTRIBUTING.md` impose l'anglais pour la documentation publique. Le présent design, document de travail interne, reste en français |

**Contrainte transverse.** Le code doit rester maintenable par un développeur arrivant sans contexte. Cette contrainte n'est pas décorative : elle a modifié cinq choix de ce design, signalés par ⚙️.

---

## 4. Livrable 1 — LUM-552 : matrice de scénarios et seuils

Fichier : `docs/phase-0/scenario-matrix.md`, versionné, **commité avant la première exécution**.

### 4.1 Profils réseau

Cinq profils nommés. Ce sont les **conditions de test**, pas des seuils : ils n'ont pas à être justifiés par une référence, seulement à être reproductibles et à encadrer les conditions réelles.

| Réf | Profil | Perte | Jitter | RTT de base | Plafond de débit |
|---|---|---|---|---|---|
| P0 | Sain — ligne de base | 0 % | 0 ms | 20 ms | libre |
| P1 | Wifi domestique correct | 0,5 % aléatoire | 10 ms | 40 ms | libre |
| P2 | Wifi saturé | 3 % en rafales de 5 paquets | 30 ms | 80 ms | 2 Mbps |
| P3 | 4G dégradée | 5 % en rafales de 10 paquets | 60 ms | 150 ms | 1 Mbps |
| P4 | Coupure franche | P1 + blackout total de 2 s toutes les 60 s | | | |

P0 n'est pas une formalité : sans ligne de base mesurée dans le même harness, une dégradation observée en P2 n'est pas attribuable au profil réseau.

### 4.2 Matrice de scénarios

Asymétrie = un seul participant dégradé, le reste sain. Elle n'a de sens qu'à partir de 3 participants et hors P0.

| Cellules | Participants | Profils | Asymétrie | Durée | Statut |
|---|---|---|---|---|---|
| 3 | 2, 4, 8 | P0 | — | 10 min | Référence |
| 3 | 2 | P1, P2, P3 | — | 10 min | **Bloquant** |
| 6 | 4 | P1, P2, P3 | sym + asym | 10 min | **Bloquant** |
| 6 | 8 | P1, P2, P3 | sym + asym | 10 min | Noté |
| 2 | 4 | P4 | sym + asym | 10 min | Noté |
| 1 | 4 | P2 | sym | 30 min | **Bloquant** (endurance) |

**21 cellules, dont 10 bloquantes.** Une itération complète ≈ 3 h 50 de temps média, hors montage et démontage.

LUM-558 exige « plusieurs itérations ». Trois itérations dépassent 11 heures : **la matrice n'est pas exécutable à la main.** C'est une exigence dure sur LUM-551 — le harness doit enchaîner la matrice sans opérateur et produire un CSV par cellule.

### 4.3 Seuils bloquants

L'audio d'abord : une conférence dont le son coupe est morte, une conférence dont l'image gèle deux secondes reste utilisable.

| Seuil | Valeur | Justification (une phrase) |
|---|---|---|
| Contribution transport à la latence | ≤ 250 ms | ITU-T G.114 fixe le budget bouche-à-oreille total à 400 ms pour une conversation interactive ; 250 ms laissent 150 ms à la capture, l'encodage, le tampon de gigue et le rendu, que le serveur ne voit pas. |
| Coupure audio isolée | ≤ 200 ms | Au-delà d'environ 200 ms le PLC d'Opus n'a plus de signal récent sur lequel extrapoler : l'auditeur perçoit un trou et non une dégradation. |
| Reprise après rafale | ≤ 3 s | Une demande de keyframe et son aller-retour tiennent dans ce budget ; au-delà, l'utilisateur interrompt la conversation pour demander « tu m'entends ? », ce qui est la définition pratique d'une session cassée. |
| Stabilité mémoire | dérive RSS < 5 % sur le run de 30 min | À nombre de participants constant, une fuite du chemin média produit une croissance monotone ; 5 % est au-dessus du bruit de mesure et bien en dessous de ce que produit une vraie fuite. |
| Intégrité de session | zéro crash, zéro session perdue | Binaire, non négociable : une session qui meurt ne se rattrape pas à la métrique près. |

**Comment la latence est mesurée en Phase 0.** Le SFU ne peut pas observer la latence bouche-à-oreille : ni la capture, ni le tampon de gigue du récepteur, ni le rendu ne traversent le serveur. La contribution transport se mesure côté serveur comme `rtt_publisher / 2 + rtt_abonné / 2`, relevée par leg. C'est donc une **borne inférieure** de la latence réelle, et le seuil est resserré en conséquence — le budget complet devient mesurable avec le ticket `client_stats`, qui apporte `jitterBufferDelay`.

### 4.4 Relevés notés, non bloquants

- Débit délivré par abonné vs débit publié
- Cadence de PLI et de NACK par leg
- CPU et RSS du process par participant
- Type de chemin ICE retenu (direct vs relayé)

**Le gel vidéo n'est pas mesuré en Phase 0.** Les compteurs `freezeCount` et `concealedSamples` n'existent que dans le navigateur et arrivent avec le ticket `client_stats` (D4). En Phase 0 la vidéo est jugée côté serveur par le débit délivré et la cadence de PLI. Le document le dit explicitement plutôt que de laisser croire à une mesure absente.

### 4.5 Règle de verdict

> Phase 0 est franchie si, sur **toutes** les cellules marquées bloquantes, **tous** les seuils du §4.3 tiennent sur au moins trois itérations consécutives.
>
> Les cellules à 8 participants et le profil P4 sont relevés et publiés, jamais opposables au verdict.

Un SFU alpha mono-process qui encaisse 8 personnes en 4G dégradée serait une bonne surprise, pas une promesse. La règle est écrite pour qu'un lecteur externe puisse trancher sans nous demander.

---

## 5. Livrable 2 — LUM-553 : instrumentation serveur

### 5.1 Allumer les statistiques

`PeerConnection::new` reçoit l'intervalle d'échantillonnage et construit :

```rust
Rtc::builder()
    .set_stats_interval(Some(sample_interval))
    .build(Instant::now())
```

L'intervalle vient de `config.telemetry.sample_interval`, ce que le commentaire de `config.rs:57` prétend déjà. **Le commentaire cesse de mentir** (§2.4).

### 5.2 `transport/sampler.rs` — nouveau module

⚙️ **Le sampler est une fonction pure sur un état explicite.** Il ne détient pas d'`Arc<Telemetry>` : il **rend** des entrées, l'appelant les enregistre.

```rust
pub struct Sampler {
    ingress: HashMap<Mid, IngressReading>,
    egress: HashMap<Mid, EgressReading>,
    peer: Option<PeerReading>,
}

impl Sampler {
    pub fn observe_ingress(
        &mut self,
        stats: &MediaIngressStats,
        clock_rate: Option<u32>,
        now: DateTime<Utc>,
    ) -> Option<Delta>;

    pub fn observe_egress(&mut self, stats: &MediaEgressStats, now: DateTime<Utc>) -> Option<Delta>;
    pub fn observe_peer(&mut self, stats: &PeerStats, now: DateTime<Utc>) -> Option<PeerDelta>;
    pub fn forget(&mut self, mid: Mid);
}
```

Trois propriétés, chacune pour une raison précise :

- **`now` est injecté**, jamais `Utc::now()` à l'intérieur. Toute conversion se teste en trois lignes, sans runtime ni horloge.
- **Le sampler ne connaît ni `Telemetry`, ni `Uuid`, ni la base.** Il convertit des statistiques str0m en deltas ; la résolution des identifiants est le travail de l'appelant. `transport/` ne gagne donc aucune dépendance vers la façade `telemetry/` — précisément l'import de confort que `CONTRIBUTING.md` décrit comme « easy to destroy by accident ».
- **Le premier appel pour un `mid` rend `None`** : sans lecture précédente il n'y a pas de delta. C'est un cas nominal, pas une erreur.

Conversions, une fois pour toutes :

| Source str0m | Champ cible | Conversion |
|---|---|---|
| `MediaIngressStats.jitter: u32` (unités d'horloge RTP) | `jitter_ms: Option<f32>` | `jitter as f32 * 1000.0 / clock_rate as f32` ; `None` si `clock_rate` inconnu |
| `rtt: Option<Duration>` | `rtt_ms: Option<f32>` | `d.as_secs_f32() * 1000.0` |
| `bytes`, `packets`, `nacks`, `plis`, `firs` (totaux `u64`) | deltas | `current.saturating_sub(previous)` |
| `loss: Option<f32>` | `loss: Option<f32>` | fraction 0..1, telle quelle |

`saturating_sub` est défensif : str0m ne remet pas ses compteurs à zéro, mais un delta négatif dans une colonne `bigint not null` est un incident silencieux bien pire que l'octet perdu qu'il coûte.

**Propriété d'acceptation — le sampler ne fait aucun travail par paquet.** Il ne s'exécute que sur l'événement de statistiques, une fois par seconde et par peer. Ce n'est pas une optimisation : c'est la forme du design, et c'est ce qui rend vraie l'exigence « l'instrumentation ne doit pas dégrader ce qu'elle mesure ».

### 5.2 bis Un canal dédié pour les statistiques

**Amendement au moment du plan — sans lui, la campagne mesurerait faux.**

Le canal `transport → session` est borné à 128 entrées et écrit en `try_send` : plein, il **jette** (`session.rs:29`, `RTP_INGRESS_CAPACITY`). C'est la bonne politique pour du média temps réel. Appliquée aux statistiques, elle produit l'inverse de ce qu'on cherche : sous réseau dégradé — donc sous rafale de paquets, donc canal saturé — les échantillons seraient jetés **précisément dans les cellules de la matrice qui décident du gate**. La campagne rendrait des trous là où elle doit rendre des chiffres.

`CONTEXT.md` justifie le canal unique par une contrainte d'ordre : « the announcement of a track and the packets of that track must stay in order ». Cette contrainte lie `TrackAdded` et `Media`. Elle **ne s'applique pas** à un échantillon de statistiques, qui n'a aucune relation d'ordre avec les paquets.

Donc : un second canal `mpsc::channel::<StatsEvent>(64)`, du `event_loop` vers `spawn_transport_pump`, qui consomme les deux en `tokio::select!`. Un échantillon par seconde et par peer ne peut pas saturer une profondeur de 64 ; la politique de rejet est conservée par sécurité, et un rejet y devient l'anomalie qu'il doit être, pas le régime nominal.

Le `Sampler` reste ignorant de tout cela : il rend des deltas, le `event_loop` les emballe en `StatsEvent`, et la pompe — qui détient déjà `Arc<Telemetry>` et sait résoudre les identifiants pour `TrackAdded` — les enregistre. `transport/` ne gagne aucune dépendance vers `telemetry/`, exactement comme au §5.2.

### 5.3 L'horloge RTP

`Event::MediaAdded` ne porte pas le codec — seul le premier `PayloadParams` le porte, ce que `CONTEXT.md` documente déjà et dont `Entry::TrackCodec` dépend.

**Amendement au moment du plan : aucun nouveau champ n'est nécessaire, et la source n'est pas `rx_kind`.**

Une méthode `PeerConnection::rtp_clock(mid) -> Option<u32>` interroge `Rtc::media(mid)` puis `Media::kind()`, et rend 90 kHz pour la vidéo, 48 kHz pour l'audio — les mêmes valeurs que `to_packet` (`peer_connection.rs:367`) dérive déjà.

Le détour par str0m plutôt que par `rx_kind` n'est pas gratuit : `rx_kind` ne contient que les m-lines que *ce* peer **publie**, alors que les statistiques de leg arrivent sur des m-lines **sortantes**. Un registre local n'aurait donc couvert aucun leg. `Rtc::media` connaît les deux directions, donc une seule méthode sert tout le sampler et il n'y a pas de second registre à tenir en phase.

Un mid inconnu de str0m produit `jitter_ms: None` — cas déjà prévu par le schéma (`-- null si aucun rapport`).

### 5.4 Les legs — le seul manque de schéma

`Event::MediaEgressStats` arrive clé par le **mid sortant de l'abonné**, qui n'est pas un track publié. Le passer à `Telemetry::track_id(occupancy, mid)` fabriquerait des tracks fantômes dans `telemetry.tracks`.

Un *leg* est le service d'un track source vers un abonné : `(occupancy de l'abonné, track source)`. C'est ce que LUM-553 nomme « par leg », et c'est ce qui permet de voir *« la vue qu'Alice a de Bob est dégradée alors que celle de Carol est saine »* — soit exactement l'affirmation produit du README.

**Nouvelle entrée :**

```rust
pub struct LegSample {
    /// The subscriber's occupancy — references `telemetry.peers.id`.
    pub peer_id: Uuid,
    /// The source track served on this leg.
    pub track_id: Uuid,
    pub at: DateTime<Utc>,
    pub bytes: i64,
    pub packets: i64,
    pub nacks: i32,
    pub plis: i32,
    pub firs: i32,
    pub rtt_ms: Option<f32>,
    pub loss: Option<f32>,
    /// Jitter as reported by the remote receiver, via `RemoteIngressStats`.
    pub jitter_ms: Option<f32>,
}
```

**Résolution du `track_id`**, pièce par pièce, toutes existantes :

1. **`PeerConnection::source_on(mid) -> Option<TrackKey>` existe déjà** (`peer_connection.rs:258`) : elle sert déjà à router les demandes de keyframe. Aucun index inverse à ajouter — le plan avait prévu un `allocated_by_mid`, il est inutile. Le parcours est linéaire sur les abonnements d'un peer, exécuté une fois par seconde et par m-line sortante : à 8 participants, ~196 comparaisons par seconde et par peer.
2. `TrackKey` donne `(peer_id du publisher, mid source)`.
3. `telemetry::peer_uuid()` convertit le `peer_id` du publisher en `Uuid`.
4. `Telemetry::occupancy_of()` donne l'occupancy du publisher.
5. `Telemetry::track_id(occupancy, mid)` donne le `Uuid` du track source.

**Migration `0002_leg_samples.sql`**, calquée sur `track_samples` — partitionnée par plage, avec sa partition par défaut, pour la raison déjà écrite dans `0001` : « Perdre la granularité vaut mieux que perdre la donnée ».

```sql
create table telemetry.leg_samples (
  instance_id uuid        not null,
  peer_id     uuid        not null,   -- l'abonné (occupancy)
  track_id    uuid        not null,   -- le track source servi
  at          timestamptz not null,
  bytes       bigint      not null,   -- deltas sur la fenêtre, pas des cumuls
  packets     bigint      not null,
  nacks       integer     not null,
  plis        integer     not null,
  firs        integer     not null,
  jitter_ms   real,                   -- rapporté par le récepteur distant
  loss        real,                   -- fraction 0..1
  rtt_ms      real,
  primary key (peer_id, track_id, at)
) partition by range (at);
create index on telemetry.leg_samples (instance_id, at desc);
create table telemetry.leg_samples_default partition of telemetry.leg_samples default;
```

### 5.5 L'export de campagne

⚙️ **`RingSink` remplace `MemorySink`, il ne s'y ajoute pas.**

`MemorySink` est aujourd'hui un collecteur non borné réservé aux tests. Un anneau borné offrant le même `drain()` fait le même travail avec un argument de capacité en plus. Un type de moins à comprendre — mais surtout, les tests de télémétrie existants exercent alors le **type de production** : un bug dans l'anneau se fait attraper par les tests déjà écrits, pas par un test neuf que personne ne relance.

```rust
pub struct RingSink { entries: Mutex<VecDeque<Entry>>, capacity: usize }
```

Éviction FIFO à capacité pleine, capacité refusée à zéro à la construction.

Dimensionnement : à 8 participants publiant chacun 2 tracks, une seconde produit 8 échantillons de peer, 16 de track et 112 de leg (8 abonnés × 7 sources × 2 tracks), soit ~136 entrées. La capacité par défaut est fixée à **131 072 entrées** — environ 16 minutes dans ce pire cas, au-delà de la cellule la plus longue de la matrice (§4.2) — et se règle par `SFU_TELEMETRY_RING`.

Les quatre appels à `MemorySink::new()` (`telemetry/sink.rs:113`, `:129`, `telemetry/mod.rs:201`, `:235`) et celui de `signaling/dispatch.rs:221` deviennent `RingSink::new(1024)` : aucune éviction à cette capacité, donc les assertions existantes sur `drain()` restent vraies telles quelles.

`TeeSink` diffuse vers plusieurs sinks — une quinzaine de lignes, motif standard — pour qu'anneau et Postgres reçoivent les mêmes entrées.

**Route** `GET /telemetry/samples?format=csv|json&since=<rfc3339>`. Le CSV est le format d'exploitation du harness ; le JSON sert au débogage manuel.

### 5.6 Câbler Postgres pour de bon

`AppState::new` **reste synchrone** et prend le sink en paramètre : `AppState::new(config, sink: Arc<dyn TelemetrySink>)`. C'est `main.rs` qui choisit selon `config.telemetry.database_url` — `NoopSink` en son absence, `TeeSink(RingSink, QueueSink)` sinon — et qui lance `spawn_writer`.

Un seul constructeur, pas de variante `with_telemetry` à côté : `AppState::new` n'est appelé qu'à deux endroits (`main.rs:33` et le test de `signaling/dispatch.rs:220`), et deux portes d'entrée pour un même état partagé sont exactement le genre de choix qu'un développeur arrivant après devrait deviner. La rendre `async` était l'autre option, écartée : le test de `dispatch.rs` l'appelle en contexte synchrone.

Le principe posé par `sink.rs` est conservé : il y a toujours un sink, jamais un `if let Some(db)` dispersé dans le code.

### 5.7 Le piège rappelé au point d'appel

⚙️ `CONTEXT.md` raconte qu'un itérateur `DashMap` tenu à travers un `await` a bloqué la task de négociation jusqu'au redémarrage du serveur. Le sampler lit les `DashMap` de `Telemetry` (`occupancy_of`, `track_id`).

La règle est rappelée en doc comment **à l'endroit exact où elle peut être violée**, pas seulement dans le document d'architecture. Un dev qui lit la fonction qu'il modifie voit l'avertissement ; un dev qui lit l'architecture avant de coder est une hypothèse.

### 5.8 Mesurer le coût

`benches/forwarding.rs` (criterion) gagne une variante sampler branché / débranché. Le résultat attendu est l'absence d'écart mesurable sur le coût par paquet, puisque le sampler ne s'exécute pas par paquet (§5.2). Le bench verrouille cette propriété par un test au lieu de l'affirmer.

---

## 6. Livrable 3 — réconciliation documentaire

Corrections listées au §2.4 :

- `CONTRIBUTING.md` : compte de tests corrigé ; *Restore working keyframe requests* et *SDP renegotiation* retirés de « Good places to start » ; affirmation sur les compteurs `/metrics` corrigée ; *RTCP parsing for quality metrics* déplacé vers l'état courant, ce livrable le fermant.
- `README.md` : compte de tests corrigé.
- `CONTEXT.md` : compte de tests corrigé ; nouvelle section décrivant la chaîne de mesure, dans la forme des sections existantes ; point connu n° 4 (compteurs de `PeerSink` absents de `/metrics`) réévalué.
- `config.rs:57` : commentaire rendu vrai par le §5.1.

⚙️ **Une vérification en 60 secondes**, ajoutée à la checklist pré-PR de `CONTRIBUTING.md` :

```bash
cargo run                                                  # deux onglets sur https://localhost:3000
curl -k "https://localhost:3000/telemetry/samples?format=csv" | head
```

Si les chiffres bougent, la chaîne de mesure est intacte. C'est ce qui rend la feature maintenable en pratique : un développeur qui casse le sampler l'apprend en une minute, pas pendant la campagne.

⚙️ **Source de vérité unique pour la sémantique.** LUM-553 exige unité et sémantique documentées par compteur. Les écrire à la fois en doc comments Rust et dans une page markdown garantit la divergence — la démonstration est faite au §2.4 avec trois comptes de tests contradictoires.

Donc : les doc comments sur les champs de `TrackSample`, `LegSample` et `PeerSample` **sont** la spécification, et `docs/` y renvoie au lieu de la reformuler. La page markdown ne porte que ce que le code ne peut pas porter : la liste des colonnes toujours `NULL` et pourquoi (`bwe_bps` jusqu'à LUM-578).

---

## 7. Hors périmètre

**`client_stats` (ticket de suite, D4).** Message client → serveur portant par track entrant `freezeCount`, `totalFreezesDuration`, `concealedSamples`, `jitterBufferDelay` ; nouvel `Entry::ClientSample` ; poll `getStats()` dans `assets/test.html`. À revoir contre LUM-570 (figer le protocole de signaling v1), sa vraie contrepartie.

Conséquence assumée : la campagne LUM-558 ne dispose pas des compteurs de gel tant que ce ticket n'est pas fait. Le §4.4 le dit, et le §4.5 reste franchissable sans.

**Également hors périmètre :** la BWE (LUM-578), le simulcast (epic LUM-533), le harness d'injection réseau (LUM-551), l'exécution de la campagne (LUM-558).

---

## 8. Stratégie de test

| Niveau | Objet | Forme |
|---|---|---|
| Unitaire | `Sampler` | Statistiques str0m synthétiques. Premier échantillon sans delta ; delta sur deux lectures ; compteur en recul absorbé par `saturating_sub` ; jitter converti avec et sans `clock_rate` ; `rtt` absent propagé en `None` ; `forget` libère l'état d'un mid fermé |
| Unitaire | `RingSink` | Conservation dans l'ordre ; éviction FIFO à capacité pleine ; `drain` vide ; capacité 0 refusée à la construction |
| Unitaire | `TeeSink` | Chaque sink reçoit chaque entrée, dans l'ordre |
| Unitaire | Sérialisation CSV | En-tête stable, colonnes dans l'ordre du schéma, `None` rendu en champ vide |
| Intégration | `tests/telemetry_pg.rs` | `leg_samples` écrit et relu, sur le modèle des cas `track_samples` existants |
| Bench | `benches/forwarding.rs` | Coût par paquet, sampler branché vs débranché |
| Manuel | Chaîne complète | La vérification 60 secondes du §6, avec **trois participants ou plus** — `CONTRIBUTING.md` rappelle qu'à N=2 beaucoup de logique SFU dégénère en « envoie-le à l'autre » |

TDD : chaque commit du §9 commence par ses tests.

---

## 9. Découpage

Six commits, conventionnels, dans cet ordre.

| # | Commit | Contenu | Ticket |
|---|---|---|---|
| 1 | `docs: matrice de scénarios et seuils Phase 0` | §4 seul, aucun code | LUM-552 |
| 2 | `feat(sfu): échantillonner les statistiques str0m` | §5.1, §5.2, §5.3 — `TrackSample` et `PeerSample` produits | LUM-553 |
| 3 | `feat(telemetry): échantillons par leg` | §5.4 + migration `0002` | LUM-553 |
| 4 | `feat(telemetry): export de campagne et câblage Postgres` | §5.5, §5.6 | LUM-553 |
| 5 | `bench(sfu): coût de l'instrumentation` | §5.8 | LUM-553 |
| 6 | `docs: réconcilier CONTRIBUTING, CONTEXT et README` | §6 | LUM-553 |

Le commit 1 est indépendant et livrable seul. Les commits 2 à 4 forment le cœur de LUM-553 ; 5 et 6 le ferment.

Avant chaque PR : `cargo test`, `cargo clippy --all-targets`, `cargo fmt`, plus la vérification 60 secondes.

---

## 10. Fichiers

**Nouveaux**

- `docs/phase-0/scenario-matrix.md`
- `apps/sfu/src/transport/sampler.rs`
- `apps/sfu/src/telemetry/ring.rs`
- `apps/sfu/src/telemetry/tee.rs`
- `apps/sfu/migrations/0002_leg_samples.sql`

**Modifiés**

- `apps/sfu/src/transport/peer_connection.rs` — `set_stats_interval`, `rx_clock`, `allocated_by_mid`
- `apps/sfu/src/transport/event_loop.rs` — bras d'événements de statistiques, possède le `Sampler`
- `apps/sfu/src/transport/mod.rs` — export du module
- `apps/sfu/src/config.rs` — commentaire rendu vrai
- `apps/sfu/src/app.rs`, `apps/sfu/src/main.rs` — sélection du sink, `spawn_writer`
- `apps/sfu/src/telemetry/{mod,entry,batch,pg,sink}.rs` — `LegSample`, `RingSink` remplaçant `MemorySink`
- `apps/sfu/src/http/routes.rs` — route d'export
- `apps/sfu/tests/telemetry_pg.rs` — couverture `leg_samples`
- `apps/sfu/benches/forwarding.rs` — variante sampler
- `apps/sfu/CONTEXT.md`, `CONTRIBUTING.md`, `README.md` — §6

---

## 11. Risques et pièges

| Risque | Parade |
|---|---|
| Itérateur `DashMap` tenu à travers un `await` — a déjà bloqué le serveur une fois | §5.7 : avertissement en doc comment au point d'appel |
| Tracks fantômes créés par les mids sortants | §5.4 : `LegSample` distinct, jamais `track_id(occupancy, mid_sortant)` |
| Delta négatif dans une colonne `not null` | §5.2 : `saturating_sub` systématique |
| Travail ajouté dans la boucle d'événements du peer, qui bloquerait le média | Le sampler ne fait que de l'arithmétique et une écriture non bloquante ; §5.8 le vérifie |
| Statistiques affamées par le média sur le canal partagé, sous les conditions mêmes que la campagne mesure | §5.2 bis : canal dédié, profondeur 64 |
| L'anneau grossit sans borne sur une longue campagne | Capacité fixe, éviction FIFO, testée |
| La matrice n'est pas exécutable à la main (11 h sur trois itérations) | §4.2 : exigence explicite d'automatisation portée par LUM-551 |
| La documentation rediverge dans six mois | §6 : une seule source de vérité, la sémantique vit dans les doc comments |
