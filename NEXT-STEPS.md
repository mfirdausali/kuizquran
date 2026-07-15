# Kuiz Quran / iman.app — Next-Step Decisions

_Last updated: 2026-07-09_

This document captures the **candidate next steps**, then **derives recommended choices** by
reconciling three inputs:

1. The **built prototype** — full Surah Yusuf dataset (111 ayahs, 1,777 word-cards, 8,885
   distractors), the 19-act mental model, the `QuranFSRS-Implicit` SRS spec, and the published
   vision artifact.
2. **`mahbooba-yusuf-symmetry.png`** — the 12-point **ring composition / chiasmus** of Surah
   Yusuf (mirror pairs: 1↔12 dream/fulfilled, 2↔11 plot/lesson, 3↔10 seduce/confess,
   4↔9 ladies convince/confess-innocence, 5↔8 jail/release, 6↔7 king's-dream/interpreted).
3. **`tiktok-discussion.md`** — the strategic thesis: this is not "MCQ + SRS," it is a
   **Memory Operating System** whose moat is a *learned* retention model built from behavioural
   recall data. "Don't maximize time spent. Maximize successful retrievals per minute."

---

## Part A — What the three inputs, together, actually say

**The reframe (from the TikTok doc).** The competitive advantage is not the quiz UI or the SRS
algorithm — both are copyable. The advantage is a **Memory Recommendation Engine** that answers:
_"Out of every ayah, word, concept and story, what is the single next interaction that most
increases this person's lifetime retention?"_ The app is the instrument; **the data is the
product**. Optimization target = _P(recalled 10 years from now)_, not DAU.

**The mechanic is already validated.** The forced-choice cloze with 4-type distractors works
(case-ending traps teach i'rāb, contextual traps teach word order). This is the data-collection
instrument the strategy needs — every tap yields: correct?, latency, which distractor, confidence.

**The mental model should be the chiasmus, not just a linear filmstrip.** The symmetry PNG is a
tighter, more memorable scaffold than my 19 linear acts. Its mirror pairs are themselves a
retrieval device — recalling one half cues the other. My `srs-engine.json` already anticipates
this ("ring/mirror retrieval scaffolding" — pair beginning-act words with end-act echoes); the
PNG makes the 12-point pairing explicit and should become the canonical review-pairing structure.

**Monetization is earlier and different than "sell SRS"** (per the doc): parents pay for
_confidence_ (a retention dashboard), teachers pay for _prediction_ (who needs revision today),
institutions are B2B SaaS. Not paid-upfront consumer SRS.

---

## Part B — Candidate next steps (the options to choose from)

Each option notes what it advances toward the Memory-OS vision, effort, and dependency.

### Track 1 — Prove the loop (product)
- **1a. Working prototype play-screen.** A real, interactive Surah Yusuf player (Laravel/Livewire
  or a lightweight web app) driving the 1,777 cards through a real FSRS-implicit scheduler, logging
  every recall event. _This is the data-collection instrument._ Advances: everything downstream
  depends on real recall data. Effort: high. Dependency: none — data is ready.
- **1b. Feed-ranking engine (the TikTok core).** Implement the `score = forgetting_risk +
  confidence_gain + narrative_continuity + vocabulary_gap + surprise + enjoyment` ranker so the
  _app_ chooses the next card, not the user. Advances: the actual moat. Effort: high.
  Dependency: needs 1a to generate signals first.
- **1c. Chiasmus mental-model upgrade.** Replace/augment the 19-act linear model with the 12-point
  ring composition from the PNG; wire mirror-pair review into the scheduler. Advances: better
  retention scaffold + a distinctive teaching hook. Effort: low–medium. Dependency: none.

### Track 2 — Harden the asset (data quality)
- **2a. Scholar-grade distractor review.** Flag any distractor that is grammatically defensible
  (i.e. a "wrong" option that could actually be correct), or theologically awkward. Advances:
  trust — non-negotiable for a Quran product before any public release. Effort: medium.
- **2b. Audio + recitation layer.** Add per-word/ayah audio and (later) recitation-error capture,
  a data dimension the doc calls out (recitation confidence). Advances: a second signal stream +
  active-recall via voice. Effort: high (needs audio assets + ASR).

### Track 3 — Define the moat (data model & strategy)
- **3a. Memory-Graph data schema.** Formalize the event schema from the doc (per recall: ayah,
  word, position, latency, distractor chosen, confidence, time-of-day, prior interval, mood-proxy)
  and the four data layers (Retrieval / Confusion / Behaviour / Knowledge). Advances: makes the
  "data is the product" thesis buildable and future-proof. Effort: low–medium. Dependency: informs 1a.
- **3b. Business-sequencing & monetization plan.** Turn the doc's Stage 1→6 ladder and phase
  timeline into a concrete plan with KPIs (D30 retention, median retention gain), pricing
  (free 3 surahs → RM20–40/mo), and the parent-dashboard / teacher-dashboard / institution B2B
  sequence. Advances: fundraising / focus. Effort: medium.

### Track 4 — Extend coverage (content)
- **4a. Short-surah pack for the casual ICP.** Run the same pipeline over the surahs a casual
  learner actually starts with (Al-Ikhlas, Al-Kawthar, An-Nas, Al-Falaq, the last juz). Advances:
  a shippable onboarding surface matched to the target user. Effort: medium (pipeline exists).

---

## Part C — Derived choices (recommendation)

The TikTok doc is explicit that **the data is the product** and **retrievals-per-minute** is the
target. That means the highest-leverage next move is whatever gets **real recall events flowing
through a real scheduler fastest**, because nothing else (feed engine, learned retention model,
parent dashboard, moat) can exist without that event stream. Everything cheap that de-risks that
build should ride alongside it.

### ▶ Recommended sequence

1. **Now — 3a (Memory-Graph schema) + 1c (chiasmus upgrade).** Both are cheap, both are
   prerequisites that shape the build. Lock the event schema so the prototype logs the _right_ data
   from day one (retrofitting logging later loses irreplaceable early events). Swap in the 12-point
   ring model so the scaffold is the strongest version before any UI is built. **Do these first.**

2. **Next — 1a (working prototype play-screen)** instrumented against the 3a schema. This is the
   instrument. Ship it small (Surah Yusuf only), measure **D30 retention + median retention gain**
   (the doc's KPIs), not DAU. This is the single most important build.

3. **Alongside 1a — 2a (scholar distractor review).** Must happen before anyone external touches
   the cards. Can run in parallel with the build; gate public release on it.

4. **After first real data — 1b (feed-ranking engine).** Only meaningful once 1a is producing
   signals. This is where the product becomes a Memory-OS rather than a quiz.

5. **Then — 4a (short-surah pack)** for onboarding the casual ICP, and **3b (monetization plan)**
   once retention is proven (parent-confidence dashboard is the doc's earliest real revenue).

6. **Later — 2b (audio/recitation)** as the second data stream once the text loop is proven.

### Why this order
- It respects the doc's own logic: **data first, moat second, monetization on proven retention.**
- It front-loads the two cheap, irreversible-if-skipped decisions (schema, scaffold).
- It keeps scripture-trust (2a) as a hard gate, not an afterthought.
- It defers the expensive engine (1b) and audio (2b) until they have data to stand on.

### The one thing to decide first
**Build target for 1a:** Laravel/Livewire (matches the loaded skill-set and B2B/dashboard future)
vs. a lightweight standalone web/mobile app (faster to real users). Recommendation:
**Laravel/Livewire** — the doc's endgame (parent dashboards, teacher dashboards, institution SaaS)
is database- and multi-tenant-heavy, which is exactly Laravel's strength, and it matches the
existing tooling.

---

## Open questions to resolve before starting 1a
1. Build stack for the prototype: **Laravel/Livewire (recommended)** or standalone JS/mobile?
2. Is the 12-point chiasmus the canonical model, or keep both (19-act linear _and_ 12-point ring)
   as two views over the same cards?
3. Auth/identity from day one (needed to attribute recall events to a learner over time) — yes/no?
4. Scope of the first shippable: Surah Yusuf only, or Yusuf + a short-surah onboarding pack (4a)?
