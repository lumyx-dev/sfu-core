-- Paquets jetés par le SFU lui-même, par peer, par sens et par type de média
-- (LUM-709). En deltas sur l'intervalle d'échantillonnage, comme le reste de
-- la table. Sens entrant : ce que le peer a envoyé — file vers le moteur de
-- forwarding pleine, ou payload type absent de la config de codecs. Sens
-- sortant : ce qui lui était destiné — file d'écriture du `PeerSink` pleine.
--
-- `default 0` : les lignes déjà écrites n'ont jamais rien mesuré, mais le SFU
-- d'alors ne jetait pas moins. Zéro y signifie « non mesuré », pas « rien jeté ».

alter table telemetry.peer_samples
  add column dropped_ingress_queue_audio integer not null default 0,
  add column dropped_ingress_queue_video integer not null default 0,
  add column dropped_unknown_pt_audio    integer not null default 0,
  add column dropped_unknown_pt_video    integer not null default 0,
  add column dropped_egress_queue_audio  integer not null default 0,
  add column dropped_egress_queue_video  integer not null default 0;
