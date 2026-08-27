<h1 align="center">Sightline 🔭</h1>

<p align="center">
  <strong>A WebRTC SFU written in Rust — with observability built into the media path, not bolted on.</strong>
</p>

<p align="center">
  <img alt="status" src="https://img.shields.io/badge/status-alpha-orange">
  <img alt="rust" src="https://img.shields.io/badge/rust-edition%202024-000000?logo=rust">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="webrtc" src="https://img.shields.io/badge/WebRTC-str0m-6E4AFF">
</p>

```
  Peer A ──┐                ┌──────────────────────────┐
           │                │      Sightline SFU       │              ┌─────────────────┐
  Peer B ──┼──── RTP ──────►│  forward · rewrite · PLI │─── stats ───►│  /metrics  JSON │
           │                │        (Rust)            │              └─────────────────┘
  Peer C ──┘                └──────────────────────────┘
```

> **Alpha.** The media path works end to end — ICE, DTLS, SRTP and real RTP forwarding between
> browsers. Everything marked *planned* below is not built yet. This README tells you exactly
> where the line is, so you don't discover it after `git clone`.

---

## Why another SFU?

WebRTC breaks in production in ways your observability stack cannot see. Grafana doesn't know
what jitter is. Datadog has never heard of a NACK. When a call degrades, the SFU is the only
process in the system that actually knows why — and every SFU throws that knowledge away.

Sightline is built the other way round: the forwarding engine and the metrics pipeline are the
same codebase. Every packet that crosses the SFU is a data point you can query.

Three reasons to look at it:

- **Rust, sans-IO.** Media handling sits on [str0m](https://github.com/algesten/str0m) — no
  callbacks, no C++ dependency, no GC pause in the middle of a video frame. The whole SFU is
  ~1k lines of readable Rust you can hold in your head.
- **Observability is a first-class feature**, not a `/metrics` afterthought.
- **Small enough to hack on.** One crate, four modules, no plugin system to fight.

---

## Project status

Be honest with your infra decisions — here is what actually runs today.

| | Status | Notes |
|---|---|---|
| ICE / DTLS / SRTP handshake | ✅ Works | via str0m, one `Rtc` + UDP socket per peer |
| WebSocket signaling | ✅ Works | JSON protocol, documented below |
| Room management | ✅ Works | concurrent (`DashMap`), auto-GC of empty rooms |
| RTP forwarding (audio + video) | ✅ Works | per-subscriber SSRC / seq / timestamp rewrite |
| Keyframe requests (PLI) | ✅ Works | sent to the publisher when a subscriber attaches |
| Counter metrics endpoint | ✅ Works | packets, bytes, peers, keyframes |
| Public / NAT deployment | ⚠️ Not yet | ICE advertises a `127.0.0.1` host candidate only |
| Simulcast, SVC, bandwidth estimation | ❌ Planned | |
| Quality metrics (jitter, loss, RTT, NACK) | ❌ Planned | the whole point of the project — next milestone |
| Real-time dashboard | ❌ Scaffold | `apps/dashboard` is a bare Next.js app |
| Session replay, alerting | ❌ Planned | |

---

## Quick start

You need [Rust](https://rustup.rs/) and [mkcert](https://github.com/FiloSottile/mkcert).
The SFU serves HTTPS because browsers refuse `getUserMedia` and WebRTC on plain HTTP.

```bash
git clone git@github.com:FrekiManagarm/sightline.git
cd sightline
```

Generate the local certificates the server expects (`localhost+1.pem` / `localhost+1-key.pem`
in `apps/sfu/`). They are deliberately not versioned — each dev generates their own:

```bash
mkcert -install && cd apps/sfu && mkcert localhost 127.0.0.1
```

Run it:

```bash
cargo run -p sfu --release
```

```
🚀 Sightline SFU démarrage...
✅ Serveur HTTPS sur https://localhost:3000
```

Open **https://localhost:3000** in two browser tabs. The server ships a test client at `/` —
grant camera access in both and you should see each tab rendering the other's video, forwarded
through the SFU.

### Endpoints

| Route | What it does |
|---|---|
| `GET /` | Built-in test client (`apps/sfu/test.html`) |
| `GET /ws` | WebSocket signaling — one connection per peer |
| `GET /health` | `{ "status": "ok", "version": "0.1.0" }` |
| `GET /metrics` | JSON counters (see below) |

```bash
curl -k https://localhost:3000/metrics
```

```json
{
  "rooms": 1,
  "peers": 3,
  "metrics": {
    "rtp_packets_forwarded": 128492,
    "bytes_forwarded": 92048310,
    "keyframe_requests": 12,
    "peers_connected": 5,
    "peers_disconnected": 2
  }
}
```

---

## Signaling protocol

No SDK required — it's plain JSON over a WebSocket, tagged with a `type` field. You can drive
the SFU from a browser with `RTCPeerConnection` and ~40 lines of glue.

**Client → server**

| `type` | Payload | Purpose |
|---|---|---|
| `join` | `room_id`, `peer_id` | Enter a room |
| `sfu_offer` | `sdp` | Publish/subscribe offer to the SFU |
| `sfu_ice_candidate` | `candidate` | Trickle ICE toward the SFU |
| `leave` | — | Leave the room |
| `offer` / `answer` / `ice_candidate` | `sdp` / `candidate`, `target_peer_id` | Peer-to-peer relay path (mesh mode) |

**Server → client**

| `type` | Payload |
|---|---|
| `connected` | `peer_id` assigned by the server |
| `joined_room` | `room_id`, `peers` already present |
| `peer_joined` / `peer_left` | `peer_id` |
| `sfu_answer` | `sdp` |
| `sfu_ice_candidate` | `candidate` |
| `error` | `message` |

A minimal session:

```
client                                  server
  │  ── ws connect /ws ──────────────────►│
  │  ◄──────────── connected {peer_id} ───│
  │  ── join {room_id} ──────────────────►│
  │  ◄──────── joined_room {peers[]} ─────│
  │  ── sfu_offer {sdp} ─────────────────►│
  │  ◄──────────── sfu_answer {sdp} ──────│
  │  ── sfu_ice_candidate ───────────────►│   ICE + DTLS
  │  ◄════════════ SRTP media ═══════════►│
```

---

## Architecture

```
apps/sfu/src/
├─ main.rs          Axum HTTPS server · WebSocket loop · app state
├─ signaling/       ClientMessage / ServerMessage — the JSON protocol
├─ room/            RoomManager: DashMap<room_id, Room>, peer→room index
├─ peer/
│  ├─ connection.rs  One str0m Rtc + one UDP socket per peer.
│  │                 Owns the poll_output / handle_input loop, emits RTP upward.
│  ├─ engine.rs      ForwardingEngine: routes a publisher's RTP to every other peer.
│  └─ track.rs       UpTrack (published stream) · DownTrack (per-subscriber rewrite)
└─ metrics/         Lock-free atomic counters + JSON snapshot
```

Each module is documented in depth in [`apps/sfu/README.md`](apps/sfu/README.md) — the str0m
loop, the RTP rewrite layer, current configuration and known limitations.

The interesting part is `track.rs`. A subscriber must never see the publisher's raw RTP
identifiers — so every `DownTrack` owns a randomized SSRC, its own monotonic sequence number and
a timestamp offset. One publisher, *N* independent RTP streams out, and a subscriber dropping
mid-call can't corrupt anyone else's sequence space.

When a new subscriber attaches, `ForwardingEngine` schedules PLIs to the publisher at 200 ms,
500 ms, 1 s and 2 s — so the new peer gets a decodable keyframe instead of a grey rectangle.

### Monorepo layout

```
apps/
  sfu/          🦀 The SFU — this is the interesting part
  dashboard/    ▲  Next.js 16 dashboard (scaffold)
packages/
  auth/ config/ db/ env/ ui/   Shared TS packages (scaffolds)
```

Rust is driven by Cargo, the TypeScript side by [Turborepo](https://turborepo.com) + Bun:

```bash
bun install && bun run dev
```

---

## Roadmap

**Next up — quality metrics.** Turning RTCP feedback (Receiver Reports, NACKs, PLIs) already
flowing through the SFU into per-peer jitter, packet loss and RTT, exposed on `/metrics` and
pushed live over WebSocket.

- [x] SFU core: ICE / DTLS / SRTP, RTP forwarding, rooms
- [ ] Per-peer quality metrics (jitter · loss · RTT · NACK ratio)
- [ ] ICE candidates for real deployments (STUN, host/srflx, `EXTERNAL_IP`)
- [ ] Prometheus exporter + live WebSocket metrics stream
- [ ] Real-time dashboard
- [ ] Simulcast + bandwidth estimation
- [ ] Automatic degradation detection & alerting
- [ ] Session replay
- [ ] Docker image + Helm chart

---

## Contributing

Sightline is early — which is the best moment to shape it. Bug reports, protocol nitpicks and
"your SSRC rewrite is wrong because…" issues are all genuinely welcome.

```bash
cargo build && cargo clippy && cargo test
```

Good first areas: RTCP parsing for the quality-metrics milestone, replacing the hardcoded
`127.0.0.1` ICE candidate with proper host/srflx discovery, or handling SDP renegotiation when a
peer joins an in-progress room.

**[CONTRIBUTING.md](CONTRIBUTING.md)** covers the dev setup, conventions, and what to know before
touching the media path — in particular: test with three or more peers, because a lot of SFU
logic degenerates to "send it to the other guy" at N=2 and passes on badly broken code.

---

## Built with

[Rust](https://www.rust-lang.org/) ·
[str0m](https://github.com/algesten/str0m) (sans-IO WebRTC) ·
[Tokio](https://tokio.rs/) ·
[Axum](https://github.com/tokio-rs/axum) ·
[DashMap](https://github.com/xacrimon/dashmap) ·
[Next.js](https://nextjs.org/) ·
[Turborepo](https://turborepo.com)

---

## License

[MIT](LICENSE) © Mathieu Chambaud

---

<p align="center">
  <sub>Made with 🦀</sub>
</p>
