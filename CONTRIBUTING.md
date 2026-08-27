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

Logs are controlled by `RUST_LOG` (the server defaults to `debug`):

```bash
RUST_LOG=sfu=debug,str0m=info cargo run -p sfu
```

---

## Before you open a PR

```bash
cargo build
cargo clippy
cargo test
```

`cargo build` must be clean of *new* warnings. There are pre-existing dead-code warnings for
protocol variants that aren't wired up yet — don't silence them with `#[allow(dead_code)]`,
they're a to-do list.

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

This is where most of the value — and most of the danger — is. A few things worth knowing before
you touch `apps/sfu/src/peer/`:

- **`connection.rs` owns one `Rtc` and one UDP socket per peer.** The `run` loop drives str0m:
  `poll_output` until it yields a `Timeout`, then wait on either the socket or that timeout. If
  you add work inside that loop, it blocks media for that peer — spawn a task instead.
- **`track.rs` rewrites RTP identifiers per subscriber.** Every `DownTrack` has its own random
  SSRC, its own monotonic sequence counter and its own timestamp offset. A subscriber must never
  observe the publisher's raw values, and one subscriber's state must never leak into another's.
- **`engine.rs` fans out exactly once per packet.** `UpTrack::forward` already iterates every
  `DownTrack`; calling it inside a per-subscriber loop sends N copies to each peer. This bug is
  invisible with two peers and destroys the call with four.

Whatever you change here, test with **three or more peers**. Two-peer tests pass on code that is
badly broken — a lot of SFU logic degenerates to "send it to the other guy" at N=2.

---

## Good places to start

Roughly in order of value to the project:

- **RTCP parsing for quality metrics.** Receiver Reports, NACKs and PLIs already flow through the
  SFU; nothing reads them yet. Turning them into per-peer jitter, loss and RTT is the next
  milestone and the reason the project exists.
- **Real ICE candidates.** `PeerConnection::handle_offer` hardcodes a `127.0.0.1` host candidate,
  which is why Sightline is localhost-only today. Proper host/srflx discovery plus a STUN client
  and an `EXTERNAL_IP` override would unlock actual deployments.
- **Server-side ICE trickle.** `ServerMessage::SfuIceCandidate` is defined but never sent — the
  server never trickles its own candidates to the client.
- **SDP renegotiation.** A peer joining a room in progress doesn't trigger renegotiation; the
  test client works around it by pre-allocating `recvonly` transceivers.
- **Tests.** There are none. Room lifecycle and `DownTrack` rewriting are both pure enough to
  unit-test without a network.

---

## Reporting bugs

For anything media-related, the useful report includes:

- number of peers and what each was publishing (audio, video, both)
- browser and version
- `RUST_LOG=debug` server output around the failure
- `chrome://webrtc-internals` dump if you're on Chrome — it's usually more informative than the
  server logs

"Video is frozen" with no keyframe/PLI timeline is very hard to act on; the same report with a
webrtc-internals dump is usually diagnosable in minutes.

---

## Questions

Open an issue. Protocol nitpicks, "your SSRC rewrite is wrong because…" and design objections are
all genuinely welcome — the architecture is young enough to change.
