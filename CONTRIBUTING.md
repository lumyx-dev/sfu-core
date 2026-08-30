# Contributing to Sightline

Sightline is early. That means two things: the codebase is small enough to understand in an
afternoon, and the decisions that will matter in two years are being made right now. Both make
it a good moment to contribute.

Everything here is MIT licensed. By contributing you agree your work ships under the same terms.

---

## Getting set up

You need [Rust](https://rustup.rs/) (edition 2024, so a recent stable toolchain),
[mkcert](https://github.com/FiloSottile/mkcert), and — only for the dashboard —
[Bun](https://bun.com).

```bash
git clone git@github.com:FrekiManagarm/sightline.git
cd sightline
```

Browsers refuse `getUserMedia` and WebRTC over plain HTTP, so the SFU serves HTTPS and expects
`localhost+1.pem` / `localhost+1-key.pem` in `apps/sfu/`. Generate them once:

```bash
mkcert -install && cd apps/sfu && mkcert localhost 127.0.0.1
```

Then run the SFU:

```bash
cargo run -p sfu
```

Open **https://localhost:3000** in two tabs — the server ships a test client at `/`. Two tabs is
the minimum useful test; three or more exercises the fan-out paths where the interesting bugs
live.

Everything is configurable by environment variable — `SFU_BIND_ADDR`, `SFU_CERT_PATH`,
`SFU_KEY_PATH`, `SFU_ICE_HOST`, `SFU_LOG`, `SFU_SERVE_TEST_CLIENT`. Note that the log filter is
`SFU_LOG`, not `RUST_LOG`:

```bash
SFU_LOG=sfu=debug,str0m=info cargo run -p sfu
```

---

## Before you open a PR

```bash
cargo test                  # 68 tests, ~0.03s
cargo clippy --all-targets
cargo fmt
```

Both are currently clean — keep them that way. Don't reach for `#[allow(dead_code)]` to silence
something; if a symbol is unused, either wire it up or say why it stays in a comment.

There's also a benchmark on the media hot path:

```bash
cargo bench
```

For the TypeScript side:

```bash
bun install && bun run check-types && bun run lint
```

---

## Conventions

**Comments and log messages are in French; identifiers, types and public documentation are in
English.** That's the existing convention across the crate — follow it rather than mixing.

**Formatting** is whatever `cargo fmt` produces. Run it.

**Commits** use [Conventional Commits](https://www.conventionalcommits.org/):
`feat(sfu): ...`, `fix(engine): ...`, `docs: ...`, `refactor(peer): ...`.

**Keep PRs focused.** A media-path change and a dashboard refactor are two PRs.

---

## Working on the media path

This is where most of the value — and most of the danger — is. Read
[`apps/sfu/CONTEXT.md`](apps/sfu/CONTEXT.md) first; it is the architecture document and it keeps
an honest list of what's broken. A few things worth knowing before you touch the code:

- **Respect the layering.** `signaling/` → `media/` → `transport/`. In particular `media/` must
  never depend on `transport/`: it only ever holds `Arc<dyn RtpSink>`. That one rule is what
  makes RTP routing testable without a socket, and it is easy to destroy by accident with a
  convenience import.
- **`transport/event_loop.rs` drives str0m.** `poll_output` until it yields a `Timeout`, then
  wait on either the socket or that timeout. Work added inside that loop blocks media for that
  peer — spawn a task. And don't hold the `PeerConnection` lock across an `await`; doing so
  serializes ingress against egress, which was a real bug here.
- **Fan out once per packet.** `UpTrack::forward` already iterates every `DownTrack`. Calling it
  inside a per-subscriber loop costs S² writes instead of S — at 50 peers that was 186 µs/packet
  versus 3 µs. Fixed, but easy to reintroduce.
- **The media queues are bounded and drop on purpose.** If you find yourself making one
  unbounded to "fix" packet loss, you're trading a dropped packet for unbounded latency growth.
  Reach for the drop counter instead.
- **The payload is `Arc<[u8]>` end to end** — the buffer str0m hands you is the one that goes
  back out, shared across subscribers. Don't introduce a `.to_vec()` on the hot path.

Whatever you change here, test with **three or more peers**. Two-peer tests pass on code that is
badly broken — a lot of SFU logic degenerates to "send it to the other guy" at N=2. The
room-scoping bug (two simultaneous meetings could see each other) is exactly the kind of thing
N=2 cannot catch.

---

## Good places to start

Roughly in order of value to the project. The first three come straight from the known-issues
list in [`CONTEXT.md`](apps/sfu/CONTEXT.md):

- **Wire the metrics counters.** `Metrics::record_rtp` and `record_keyframe` exist and are
  tested, but nothing in the media path calls them — three of the five `/metrics` counters are
  permanently zero. `PeerSink` has a drop counter in the same situation. The obstacle is that
  `media/` has no access to `Metrics`, and giving it one without breaking the layering is a real
  design question, not a one-liner.
- **Restore working keyframe requests.** `request_keyframe` iterates `rx_ssrcs`, which stopped
  being populated when the code moved from `Event::RtpPacket` to `Event::MediaData` (the latter
  doesn't expose SSRCs). The PLI escalator runs and sends nothing.
- **A STUN client and srflx candidates.** `SFU_ICE_HOST` sets what gets advertised, but there's
  no discovery, so the SFU can't serve a peer outside the machine.
- **RTCP parsing for quality metrics.** Receiver Reports and NACKs flow through the SFU; nothing
  reads them. This is the milestone the project is named after.
- **Server-side ICE trickle.** `ServerMessage::SfuIceCandidate` is defined but never sent.
- **SDP renegotiation.** A peer joining a room in progress doesn't trigger renegotiation; the
  test client works around it by pre-allocating `recvonly` transceivers.
- **One UDP socket per peer.** Production SFUs demultiplex a single socket by ICE ufrag.

---

## Reporting bugs

For anything media-related, the useful report includes:

- number of peers and what each was publishing (audio, video, both)
- browser and version
- `SFU_LOG=debug` server output around the failure
- `chrome://webrtc-internals` dump if you're on Chrome — it's usually more informative than the
  server logs

"Video is frozen" with no keyframe/PLI timeline is very hard to act on; the same report with a
webrtc-internals dump is usually diagnosable in minutes.

---

## Questions

Open an issue. Protocol nitpicks, "your SSRC rewrite is wrong because…" and design objections are
all genuinely welcome — the architecture is young enough to change.
