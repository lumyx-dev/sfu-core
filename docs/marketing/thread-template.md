# Thread template and editorial rules

One structure, reused every week. The point is not consistency for its own sake —
it's that a blank page on a Sunday evening after a full work week is how a weekly
cadence dies. Open this file, fill the six slots, publish.

Pairs with `messaging.md` (the fixed wordings), `thread-backlog.md` (what to write
about) and `cadence.md` (when). Tracks `LUM-620`.

---

## The structure

Six beats, in this order. The order is the whole trick: the symptom goes first
because it's the only part a stranger scrolling past cares about.

**1 · The symptom — what you saw, not what was wrong**

Open on the observable. A screenshot, a log line, a number that made no sense. Never
open on the cause, and never open on the project ("I'm building an SFU and…").
Nobody has context yet, and a symptom is the one thing that needs none.

> Two people in the room: perfect video. Three people: the third one's tile is
> macroblock soup. Same code, same browser, one more participant.

**2 · Context — the minimum to follow along**

Two or three lines. Only what's needed to understand the symptom. Resist explaining
the whole architecture; link the README if someone wants it.

**3 · What I thought it was**

The hypothesis, stated plainly and without hedging. This is the beat most people skip
and it's the one that makes the thread worth reading — it's where the reader gets to
be wrong alongside you instead of being lectured at.

> I was sure it was a bandwidth problem. Three encoders, one uplink.

**4 · What it actually was**

The root cause, with the evidence that established it. Code or a log excerpt, not an
adjective. If the cause is subtle, this beat can be two or three posts — it's the
payload of the thread, so give it room.

**5 · The fix**

What changed, concretely. A diff, a type, a constant. Include the regression test if
one exists — naming it is a cheap way to show the fix is real and not a patch over a
symptom.

**6 · What I take from it**

One or two lines. A generalisable lesson, not a moral. If the only honest takeaway is
"I should have read the spec," write that; it's more credible than a manufactured
insight.

---

## Editorial rules

- **English.** The backlog and these docs are in French; nothing published is.
- **First person, singular.** It's a solo project. "We" reads as a fake company and
  gets noticed.
- **Real numbers, with their conditions.** "~3 µs/packet at 50 peers, on a bench" —
  never "blazing fast". A number without its conditions is a claim you can't defend.
- **Code or a graph rather than an adjective.** If a beat can be shown, show it. Ten
  lines of real code beat a paragraph describing them.
- **Name what you don't know.** "I still don't know why X" is content, not weakness,
  and it's the line that reliably brings the useful replies.
- **Link the commit or the test.** Cheap, verifiable, and it makes the whole thread
  harder to dismiss.

### Length and illustration

One thread per week, 6–12 posts. Under six and the structure doesn't fit; past twelve
readers drop before the fix.

**At least one visual per thread** — a screenshot, a graph, a code excerpt, a log
capture. A thread of pure prose performs badly and, worse, looks like it could have
been written without doing the work.

Capture visuals **while doing the work, not afterwards**. A reconstructed screenshot
of a bug you already fixed is both a lie and a waste of an evening. The backlog marks
which topics need one.

---

## Forbidden

Three things, all of which cost more than they return.

**The polite announcement.** "Excited to share that…", "Happy to announce…". If a
post could be published by a marketing department, it doesn't belong. The format is
worked-through problems, not milestones.

**The unsupported superlative.** "Insanely fast", "rock solid", "production ready".
Every one of these is either measurable — so measure it — or it's noise. Note that
"production ready" is also false: see the objection answers in `messaging.md`.

**Disparaging a competitor.** mediasoup, Janus and ion-sfu are mature projects with
years of production traffic behind them. The argument is a difference in scope, never
a defect on their side. People who have run those projects for years read these
threads, and they will be right and you will be wrong. Same rule for LiveKit, which
is not a positioning reference at all — see `messaging.md`.

---

## Pre-publish checklist

Run it before posting. It takes two minutes and it's the last gate before something
unverifiable goes out under your name.

- [ ] Does the thread open on a **symptom**, not on the project or the cause?
- [ ] Is the **wrong hypothesis** stated, plainly?
- [ ] Is there a **conclusion**? (A thread without one doesn't get read twice.)
- [ ] At least one **visual or code excerpt**?
- [ ] Every **number carries its conditions** (bench vs production, peer count, resolution)?
- [ ] Does any claim promise something the README marks ⚠️ or ❌? → **rewrite it**
- [ ] Any superlative that isn't measured? → cut it
- [ ] Any sentence that reads as a dig at another project? → cut it
- [ ] Wordings taken from `messaging.md` rather than improvised?
- [ ] Commit, test or file **linked**?

The sixth item is the one that matters most and the easiest to fail at 23:00. It's the
rule that governs `messaging.md`, and the landing site broke it for months.

---

## Skeleton to copy

```
1/ [SYMPTOM — observable, no context needed]
   [visual]

2/ [CONTEXT — 2-3 lines, strictly the minimum]

3/ I assumed [HYPOTHESIS]. That was wrong.

4/ [ROOT CAUSE — with the evidence]
   [code / log]

5/ [FIX — diff, type, constant]
   Regression test: `[test_name]`

6/ [TAKEAWAY — 1-2 lines, generalisable]

7/ [repo link + an open question, if one is honest]
```

The last post is optional but worth it when a real open question exists. "Does anyone
know why str0m does X?" brings replies; "check out the repo" doesn't.
