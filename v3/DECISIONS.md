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
