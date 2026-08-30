-- Schéma telemetry : identité/cycle de vie (§6.1), séries temporelles (§6.2)
-- et événements (§6.3) de la spec de conception. Appliqué au démarrage par
-- `sqlx::migrate!`, embarqué dans le binaire : pas d'étape séparée à retenir.

create schema if not exists telemetry;

-- Les types doivent être créés une seule fois : sqlx applique chaque migration
-- une fois, mais `create type` n'a pas de `if not exists`.
do $$ begin
  create type telemetry.track_kind as enum ('audio', 'video');
exception when duplicate_object then null; end $$;

do $$ begin
  create type telemetry.severity as enum ('info', 'warning', 'critical');
exception when duplicate_object then null; end $$;

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

-- Une partition par défaut sur chaque table partitionnée : sans elle, une
-- insertion dont l'horodatage sort des partitions créées échoue et fait perdre
-- tout le lot. Avec elle, la ligne atterrit dans le fourre-tout et la tâche de
-- maintenance la signale. Perdre la granularité vaut mieux que perdre la donnée.
create table telemetry.track_samples_default    partition of telemetry.track_samples    default;
create table telemetry.peer_samples_default     partition of telemetry.peer_samples     default;
create table telemetry.track_samples_1m_default partition of telemetry.track_samples_1m default;
