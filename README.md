# `sfu` — Sightline's WebRTC Selective Forwarding Unit

The media path. Everything else in this repo is downstream of what happens in this crate.

Built on [str0m](https://github.com/algesten/str0m), a sans-IO WebRTC implementation: str0m owns
the protocol state machine (ICE, DTLS, SRTP, RTCP) and hands us packets to send; this crate owns
the sockets, the rooms and the forwarding decisions. No callbacks, no C++ dependency.

> See the [root README](../../README.md) for the quick start and project status, and
> [CONTRIBUTING.md](../../CONTRIBUTING.md) for the development workflow.

---

## Module map

```
src/
├─ main.rs          Axum HTTPS server, WebSocket loop, AppState
├─ signaling/
│  └─ messages.rs   ClientMessage / ServerMessage — the JSON wire protocol
├─ room/
│  └─ manager.rs    RoomManager: DashMap<room_id, Room> + peer→room index
├─ peer/
│  ├─ connection.rs PeerConnection — one str0m Rtc + one UDP socket per peer
│  ├─ engine.rs     ForwardingEngine — routes a publisher's RTP to subscribers
│  └─ track.rs      UpTrack / DownTrack — the RTP rewrite layer
└─ metrics/
   └─ mod.rs        Lock-free atomic counters + serializable snapshot
```

Roughly 1,000 lines total. It is meant to be read.

---

## How a peer flows through the system

```
  ws connect /ws
        │
        ▼
  handle_socket()  ──── spawns ────►  PeerConnection::run()      the str0m loop
        │                                     │
        │                                     ├─► Output::Transmit  → UDP socket
        │                                     ├─► Output::Timeout   → sleep
        │                                     └─► Event::MediaData  → rtp_tx
        │                                                                 │
        ├──── spawns ────►  rtp_rx loop  ──►  ForwardingEngine::forward_rtp()
        │                                                                 │
        │                                          UpTrack::forward(packet)
        │                                                                 │
        │                                    ┌────────────┴────────────┐
        │                                    ▼                         ▼
        │                            DownTrack(peer B)         DownTrack(peer C)
        │                            rewrite SSRC/seq/ts       rewrite SSRC/seq/ts
        │                                    │                         │
        │                                    ▼                         ▼
        └──── spawns ────►  per-subscriber task  ──►  PeerConnection::write_rtp()
```

One WebSocket carries signaling. One UDP socket per peer carries media. The two never block each
other — every stage above is a separate Tokio task connected by channels.

---

## The parts that matter

### `connection.rs` — driving str0m

`PeerConnection::run` is the classic sans-IO loop: drain `poll_output()` until it yields a
`Timeout`, then `select!` on the UDP socket and that timeout, feeding whatever arrives back in
via `handle_input`. Transmits go straight out the socket; events are dispatched to
`handle_event`.

`Event::MediaData` is where media enters Sightline. The RTP timestamp is rebased to the right
clock — 90 kHz for video, 48 kHz for audio — and forwarded upward as an `RtpPacketData`.

Anything you add inside this loop stalls media for that peer. Spawn a task.

### `track.rs` — why RTP has to be rewritten

A subscriber must never see the publisher's raw RTP identifiers. Each `DownTrack` therefore owns:

| Field | Why |
|---|---|
| `ssrc` | Randomized per subscriber — a stream is identified independently on each leg |
| `sequence_number` | Monotonic *per subscriber*, so one peer's packet loss can't corrupt another's sequence space |
| `timestamp_offset` | Random offset, so the publisher's clock isn't leaked or shared |

One publisher in, *N* independent RTP streams out. A subscriber dropping mid-call is invisible to
everyone else.

### `engine.rs` — fan-out and keyframes

`ForwardingEngine` lazily creates a `DownTrack` the first time a subscriber needs one, then fans
each packet out **exactly once** — `UpTrack::forward` already iterates every `DownTrack`, so
calling it per-subscriber would send N copies to each peer.

A newly attached subscriber joins mid-stream and has no keyframe to decode from, so the engine
schedules PLIs to the publisher at 200 ms, 500 ms, 1 s and 2 s. Without them the new peer stares
at a grey rectangle until the encoder happens to emit an IDR on its own.

### `room/manager.rs` — concurrency

Rooms and the peer→room index are `DashMap`s: sharded locks, no global mutex on the join/leave
path. Empty rooms are removed as soon as their last peer leaves.

### `metrics/mod.rs` — counters

Plain `AtomicU64`s with `Ordering::Relaxed` — the media path pays essentially nothing to be
observable. `snapshot()` produces the serializable struct behind `GET /metrics`.

Today these are throughput counters (packets, bytes, keyframes, connects, disconnects). The
quality metrics that give the project its name — jitter, loss, RTT, NACK ratio — are the next
milestone; the RTCP feedback they need already flows through `PeerConnection`, nothing reads it
yet.

---

## Configuration

Very little is configurable today — that's a known gap, not a design stance.

| What | Current value | Where |
|---|---|---|
| Listen address | `0.0.0.0:3000` (HTTPS) | `main.rs` |
| TLS cert / key | `apps/sfu/localhost+1.pem` / `-key.pem` | `main.rs` |
| ICE host candidate | `127.0.0.1:<ephemeral>` | `connection.rs` |
| Log level | `debug` | `main.rs`, overridable with `RUST_LOG` |

```bash
RUST_LOG=sfu=debug,str0m=info cargo run -p sfu
```

---

## Known limitations

- **Localhost only.** The ICE host candidate is hardcoded to `127.0.0.1`, so there is no path to
  a peer outside the machine. No STUN client, no srflx candidates, no external-IP override.
- **No server-side ICE trickle.** `ServerMessage::SfuIceCandidate` exists in the protocol but is
  never sent.
- **No renegotiation.** A peer joining a room in progress doesn't trigger an SDP renegotiation;
  the bundled test client works around it by pre-allocating `recvonly` transceivers.
- **No simulcast, SVC or bandwidth estimation.** Every subscriber receives the publisher's single
  encoding at full rate.
- **No tests.** Room lifecycle and `DownTrack` rewriting are both pure enough to unit-test
  without a network — a good first contribution.

---

## Test client

`test.html` is served at `/` and is the fastest way to exercise the SFU: open it in two or more
tabs, allow the camera, and watch the tracks arrive. It talks the raw JSON protocol documented in
the [root README](../../README.md#signaling-protocol) — no SDK, ~40 lines of `RTCPeerConnection`
glue — so it doubles as the reference client implementation.
