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
