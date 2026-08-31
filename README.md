<h1 align="center">lumyx 🔭</h1>

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
           │                │      lumyx SFU           │              ┌─────────────────┐
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

lumyx is built the other way round: the forwarding engine and the metrics pipeline are the
same codebase. Every packet that crosses the SFU is a data point you can query.

Three reasons to look at it:

- **Rust, sans-IO.** Media handling sits on [str0m](https://github.com/algesten/str0m) — no
  callbacks, no C++ dependency, no GC pause in the middle of a video frame.
- **Observability is a first-class feature**, not a `/metrics` afterthought.
- **The RTP router is unit-testable.** The media layer talks to a `RtpSink` trait, never to the
  transport — so packet routing is tested with an in-memory sink: no socket, no DTLS handshake,
  no async runtime. 68 tests run in 0.03s. That is rare in SFU codebases, and it is why this one
  is safe to change.

---

## Project status

Be honest with your infra decisions — here is what actually runs today.

| | Status | Notes |
|---|---|---|
| ICE / DTLS / SRTP handshake | ✅ Works | via str0m, one `Rtc` + UDP socket per peer |
| WebSocket signaling | ✅ Works | JSON protocol, documented below |
| Room management | ✅ Works | concurrent (`DashMap`), auto-GC of empty rooms |
| RTP forwarding (audio + video) | ✅ Works | scoped per room; ~3 µs/packet at 50 peers |
| Test coverage | ✅ 68 tests | routing tested without a network, plus a bench on the hot path |
| Counter metrics endpoint | ⚠️ Partial | `rooms`, `peers`, connects and disconnects are live; the packet, byte and keyframe counters are defined but never incremented |
| Keyframe requests (PLI) | ⚠️ No-op | the PLI escalator runs, but `rx_ssrcs` is no longer populated since the move to `Event::MediaData`, so nothing is sent |
| SSRC / seq / timestamp rewrite | ⚠️ Inert | computed by `DownTrack`, then discarded — str0m's `Writer::write()` regenerates the RTP header. Kept because it is needed again in `rtp_mode` |
| Public / NAT deployment | ⚠️ Not yet | `SFU_ICE_HOST` sets the advertised host, but there is no STUN client and no srflx discovery |
| Simulcast, SVC, bandwidth estimation | ❌ Planned | every subscriber gets the publisher's single encoding at full rate |
| Quality metrics (jitter, loss, RTT, NACK) | ❌ Planned | the whole point of the project — next milestone |
| Real-time dashboard | ❌ Scaffold | `apps/dashboard` is a bare Next.js app |
| Session replay, alerting | ❌ Planned | |

The ⚠️ rows are worth reading before you benchmark anything: three of the five `/metrics`
counters are wired to nothing, and video recovery after a subscriber joins currently depends on
the encoder emitting an IDR on its own. Both are tracked in
[`apps/sfu/CONTEXT.md`](apps/sfu/CONTEXT.md).

---

## Quick start

You need [Rust](https://rustup.rs/) and [mkcert](https://github.com/FiloSottile/mkcert).
The SFU serves HTTPS because browsers refuse `getUserMedia` and WebRTC on plain HTTP.

```bash
git clone git@github.com:FrekiManagarm/lumyx.git
cd lumyx
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
🚀 lumyx SFU démarrage...
✅ Serveur HTTPS sur https://localhost:3000
```

Open **https://localhost:3000** in two browser tabs. The server ships a test client at `/` —
grant camera access in both and you should see each tab rendering the other's video, forwarded
through the SFU.

### Endpoints

| Route | What it does |
|---|---|
| `GET /` | Built-in test client (`apps/sfu/assets/test.html`), mounted only when `SFU_SERVE_TEST_CLIENT` is on |
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
    "rtp_packets_forwarded": 0,
    "bytes_forwarded": 0,
    "keyframe_requests": 0,
    "peers_connected": 5,
    "peers_disconnected": 2
  }
}
```

Those three zeros are not a quiet call. `rooms`, `peers`, `peers_connected` and
`peers_disconnected` are live; `record_rtp` and `record_keyframe` exist but are never called from
the media path, so their counters stay at zero however much traffic you push. Wiring them up is
the first half of the metrics milestone.

### Configuration

Everything is set by environment variable, and every default reproduces the previously
hardcoded behaviour.

| Variable | Default | What it does |
|---|---|---|
| `SFU_BIND_ADDR` | `0.0.0.0:3000` | HTTPS listen address |
| `SFU_CERT_PATH` | `apps/sfu/localhost+1.pem` | TLS certificate (PEM) |
| `SFU_KEY_PATH` | `apps/sfu/localhost+1-key.pem` | TLS private key (PEM) |
| `SFU_ICE_HOST` | `127.0.0.1` | Host advertised in local ICE candidates |
| `SFU_LOG` | `debug` | `tracing-subscriber` filter |
| `SFU_SERVE_TEST_CLIENT` | `true` | Serve the bundled test client on `/` — turn it off in production |

```bash
SFU_LOG=sfu=debug,str0m=info SFU_SERVE_TEST_CLIENT=false cargo run -p sfu --release
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

Three stacked layers, plus shared state. Each one only knows about the one below it.

```
signaling/    WebSocket JSON protocol, session lifecycle
    ↓
media/        RTP routing — knows only the RtpSink trait
    ↓
transport/    WebRTC + UDP (str0m) — one connection per peer
```

```
apps/sfu/src/
├─ main.rs        Bootstrap, ~30 lines
├─ lib.rs         Crate root — this is what makes integration tests possible
├─ config.rs      Config, overridable via SFU_*
├─ app.rs         AppState + build_router
├─ http/          Service routes, WebSocket upgrade
├─ signaling/     messages (protocol) · session (lifecycle) · dispatch
├─ media/         engine (forwarding) · up_track / down_track · sink (trait) · packet
├─ transport/     peer_connection (str0m) · event_loop · sink (PeerSink)
├─ room/          Room · RoomManager · RoomPeer
└─ metrics/       Lock-free atomic counters
```

**The media ↔ transport boundary is the design decision worth stealing.** `media/` never depends
on `transport/`. The forwarding engine only ever holds `Arc<dyn RtpSink>`:

```rust
pub trait RtpSink: Send + Sync {
    fn write_rtp(&self, packet: RtpPacketData);
    fn request_keyframe(&self);
}
```

In production that's `transport::PeerSink`. In tests it's an in-memory sink — which is how RTP
routing gets tested with no socket, no DTLS handshake and no async runtime at all.

Two more properties that matter under load:

- **Forwarding is scoped per room.** The engine indexes sinks as `room_id → (peer_id → sink)`, so
  fan-out walks one room's members rather than the whole server. It used to broadcast to every
  connected peer — two simultaneous meetings could see each other.
- **Media queues drop, they don't accumulate.** Both hot-path queues are bounded at 128 packets
  and use `try_send`. Full means the packet is dropped, deliberately: a 300 ms-old video packet
  has no value, and buffering it costs memory and latency without ever catching up. Drops are
  counted and logged once per burst, never once per packet.

The full architecture write-up, including the known-issues list, lives in
[`apps/sfu/CONTEXT.md`](apps/sfu/CONTEXT.md).

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
- [x] Layered architecture with a testable media boundary — 68 tests, bench on the hot path
- [x] Room-scoped forwarding, bounded media queues, configuration via `SFU_*`
- [ ] Wire the existing counters to the media path (`record_rtp`, `record_keyframe`, drops)
- [ ] Restore working keyframe requests — `rx_ssrcs` is no longer populated
- [ ] Per-peer quality metrics (jitter · loss · RTT · NACK ratio)
- [ ] ICE for real deployments (STUN client, srflx candidates)
- [ ] Prometheus exporter + live WebSocket metrics stream
- [ ] Real-time dashboard
- [ ] Simulcast + bandwidth estimation
- [ ] Automatic degradation detection & alerting
- [ ] Session replay
- [ ] Docker image + Helm chart

---

## Contributing

lumyx is early — which is the best moment to shape it. Bug reports, protocol nitpicks and
"your fan-out is wrong because…" issues are all genuinely welcome.

```bash
cargo test && cargo clippy --all-targets
```

Good first areas: wiring the metrics counters to the media path, restoring working keyframe
requests, RTCP parsing for the quality-metrics milestone, or a STUN client so the SFU can serve
peers beyond localhost.

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
