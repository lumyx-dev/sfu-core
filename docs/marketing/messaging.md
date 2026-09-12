# Messaging

The wordings below are written once and reused everywhere: X threads, README, Show HN,
docs, the landing site, SEO pages. Short evening sessions spread over weeks are exactly
the conditions under which a message drifts — rephrasing from scratch each time is how a
position turns to mush. Copy from here instead.

English is the working language of every public surface. The Linear backlog is in French;
nothing shipped to an audience is.

**Owner:** Mathieu Chambaud · **Last updated:** 2026-09-12 · Tracks `LUM-618`.

Companion files: `thread-template.md` (how to write), `thread-backlog.md` (what about),
`cadence.md` (when).

---

## The rule that governs everything below

> **No wording may promise what the README's status table marks ⚠️ or ❌.**

This is not a style preference. The landing site already broke it — it advertised
LiveKit-compatible signaling and SDKs that do not exist, because nobody had written the
constraint down. That produced an unkeepable promise plus an unverified characterisation
of a named third party's product (`LUM-701`).

Practical consequence: the claims worth making are about **architecture** and **what runs
today**, never about a roadmap. Everything in "What is true today" below is checkable by
cloning the repo. Nothing else gets asserted.

---

## The central claim

> **Skip the observability rebuild — it's already in the SFU.**

Use it verbatim. Don't improve it per-post.

Supporting line, when one is needed:

> The forwarding engine and the metrics pipeline are the same codebase.

---

## The pitch, three lengths

### One sentence

> Lumyx is an open-source WebRTC SFU written in Rust, with observability built into the
> media path instead of bolted on afterwards.

### One paragraph

> WebRTC breaks in production in ways your observability stack cannot see — Grafana
> doesn't know what jitter is, Datadog has never heard of a NACK. The SFU is the only
> process that actually knows why a call degraded, and every SFU throws that knowledge
> away. Lumyx is built the other way round: the forwarding engine and the metrics
> pipeline are the same Rust codebase, so every packet crossing the SFU is a data point
> you can query. It's alpha, and the README says exactly where the line is.

### One page

> **The problem.** Pick any low-level SFU toolkit — mediasoup, Janus, ion-sfu — and you
> get a forwarding engine and a callback surface. What you don't get is any answer to
> "why did that call go bad?" So every team builds the same thing: a metrics collector, a
> per-participant quality view, a storage layer, alert rules. Every team, every time, from
> scratch. That rebuild is weeks of work that produces no product.
>
> **The premise.** The SFU already holds the answer. It sees every RTP packet, every
> Receiver Report, every NACK and every PLI, for every participant, in real time. It
> throws all of it away because observability was never part of its job. Making it part of
> the job — not as a `/metrics` afterthought, but as a design constraint on the media
> path — is the whole project.
>
> **The consequence for the architecture.** Instrumenting every packet is only affordable
> if the media path stays small. That is why the non-goals below are permanent rather than
> deferred: no compositing, no transcoding, no inference in the media path. It's also why
> the media layer talks to an `RtpSink` trait and never to the transport — RTP routing is
> tested against an in-memory sink, with no socket, no DTLS handshake and no async
> runtime. 147 tests run in 3.6 s. That is unusual in SFU codebases, and it's what makes
> this one safe to change.
>
> **Where it stands.** Alpha, honestly. The media path works end to end between browsers —
> ICE, DTLS, SRTP, real RTP forwarding, room-scoped fan-out. The quality metrics that are
> the point of the project are the next milestone, not a shipped feature. The README
> carries a status table marking each piece ✅, ⚠️ or ❌. Read it before you benchmark
> anything.

---

## Where it sits — the honest comparison

Against **mediasoup, Janus and ion-sfu** — the reference low-level SFU toolkits. Not
against LiveKit (see "LiveKit" below).

The comparison has to run in both directions in the same breath, because the honest
version is more persuasive than the flattering one and costs nothing:

> mediasoup, Janus and ion-sfu are good at what they do, and none of them ships
> observability. You get a forwarding engine and a callback surface, then you build the
> metrics pipeline, the per-participant quality view and the alerting yourself. That
> rebuild is the part Lumyx refuses to hand back to you.
>
> The comparison runs the other way too: those three are mature, battle-tested and have
> years of production traffic behind them. Lumyx is alpha and says so. Pick accordingly.

**Never** claim they are bad, unmaintained, abandoned, slow, or badly designed. The
argument is a difference in scope, not a defect on their side. A comparison that reads as
an attack gets dismantled in the replies by people who have run those projects for years —
and they will be right.

Be precise about what "no observability" means, because it is not "no numbers at all":

- mediasoup exposes per-producer/per-consumer `getStats()`, Janus has an admin/monitor API
  and an event-handler plugin system. These are **primitives**, not an observability
  product.
- What none of them gives you: aggregation, retention, a per-participant quality view over
  time, degradation detection, alerting. That is the layer every team rebuilds.

State it that way — "they hand you raw stats primitives, you build the pipeline" — rather
than "they have no metrics," which is false and will be corrected publicly.

---

## What is true today

The credibility of everything above rests on this list being exact. Every line is
checkable by cloning the repo.

Verified against the code on 2026-09-12, not against the README — see the warning below.

**Works:** ICE/DTLS/SRTP handshake via str0m · WebSocket JSON signaling · concurrent room
management with auto-GC · audio and video RTP forwarding, scoped per room · one outgoing
m-line per source track, with renegotiation on join and leave · PLI working in both
directions · `/metrics` fed (packets, bytes, keyframes, connections) · 147 tests passing
in 3.6 s, plus a hot-path bench (~3 µs/packet at 50 peers — a bench figure, not
production) · exercised at 3, 5, 10 and 15 participants, in Rust end-to-end tests and in
real headless Chromes.

**Known and unfixed:** two SDP round-trips on each peer arrival, one more than needed ·
one UDP socket per peer, where production SFUs demultiplex per ICE ufrag · the
dropped-packet counters exist and log but don't reach `/metrics` · the old dev private key
is still in the git history pending a `git filter-repo`.

**Not built:** simulcast, SVC, bandwidth estimation · quality metrics (jitter, loss, RTT,
NACK) — the point of the project and the next milestone · public/NAT deployment (no STUN
client) · the real-time dashboard, which is a bare Next.js scaffold · session replay,
alerting.

> ⚠️ **The README's status table is stale** and understates the project: it still says 68
> tests, PLI inert and three dead `/metrics` counters. All three were fixed since. Nothing
> above may be published until the README is brought back in line — the status table is
> what every claim here points at, so it has to be the accurate document, not this one.

**Project:** MIT · single maintainer · Rust edition 2024 on str0m · questions go to GitHub
Discussions.

---

## Non-goals, in public wording

Two exclusions, both permanent. Say "permanent," never "not yet" — the ambiguity costs
more than the feature would.

> **No server-side recording or egress.** No composition, no transcoding, no MP4 writer.
> The SFU forwards packets; recording belongs in the client, or in a separate service you
> own.
>
> **No AI or voice-agent pipeline.** No speech-to-text hop, no LLM in the loop, no
> synthesised audio injected into a room.

Always ship the reason attached, because without it this reads as a limitation rather than
a design position:

> Neither is a "planned later" — they are permanent exclusions. A media path with no
> composition and no inference in it stays small enough to unit-test and cheap enough to
> instrument on every packet, which is the whole premise of the project. If you need
> either, a low-level toolkit plus a purpose-built service will serve you better, and that
> is a perfectly good answer.

Sending people elsewhere is not a loss. It buys the right to be believed on everything
else.

---

## Objections, with answers

Prepared before the first publication, because these arrive within the hour of any Show HN
or Reddit post and an improvised answer at 23:00 is how a position gets lost.

### "Why not just use mediasoup?"

> Often you should — if you need production maturity today, mediasoup is the safer
> call and I'll say so. The difference is what happens after it works. mediasoup hands you
> `getStats()` primitives; the metrics pipeline, the per-participant quality view over
> time, the degradation detection and the alerting are yours to build. I've watched that
> rebuild happen enough times to think it belongs in the SFU, where the data already is,
> instead of being reconstructed from the outside by every team in turn.

### "Is it production-ready?"

> No. It's alpha and the README has a status table saying which parts are ✅, ⚠️ and ❌ —
> and which is which. Today it forwards audio and video between browsers over real
> ICE/DTLS/SRTP, room-scoped, verified up to 15 participants. It has
> no STUN client, so it doesn't deploy past localhost yet, and the quality metrics that
> are the entire point are the next milestone rather than a feature. If you need something
> in production this quarter, use mediasoup or Janus.

Never soften this one. The status table is the single strongest asset the project has, and
it only works if the answer to this question is blunt.

### "Solo project — what happens when you lose interest?"

> Fair, and MIT plus a small codebase is most of my answer. The layered architecture is
> the rest of it: the media layer talks to an `RtpSink` trait and never to the transport,
> so RTP routing is tested with an in-memory sink — no socket, no DTLS, no async runtime,
> 147 tests in 3.6 s. That's the difference between a project someone else can pick up and
> one that dies with its author. I'm also publishing the work weekly, including what
> breaks, so the state of it is never a mystery.

### "Why not Prometheus and an exporter?"

Expect this one first from an infrastructure audience. It is the strongest objection.

> An exporter gets you counters, and counters are the easy half — Lumyx will ship a
> Prometheus exporter too. What an exporter can't do is reconstruct what it never saw. Per-
> participant jitter, loss, RTT and NACK ratio exist inside the SFU as RTCP feedback for a
> few milliseconds and are then dropped; nothing downstream can recover them, at any
> scrape interval. The argument isn't "Prometheus is wrong," it's that the SFU has to
> record the per-participant view at the moment it happens, because that's the only moment
> it exists.

### "You're reinventing what LiveKit already does"

> Different scope. LiveKit is a platform, and since the pivot its centre of gravity is
> real-time AI. Lumyx is a self-hosted SFU with observability in the media path, with no
> AI pipeline and no recording, permanently. The comparison that actually matters is
> against mediasoup, Janus and ion-sfu.

Answer briefly and move the conversation back. Don't take the bait into a feature
comparison.

---

## LiveKit

**Not a positioning reference.** It appears only as market context — "LiveKit pivoted to
real-time AI" explains why the low-level toolkits matter again — and never as a
competitor, a comparison target or a migration story.

Specifically forbidden, because all three have already shipped and had to be pulled:

- Any claim of signaling or SDK compatibility. The protocol is a bespoke JSON scheme
  documented in the README, and no LiveKit client connects to it.
- Comparative pages, nav entries or blog posts aimed at LiveKit.
- Any characterisation of their product, roadmap or pricing that isn't sourced.

---

## Vocabulary

| Use | Not |
|---|---|
| lowercase `lumyx` in prose, **Lumyx** as the product name | LUMYX, Sightline |
| "observability in the media path" | "monitoring", "analytics" |
| "low-level SFU toolkits" | "the competition", "legacy SFUs" |
| "alpha" | "early access", "beta", "v1" |
| "permanent exclusion" | "not yet", "on the roadmap" |
| "self-hosted" | "on-premise" |

Tone: an engineer showing their work to other engineers. Observed symptom, hypothesis,
what it actually was, what changed. Failures and wrong turns are the content, not an
embarrassment to be edited out — see `LUM-620` for the thread template.

Numbers always carry their conditions: "~3 µs/packet at 50 peers" is a bench figure and
says so. A number without its conditions is a claim you can't defend.

---

## Verify before first publication

Two claims in this document are repeated from general knowledge of those projects and have
not been re-checked against their current docs. Confirm both before they go out — being
corrected on a factual detail costs the credibility of the whole comparison:

- [ ] mediasoup's current `getStats()` surface, per producer and consumer
- [ ] Janus's admin/monitor API and event-handler plugin as they stand today

ion-sfu is deliberately named only in the list of reference toolkits, with no claim
attached about its activity or maintenance status.
