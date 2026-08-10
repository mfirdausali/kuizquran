# Kuiz Quran v3 — Wireframe & Decisions

_Generated 2026-08-10._

Companion to `v3-wireframe.excalidraw` (open at [excalidraw.com](https://excalidraw.com) →
File → Open). This file records *why* the wireframe looks the way it does.

**Execution plan:** see [`BUILD-PLAN.md`](BUILD-PLAN.md) — 12 milestones (M0–M11), the corrected
build order, the agent deployment strategy, and a 199-row edge-case register. This file is the
*specification*; BUILD-PLAN.md is the *execution*.

---

## Status of the three generations

| Gen | Stack | State | Verdict |
|---|---|---|---|
| **v1** | Cloudflare Pages + Workers + D1/DO, pnpm monorepo | Shipped to staging, 163 tests | Frozen. Mine for engine + corpus + CSS. |
| **v2** | React + Vite front, Laravel + Sanctum back, local-first | Through Phase 7 (hardening & gates) | **Left untouched.** Still the working app. |
| **v3** | **Next.js** | This wireframe | New shell around v2's proven core. |

v3 is a **new generation, not a migration**. v2's decision `v2-D01` (React+Vite + Laravel)
stands and is not superseded — v3 sits beside it.

---

## The three decisions this wireframe encodes

### v3-D01 — Greenfield v3 in Next.js; v2 untouched
- **Kind:** stack · **Status:** accepted (2026-08-10)
- **Decision:** Build the multi-surah product as a fresh Next.js app under `v3/`. v2 keeps
  running as-is.
- **Why:** The requested product (pick any surah, surah recommendations, macro-first framing)
  is a genuinely different app from v2, which is hardcoded to one surah
  (`v2/src/pages/Home.tsx:16` — `const SURAH = 12`). Reversing v2's stack mid-Phase-7 would
  have cost 7 phases of work to gain routing and SSR that a local-first drill app barely uses.
  A parallel generation costs nothing and preserves the fallback.
- **Trade-off accepted:** two codebases to maintain until v3 overtakes v2.

### v3-D02 — Macro understanding lives in a persistent dashboard panel
- **Kind:** ux · product · **Status:** accepted (2026-08-10)
- **Decision:** The macro view of a surah (structure, ring composition, themes, motifs, vocab)
  is a **panel pinned to the top of every surah page**. Always visible, never a gate.
- **Why:** Gating macro-before-micro is intuitive but punishes returning users and puts a wall
  in front of the first win. Ambient repetition beats a one-time mandatory tour — the learner
  meets the structure again on every visit, and again in miniature on every ayah screen.
- **Consequence:** the macro panel doubles as the progress view. Ring dots fill teal as their
  ayat are memorized, so macro and micro are literally the same picture at two zoom levels.
- **Escape hatch:** if the stronger version is wanted later, a macro *quiz* (order the
  movements, match theme to ayah range) slots in as an optional challenge card inside this
  same panel — no restructure needed.

### v3-D06 — Social & gamification ship, but ethics-bounded and flag-gated
- **Kind:** product · ux · **Status:** accepted (2026-08-10)
- **Decision:** Build friend streaks, add-friends, invite codes, friends' progress, account
  profile, points/XP, streak calendar, streak freeze, and algorithmic notifications — **each
  behind an admin feature flag, each shipped OFF by default**, and each designed against the six
  ethical guardrails already recorded in `data/srs-engine.json`.
- **Friend visibility is CONSISTENCY-ONLY.** Friends may see: showed-up-today, streak length,
  which surahs someone is working on. Friends may **never** see strength scores, lapses,
  half-life, or which specific ayat are weak.
- **Why:** the project's own `srs-engine.json` already designed freeze tokens and streaks *and*
  already forbade "streak-as-idol" and dark patterns. The question was never whether to build
  these, but how. Consistency-only visibility is the line that keeps a learner's spiritual
  struggle from becoming social data.
- **Consequence:** §10 and §18 previously promised "no streaks as a score, no leaderboards."
  That copy stays **true** only because XP/streaks are de-emphasised as they grow and there is
  no ranked leaderboard. If a future change adds ranking, the landing-page footer must change in
  the same commit — the marketing claim and the product must never diverge.

### v3-D07 — Hard paywall; supersedes the waqf/donation model
- **Kind:** product · **Status:** accepted (2026-08-10) · **Supersedes:** the §18 "free forever" pricing
- **Decision:** A limited free trial (one surah, or 14 days), then payment is required to continue.
  - **Monthly:** RM20 (Malaysian IP) · **USD10** (international)
  - **Lifetime:** RM500 (Malaysian IP) · **USD200** (international)
  - **IP sets the default region; the learner can change it.** The chosen region is stored on the
    account, not per session, so travelling never reprices anyone.
- **Why the geo split is loose:** strict IP + card-country locking would shut out the Malaysian
  diaspora — the segment most able to pay. A VPN user paying USD10 instead of RM20 is a rounding
  error, not a threat.
- **What this invalidated:** §18 previously promised *"Free to memorize. Free to keep — same
  features either way."* That copy is now **false** and was rewritten in the same change, along
  with the hero CTA. The footer gains an honest line: *"You pay us, so you are the customer —
  not the product."*
- **The one ethical obligation:** the paywall must **never hold a learner's memory hostage**.
  Reviews stay open for 7 days past the trial, existing progress is never deleted, and unpaid
  data waits rather than expires. Charge for **access**, never for the memorization itself.
- **Lifetime maths, deliberately:** RM500 ÷ RM20 = **25 months**; USD200 ÷ USD10 = **20 months**.
  Lifetime only pays off if learners stay past ~2 years — which is exactly the product thesis.
  Note the asymmetry: international breaks even 5 months sooner. If unintended, USD250 aligns them.

### v3-D03 — A chain is a first-class memory object, not a property of an ayah
- **Kind:** mechanic · **Status:** accepted (2026-08-10)
- **Decision:** The joint between ayah N and N+1 is its own card, with its own strength and
  its own review schedule. It becomes eligible only once **both** adjacent ayat are
  individually strong.
- **Why:** This is the "trickiest part" you flagged, and it dissolves once chains stop being
  modelled as an ayah attribute. Reciting ayah 3 perfectly and ayah 4 perfectly does not mean
  you can go *from* 3 *into* 4 — the transition is a distinct retrieval with its own failure
  curve. Most hifz apps miss this and learners stall at exactly these joints.
- **Inherit from v2:** `engine/chain.ts` already implements this, *including* the fix for
  BUG-3 (chains crediting un-learned ayat). v3 must lift the fixed version.

---

## Navigation hierarchy vs. memory model

You framed it as **Surah → Ayah → Quiz**. That's exactly right for *navigation*, and the
wireframe follows it. But the model underneath is not a tree:

- **Navigation** is a tree: Surah → Ayah → Quiz.
- **Memory** is a graph. Cards live at three levels — word (atom), ayah, and chain (the joint)
  — each independently scheduled. "A quiz" is just today's assembled mix across all three.

This is why the scheduler, not the learner, picks the next card (carried over from v2).

---

## Sections in the wireframe file

| § | Content |
|---|---|
| 0 | Information architecture — the Next.js App Router route tree |
| 1 | Dashboard — MY SURAHS, primary CTA, the recommender card |
| 2 | Surah library — browsing and committing to a new surah |
| 3 | Surah detail — **the macro panel** + ayah list |
| 4 | Ayah detail — the bridge, restating position in the macro structure |
| 5 | The quiz loop — tap-to-reconstruct, chain check, session summary |
| 6 | The chain model — how Surah→Ayah→Quiz decomposes into cards |
| 7 | **Tracking** — the event pipeline, 19 event types, sync |
| 8 | **Scheduling** — atoms, strength bands, decay, `assembleQueue` |
| 9 | **The five locked invariants** |
| 10 | **Retention monitoring** — the learner-facing Progress surface |
| 11 | **Edge cases · multi-surah** — where the ported engine breaks |
| 12 | **Edge cases · learner-facing** |
| 13 | **Daily continuous drill** — ayah-range and mushaf-page runs |
| 14 | **The Plan calendar** — first-class surface, own tab |
| 15 | **Time measurement + accessible progress list** |
| 16 | **Admin console (desktop)** — login → users → health → science → qari gate |
| 17 | **Strategic onboarding** — recall before identity |
| 18 | **Landing page** |
| 19 | **Social & motivation — learner UI** (friends, streaks, XP, notifications) |
| 20 | **Social & motivation — admin control plane** (feature flags, moderation, honest measurement) |
| 21 | **Can the quiz alone memorize a page?** — the honest answer, with arithmetic |
| 22 | **Templating: Surah → Ayah → Quiz** — the question compiler |
| 22b | **Admin: the surah–ayah–quiz editor** |
| 23 | **One ayah → many questions** — cardinality, packaging, procedural edge cases |
| 24 | **Auth · Settings · Paywall** — register, sign-in, subscribe |
| 25 | **Landing page — visual layout** (Apple method) |
| 26 | Suggested build order |

---

# Tracking, scheduling & retention monitoring

All of this is **implemented and tested in v2** (`v2/src/engine/src`, 29 modules + 24 test files, pure TypeScript with zero DOM dependencies). v3 ports it rather than redesigning it.
Cited paths below are real.

## 1 · Tracking — the event log is the truth

**The pipeline:** learner taps → `makeEvent()` (pure constructor, no IO) → `append()` writes to
IndexedDB and **awaits `tx.done`** → only then does the UI animate.

That ordering is invariant #2 and it is deliberate: `v2/src/db/eventLog.ts` resolves `append()`
only after the transaction has durably committed, so a crash mid-session loses nothing. Reads
are wrapped in a timeout so a wedged IndexedDB can never hang the app.

**`atoms` is a rebuildable cache. The event log is the truth.** `rebuild()`
(`engine/src/rebuild.ts`) folds an ordered event stream into the atoms map. Any state can be
reconstructed from scratch at any time.

### The 19 event types, by what they move

| Tier | Events | Effect |
|---|---|---|
| **Graded** | `tap`, `reconstruct_tap`, `rung_complete`, `ayah_produced`, `gate_result`, `gate_demote`, `connection_born`, `junction_result`, `chain_step` | Move strength via `update()` |
| **Evidence only** | `rung_start`, `ayah_complete`, `session_start`, `interruption`, `placement_probe`, `placement_result`, `adoption` | Logged, no strength signal |
| **Read-only mirror** | `test_start`, `test_answer`, `test_result` | **Never folded by `rebuild()`** |

The third tier is the subtle one. A Test (v2-D13/D14) generates and grades real questions but
`rebuild.ts` has *no branch for it at all* — so it cannot move strength or due-dates. A learner
can self-assess whenever they like without corrupting their schedule. Testing yourself is not
the same as being tested.

### Sync
`v2/src/sync/outbox.ts` pushes unsynced events to Laravel `/events` in batches of 200, Bearer
token, **idempotent by client-stamped uuid**. Offline → stops quietly and retries later; it
never blocks, because the local commit already happened. That idempotency key is what makes
"created offline, syncs on reconnect" work without a conflict-resolution layer.

## 2 · Scheduling

### The atom — the scheduled unit
Per invariant #1, atoms are **per-ayah and per-connection, never per-word** (`engine/src/atom.ts`):

```
kind: 'ayah' | 'connection'
strength       0–100, the band value
stability      FSRS-shaped, in learning-days
difficulty     0–1, nudged by outcomes
lastRetrieval  ms, or null
reps / lapses  counters
encoded        produced whole at least once
gateDueAt / gatePassed / gateFails
```

That caps Yusuf at **≤221 atoms per learner** (111 ayat + 110 connections). Word taps are
*evidence* that rolls up to the ayah atom — this is what keeps the scheduler tractable at surah
scale, and it's the reason multi-surah in v3 is affordable.

### Bands — the stage IS the band
`lapsed` < 0 · `learn` 0–39 · `reinforce` 40–79 · `carry` 80–100.

### Decay
`retrievability(atom, now) = exp(−Δt / stability)`, Δt in learning-days
(`engine/src/strength.ts`). FSRS-*shaped* but tuned per-ayah rather than full FSRS-4.5 word
weights. `currentStrength()` is the stored strength decayed to now; the stored value is what it
was at `lastRetrieval`.

### `assembleQueue()` — fixed order (`engine/src/scheduler.ts`)
1. **Make-up** — only after a genuinely *skipped* day (gap ≥ 2 learning-days). A normal
   next-day return is not a make-up.
2. **Gates** — day-1 cold checks now due.
3. **Reviews** — ranked by `forgettingRisk × weight`; connection atoms weighted ×1.5.
4. **Learn** — a new ayah, only if `unlockPermitted`.

A ~6–8 min time budget trims the queue, but **gates and make-ups are never dropped** — they
define the minimum viable session, so a session is always finishable.

### The cold gate — the spine of the schedule
Produce an ayah whole (S3) → a gate is armed for the **next learning-day**. "Cold" = first
attempt of a fresh day, no warm-up. A new ayah unlocks only when yesterday's encodings pass
their gate. That single rule is what stops a learner racing ahead and collecting ayat they
cannot hold.

Tolerance band (v2-D07): Sprint allows 1 pending gate; Steady/Maintain are strict.

**Forgiveness ladder (v2-D08):** a failed gate re-arms for the next day and increments
`gateFails`. After repeated fails the app *offers* to send the ayah back to Learn — the learner
accepts; it is never forced. Post-lapse stability is **damped ×0.4, never zeroed**. Losing a
week of work to one bad morning is what makes people quit.

## 3 · The five locked invariants

| # | Rule | Why |
|---|---|---|
| 1 | The atom is the **ayah** | Never per-word. ≤221 atoms/learner keeps scheduling tractable. |
| 2 | The **event log is truth** | `atoms` is a rebuildable cache; `rebuild()` folds events → state. |
| 3 | First-pass meaning errors are **pretest** | Excluded from strength. You cannot fail at something nobody taught you yet. |
| 4 | **Evidence asymmetry** | Errors full weight; massed same-day successes damped ×0.35; spacing measured between **retrievals**, never app-opens. |
| 5 | Only **structured** sessions mutate | Free-play is evidence but moves no strength. Playing around cannot corrupt your schedule. |

Invariant #4 is the one that matters most. "Spacing measured between retrievals, never
app-opens" separates an honest SRS from a streak-farming app — opening the app is not learning.
And damping massed successes to ×0.35 means cramming the same ayah ten times in one sitting is
worth roughly three spaced reps, not ten. The engine refuses to be gamed.

## 4 · Retention monitoring (`/progress`)

The learner-facing surface shows:

- **Half-life** — `halfLifeDays() = stability × ln 2`. "9.4 days before you'd forget half,
  unreviewed." This is the headline metric, not the streak.
- **Decay made visible** — `decaySince()` renders "72% → 64% since Thursday" on due items.
- **Band distribution** — where your ayat sit across carry/reinforce/learn/lapsed.
- **Honest slippage** — "3 ayat are slipping. Not a failure — this is what memory does."

**The honesty rule:** these are the *same numbers the scheduler uses*, read straight off the
atom's stability. Nothing is decorative. An app that shows a green dashboard while its own
scheduler thinks the learner is lapsing has lied to them. Retention is the product, so the
retention numbers must be the real ones.

**Deliberately absent:** streak as hero metric, "97% done!" while 3 ayat lapsed, guilt copy on a
missed day, leaderboards. `streak.ts` exists but is never the headline.

### What multi-surah changes — the one genuine v3 extension
With N surahs there are **N independent decay curves competing for one daily budget**. Progress
needs a per-surah breakdown *and* a combined load view; otherwise a learner adds a third surah
and silently starves the first two. The library's "Add" confirm (§2) is where that cost must
surface *before* they commit.

### Server-side (Laravel)
Once events sync, the same fold runs server-side for cohort retention curves, which distractors
mislead most, where learners stall (expect: chains), and FSRS calibration — predicted vs actual.
None of it needs new instrumentation; it is the same 19 events, folded differently.

**Target metric** (from `../tiktok-discussion.md`): P(recalled in 10 years), *not* DAU.
"Maximize successful retrievals per minute." The labelled event log is what makes that
measurable — that dataset is the moat, not the quiz UI.

---

## Suggested build order

1. **Surah-key the schema (E-01)** — `atomKey` becomes `` `${surah}:${kind}:${ref}` `` and
   `AtomState` gains a `surah` field. **Ships no UI.** See below for why this is first.
2. **Route shell + design system** — port `v1/styles/iman-ui.css` verbatim (locked: Amiri-first,
   teal=learn, coral=slips-only, purple=meaning, no shadows/gradients).
3. **Event log + append discipline** — IndexedDB. Events already carry `surah`; honour it on the
   **read** path too (`rebuildAtoms()` currently folds every surah into one map).
4. **Corpus loader, surah-agnostic** — lift v2's `loadCorpus`; drop the hardcoded `SURAH = 12`;
   cache per surah (E-07).
5. **Engine port — single pass** — `atoms` / `update` / `rebuild` / `chain` / `scheduler`, pure
   TS with its 24 test files. Apply the E-01 keys, the BUG-3 chain fix, and the E-03 / E-08
   surah scoping *together*, in one port.
6. **Multi-surah dashboard** — MY SURAHS with per-surah independent schedules. *The real new work.*
7. **Macro panel** — per-surah structure map; flat 1→N grid fallback for short surahs.
8. **Drill + chain cards** — tap-to-reconstruct and the chain card type. The engine is already
   ported at step 5; this is the surface only.
9. **Continuous drill — range (§13)** — a range picker over the existing `chainSteps()`. No
   engine work. Expose both modes: graded repair vs victory lap (v2-D11).
10. **Progress list + a11y (§15)** — semantic table, sortable/searchable, time-on-task column;
    the ring's documented text alternative.
11. **Forecast calendar (§14)** — `planFor()` projected onto real dates. Measured pace, active
    days, re-forecast every session. Fix E-06 first.
12. **DATA: mushaf geometry — half done.** The map is fetched, validated and committed
    (`v3/docs/data/yusuf-geometry.json`). Remaining: enrich `yusuf-verses.json` and un-null
    `buildCorpus.ts:54`. See §13c.
13. **Continuous drill — page (§13)** — page presets over the same chain engine, unblocked by
    step 12. Juz/hizb units come free from the same data.
14. **Onboarding flow (§17)** — recall before identity. Anonymous-first is already the backend
    (v2-D03), so this is the flow finally matching what the API supports.
15. **Sync outbox → Laravel** — best-effort, idempotent by client uuid, never blocks.
16. **Admin console (§16)** — desktop shell; build `fold_determinism_check` first, since it is
    what monitors invariant #2. Pseudonymous by default; reveal-with-reason is audit-logged.
17. **Landing page (§18)** — ship *after* the demo drill works; the inline demo is the
    conversion engine.
18. **Feature-flag plane (§20a)** — build **before** any social feature. Enable-hard /
    kill-easy asymmetry. No social code ships without a working kill switch.
19. **Streak calendar + rest-day covers** — `streak.ts` already computes the activity set
    (`completedDayIndices`, v2-D50).
20. **Profile · friends · invites (§19)** — the first genuinely new backend: no social event
    types and no social tables exist yet.
21. **Notification governance (§20c)** — templates and the dark-pattern gate *before* the first
    send.
22. **Together-streak + XP** — highest risk. Ship behind holdout cohorts and judge on
    P(recall@10y).
23. **Fix B1–B4 (§22)** — one week, user-visible: kill the `custom` no-op, add the verification
    content hash, fix tie ordering, move the grading rung out of React.
24. **Question compiler (§22)** — ~4 weeks; pays off around the 12th question type. Build
    against `reconstruct.ts` + `test.ts` **only** — ladder/bridge/chain are unreachable.
25. **Admin ayah workbench (§22b)** — three panes; every answer slot is a word-picker.
26. **Site model + `admit()` (§23)** — Sites (`ayah` | `seam`) and the fibre-aware admissibility
    predicate. Fixes `bridge.ts:14` *by construction* and kills two-correct-answer questions.
27. **Recorded `visitOrdinal` + rotation** — stamp `siteKey`+`visitOrdinal` at emit (because
    `mergeFromServer` drops `seq`). Add `selection_determinism_check`.
28. **Auth · settings · paywall (§24)** — adoption, not a wall (v2-D03). The paywall must keep
    reviews open 7 days: charge for access, never hold memory hostage.
29. **Landing page (§25)** — Apple method. Ship *after* the demo drill works.
30. **Recommender** — last.

### Why E-01 is step 1

It is a **schema decision, not a feature**. The event log (3), the corpus loader (4) and every
fold in the engine (5) are written against the atom key — so deciding its shape afterwards means
rewriting all three.

Settle it before any of them exist and the fix is ~20 lines. Settle it after a learner has two
surahs of history and it becomes a data migration over a log whose atoms have already merged
ambiguously — and replaying the log does not repair it.

Step 1 ships no UI. That is the point: it is the one decision every later step folds through.

*(Previously this sat at step 4, behind two steps that already assumed surah-keyed storage, and
the engine port was duplicated across steps 4 and 7. Both are corrected above.)*

### Scope warning
The recommender is the piece most likely to eat the project. It only becomes meaningful once a
learner has 2+ surahs and real vocabulary-overlap data. Until then, a hand-ranked list of ~15
short, high-utility surahs beats any algorithm and takes an afternoon. Ship that; earn the
algorithm later.

### Reuse from v2 — do not rewrite
- `engine/` — strength, decay, scheduling
- `corpus.json` — 111 ayat / 1777 words / 8885 distractors
- `iman-ui.css` — the locked design system
- the append-only event log + atoms-rebuild pattern

---

---

# Edge cases

Derived by reading the v2 engine against v3's multi-surah requirement. These are not
hypotheticals — each cites the code that is correct for one surah and wrong for many.

## E-01 · Atom key collision — **hard blocker**

```
atomKey(kind, ref) = `${kind}:${ref}`     // engine/src/atom.ts:69
```

`AtomState` has **no `surah` field**. `rebuildAtoms()` (`db/atoms.ts`) reads *every* event and
folds them into one map; `rebuild()` never reads `e.surah`.

**Therefore Yusuf ayah 5 and Al-Mulk ayah 5 are the same atom.** Reviewing one credits the
other; strength, gate state and due-dates silently merge. It is invisible in v2 because v2 ships
one surah. The event log already carries `surah` — only the *fold* is blind to it.

**Fix:** surah rides the key (`${surah}:${kind}:${ref}`) plus a `surah` field on `AtomState`.
Do it during the engine port, never after. Once a learner has two surahs of history the log
cannot be un-merged by replaying it — the events are fine, but the atoms they produced are
ambiguous. ~20 lines now; a data migration later.

## The rest

| # | Case | Problem | Fix |
|---|---|---|---|
| **E-02** | One budget, N decay curves | `assembleQueue()` takes one atoms array and one `budgetMin`. Three surahs either starve two or silently triple the session. | Assemble per surah, merge under one global budget. Allocation must be explicit — recommend risk-weighted across all surahs, never round-robin. |
| **E-03** | `unlockPermitted()` spans surahs | Filters `atoms` for pending gates with no surah notion, so a pending gate in Al-Mulk **blocks new learning in Yusuf**. | Scope the gate check to the surah being learned. Cross-surah blocking is never intended and is invisible when it happens. |
| **E-04** | Streak is global, surahs are not | `computeStreak()` folds completed-days across all events. Finishing Al-Mulk keeps the streak alive while Yusuf rots. | Keep one global streak — it's a habit metric, not a mastery metric — but never let it imply per-surah health. §10's per-surah decay is the honest view. |
| **E-05** | Pace is per-learner, not per-surah | `paceConfig()` returns one `budgetMin` + `newAyahCeiling`. Sprinting Al-Mulk while maintaining Yusuf is unexpressible. | Make pace per surah, with the global budget as ceiling. "Maintain" becomes the natural parking state. |
| **E-06** | `planFor()` assumes one remainder | `etaDays` uses one surah's `remainingAyat` against the **full** daily budget — every surah's ETA claims the whole day. | Divide the budget by active surahs. This is exactly the number the library's "Add" confirm needs: show the *re-computed* ETA of existing surahs, not just the new one's. |
| **E-07** | Corpus fetch per-surah, unguarded | `loadCorpus(surah)` fetches `/corpus/{n}.json` with no cache. N surahs = N fetches per load; one 404 breaks the page. | Cache per surah; render MY SURAHS from the event log + a small manifest; lazy-load full corpus on the surah page. A missing corpus degrades to a disabled row. |
| **E-08** | Chains must not cross surahs | `chain.ts` joins n→n+1 by number; nothing stops a chain from one surah's last ayah to another's first. | Bound chains to `[1, ayahCount]` of their own surah. The last ayah of every surah has no outbound chain — a real terminal case, not an error. |

## Learner-facing

| Case | When | Then |
|---|---|---|
| Zero state | No surahs added | No "Continue" CTA. Lead with recommender + library; never an empty MY SURAHS box. |
| Returning after weeks | Everything due at once | `resumePolicy()` → `makeup`. Cap the queue, say what was deferred, keep the session finishable. |
| All surahs finished | Nothing left to learn | Maintain becomes default; reviews only. The recommender's moment. |
| Surah completed | Last ayah passes its gate | Celebrate at the **surah** level. The app's biggest emotional beat — §5 needs a distinct completion state. |
| Learner pauses a surah | Explicit pause | Stop scheduling new, keep reviews optional, **freeze nothing** — decay is real. Unpausing shows the true decayed state, not the state at pause. |
| Same ayah, two surahs | Basmala appears in many | Identical Arabic, different atoms. Do **not** dedupe — position in the surah is part of what's memorized. |
| Very short surah | Al-Kawthar = 3 ayat | `etaDays≈1`, only 2 chains. The ring is meaningless at n=3 → fall back to the flat 1→N grid (v2-D29). |
| Device shared / reset | `resetForNewLearner()` | With N surahs the confirm must name what is lost. A generic "reset" is far more destructive now. |
| Clock / timezone shift | Travel across the boundary | `daybound.ts` uses local wall clock with 04:30 rollover. A westward flight can make `daysBetween()` return 0 for a real day, so massed damping wrongly applies. |
| Offline for days | Outbox grows | Local commit already happened; learning is unaffected. Surface "N pending" quietly; never block a session on sync. |

**The one that bites first is E-01.** Everything else degrades gracefully or is a UX gap. The
atom-key collision silently corrupts memory state and cannot be repaired afterwards by replaying
the log.

---

# Daily continuous drill (§13)

Two selectable units for one mechanic: recite a **run** of ayat end-to-end, junctions included.

## Most of this already exists

`chainSteps(from, to)` in `engine/src/chain.ts` **already takes an arbitrary range** and emits
`ayah n → junction(n→n+1) → ayah n+1 → …`. `applyChain()` FIRe-credits every traversed atom in
one pass. So "chain a few ayat together" needs **no new engine work** — only a range picker on
top of what's there.

## Two modes, already locked (v2-D11)

| Mode | Call | Behaviour |
|---|---|---|
| **Graded — repair run** | `applyWeakSeamChain` (`structured: true`) | Slips cost strength. A real practice tool. |
| **Victory lap — free run** | `applyVictoryLapChain` (`structured: false`) | Every step still lands in the event log (streak/heatmap evidence), but `update()` no-ops — a slip during a celebratory run-through can **never** damage a strong verse. |

The picker must expose this choice honestly. It is the difference between practice and
performance, and hiding it would make a victory lap feel unsafe.

## Unit A — ayah range (ships first)
Two sliders, from/to. The resolved chain is shown before starting: *"6 ayat + 5 junctions,
11 steps, est. 8.6 min."*

## Unit B — mushaf page

**Decision (2026-08-10): Madani 15-line**, the King Fahd Complex standard — 604 pages, the most
widely used mushaf for hifz, and what most huffaz visualise.

**Verified against the live API on 2026-08-10:** Quran.com API v4 exposes `page_number` per
verse. Surah Yusuf spans **pages 235–248** — 14 pages, median **8 ayat/page** (range 4–11).
That makes a page a well-sized daily portion, and one the learner recognises from the mushaf in
their hands rather than an abstract ayah count.

## §13c — 乗り越える: the blocker is cleared

Researched and executed 2026-08-10. This is not a plan — the geometry is fetched, validated and
committed at **`v3/docs/data/yusuf-geometry.json`** (111/111 ayat).

### The original framing was wrong

I previously wrote *"add `page_number` to the compiler fetch."* **`buildCorpus.ts` doesn't
fetch.** It maps over a static file, `data/yusuf-verses.json`, read by `io.ts:34` — and that file
carries only `{ verse_number, text_uthmani, words[] }`, no geometry at all. The fix is *upstream*
of the compiler, in the data.

### The four steps

| # | Step | Detail | Status |
|---|---|---|---|
| 1 | Fetch geometry | `curl` per surah with `fields=page_number,juz_number,hizb_number&words=true&word_fields=line_number` | **done ✓** |
| 2 | Guard completeness | Assert 111/111 before writing. (The v0.1 lesson: small pages + a guard, never per-ayah fan-out.) | **done ✓** |
| 3 | Enrich the source | Add `page_number` + `line_number` per verse in `data/yusuf-verses.json`; `RawVerse` gains two optional fields. | recipe |
| 4 | Un-null the compiler | `buildCorpus.ts:54` — replace `page: null, line: null` with `v.page_number ?? null, v.line_number ?? null`. Two lines. | recipe |

### The gotcha — would have silently mis-assigned 95% of verses

**105 of 111 Yusuf verses span more than one line** (measured, not assumed). So `line` can only
mean **the first line the verse appears on** — never "the line." Ayah 1 = page 235 **line 11**
(Yusuf starts mid-page); ayah 5 = page 236 line 1. If true line-level drilling is ever wanted,
the unit is the **word**, not the verse — word-level `line_number` is available from the same
call.

### What came free

The same request also returns `juz_number`, `hizb_number`, `rub_el_hizb_number`, `ruku_number`
and `manzil_number` per verse. Each is another ready-made unit for the §13 picker and the §14
calendar — *"one hizb a week"* is a common hifz rhythm. Yusuf spans juz 12–13, hizb 24–25. No
extra work: add them in the same enrich step.

### Surah-agnostic by construction
`page_number` is universal, not Yusuf-specific — verified on Al-Mulk (surah 67 → page 562). Step
1 is a loop over whichever surahs the library ships, so adding a surah stays a compiler run,
exactly as v2-D29 requires.

### Offline fallback
The geometry is 111 integers per surah and is **committed to the repo**, so a rebuild never needs
the network again. Static alternatives exist (`quran-meta` on npm, `@quranjs/api`) but are
unnecessary once the map is checked in.

**Operational note:** `urllib` gets HTTP 403 from the API — use `curl`.

**Partial pages:** a chain only credits atoms the learner has actually encoded (the BUG-3 gap
guard in `applyChain`). Un-learned ayat on a page are therefore **skipped, not failed** — the
UI must say so, or a 7/10-ready page looks like a 30% failure.

---

# Schedule & completion forecast (§14)

## Already half-built
`planFor()` in `engine/src/capacity.ts` returns `{ ayahPerDay, etaDays, remaining }` from
`remainingAyat`, `avgWordsPerAyah` and `minutesPerDay`, using Appendix A's cost model
(`T ≈ 0.33·W_new + 0.4·R_due + 1.25·chains + 0.17·junctions`).

v3 needs to (a) fix **E-06** — divide the budget across *active surahs* rather than giving each
the whole day — and (b) project `etaDays` onto a real calendar with milestones.

## Honesty rules for a forecast

- **Use the learner's measured pace, never the nominal one.** `planFor()` already takes
  `minutesPerDay`; feed it observed minutes.
- **Count active days, not calendar days.** Someone who drills 4×/week finishes later, and the
  date must say so.
- **Re-forecast after every session.** A date that never moves is a promise, not a prediction.
- **Show the assumption inline** ("1/day, ~6 min") so a slipping date is explainable.
- **Never shorten the date to motivate.** That single lie would destroy the retention-honesty
  stance in §10.

## The first-week ramp
`planFor()` returns `habitProtocol: { underloaded: true, secondThreadFromDay: 3 }`. The forecast
must reflect that deliberate ramp, or week 1 will always look "behind."

---

# Time measurement & the accessible progress list (§15)

## What is already timed

| Signal | What it captures | Status |
|---|---|---|
| `DrillEvent.latency` | ms per tap — the time-per-word metric (v0.6) | built |
| `sessionSummary.durationMs` | first tap → last tap, formatted `m:ss` | built |
| `session_start.latency` | app-open → first drill (v0.8) | built |
| `resumePolicy()` | classifies gaps; discards interrupted latencies | built |
| per-ayah time-to-encode | sum of latencies, first tap → S3 pass | derive |
| per-page / per-chain time | sum over a continuous run (§13) | derive |
| time-to-carry | first encounter → strength ≥ 80 | derive |

**Nothing new needs instrumenting.** Every "derive" row is a fold over latencies already in the
event log.

One caveat: interrupted latencies are discarded by design (`resume.ts`), so time-taken must be
reported as **time on task**, never wall-clock — otherwise a learner who took a phone call looks
slower than they were.

## "Ensure progress list is accessible" — read both ways

**1. Reachable.** The ring (§3) and the heatmap are pictures. A plain, sortable, searchable
**list of all ayat** must exist as its own route (`/progress/list`) — it is the only view that
scales to a learner with five surahs, and the only one you can search.

**2. Accessible (a11y).** This is where a colour-coded ring fails hardest:

- **Never colour alone.** Every stage carries a text label *and* a number. Teal and coral are
  near-indistinguishable to the ~8% of men with deuteranopia.
- **Semantic `<table>`** with real headers, not a grid of `<div>`s — so a screen reader announces
  "Ayah 3, lapsed, 48%."
- **Arabic is `dir="rtl"` with `lang="ar"`**; UI chrome stays `dir="ltr"`. Mixed-direction rows
  are the classic bug here.
- **Tap targets ≥44px** (already v2-D28).
- **The ring's text alternative is this list**, documented as such — not `aria-label`s bolted
  onto `<circle>` elements.
- **Respect `prefers-reduced-motion`** on progress animations.

## The time column
Per-ayah cumulative time-on-task answers "measure time taken for every progress." It is also the
most motivating *honest* number the app has: *"ayah 1 took you 48 seconds this week, down from 3
minutes"* is real evidence of fluency — unlike a streak badge.

---

# The Plan calendar (§14) — promoted to first-class

**v3-D05 (2026-08-10):** the calendar is no longer a forecast readout inside the surah page. It
is its own route (`/plan`) and its own **tab**, replacing "You" in the bottom bar.

*"Calendar is a must to ensure predictability."* Predictability is a product promise, and a
promise needs a surface.

## Confidence decays with distance — the honesty mechanic

Reviews are generated from measured decay, so far-future days genuinely cannot be known. Rather
than fake precision, the UI shows its own confidence dropping:

| Horizon | Fidelity | What is shown |
|---|---|---|
| today → +3d | **concrete** | Exact items: "gate ayah 13, 6 reviews, learn ayah 14." |
| +4d → +14d | **estimated** | Load only: "~9 min, ~11 items." Kinds shown, specific ayat not. |
| +15d → end | **trajectory** | Just the shape: "~8 min/day, finishing mid-March." |

**Why this isn't a cop-out.** Populating every future day with specific ayat would look more
satisfying and would be a lie — a review three weeks out depends on how the next twenty sessions
actually go. Inventing that precision breaks the same contract as §10's retention numbers.

The learner still gets predictability, because the **commitment** is stable (~8 min/day, 1 new
ayah) even when the item list isn't. **Predictable effort, honest detail.**

## Planned absences
Any future day can be marked *away* — travel, exams, illness. The forecast adjusts honestly
instead of scoring it a miss. This matters because the alternative teaches learners that the
calendar punishes life.

---

# Admin console (§16) — desktop operator surface

Full redesign, desktop-native. v2's 4-tab console is treated as a prototype; the seven Laravel
endpoints are reused.

**Shell:** 220px persistent sidebar (Overview / Users / System Health / Learning Science / Qari
Review / Audit Log), 56px top bar with environment badge, live sync-lag chip, and alerts bell.

## Login fails closed — and says nothing
Wrong password and not-on-the-allowlist return the **same** generic error: *"Not authorized for
operator access."* No signup link, no reset link, no hint which failed. Otherwise the login form
becomes a free oracle for *"is this address an admin?"*

## The key widget: `fold_determinism_check`
A nightly job re-folds a sample of the event log from scratch and compares it to the live atom
cache. It must be 100%; **any** divergence is the highest-severity page.

This is the single best idea in the spec. It means the cache disagrees with truth — exactly the
failure invariant #2 exists to prevent. Without this check, invariant #2 is a *claim*; with it,
it is **monitored**. Build it first.

## Privacy by default
Every learner is pseudonymous everywhere (`u_7f3a…`). Email and name sit behind a **Reveal
identity** action requiring a typed reason, audit-logged, auto-re-masking after 15 minutes. Bulk
CSV exports strip identity entirely.

This deserves a higher bar than product-analytics norms: the event log records how a person
engages with the Qur'an, which is unusually intimate data.

## No engagement-bait metrics — anywhere
Deliberately no DAU tile, no streak leaderboard, no session-count hero. The north star is
`P(recall @ 10y)`. An operator console that celebrated DAU would quietly steer the product
toward the thing §10 refuses to optimise for. **The console must embody the same values as the
learner-facing app, or it wins the argument by default.**

## Staff may never edit graded state
The Events tab is read-only. The only mutating action is *"Rebuild atom cache from events"* —
which re-derives, never invents. Qari overrides are an **additive layer**; the base corpus is
never mutated, and every override requires a typed rationale and is attributed permanently.

---

# Strategic onboarding (§17)

**Governing rule: recall before identity.** No account, no email, no notification prompt until
the learner has produced an ayah from memory.

| # | Screen | Skippable | Purpose |
|---|---|---|---|
| 1 | The honest promise | no (~5s) | Sets the retention frame so gates/calendar/half-life read as coherent later. No carousel. |
| 2 | **First recall, immediately** | no (~45s) | Live tap-to-reconstruct of Al-Ikhlas 112:1 in three passes. |
| 3 | Gloss language | no, one tap | EN / MS. Default = device locale. |
| 4 | Placement probe | **yes**, default fresh | 3 narrative-landmark probes seed FSRS priors as "known but unstable." |
| 5 | Choose your surah | no, pre-selected | Default Al-Mulk — 30 ayat, ~5 weeks. The learner's one real choice. |
| 6 | Pace | no, pre-selected | Steady / Sprint / Maintain, with a live 7-day load strip. |
| 7 | First real session | — | Cold gate armed. **Only now** does the app ask for notifications or an account. |

**The single most important moment is screen 2.** A successful blind reconstruction inside the
first minute proves the mechanic and the learner's own capability — before anything has been
asked. Most apps lose users at a signup wall or a seven-question quiz placed *before* any value
exists.

**Total data captured:** gloss language, optional placement priors, surah, pace. Nothing else.
Every field is consumed by the scheduler; if a question doesn't change what the engine does
tomorrow, it isn't asked.

**This is not new backend work.** v2-D03 already shipped Sanctum auth as anonymous-first with
account adoption — the flow is finally matching what the API supports.

**One risk:** screen 2 uses Al-Ikhlas because nearly every target user half-knows it. That is
also its risk. Mitigation: pass 1 *shows* the full ayah before any recall is asked — nobody is
tested on something they were never shown.

---

# Landing page (§18)

Converts on **recognition of a private failure** — *"I memorized Al-Mulk twice and lost it
twice"* — plus proof the mechanic is effortless.

| § | Section | Key content |
|---|---|---|
| 1 | Hero | **"You memorized it. Do you still have it?"** CTA: *"Start with one ayah — free, no account."* |
| 2 | **Interactive demo** | A fully working tap-to-reconstruct of Al-Ikhlas 112:1, inline, no install. |
| 3 | The mechanism | Rebuild-don't-reread · the overnight gate · an honest number (half-life). |
| 4 | The plan | Calendar screenshot: *"we never shorten it to flatter you."* |
| 5 | Objections | Weak tajwid · "another streak app?" · which surahs. |
| 6 | Proof without users | Cited science · builder's note · open build log. **No fake testimonials, ever.** |
| 7 | Pricing | **v3-D07:** *"Try one surah free. Then RM20 a month."* Lifetime RM500 / USD200. |
| 8 | Footer | *"No ads. No selling data. No dark patterns. No guilt notifications."* |

**The demo is the conversion engine.** The mechanic sells itself; describing it does not.

**Pricing:** no feature-gate on retention itself. Paywalling remembrance of the Quran is both
ethically wrong and — per the market research — unenforceable at the willingness-to-pay in core
markets. Diaspora/Gulf supporters subsidise.

**A/B test first:** hero headline, loss-framed vs mechanism-framed. Then demo above vs below the
mechanism section.

**Primary conversion metric:** *demo-qualified starts* — visitors who complete the inline
reconstruction **and** tap the CTA. Downstream north star: D1 gate-pass rate. Explicitly **not**
email captures or raw taps, which reward a landing page that lies.

## On "surely convert"
No landing page surely converts, and the tactics that promise it — fake urgency, invented
scarcity, borrowed testimonials — are exactly the ones that would be unethical here and would
poison trust with this audience.

What this page does instead is remove every reason to disbelieve: it lets you *do* the thing
before asking anything, cites its science, shows its real numbers, and states its ethics. That
is the highest-converting honest page available.

**Consistency check:** every claim on the page is backed by a surface in this wireframe — demo
→ §5, overnight gate → §8, half-life/decay → §10, calendar → §14, structure map → §3, EN/MS
glosses → v2-D27. Nothing is vapourware.

---

# Social & motivation (§19 learner · §20 admin)

**This is the first genuinely new backend surface in v3.** Everything else so far has been a
port of v2's proven engine. Verified 2026-08-10:

- `engine/src/types.ts` has **no** friend / invite / xp / freeze / notification event types.
- `v2/api/database/migrations/` has **no** social tables — only users, cache, jobs, tokens,
  events, question_overrides, ayah_verifications.

So friends, invites, XP and notifications need new event types, new tables, and new endpoints.
They are **not** a UI layer over existing data, and should be costed accordingly.

## What already exists and can be reused

`engine/src/streak.ts` is further along than expected:

- `computeStreak()` returns `{ length, atRisk, pausedOnMiss, makeupAvailable, lastActiveDay }`.
- **A miss pauses the streak; it never zeroes it.** A make-up day repairs exactly one missed day.
- `completedDayIndices()` already produces the activity set a **streak calendar** renders from
  (v2-D50) — deliberately *not* gated on `structured`, so a victory-lap chain or a Test still
  marks the day active even though neither moves strength.
- The file's own header says: *"De-emphasize length (PRD anti-pattern: streak-as-idol) — the
  model exposes the facts; the UI keeps it quiet."*

Freeze tokens were already specified in `data/srs-engine.json` ("earned every 7 days,
auto-protects one missed day"), alongside a "sabr jameel" recovery that restores rather than
zeroes.

## The six guardrails these features are designed against
Recorded in `data/srs-engine.json` — not invented for this section:

1. **Session satiety cap** — the app refuses binge-cramming.
2. **Niyyah & adab framing** — the mushaf is treated with respect; never game tokens.
3. **No dark patterns** — no loss-framed pushes, no pay-to-win, no shaming.
4. **Streak idolatry brake** — as streaks grow the UI *shrinks* the number and elevates
   ayat-retained instead.
5. **Meaning not just sound** — every drilled word links to meaning.
6. **Retention honesty** — never fake mastery for engagement.

## The highest-risk feature: friend streaks
A shared streak makes *another person's* lapse **your** loss. That is precisely the mechanic
that manufactures guilt, and guilt is the thing sabr jameel exists to prevent. It gets the most
careful treatment in §19 and is the first candidate for the kill switch in §20.

## §19 learner UI — how each risk was neutralised

| Feature | The risk | How it's solved |
|---|---|---|
| **Together-streak** | A partner's lapse becomes *your* loss — manufactured guilt | On either lapse the state is just *"Paused — it resumes when you both return."* The UI **never says who missed**, and the other person is **never notified**. Solved at the data layer, not with careful copy. |
| **Friends list** | Becomes a leaderboard | Sorted **alphabetically**, never by streak. "No session yet" is a hollow muted circle — never coral, which is reserved for slips. |
| **Avatars** | Profile-photo moderation, aniconism concerns | Geometric khatam/star/arabesque tiles. No photos, no faces, no mascots — safe *by construction*, and it deletes a whole moderation category before it exists. |
| **Points/XP** | Becomes the goal; incentivises faking mastery | **+10 for a review answered honestly — right or wrong, identical.** Zero points for speed. Daily cap = one session. Above 10,000 it renders as "10k+" in caption size. Buys only cosmetics and a waqf tree. |
| **Streak freeze** | Panic purchases, midnight bargaining | Auto-applied, never purchasable, max two held. *"If you miss a day, a cover is used for you — nothing to activate, nothing to buy."* |
| **Streak calendar** | Misses read as failure | **No coral anywhere on the grid.** Pauses, covers and repairs each get their own dignified marker. Footer: *"Day 41 · paused twice, repaired once — still yours."* |
| **Word performance** | Feels like a report card | Framed as *"Words asking for your attention"* with *"your review plan already includes all of these."* No percentages, no scores. Always shows a "getting steadier" section. |
| **Notifications** | Loss-framed nagging | One learner-set window, max 1/day and 5/week, algorithmic types ranked so only the top one sends. Repair prompts go out the **next** window, never the same night. |

## The honest measurement (§20)
Gamification is judged on **D30 retention and P(recall @ 10y)** for cohorts with the features on
versus off — **never** on DAU or session count. If a feature raises engagement but not
retention, it is doing harm disguised as success, and the admin view must make that visible
enough to turn it off.

### The row that justifies the whole screen
The wireframe shows a worked example in the cohort table:

```
friend_streaks    D30 retention  +6.4pp
                  P(recall@10y)  −1.2pp     → VERDICT: HARMS
```

Engagement **up**, actual memory **down**. People come back more and remember less — the shared
streak pulls them into cramming that satisfies the streak without spacing the retrieval. On a
DAU dashboard that feature looks like a win and ships to 100%. On this one it is killed.

### Enable is slow, kill is fast
Ramping a flag to 100% requires a reason ≥20 chars, two ticked ethics boxes, **and** typing the
feature name verbatim. Killing requires one click and a reason — then pins a banner until a
second admin acknowledges it.

Most feature-flag UIs make both symmetric. That is how a dark pattern stays live over a weekend
because turning it off required a deploy.

### The streak-idolatry monitor
A chart of *"% of sessions in the last 2h before local midnight"* per cohort, amber line at 15%.
A midnight-cramming spike is the measurable signature of streak idolatry — drilling to protect a
number rather than to remember.

This turns a values statement into a **metric**, the same move `fold_determinism_check` makes
for invariant #2.

### Moderation never opens learning data
An operator reviewing a harassment report can see the report reason, the reported message,
behavioural counts, and pseudonyms. They **cannot** see identity (except audited impersonation
cases), any Quran progress, or strength/lapse data. And "suspend social features" leaves full
SRS access intact — *we never take away someone's Quran review.*

### Notification templates are governed artifacts
No template sends without passing a five-point dark-pattern review: not loss-framed, no guilt
language, respects the satiety cap, honest claim, and **silence-positive** (it must have a
defined condition under which it does *not* send). The author may never self-approve. Any
template whose opt-out rate exceeds 3% over 7 days is auto-paused.

---

# Can you memorize a page or a surah by only playing the quiz? (§21)

**Verdict: mostly yes — to *cued* recall. Not, today, to *free* recall.**

The quiz can take a learner to producing every word of a page in order, cold, from a fully
blanked ayah. It cannot yet prove they can recite it with nothing on screen, because the word
bank is always present. That gap is one unbuilt feature, not a flaw in the method.

## The ladder of recall — how far each drill actually reaches

| Rung | What it asks | Recall type |
|---|---|---|
| **S1** | pick the gloss of a lit word from 4 | Recognition — weakest evidence |
| **S2** | one word hidden, tap it from 4 | Cued recall; the surrounding ayah is the cue |
| **RC** | blanks grow with strength: 1 → half → **all** | Cued recall, scaling |
| **S3 / cold gate** | every word blanked, tapped in order, on a fresh day | **Cued production** — the real bar |
| *(missing)* | recite with nothing on screen | **Free recall — not built** |

Verified in the source: `reconstruct.ts`'s `blankCountFor()` returns `total` at Carry band, and
the cold gate forces `full: true` regardless of band. So full production genuinely happens. But
the learner still *taps from a bank* — recognising the right word among distractors is easier
than summoning it unaided, and §10's retention-honesty rule forbids calling that "memorized."

## The arithmetic — one median page of Surah Yusuf

Computed from the real corpus plus the mushaf geometry fetched in §13c:

| | |
|---|---|
| A median page | **8 ayat · 133 words** (Madani 15-line; range 4–11 ayat/page) |
| Taps to first-encode | **~399** (133 S1 + 133 S2 + 133 S3 in-order) |
| Time to first-encode | **~44 min** of new-Learn (Appendix A: 0.33 min/word) |
| Days at Steady (1 ayah/day) | **8 days** |
| Days at Sprint (3 ayah/day) | **3 days** |
| Atoms the page creates | **15** (8 ayah + 7 junction) |
| A full review pass | **~6 min** (0.4 min × 15) — but decay spreads it |

**Whole Surah Yusuf:** 111 ayat, 1,777 words, 14 pages → **~9.8 hours** of new-Learn to
first-encode, 221 atoms at the end, 111 days at Steady or 37 at Sprint. That is *first encode
only*; retention never ends, which is the entire product thesis.

## What the quiz does better than solo revision

- **It schedules the joints.** Junctions are separate atoms — most learners stall exactly at
  ayah transitions and never drill them deliberately.
- **It refuses to let you race.** The cold gate blocks new ayat until yesterday's hold.
- **It measures decay** rather than the feeling of fluency, which lies.
- **It forces meaning first** (S1 before S2/S3), so this is not parrot-memorization.

## Three things still needed to claim it honestly

1. **A free-recall rung.** v2-D05 already specified an optional *"hard mode (typed Arabic,
   diacritics forgiven)"* — never built. A cheaper option needing no keyboard:
   **recite-and-reveal**, where the learner recites aloud, then taps to reveal and self-marks.
   Weaker evidence, so it must be `structured: false` and move no strength — but it closes the
   loop honestly.
2. **Audio / tajwid.** The app teaches words and their order, not pronunciation, madd or
   ghunnah. A learner who only ever taps can produce a page correctly and still recite it wrongly.
3. **A human ear.** Tasmi' is how hifz has always been validated. The honest position: **the
   quiz is the daily driver; the teacher is the verifier.** The product should say that plainly
   rather than imply it replaces a teacher.

---

# Templating: Surah → Ayah → Quiz (§22)

Derived from first principles via a 10-agent workflow: three independent designs from different
starting axioms, each adversarially critiqued on invariant-safety and on practicality, then
synthesized. **Every claim below I re-verified against source myself.**

## The diagnosis — and the finding that changed the plan

There is no templating system. But the larger discovery is that **most of the engine I would
have templated is dead code.**

```
grep -rn "initLadder|nextItem|s1Options|bridgeItems|junctionItem" \
     src/pages src/session src/db src/admin src/corpus src/components
→ ZERO app callers
```

`ladder.ts` (281 lines, S1/S2/S3), `bridge.ts` (S4) and `chain.ts` (junction) are **unreachable
from the UI**. The live question surface is only:

- **`Drill.tsx` + `Gate.tsx` → `reconstruct.ts`** — the RC item, the *only* graded path.
- **`Test.tsx` → the six `test.ts` builders** — a read-only mirror that never moves strength.

This matters: any migration writing adapters for ladder/bridge/chain spends ~40–50% of its
budget on code no learner can reach.

## Four defects confirmed in source (all pre-date templating)

| | Defect | Evidence |
|---|---|---|
| **B1** | The `custom` override is a **loaded** no-op | `Admin.tsx:311` ships a free-text `{prompt, options[], correct}` editor; `AdminController` validates `'payload' => ['required','array']` and *nothing inside it*; `overrides.ts:139` pushes to `customs[]` unresolved; no renderer reads it. Rows accumulate now and become learner-visible the instant anyone builds the renderer — retroactively, with no review step. **An admin can type Arabic into `correct` today.** |
| **B2** | React decides the grading rung | `Drill.tsx:203` and `Gate.tsx:100`: `const rung: Rung = item.full ? "S3" : "S2";` Invariant #6 already leaks on the most consequential axis — S3 triggers `scheduleGate()` and grants `GAIN.s3` (30) vs `s2` (12). |
| **B3** | `ayah_verifications` has no content hash | Migration is `unique(surah,ayah)` + `verified_by` + `note` + `created_at`. A qari signs ayah 5; an admin then overrides its gloss; the row still reads verified. **The GATE-A "verified frontier" metric is provably lying today.** |
| **B4** | `applyOverrides` ties are unordered | `overrides.ts:117` sorts on `createdAt` alone; ties fall back to DB row order, and the seeder bulk-inserts rows sharing a millisecond. |

**Corpus facts** (measured against `public/corpus/12.json`): 1777 words, 8880 distractors, ranks
1–4 present for *every* position, 336 distinct roots. But `gloss.en` is 1777/1777 while
**`gloss.ms` is 0/1777** — the bilingual promise (v2-D27) has no Malay data at all. And **53 of
111 ayat contain duplicate EN glosses**, which makes the `seen` dedup in `s1Options` load-bearing:
any reimplementation dropping it emits questions with two correct answers on half the surah.

Baseline: 38 test files, 255 tests, green.

## The architecture — a closed-kernel, open-composition question compiler

One pure function: `buildQuestion(spec, ctx) → RenderItem | null`.

**The honest scope line:** *presentation, selection, foils and composition become data; retrieval
logic, sequencing and grading stay code.*

| DATA (admin-editable, append-only specs) | CODE (engine-owned, never templated) |
|---|---|
| which words/ayat a question is about (selector) | the sequencing state machines (`ladder`'s S1 pass, `reconstruct`'s `blankIndex`) |
| which foil kernel fills wrong options, + params | **grading** — a spec declares no rung, no pretest, no atom, no structured flag |
| prompt text (EN/MS — translation, not revelation) | the fold (`rebuild.ts` needs **zero** changes) |
| which of 4 render shapes; difficulty offset; blank policy | the 4 render shapes themselves |

> *"A template that can author a state machine is an interpreter — and an interpreter is where
> determinism dies."*

## Hard problem 1 — fold safety, solved

An append-only log referencing an open, editable set of spec ids, where the nightly
`fold_determinism_check` must match 100% forever.

**The rule: the fold never dereferences a spec id.**

1. **`Rung` stays a closed union forever.** Specs never extend it; `rebuild.ts` is unchanged.
2. **The event carries a denormalized snapshot, not a pointer.** `gradeClassToWire()` resolves
   to a literal `Rung` at emit time. Delete every spec tonight — no past fold can change,
   because there is nothing left to look up.
3. **Grading is derived from observation.** `"S3"` is returned only when the *engine* observed
   full coverage. A one-tap MCQ cannot declare itself S3 and forge an encoding event.
4. **Admin specs are clamped to `"ungraded"` server-side** → routed to `test_*` events, for
   which `rebuild.ts` deliberately has no branch at all (v2-D14).

This generalises what `reconstruct.ts` already does: RC never reaches the wire; it stamps its
S2/S3 equivalence class.

## Hard problem 2 — Quran authenticity, solved at the type level

**`CorpusRef` is a five-variant union of pure coordinates** — word, verse, gloss, distractor,
ayahNumber. **There is no `{ literal: string }` member.** Every answer and option slot is a
`CorpusRef` resolved by the single function `resolveRef(corpus, ref)`, which can only return
bytes already present in the compiled corpus.

An Arabic `Face` is `{ text, script: "arabic", from }` with `from` **mandatory** — only
constructible by a kernel that actually read the corpus at that coordinate. Provenance is
*produced*, not claimed. A test asserts `resolveRef(corpus, face.from) === face.text` for every
Face across a full-corpus sweep.

> *"There is no field in the entire schema, at any depth, typed `string`, that renders as Arabic.
> A field that does not exist needs no validator and cannot drift between the TypeScript and PHP
> codebases."*

## The render contract — four shapes, closed permanently

`choice` · `sequenceFill` (carries `cursor`) · `orderTiles` (carries `attempt`) · `locateChoice`.

A competing design argued for two shapes and survived *abstract* inspection. It fails on the live
code: `Test.tsx:529` (reorder) keeps a `reorderAttempt` accumulator and `Test.tsx:550` (produce)
renders from `ReconstructState`. A stateless two-member union can express neither, so both would
have stayed bespoke React branches — falsifying the whole "React branches on shape, permanently"
claim. The fix was to put the stateful fields *into* the render contract.

## §22b — the admin surah–ayah–quiz editor

Three panes: **ayah navigator** (with verification chips — green verified, amber *stale* when the
content hash no longer matches, grey unverified — turning the GATE-A frontier into a worklist),
**ayah workbench** (the learner's exact rendering, word-by-word, with an inspector), and **spec
editor + live preview** at three strengths using the *same* React components the learner sees,
plus an `explain()` trace.

**Can:** edit `gloss.en`/`gloss.ms`, replace distractor sets, group multi-word units, disable a
question type, author a spec (shape, EN/MS prompt, answer **by tapping a word**, foil kernels
with bounded params, difficulty offset), preview, tombstone.

**Cannot — structurally:** type Arabic into any answer or option field (no such field exists),
author a state machine, declare a spec's grading class, edit `text_uthmani`/`lemma`/`root`/`class`,
or change a past fold.

## Ship order: bugs first, compiler second
B1–B4 deliver user-visible value in about **one week**. The compiler is a **~4-week** investment
that only pays off around the **twelfth** question type. Fix the bugs, add the content hash, then
build the compiler — against `reconstruct.ts` and `test.ts` only.

---

# One ayah → many questions (§23)

Answers four questions: how many questions per ayah, how selection stays deterministic yet
varied, how ayat package into ranges/pages/surahs, and how edge cases are handled procedurally.

## The spine — a spec binds to a **Site**, never to "an ayah"

```
Site = { kind: "ayah" | "seam", surah, ayah: n }

siteToAtomKey is TOTAL:   ayah → ayah:n        seam(n) → connection:n
```

This is why *"a junction spans two ayat but specs bind to one"* never becomes a problem: **the
seam is itself a coordinate.** Invariant #1 is untouched — atoms stay per-ayah and
per-connection, the seam's atom key is `connection:n` (ref = the *from* ayah), and
`rebuild.ts`'s `junction_result` branch is unchanged.

## Q1 — Cardinality: three multiplications, filtered at the third

| Layer | What it is |
|---|---|
| **Site** | which coordinate — `ayah:n` or `seam:n` |
| **Lane** | which spec kind (`s1`, `cloze`, `rc`, `junction`, `locate`, `reorder`) — the unit of rotation |
| **Variant** | `variants()` *enumerates*; `admit()` *judges*, and admit is **fibre-aware** |

Measured on Yusuf 12:4 (31 words): s1 31→27 (4 dropped for prompt collision), cloze 31, rc 4,
locate 1, reorder 1, seam 1 → **6 lanes, 65 admissible items.**

Al-Asr 103:1 (one word): s1 1→0 (zero siblings), cloze 0, rc 1, locate degrades to 3-option,
reorder 1, seam 1 → **3–4 lanes, 4 items.** Honest, not padded.

**Exactly one item per served slate is graded** (the reconstruct pass); everything else is
`ungraded` → `test_*` events, for which `rebuild.ts` has no branch. Cardinality explodes; the
fold's input surface does not.

## Q2 — Determinism: record the ordinal, don't derive it

**The bug all three candidate designs hit.** Each derived a visit counter by folding the log.
All three break, and I verified why: `db/eventLog.ts:113` does
`const { seq: _drop, ...rest } = e` in `mergeFromServer`, so IndexedDB assigns a **fresh local
seq**. Log order is *arrival* order — two devices with byte-identical event sets would select
different questions. `ts` cannot rescue it (clock skew, millisecond ties).

**The fix:** stamp `siteKey` and `visitOrdinal` onto the event *at emit time*. Next ordinal is
`max(recorded for siteKey) + 1` — commutative and set-monotone, so it is immune to arrival
order, to a late sync, and to `getAll()` returning `[]` on a wedged IndexedDB. This is exactly
the denormalization pattern `gradeClassToWire()` already uses for `Rung`. Selection becomes a
**written fact**, so a bug report replays from the log alone.

**Rotation** is lane-first, then an affine cycle within the lane. `lapPerm` hash-permutes the L
lanes per lap, so every lane fires exactly once per lap (no starvation, structurally) while lap
*order* differs every lap (variety). `stride(N)` is computed in integer arithmetic — no float on
the selection path.

Measured on 12:4 (6 lanes / 65 items, 30 visits): 17/30 distinct items, **0 immediate repeats**,
perfectly balanced across lanes, 5/5 distinct lap orders. Stress-tested L=2..8 × 5 sites × 400
visits → max 0 immediate repeats. The seam guard must be a **rotation, not a swap** — the swap
was measured failing at L=2 with 59 immediate repeats.

**A new gate is required.** The nightly `fold_determinism_check` compares *atoms* and
structurally cannot observe selection divergence. Add `selection_determinism_check`: replay a
**shuffled** log and assert the recorded ordinals and full selection trace are byte-identical.
The shuffling is the point — it is what catches the `mergeFromServer` reordering.

## Q3 — Packaging: the unit is the Site

| Package | Sites |
|---|---|
| Single ayah | `[ayah:n]` |
| Range a..b | `[ayah:a … ayah:b]` + `[seam:a … seam:b−1]` |
| Mushaf page | the same, bounded by page geometry |
| Whole surah | `[ayah:1 … ayah:N]` + `[seam:1 … seam:N−1]` |

**Packaging never changes how a question is built** — only which sites are in scope and how the
budget is spent across them. §13's range/page drill, §14's calendar and the daily scheduler all
consume the same `Site[]` abstraction.

**Last ayah:** `expand()` emits seams only for `a..b−1`, so the seam at ayah N is *never
constructed* — `bridge.ts:14`'s unguarded `ayahWords(corpus, fromAyah + 1)` has no reachable
input. Making the coordinate unconstructible beats a defensive `if`.

**Page boundary:** an ordinary seam tagged `crossesPage`. **Not excluded** — page turns are
where huffaz actually break, so it is arguably the highest-value seam on the page.

## Q4 — Edge cases as ONE rule: `admit(variant, fibre, ctx)`

No spec contains a bound check. No caller contains an `if`. No builder is ever called on an input
`admit()` has not cleared. Four clauses:

1. **Supply** — sibling glosses, distractors at rank ≤4, `successorExists`, pool size,
   consecutive run. Counted on a `ResourceLedger` built once per site.
2. **Option-set distinctness under normalization** — promotes `ladder.ts`'s load-bearing `seen`
   Set into the admissibility metric. Byte equality is not enough: 12:37 p10 `"[that]"` vs p12
   `"That"` are indistinguishable to a reader.
3. **Prompt uniqueness across the fibre — the decisive clause.** Two candidate designs claimed
   two-correct-answers was "structurally unrepresentable." Both were **false**, because both
   judged an item in isolation while the defect is a *relation between items sharing a site*.
4. **Fallback ladder** — escalate answer width (3 → 5 → 8 words) rather than drop the question.
   At one-word granularity only 30/110 seams are admissible; the ladder admits **110/110**.

### The prompt collision — verified in the shipped corpus

**Yusuf 12:6 position 18 glosses as `"before "`. Position 19 also glosses as `"before "`.** Two
identical prompts in one ayah — a naive gloss-MCQ there has two correct answers, and no amount
of option-list checking finds it, because the collision is in the *prompt*.

Measured: **175/1777 slots (9.8%)** whose EN gloss repeats inside its own ayah, and **63/1777
(3.5%)** whose Arabic surface repeats. Clause 3 drops 14.2% of s1 variants and starves **zero**
ayat — min 4 live per ayah, median 13.

### A related live defect
`reconstruct.ts`'s `advanceReconstruct` grades with `choice === item.correct` — a pure string
match, in the **only graded path in the product**. On the 26 Yusuf ayat containing a repeated
Arabic surface form, tapping the *wrong* instance still matches and is graded correct. Grading
must compare *position*, not text.

---

## Open questions

1. **Does v3 share v2's Laravel backend, or get its own?** Sharing means one event log and one
   auth surface across both generations; separate means clean isolation but a migration later.
2. **Where does the corpus for surahs beyond Yusuf come from?** The compiler exists
   (`v1/packages/corpus-compiler`) but has only ever been run for surah 12. Adding surahs is a
   compiler run *plus* distractor generation *plus* the scholar review gate.
3. **Does the scholar review gate apply per surah?** It was a hard gate before public launch for
   Yusuf. Multi-surah multiplies that review cost — this may be the real constraint on how fast
   the library grows.
