# Base de données self-hosted (`telemetry` + `app`) — Design

**Date :** 2026-08-30
**Statut :** approuvé, prêt pour le plan d'implémentation
**Sous-projet :** B′ — socle de données du dashboard d'observabilité (`apps/dashboard`)

## 1. Contexte

Le SFU est entièrement en mémoire : `DashMap` pour les rooms, cinq compteurs atomiques
globaux dans `metrics/mod.rs` pour `/metrics`. Rien n'est persisté, donc rien n'est
consultable après coup. `packages/db` existe comme scaffold vide.

Le plan `2026-08-30-sfu-multi-publisher.md` est livré (98 tests verts, clippy propre) :
`TrackKey { peer_id, mid }` existe, un peer publie N tracks, la frontière `RtpSink` est
stable. Le modèle de données du domaine ne bougera plus, ce qui rend le moment correct
pour le figer en base.

Ce document couvre **uniquement le self-hosted**. La console Cloud
(`apps/sightline-cloud`) a un modèle sans rapport — organisation, projets, environnements,
quotas, minutes-participant, factures, audit log — et garde une base séparée. Les mélanger
imposerait au self-hosted des colonnes `org_id` qui n'y veulent rien dire.

La cible fonctionnelle est la maquette `Dashboard UI.dc.html` du handoff de design :
sidebar `Overview / Rooms / Peers / Alerts / Metrics / Session replay / Signaling / Server /
Settings`, pour **une** instance identifiée `sfu-eu-3 · eu-west-3 · v0.4.1`.

## 2. Objectif

Donner au SFU une persistance optionnelle de sa télémétrie, et au dashboard une base
qu'il puisse lire directement, sans qu'aucune des deux exigences n'abîme l'autre :

- lancer le SFU seul doit rester `cargo run -p sfu --release`, sans base, sans conteneur ;
- une base de données ne doit jamais pouvoir dégrader un appel en cours.

**Critères de succès.** Sans `SFU_DATABASE_URL`, le comportement du SFU est identique à
aujourd'hui, `cargo test` compris. Avec, une session de room de 15 participants produit des
lignes interrogeables couvrant rooms, peers, tracks, échantillons et événements ; le SFU
survit à l'arrêt brutal de Postgres pendant la session sans perdre un paquet média ; et le
volume en régime permanent reste sous 2 Go pour 50 peers continus.

## 3. Périmètre

**Dans le périmètre :** le schéma `telemetry` et ses migrations Rust ; le schéma `app` et
ses migrations Drizzle ; le chemin d'écriture dans le SFU (échantillonnage, file bornée,
écriture par lots) ; la rétention par partitions et le rollup à la minute ; l'évaluation
des seuils d'alerte ; la notification live ; les définitions Drizzle dans `packages/db` et
leur verrou anti-dérive.

**Hors périmètre :** tout écran du dashboard (sous-projet B, qui consommera ce socle) ;
l'authentification elle-même — le schéma `app` réserve la place de Better Auth, on ne
configure pas Better Auth ici ; la base Cloud ; les métriques rapportées par le navigateur ;
l'agrégation multi-instances ; le session replay au sens rejeu média (les données pour le
construire sont là, l'écran ne l'est pas).

## 4. Décisions arrêtées

Dix décisions prises en brainstorming, non rouvertes par l'implémentation.

**4.1 — Le SFU écrit, le dashboard lit.** Pas de service d'ingestion intermédiaire. Le SFU
est le seul process qui connaît jitter, loss, RTT et NACK ; faire transiter ces valeurs par
un flux pour qu'un autre process les réécrive ajoute une frontière lossy sans contrepartie.

**4.2 — Une Postgres unique partagée, persistance optionnelle.** Sans `SFU_DATABASE_URL`,
le SFU tourne en mémoire pure et le Quick start du README ne change pas. Postgres n'est
requis que pour le dashboard et l'historique — moment où l'on lance déjà Next.js.

**4.3 — Séries brutes à 1 s retenues 24 h, rollup à 1 min retenu 30 j.** L'argument du
produit est de voir ce que Grafana ne voit pas ; moyenner sur 5 s effacerait précisément les
rafales de NACK et les pics de RTT qui le justifient. Fidélité sur la fenêtre de debug,
tendance au-delà. Les deux durées sont configurables.

**4.4 — Une base = une instance, mais `instance_id` dès maintenant.** Aucune UI flotte,
aucune agrégation cross-instance : c'est l'argument de vente du Cloud. Mais la colonne
discriminante est là et en tête des index, parce que l'ajouter après coup sur une table de
8 M lignes/jour est la migration qu'on regrette. La région est un label d'instance, pas un
attribut par peer — le per-peer exigerait une base GeoIP embarquée.

**4.5 — Une ligne de `rooms` est une période d'occupation, pas un nom.** Calque exact du
cycle de vie du `RoomManager`, qui crée la `Room` au premier `join` et la ramasse quand elle
se vide. Si le nom était la clé, deux réunions distinctes du même nom fusionneraient.

**4.6 — Le grain de la télémétrie est le track, pas le peer.** Jitter et loss viennent des
Receiver Reports, donc par SSRC. Moyenner le jitter audio et vidéo d'un peer produit un
nombre qui ne décrit aucun phénomène. On agrège vers le peer à la lecture ; on ne
désagrège jamais. Corollaire : le partage d'écran, second track vidéo du même peer, ne
demandera pas de migration.

**4.7 — La table `events` est typée et ne garde que le durable.** `kind` en enum, FK
nullables, `payload jsonb` ; les libellés sont rendus par le dashboard, jamais stockés.
Les candidats ICE et les PLI individuels — les deux événements les plus fréquents du
système — restent dans le flux live et deviennent des compteurs sur `track_samples`.

**4.8 — Les schémas Postgres sont la frontière de propriété, et les types TS sont
verrouillés par un test.** Un écrivain par schéma, garanti par les droits Postgres. Les
définitions Drizzle de `telemetry` sont écrites à la main et comparées à
`information_schema` par un `bun test`.

**4.9 — File bornée qui jette, comme les files média.** Le repo a déjà tranché cette
question pour le média et l'a documentée. Si Postgres met 3 s par transaction, le choix est
entre perdre des échantillons et perdre de la vidéo.

**4.10 — Aucune métrique rapportée par le navigateur.** Le `freeze` et la qualité perçue
sortent du périmètre. Sightline mesure depuis le chemin média, pas depuis un SDK client :
c'est ce qui le distingue. Extension naturelle le jour où un SDK client authentifié
existera.

## 5. Architecture

Une base, deux schémas, **un seul écrivain chacun**.

| Schéma | Écrivain | Lecteur | Migrations |
|---|---|---|---|
| `telemetry` | SFU (Rust) | dashboard, en lecture seule | `.sql` embarqués par `sqlx::migrate!`, appliquées au démarrage du SFU |
| `app` | dashboard (Drizzle, Better Auth) | SFU, en lecture seule (les seuils) | `drizzle-kit migrate` |

La frontière est tenue par les droits Postgres, pas par la discipline :

```sql
grant usage on schema telemetry to sightline_dashboard;
grant select on all tables in schema telemetry to sightline_dashboard;
grant usage on schema app to sightline_sfu;
grant select on app.alert_rules to sightline_sfu;
```

Le SFU applique ses migrations au démarrage parce que c'est le bon comportement
self-hosted : le binaire porte son schéma, il n'y a pas d'étape à retenir. Il ne crée pas
les tables de Better Auth — un binaire Rust qui migrerait le schéma d'un framework
TypeScript serait un couplage absurde.

## 6. Schéma `telemetry`

### 6.1 Identité et cycle de vie

```sql
create schema telemetry;

create type telemetry.track_kind as enum ('audio', 'video');
create type telemetry.severity   as enum ('info', 'warning', 'critical');

create table telemetry.instance (
  id          uuid primary key,
  name        text        not null unique,   -- SFU_INSTANCE_NAME, ex. 'sfu-eu-3'
  region      text        not null,          -- SFU_REGION, ex. 'eu-west-3'
  version     text        not null,          -- CARGO_PKG_VERSION
  started_at  timestamptz not null           -- dernier démarrage
);

create table telemetry.rooms (
  id           uuid primary key,
  instance_id  uuid        not null references telemetry.instance,
  name         text        not null,         -- le room_id choisi par le client
  started_at   timestamptz not null,
  ended_at     timestamptz,
  ended_reason text                          -- 'empty' | 'instance_restart'
);
create index on telemetry.rooms (instance_id, started_at desc);
create index on telemetry.rooms (instance_id, name, started_at desc);
create index on telemetry.rooms (instance_id) where ended_at is null;

create table telemetry.peers (
  id          uuid primary key,              -- le peer_id du SFU, un uuid v4 déjà
  instance_id uuid        not null references telemetry.instance,
  room_id     uuid        not null references telemetry.rooms,
  joined_at   timestamptz not null,
  left_at     timestamptz,
  close_code  integer,                       -- code de fermeture WebSocket, ex. 1006
  ice_state   text                           -- dernier état ICE connu
);
create index on telemetry.peers (room_id, joined_at);
create index on telemetry.peers (instance_id) where left_at is null;

create table telemetry.tracks (
  id           uuid primary key,
  instance_id  uuid        not null references telemetry.instance,
  peer_id      uuid        not null references telemetry.peers,
  mid          text        not null,
  kind         telemetry.track_kind not null,
  codec        text,                         -- 'opus' | 'vp8' | 'vp9' | 'h264'
  clock_rate   integer,                      -- pour convertir le jitter en ms
  published_at timestamptz not null,
  ended_at     timestamptz,
  unique (peer_id, mid)                      -- c'est TrackKey, littéralement
);
create index on telemetry.tracks (instance_id) where ended_at is null;
```

`unique (peer_id, mid)` est la traduction directe de `TrackKey`. Le schéma parle la même
langue que le domaine, ce qui rend les bugs de correspondance impossibles.

`instance_id` porte une clé étrangère sur ces tables de cycle de vie, dont le volume est
faible. Les tables d'échantillons ne l'ont pas : à 100 insertions par seconde, la
vérification référentielle est un coût récurrent pour une garantie qu'un seul écrivain rend
inutile. La colonne y reste, dénormalisée, pour porter les index (4.4).

### 6.2 Séries temporelles

```sql
create table telemetry.track_samples (
  instance_id uuid        not null,
  track_id    uuid        not null,
  at          timestamptz not null,
  bytes       bigint      not null,   -- deltas sur la fenêtre, pas des cumuls
  packets     bigint      not null,
  nacks       integer     not null,
  plis        integer     not null,
  firs        integer     not null,
  jitter_ms   real,                   -- converti depuis les unités d'horloge RTP
  loss        real,                   -- fraction 0..1
  rtt_ms      real,                   -- du dernier RTCP ; null si aucun rapport
  primary key (track_id, at)
) partition by range (at);
create index on telemetry.track_samples (instance_id, at desc);

create table telemetry.peer_samples (
  instance_id        uuid        not null,
  peer_id            uuid        not null,
  at                 timestamptz not null,
  bytes_rx           bigint      not null,  -- payload média seul
  bytes_tx           bigint      not null,
  transport_bytes_rx bigint      not null,  -- overhead transport inclus
  transport_bytes_tx bigint      not null,
  egress_loss        real,
  bwe_bps            bigint,                -- null tant que la BWE n'est pas activée
  primary key (peer_id, at)
) partition by range (at);
create index on telemetry.peer_samples (instance_id, at desc);

create table telemetry.track_samples_1m (
  instance_id uuid        not null,
  track_id    uuid        not null,
  at          timestamptz not null,         -- début de la minute
  samples     integer     not null,         -- nombre d'échantillons agrégés
  bytes       bigint      not null,         -- somme
  packets     bigint      not null,
  nacks       integer     not null,
  plis        integer     not null,
  jitter_ms_avg real, jitter_ms_max real, jitter_ms_p95 real,
  loss_avg      real, loss_max      real, loss_p95      real,
  rtt_ms_avg    real, rtt_ms_max    real, rtt_ms_p95    real,
  primary key (track_id, at)
) partition by range (at);
create index on telemetry.track_samples_1m (instance_id, at desc);
```

**`peer_samples` n'a délibérément pas de rollup.** Au-delà de 24 h, le débit d'un peer se
reconstitue en sommant les rollups de ses tracks ; `bwe_bps` et `egress_loss` ne servent
qu'au diagnostic immédiat et aucun écran ne les demande sur trente jours. Une seconde table
d'agrégat coûterait une tâche, des partitions et des tests pour une requête que personne
n'écrit.

**Les échantillons portent des deltas, pas des cumuls.** str0m rapporte des totaux depuis
le début de la connexion ; la tâche d'échantillonnage soustrait le relevé précédent. Un
delta se somme et se moyenne trivialement sur n'importe quelle fenêtre ; un cumul exige une
fonction fenêtre à chaque requête et devient faux dès qu'une ligne manque, ce qui arrivera
puisque la file jette (4.9).

**Le partitionnement n'est pas une coquetterie.** À 8,6 M lignes/jour, une purge par
`DELETE` produirait environ 100 000 suppressions par minute et un bloat que l'autovacuum ne
rattraperait pas. En partitions horaires, la purge est un `DROP TABLE` : instantané, sans
vacuum. Le rollup est partitionné à la journée, la même mécanique s'y applique.

### 6.3 Événements

```sql
create type telemetry.event_kind as enum (
  'instance_started', 'instance_recovered',
  'room_created', 'room_ended',
  'peer_joined', 'peer_left',
  'track_published', 'track_ended',
  'ice_connected', 'ice_disconnected', 'ice_failed',
  'renegotiated',
  'threshold_breached', 'threshold_cleared'
);

create table telemetry.events (
  id          bigserial primary key,
  instance_id uuid        not null,
  at          timestamptz not null,
  kind        telemetry.event_kind not null,
  severity    telemetry.severity   not null,
  room_id     uuid, peer_id uuid, track_id uuid,   -- FK nullables selon le kind
  payload     jsonb       not null default '{}'
);
create index on telemetry.events (instance_id, at desc);
create index on telemetry.events (room_id, at desc) where room_id is not null;
create index on telemetry.events (instance_id, at desc) where severity <> 'info';
```

`message` et `detail` de la maquette sont **rendus** par le dashboard à partir de `kind` et
`payload`. Stocker des phrases anglaises condamnerait à des `like '%threshold%'` et
interdirait de filtrer « tous les échecs ICE ». `events` est retenue 30 jours comme le
rollup : c'est la table qui répond à « pourquoi la réunion d'avant-hier a mal tourné ».

## 7. Schéma `app`

```sql
create schema app;

create table app.settings (
  key   text primary key,
  value jsonb not null
);

create table app.alert_rules (
  id         uuid primary key,
  name       text    not null,
  metric     text    not null,        -- 'loss' | 'jitter_ms' | 'rtt_ms' | 'nacks'
  comparator text    not null,        -- 'gt' | 'lt'
  threshold  real    not null,
  for_secs   integer not null,        -- durée de franchissement avant déclenchement
  severity   text    not null check (severity in ('info', 'warning', 'critical')),
  enabled    boolean not null default true
);

create table app.alert_acks (
  event_id     bigint primary key,    -- l'event threshold_breached acquitté
  acked_at     timestamptz not null,
  acked_by     text
);
```

`severity` est ici un `text` contraint plutôt que le type `telemetry.severity`, à dessein :
un type partagé rendrait les migrations du dashboard dépendantes de l'ordre d'exécution —
elles échoueraient sur une base où le SFU n'a jamais tourné. Les deux schémas doivent
pouvoir se migrer indépendamment.

Better Auth ajoutera ses propres tables dans ce schéma via ses migrations. Ce document ne
les décrit pas : les configurer est hors périmètre (§3).

## 8. Ce qui n'est pas stocké

- **Le score de qualité 0–100** et la **santé d'une room** (`ok` / `degraded` / `idle`) sont
  calculés à la lecture depuis loss, jitter et rtt. C'est une politique d'affichage :
  la changer ne doit demander ni migration ni réécriture de l'historique.
- **Le `freeze`** — métrique de décodeur, invisible du SFU (4.10).
- **Les candidats ICE et les PLI individuels** — compteurs, pas des lignes (4.7).
- **Les durées et débits affichés** (`Up 2h 14m`, `2.4 Mbps`, `1.29 GB`) — dérivés de
  `started_at`, des deltas et des sommes.

## 9. Chemin d'écriture dans le SFU

```
forward_rtp (chemin chaud)        compteurs atomiques en mémoire, aucune I/O
                                  ─────────────────────────────────────────
Event::MediaIngressStats (1 s) ─┐
Event::MediaEgressStats  (1 s) ─┼─→ tâche d'échantillonnage ──→ file bornée ──┐
Event::PeerStats         (1 s) ─┘   (deltas, conversion ms)   (jette si pleine) │
                                                                                ▼
                                                       tâche d'écriture : un COPY / seconde
```

Ces trois événements n'arrivent aujourd'hui jamais : `peer_connection.rs:86` construit
`Rtc::builder().build(...)` sans `set_stats_interval`, ce qui désactive les statistiques
dans str0m. Les activer avec `set_stats_interval(Some(Duration::from_secs(1)))` suffit à
produire, **par `mid`**, `bytes`, `packets`, `firs`, `plis`, `nacks`, `jitter`, `rtt` et
`loss`. Le milestone « métriques de qualité » du README n'est donc pas un parseur RTCP à
écrire.

Trois propriétés non négociables :

- **Le chemin chaud n'écrit rien.** `forward_rtp` reste synchrone et sans allocation, comme
  l'exige le plan multi-publisher.
- **La file est bornée et jette** (4.9). Un lot perdu incrémente
  `telemetry_batches_dropped`, exposé sur `/metrics`, et log **une fois par rafale** —
  jamais une fois par lot, comme les files média.
- **La perte de connexion n'est pas une avarie.** Le SFU repasse en mode sans persistance,
  retente en arrière-plan. Ce mode est déjà un chemin de code supporté et testé par 4.2.

**Reprise au démarrage.** Le SFU ferme les `rooms`, `peers` et `tracks` de son instance
restés ouverts, avec `ended_reason = 'instance_restart'`, et écrit un event
`instance_recovered`. Sans ça, un arrêt brutal laisse des sessions éternellement
« actives », et tous les écrans mentent.

**Tâches de fond**, toutes en tokio, aucune ne dépendant d'un cron système — un self-hosted
qui exige un cron est un self-hosted cassé :

| Tâche | Période | Rôle |
|---|---|---|
| échantillonnage | 1 s | deltas, conversion du jitter en ms, mise en file |
| écriture | 1 s | un `COPY` par lot, une transaction |
| rollup | 1 min | agrège la minute écoulée dans `track_samples_1m` |
| maintenance | 10 min | crée les partitions à venir, `DROP` celles sorties de la fenêtre, purge `events` au-delà de `SFU_RETENTION_ROLLUP` |
| seuils | 1 s | évalue `app.alert_rules`, écrit les events de franchissement |

## 10. Alertes

`app.alert_rules` est écrite par le dashboard. Le **SFU les lit et les évalue** : il est le
seul à disposer de la donnée seconde par seconde. Un franchissement maintenu pendant
`for_secs` produit un event `threshold_breached` ; le retour sous le seuil produit un
`threshold_cleared`.

Le dashboard dérive les alertes ouvertes de `events` + `alert_rules`, et ne stocke que les
**acquittements** dans `app.alert_acks`. Personne n'écrit dans le schéma de l'autre, ce qui
préserve la règle d'un écrivain par schéma (4.8).

## 11. Live

Le SFU émet `NOTIFY sightline_live` après chaque lot écrit, avec une charge utile minimale
(les `room_id` touchés). Le dashboard `LISTEN` et invalide son cache.

Les valeurs seconde par seconde continuent d'arriver au navigateur par le flux WebSocket du
SFU : conformément à 4.3, **le live ne lit jamais la base**. `NOTIFY` sert à rafraîchir
l'historique et les listes, pas à transporter des métriques.

## 12. Côté TypeScript

`packages/db` cesse d'être un scaffold et expose :

- le client Drizzle et sa configuration de pool ;
- les définitions Drizzle du schéma `app` — dont il est propriétaire, migrations comprises ;
- les définitions Drizzle du schéma `telemetry`, **en lecture seule**, écrites à la main ;
- les requêtes de lecture partagées (rooms actives, peers d'une room, série d'un track sur
  une fenêtre), pour que les écrans du sous-projet B n'écrivent pas de SQL.

**Le verrou anti-dérive** est un `bun test` qui se connecte à une base migrée et compare,
colonne par colonne et type par type, les définitions `telemetry` avec
`information_schema.columns`. Il rougit à la seconde où une migration Rust ajoute, renomme
ou retype quoi que ce soit. C'est un test lisible plutôt qu'une dépendance de codegen sur le
chemin du build — cohérent avec un repo qui teste le routage RTP par un trait plutôt que par
de la magie.

## 13. Configuration

Préfixe `SFU_`, comme toutes les variables existantes (`config.rs`). Chaque défaut
reproduit le comportement actuel.

| Variable | Défaut | Rôle |
|---|---|---|
| `SFU_DATABASE_URL` | *(vide)* | Absente : aucune persistance, comportement actuel |
| `SFU_INSTANCE_NAME` | hostname | Nom affiché de l'instance |
| `SFU_REGION` | `local` | Label de région de l'instance |
| `SFU_SAMPLE_INTERVAL` | `1s` | Cadence d'échantillonnage et `set_stats_interval` |
| `SFU_RETENTION_RAW` | `24h` | Fenêtre des tables brutes |
| `SFU_RETENTION_ROLLUP` | `30d` | Fenêtre du rollup et des events |
| `SFU_TELEMETRY_QUEUE` | `256` | Profondeur de la file de lots avant rejet |

## 14. Tests

La persistance passe par un trait `Store`, avec une implémentation en mémoire — exactement
le motif de `RtpSink`, qui permet déjà de tester le routage RTP sans socket ni runtime
async.

| Niveau | Sans Postgres | Ce qui est couvert |
|---|---|---|
| Unitaire | oui | calcul des deltas, conversion du jitter en ms, évaluation des seuils, rejet quand la file est pleine, fenêtres de rétention |
| Intégration | non | application des migrations, reprise au démarrage, `COPY` par lots, création et purge des partitions |
| Verrou de schéma | non | `bun test` comparant Drizzle et `information_schema` |

Deux contre-épreuves à écrire explicitement, dans l'esprit de celles du plan
multi-publisher : couper Postgres pendant une session de 15 participants ne doit produire
aucune perte de paquet média et faire monter `telemetry_batches_dropped` ; et démarrer sur
une base contenant des rooms ouvertes doit toutes les fermer en `instance_restart`.

## 15. Risques et points de vigilance

**Le jitter de str0m est en unités d'horloge RTP**, pas en millisecondes. La conversion
demande le clock rate du codec (48 000 pour Opus, 90 000 pour la vidéo), disponible via
`PayloadParams`. Se tromper produit des valeurs fausses d'un facteur ~2 sans que rien ne
plante — c'est le défaut le plus probable de cette implémentation, et il mérite son test.

**`rtt` et `loss` sont des `Option`.** Ils viennent du dernier rapport RTCP reçu ; tant
qu'aucun n'est arrivé, ils sont absents. Les colonnes sont nullables et le dashboard doit
afficher un tiret cadratin, jamais un zéro — un zéro de RTT se lirait comme une connexion
parfaite.

**Les partitions doivent exister avant l'écriture.** Une insertion dans une plage non
couverte échoue. La tâche de maintenance crée avec plusieurs heures d'avance, et le
démarrage crée l'heure courante avant que la tâche d'écriture ne démarre.

**Le volume annoncé suppose audio + vidéo par peer.** Un partage d'écran généralisé ajoute
un troisième track par peer et donc 50 % de volume. La fenêtre brute étant configurable,
c'est un réglage, pas une refonte.

**`apps/sightline-cloud` est un dépôt git imbriqué** non déclaré comme sous-module, et il
apparaît modifié dans `git status` depuis le début. Ce document n'y touche pas, mais il
faudra trancher avant le sous-projet C.

**La dette assumée :** aucun écran ne consomme ce socle à la fin de ce sous-projet. La
vérification passe donc par les tests et par des requêtes SQL, pas par une capture d'écran.
C'est le prix de construire le socle avant l'UI, et c'est le bon ordre : le sous-projet B
serait autrement bâti sur des données inventées.
