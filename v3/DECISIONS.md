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
