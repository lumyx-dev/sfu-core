-- Paquets média jetés par le SFU lui-même, par sens et par type de média
-- (LUM-709). Deltas sur la fenêtre de l'échantillon, comme les autres colonnes.
--
-- Entrée : file transport → moteur pleine, ou payload type inconnu.
-- Sortie : file du PeerSink pleine, aucun PT chez l'abonné, ou écriture
-- refusée par str0m.
--
-- C'est ce qui rend mesurable le seuil B1b du gate Phase 0
-- (`docs/phase-0-gate.md`) : sur un flux dégradé, la seule perte qui revient
-- au SFU est celle-ci. Le détail par point de rejet est sur `/metrics`.
--
-- `default 0` : les lignes écrites avant cette migration n'ont rien compté,
-- et une colonne nullable laisserait croire à une absence de mesure.
alter table telemetry.peer_samples
  add column dropped_ingress_audio integer not null default 0,
  add column dropped_ingress_video integer not null default 0,
  add column dropped_egress_audio  integer not null default 0,
  add column dropped_egress_video  integer not null default 0;
