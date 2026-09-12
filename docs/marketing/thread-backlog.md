# Thread backlog

Never start from a blank page. Every topic below comes from work actually done on the
SFU, and every one has its angle and its conclusion already written — a thread without
a conclusion doesn't get read twice.

**14 topics · 5 failures · 3 open problems.** Roughly three months of weekly cadence
in reserve.

Sourced from `apps/sfu/CONTEXT.md`, the commit history, and the code as it stands on
2026-09-12. Add a topic after every notable dev session — the stock is what absorbs a
bad week, so it has to grow at least as fast as it's consumed. Tracks `LUM-619`.

Format: `**Title** · type · visual needed?` then angle, then conclusion.

---

## 1 · Two publishers, one m-line, and a screen full of macroblocks

**Failure · needs a visual** (screen capture of the corrupted tile — recapture by
reintroducing the bug, it's a two-line revert)

**Angle.** At two participants everything worked. At three, one tile turned to
macroblock soup. I assumed a bandwidth problem — three encoders, one uplink — and
spent the evening looking at bitrates. The real cause was that I was reusing the
publisher's `mid` to address the subscriber's outgoing m-line, and every browser
numbers its m-lines identically: `0` for audio, `1` for video. A publisher's `mid`
designates nothing globally unique. Two publishers were landing in the same outgoing
m-line, arriving at the browser as one RTP stream carrying two interleaved encodings,
and the decoder made exactly what you'd expect of it.

**Conclusion.** A subscriber needs one m-line per source track — that's the central
invariant, and the only one whose violation doesn't show up in the logs. It shows up
on screen. Hence `TrackKey = (peer_id, mid)` as the identity of a published track, and
a `DownTrack` that stamps the mid allocated on the *subscriber's* connection.

**Why it opens the series.** Strongest visual of the whole backlog, the wrong
hypothesis is one anyone would have made, and the root cause is genuinely surprising.

---

## 2 · The DashMap iterator that wedged the entire server

**Failure · code excerpt**

**Angle.** Symptom: peers connect, join a room, and nothing gets wired any more. No
error, no panic, no log. Only a restart fixes it. The cause was a `DashMap` iterator
held across an `await` in the negotiation path. An iterator holds its shard's lock;
`Negotiator::unregister`, called when a session tears down, asks for the write lock on
the same shard. They met. The negotiation task — a single task, serving the whole
server — blocked forever.

**Conclusion.** Sharded locks don't remove deadlocks, they make them rarer and
therefore harder to reproduce. The fix is `snapshot_except`: copy what you need, drop
the iterator, then await. Two regression tests pin it down —
`a_room_emptying_does_not_wedge_the_negotiation_task` and
`a_departure_does_not_wedge_the_negotiation_task`.

---

## 3 · Every keyframe request was a no-op, silently, for weeks

**Failure · code excerpt**

**Angle.** Moving from `rtp_mode` to str0m's media mode broke PLI without a single
error. `Event::MediaData` doesn't expose SSRCs, so the `rx_ssrcs` list the old
implementation iterated over stayed empty — the loop ran, found nothing, sent nothing,
logged nothing. Video recovery after a subscriber joined worked only when the encoder
happened to emit an IDR on its own, which looks like "sometimes slow to appear"
rather than "broken".

**Conclusion.** The worst bugs aren't the ones that crash, they're the ones that turn
a code path into a no-op while leaving every surrounding metric green. Fix: address
PLI by mid (`direct_api().stream_rx_by_mid(mid, None)`), which is what media mode
actually gives you. Bonus lesson: a counter that only ever increments never tells you
the thing it counts did nothing.

---

## 4 · Two meetings in the same server could see each other

**Failure · needs a visual** (two rooms, one leaking tile)

**Angle.** Forwarding wasn't scoped to a room. The engine fanned out to every
connected peer, so two simultaneous meetings on the same server received each other's
media. Found at three participants across two rooms — never at two, never at one.

**Conclusion.** Fixed by indexing sinks per room (`room_id → (peer_id → sink)`), which
also means fan-out walks one room's members instead of the whole server. The part
worth generalising: the boundary is now **verified in `subscribe`**, not merely
respected by callers. `subscribe` is the only door into the routing table, and a
stream crossing a room is a leak, not a routing bug — so the check belongs at the
door, not in the convention.

---

## 5 · The private key in the git history

**Failure · no visual**

**Angle.** `localhost+1-key.pem` was a committed private key. A dev certificate for
localhost, so the blast radius is essentially nil — but the habit is the problem, and
"it's only a dev key" is exactly the sentence people say about the one that wasn't.

**Conclusion.** Untracked, `*.pem` and `*.key` ignored, each dev generates their own
with `mkcert`. And the honest part: **it's still in the history.** A `git filter-repo`
is still to be done. Publishing an unfinished remediation is more useful than
publishing a clean one — it's what the state actually is.

---

## 6 · The payload type isn't portable, and forwarding it as-is is a subtle lie

**Decision · code excerpt**

**Angle.** Two peers each negotiate their own payload type for the same codec. Peer A
may call VP8 `96` while peer B reserved `96` for H.264. An SFU that forwards the PT
untouched is labelling a VP8 payload with the number the subscriber assigned to
H.264 — and the failure is a decoder producing nothing, with a perfectly valid-looking
RTP header.

**Conclusion.** `RtpPacketData` carries the publisher's `PayloadParams`, and writing
asks str0m for the PT designating the same codec on the subscriber's m-line
(`Writer::match_params`). A generalisable point about media forwarding: almost nothing
in an RTP header is globally meaningful. It's all scoped to one negotiated session.

---

## 7 · Bounded queues that drop instead of accumulating

**Decision · graph or numbers**

**Angle.** Both media-path queues are bounded at 128 packets and use `try_send`. Full
means the packet is dropped, deliberately. The reasoning is arithmetic: at ~150
packets/s for 1080p video, 128 packets are ~850 ms of media for a single source — less
on the sink side, whose queue is shared by all publishers in the room (~425 ms at two,
~210 ms at four). The ceiling sits above one keyframe burst, because a 1080p IDR
fragments over roughly a hundred MTU-sized packets and a scheduling hiccup must not
truncate it.

**Conclusion.** On real-time media, a buffer that grows is a bug, not a safety margin.
A 300 ms-old video packet has no value; holding it costs memory and latency and never
catches up. What matters is that dropping is never silent — `PeerSink::dropped_packets()`
is an atomic counter, and each burst is logged once, not once per packet.

---

## 8 · Testing an SFU's RTP routing with no socket, no DTLS and no async runtime

**Decision · code excerpt**

**Angle.** `media/` never depends on `transport/`. The forwarding engine only ever
holds `Arc<dyn RtpSink>` — a two-method trait. In production that's `PeerSink`; in
tests it's an in-memory sink. Which means RTP routing is tested with no socket, no
DTLS handshake, no async runtime at all. **147 tests in 3.56 s.**

**Conclusion.** This is the single design decision worth stealing from the codebase,
and it's what makes the project safe to change by someone who isn't its author — which
is most of the answer to "solo project, what happens when you lose interest?". Doubles
as the credibility thread when the objection shows up.

---

## 9 · Serialising negotiation into one task, and the timeout that keeps it honest

**Decision · diagram**

**Angle.** Subscribing isn't a routing decision, it's an SDP round-trip — so the
synchronous, non-waiting forwarding path can't own it. One task consumes negotiation
events in series. The hard rule is one offer in flight per peer: str0m rejects an
answer whose change id is no longer current, and serialising removes the race for that
slot entirely rather than defending against it.

**Conclusion.** The near-miss is the interesting half. That task negotiates for the
whole server, so an unbounded `send().await` would let a single peer that stopped
reading its signaling channel freeze subscriptions for everyone else. Hence
`OFFER_SEND_TIMEOUT`. Serialising a shared resource is cheap and correct — right up
until one participant can hold the queue.

---

## 10 · `Arc<str>` on the hot path, `String` everywhere else

**Decision · code excerpt**

**Angle.** `peer_id` travels as `Arc<str>` from `http/ws` down to `media/engine`: it's
immutable and rides along with every received packet, so cloning it has to be a
refcount bump, not an allocation. `room_id` stays a `String` — it's only touched at
transitions, and paying for an `Arc` there buys nothing. The detail that makes it
painless: `Arc<str>: Borrow<str>`, so `DashMap` lookups by `&str` work with no
conversion.

**Conclusion.** Short, concrete, and squarely aimed at the Rust audience. The general
point is choosing the ownership strategy per access frequency rather than picking one
for the whole codebase.

---

## 11 · Why an SFU tested at two participants is an SFU you haven't tested

**Methodology · needs a visual** (5 headless Chromes side by side)

**Angle.** A lot of SFU logic degenerates at N=2 to "send it to the other guy", and
passes over badly broken code. Topics 1 and 4 in this backlog are both bugs that
cannot appear below three participants. Hence `bun scripts/browser-check.ts 5`, and
verification at 3, 5, 10 and 15 — in end-to-end Rust tests and in real headless
Chromes.

**Conclusion.** For anything fan-out shaped, N=2 is not a test, it's a smoke check.
Pick the smallest N at which the topology is actually a topology — and for an SFU
that's 3.

---

## 12 · One SDP round-trip too many on every peer arrival

**Open problem · no visual**

**Angle.** Audio and video are announced by two distinct `MediaAdded` events. The
first goes out as an offer, the second waits for the answer. Correct, but one offer
more than necessary on every single arrival. Briefly coalescing a peer's announcements
would save it.

**Conclusion.** Known, unfixed, and worth publishing as such. Threads about open
problems bring better replies than threads about solved ones — someone who has done
this in another SFU will say so, which is the point of participating in these
communities at all.

---

## 13 · One UDP socket per peer, and when that stops being fine

**Open problem · no visual**

**Angle.** Every peer gets its own UDP socket. It works, it's simple, and production
SFUs don't do it — they demultiplex on a single socket per ICE ufrag. Honest thread
about a simplification that's fine at the current scale and won't survive the next
one.

**Conclusion.** Good material for asking an experienced audience where exactly the
ceiling sits. Pairs naturally with a follow-up once the change is actually made.

---

## 14 · Choosing str0m, and what sans-IO costs you

**Decision · no visual**

**Angle.** Media handling sits on str0m: no callbacks, no C++ dependency, no GC pause
in the middle of a video frame. The cost side is rarely written down. Running in media
mode rather than `rtp_mode` means str0m regenerates the RTP header — so the SSRC,
sequence and timestamp rewrite `DownTrack` computes is discarded. It's kept in the
code because `rtp_mode` needs it back, which is a design bet stated out loud rather
than dead code.

**Conclusion.** Sans-IO buys testability — topic 8 is the direct consequence — and
costs control over the wire format. Worth saying which trade you took and why,
including the part that hasn't paid off yet.

---

## Feeding the backlog

The stock is the defence against a broken cadence, so it has to grow at least as fast
as it's consumed. After every notable dev session, add a line — title, angle,
conclusion, and whether a visual is needed.

**Capture the visual while doing the work.** A screenshot of a bug reconstructed after
the fix is both a lie and a wasted evening. If a topic is marked "needs a visual" and
the visual doesn't exist, either the capture is part of the work or the topic drops
down the order.

Signals that something is a topic: an hour lost to a wrong hypothesis, a metric that
lied, a bug that only appears above N participants, a decision where the rejected
option was defensible.
