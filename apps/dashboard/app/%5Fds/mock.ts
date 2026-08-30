// Donnees de maquette partagees entre les sections data (Task 8), Task 9 et Task 10 de la
// galerie /_ds. PEERS et ROOMS sont recopies verbatim depuis Dashboard UI.dc.html:268-282.
// series() est porte a l'identique depuis $DS/_ds_bundle.js:4116 (ui_kits/dashboard/mock.js) —
// c'est l'exacte fonction que les maquettes appellent (Dashboard UI.dc.html:268-282), pas une
// generation inventee : Task 9/10 doivent tracer les memes courbes que les maquettes.
export function series(n: number, seed: number, base: number, amp: number): number[] {
  return Array.from({ length: n }, (_, i) =>
    Math.max(
      0,
      +(
        base +
        amp * Math.sin(i / 2.6 + seed) +
        amp * 0.45 * Math.sin(i / 7.3 + seed * 2) +
        ((i * seed * 17) % (amp * 0.3)) -
        amp * 0.15
      ).toFixed(2),
    ),
  );
}

export interface Peer {
  peer_id: string;
  room: string;
  score: number;
  rtt: number;
  jitter: number;
  loss: number;
  nack: number;
  freeze: number;
  codec: string;
  tracks: string[];
  status: string;
  region: string;
  series: number[];
}

export const PEERS: Peer[] = [
  { peer_id: 'a3f91c02', room: 'test-room', score: 96, rtt: 38, jitter: 11, loss: 0.2, nack: 0.9, freeze: 0, codec: 'vp8', tracks: ['audio', 'video'], status: 'live', region: 'eu-west-3', series: series(30, 1, 38, 9) },
  { peer_id: '0b8e2f61', room: 'test-room', score: 88, rtt: 44, jitter: 14, loss: 0.04, nack: 1.1, freeze: 0, codec: 'h264', tracks: ['audio', 'video'], status: 'live', region: 'eu-west-3', series: series(30, 3, 44, 11) },
  { peer_id: '5e7b21f4', room: 'test-room', score: 74, rtt: 96, jitter: 22, loss: 0.81, nack: 2.4, freeze: 0.2, codec: 'vp8', tracks: ['audio'], status: 'live', region: 'eu-west-3', series: series(30, 6, 96, 18) },
  { peer_id: 'd41f9ab7', room: 'test-room', score: 41, rtt: 212, jitter: 38, loss: 3.41, nack: 6.2, freeze: 1.4, codec: 'vp8', tracks: ['audio', 'video'], status: 'degraded', region: 'us-east-1', series: series(30, 5, 190, 45) },
  { peer_id: '9c0d34aa', room: 'test-room', score: 92, rtt: 41, jitter: 9, loss: 0.11, nack: 0.7, freeze: 0, codec: 'vp9', tracks: ['audio', 'video'], status: 'live', region: 'eu-west-3', series: series(30, 8, 41, 8) },
  { peer_id: '2f81be07', room: 'test-room', score: 62, rtt: 128, jitter: 31, loss: 1.62, nack: 4.1, freeze: 0.6, codec: 'vp8', tracks: ['audio', 'video'], status: 'degraded', region: 'eu-west-3', series: series(30, 10, 130, 30) },
  { peer_id: 'ff104b2c', room: 'webinar-us', score: 18, rtt: 284, jitter: 61, loss: 7.9, nack: 11.4, freeze: 4.1, codec: 'vp8', tracks: ['audio', 'video'], status: 'degraded', region: 'ap-south-1', series: series(30, 11, 260, 60) },
  { peer_id: 'c27ad930', room: 'webinar-us', score: 92, rtt: 41, jitter: 9, loss: 0.11, nack: 0.7, freeze: 0, codec: 'vp9', tracks: ['audio', 'video'], status: 'live', region: 'eu-west-3', series: series(30, 8, 41, 8) },
];

export interface Room {
  id: string;
  peers: number;
  uptime: string;
  bitrate: string;
  region: string;
  health: string;
  state: string;
  started: string;
  data: string;
  series: number[];
}

export const ROOMS: Room[] = [
  { id: 'test-room', peers: 6, uptime: '2h 14m', bitrate: '2.4 Mbps', region: 'eu-west-3', health: 'ok', state: 'active', started: '12:46:02', data: '1.29 GB', series: series(30, 1, 2400, 340) },
  { id: 'standup-eu', peers: 4, uptime: '18m', bitrate: '812 kbps', region: 'eu-west-3', health: 'degraded', state: 'active', started: '14:42:11', data: '104 MB', series: series(30, 4, 800, 220) },
  { id: 'webinar-us', peers: 47, uptime: '52m', bitrate: '8.1 Mbps', region: 'us-east-1', health: 'ok', state: 'active', started: '14:08:37', data: '3.42 GB', series: series(30, 7, 8100, 900) },
  { id: 'pairing-fr', peers: 2, uptime: '4h 02m', bitrate: '640 kbps', region: 'eu-west-3', health: 'ok', state: 'active', started: '10:58:19', data: '812 MB', series: series(30, 2, 640, 120) },
  { id: 'load-test-9', peers: 0, uptime: '—', bitrate: '—', region: 'eu-west-3', health: 'idle', state: 'ended', started: '09:14:00', data: '2.10 GB', series: series(30, 9, 40, 30) },
  { id: 'demo-call-3', peers: 0, uptime: '31m', bitrate: '—', region: 'eu-west-3', health: 'idle', state: 'ended', started: '08:22:41', data: '286 MB', series: series(30, 5, 60, 40) },
];
