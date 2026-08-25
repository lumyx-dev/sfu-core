# Sightline 🔭

> WebRTC observability you actually want to use.

**Sightline** is an open-source WebRTC SFU built in Rust — with real-time monitoring, session replay, and intelligent alerting baked in. Drop-in replacement for LiveKit. Self-host the core, or use Sightline Cloud.

```
Your users                  Sightline SFU (Rust)           Sightline Dashboard
──────────                  ────────────────────           ─────────────────────
Peer A ──────────────────►  Forward RTP    ──────────────► Packet loss: 0.2%
Peer B ──────────────────►  Collect metrics ─────────────► RTT: 42ms
Peer C ──────────────────►  Detect issues  ──────────────► 🔴 Peer D degrading
```

---

## Why Sightline?

WebRTC is notoriously hard to debug in production. Grafana doesn't understand jitter. Datadog doesn't know what a NACK is. When your video call degrades, you're flying blind.

Sightline sits in the middle of your media traffic and tells you exactly what's happening — in real time.

| | Sightline | LiveKit | Jitsi | Daily |
|---|---|---|---|---|
| **Language** | 🦀 Rust | Go | Java | Node |
| **Open source** | ✅ Full core | ✅ Core | ✅ | ❌ |
| **Built-in monitoring** | ✅ Native | ❌ | ❌ | ❌ |
| **Session replay** | ✅ | ❌ | ❌ | ❌ |
| **LiveKit compatible** | ✅ | — | ❌ | ❌ |
| **On-premise** | ✅ | ✅ | ✅ | ❌ |
| **Self-host cost** | 🟢 Low | 🟡 Medium | 🔴 High | — |

---

## Features

### Core SFU
- **Selective Forwarding** — forwards only what each peer needs
- **Rust performance** — ~5x lower CPU vs Go-based SFUs
- **ICE / DTLS / SRTP** — full WebRTC stack via [str0m](https://github.com/algesten/str0m)
- **Scalable rooms** — thousands of concurrent participants
- **LiveKit-compatible API** — migrate with one line of config

### Observability (what makes Sightline different)
- **Real-time metrics** — jitter, packet loss, RTT, NACK ratio, freeze ratio per peer
- **Automatic degradation detection** — know before your users complain
- **Session replay** — reconstruct any session for post-mortem analysis
- **Alerting** — Slack, email, PagerDuty integrations

---

## Quick Start

```bash
# Run with Docker
docker run -p 3000:3000 sightline/sightline

# Or build from source
git clone https://github.com/sightline/sightline
cd sightline
cargo build --release
./target/release/sightline
```

Connect your client:

```typescript
// Drop-in LiveKit replacement
import { Room } from '@sightline/client'  // same API as livekit-client

const room = new Room()
await room.connect('wss://your-sightline-instance:3000', token)
```

Check your metrics:

```bash
curl https://your-sightline-instance:3000/metrics
# {
#   "rooms": 3,
#   "peers": 12,
#   "avg_packet_loss": 0.002,
#   "avg_rtt_ms": 38,
#   "forwarded_bytes_total": 1284920384
# }
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Sightline Core                        │
│                                                         │
│  WebSocket Signaling  ──►  ICE / DTLS Handshake        │
│         │                        │                      │
│         ▼                        ▼                      │
│    Room Manager      ──►    RTP Forwarding              │
│         │                        │                      │
│         └──────────┬─────────────┘                      │
│                    │                                     │
│                    ▼                                     │
│           Metrics Collector                              │
│        (jitter, loss, RTT, NACK)                        │
│                    │                                     │
│          ┌─────────┴──────────┐                         │
│          ▼                    ▼                          │
│    /metrics API        WebSocket stream                  │
│    (Prometheus)        (real-time push)                  │
└─────────────────────────────────────────────────────────┘
                         │
              ┌──────────┘
              ▼
     Sightline Dashboard
     (open source or cloud)
```

---

## Metrics Reference

| Metric | Description | Alert threshold |
|--------|-------------|-----------------|
| `packet_loss_ratio` | % of RTP packets lost | > 2% |
| `jitter_ms` | RTP jitter in milliseconds | > 30ms |
| `rtt_ms` | Round-trip time | > 200ms |
| `nack_ratio` | % of packets requested again | > 5% |
| `freeze_ratio` | % of time video is frozen | > 1% |
| `bitrate_kbps` | Current media bitrate | < 100kbps |

---

## Roadmap

- [x] WebRTC SFU core (Rust + str0m)
- [x] ICE / DTLS / SRTP handshake
- [x] RTP forwarding between peers
- [x] Basic metrics API
- [ ] LiveKit-compatible signaling layer
- [ ] Real-time metrics dashboard
- [ ] Alerting (Slack / email / PagerDuty)
- [ ] Session replay
- [ ] Prometheus exporter
- [ ] Kubernetes helm chart
- [ ] Sightline Cloud (hosted)

---

## Pricing

| | Hobby | Starter | Pro | Enterprise |
|---|---|---|---|---|
| **Price** | Free | €49/mo | €199/mo | Custom |
| **Participant-minutes** | 10k | 100k | 1M | Unlimited |
| **Metrics retention** | 7 days | 30 days | 90 days | Custom |
| **Alerting** | ❌ | Email | Slack + PagerDuty | Custom |
| **Session replay** | ❌ | ❌ | ✅ | ✅ |
| **On-premise** | ✅ | ✅ | ✅ | ✅ |
| **Support** | Community | Email | Priority | Dedicated |

[Start free →](https://sightline.dev) · [Docs →](https://docs.sightline.dev)

---

## Contributing

Sightline is MIT licensed and built in the open.

```bash
git clone https://github.com/sightline/sightline
cd sightline
cargo test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## Built with

- [Rust](https://www.rust-lang.org/) — systems language with memory safety
- [str0m](https://github.com/algesten/str0m) — sans-IO WebRTC implementation
- [Tokio](https://tokio.rs/) — async runtime
- [Axum](https://github.com/tokio-rs/axum) — web framework
- [DashMap](https://github.com/xacrimon/dashmap) — concurrent HashMap

---

<p align="center">
  <a href="https://sightline.dev">sightline.dev</a> ·
  <a href="https://docs.sightline.dev">Docs</a> ·
  <a href="https://x.com/sightlinertc">X / Twitter</a> ·
  <a href="https://discord.gg/sightline">Discord</a>
</p>

<p align="center">
  <sub>MIT License · Made with 🦀 in Rust</sub>
</p>
