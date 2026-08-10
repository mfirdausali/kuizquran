# Retired tests — v3-D25 (ladder/bridge/chain attic)

BUILD-PLAN.md's step 5 ("verbatim port green") names atticking
`ladder.ts`/`bridge.ts`/`chain.ts` with a "retired-test mapping published."
This is that mapping. See `v3/DECISIONS.md`'s v3-D25 for the evidence and
the full boundary rationale.

**The short version:** `Drill.tsx` and `Gate.tsx` (the only live drill/gate
screens in the app) import `ReconstructState`/`Rung` from `engine` and
**never** `LadderState` or anything from `bridge.ts`. Every test below drove
through code that was unit-tested but never shipped. The load-bearing
surface of these three files — `birthConnection` (rebuild.ts's fold),
`initLadder`/`s1Options` (test.ts's live `vocabItem` generator),
`junctionItem` (test.ts's live junction generator) — is ported and kept
tested; see `bridge.test.ts`, `ladder.test.ts`, and `chain.test.ts` for its
surviving/replacement coverage.

## From `v2/src/engine/test/ladder.test.ts` — retired in full

Every case in this file drove through `nextItem`/`advance`, the S1→S2→S3
state machine — atticked because nothing ever called it outside the engine's
own tests. `initLadder`/`s1Options` (which these tests also exercised
indirectly) are NOT retired; v3's `ladder.test.ts` replaces this coverage
with direct unit tests of that surviving surface, plus `test.test.ts`'s
`vocabItem` cases exercise it through its real caller.

- `ladder S1→S2→S3 over ayah 12:4 > all-correct encode reaches ayah completion via S1,S2,S3 in order`
- `ladder S1→S2→S3 over ayah 12:4 > a perfect S1 pass is a clean sweep = exactly one pass of 15 items`
- `ladder S1→S2→S3 over ayah 12:4 > S3 completion requires full-ayah production first→last (invariant #1)`
- `S1 error handling > flags a first-pass meaning error as pretest, then requeues the word`
- `S1 error handling > after a miss, the next pass re-asks ONLY the missed word (not all words)`
- `S1 error handling > a correct answer on a word already seen is NOT pretest`
- `S2 fill > a wrong fill is a slip and does not advance the slot`
- `S1 grouping — DATA-1 (ROADMAP Phase 7) > a clean S1 sweep asks 14 items (15 words, one pair merged), never probing the trailing member alone`
- `S1 grouping — DATA-1 (ROADMAP Phase 7) > the anchor's DrillItem carries groupPositions and the reported total is the probeable count`

Honest gap: the retired suite's S2/S3 slip-handling and pretest-requeue
behavior (the state machine's own correctness) has no v3 equivalent, because
that state machine is gone, not relocated. If a future step needs it back
(a redesigned Learn ladder), it should be re-specified against v3's question
compiler (M4), not resurrected from this file.

## From `v2/src/engine/test/bridge.test.ts` — 2 of 3 retired

- `S4 bridge 12:4 → 12:5 > probes the NEXT ayah's opening words` — tested
  `nextOpening`, retired with it.
- `S4 bridge 12:4 → 12:5 > builds valid meaning items (correct + 3 distinct distractors)` —
  tested `bridgeItems`, retired with it.
- `S4 bridge 12:4 → 12:5 > births the connection atom for n (ref = from ayah), idempotently` —
  **kept**, moved to v3's `bridge.test.ts` under `birthConnection`.

## From `v2/src/engine/test/chain.test.ts` — 1 of 17 cases survives

- `chainSteps > [4,5] = ayah 4, junction 4→5, ayah 5` — retired (`chainSteps`
  is unused outside the retired orchestration).
- `chainSteps > [4,6] traverses 3 ayat and 2 junctions` — retired.
- `applyChain — FIRe credit (D17: breadth, not extra weight) > *` (4 cases) —
  retired (`applyChain` never shipped).
- `victory-lap vs weak-seam repair chains (v2-D11) > *` (6 cases) — retired
  (`applyVictoryLapChain`/`applyWeakSeamChain`/`riskiestJunctions`/
  `weakSeamChainRange` never shipped).
- `junction retry-before-commit (v2-D11) > *` (4 cases) — retired
  (`junctionOutcome` never shipped; nothing outside chain.ts/chain.test.ts
  ever called it).
- `junctionItem > correct = the opening of the target ayah; options are distinct openings` —
  **kept**, moved to v3's `chain.test.ts` unchanged.

Honest gap: `riskiestJunctions`/`weakSeamChainRange`'s forgetting-risk-based
chain selection and `junctionOutcome`'s retry-before-commit semantics
(v2-D11) have no v3 equivalent. If the weak-seam-repair chain concept
survives into v3's product, it needs re-design against the Site/rotation
model landing at build-plan step 11, not a resurrection of this code.

## From `v2/src/engine/test/glossLang.test.ts` — 2 of 6 retired

- `bridgeItems honors the chosen gloss language > MS falls through to EN for every opening word (no ms gloss sourced yet)` —
  retired (tests `bridgeItems`, which is gone).
- `bridgeItems honors the chosen gloss language > defaults to en when no lang is passed` —
  retired, same reason.
- `s1Options honors the chosen gloss language ... > MS falls through to EN for every word (no ms gloss sourced yet, v2-D27)` —
  **kept, rewritten**: the original drove through `nextItem` purely to reach
  an S1 item (incidental plumbing, not itself under test); v3's version
  calls `s1Options` directly. Same assertion, same intent.
- The other 3 `wordGloss`/`s1Options` cases in this file needed no change.

Honest gap: no v3 equivalent verifies gloss-language fallback for an S4-shaped
item, because there is no S4 item generator left to test.

## DEFECTS.md#B1 — `custom` override kind, retired at build-plan step 15

Not a whole-file retirement; one test in `test/overrides.test.ts`.

- `applyOverrides — custom (stored, not generation-wired this phase) > passes custom rows through untouched, and leaves the corpus unpatched by them` —
  retired. B1 closes by DELETION (DEFECTS.md's own words: "v3 has no
  `custom` field"), not by continuing to pass a `custom` row through
  unresolved — so a test asserting that pass-through behavior is testing a
  shape that no longer exists. Replaced by two tests in the same file: a
  structural grep proving `overrides.ts` never references `"custom"`
  again, and a type-shape check that `OverrideResolution` has no `customs`
  field to accumulate an unresolved kind into.

Honest gap: none. B1's DEFECTS.md description names zero legitimate use
this kind ever served ("no renderer reads it") — there is no surviving
behavior to re-specify elsewhere, unlike the ladder/bridge/chain and
glossLang retirements above.
