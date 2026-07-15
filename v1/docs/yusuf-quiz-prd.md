# PRD — iman.app Quiz Engine
## Surah Yusuf Prelude (Web)

Owner: Firdaus · Status: Draft for build · Supersedes: yusuf-quiz-pipeline.md
(the pipeline doc's diagrams are folded in below; this is now the canonical doc)

---

## 1. Overview

A web-based Quran memorization and retention engine, piloted on Surah
Yusuf (111 ayat, ~1,700 mushaf words, one continuous narrative). The
product amalgamates five models, each contributing one layer, each
model's known failure checked by a neighbor:

```
   Habit shell   - that it happens      (Duolingo, purified)
   Meaning       - why it sticks        (meaning-match + narrative)
   Curriculum    - what order           (Math Academy: gates, chains)
   Question      - what form            (Monoxer: state -> question)
   Clock         - when                 (FSRS + retrieval science)
   Unit          - what counts          (madrasa: full ayah, tasmi')
```

The entire engine compiles to one corpus and two pure functions:
`next_drill(queue, atoms)` and `update(atom, event)`.

## 2. Problem

1. **Retention collapse.** Hifz is routinely memorized and lost; most
   effort worldwide dies in the review phase, unmeasured.
2. **No per-ayah truth.** No tool tells a memorizer which of their
   verses are decaying, which connections are broken, which
   look-alikes are colliding.
3. **Teacher dependency without teacher leverage.** Tasmi' is
   irreplaceable but scarce; nothing prepares students efficiently
   between sittings or shows teachers where students are weak.
4. **Rote without meaning.** Existing quiz apps drill sound-shapes;
   understanding is left to a separate activity that rarely happens.
5. **Inconsistency.** Sessions are unbounded and unanchored, so they
   don't survive real life (interruptions, travel, missed days).

## 3. Goals & success metrics (prelude exit criteria)

Prelude passes when, across ≥30 days for user zero + a handful of
invited testers:

| Metric | Target |
|--------|--------|
| Day-1 gate pass rate | 85–90% (higher = ladder too easy; lower = dose short) |
| Anchor adherence (session within 90 min of anchor) | ≥60% of active days |
| Cycles-to-clean-pass | converging distribution; constants tuned |
| Look-alike slip rate | declining per confused pair after tell-apart drills |
| D30 retention probe vs predicted strength | FSRS calibration within ±10% |
| Interruption -> completion rate | ≥80% of interrupted sessions finish same day |
| Time-per-word actuals | 20 s prior corrected with real constant |

## 4. Non-goals (prelude)

- No recitation/ASR grading (door open: criterion rung deferred, not deleted)
- No surahs beyond Yusuf; no juz'/page syllabus UI
- No native apps (engine written to be inherited by RN later)
- No blind recall rung (ladder ends at whole-bank build)
- No social features, leaderboards, or teacher marketplace
- No tajweed instruction or correction
- No monetization changes; no notification marketing

## 5. Users

- **P0 — User zero.** Firdaus, currently memorizing this exact surah.
  Every version must be useful against real hifz the day it ships.
- **P1 — Returning memorizer.** Adult with partial (often childhood)
  hifz in unknown condition; needs placement, honesty, and a
  sustainable maintenance load.
- **P2 — Adult beginner.** Limited Arabic; needs the meaning layer as
  much as the recall layer; time-poor (5–10 min/day); often on the
  existing iman.app funnel (EN/MS/JA locales).

## 6. Design invariants (locked)

1. The graded unit is always the **complete ayah**. Words are probe
   sites; phrases are transient in-drill scaffolding. Connections
   (ayah n -> n+1) are first-class atoms.
2. Stages in English: **Learn / Reinforce / Carry** (+ Lapsed). The
   stage IS the strength band (~0–40 / 40–80 / 80+).
3. Learn ladder: **meaning match -> word-by-word fill -> whole-bank
   build -> bridge**. Test-first: no study cards, ever. First-pass
   meaning errors are pretest, excluded from confusion/strength.
4. Evidence asymmetry: errors full weight; massed successes damped;
   spacing measured between retrievals, never app-opens.
5. Only the structured session moves lifecycle state. Free play
   writes evidence only.
6. The day begins at **Fajr**; sessions anchor to a prayer.
7. Web first: Cloudflare Pages/Workers, PWA, IndexedDB local-first.
8. UI: the visualize design language (iman-ui.css). The Amiri ayah is
   the largest type on every screen; coral only for slips; one serif
   voice line per screen max; no shadows or gradients.
9. Repetition dose (tentative constants, performance overrides):
   3 recall cycles day-0 (cap 5) + checkpoints tonight/day-1/day-3/
   day-7; day-1 gate = cold whole-bank, first attempt.

## 7. Functional requirements

Priorities: P0 = prelude cannot ship without; P1 = prelude should
have; P2 = fast-follow.

### FR1 — Corpus (P0)
- Compiler emits, for all 111 ayat: verses (+ mushaf page/line),
  words (Uthmani, lemma, root, class, gloss EN/MS/JA), ranked
  per-word distractors, 110 connections, look-alike index, scene
  beats. Static JSON on Pages, hydrated to IndexedDB.
- Distractor ranks: suffix-variant > look-alike-verse > same-root >
  synonym > class-neighbor. Runtime = `ORDER BY rank LIMIT n`.
- Gloss and tokenization reviewed by a qualified reader before any
  external tester sees a drill (see Risks).

### FR2 — Learn ladder (P0)
- S1 meaning pass: cumulative word/phrase -> gloss MCQ; repeats until
  one clean sweep; missed words return as warm-ups at later rungs.
- S2 fill: blank ayah, slots in reading order, options from this
  word's distractor row; `options(strength) -> (count, max_rank)`.
- S3 whole-bank: all the ayah's words, no distractors; completion
  flips rung_flags and schedules the day-1 gate.
- S4 bridge: next verse's opening vocab as meaning items; creates the
  connection atom and its junction drill.
- Long ayat may split S1 across a session, but no rung completes
  without full-ayah production first word to last.

### FR3 — Scheduler & lifecycle (P0)
- Queue assembled before the user's anchor: make-up merge -> gates ->
  due reviews ranked by forgetting-risk x weight (connections
  weighted up) -> fit to time budget -> Learn cycles interleaved
  between review items.
- Mastery gates: new ayah unlocks only when prior day's encodings
  pass their cold gate; parallel threads allowed (non-adjacent
  starts), each with its own gate queue; no mid-ladder abandonment.
- Session capped by time (~6–8 min default), always finishable.
- (P1) Deadline planner: "Yusuf by <date>" -> daily quota via the
  capacity formula, with honest refusal of infeasible dates.

### FR4 — Review drills (P0)
- Reinforce: S2-form fill on known ayat, hardening option ranks.
- Carry: junction checks + chain drills (tap-through, full-ayah
  steps); chain grades update every traversed verse and connection
  (FIRe credit).
- Tell-apart drill spawns at confusion count ≥2 for a pair (P1).

### FR5 — Start-stop & offline (P0)
- Every tap commits locally before UI animates; outbox syncs batched
  and idempotent. All drills render offline from the cached corpus.
- resume_policy(gap): <2 min resume in place; <1 hr restart drill;
  >1 hr re-plan queue with warm-up; past Fajr -> make-up merge.
- Interrupted latencies discarded; same-hour restarts weighted massed.

### FR6 — Free practice & overflow (P1)
- Three doors after session complete: extra Learn (scheduler-granted,
  gate intact, cost disclosed), weak-spot gym (full-weight evidence;
  pre-tasmi' rehearsal mode), open practice (any ayah x any drill).
- Cold success on hard drill of untaught ayah -> placement offer
  ("add to Carrying?"), one-tap adoption.
- Voluntary reruns may carry a "felt uncertain" tag (difficulty nudge).
- Diminishing-returns honesty line after massed reps.

### FR7 — Identity & sync (P0 for testers; app runs anonymous-first)
- Sign in with Google: GIS -> POST /auth/google -> JWKS verify (iss,
  aud, exp) -> upsert users(google_sub) -> signed HttpOnly cookie
  (SameSite=Lax, ~30 d). Scope: openid email profile only.
- Anonymous-first: local history adopted into the account on first
  sign-in. user_id derives from session, never request body. Origin
  check on all POSTs. No tokens in localStorage.

### FR8 — Admin monitor (P0 before testers)
- /admin on the same Worker; ADMIN_EMAILS allowlist; read-only SQL
  views over D1. Panels = exactly the §3 metrics table, live, plus
  per-user drill-down (stage distribution, weak connections, streak
  state, time-per-word). Rendered in iman-ui.css. Rule: if a metric
  isn't on /admin, the prelude isn't measuring it.

### FR9 — Habit layer (P1)
- Onboarding asks one scheduling question: anchor prayer.
- Open-into-next-drill; <3 s tap-to-first-retrieval.
- Streak counts completed sessions; pauses on a miss; make-up day
  repairs; 2-minute floor session always offered. No guilt copy.
- Two-anchor day: main session at anchor; evening 1–2 min second
  touch (pre-sleep consolidation).
- (P1) Decay made visible: "72% -> 64% since Thursday" on due items.
- (P1) Mushaf heatmap: 111 ayah rows with strength bars; word bars
  one tap deeper as diagnostics only.
- (P2) PWA install prompt in week one; web push where platform allows.

### FR10 — Onboarding & placement (P1)
- "Memorized before?" -> adaptive junction probes at narrative
  landmarks, binary-searching weak regions; "I don't know" is a
  first-class answer. Output: carried map + daily plan + start ayah.
- First week is a habit protocol: underloaded sessions, no second
  thread before day 3.

## 8. Non-functional requirements

- Offline-first PWA; corpus ≤3 MB; initial load <2 s on mid-range
  mobile; drill render <100 ms from cache.
- Durability: zero data loss on interruption at any moment.
- Privacy: least-scope auth; per-user data exportable/deletable;
  events contain no free text.
- Accessibility: visible focus states, reduced-motion respected,
  hit targets ≥40 px, Arabic at ≥18 px with line-height ≥2.
- i18n: EN, MS, JA gloss locales from day one (corpus columns exist
  even if UI chrome ships EN-first).
- Type: Amiri exact for Arabic; Styrene B/Tiempos first in stacks
  with Inter/Source Serif 4 as shipping equivalents.

## 9. Architecture (condensed)

```
compiler -> corpus.json -> Pages/PWA client
                             drills (S1..S6) -> events (IndexedDB)
                             scheduler -> sessions.queue
                             outbox ==sync==> Worker -> D1 (users,
                             events append-only), DO per user
Google Identity --verify--> /auth/google -> session cookie
ADMIN_EMAILS -------------> /admin (read-only views)
```

Event sourcing: `events` is truth; `atoms` everywhere is a rebuildable
cache. Tables: users, atoms (≤221/user), events, confusions,
sessions, snapshots + the six corpus tables. Full column detail in
the data-structure tables of the conversation record / pipeline doc.

## 10. Release plan

| Ver | Scope | Exit criterion |
|-----|-------|----------------|
| v0.1 | FR1 compiler + corpus.json | 111 ayat render; distractors spot-checked |
| v0.2 | FR2 S1–S3 local, iman-ui.css | user zero encodes one real ayah end-to-end |
| v0.3 | FR3 + FR5 scheduler, gates, start-stop | 7 consecutive real days survive interruptions |
| v0.4 | FR2 S4 + FR4 chains/junctions | connections born and reviewed; FIRe credit works |
| v0.5 | FR7 auth + sync | anonymous history adopted; events land in D1 |
| v0.6 | FR8 /admin | all §3 metrics visible live |
| v0.7 | FR6 free practice + FR10 placement | a returning-hifz tester onboards in <5 min |
| v0.8 | FR9 habit layer | anchor adherence measurable; floor session live |

Testers invited at v0.6 (sign-in + admin both exist). Prelude runs
30 days from first external tester; §3 decides pass/fail.

## 11. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Recognition ceiling: MCQ mastery ≠ recitation | whole-bank as top rung; cold gates; recitation-check door kept; teacher weak-spot export (P2) |
| Gloss/tokenization errors in sacred text | qari/teacher review pass before testers; error-report tap on every drill |
| MS/JA gloss sourcing quality | ship EN-complete first; MS/JA flagged per-word as reviewed/unreviewed |
| FSRS miscalibration on this material | D30 probes from day one; per-user parameter fitting after ~2 weeks |
| iOS web push weakness | anchor leans on salah itself; PWA install prompt; native app later |
| Gaming (massed grinding, option guessing) | damping asymmetry; pretest exclusion; latency signal; gates cold |
| Single-builder bandwidth (many concurrent ventures) | v0.2–v0.4 need no server; every version usable by user zero alone |
| Scope creep via admin/dashboard | rule: /admin shows the §3 table and nothing else |

## 12. Open questions

1. Is the whole-bank rung a sufficient criterion until ASR ships, or
   should a self-graded blind step return earlier for user zero only?
2. Deadline planner default: Ramadan 1 preset, or user-set only?
3. MS/JA word-by-word gloss source: license an existing dataset or
   commission review?
4. Page-geometry features (mushaf line rendering) in the web prelude,
   or defer to native?
5. Tester count for a meaningful 30-day read: 5? 15?

## Appendix A — numbers carried from the pipeline

- Learn ≈ 20 s x word count (+~1 min same-day touch); interruption
  overhead ~10–15%.
- T(min) ≈ 0.33·W_new + 0.4·R_due + 1.25·chains + 0.17·junctions.
- Yusuf: ~9–10 h total encoding; ~4 months at one medium ayah/day;
  carrying it afterward ~5–7 min/day, decaying.
- Dose: 8–9 successful full-ayah retrievals in week one; ~15–20 in
  year one, mostly as chains.

## Appendix B — the six drill situations

S1 meaning pass · S2 word-by-word fill · S3 whole-bank · S4 bridge ·
S5 slip (evidence, warm-up, tell-apart at ≥2) · S6 interruption
(resume/restart/re-plan/make-up by gap). Reinforce and Carry are
S2/S4 at longer intervals and harder ranks. Every user path is a
sequence of these six.