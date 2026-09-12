# Publishing cadence

The exit criterion for Phase 1 is a weekly rhythm held without a break, and an
irregular rhythm kills credibility faster than no content at all. It's also the
project's top risk: the work happens in short evening and weekend sessions, which is
exactly the shape of schedule that produces three good weeks and then a gap.

So this is a mechanism, not an intention. Tracks `LUM-621`.

---

## The slot

**Sunday, 18:00–20:00 — write and publish in the same sitting.**

> ⚠️ **To confirm.** Proposed, not decided — pick whichever slot you'll actually
> honour and change this line. Everything below works with any fixed slot; what
> doesn't work is no slot.

Why this one: it's the end of a weekend, so it can absorb a session that overruns; the
week's dev work is fresh; and Sunday evening is a decent slot for a US and European
technical audience. Writing and publishing together matters — a thread written and
left "to post tomorrow" is a thread that doesn't get posted.

**Set a recurring calendar event with a reminder.** A repeating task in Linear works
too. What's not acceptable is relying on remembering: the whole point is that week six,
the tired one, runs on the same rails as week one.

---

## The one-week buffer rule

**Aim to always have next week's thread ready.**

Publish thread N, and before closing the session, pick topic N+2 from the backlog and
note its angle. The buffer means an impossible week costs the buffer instead of the
streak — and you rebuild it the following week rather than breaking the cadence.

First run: write the first two threads before publishing either. Starting with a
buffer of zero means the first bad week is also the first break.

---

## The fallback, defined before it's needed

A week where the thread doesn't happen. It will occur, and improvising an answer at
23:00 on a Sunday is how the streak ends.

**The fallback is a short honest post, never silence.** Three or four lines on what
happened this week, including "nothing shipped, here's why". Build-in-public forgives
a quiet week; it doesn't forgive disappearing.

```
Week N: no thread this week — [reason, plainly].
[One or two lines on the actual state of the work.]
Back to the usual format next Sunday.
```

Two rules on the fallback: it goes out **in the slot**, not later in the week, and it
doesn't apologise. "No thread this week, I was debugging ICE and lost" is content.
"Sorry for the silence 🙏" is not.

**Two consecutive fallbacks is a signal, not a bad patch.** If it happens, the format
is wrong for the available time — shorten the thread convention rather than keep
missing a target that doesn't fit.

---

## The session, end to end

Roughly 90 minutes, which is what makes the slot survivable.

1. **Pick the topic** — 5 min. From `thread-backlog.md`, prefer one whose visual
   already exists. It should normally be the one chosen two weeks ago.
2. **Fill the six beats** — 45 min. The skeleton lives in `thread-template.md`. Draft
   ugly; the structure is what's doing the work.
3. **Visual** — 15 min. Screenshot, graph or code excerpt. If it has to be
   reconstructed, the topic was picked wrong — switch topics rather than fake it.
4. **Checklist** — 10 min. The one at the end of `thread-template.md`. Item six —
   *does any claim promise something the README marks ⚠️ or ❌* — is the one that
   matters and the easiest to skip when tired.
5. **Publish, then log it** — 5 min. Fill the row in the table below.
6. **Pick the next topic** — 10 min. Note its angle in the backlog. This is what
   maintains the buffer, and it's the step that gets dropped first. Don't drop it.

---

## Log

One row per week. The point is that a break is visible immediately rather than
reconstructed a month later from memory.

| Week | Date | Topic | Format | Link |
|---|---|---|---|---|
| 1 | | | | |

Format: `thread` or `fallback`. A missing row is a break — leave the gap visible
rather than backfilling it.

**Four consecutive weeks published without a break** closes `LUM-621`. Holding the
cadence is also half of the Phase 1 exit criterion; the other half is `LUM-547`
(two external users active without assistance).

---

## What this deliberately doesn't do

**No scheduling tool, no buffer app, no automation.** One person, one weekly post — a
calendar reminder and this file are the whole system. A scheduling tool would be a
week spent on tooling instead of on the first four threads.

**No cross-posting for now.** X is the channel for Phase 1. dev.to and Reddit belong
to the Phase 2 launch sequence, and using them now spends the effect early on an
audience that doesn't exist yet.
