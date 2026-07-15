# Flow, Reassessed: 練習 and 訓練 — the Monoxer loop we were missing

_練習 (renshū) = practice: repeat a set NOW, in one sitting, until you can produce all of it._
_訓練 (kunren) = training: bring that mastered set back over days/weeks so it survives._

## The problem with the current flow

The flow we built is **almost all 訓練 and almost no 練習.**

It surfaces cards, grades each once by correctness+latency, hands each to FSRS, and moves on. A wrong
answer gets "an immediate corrective re-ask" — a patch, not a philosophy. That is the **Anki model**:
one clean shot per card per day, spacing does everything.

But that is *not* how Monoxer works, and not how a human actually gets a new ayah into the mouth.
Monoxer's real insight:

> **You do not learn a set by seeing each item once. You learn it by cycling the WHOLE set,
> repeatedly, in one sitting — with the difficulty rising each lap — until you can produce
> every item without help. THEN it goes to the spacing scheduler.**

練習 is the missing engine. Spacing (訓練) only works on material you've already *acquired*.
Cramming each new word into a single correct tap and immediately spacing it is why casual learners
still forget — the word was recognised once, never *produced to fluency*.

---

## The two engines, side by side

```
   練習  RENSHŪ — PRACTICE            訓練  KUNREN — TRAINING
   ────────────────────────          ─────────────────────────
   within ONE session                across DAYS / WEEKS
   a FIXED set (this scene's words)   the whole growing repertoire
   loop the set again and again       see an item once per due-date
   difficulty rises each lap          difficulty rises each survival
   goal: PRODUCE all of it today      goal: still PRODUCE it in 6 months
   ends when: set mastered            ends when: welded for life
   = acquisition                      = retention
        │                                   ▲
        └────────── hands off ──────────────┘
        a set only enters 訓練 AFTER 練習 says "acquired"
```

The current app jumped straight to the right column. We need the left column *first*.

---

## The 練習 loop (this is the reassessed core session)

A learner opens Act 5 (the Pit). It has, say, **8 plot-key words**. Instead of "answer each once,
done," the session is a **set that must be beaten**:

```
  THE SET:  [ w1  w2  w3  w4  w5  w6  w7  w8 ]   ← Act 5's words (fixed for this session)

  LAP 1 — INTRODUCE (recognition, max support)
    each word shown in its scene, then a 2-choice MCQ, hint visible
    w1 ✓  w2 ✓  w3 ✗  w4 ✓  w5 ✗  w6 ✓  w7 ✓  w8 ✗
                 └─ missed: w3, w5, w8 stay "hot"

  LAP 2 — CYCLE (the missed ones come back sooner, harder)
    full set again, BUT w3/w5/w8 reappear first & with 4 choices now
    w3 ✓  w5 ✗  w8 ✓   w1 ✓  w2 ✓ …
                 └─ w5 still hot → comes back again this lap

  LAP 3 — TIGHTEN (support removed for the ones you know)
    words answered right twice → 6 choices, no hint, no scene image
    words still shaky → drop back to easier support (adaptive, per word)

  LAP 4 — PRODUCE (the exit test)
    every word, hardest tier it has reached, no help
    must get the WHOLE set correct in one clean pass
        │
        ▼
  ✓ SET MASTERED  →  now (and only now) each word enters 訓練 (FSRS)
                     with a strong initial stability, because it was
                     genuinely produced, not just recognised once.
```

**Key mechanics that make this 練習, not just "retry wrong ones":**

1. **The set is fixed and must be beaten.** You don't leave until you can produce all 8. This is the
   "beat the level" feel — a clear, closeable goal (unlike an endless Anki queue).
2. **Missed items come back *sooner and more often* within the lap** (short spacing *inside* the
   session — the "expanding retrieval" effect), not just once at the end.
3. **Support fades per word, adaptively.** A word you keep nailing loses its hints/choices/scene
   image fast (climbs tiers); a word you fumble *keeps* its scaffolding until it's stable. Each word
   sits at its own "just right" difficulty — the flow zone from the TikTok doc: P(success) ≈ 80–90%.
4. **The exit is a clean production pass**, not a point total. You feel you *earned* the set.

This is exactly Monoxer: **auto-adjusting difficulty, forced production, no self-grading, and the
whole set cycled until conquered — in one sitting.**

---

## How 練習 and 訓練 connect (the full corrected flow)

```
  DAY 0 ─ OPEN ACT 5
     scene plays
     └─► 練習 SESSION on Act 5's word-set
          lap → lap → lap … until WHOLE SET produced clean
          └─► each word graduates with real initial stability
                └─► enters 訓練 (FSRS) — scheduled to return

  DAY 1,4,11,30… ─ 訓練 brings words back
     BUT a due word is not shown once-and-gone. A due REVIEW is itself
     a mini-練習: if you miss it, it re-enters a short cycle THIS session
     (relearning laps) until produced again — then re-spaced.

  So every session = { a fresh 練習 set }  +  { due 訓練 items, each of
                       which becomes a micro-練習 if it wobbles }
```

Two repetition timescales, nested:
- **Within-session (練習):** cycle the set, missed items recur in minutes, until mastered.
- **Across-session (訓練):** the set recurs in days/weeks, and any wobble drops it back into a
  within-session cycle.

That nesting is the answer to your question — *"how can one repeat a set of questions multiple times,
and as they repeat, increase retention?"* You repeat the **set** (not scattered cards) many times in
one sitting with rising difficulty (練習 → acquisition), then repeat the **set over time** with the
scheduler (訓練 → retention), and any weak item at any timescale falls back into a tighter cycle.

---

## What changes in the app / data model

Small, surgical additions — the FSRS engine and content stay; we add the **練習 layer on top.**

**Session model changes**
- A session is organised around a **SET** (a scene's words, or a review batch), not a flat card queue.
- Add a **within-session scheduler** (a tiny in-memory queue): missed items get re-inserted N cards
  later; mastered items get pulled from the lap. This is separate from FSRS (which is between-days).
- Define **set mastery** = every item produced correct at its current tier in one pass → only then
  does FSRS get its first real grade.

**New / changed fields**
```
  session          + set_id, set_type ENUM[new_scene, review_batch, remedial]
  user_card_state  + intra_session_state ENUM[hot, cooling, mastered]   (transient, per session)
                   + consecutive_clean INT  (how many laps produced clean — drives support-fade)
  review           (already logs each attempt — now MANY per card per session; that's correct
                    and desirable: the lap-by-lap data is gold for the learned model)
```
Note: the `review` event log *already* supports many events per card per session — so the moat data
gets *richer* under 練習, not harder. Every lap is a labelled retrieval attempt.

**Scheduler handoff rule (the one new rule that matters)**
```
  a word's FSRS clock does NOT start on first correct tap.
  it starts when the word is MASTERED within its 練習 set.
  → initial stability seeded higher (it was produced, not recognised)
  → fewer early lapses → the casual learner actually keeps it
```

---

## The corrected one-line flow

```
  OPEN SCENE → 練習: cycle the SET, missed items recur & difficulty rises,
  until you PRODUCE the whole set clean → hand mastered set to 訓練 (FSRS) →
  over days the set returns; any wobble → a mini-練習 cycle → re-spaced → … → welded.
```

Old flow: *see each card once, space it.* (訓練 only — Anki.)
New flow: *beat the set today, then defend it over time.* (練習 → 訓練 — Monoxer.)

---

## Why this directly raises retention (the point of your question)

- **Recognition ≠ production.** One correct tap proves recognition. Cycling to a clean production
  pass proves acquisition. Spacing something merely recognised is why it still slips.
- **Expanding retrieval within a session** (missed → recur soon → recur later) is itself an
  evidence-based booster, *on top of* between-day spacing. You get two doses of the effect.
- **The set has a closeable goal** ("beat Act 5") — this is what makes repetition feel like a game
  (練習 as play), sustaining the many reps a casual learner would never do in an open Anki queue.
- **Handoff at mastery** gives FSRS honest, strong starting state → the schedule actually holds.
```
