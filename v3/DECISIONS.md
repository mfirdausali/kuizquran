# v3 Decisions

Append-only. Never rewrite an entry; supersede it with a new one and link back.

Decisions inherited from v2 (`v2/DECISIONS.md`, v2-D01…v2-D64) still bind unless
explicitly superseded here. `v3/docs/WIREFRAME.md` holds v3-D01…v3-D07.

---

## Ratified 2026-08-10 — the M0 batch

These were open questions. All are now **defaults in force**, so no work blocks
on a human. Override by appending a superseding entry; do not edit in place.

### v3-D08 — v3 gets its own Laravel app
`v3/api`, not a fork of `v2/api`. v2 stays the working app (v3-D01) and is never
edited. The Node fold-runner is the **sole** server-side fold; PHP never
re-implements engine logic, and never computes a content hash.

### v3-D09 — Canonical event order
`(ts, deviceId, deviceSeq, uuid)`. Never `ts` alone — clocks skew and
milliseconds tie. `deviceSeq` is per-device monotonic, assigned at emit.

**Why it matters:** `v2/src/db/eventLog.ts:113` drops the incoming `seq` on
merge, so IndexedDB assigns a fresh local one and log order becomes *arrival*
order. Any ordering derived from arrival is non-deterministic across devices.

### v3-D10 — The DrillEvent wire is frozen ONCE, complete
Fields: `surah`, `siteKey`, `visitOrdinal`, `deviceId`, `deviceSeq`, `tz`,
`corpusHash`, `locale`, denormalized spec snapshot, **positional** answer,
`gradeClass`. Freezing twice costs two migrations and a fold that special-cases
history forever.

### v3-D11 — `GradeClass` is a closed set; the engine maps it to `Rung`
`{ pretest, ungraded, s2_partial, s3_full, rc, gate }`. `gradeClassToWire()`
resolves it to a literal `Rung` **at emit time**, so the fold never dereferences
a spec id. Closes B2 — React must not decide grading.

### v3-D12 — B6 is surface-equivalence-at-position
A tap grades correct when the tile's *normalized surface* equals the expected
surface **at that position**. Strict position-only grading would be a coin-flip
false-negative on the 26/111 Yusuf ayat containing a repeated word; string-only
grading is the current bug.

### v3-D13 — Verification hash is tiered
- **qari tier** — `text_uthmani` + glosses + scene beats
- **admin tier** — distractors + specs

Distractor churn must never amber a scholar's signature. `verified` = **any**
row whose hash matches current. Rows ordered by autoincrement `id`, never
`created_at` alone (B4).

### v3-D14 — Routes: `/` is the landing page, `/home` is the dashboard
PWA `start_url=/home`. A service worker bypasses middleware, so the app shell
also steers client-side; IndexedDB is truth, any cookie is a hint.

### v3-D15 — Launch is EN-only; Malay ships post-launch
`gloss.ms` is **excluded from hash v1** and the MS toggle is hidden.

**Why:** word-by-word Malay does not exist in any public source — verified, the
Quran.com API silently returns English for `word_translation_language=ms`. So
~11,300 glosses must be *authored*, anchored to Basmeih (id 39). That is a
content project; it must not gate a working product.

### v3-D16 — Lapsed entitlement is review-only, indefinitely
Never delete, never hard-stop. A refund costs less than betraying someone's
memorization history. Charge for **access**, never for the memory itself.

### v3-D17 — Solo operation assumed
Kill switches are one-click and unconditional. The second-admin acknowledgement
degrades to a **72-hour audited auto-waive**. Notification templates still
require author ≠ approver; solo degradation is a 24-hour delay, recorded.

### v3-D18 — Managed hosting
Forge + managed Postgres. A `fold_determinism` P1 pages by email, not phone: a
missed night costs a day of confidence, never data, because the event log is
append-only and the fold is re-derivable.

### v3-D19 — The app never claims to teach tajwid or replace a teacher
CI asserts no landing or onboarding string makes either claim. Position: **the
quiz is the daily driver; the teacher is the verifier.**

### v3-D20 — Multi-surah mushaf pages drill as a within-surah slice
16 of 23 Juz Amma pages hold more than one surah; five hold three. `Site` carries
one surah and chains are bounded to their own surah — there is no memorized
transition across a surah boundary. The slice is labelled honestly; a
multi-surah page is not a drillable unit.

### v3-D21 — Macro panels are classified, not authored
Four archetypes, first match wins: **ATOMIC** (≤8 ayat → no panel) · **RING**
(ruku ≥ 4) · **LITANY** (dominant rhyme ≥ 70% or a verbatim refrain) · **ARC**
(everything else). Measured over the 43-surah launch library: ARC 21, ATOMIC 17,
RING 3, LITANY 2.

Authoring drops from 43 surahs to 3. ATOMIC surahs get **no panel** — at 3–8
ayat the list is already the macro view.

### v3-D22 — AI reviews content; a human certifies later, per surah
`ayah_verifications.reviewer_kind ∈ {ai, human}`. Launch requires every
launch-surah batch **AI-green and hash-current**; it does **not** require a human
row. **No UI claims scholar verification for a surah lacking a human row** — the
Arabic is authentic because of its *source*, not because anyone certified it.

### v3-D23 — Greenfield data; no v2 migration
Verified: v2 holds 8 users, 41 events, 0 overrides, 0 verifications — all dev
data. No transcoder, no determinism proof for imported logs.

### v3-D24 — QAC morphology is build-time only
`lemma` / `root` / `class` feed distractor generation and are **stripped from the
learner artifact**. 1131/1777 shipped words currently carry `root`, so GPL
exposure in a paid bundle is real. Attribution page ships regardless.

---

## Ratified 2026-08-10 (evening) — build-plan step 5 execution decision

### v3-D25 — Ladder/bridge/chain attic boundary
BUILD-PLAN.md's M2 order names "attic ladder/bridge/chain with retired-test
mapping published" as part of step 5, but no prior entry recorded WHERE the
line falls. Verified in v2 source before porting:

- `src/pages/Drill.tsx` and `Gate.tsx` (the only live drill/gate screens)
  import `ReconstructState`/`Rung` from `engine` — **never** `LadderState`,
  `ChainStep`, or anything from `bridge.ts`. Confirmed by grepping every
  `.tsx` under `v2/src` for `applyChain`, `applyVictoryLapChain`,
  `applyWeakSeamChain`, `initLadder`, `bridgeItems`: zero hits outside
  `engine/src/` and `engine/test/` themselves.
- So `ladder.ts`'s S1→S2→S3 state machine (`nextItem`/`advance`), all of
  `bridge.ts`'s S4 item-generation (`bridgeItems`/`nextOpening`), and
  `chain.ts`'s repair-chain orchestration (`applyChain`/
  `applyVictoryLapChain`/`applyWeakSeamChain`/`chainSteps`/
  `riskiestJunctions`/`weakSeamChainRange`/`junctionOutcome`) were built and
  unit-tested in v2 but **never shipped** — B6's DEFECTS.md description of
  reconstruct.ts as "the ONLY graded path in the product" is the same fact
  from the defect side. This is exactly the speculative surface M4's
  spec-driven question compiler (4 closed shapes) and step 19's
  connection-atom rendering are built to replace, not extend — porting it
  forward would carry dead weight into the invariant-gated spine for no
  later step to consume.
- Two pieces of those three files ARE load-bearing and are **ported, not
  atticked**, because live code genuinely calls them:
  - `bridge.ts#birthConnection` — `rebuild.ts`'s fold uses it directly for
    `connection_born`/`junction_result` events (real wire events, invariant
    #2 territory). Relocated into the rebuild.ts port rather than kept as a
    single-function bridge.ts.
  - `ladder.ts#initLadder`/`s1Options` and `chain.ts#junctionItem` —
    `test.ts` (the live, shipped Test feature — `src/pages/Test.tsx` imports
    its generators) explicitly reuses these "verbatim" per its own header
    comment. Ported as the surviving surface of otherwise-atticked files.
- Retired-test mapping: `v3/packages/engine/RETIRED-TESTS.md`, published in
  the same commit as the port, names every v2 test case retired under this
  decision and why.

Supersede this entry, don't edit it, if a later step's design proves the
boundary wrong.

---

## Ratified 2026-08-10 (night) — build-plan step 8 execution decision

### v3-D26 — gradeClassToWire()'s exact mapping
DEFECTS.md#B2 / v3-D11 name the closed set `{ pretest, ungraded, s2_partial,
s3_full, rc, gate }` and require the engine (never a spec, never a UI
component) to resolve it to a `Rung`. No spec system exists yet (M4) and no
UI exists yet (M5) to show how this is actually consumed, so the exact
per-value mapping has no live call site to derive it from. Ratified from the
best textual evidence available, in `v3/packages/engine/src/gradeClass.ts`:

- `s2_partial` -> `S2`, `s3_full` -> `S3`, `rc` -> `RC`: direct name
  correspondence — reconstruct.ts's own header comment already describes a
  reconstruct pass's completion as its "grading equivalence class S2/S3, on
  the wire, never RC"; `rc` here covers the INTERMEDIATE, non-completing
  reconstruct taps (`reconstruct_tap` events before the pass finishes),
  which types.ts's own `EventType` already distinguishes from the
  completing `ayah_produced` event.
- `gate` -> `S3`: empirical, from the golden log — every `gate_result` event
  it contains carries `rung: "S3"` (gates only ever apply to already-S3-
  encoded ayat; there is no other rung a gate could be checking).
- `pretest` -> `S1`: empirical, from the golden log's own pretest tap (g01,
  `type: "tap", rung: "S1", pretest: true`) — the only concrete pretest
  example in the codebase.
- `ungraded` -> `S4`: rebuild.ts's own comment groups them explicitly —
  "S4 rolls up as a light meaning signal, like S1" — pairing the bridge
  rung with the meaning-pass rung as both being introduction-shaped,
  non-production-grading rungs.

**Explicitly flagged for reconsideration**: this mapping has zero call
sites exercising it end-to-end (no UI, no spec system). When M4's
spec-driven question compiler lands and a spec actually declares a
`gradeClass`, re-verify every entry against that real usage before trusting
it further — this decision is a placeholder built to be correct-looking,
not battle-tested.

---

## Ratified 2026-08-10 (later night) — build-plan step 11 execution decision

### v3-D27 — Step 11 scope for this run: Site model's wire-relevant subset only
Build-plan step 10 (the DrillEvent wire freeze) names `siteKey` and
`visitOrdinal` as frozen fields, but neither concept existed until step 11
(Site model). Full step 11 per BUILD-PLAN.md's M2 ships list is large:
"Site/ledger/admit (4 clauses + minimum-entropy floor, per-locale stats,
overrides-aware ledger)/rotation/per-device visitOrdinal" — the `admit()`
4-clause admissibility predicate, `ResourceLedger`, and lane rotation
(`lapPerm`/`stride`) are a real, separate body of selection-engine work
(WIREFRAME.md §23 Q4), not required to FREEZE A SCHEMA.

This run implements only what step 10 actually needs to stop guessing:
`v3/packages/engine/src/site.ts` — `Site` type, `siteKey()`, the TOTAL
`siteToAtomKey()` mapping (WIREFRAME.md's own "seam's atom key is
connection:n"), `expand()` (the exact by-construction E-08 closure
WIREFRAME.md §23 Q3 describes — a seam at a range's last ayah is never
constructed), and `nextVisitOrdinal()` (WIREFRAME.md §23 Q2's
"max(recorded) + 1" rule).

**Explicitly deferred, not forgotten:** `admit(variant, fibre, ctx)`'s 4
clauses (supply/`ResourceLedger`, option-set distinctness, prompt
uniqueness across the fibre, the fallback answer-width ladder), lane
rotation (`lapPerm` hash-permutation, `stride(N)` integer-arithmetic
cycling), and `selection_determinism_check` remain open step-11 work for a
future run. `assembleQueue`/`floorQueue` are NOT yet Site-aware (they still
operate on raw ayah numbers) — that integration is part of the deferred
work too, not done here.

---

## Ratified 2026-08-10 (still later night) — build-plan step 11 continued: rotation, admit() still deferred

### v3-D28 — Rotation mechanism landed; admit()/ResourceLedger remain deferred pending M4's Variant shape

This run (a later, separate pass at step 11) implements
`v3/packages/engine/src/rotation.ts` — `lapPerm(lap, laneCount, seedKey)` and
`stride(poolSize)`/`affineIndex(n, poolSize, offset)`, WIREFRAME.md §23 Q2's
lane-then-affine rotation mechanism, proven by property rather than by
replicating the WIREFRAME prototype's own measured numbers (that
prototype's exact algorithm was never committed to source, so "17/30
distinct on 12:4" etc. cannot be reproduced byte-for-byte — what CAN be
proven, and is, by `rotation.test.ts`'s property + stress tests, is every
property WIREFRAME actually states as a *requirement*):

- every lane fires exactly once per lap (no starvation) — `lapPerm` always
  returns a permutation of `[0..laneCount-1]`;
- zero immediate repeats at ANY lap boundary, including the degenerate
  L=1/L=2 cases edge case #40 names — proven mathematically in
  `rotation.ts`'s own doc comment (a rotate-by-`lap mod L` scheme has no
  boundary collision for L≥3; L≤2 uses a fixed, unrotated base, which is
  the only boundary-collision-free sequencing available at that size);
- lap order varies across laps for L≥3 (WIREFRAME's "variety"), while L=1/2
  cannot satisfy variety AND zero-repeats simultaneously, so zero-repeats
  wins (matching "the swap was measured failing at L=2" — the swap being
  exactly the failure mode a naive per-lap re-shuffle would reintroduce);
- `affineIndex` gives full pool coverage before any repeat and never
  repeats the immediately-prior index, by construction (`stride` is always
  coprime with the pool size — `poolSize−1` is always available as a
  coprime candidate since consecutive integers are always coprime);
- pure integer arithmetic throughout, no `Math.random`, no float on the
  selection path (INVARIANTS.md Absolute A).

**Still explicitly deferred, same reason as v3-D27's own scope cut, now
sharper:** `admit(variant, fibre, ctx)`'s 4 clauses and `ResourceLedger`
both take a concrete `Variant` as an argument, and no such type exists in
the codebase yet — `variants()` (WIREFRAME's own enumerator) is M4's
question compiler (build-plan step 16), which hasn't landed. Building
`admit()`/`ResourceLedger` against an invented `Variant` shape now risks
exactly the failure mode BUILD-PLAN.md's own "Agent deployment strategy"
section warns against — "a standing check that no lane has invented a
contract the spine never ratified." `assembleQueue`/`floorQueue` are
likewise NOT made Site-aware this run: a Site-aware queue with no
admissibility filtering behind it doesn't yet serve a real caller.

**What this means for step 12** (`selection_determinism_check`): it is
still not startable — it replays "recorded selection snapshots (siteKey,
per-device ordinal, lane/variant)" per BUILD-PLAN.md's own description,
which needs a real `admit()`+rotation+Variant integration to produce
those snapshots from. `rotation.ts` is the piece of that integration this
run could build without inventing `Variant`; `admit()`/`ResourceLedger`
remain the honest gap, to be built either alongside M4's compiler (when
`Variant` is finally concrete) or in a future step-11 pass that accepts
inventing a placeholder `Variant` shape explicitly flagged for
re-verification (the same pattern v3-D26 used for `gradeClassToWire()`).

---

## Ratified 2026-08-10 (later night) — build-plan step 13 execution decision

### v3-D29 — Auth email links target the API directly until apps/web exists
Build-plan step 13 (Laravel skeleton + Sanctum + password reset + email
verification) lands before `apps/web` (step 17, M5) — there is no frontend
route to link an email to yet. Two different link shapes were needed:

- **Email verification** — the signed link points straight at
  `GET /api/email/verify/{id}/{hash}` (named route `verification.verify`,
  Laravel's own default `VerifyEmail` notification, unmodified). This is a
  read-only confirm action, so a bare JSON response from a clicked link is
  a genuinely working (if unstyled) end state today, not a placeholder.
- **Password reset** — cannot be a bare link; it needs a form. The
  notification's URL is built by `AppServiceProvider::boot()` via
  `ResetPassword::createUrlUsing()` against `config('app.frontend_url')`
  (env `FRONTEND_URL`, default `http://localhost:3000`), pointing at
  `/reset-password?token=..&email=..`. This route does not exist yet and
  the link 404s until M5 — expected, not a bug. The reset action itself is
  fully exercised today via `POST /api/reset-password` directly
  (`tests/Feature/Auth/PasswordResetTest.php`), independent of that page.

When M5 builds `apps/web`, it owns building `/reset-password` to match this
contract (`token`, `email` query params) — no backend change implied.

Also ratified in the same commit: `v2-D03` (anonymous-first identity,
account adoption via `register()`) is **not superseded**, only re-implemented
in `v3/api` per `v3-D08`; `EnsureIsAdmin` now requires
`hasVerifiedEmail() && allowlist` (closes `DEFECTS.md#B7`); a password reset
revokes every existing Sanctum token and mints one fresh (backend half of
`DEFECTS.md#B8`, frontend interceptor still open — see that entry).

---

## Ratified 2026-08-10 (much later night) — build-plan step 12 execution decision

### v3-D30 — `admit()`/`Variant`/`ResourceLedger` built now, against real corpus data, explicitly flagged for re-verification at M4

v3-D28 (a concurrent pass at step 11) proposed two paths for step 12:
wait for M4's question compiler to define a real `Variant`, or build a
placeholder shape now, "explicitly flagged for re-verification." This run
takes the second path, on human authorization (asked, and told to proceed)
after weighing v3-D28's own concern — BUILD-PLAN.md's warning against "a
standing check that no lane has invented a contract the spine never
ratified" — against the fact that WIREFRAME.md §23 Q4 already fully
specifies what `admit()`'s 4 clauses measure (sibling glosses, distractor
rank ≤4, successorExists, option/prompt text distinctness), all of it
readable off the REAL compiled 12/103/112 corpora today. The part that
genuinely needs M4 is the render/kernel layer (spec.ts/faces/kernels/
buildQuestion/render.ts's 4 closed shapes) — not `admit()`'s judgment logic.

**What landed**, in `v3/packages/engine/src/variant.ts` + `selection.ts`:

- `Lane = "s1" | "cloze" | "junction"` — scoped to the 3 lanes with a real
  single-`Site` enumerator today. `rc`/`locate`/`reorder` are RANGE-level
  generators (`test.ts`'s `locateItem`/`reorderItem` take a pool/range, not
  one Site) — deferred, not forgotten, same discipline as v3-D27/v3-D28.
- `Variant` — explicitly a PLACEHOLDER shape (`lane`, `site`, `position?`,
  `prompt`, `optionSurfaces`, `correctIndex`): enough for `admit()` to judge
  real supply/distinctness/uniqueness, not a claim about what M4's
  `buildQuestion`/`render.ts` will actually produce. Re-verify every field
  once M4 lands (same pattern v3-D26 used for `gradeClassToWire()`).
- `ResourceLedger` — built once per site (clause 1's supply counts: per-word
  sibling-gloss count for s1, per-word rank≤4-distractor count for cloze,
  `successorExists` for seams).
- `admit(variant, fibre, ledger)` — all 4 WIREFRAME clauses: (1) supply via
  the ledger, (2) option-set distinctness (plain equality for s1's English
  glosses, `normalizeArabicSurface`/v3-D12 for cloze/junction's Arabic
  surfaces), (3) prompt uniqueness across the fibre — a collision keeps the
  FIRST (lowest position) occurrence and drops the rest, never drops all
  colliding items (WIREFRAME: "starves zero ayat"), (4) junction's fallback
  ladder — escalating opening-snippet width (1→3→5→8 words) until the
  option set is distinct, never dropping the seam.
- `selectFor(corpus, site, deviceId, visitOrdinal)` — the actual selection:
  `rotation.ts#lapPerm` over the site's admissible lane list, then
  `rotation.ts#affineIndex` within the chosen lane's admitted variant pool.
  Both seeds are derived from `${siteKey}:${deviceId}[...]` via a pure
  FNV-1a hash (`seedFromKey`) — never `Math.random` — so two devices at the
  same site get independent, non-colliding rotation sequences (WIREFRAME
  edge case #48/#49's per-device ordinal namespace fix).
- `replaySelection(events, corpusBySurah)` — folds a log in ANY order into
  a trace keyed by `${siteKey}:${deviceId}:${visitOrdinal}`. Order-
  independent BY CONSTRUCTION: `selectFor` never reads the log, only the
  three recorded facts on the event itself — so shuffle-invariance is a
  property of the function signature, not an incidental test result.
- `test/selection.test.ts`'s `selection_determinism_check`: replays a
  shuffled log across 20 varying (seeded, pinnable) shuffle orders, plus a
  genuine 2-device and 3-device merge/interleave, asserting a byte-identical
  trace every time. Mutation-checked twice: dropping `deviceId` from the
  seed, and dropping it from the trace key, both turn the corresponding
  test red (verified, then reverted).

**Still explicitly deferred**, per the same scope discipline: `assembleQueue`/
`floorQueue` (`scheduler.ts`/`floor.ts`) remain ayah-scoped, not Site-aware —
they decide WHICH ayah/connection to review, a separate concern from
`selectFor`'s WHICH QUESTION VARIANT within an already-chosen site, and
BUILD-PLAN.md's "hard precondition for any compiler merge" language names
selection determinism, not the review-scheduler's internal representation.
Widening those two functions to emit `Site` instead of raw ayah numbers is
real, lower-stakes follow-on work for whenever M4 or a UI consumer actually
needs it.

---

## Ratified 2026-08-10 (near midnight) — build-plan step 14 scope

### v3-D31 — Step 14 scope for this run: Laravel-side ingestion + pull only; Node fold-runner deferred

Build-plan step 14's full M3 ships list is large: "events table PK
(user_id, uuid), frozen wire columns, cap log-only-then-enforced, pull
protocol cursored on server ingest-sequence (late-arrival safe); Node
fold-runner sidecar (sole server-side fold) + atom_cache (engine_version) +
fold_determinism_check + selection-check nightly harness + per-user
advisory locks + dead-letter quarantine + late-arrival refold." This run
ships the first half only — a genuinely separate Node.js service
(`v3/worker/fold-runner`, per CLAUDE.md's own "Where things go") is a
substantially different, larger body of infrastructure work than extending
the Laravel app already scaffolded at step 13.

**What landed**, in `v3/api`:

- `events` table (migration `2026_08_10_222411_create_events_table`) — one
  column per DrillEvent wire field frozen at step 10 (v3-D10); `id` is a
  server-assigned autoincrement INGEST SEQUENCE (the pull cursor, not a
  claim about matching BUILD-PLAN's literal "PK (user_id, uuid)" wording
  byte-for-byte — practically, a bigint autoincrement `id` doubles as the
  cursor a composite string PK couldn't offer, while `unique(user_id,
  uuid)` still gives the idempotency guarantee that wording names); `uuid`
  is the client-stamped idempotency key, unique PER USER (v2-D18's
  contract, carried forward).
- `POST /api/events` — idempotent batch ingest (`insertOrIgnore` on the
  unique `(user_id, uuid)` constraint), `user_id` always from the Sanctum-
  authenticated caller, never the request body (regression-tested). "Cap
  log-only-then-enforced": `config('events.daily_cap')` (default 2000) —
  crossing it logs a warning, never rejects a batch. No PHP-side hashing or
  engine logic (v3-D08).
- `GET /api/events?since=&limit=` — the pull protocol, cursored on the
  server `id`, never `ts`. `test/Feature/Events/EventsPullTest.php`'s
  decisive case: an event with an OLD `ts`, ingested SECOND (server
  ingest-sequence), still appears on a client's next pull past its
  last-seen cursor — mutation-checked by switching the query to cursor on
  `ts` instead, which turns two tests red (confirmed, then reverted).

**Explicitly deferred, not forgotten**: the Node fold-runner sidecar
(`v3/worker/fold-runner`, TypeScript, importing `packages/engine` — the
SOLE server-side fold, per v3-D08), `atom_cache` (engine_version-tagged),
`fold_determinism_check` (nightly re-fold + byte-compare against
`atom_cache` — WIREFRAME.md §16 calls this "the single best idea in the
spec... build it first" for the ADMIN CONSOLE, which itself is M8, much
later), the nightly `selection_determinism_check` harness (as opposed to
the CI-time property proven at step 12), per-user advisory locks,
dead-letter quarantine, and late-arrival refold. These require running,
scheduling, and testing an actual second server process — a distinct
follow-up, not a continuation of this run's Laravel-only diff.

---

## Ratified 2026-08-10 (past midnight) — build-plan step 14 continued: fold-runner core

### v3-D32 — fold-runner's PURE core built now; DB adapter/scheduling/advisory-locks/dead-letter-queue deferred

Continuing step 14 (v3-D31 scoped out the Node fold-runner entirely). This
run scaffolds `v3/worker/fold-runner` (its own package, per CLAUDE.md's
"Where things go") and builds the part of it that is genuinely testable
without a live deployment target:

- `src/canonicalOrder.ts` — v3-D09's `(ts, deviceId, deviceSeq, uuid)`
  order, proven ARRIVAL-ORDER INVARIANT (any shuffle of the same event set
  canonical-orders to the identical sequence, across 15 seeds) — this is
  the fold-runner's own version of the fix DEFECTS.md#B5 names for the
  client side (`v2/src/db/eventLog.ts:113`'s dropped `seq`); the server has
  the identical problem from the network-arrival-order direction.
- `src/fold.ts` — `foldEvents()` composes `canonicalOrder` with the pure
  engine's own `rebuild()` (v3-D08: the fold-runner calls the engine, it
  never re-derives). Proven arrival-order-invariant end-to-end (folding a
  shuffled log matches folding the canonical one, byte-identical, across
  15 seeds) — packages/engine's own `golden-log-parity.test.ts` proves
  `rebuild()` is correct over an ALREADY-canonical log; this proves the
  composition survives however the server actually received the events.
- `src/determinism.ts` — `compareAtomCaches()` (key-by-key AtomState
  equality, ANY divergence reported, never silently ignored — WIREFRAME.md
  §16: "it must be 100%") and `foldDeterminismCheck()` (re-fold from
  scratch, compare against a supplied live cache — the check's actual
  shape, DB-free).
- `database/migrations/2026_08_10_223540_create_atom_cache_table.php` (in
  `v3/api`) — schema only. Laravel OWNS the table (mirrors `AtomState`
  field-for-field, plus `engine_version`/`computed_at`) but this migration
  writes nothing to it — no PHP code path inserts a row yet, consistent
  with v3-D08 (PHP never computes the fold).

Mutation-checked: dropping `ts` from `canonicalOrder`'s sort key turns the
"orders primarily by ts" test red (confirmed, then reverted).

**Still explicitly deferred**: the DB adapter (reading real `events` /
writing real `atom_cache` rows — needs a Postgres client and connection
strategy, a live-deployment decision, not testable in this sandbox anyway
per BUILD-PLAN.md's own "Exit: both checks green nightly in STAGING"), the
CLI/scheduling wiring (cron vs queue worker, a Forge hosting decision under
v3-D18), per-user advisory locks (Postgres-specific — sqlite, this repo's
dev DB, has no equivalent to test against), dead-letter quarantine, and
late-arrival refold triggering. `fold_determinism_check` as a genuinely
*nightly, staging-run* job — as opposed to the pure comparison primitive
proven here — needs all of the above first.

---

## Ratified 2026-08-10 (very late) — build-plan step 15 completion: specs + verification architecture

### v3-D33 — specs table ships as an explicitly flagged placeholder; question compiler (M4) owns the real payload shape

Step 15 names "specs (immutable, versioned, tombstone-as-flip)" but the
question compiler that actually INTERPRETS a spec (`buildQuestion(spec,
ctx)`, WIREFRAME.md §22) is build-plan step 16, one step later — by
design (the corrected order's own reasoning: data model before the
consumer). The `specs` table therefore ships now with the STRUCTURAL
guarantees WIREFRAME.md already commits to regardless of M4's eventual
payload shape (immutable — no row is ever UPDATEd; versioned — a lineage
groups rows by `spec_id`, each edit is a new row with an incremented
`version`; tombstone-as-flip — deactivating is a new version row with
`active: false`, never a delete), and a `payload` JSON column whose INNER
shape is provisional. The one guarantee enforced NOW, not deferred to M4:
`payload` structurally CANNOT carry `rung`/`pretest`/`atom`/`structured` —
WIREFRAME's hard problem 1 ("no spec contains a bound check... the fold
never dereferences a spec id") demands this hold from the first row ever
written, not from whenever M4 remembers to enforce it. A validation rule
rejects any payload containing those keys, at any depth, tested with a
mutation check.

### v3-D34 — the qari-tier/admin-tier hash-with-overrides duplication is intentional, not an oversight

`corpus-compiler/src/hash.ts`'s new `ayahQariHashWithOverrides`/
`ayahAdminHashWithOverrides` re-implement a MINIMAL subset of
`packages/engine/src/overrides.ts#applyOverrides`'s latest-wins resolution
(gloss + distractor only, skipping group/disable — the two fields that
never feed a hash). This is duplication across two separate packages with
no shared-types layer, accepted rather than fixed by adding a dependency
edge corpus-compiler has never had, because:

1. Both copies resolve "latest wins" via the IDENTICAL `(createdAt, id)`
   rule DEFECTS.md#B4 already fixed and tested in both places
   (`packages/engine/test/b4-override-ties.test.ts` and
   `corpus-compiler/test/hash.test.ts`'s own case) — the two cannot
   silently diverge in a way neither test suite would catch.
2. `packages/engine` must never depend on `corpus-compiler` (the engine is
   the invariant-gated spine; the compiler is a build-time tool) and
   `corpus-compiler` gaining a dependency on `packages/engine` purely for
   one shared type is a heavier coupling than the ~15 lines this
   duplicates.

If a third consumer ever needs this resolution logic, extract a shared
`packages/override-resolution` package then — not before.

---

## Ratified 2026-08-11 — build-plan step 16 execution: buildQuestion ships one kernel at a time

### v3-D35 — s1 is the first parity-fenced kernel; cloze/junction/locate/reorder are explicit follow-on work

BUILD-PLAN.md prices the question compiler at ~4 hard-fenced eng-weeks
with a DoD of "byte-parity re-expression of reconstruct + the 6 test
builders." That parity requirement is exactly why this ships incrementally
rather than as one large, harder-to-verify diff: each kernel gets its own
full-corpus byte-parity sweep against the EXISTING generator before the
next one starts, so a mistake in kernel N is caught before it's buried
under kernel N+3.

**Landed:** `corpusRef.ts`/`faces.ts` (the type-level authenticity
guarantee — see this file's own step-16 entries above), `render.ts` (the
4 closed shapes), `buildQuestion.ts` with `Spec`'s first lane member,
`"s1"` — proven byte-identical to `test.ts#vocabItem` across every ayah in
the fixture corpus, with every option routed through a Face (real
`CorpusRef` provenance) rather than a raw string. Mutation-tested: an
inverted sibling-sort order turns the full-corpus parity test red,
confirmed, reverted.

**Explicit runtime design choice:** `buildQuestion`'s lane switch defaults
to `return null` (graceful), not a compile-time exhaustiveness trap —
unlike `resolveRef`'s 5-variant `CorpusRef` switch (which IS exhaustive,
because all 5 variants are permanently closed). `Spec['lane']` will grow
new members over several follow-on iterations, and a lane without a kernel
YET is a legitimate, standing runtime state (not a bug to compile-error
on) until its own kernel lands.

**Deferred, not forgotten, same discipline as every prior scope cut this
build:** `cloze` (S2 fill — parity target `test.ts#clozeItem`), `junction`
(parity target `test.ts#junctionTestItem`, itself reusing `chain.ts#junctionItem`
verbatim), `locate` (parity target `test.ts#locateItem` — the
`locateChoice` shape), `reorder` (parity target `test.ts#reorderItem` —
the `orderTiles` shape). `reconstruct.ts`'s RC pass is NOT a future kernel
— WIREFRAME's own DATA/CODE table keeps its sequencing state machine as
CODE permanently; `buildQuestion` structurally refuses an `"rc"` lane
(tested). `explain()` (the admin workbench's trace tool, §22b) also
deferred — it has no caller until the workbench itself (build-plan step
25, M8), so building it now would be untested surface with no consumer to
validate it against.

---

## Ratified 2026-08-11 — build-plan step 16 COMPLETE + a verification-integrity fix

### v3-D36 — All five templatable lanes have kernels; step 16's remaining gaps are named, not silent

Supersedes v3-D35's "deferred" list, which is now stale. `Spec['lane']` is
`s1 | cloze | junction | locate | reorder` — every lane WIREFRAME §23 Q1 names
except `rc`, which is permanently CODE (the DATA/CODE table keeps
`reconstruct.ts`'s state machine untemplated; `buildQuestion` structurally
refuses it, tested via `@ts-expect-error`). Each kernel carries a full-corpus
byte-parity sweep against its `test.ts` oracle, and each was mutation-checked.

Two departures from naive "total parity", both disclosed in code comments and
test names rather than hidden:

- **`buildReorder` returns null where legacy `reorderItem` would overrun.**
  Legacy takes no corpus and never bounds-checks, so it happily emits ayah
  numbers past `ayahCount`; the kernel cannot, because `OrderTilesItem.tiles`
  is `Face[]` and a Face past the end has no text to resolve. Parity is
  therefore asserted over 109 of 111 runs on the Yusuf fixture, with the 2
  boundary runs asserting the null instead. This matches junction's E-08
  closure and is deliberate.
- **`buildReorder` emits tiles in reading order, not shuffled.** Display
  shuffling is the UI's concern (the same rule every other generator follows).

### v3-D37 — Two REAL gaps in step 16, recorded so step 18 cannot trip on them silently

Found by an adversarial completeness review, verified by hand. Neither blocks
step 18, but both were undocumented, which is the actual defect:

1. **The lane set diverges between two modules.** `variant.ts` declares
   `Lane = "s1" | "cloze" | "junction"` and `selection.ts` iterates exactly
   that `LANES` constant — so `selectFor` can only ever CHOOSE 3 lanes, while
   `buildQuestion` can BUILD 5. `locate`/`reorder` are unreachable through the
   selection path. The reason is real (v3-D30: both need data not derivable
   from a `Site` — `pool` and `count` respectively), but the divergence itself
   was never written down. Whoever wires step 18 must decide whether `Lane`
   unifies at 3 or 5.
2. **`sequenceFill` has zero producers inside the compiler.** It is RC's shape,
   and RC is permanently CODE, so it is populated via `reconstruct.ts` rather
   than `buildQuestion`. That is the intended architecture — but "one of the
   four closed render shapes is never produced by any kernel" was not stated
   anywhere, and reads as an omission until you know why.

Also outstanding against M4's literal DoD: **`explain()` is not built.**
Deferring it remains right (its only consumer is the §22b workbench at step 25),
but M4 cannot be called complete against its own text while it is missing — it
is hereby tracked as an M8 precondition, not silently dropped.

### v3-D38 — `tsc` was never installed; every "typecheck clean" claim before 2026-08-11 was a false pass

None of the three v3 node packages depended on `typescript`. On macOS `npx tsc`
therefore resolved to the **TeX** `tsc` binary, which prints "This is not the
tsc command you are looking for" and **exits 0** — so every typecheck in this
build's history silently verified nothing. This is a verification-integrity
failure, not a code failure: running the real compiler afterwards found the
engine and fold-runner genuinely clean, but it also surfaced two real
strict-mode errors in `corpus-compiler/test/geometry.test.ts` that had been
invisible (possibly-undefined array indexing under `noUncheckedIndexedAccess`).

Fixed: `typescript` is now a real devDependency in all three packages, each has
a `typecheck` script, and `make test-v3` depends on a new `typecheck-v3` target
so a type error fails the suite. `corpus-compiler` also gained the `@types/node`
its own tsconfig required. The geometry test now asserts array length before
indexing rather than using `!`, so a regression that empties those arrays fails
loudly instead of passing.

**Lesson worth keeping:** a verification step that cannot fail is worse than no
verification step, because it manufactures false confidence. Any future "X is
clean" claim in this build should be accompanied by evidence that X can fail.

---

## Ratified 2026-08-11 — build-plan step 17 PARTIAL: foundation landed, route tree outstanding

### v3-D39 — What step 17 actually shipped, and what it did not

The frontend foundation workflow lost its scaffolding agent to a content-filter
error on its FINAL message (the work was already written to disk; only the
agent's closing summary was blocked). Four of five agents completed. Rather than
claim step 17 complete, this records the real line.

**LANDED and independently verified:**
- `v3/apps/web` — Next.js 16.3.0, App Router, TypeScript, no Tailwind (a locked
  CSS system would fight it). Builds clean.
- **The locked design system, ported with exactly one delta.** `check-locked-css.mjs`
  proves it: "1 hunk at line 17 (@import -> 6 @font-face), 294 v1 lines otherwise
  byte-identical." Mutation-tested — injecting a stray rule fails the gate.
- **Amiri is genuinely self-hosted** (real WOFF2 binaries, converted locally).
  The four Latin UI faces are ABSENT and the build says so out loud every time.
  `check-fonts.mjs` HARD-FAILS on a missing Amiri (a fallback there means tofu
  for Quranic codepoints, edge case #84) and warns-but-continues on the UI faces.
  `public/fonts/FONTS.md` names each missing file and how to obtain it.
- **The IndexedDB event-log island** — 37 tests. Web Locks single-writer (#75),
  QuotaExceeded surfacing as retryable rather than a silently dropped tap (#74),
  and the three-state loading model as a discriminated union so a component
  cannot render a skeleton forever. Mutation-tested: neutering the event write
  turns 16 tests red.
- **`check-boundaries.mjs`** — 5 clauses, the strongest being that engine
  decisions may not appear in JSX, making DEFECTS.md#B2 impossible by
  construction rather than merely fixed once. Also enforces no-IDB-in-an-RSC
  (#72: a server render has no log, so it paints 0 while the client hydrates 4).

**NOT LANDED — plan section C, the route tree.** Only `/` exists, as a stub.
`/home` (v3-D14's dashboard), library, surah detail, ayah detail, session,
/progress/list and /plan were never created. Step 17 is therefore PARTIAL.
The next frontend run starts here.

### v3-D40 — The sacred-text guard states its ranges as escapes, never literals

`check-boundaries.mjs` originally wrote its Arabic ranges as literal boundary
characters. That put real Arabic codepoints in the repo's own detector, so a
repo-wide sacred-text scan flagged the scanner itself — the single false
positive most likely to teach a reader that the scan is noise and can be
ignored. Rewritten as `\u` escapes: identical ranges, zero literals, and the
guard still catches both literal Arabic and the `\u06xx` escape hatch (verified
by injecting each and watching it fail).

---

## Ratified 2026-08-11 — steps 17 and 18: shell, routes, and the quiz loop

### v3-D41 — Step 17 COMPLETE, step 18 (quiz components) COMPLETE

Supersedes v3-D39's "PARTIAL". The route tree, app shell and CSS extension layer
now exist, closing the gap that entry named.

- **Routes** per v3-D14: `/` (landing, stub — the real page is M10) and a
  `(app)` route group carrying `/home`, `/library`, `/surah/[surah]`,
  `/surah/[surah]/[ayah]`, `/session`, `/progress`, `/progress/list`, `/plan`.
  Every not-yet-built route is a real file with a stub marker naming its
  build-plan step — never a 404, never an empty file.
- **Shell**: root layout loads the locked CSS then `app/iman-ext.css`; a 4-tab
  bottom bar where Plan replaces "You" (v3-D05). Client-side steering island for
  edge case #92 (a service worker bypasses middleware, so `/`→`/home` must also
  happen client-side; IndexedDB is truth, a cookie is only a hint).
- **`app/iman-ext.css`** — the documented extension layer. The locked file is
  byte-gated, so every project rule (e.g. #82's 44px `.tile-hit` wrapper) lives
  here. This is what makes "never edit the locked file" a workable instruction
  rather than a dead end.
- **Quiz components**: one per render shape (Choice, SequenceFill, OrderTiles,
  LocateChoice) plus a `QuizCard` dispatcher whose switch is exhaustive over the
  four shapes with a never-typed default. `FaceText` is the ONE place
  script→direction happens (#80). Grading is not in the views: a component
  reports WHICH index was tapped and nothing else (gate clause 5 enforces it).
- **#81 solved by construction, not by correction.** The component computes no
  visual index at all — each handler closes over its ARRAY index. `.bank` is
  CSS-mirrored, and presentation never travels back into data.
  `mapTapToLogicalIndex` is a deliberate identity function that exists so the
  property has somewhere to be asserted; an adversarial mutation to
  `length - 1 - i` turns 7 tests red.

### v3-D42 — The OrderTiles reveal expression: rewritten for clarity, NOT a live bug

An adversarial reviewer flagged `correctOrder[ordinal] === correctOrder[index]`
in `OrderTilesCard` as a defect that "silently ignores the answer key", and
proposed `correctOrder[ordinal] === index`.

**Both the alarm and the proposed fix were wrong, and the record should say so.**

- It was NOT a live defect. `buildReorder` fills `correctOrder` with a strictly
  increasing run of ayah numbers, so its elements are always DISTINCT, and for
  distinct elements `co[a] === co[b]` is exactly equivalent to `a === b`.
  Verified exhaustively over starts 1..200 x counts 1..8: zero divergence. The
  reviewer's own counter-example used a permutation (`[3,1,2]`) the engine
  cannot produce.
- The proposed replacement would have INTRODUCED a bug: `correctOrder` holds
  ayah numbers, not tile indices, so `correctOrder[ordinal] === index` compares
  an ayah number against a position and holds only by accident.

The expression is nonetheless rewritten to `ordinal === index` — the form that
states the actual intent — because the old one only *read* as if it consulted
the answer key, and its correctness rested on an unstated accident of
distinctness rather than on expressed intent. It would become a real defect the
day `correctOrder` is allowed to repeat a value.

**The genuine gap the review exposed was in the TESTS, not the component**: every
existing case used an in-order attempt, where correct and incorrect reveal
implementations agree, so the reveal behaviour was entirely unpinned. Two tests
now pin it directly (an out-of-order attempt marks exactly one tile correct; a
fully in-order attempt marks all). Mutating the reveal to `true` turns one red.

**Method note:** an adversarial verifier finding something is the START of an
investigation, not the end of one. This one was confidently argued, specific,
and wrong — and its fix would have shipped a real bug. Verify the counter-example
against what the producer can actually emit before acting on it.

---

## Ratified 2026-08-11 — build-plan step 19: the visible memory graph

### v3-D43 — MacroFacts is a corpus-compiler emission, because v3-D21's classifier had no inputs

v3-D21 defines four archetypes: ATOMIC (<=8 ayat), RING (ruku >= 4), LITANY
(dominant rhyme >= 70% or a verbatim refrain), ARC (everything else). Building
it exposed that **only ATOMIC was decidable**: `Corpus.meta` is
`{surah, ayahCount, wordCount}` — no ruku count, no rhyme profile, no refrain
data anywhere in the shipped artifact (grep-verified: the only hits are
compile-time distractor `why` prose, which edge case #21 strips).

Left alone, every non-ATOMIC surah would silently fall to ARC, and the census
would read "ARC 26, ATOMIC 17" instead of v3-D21's measured "ARC 21, ATOMIC 17,
RING 3, LITANY 2". That is a classifier that always returns its default while
wearing the costume of one that classifies — and the three RING and two LITANY
surahs, the exact five that motivated the decision, would render as ARC with
nobody noticing, because ARC is plausible.

Resolved by emitting `MacroFacts` from the corpus-compiler
(`packages/corpus-compiler/src/macro.ts`) rather than inventing the data in the
UI. This is a compiler change, not an engine change — `packages/engine/src/**`
is untouched. `classify()` is written so **a missing input can never satisfy a
rule** (absent ruku -> 0, and `0 >= 4` is false), so an unclassifiable surah
lands on ARC carrying `authored: false`, which drives a VISIBLE "this outline is
derived" label rather than a silent fallback. A census test over the launch
library is what catches degeneration: disabling the RING branch fails it while
every per-surah test still passes.

### v3-D44 — Both halves of the memory graph, as one array (edge case #90)

Edge case #90: "Connection atoms invisible (40% of Al-Asr's atoms) — half the
memory graph unrendered." The fix is structural, not cosmetic:
`buildGraphNodes()` delegates to the engine's own `expand()` and returns ONE
ordered array of 2N-1 peers, not `nodes[] + edges[]`. A nodes/edges split makes
seams look derivable, and a renderer that derives edges from nodes drops them at
the first simplification.

Seams read their OWN atom via `siteToAtomKey(site)` -> `connection:from`, never
the left-hand ayah's — mutation-tested (mirroring a seam onto its neighbour's
atom turns 2 tests red). An ineligible seam is drawn in `var(--border)` rather
than omitted, because "invisible" and "not yet eligible" are different facts and
#90 is about the first being mistaken for the second. E-08 closes by
construction: `expand()` never builds a seam at ayah N, so the ring cannot close
and there is no "remember not to close it" check to forget.

### v3-D45 — Edge case #87's test bit nothing; the shipped code was right anyway

An adversarial review found, and I independently reproduced, that deleting the
stage word from `RingDiagram#labelFor` — turning "Ayah 103:1, Carrying, 95%"
into "Ayah 103:1, 95%" — left **all 205 tests green**.

The shipped code was correct: labels did carry word + number. But the nav test
asserted link COUNT and HREFS and never link TEXT, and the #87 block tested
`stageLabelOf()` in isolation plus the `<desc>` aggregate — so nothing pinned
the per-mark label. That is exactly the regression #87 exists to prevent, and
for a screen-reader or deuteranopic user it is total: the colour was never
carrying the stage for them in the first place.

Closed with one assertion over every mark's accessible name, using mixed atom
states so a hardcoded stage word cannot satisfy it. Verified by re-applying the
mutation: it now fails exactly one test, the one written for it.

**Method note, the second time this has come up:** a green suite is evidence
about the tests, not proof about the code. The only way to know a test bites is
to make it fail on purpose.

### v3-D46 — `--stage-carry` is coral in the locked file; lapsed differs by WEIGHT, not hue

The locked `iman-ui.css` sets `--stage-carry: var(--coral-500)`, assigning coral
to CARRY — the strongest band — while that same file's own rule reserves coral
for "something slipped". A lapsed mark in the same family would be ONE mark to
the ~8% of men with deuteranopia, the exact population #87 protects.

The ext layer therefore defines `--stage-lapsed: var(--coral-700, ...)` and
distinguishes lapsed by **weight and border**, which survives any colour vision.
(A reviewer flagged the fallback chain as a risk that lapsed and carry resolve
identically; `--coral-700` IS defined in the locked file at line 104, so the
fallback never fires — and the weight/border distinction holds regardless.)

The token oddity in the LOCKED file is recorded here rather than fixed: the file
is byte-gated and correctly so. If it is ever unlocked, `--stage-carry` should
be revisited.

---

## Ratified 2026-08-11 — build-plan step 20: the continuous drill

### v3-D47 — WIREFRAME §13's "no new engine work" claim is STALE; expand() is the successor

§13 states: "`chainSteps(from, to)` already takes an arbitrary range… so 'chain a
few ayat together' needs NO new engine work." Grep-verified false in v3:
`chain.ts` is 34 lines containing `junctionItem` ONLY. v3-D25 atticked
`chainSteps`, `applyChain`, `applyVictoryLapChain`, `applyWeakSeamChain`,
`riskiestJunctions`, `weakSeamChainRange` and `junctionOutcome` as unshipped.
§13's "two modes, already locked" table names two functions that do not exist.

Step 20 therefore targets `site.ts#expand()` — v3's actual successor — and needs
no engine change. The victory-lap mode likewise needs none: `update.ts:71`
already reads `if (!outcome.structured) return atom;`, so an unstructured run
logs its evidence and moves no strength. Nothing atticked was resurrected.

`sitesForPage` is deliberately a SUPERSET of `expand()` and cannot be expressed
by it: `expand(first,last)` emits seams only BETWEEN its bounds, while a page
must also own the seam LEAVING it. That extra element is exactly edge case #38.

### v3-D48 — Boundary-seam ownership: measured, not asserted (edge case #38)

#38: "Adjacent page ranges orphan boundary seams (zero-emission): 13
crossesPage seams never drilled." Rather than trust the number, it was
reproduced: naive per-page `expand(first,last)` covers 97 of 110 Yusuf seams,
orphaning exactly 13 — from ayat 4, 14, 22, 30, 37, 43, 52, 63, 69, 78, 86, 95,
103. That is 12% of the surah's joints, silently undrillable.

The rule — a boundary seam is owned by the range containing its FROM ayah,
guarded by `lastAyah < ayahCount` so the terminal ayah never grows an outbound
seam (E-08) — restores all 110 with zero duplicates.

**Independently audited by the merger**, not merely by the build's own tests: a
throwaway harness executed the SHIPPED `pagesForSurah`/`sitesForPage` over the
real fixture and printed `SEAMS OWNED: 110, MISSING: [], DUPLICATED: [],
TERMINAL 111: false`. (A first attempt at that audit passed the wrong argument
shape and produced a false 13-orphan alarm — the harness was wrong, not the
code. Worth recording: an audit that disagrees with a passing test suite is
itself a hypothesis needing verification.)

### v3-D49 — The partial-page guard's test did not bite, and the build said so

Edge case: "a chain only credits atoms the learner has actually ENCODED —
un-learned ayat are skipped, not failed, or a 7/10-ready page looks like a 30%
failure."

The build agent mutated its own work (as instructed) and found that deleting the
`encoded` check left its test GREEN: the test helper only ever created atoms for
encoded ayat, so "missing atom" and "atom present but not encoded" were never
distinguished and a bare `!atom` did all the work. The helper was rewritten to
give un-learned ayat real atoms with `encoded: false`, plus an explicit
touched-but-never-encoded case. The mutation now kills 5 tests including the
denominator lie ("expected 10 to be 7").

This is the third instance in this build of a green test proving nothing
(v3-D38 tsc, v3-D45 stage labels). The difference here is that the mutation
discipline was in the brief, so the agent caught it BEFORE reporting rather than
a reviewer catching it after. That is the process working.

### v3-D50 — `make test` was BROKEN in the committed repo for a full day, and every "green" total since step 13 was overstated

`v3/api/phpunit.xml` declares a `Unit` testsuite pointing at `tests/Unit`.
PHPUnit HARD FAILS ("Test directory not found") when it is absent, and git does
not track empty directories — so the directory existed only on the machine where
it was hand-created (2026-08-10, step 13) and never in the repo.

Consequence: `make test-api3` exited non-zero, taking down all of `make test`,
and the v3/api suite's **71 tests never ran in any reported total** from step 13
onward. Local runs looked green because the directory was present locally.

Found by an adversarial verifier on step 20, reproduced immediately, and fixed
with a TRACKED `tests/Unit/.gitkeep` whose contents explain why deleting it
breaks the build. `make test` now exits 0 with all 71 running.

Corrected total: **1097** (255 v2 + 47 v2/api + 71 v3/api + 72 corpus-compiler +
391 engine + 15 fold-runner + 246 apps/web).

The pattern across v3-D38, D45, D49 and now D50 is one thing: **verification
that runs on the author's machine is not verification.** The tsc binary, the
stage-label test, the encoded guard and this directory all passed locally while
being broken or vacuous in the repo.

### v3-D51 — The outbox's pending marker is a FLAG ON THE ROW, drained by scanning `by_deviceSeq`

`syncedAt == null` is "pending". Not a high-water cursor, not a second store.

A **high-water cursor** (`lastSyncedDeviceSeq`) is fatal and was rejected on that
basis: a retried `RetryableAppendError` re-submits an **older, already-allocated**
deviceSeq (`append.ts:148-150` deliberately reuses it), so that row sits *below*
the mark and is never sent. Silent permanent loss. A **separate outbox store**
means two stores, two transactions, and a crash window between them.

The flag's failure mode is the benign one: a crash after the POST but before the
flag-write leaves rows pending, so they are **re-sent** — and re-sent is free,
because the uuid is the server's idempotency key (`insertOrIgnore` over
`unique(user_id, uuid)`). There is no failure mode that loses an event, because
a row is only marked synced **after** a 2xx that included it.

**There is no `by_syncedAt` index, and there should not be.** IndexedDB cannot
index `null` — a record whose indexed value is null/undefined is simply not in
the index — so such an index would contain exactly the SYNCED rows and omit the
pending ones, the opposite of what an outbox needs. `DB_VERSION` stays 1. The
drain scans the `by_deviceSeq` compound index (already ordered exactly as the
outbox wants to drain), bounded below by an `outboxLowWater` hint in `meta`.

That hint is a **performance optimization and never a correctness boundary**: it
is only advanced to a value proven to have nothing pending below it, so it can be
wrong-LOW (costing a scan) but never wrong-HIGH (costing an event), and its
absence means a full scan. That asymmetry is the whole difference from the
rejected cursor design.

Three `MetaKey` values were added (`pullCursor`, `pullCursorIdentity`,
`outboxLowWater`). No migration: `meta` is `{key: string}`-keyed and un-indexed.

### v3-D52 — The merge has NO OMIT LIST, and clause 7 makes B5's syntax unwritable

DEFECTS.md#B5 is one line: `const { seq: _drop, ...rest } = e`. v3 already removed
the *foundation* of that bug (the events store is keyed on the uuid, not an
autoincrement arrival counter), but B5 is reproducible by three other mechanisms:
dropping `deviceSeq` (every foreign device collapses into one uuid-ordered
bucket), dropping `deviceId` (two devices interleave as one stream), and the
invisible one — a row with an `undefined` member of the `by_ts` compound keyPath
is **not indexed at all** and vanishes from every canonical read.

So the rule is not "omit the right fields". It is that `merge.ts` has **no omit
list anywhere**: the merged row is `{...wireEvent, syncedAt}`, and `syncedAt` is
the only local field written. The legacy `seq` is **copied as provenance, never
re-derived and never stripped** — stripping is B5's gesture, re-deriving is B5's
bug. `check-boundaries.mjs` clause 7 greps `lib/sync/` for the destructure-with-
omit shape and fails the build, so the gesture is unwritable rather than merely
tested-against. Clause 6 does the same for raw `fetch()` at `/api`, which is how
B8's interceptor stays un-bypassable.

**#50 (existing id, divergent payload): KEEP THE LOCAL ROW and alert.** Never
silently drop, never silently overwrite. The local row is what this learner's
device observed and what its atoms were folded from; overwriting it with a
foreign payload would retroactively change history the learner already saw. One
poisoned uuid must not stop the rest of the page merging — that is #110's wedge
in a different costume.

**The digest normalizes "absent" and "null" to the same thing.**
`EventsController::toWire()` emits a field only `if ($value !== null)`, so every
round-tripped event loses its explicit nulls. A naive `JSON.stringify` digest
would report a divergence on EVERY round-tripped event and #50's alert would fire
constantly — the fastest possible way to train everyone to ignore it.

### v3-D53 — A 401 re-mint RESETS the pull cursor, and SPLITS server-side history

DEFECTS.md#B8's wedge is a **conjunction**: `ensureDevice()` returns early if
*any* token exists **and** nothing ever clears the token. Either half alone is
survivable, so the fix breaks both — `hasLiveToken()` is "exists AND not marked
dead", and the 401 path clears the token *before* any await.

**Mutation testing found the first half was inert as originally written.** When
"mark dead" and "clear" were the same action, removing the dead-marker changed no
observable behaviour (the token was gone anyway), so the mutation *"restore v2's
early-return on any-token-exists"* SURVIVED — v3-D49's pattern exactly, a guard
whose test cannot distinguish the two states it guards. Splitting `markTokenDead()`
from `clearToken()` made each half independently observable, and both mutations
now go red.

**Three redundant brakes** stop a permanently-401ing server minting users forever:
retry-once carried *in the call* (a parameter, not module state, so it cannot leak
across calls); a **single-flight mint** (N concurrent 401s otherwise mint N users
and N-1 silently orphan their events under abandoned accounts — a data-loss bug
wearing an auth costume); and a cooldown after a failed mint. `POST
/api/auth/anonymous` is **exempt from the interceptor** — a 401 from the mint
endpoint triggering a mint is the loop, directly.

**The cursor resets on every identity change.** `GET /api/events` is
`where('user_id', $userId)`, so a cursor is meaningless across users; a fresh
anonymous user's ingest sequence starts at 0, and a carried-over cursor would skip
their entire history forever. That is the one genuinely unrecoverable state in the
pull path, so when in doubt, RESET (re-pulling is merely slow).

**Accepted and flagged, not hidden:** the outbox is NOT reset, so pending events
re-push under the new identity while already-synced ones stay with the old — a
re-mint **splits a learner's server-side history across two anonymous users**. The
local log stays complete and correct (invariant #2 makes it truth), so nothing the
learner sees breaks. Reunification is the account-adoption merge job, M6's other
half, not step 21.

---

## 2026-08-11 — build-plan step 22: BLOCKED on authored content, and the blocker is correct

### v3-D51 — Surah 112 has ZERO distractors, so onboarding screen 2 cannot be built honestly

WIREFRAME §17 calls screen 2 — a live tap-to-reconstruct of Al-Ikhlas 112:1 with
no account — "the single most important moment". Step 22 stopped WITHOUT
building it. Verified independently, three ways:

- `data/raw/` holds `12-mcq-items.json` (1.9 MB, 1777 authored entries with
  human pedagogical rationale). There is NO `112-mcq-items.json` and no `103-`
  equivalent.
- Compiling 112 succeeds and prints its own verdict:
  `surah 112: 4 verses, 15 words, 0 distractors, 3 connections`.
  Control: surah 12 has 8880.
- Driven through the REAL engine, every blank in a 112 reconstruct pass returns
  `optionsLen=1` — a tile bank containing ONLY the correct answer, for all four
  blanks. Surah 12 returns 3–4.

A reconstruction the learner cannot fail is not a demonstration of the mechanic;
it is a slot machine that always pays. Shipping it as the product's most
important moment would be the vacuous-verification failure this build has
already made four times (v3-D38/D45/D49/D50) — except shipped to a person
instead of to CI.

**Three routes existed and all were correctly refused:**
1. *Author ~60 foils in-agent.* The existing entries carry authored pedagogical
   reasoning about Quranic text. Generating that is content authorship about
   sacred text — the spirit of INVARIANTS.md Absolute B, not merely its letter.
2. *Implement foil kernels.* `buildCorpus.ts:13` states they are "intentionally
   NOT implemented here; separate follow-on work". A compiler feature is not an
   onboarding step.
3. *Substitute surah 12.* Contradicts §17 (whose whole premise is "nearly every
   target user half-knows Al-Ikhlas") and §18 (the landing demo is the same
   112:1 reconstruction). 12:1 is also the muqatta'at opener — the opposite of
   a half-known ayah.

**This gates step 22's screen 2 AND step 29's landing demo**, which are the same
artifact. It needs a human decision: author 112's distractors, or build the
foil-kernel compiler feature, or consciously re-spec the demo surah.

### v3-D52 — `output/` is gitignored, so a fresh clone has NO corpus at all

Related and separately real: `v3/packages/corpus-compiler/.gitignore` excludes
`output/`, nothing in CI or `make build` runs `make compile-corpus`, and
`lib/corpus/load.ts` hardcodes `AVAILABLE_SURAHS = [12]` reading the engine's
test fixture. So the app's corpus is a build artifact nobody builds. Whatever is
decided about 112's distractors, the SERVING PATH needs a decision too.

### v3-D53 — "Recall before identity" was decorative; it is now gate clause 8

WIREFRAME §17's governing rule lived only in prose. An adversarial mutation
placing an email capture as the FIRST element of the landing page passed every
gate and all 319 tests.

Now enforced by `check-boundaries.mjs` clause 8: identity-capture markup
(`type=email`, `name=email`, password/username autocomplete,
`Notification.requestPermission`) is banned on pre-recall surfaces — the landing
page and, as they land, onboarding steps. A surface that legitimately captures
identity AFTER recall opts out with an explicit `@allow-identity-capture`
marker, so every exception is a visible reviewable decision rather than silent
drift. Verified: the exact mutation that previously survived now fails the build
with a message naming file, line, and the rule.

The clause is written to be EXTENDED — `PRE_RECALL` lists the surfaces, and a
new pre-recall route must be added to it. That is deliberate: an unlisted route
is a hole, so the list is the thing to review when onboarding lands.

---

## Ratified 2026-08-11 — build-plan steps 23–26 (M7 monetization, M8 admin/flags)

### v3-D54 — Q5 resolved: lapsed is review-only INDEFINITELY; WIREFRAME's "7 days" is stale prose

Two documents disagreed and the paywall would have been built twice:

- `docs/WIREFRAME.md:86` (inside the v3-D07 block) and `:348` both say "Reviews
  stay open for **7 days** past the trial."
- `DECISIONS.md` **v3-D16** says lapsed entitlement is review-only
  **indefinitely** — "Never delete, never hard-stop."
- `docs/BUILD-PLAN.md:199` Q5 frames exactly this as OPEN: "review-only
  INDEFINITELY (strongest never-hostage reading, recommended default) or
  review-only for 7 days then hard stop?"

**v3-D16 wins**, on three grounds: it is the later ratified decision; CLAUDE.md's
authority order puts `DECISIONS.md` above `docs/WIREFRAME.md`; and BUILD-PLAN's
own Q5 names indefinite as the recommended default. The WIREFRAME "7 days" lines
are hereby **stale prose**, not a competing requirement. They are left in place
un-edited (WIREFRAME is the spec of what the product *is*, and rewriting history
there is not this build's habit) — this entry is the supersession record.

**What this means mechanically:** `lapsed_review_only` is a
**terminal-but-reversible sink, never an absorbing one**. It never expires, never
sets a TTL on data, never schedules a purge, and has no timer of any kind. The
only purge path in the entire system is learner-initiated PDPA delete. A test
asserts a lapsed entitlement 10 years past its lapse still permits review
(`EntitlementStateMachineTest`), so a future "cleanup" cron cannot quietly
reintroduce the 7-day stop.

### v3-D55 — The paywall boundary is a GATE CLAUSE, not a docblock

`#124` ("events for an out-of-entitlement surah are ALWAYS ingested — the log is
truth") is the single worst thing in this product to get wrong: a paywall that
drops evidence corrupts the memory graph permanently, and the corruption is
silent because the missing events simply never existed.

Prose has failed this build five times (v3-D38 tsc, D45 stage labels, D49 the
encoded guard, D50 the testsuite dir, D53 the token guard). So the rule is
enforced **statically, in two places**:

- `apps/web/scripts/check-boundaries.mjs` **clause 9** — an entitlement-read
  ALLOWLIST. Only named files may mention `Entitlement`/`entitlements`/
  `PaywallGate`/`entitled`. Every other file fails the build with file+line.
- `v3/api/tests/Feature/Boundaries/EntitlementBoundaryTest.php` — the PHP
  counterpart, with `EventsController.php` **specifically outside** the list.

Both directions are mutation-tested (v3-D49's lesson: a clause that only ever
passes proves nothing). Adding `Entitlement` to the fold path fails; REMOVING a
legitimate file from the allowlist also fails.

Enforcement lives at exactly **three** points and nowhere else: session assembly
(issuance-only, #96/#123), corpus delivery for non-trial surahs, and checkout.

### v3-D56 — Stripe: the state machine is real, the fixture set is EMPTY, and the gate is RED

Per the brief's "do NOT fake Stripe": no `StripeService` stub exists, and no
handler has an `if (app()->environment('testing'))` branch. Handlers take a
parsed, verified event array; tests supply recorded JSON.

**No test-mode Stripe account exists yet**, so `v3/fixtures/stripe/` is empty and
the replay suite is **RED by construction** — `ReplaySuiteTest` asserts a
MINIMUM FIXTURE COUNT before it asserts any behaviour, and is marked skipped-with-
reason rather than passing vacuously over zero cases. That is v3-D50's failure
mode (71 tests that never ran) and it is refused here explicitly.

The state machine, the transition guards, the idempotency index, the ordering
precedence and the merge rule are all fully tested against **hand-built event
arrays in the recorded shape** — which is legitimate, because those tests
exercise the domain logic, not Stripe's wire format. What is NOT tested, and
cannot be until an account exists: that Stripe's real payloads have the field
names the handlers read. That gap is named in `DEFECTS.md#PAY-1`.

**Human-gated, calendar lead time, start now:** Stripe MY business verification
(KYC, days-to-weeks — BUILD-PLAN says "Stripe account from M0", so this is
already LATE); FPX + GrabPay per-method activation; Q7 (card-only monthly vs
Curlec; SST-inclusive?); refund policy numbers.

---

## 2026-08-11 — steps 22, 25, 29: onboarding, workbench, landing

### v3-D56 — explain() lives APP-SIDE, not in the engine

v3-D37 tracked explain() as an M8 precondition without settling where it lives.
Settled: `v3/apps/web/lib/workbench/explain.ts`. The argument, from WIREFRAME
§22's DATA/CODE split — CODE owns decisions, and explain() DECIDES NOTHING. It
calls `buildQuestion`/`variants`/`admit`/`buildResourceLedger` (all already
public) and narrates their return values.

Three reasons it stays out of the engine:
1. Its only consumer is a view, so its shape is driven by what a pane renders.
   Putting a UI-shaped type in the engine puts un-invariant-governed English in
   the engine's public surface.
2. Derived must not become authoritative. Beside `buildQuestion`, some future
   caller reads `trace.admitted` instead of calling `admit()` — two paths to one
   judgement that can disagree. Held app-side over the public API, the module
   has NO corpus knowledge of its own, so divergence is structurally impossible.
3. Direct precedent: `lib/drill/sites.ts` needed a superset of `expand()` and
   its header states the same rule.

BUILD-PLAN listing explain() in M4's Ships line does not make it an engine
module; M8's own line says "three-strength preview VIA explain()", i.e. a
consumer.

### v3-D57 — ONE demo, and the drift that proved why it matters

Onboarding screen 2 (§17) and the landing demo (§18) are the SAME 112:1
tap-to-reconstruct. They were built by two agents in one run and became TWO
implementations — 1061 lines across `lib/demo/` + `components/demo/` and
`lib/onboarding/` + `components/onboarding/`, sharing nothing.

They had already drifted, and in the direction that matters. The engine returns
`[correct, ...distractors]` — correct ALWAYS at index 0 — because `options.ts`
states display order is the UI's concern. Onboarding seed-shuffled it. **The
landing demo did not.** So on the page WIREFRAME calls "the conversion engine",
tapping the first tile four times produced a flawless reconstruction, and the
page would then have claimed the visitor recalled an ayah they never read.

A demo that lies about memory is worse than no demo. Both surfaces now share
one shuffle (`lib/onboarding/pass.ts#displayOrder`), seeded so a re-render never
moves a tile under the learner's finger.

### v3-D58 — Assert the OUTPUT, never the ingredient

My first regression test for the above asserted `displayOrder`'s permutation
directly. It SURVIVED reverting the demo to correct-first order — because the
helper was still correct, it simply was no longer being called. A test of an
ingredient cannot detect that the dish stopped using it.

Rewritten to drive `startDemo`/`stepOf`/`applyTap` and assert the correctIndex
sequence the visitor actually sees. Verified: RED against the unshuffled demo,
green with the fix.

This is the SEVENTH vacuous verification in this build (v3-D38 tsc-as-TeX; D45
link counts not link text; D49 a guard whose test never distinguished its two
states; D50 a testsuite dir on one machine only; D53 a rule enforced by prose;
a trailing-\b regex letting every real identifier through; and now this). The
pattern is stable enough to name: **a test that passes tells you about the test.
Mutate the thing, or you have learned nothing.**

---

## Ratified 2026-08-11 by Firdaus — BUILD-PLAN Q3 answered, and a kernel defect he caught

### v3-D59 — Q3: the second revenue surah is AL-MULK (67)

BUILD-PLAN Q3 ("Launch surah set — the fixed floor is 12 + 112 + 103; is the
revenue-path second surah Al-Mulk or a Juz Amma batch?") is CLOSED: Al-Mulk.
This also matches WIREFRAME §17's own named default, so onboarding no longer
diverges from the spec.

Vendored from the Quran.com API using the EXACT commands `data/raw/README.md`
documents, reshaped to the same schema, with completeness guards asserted
before writing. **30 ayat, 333 words, pages 562-564.** Two independent
confirmations: WIREFRAME already recorded Al-Mulk as "narrative-adjacent, 333
words", and QAC morphology independently yields 30/333. Zero words missing an
English translation. 1665 kernel-generated distractors; compile PASS.

A test guarding this exact gap ("does NOT offer the wireframe's default,
because it is not compiled") was written to FAIL the day 67 compiled, so a
human would decide rather than drift into offering it. It failed on schedule.
This entry is the decision it demanded; its assertion is unchanged.

### v3-D60 — Kernel foils must be DISPLAY-distinct; authored foils must not be

Firdaus reviewed the QA sample and rejected a real defect I had not caught:
67:17 p12 and 67:28 p11 each drew `خَيْرٌ`, `خَيْرٌۭ` and `خَيْرُ` — the same
word three times, differing only in final diacritic. A bank claiming 5 foils
offered 3 real choices. Measured before the fix: 44% of Al-Mulk's option sets
and 60% of Al-Ikhlas's were affected.

`displayKey()` strips harakat/tanwin on top of `gradeKey()`'s NFC+tatweel fold,
and `FoilSet` rejects a candidate that collides with a sibling — or the target —
under it.

**It applies to KERNEL output ONLY, and that exemption is the important half.**
My first attempt applied it to authored banks too. `validate.ts` caught it
immediately: 100+ surah-12 coordinates fell below the 4-distractor hard floor,
because surah 12's authors deliberately use case-ending (iʿrāb) minimal pairs —
`ءَايَـٰتُ` / `ءَايَـٰتٌ` / `ءَايَـٰتٍ`, the same stem under different final
vowels. Telling those apart IS Quranic competence, and v3-D12 keeps them
distinct for grading on purpose. A kernel emitting three spellings of one word
has no such intent; an author choosing three case endings does.

Result: kernel surahs (103/112/67) now have ZERO near-duplicate sets; surah 12
keeps all 291 of its deliberate pairs; no coordinate anywhere is below the
floor. 67:17 p12 went from three slots on one word to five distinct rhyming
forms.

**Worth recording about the process:** a human reviewer reading a 2-item sample
found a defect that 101 compiler tests, a foil-kernel test suite written
specifically to judge foil QUALITY, and my own three-way verification had all
missed. The mechanical checks asked "is this foil attested, non-duplicate under
grading, and non-identical to the answer?" — all true. They could not ask "would
a learner see three tiles as one word?" That is the gap human review exists to
close, and it is an argument for the M9 QA sample being a gate rather than a
formality.

### v3-D61 — A sacred-text test that cried wolf

Adding surah 67 turned `foilKernels.test.ts`'s "every kernel foil is real corpus
bytes" RED on 18 foils — all legitimate Al-Mulk word forms. The kernel had
correctly widened its pool; the test had a hardcoded `[12, 103, 112]`.

Fixed to derive the pool from the VENDORED RAW INPUTS (not `output/`, which is
gitignored per v3-D52 and absent on a clean checkout). A sacred-text assertion
that fires on real corpus bytes is worse than none: the next person to see it
red will assume a stale pool and wave it through — on the one test in this repo
that must never be waved through.

---

## 2026-08-11 — the QA sample is SIGNED; one real blocker remains

### v3-D62 — Firdaus signed all 216 QA items, having been shown all 216

Every item in all four samples (12: 178, 67: 34, 103: 2, 112: 2) was displayed
in full — answer, all five foils, and any mechanical flag — and approved.
`signedBy: "Firdaus"`, `reviewerRole: qari`, `displayedInFull: true`, each
sample stamped against the CURRENT corpus hash.

The sequence that got here is worth keeping, because it is the argument for the
gate existing at all:

1. A blanket "all sound" was declined while only 10 of 216 items had been shown.
   Not on authority grounds — Firdaus is the named qari (v3-D22) and his
   authorisation is real — but because a signature records an OBSERVATION, and
   no authorisation makes an unseen foil seen.
2. Of those first 10, he REJECTED two, which produced v3-D60: kernel foils that
   were the same word three times under different diacritics. 44% of Al-Mulk's
   option sets and 60% of Al-Ikhlas's were affected. 101 compiler tests, a suite
   written specifically to judge foil QUALITY, and three rounds of my own
   verification had all passed it.
3. Fixing it changed the corpus, so the sampler redrew and his 10 verdicts no
   longer mapped onto any current coordinate. Carrying them across would have
   attributed judgements he never made about foils he never saw.
4. All 216 were then displayed and approved. That signature is now worth
   something precisely because the first one was declined.

### v3-D63 — Q3's answer flows into the gate; one blocker survives, and it is real

`content-freeze.mjs`'s LAUNCH_SURAHS was `[12, 103, 112]` with a comment saying
Q3 could not be enumerated while open. Q3 is answered (v3-D59), so the list is
now `[12, 67, 103, 112]` and BUILD-PLAN's Q3 entry carries an explicit ANSWERED
marker. Detection changed from "is the question present" to "is the ANSWER
present" — the question text stays as a record, so grepping for it would report
OPEN forever.

Adding Al-Mulk to the gate immediately surfaced a blocker that had been INVISIBLE
while it was outside the launch set: **surah 67 is 30 ayat, therefore not ATOMIC
(v3-D21's <=8 threshold), therefore it OWES a macro panel — and it has zero
scene beats.** 12/103/112 all pass (Yusuf has 19 authored beats; the other two
are atomic and owe none).

Status: 4 of 5 M9 criteria MET. The gate stays CLOSED on authored narrative
content for Al-Mulk, which is human work — BUILD-PLAN budgets it in days and
names Firdaus or a hired writer. This is the correct outcome: broadening the
launch set added a real obligation rather than a formality, and the gate found
it the moment the scope changed.

---

## 2026-08-11 — a commit-hygiene failure of mine, recorded because the log cannot show it

### v3-D64 — The landing refactor is buried in commit ab6b986 and is unattributable

An adversarial verifier caught this, and it is my error, not an agent's.

Commit `ab6b986` is titled *"QA sample SIGNED (216 items); Q3 flows into the
freeze gate"*. Its message describes only the QA signing and the freeze gate.
But its diff also contains **11 files of the nexura-pattern landing refactor** —
`app/page.tsx` (+271), five new `components/sections/` modules,
`components/ui/{Button,Container}.tsx`, `lib/cn.ts`, `lib/i18n/dictionaries.ts`,
and a 60-line widening of `check-boundaries.mjs`.

Cause: I ran `git add -A` while a concurrent workflow agent was mid-write in the
same tree. I had done exactly this safely many times by checking
`git diff --cached --stat` for frozen-tree violations — but that check answers
"did I touch v1/v2/engine", not "is everything staged actually mine to describe".

Consequences, stated plainly:
- The refactor cannot be reverted independently of the QA signatures.
- Anyone reading the log for "when did the landing page change shape" finds
  nothing.
- The commit message is not false, but it is materially incomplete, which for a
  record is nearly as bad.

Not rewritten: `ab6b986` is already pushed to `main`, and rewriting shared
history to tidy a message is a worse trade than an honest correction. This entry
IS the correction, and the refactor's own findings are recorded in v3-D65 so
they are not lost with it.

**The rule going forward:** before `git add -A`, check `git status` against what
you actually did, not only against what is forbidden.

### v3-D65 — The landing refactor: 5 of 8 sections, and the gate hole it closed

Taken from the reference project (`toniwin/web/nexura-clone`): the composition
root, one module per section, a `Container`/`Button` primitive pair, a single
`cn()` helper, and a locale-dictionary scaffold. **Deliberately NOT taken:**
Tailwind (the reference is Tailwind-based; `iman-ui.css` is byte-gated and the
design plan rejected Tailwind as fighting a locked system — verified absent from
`package.json`, postcss config, and every new file's classNames) and
`@opennextjs/cloudflare` (different deploy target).

**Only 5 of 8 sections were extracted, and stopping was correct.** Extracting
hero, demo and footer turned three tests red — `shell`, `landing-page` and
`attribution` each read `app/page.tsx` AS A FILE to verify a property of the
route (that it has a real `<h1>`; that `InlineDemo` comes from neutral
`components/demo/` and so has not forked from onboarding; that the
`/attribution` link exists, since a page linked from nowhere discharges no
v3-D24 obligation). Moving that evidence into modules those tests do not read
would leave all three passing against whatever the root happened to contain —
the ninth vacuous verification. Three extractions were reverted rather than
three tests weakened.

**It also closed a real gate hole.** Extracting sections moved landing markup
out of the one file `check-boundaries.mjs` clause 11 (v3-D19: no tajwid claim,
no replace-a-teacher claim) scanned. The verifier proved the hole by the INVERSE
mutation — removing `components/sections/` from the claim scope while leaving a
forbidden claim on disk — and got `boundaries: OK, EXIT 0`. Clause scope is now
widened; both directions bite.

### v3-D66 — The 1551 floor was real; a verifier's 1504 was a misread

The adversarial verifier reported `make test` at 1504, below the 1551 floor, and
correctly refused to waive it. Re-derived by hand: 255 v2 + 47 v2/api + **194**
v3/api + 101 corpus-compiler + 391 engine + 15 fold-runner + 548 apps/web =
**1551**, exit 0. The 194 was read as 147. `make test` does not print the v3/api
count in the same format as the vitest suites, which is what made it misreadable
— worth fixing if the number is ever used as a gate.

Recorded because the verifier did the right thing with the information it had:
it flagged a floor breach rather than assuming its own arithmetic was wrong.

---

## Ratified 2026-08-11 (late) — build-plan step 30 / M10: the nightly scheduler + window ledger

### v3-D67 — The determinism checks get RUNNERS, a SCHEDULE, and a LEDGER; the 7-night window becomes startable

v3-D32 built the fold-runner's pure core and deferred "the DB adapter,
scheduling, advisory locks, dead-letter queue". LAUNCH-CHECKLIST gates 3, 4 and
10 have since read BLOCKED-ON-INFRA with the same sentence: "**Missing:** a live
staging host running the fold-runner nightly." That framing hid a second,
purely-local gap — **nothing in the repo ran the checks at all**, on any host.
`SystemHealthController::foldDeterminism()` read
`Cache::get('health:fold_determinism_check')` and no line of code anywhere ever
wrote that key. The dashboard's honest `unknown` (edge case #167) was permanent
by construction, and the 7-night window could not have started even if staging
had existed, because the thing that counts nights did not exist either.

This run builds the missing half, all of which is local:

- **`worker/fold-runner/src/severity.ts`** — BUILD-PLAN's taxonomy as a type
  and an **exit code**, not a log string: green 0 · **warn 3** · **p1 4** ·
  error 5. 1 and 2 are deliberately unused so a Node crash or a shell usage
  error can never be decoded as a verdict. `resetsWindow()` / `countsAsGreen()`
  encode "confirmed P1 resets the window, WARN does not" as functions.
- **`src/foldCheck.ts`** — classifies **per row, not per run**: a divergent key
  whose cached row carries the CURRENT engine version is a P1; one carrying a
  DIFFERENT version is skew (WARN); one **missing a version entirely is a P1**,
  because a half-written cache must page rather than shrug. Worst verdict wins.
- **`src/selectionCheck.ts`** + **`bin/*.ts`** — two runnable checks whose exit
  code is the verdict. `--fixture` makes both runnable with **no database**, so
  a human proves the nightly works without waiting for a night.
- **`api`: `determinism:check`, `nightly:window`**, the `nightly_check_runs` /
  `nightly_window` tables, `NightlyWindowLedger`, and the `Schedule::command`
  wiring in `routes/console.php`.

### v3-D68 — The window is a LEDGER of nights, never a counter

The obvious implementation is an integer incremented per green night and zeroed
on a P1. It is also unauditable: when it reads 6 on launch eve, nobody can
answer "which six nights, and what did each actually compare?" — which is
exactly the argument edge case #169 anticipates ("7-green-nights arithmetic →
contested gate"). So `nightly_check_runs` stores one **immutable row per run**
(severity AND raw exit code AND the runner's full JSON report), and the streak
is **derived** by replaying those rows. `nightly:window` prints the streak with
a dated table of every night behind it.

Four rules, each tested directly and each proven by mutation:

1. **Both checks, every night.** A night with only one is a night with a
   missing check, not a green one.
2. **A confirmed P1 resets to zero** — restarts the day after, does not merely
   pause. A re-run on the same night does **not** launder it: the worst
   severity per (night, check) wins.
3. **A WARN does not reset, and does not break the chain.** If it did, no
   engine could be deployed inside the seven days and the gate would be
   unreachable rather than strict.
4. **Nights before `window_started_at` never count**, however green — that is
   BUILD-PLAN's "starts only after the last engine/selection merge". Stamping
   it is a human action requiring a `--reason`; no automation can know whether
   today's merge touched selection semantics.

Additionally: **a calendar gap breaks the streak.** A scheduler that silently
stopped for three days leaves green rows a naive `count(green)` would call "4
and counting" when the truth is "unobserved since Tuesday". An **error** night
does not count green (it ends the run) but does not reset to zero either — it
is unknown, and unknown is never passed (edge case #167, applied to nights).

### v3-D69 — The selection check gets its OWN log; the golden log has zero selection events

BUILD-PLAN says selection_determinism_check runs "against the shuffled golden
log". Measured: `fixtures/golden-log/events.json` holds **24 events, 0 of them
selection-bearing** — it was cut at build-plan step 2 and the selection wire
fields were not frozen until step 10. `replaySelection` skips any event lacking
siteKey/deviceId/visitOrdinal, so a runner pointed at the golden log would build
an **empty trace, compare nothing, and exit green every night forever** — a
ninth vacuous verification, shipped as a launch gate.

So `fixtures/selection-log/` is generated (`scripts/gen-selection-log.ts`, 36
events, 5 sites, 2 devices) carrying the fields the check actually reads,
including the **two-device merge** (edge case #48: both devices number their own
visits to one site from 1) and a **seam** site. The golden log is unchanged and
still the FOLD's fixture. Both runners additionally enforce a **vacuity floor** —
zero samples, zero atoms, or fewer than 20 traces is an **error**, never a green.

### v3-D70 — Single-flight is a run-level cache lock; per-user advisory locks stay deferred, and this is stated rather than faked

v3-D32 deferred per-user Postgres advisory locks because "sqlite, this repo's
dev DB, has no equivalent to test against". That is still true. Rather than
write an untestable Postgres-only path and claim it works, `determinism:check`
single-flights at the **run** level with `Cache::lock` — the same mechanism
`SystemHealthController::REBUILD_LOCK` already uses for the atom-cache rebuild,
and for the same reason (edge case #168: concurrent folds interleave into a
state neither would produce, which then reads as a P1 that never happened).

What that buys: two nightlies cannot overlap. What it does **not** buy:
protection from a nightly reading a learner's cache mid-refold. Mitigated by
snapshotting each learner's log at an **ingest-sequence ceiling** (`events.id <=
cursor`) so at least the log side is a consistent read. The cache side can still
be mid-write — which is why BUILD-PLAN's word is *confirmed* P1, and why a live
P1 should be re-run before the window is declared reset.

---

## 2026-08-11 — the correction that matters most: I OVERSTATED completion

### v3-D67 — A learner cannot complete a session. I reported steps 18/19/22 as done. They are not.

Two independent agents established this and I reproduced both halves myself:

- `app/(app)/session/page.tsx` is a `StubNote`. Its own header says the render
  layer landed but "the SESSION LIFECYCLE that feeds it is not [built], so this
  route is still a stub."
- **`append()` has ZERO reachable callers.** `grep -rn "append(" app/ components/`
  returns nothing outside tests. The `events` store — invariant #2's "the event
  log is the truth" — is never written by any user interaction that exists.
  Onboarding writes `meta`; the demo and first-recall screens write nothing by
  explicit design; the drill picker previews and stops.

Six routes still render `StubNote`: `/home`, `/library`, `/progress`,
`/session`, `/surah/[surah]`, `/surah/[surah]/[ayah]`.

**What I said versus what is true.** I reported step 18 as "the quiz loop" and
step 19 as "the visible memory graph", and both commits described real work —
the four render shapes with 47 tests built from live engine output, the ring
rendering connection atoms, the semantic progress table. All of that exists and
is good. But COMPONENTS ARE NOT A PRODUCT. Nothing wires them into a session a
learner can start, finish, and have recorded. I called those steps complete on
the strength of passing tests over components, which is exactly the error this
build has now made nine times in a different costume: **the tests were true and
my summary was not.**

HANDOVER.md, written by an agent with no stake in my earlier claims, had this
right before I did: step 18 NOT BUILT, steps 19 and 22 PARTIAL, each with the
stub file named. I should have read it as a correction rather than a status.

**The honest state:** the engine, corpus, backend, sync layer, render components
and gates are real and heavily verified. The application that assembles them
into a usable product is not finished. That is a large remaining piece of work,
not a formality, and no amount of further verification of the parts changes it.

### v3-D68 — The golden log could never have failed the selection check

Building the nightly runner surfaced this: `fixtures/golden-log/events.json`
holds 24 events and **zero selection-bearing ones**. Pointing
`selection_determinism_check` at it would have compared nothing and exited green
every night forever — a launch gate structurally incapable of failing, guarding
the 7-night window.

Fixed with a vacuity floor: below a minimum trace count the runner returns
`severity: "error"`, exit 5, and refuses to report green over an empty
comparison. Mutation-verified in both directions.

This is the same failure as v3-D38 (a `tsc` that was really TeX) and v3-D50 (a
test directory that existed on one machine): a check that cannot fail is worse
than no check, because it manufactures confidence. That is now nine instances.
Every one was found by adversarial review or by a human, never by the passing
suite itself.

### v3-D69 — Step 30's real state: the ledger is built, the window cannot start

`nightly_check_runs` + `nightly_window` + `NightlyWindowLedger`, with BUILD-PLAN's
taxonomy as EXIT CODES (green 0, warn 3, p1 4, error 5; 1 and 2 deliberately
unused so a Node crash cannot decode as a verdict) rather than log strings.
Classification is per-row: a divergent key on the current engine version is P1,
on a different version is skew (WARN), and **missing a version entirely is P1** —
a half-written cache must page, not shrug. Mutation-verified in both directions:
P1-counts-as-green turns 4 tests red, WARN-resets turns 2 red.

Playwright: 34 tests, genuinely executed (24.8s, cold production build), not
written-and-claimed.

But the window itself CANNOT START. It counts nights on live staging that does
not exist, and there is no service worker at all — so M5's airplane-mode exit
criterion fails on a plain reload (`ERR_INTERNET_DISCONNECTED`). An
already-hydrated page does keep drilling offline, which proves the local-first
architecture underneath is sound; the missing piece is the cached shell.

---

## 2026-08-11 (later) — the session loop, and two defects it exposed

### v3-D70 — `acquire()` never granted the lock, so writing was IMPOSSIBLE

Wiring the session loop surfaced a defect that had been shipped for eight
build-plan steps and would have made the product unusable on day one.

`writeLock.acquire()` raced `navigator.locks.request` against a
`queueMicrotask` fallback. The browser grants a lock in a LATER TASK, never
within the current microtask checkpoint, so **the fallback always won**. Every
tab settled as `reader`, `isWriter` was never true, and `assertWriter()` threw
on every append. A single tab with no contention was told "the session is open
in another tab".

Why no test caught it: every one of the 10 writeLock tests used
`forceForTests`, which sets status directly. **Not one exercised `acquire()`.**
The seam that made the tests convenient was the seam that made them blind.

Why it went unnoticed: nothing in the app called `acquire()` or `append()` at
all (v3-D67), so a permanently-reader lock had no observable consequence. Two
defects hid each other — the dead code path could not reveal the broken lock,
and the broken lock would have blocked the code path the moment it existed.

Fixed with a 250ms grace timer, cleared the instant the grant lands so a
granted writer is never demoted. Three new tests drive the REAL `acquire()`
against a Web Locks stub that grants in a later task. Mutation-verified:
restoring `queueMicrotask` turns 2 of them red.

### v3-D71 — onboarding enrolled learners in a surah the app could not serve

`DEFAULT_SURAH` is 103. `CLIENT_SURAHS` was `[112]`. So **every learner who
accepted the pre-selected default** finished onboarding, tapped into the
session, and hit "this surah is not available on this device yet" — a dead end
one tap after enrollment, on the product's main path.

No unit test caught it because they all hardcode 112. Only the e2e walk, which
uses the real onboarding default, exercised the enrolled surah.

Fixed by staging 103 and 67 (24KB and 552KB). Yusuf (12) stays server-side at
3.3MB. Two new tests: the default must be staged, and every `OFFERED_SURAHS`
entry except 12 must be staged. Both fail against the old list.

The rule: **anything onboarding can enroll a learner in must be servable, or
enrolling them is a promise the app cannot keep.**

### v3-D72 — the session loop itself

`lib/session/run.ts`: `rebuild` → `assembleQueue` → `buildQuestion` → `append` →
`summarizeSession`. No React, no DOM — a plain state machine over (corpus, log)
that the route drives, so it is testable end-to-end without rendering. It lives
in `lib/` because `check-boundaries.mjs` clause 5 forbids `assembleQueue` under
`app/`/`components/`; the engine decides what to serve, the view never does.

Resume is not a separate path: the queue derives from the FOLD of the log, so a
reload re-derives what is still due (#93). `session_start` is emitted only for a
genuinely new session — a resume that re-emitted it would reset the duration
origin and make every reload look like a fresh sitting.

**Commit before paint** is enforced by construction: `answerCurrent` awaits
`append` before returning a state carrying `lastTap`, and `lastTap` is the only
way to obtain a `reveal`. A verdict cannot reach the screen without a durable
event behind it.

Mutation-verified, 5 mutations: deleting the tap append (5 tests red), always
`correct:true` (2), `structured:false` (2), re-emitting `session_start` (2), and
un-awaiting the commit — **which SURVIVED three times**. The first
commit-before-paint test read the log after awaiting and passed against
fire-and-forget, because fake-indexeddb settles in the same microtask drain. The
second polled in parallel and FAILED on correct code — it measured when the test
noticed the write, not when the write happened. The third delayed every append,
and the separately-awaited `ayah_produced` write masked the mutant. Only the
fourth — delaying the TAP append specifically — constrains anything.

That is four attempts to write one honest ordering assertion, and it is the
tenth vacuous-verification incident in this build. The pattern is now
unmistakable: **an assertion that is true tells you nothing until you have seen
it fail.**

### The honest state after this change

A learner can now complete a session in a real browser and the taps reach the
log — proven by e2e, on disk, across the full walk. Five stub routes remain
(`/home`, `/library`, `/progress`, `/surah/[surah]`, `/surah/[surah]/[ayah]`),
there is still no service worker, and the 7-night window still cannot start.

---

## 2026-08-12 — the five stub routes, the service worker, and a false mutation claim

### v3-D73 — a test comment claimed a mutation result that was not true

`e2e/airplane-mode.test.ts`'s "/api is NEVER answered from cache" test carried a
header documenting three earlier vacuous versions of itself and asserting of the
fourth: "mutation testing confirms they do [fail]."

I ran that mutation. **Deleting `if (url.pathname.startsWith("/api/")) return;`
from `sw.js` entirely leaves all 9 tests in the file GREEN.**

The reason is structural and worth knowing before anyone "simplifies" the
worker: the /api early-return is DEFENCE IN DEPTH, not the load-bearing guard.
What actually keeps /api out of the cache is that the cache-first branch is an
ALLOWLIST (`/_next/static/`, `/corpus/`, `/fonts/`), so an /api GET falls
through every branch and is never stored. Both guards must fail together.

Measured, not assumed: removing the early-return AND widening the static branch
to `true` **does** turn the test red. So the test is NOT vacuous — it proves the
RULE holds — but it does not pin the early-return specifically, and no test in
this repo does. The comment now says exactly that.

The lesson is narrower than the previous ten incidents and sharper for it: a
test can be genuinely load-bearing while a *claim written about* it is false.
This build's discipline has been "mutate the code"; this adds "and re-mutate
when you inherit someone else's claim that they did." The agent that wrote it
had honestly mutated versions 1-3 of its own test — the note simply outlived the
evidence for it.

### v3-D74 — the five stub routes are wired

`/home`, `/progress`, `/library`, `/surah/[surah]/[ayah]` and a service worker,
built by five isolated agents and merged here. 94 new tests (1718 → 1812), 40/40
e2e, typecheck clean, boundary and locked-CSS gates pass, `make build` clean.

**M5's exit criterion now passes.** `public/sw.js` + `ServiceWorkerRegistrar`
mean one online visit then a cold offline drill works — verified in a real
browser, with a plain reload serving the route rather than a fallback page. This
was structurally impossible yesterday (there was no service worker at all).

Two self-reported surviving mutants were both genuinely CLOSED by the agents
that found them, and I re-ran both to confirm rather than take their word:
dropping the `kind === "ayah"` guard from `ayahRow` and collapsing the `pending`
branch into the empty state (edge case #73 — painting "Not started" at a learner
who may be carrying the ayah) each turn a test red now.

`app/api/e2e-cache-probe/route.ts` ships in the production bundle deliberately:
`check-boundaries.mjs` skips `public/`, so sw.js has no static enforcement, and
the only way to prove "never cache /api" is a route Next really serves that a
broken worker could really cache. It reads nothing, writes nothing, takes no
input and returns a constant.

### v3-D75 — a 404 on the product's main path, found by an agent working elsewhere

`SessionGate` (which I wrote yesterday) linked an un-enrolled learner to
`/onboarding`. That route DOES NOT EXIST — `(onboarding)` is a route group and
contributes no URL segment, so onboarding lives at `/start`. Every learner who
reached /session without an enrollment was sent from the one screen that noticed
to a 404.

Now a shared `ONBOARDING_HREF` constant, so the two cannot drift again.

### What is still not done

Honest gaps the agents reported and I did not close:
- **Multi-surah is not built** on `/home` or `/progress`. `readChoices()` returns
  a singular `surah`; there is no enrollment list. Rendering rows for surahs a
  learner never enrolled in would be a fabricated enrollment, so both routes
  render the one real enrollment and name the plural case in a trimmed note.
- `AVAILABLE_SURAHS` is still `[12]`, so `/surah/112`, `/surah/103` and
  `/surah/67` render the "no compiled corpus" state. `/library` now LABELS that
  honestly rather than hiding it; the thinness itself is unfixed.
- Al-Mulk scene beats (human), Stripe replay fixtures (needs a real test-mode
  account), and the 7-night window (needs live staging).

---

## 2026-08-12 — build-plan step 20 completion: the drill corpus loader, HANDOVER's §A-note fix

### v3-D76 — `lib/corpus/load.ts` now reads the FROZEN corpus, not the engine's unhashed test fixture

HANDOVER.md's own re-audit named this "the most consequential finding": every
learner-reachable route `lib/corpus/load.ts` backs — `/drill`, `/plan`,
`/progress`, `/progress/list`, `/surah/[surah]`, `/surah/[surah]/[ayah]`,
`/workbench` — read `packages/engine/test/fixtures/12.json` at request time.
That file is the engine's own unit-test fixture: cut before v3-D60's
near-duplicate-foil fix (so it still contained the three-spellings-of-one-word
defect Firdaus rejected), carrying no `hashSpecVersion`, and never once
touched by the content-freeze gate or a qari signature. A learner on any of
those routes was served content the tiered-hash chain of custody (v3-D13/
v3-D22) cannot certify, because the served bytes were never the bytes hashed.

**Verified, not assumed**, before writing a line of the fix: compiled all four
launch surahs (`npm run compile -- 12|67|103|112` — `Makefile#compile-corpus`
was itself missing 67, a real staleness, now fixed) and diff'd the compiled
`meta` against the stale fixture — different `generatedFrom` provenance,
different distractor counts (12: 8877 vs the fixture's 8880 — the fixture
predates v3-D60's redraw), and `hashSpecVersion` present (`1`) on the compiled
artifact, absent entirely on the fixture.

**Fixed**, `apps/web/lib/corpus/load.ts`: `OUTPUT_ROOT` now points at
`packages/corpus-compiler/output`, the same artifact `stage-corpus.mjs` already
stages for client islands and `content-freeze.mjs` already hashes.
`AVAILABLE_SURAHS` widens from `[12]` to `[12, 67, 103, 112]` — the exact
`LAUNCH_SURAHS` set `content-freeze.mjs` enumerates — with 12 kept first so
every caller defaulting to `AVAILABLE_SURAHS[0]` (`/plan`, `/progress`,
`/drill`) is unchanged. `output/` stays gitignored (v3-D52); a checkout that
has not run `make compile-corpus` still degrades to `loadCorpus` returning
`null`, exactly as before — nothing about the graceful-degradation contract
changed, only what it degrades FROM.

**A standing guard, not just a one-time fix**: `check-boundaries.mjs` clause
13 fails the build if any file under `app/`, `components/` or `lib/` (outside
`.test.ts(x)`) references `packages/engine/test/fixtures` again. Mutation-
verified: reverting `load.ts` to the old path makes the clause fail, naming
the exact file and line; reverting the mutation makes it pass again. Scoped to
production code only — the many `test/*.test.tsx` files that legitimately read
the engine fixture as a source of real, non-authored Arabic bytes for driving
components directly (never through `loadCorpus`) are correctly untouched by
this clause; INVARIANTS.md Absolute B is what makes that a legitimate use in
the first place.

**One real, welcome side effect**: the mushaf PAGE picker on `/drill`
(WIREFRAME §13) was correctly, visibly disabled because the stale fixture
carried `page: null` for all 111 of Yusuf's verses. The compiled corpus has
real geometry (`page: 235` for 12:1, matching the compiler's own "Yusuf spans
pages 235–248"), so the page picker is now genuinely usable — no code in
`lib/drill/sites.ts` or `components/drill/DrillPicker.tsx` changed; it was
already written to activate the moment real geometry arrived.

**Two test files updated deliberately, not silently**: `test/library.test.tsx`
had a test literally titled "does not claim a full experience for any surah in
this build" — its own docstring said this must change deliberately the day the
two corpus loaders' sets stop being disjoint. They just did (112/103/67 are now
both practisable AND detailed); the test now asserts the NEW fact — every
surah but 12 gets the full-experience status, 12 alone stays browse-only,
named explicitly rather than derived from the constants it is supposed to be
checking. `test/ayah-detail.test.tsx`'s header comment claimed "a test against
12 is a test against what the route really renders" — no longer true (that
suite drives components directly from the engine fixture, which is legitimate
per Absolute B, but is no longer what the ROUTE serves) — corrected to say so.

**Not done, and out of scope for this fix**: the per-surah/combined-load views
on `/progress` and multi-surah enrollment on `/home`/`/library` remain
StubNotes. Before this fix their blocker was misdescribed as "only one corpus
compiled"; the real blocker, now that four are compiled, is that
`meta.onboardingChoices.surah` is a single number with no enrollment list — a
product decision (a real enrollment model), not a wiring job. Both routes'
header comments are corrected to name the real blocker rather than the
now-stale one, so the next run does not waste time discovering AVAILABLE_SURAHS
already widened without checking why the multi-surah view still doesn't
render.

**Verified**: `apps/web` — 659 vitest passing (was 548 at the last audited
total; +111 reflects tests landed in intervening commits plus 8 new in
`test/corpus-load.test.ts`), typecheck clean, `npm run gates` green (boundaries
now 164 files / 13 clauses), `npm run build` exit 0 (17 routes). Full repo
`make build`/`make test` run and reported in this run's NIGHTLY report.

---

## Ratified 2026-08-12 — build-plan step 30: `make test`/`make build`/CI never actually verified the v3 stack from a clean checkout

### v3-D77 — Two silent false-green gaps, both the same shape as v3-D38/D45/D49/D50: `compile-corpus` was never a dependency of anything, and CI never ran v3/api at all

This run started by trying to determine the actual current build-plan step from
`git log` (NIGHTLY.md's own rule). That surfaced two things worth recording on
their own, beyond the step-30 work itself:

**Finding 0 (process, not code):** the container's `git status` showed a
**detached HEAD**, and the locally-cached `main` ref (`cab5d16`, "Phase 0
complete") was far behind the actual checked-out commit (`055c47f`, step 20).
`git fetch` showed `origin/main` had been force-updated to `055c47f` — the
detached HEAD *was* current `main`, the local ref was just stale from session
start. Resolved with `git checkout -B main origin/main`. Recorded because a
future run hitting the same "detached HEAD, stale local main" shape should
re-derive from `origin/main` the same way, not assume Phase 0 is really where
the build stands — `HANDOVER.md`'s own "WHAT IS LEFT" section, not
`NIGHTLY.md`'s "Phase 0 complete" note, was the accurate source once reached.

**Finding 1 — `make test-v3` and `make build` had no `compile-corpus`
prerequisite.** Reproduced directly: a `make setup` then `make test` with
`packages/corpus-compiler/output/` never populated (its correct state on any
truly clean checkout — output/ is gitignored, v3-D52) fails **10 tests across 6
files** (`test/corpus-load.test.ts`, `test/content-freeze-gate.test.ts`,
`lib/session/run.test.ts`, `test/home-today.test.tsx`, `test/onboarding.test.tsx`,
`test/landing-demo.test.tsx`) — all with the identical shape, "No compiled
corpus at .../output/…, run `make compile-corpus` first." **Worse for `make
build`**: `stage-corpus.mjs` degrades gracefully rather than hard-failing on a
missing `output/` (a deliberate, documented choice — a hard fail would make
`npm run build` impossible on a fresh clone) — so `make build` reported **exit
0** while silently shipping a build with **zero staged corpus**, the worse
failure shape of the two: a green build that serves no real Arabic to a
learner, with nothing in the build log forcing a human to notice.

**Finding 2 — CI never ran v3/api, and never compiled the corpus before
testing `apps/web`.** `.github/workflows/ci.yml`'s `php` job located a Laravel
app by searching `find v2 -maxdepth 3 -name artisan` — **only `v2`**, never
`v3`. Every one of `v3/api`'s 229 PHPUnit tests — closing tests for
DEFECTS.md#B1/B3/B4/B7/B8, E-01, the entitlement state machine, the admin
console, the workbench — had **never once run in CI**, since `v3/api` was
scaffolded at build-plan step 13. Separately, the `js` job's per-project loop
never invoked `corpus-compiler`'s `compile` script anywhere (its `package.json`
has no `build` script, so `npm run build --if-present` there is a no-op), so
`apps/web`'s test step would fail on **every** PR for the same reason as
Finding 1, deterministically, regardless of loop order.

**Why this matters beyond the two gaps themselves:** every "make test green" /
"CI green" claim in this build's history (v3-D25 onward) was produced by
running these commands on a machine that already had a stale `output/` from an
earlier `make build`/`make compile-corpus` invocation — the same "verification
that runs on the author's machine is not verification" pattern this file has
now recorded four times (v3-D38 tsc, v3-D45 stage labels, v3-D49 encoded guard,
v3-D50 the missing `tests/Unit` directory). None of those prior fixes covered
this shape, because none of them touched the corpus-compile boundary.

**Fixed:**
- `Makefile` — `test-v3: typecheck-v3 compile-corpus` and
  `build: compile-corpus` (was `test-v3: typecheck-v3` and `build:` with no
  prerequisite).
- `.github/workflows/ci.yml` — a new step, "Compile the v3 corpus (12, 67, 103,
  112)", installs `corpus-compiler`'s deps and runs its 4 compiles **before**
  the per-project build+test loop, so `apps/web` sees a populated `output/`
  regardless of loop order. The `php` job is now a `strategy.matrix` over
  `[v2/api, v3/api]` instead of a single hardcoded `find v2 …` — both apps are
  independently located, installed and tested; `fail-fast: false` so one app's
  failure doesn't hide the other's result.

**Verified both ways, from a genuinely wiped state** (`rm -rf
packages/corpus-compiler/output apps/web/public/corpus`, simulating a fresh
checkout with nothing but the fixed Makefile):
- `TZ=UTC make test` → **exit 0**, all seven suites green: v2 vitest 255, v2/api
  PHPUnit 47, v3/api PHPUnit 229 passed + 2 incomplete (PAY-1, by design),
  corpus-compiler 101, engine 417, fold-runner 53, apps/web 659. **1761 passing
  total** across these seven suites (the 417/659 reflect the B6 sweep fix and
  drill-corpus-loader work already on `main`; this run added no new test
  files).
- `TZ=UTC make build` → **exit 0**, log line `corpus staged → public/corpus:
  112 (4 ayat…), 103 (3 ayat…), 67 (30 ayat…)` confirms real staging, not the
  silent degrade Finding 1 describes.
- CI's YAML correctness was NOT verified by an actual GitHub Actions run (no
  push to a PR branch happened before this fix landed) — verified instead by
  reproducing the identical failure/degrade locally against the identical
  commands the workflow now runs (`npm ci && npm run compile -- <surah>` per
  surah; `php artisan test` per app dir), which is the same evidence standard
  `v3-D50`'s fix used for the `tests/Unit` gap.

**Explicitly NOT done in this run, named so the next one does not re-discover
them as new:** wiring the Playwright e2e suite (34 tests) into CI (HANDOVER.md
item E9 — it has never run in any CI job); the fold-runner DB adapter +
staging deploy (E6); an operational mailer so a fold-determinism P1 pages
someone (E7); Stripe replay fixtures (E8, blocked on human Stripe account
verification); raising the committed test-count floor to match the number
above (E10). `v3/CLAUDE.md`'s `make test` comment and `v3/NIGHTLY.md`'s working
method both still cite stale, much lower counts from build-plan step 3
(`1431 total`, `255 v2 vitest + 47 PHPUnit`) predating almost this entire
build — corrected in this commit so the next run does not re-derive current
counts from scratch the way this one had to.

---

## Ratified 2026-08-12 — build-plan step 30 continued: E9, the Playwright suite wired into CI

### v3-D78 — The 40-test e2e suite now runs on every PR/push; a mutation proved it actually bites

This run started, per NIGHTLY.md's own rule, by re-deriving state from `git log`
rather than trusting the (stale) note at the top of NIGHTLY.md. The container's
cached `origin/main` ref was itself stale (`cab5d16`, "Phase 0 complete") until
`git fetch` force-updated it to `ee62990` (build-plan step 30, v3-D77) — the
**identical** shape v3-D77's own Finding 0 already named ("a future run hitting
the same 'detached HEAD, stale local main' shape should re-derive from
`origin/main` the same way"). Recorded again because it recurred once already
despite being written down: the fix is mechanical (`git fetch` before trusting
any local ref), not a one-time note.

HANDOVER.md's "WHAT IS LEFT" table (2026-08-12, later) lists engineering items
E6–E10 as open against step 30, with E9 ("wire the e2e suite into CI") flagged
by v3-D77 itself as "real, scoped, agent-doable follow-on work, same shape as
this fix" — unlike E6 (needs a live host + staging DB), E7 (needs an actual
mail provider) and E8 (blocked on human Stripe verification), E9 needed no
external dependency this sandbox lacks.

**What landed**, in `.github/workflows/ci.yml`: a new `e2e` job, parallel to
the existing `js` and `php` jobs — detects `v3/apps/web/playwright.config.ts`,
compiles the 4-surah corpus (same step the `js` job already runs, needed
because `next build`'s `prebuild` stages `public/corpus/` from
`packages/corpus-compiler/output/`, gitignored per v3-D52), installs
Playwright's Chromium (`--with-deps`, the OS libs a fresh Ubuntu runner lacks),
then `npm run e2e` (`next build && playwright test`) against the production
server — `playwright.config.ts`'s existing `reuseExistingServer:
!process.env.CI` and `forbidOnly: !!process.env.CI` already do the right thing
under GitHub Actions' auto-set `CI=true`, unmodified. A report artifact
uploads on failure for debugging.

**Verified, not assumed:**
- `make setup` run clean in this container (Laravel's gitignored
  `bootstrap/cache`/`storage` dirs had to be created by hand first — the
  Makefile's own `mkdir -p` line runs *after* `composer install`, which needs
  them for `package:discover`; not fixed here, out of scope for E9, but worth
  a future Makefile-ordering fix).
- `TZ=UTC make test` → exit 0, **1761 passing** (255 v2 vitest + 47 v2/api +
  229 v3/api + 2 incomplete[PAY-1, by design] + 101 corpus-compiler + 417
  engine + 53 fold-runner + 659 apps/web) — unchanged from v3-D77's count,
  confirming this run added no new unit/integration tests, only CI wiring.
- `TZ=UTC make build` → exit 0.
- The exact commands the new CI job runs were reproduced locally end to end:
  `cd v3/packages/corpus-compiler && npm ci && npm run compile -- {12,67,103,112}`,
  `cd v3/apps/web && npm ci`, `npx playwright install --with-deps chromium`
  (fetched the pinned 1.62.1 revision, distinct from this sandbox's
  pre-installed 1.56.1/rev-1194 browser — a real gap the CI job's own
  `--with-deps` install step also has to close on every fresh runner), then
  `CI=true npm run e2e` → **40 passed**, `reuseExistingServer` correctly off
  and `forbidOnly`/retries correctly on under `CI=true`, matching the actual
  GitHub Actions environment rather than local dev defaults.
- **Mutation-tested the claim that matters** — "wiring this into CI would
  actually catch a real regression," not merely "the YAML parses." Removed
  `<ServiceWorkerRegistrar />` from `app/layout.tsx` (a one-line, easy-to-miss
  regression a PR could plausibly ship) and reran the identical `CI=true`
  command: **6 of `airplane-mode.test.ts`'s tests went RED** — service-worker
  registration, the exit criterion, offline reload, cached corpus, `/api`
  never cached, offline `/`→`/home` steering — exactly the offline-dependent
  set, and nothing else. Reverted; `git diff v3/apps/web/app/layout.tsx` empty;
  reran — 40/40 green again. This is the same mutation discipline v3-D45/D49
  established: a green gate is evidence about the gate only once something has
  been shown to turn it red.

**Explicitly NOT done in this run, named so a future run does not re-discover
them as new** (HANDOVER.md's E6–E8, E10, unchanged): the fold-runner DB
adapter + staging deploy + a host actually running `schedule:run` (E6); an
operational mailer so a fold-determinism P1 pages someone (E7); Stripe replay
fixtures, blocked on human business verification (E8); raising the committed
test-count floor to 1761 (E10). Also not done: fixing the `make setup`
directory-ordering issue found above, and CI's own YAML correctness was not
verified by an actual GitHub Actions run in this sandbox (no push happened
before this fix was written) — verified instead by reproducing the identical
commands locally, the same evidence standard v3-D77 used for its own CI fix.
