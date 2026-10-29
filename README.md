<p align="center">
  <img alt="Lumyx — Open-source WebRTC SFU with observability in the media path" src=".github/assets/banner.png" width="100%">
</p>

<h1 align="center">Lumyx 🔭</h1>

<p align="center">
  <strong>A WebRTC SFU written in Rust — with observability built into the media path, not bolted on.</strong>
</p>

<p align="center">
  <img alt="status" src="https://img.shields.io/badge/status-alpha-orange">
  <img alt="rust" src="https://img.shields.io/badge/rust-edition%202024-000000?logo=rust">
  <img alt="license" src="https://img.shields.io/badge/license-AGPL--3.0-blue">
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
  no async runtime; the routing tests run in milliseconds. That is rare in SFU codebases, and it is why this one
  is safe to change.

### Where it sits

mediasoup, Janus and ion-sfu are the reference low-level SFU toolkits, and they are good at what
they do. None of them ships observability. You get a forwarding engine and a callback surface,
then you build the metrics pipeline, the per-participant quality view and the alerting yourself —
every team, every time, from scratch. That rebuild is the part lumyx refuses to hand back to you.

The comparison runs the other way too: those three are mature, battle-tested, and have years of
production traffic behind them. lumyx is alpha and says so in the next table. Pick accordingly.

---

## Project status

Be honest with your infra decisions — here is what actually runs today.

| | Status | Notes |
|---|---|---|
| ICE / DTLS / SRTP handshake | ✅ Works | via str0m, one `Rtc` + UDP socket per peer |
| WebSocket signaling | ✅ Works | JSON protocol, documented below |
| Room management | ✅ Works | concurrent (`DashMap`), auto-GC of empty rooms |
| RTP forwarding (audio + video) | ✅ Works | scoped per room; ~3 µs/packet at 50 peers |
| Test coverage | ✅ 147 tests | routing tested without a network, plus a bench on the hot path |
| Counter metrics endpoint | ⚠️ Partial | `rooms`, `peers`, connects and disconnects are live; the packet, byte and keyframe counters are defined but never incremented |
| Keyframe requests (PLI) | ⚠️ No-op | the PLI escalator runs, but `rx_ssrcs` is no longer populated since the move to `Event::MediaData`, so nothing is sent |
| SSRC / seq / timestamp rewrite | ⚠️ Inert | computed by `DownTrack`, then discarded — str0m's `Writer::write()` regenerates the RTP header. Kept because it is needed again in `rtp_mode` |
| Public / NAT deployment | ⚠️ Not yet | `SFU_ICE_HOST` sets the advertised host, but there is no STUN client and no srflx discovery |
| Simulcast, SVC, bandwidth estimation | ❌ Planned | every subscriber gets the publisher's single encoding at full rate |
| Quality metrics (jitter, loss, RTT, NACK) | ❌ Planned | the whole point of the project — next milestone |
| Real-time dashboard | ❌ Scaffold | [`lumyx-dev/dashboard`](https://github.com/lumyx-dev/dashboard) is a bare Next.js app |
| Session replay, alerting | ❌ Planned | |

The ⚠️ rows are worth reading before you benchmark anything: three of the five `/metrics`
counters are wired to nothing, and video recovery after a subscriber joins currently depends on
the encoder emitting an IDR on its own. Both are tracked in
[`CONTEXT.md`](CONTEXT.md).

---

## Quick start

You need [Rust](https://rustup.rs/) and [mkcert](https://github.com/FiloSottile/mkcert).
The SFU serves HTTPS because browsers refuse `getUserMedia` and WebRTC on plain HTTP.

```bash
git clone https://github.com/lumyx-dev/sfu-core.git
cd sfu-core
```

Generate the local certificates the server expects (`localhost+1.pem` / `localhost+1-key.pem`
at the repository root). They are deliberately not versioned — each dev generates their own:

```bash
mkcert -install && mkcert localhost 127.0.0.1
```

Run it:

```bash
cargo run --release
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
| `GET /` | Built-in test client (`assets/test.html`), mounted only when `SFU_SERVE_TEST_CLIENT` is on |
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
| `SFU_CERT_PATH` | `localhost+1.pem` | TLS certificate (PEM) |
| `SFU_KEY_PATH` | `localhost+1-key.pem` | TLS private key (PEM) |
| `SFU_ICE_HOST` | `127.0.0.1` | Host advertised in local ICE candidates — the server's public IP in production |
| `SFU_UDP_PORT_MIN` / `SFU_UDP_PORT_MAX` | *(unset)* | UDP range for media sockets, one port per peer. Unset: ephemeral ports. Required to publish the SFU from a container |
| `SFU_TLS` | `true` | Terminate TLS in-process. Set to `false` behind a reverse proxy that does it |
| `SFU_LOG` | `debug` | `tracing-subscriber` filter |
| `SFU_SERVE_TEST_CLIENT` | `true` | Serve the bundled test client on `/` — turn it off in production |
| `SFU_DATABASE_URL` | *(unset)* | Postgres URL. When set, telemetry is persisted; when unset, the SFU behaves exactly as without a database |
| `SFU_INSTANCE_NAME` | hostname | Instance label attached to persisted telemetry |
| `SFU_REGION` | `local` | Region label attached to persisted telemetry |
| `SFU_SAMPLE_INTERVAL` | `1` | Telemetry sampling interval, in seconds |
| `SFU_RETENTION_RAW` | `86400` | Retention of raw samples, in seconds |
| `SFU_RETENTION_ROLLUP` | `2592000` | Retention of the 1-minute rollup and events, in seconds |
| `SFU_TELEMETRY_QUEUE` | `256` | Bounded telemetry queue depth before samples are dropped |

```bash
SFU_LOG=sfu=debug,str0m=info SFU_SERVE_TEST_CLIENT=false cargo run --release
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
src/
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
[`CONTEXT.md`](CONTEXT.md).

### Tests

```bash
cargo test
cargo clippy --all-targets
```

Three levels, from fastest to most faithful:

| Target | What it covers |
| --- | --- |
| `tests/forwarding.rs` | RTP routing without a network — the media layer only talks to the `RtpSink` trait, which the tests implement in memory |
| `tests/negotiation.rs` | The SDP dance, with a str0m `Rtc` playing the browser against a `PeerConnection` |
| `tests/room.rs` | A whole room end to end — real ICE, DTLS, SRTP and media over simulated sockets — at 3, 5, 10 and 15 participants |
| `tests/telemetry_pg.rs` | Telemetry persistence; skipped unless `SFU_TEST_DATABASE_URL` points to a Postgres instance |

And real browsers, for what str0m cannot simulate — how Chrome interprets a re-offer:

```bash
cargo run &
bun scripts/browser-check.ts 5      # 5 headless Chrome tabs in the same room
```

The script checks that each tab renders N-1 remote tiles carrying decoded video. `CHROME_BIN`
points to the binary to use.

---

## The Lumyx project

This repository is the open-source core. The rest of the project lives next door:

| Repository | What it is |
|---|---|
| [`lumyx-dev/sfu-core`](https://github.com/lumyx-dev/sfu-core) | The SFU — you are here |
| [`lumyx-dev/dashboard`](https://github.com/lumyx-dev/dashboard) | Self-hosted real-time dashboard (Next.js) |
| [`lumyx-dev/ui`](https://github.com/lumyx-dev/ui) | `@lumyx/ui`, the Lumyx design system |
| [`lumyx-dev/website`](https://github.com/lumyx-dev/website) | [lumyx.dev](https://lumyx.dev) and [docs.lumyx.dev](https://docs.lumyx.dev) |

---

## Non-goals

Two things lumyx will not do. Better to find out here than after you have integrated it.

- **No server-side recording or egress.** No composition, no transcoding, no MP4 writer. The SFU
  forwards packets; recording belongs in the client, or in a separate service you own.
- **No AI or voice-agent pipeline.** No speech-to-text hop, no LLM in the loop, no synthesized
  audio injected into a room.

Neither is a "planned later" — they are permanent exclusions. A media path with no composition
and no inference in it stays small enough to unit-test and cheap enough to instrument on every
packet, which is the whole premise of the project. If you need either, a low-level toolkit plus a
purpose-built service will serve you better, and that is a perfectly good answer.

---

## Roadmap

**Next up — quality metrics.** Turning RTCP feedback (Receiver Reports, NACKs, PLIs) already
flowing through the SFU into per-peer jitter, packet loss and RTT, exposed on `/metrics` and
pushed live over WebSocket.

- [x] SFU core: ICE / DTLS / SRTP, RTP forwarding, rooms
- [x] Layered architecture with a testable media boundary — 147 tests, bench on the hot path
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
- [x] Docker image (`ghcr.io/lumyx-dev/sfu-core`) — see [lumyx-dev/self-hosted](https://github.com/lumyx-dev/self-hosted)
- [ ] Helm chart

---

## Contributing

lumyx is early — which is the best moment to shape it. Bug reports, protocol nitpicks and
"your fan-out is wrong because…" issues are all genuinely welcome.

Questions, "does it do X?" and setup trouble go to
[**Discussions**](https://github.com/lumyx-dev/sfu-core/discussions) rather than issues — answers
there stay searchable for whoever hits the same wall next.

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
[sqlx](https://github.com/launchbadge/sqlx)

---

## License

[AGPL-3.0-only](LICENSE) © Mathieu Chambaud

### AGPL & you

The AGPL is a copyleft license with one extra clause: if you **modify** the SFU and let users
interact with your modified version **over a network**, you must offer those users the source of
your modified version.

In practice:

- **Running Lumyx unmodified** — self-hosting it as the media server behind your own product,
  internal tool or SaaS — triggers no obligation. Your application code talks to the SFU over
  WebSocket and WebRTC; it is not a derivative work and stays yours, under whatever license you
  like.
- **Modifying the SFU** and running that modified version for users over a network means you
  must publish your changes to the SFU itself, under the AGPL. Your surrounding product is
  unaffected.
- **Contributing upstream** is the easiest way to satisfy this: once your patch is merged, there
  is nothing left to publish.

This is a plain-language summary, not legal advice — the [LICENSE](LICENSE) text is what applies.

---

<p align="center">
  <sub>Made with 🦀</sub>
</p>
