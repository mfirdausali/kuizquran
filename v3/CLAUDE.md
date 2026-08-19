# v3 — read this first

## Never touch these

- **`v1/**`** — frozen. Shipped to staging. Read-only source for
  `v1/styles/iman-ui.css` and `v1/packages/corpus-compiler/src/**`.
- **`v2/**`** — the working app and v3's port source. **Read-only.** v3 is a new
  generation (v3-D01), not a migration. Parity oracle SHA: **`c34f5c3`**.

CI hard-fails any diff touching either tree.

## The authorities

| File | What it settles |
|---|---|
| `v3/INVARIANTS.md` | The 6 invariants + purity + sacred-text. Injected at the top of every brief. |
| `v3/DECISIONS.md` | v3-D08…v3-D24. Every open question has a ratified default — **nothing blocks on a human.** |
| `v3/DEFECTS.md` | B1–B9, E-01…E-08. Each names its milestone and closing test. |
| `v3/docs/BUILD-PLAN.md` | The 32-step order and the milestones. **Sole authority** — it supersedes WIREFRAME §26. |
| `v3/docs/WIREFRAME.md` | The specification: what the product *is*. |

If two documents disagree, the order above wins.

## The rules that are not negotiable

1. **`v3/INVARIANTS.md` outranks the task.** A change that breaks an invariant is
   wrong, however well it satisfies the brief.
2. **Never write Quranic Arabic.** Not in code, not in a test, not in a fixture.
   Tests reference fixture *coordinates*. `CorpusRef` has no literal member.
3. **RED before green.** Tests are committed and observed failing in a separate
   step before implementation starts.
4. **Never regenerate an oracle to make your own tests pass.** Golden log,
   fixtures and snapshots are human-approved. That is self-grading (H14).
5. **The engine is pure.** No DOM, no IO, no `Date.now`, no `Math.random`, no
   zero-arg `new Date()`, no local-date getters. `now` and `tz` are passed in.

## Ordering that will corrupt data if violated

- **E-01 surah-keying lands before any second-surah artifact exists** — corpus,
  fixture, enrollment or event. Afterwards the merge is unrepairable.
- **B4 `(createdAt, id)` lands before the first verification hash row.**
- **B6 semantics freeze before the wire freezes** — `gradeClass` is a wire field.
- **The wire freezes once, complete** — three consumers read it.
- **Site / admit / visitOrdinal land before the question compiler** consumes them.
- **`selection_determinism_check` is green before any compiler merge.**
- **`AUTH-` closes before any `PAY-` task.** No password reset today; an RM500
  lifetime buyer who forgets their password loses everything.

Full list: `BUILD-PLAN.md` §5, H1–H15.

## Running it

```bash
make setup   # once
make dev     # SPA :5273, API :8000
make test    # 2030 passing (+2 incomplete, PAY-1, by design), typechecks first.
             # 255 v2 vitest + 47 v2/api + 272 v3/api + 111 corpus-compiler
             # + 417 engine + 61 fold-runner + 867 apps/web. (v3-D110, 2026-08-19)
             # NOTE (v3-D110): DEFECTS.md#B13 — the `disable` override field
             # reached NO learner, for two reasons that hid each other.
             # `applyOverrides()` returns `{corpus, disabled, groups}` but
             # `lib/corpus/client.ts#fetchCorpus` took only `.corpus`, so
             # `overrides.ts#isQuestionDisabled()` had ZERO production callers;
             # and v3's port of `v2/src/pages/Test.tsx#buildItems` into
             # `lib/test/build.ts#buildTestItems` dropped that function's
             # `disabled` parameter, its post-generation filter AND its
             # `itemDisableKey` helper — all three. An admin/qari disabling a
             # broken question through the already-shipped, already-admin-gated
             # `POST /api/overrides` changed nothing a learner ever saw.
             # Fixed both halves: new `fetchEffectiveCorpus()` +
             # `EffectiveCorpus {corpus, disabled}` (with `fetchCorpus`
             # delegating to it, object-identity asserted so every existing
             # caller is unchanged by construction); `itemDisableKey` ported
             # verbatim and exported; `buildTestItems` takes `disabled` as a
             # REQUIRED parameter — a default `[]` would re-create the defect
             # by omission, which is exactly how it was lost. Scope matches the
             # port source deliberately: v2's own `Drill.tsx` does not consult
             # `isQuestionDisabled` either, because the session loop's graded
             # surface is a reconstruct pass over ONE ayah's own words, not a
             # question-bank draw, so there is no per-question selection for a
             # `disable` row to act on (named in `fetchCorpus`'s docblock so a
             # future run doesn't misread the narrower call site as an
             # oversight). RED confirmed TWICE by `git stash` of the three
             # source files only, every new test kept: 23 of 30 unit tests
             # failed on exactly `fetchEffectiveCorpus is not a function` and
             # the missing filter/helper; separately, the component test failed
             # on exactly its `testKind === "vocab"` assertion with the
             # cache-reset already in place, proving the RED is the WIRING, not
             # test isolation. That component test disables "vocab" ayah-wide
             # across all four ayat of 112 and cannot pass vacuously (vocab is
             # KIND_ORDER slot 0, so an unfiltered Test always contains one).
             # `TZ=UTC make test`: 2030 passing (was 2016, +14 — exactly this
             # run's new tests: 9 + 4 + 1; no other suite moved).
             # `check-test-floor.mjs`: OK, 2030 >= floor 1899 (+131 margin,
             # TEST-FLOOR left unmoved). `TZ=UTC make build`: exit 0, 20 routes
             # (unchanged). `npm run gates`: all green (fonts degraded-but-
             # non-blocking, pre-existing). `npx tsc --noEmit` clean. No
             # v1/v2 edit, no Arabic codepoint (all 429 added lines swept
             # directly across Arabic/Supplement/Extended-A/both Presentation
             # Forms blocks). ALSO FIXED: `test/test-island.test.tsx` never
             # reset `lib/corpus/client.ts`'s module cache — harmless while
             # that cache held only parsed bytes, NOT harmless once it holds a
             # resolved override DECISION, since one test's override-free
             # corpus then leaks into the next test's override-carrying one.
             # NOT addressed, named so a future run doesn't re-discover it:
             # the SSR override gap (`lib/corpus/load.ts`, v3-D96's own
             # deferral) is unchanged. With this entry every field of the
             # override layer reaches a learner. See DECISIONS.md v3-D110.
             # `make test` enforces v3-D95's test-count floor (`v3/TEST-FLOOR`,
             # currently 1899, so the margin above is intentionally not yet
             # banked into the floor) — a suite that silently shrinks (deleted
             # test file, stray `.skip`) now fails the build even though every
             # test that DID run still passed.
             # NOTE (v3-D109): `packages/engine/src/gate.ts#RESCAFFOLD_AFTER_FAILS`/
             # `gateForgiveness()`'s "rescaffold" rung (v2-D08's gate-forgiveness
             # ladder) was real and engine-tested since the port but had never
             # been wired into the real session loop — DEFECTS.md#B12's own
             # "explicitly not addressed" note named it exactly: "wiring it here
             # would mean a queue item that transitions between two
             # `ReconstructState` machines mid-item... a real (small)
             # state-machine extension this run chose not to make." Built that
             # extension. `lib/session/run.ts` gained `machineForItem()` (builds
             # the reconstruct machine for a queue item AND decides the
             # rescaffold phase together, consulting `gateForgiveness()` off the
             # SAME atom the queue item's own fold produced) and
             # `settleRescaffoldWarmup()` (the in-place transition, same cursor,
             # same ayah, from the warm-up's completed `ayah_produced` to the
             # real cold check's fresh `full:true` machine) — mirroring v2's
             # `pages/Gate.tsx` exactly: `stage: "rescaffold"` commits an
             # ordinary graded S2 `ayah_produced` then re-arms the SAME ayah as
             # `stage: "cold"`, never a `gate_result` for the warm-up itself. A
             # new `SessionRun.rescaffolding` field (mirroring `gateSlipped`'s
             # own "true only for the CURRENT queue item, reset on every
             # advance" discipline) tracks the phase; a wrong tap during the
             # warm-up is deliberately NEVER remembered as a gate slip — only
             # `!run.rescaffolding` gates count toward `gate_result.correct`,
             # matching `Gate.tsx`'s own `stage === "cold" && !correct` rule for
             # when `slipped` may be set. `SessionIsland.tsx` gained a small
             # read-only hint ("A lighter warm-up first — then the real cold
             # check.") when `run.rescaffolding` is true — presentation of a
             # decision `run.ts` already made, never a decision made in the
             # component (check-boundaries.mjs clause 5 still holds).
             #
             # RED confirmed directly: reran the 4 new `run.test.ts` cases
             # against a `git stash` of `run.ts` + `SessionIsland.tsx` alone
             # (keeping the new tests) — all 4 failed on exactly
             # `started.run.rescaffolding` being `undefined` instead of the
             # expected boolean; `git stash pop` restored the fix byte-
             # identically, `git diff` empty, 4/4 green again, no regression on
             # the other 34 cases in the file. The four cases prove: (1) a gate
             # at the rescaffold rung opens in the warm-up phase and, once both
             # the warm-up and the real cold check are completed cleanly,
             # commits exactly ONE S2 `ayah_produced` (the warm-up) then exactly
             # ONE passing `gate_result` (the cold check) — never a second
             # gate_result, never an S3 warm-up; (2) a slip DURING the warm-up
             # is recorded as an ordinary wrong tap but never sets
             # `gateSlipped`, and the eventual cold-check pass still reads
             # `correct:true`; (3) a slip during the REAL cold check (after a
             # clean warm-up) still fails the gate and increments `gateFails`
             # past the two seeded fails; (4) an ordinary gate below the
             # rescaffold threshold still opens straight into the cold check,
             # unchanged from v3-D107's own behavior — no regression on the
             # non-rescaffold path.
             #
             # `TZ=UTC make test` (full monorepo, all seven suites, from a
             # fully completed `make setup`): **2016 passing** (was 2012, +4 —
             # exactly this run's 4 new `run.test.ts` cases; no other suite's
             # count moved). `check-test-floor.mjs`: OK, 2016 >= floor 1899
             # (+117 margin, `TEST-FLOOR` left unmoved, same discipline as
             # every prior entry). `TZ=UTC make build`: exit 0, 20 routes
             # (unchanged — no route added or removed). `npm run gates`:
             # locked-css OK, fonts degraded-but-non-blocking (pre-existing,
             # unrelated), boundaries OK (200 files checked), corpus-morphology
             # and corpus-glyphs OK. `npx tsc --noEmit`: clean (`Version
             # 5.9.3` confirmed).
             #
             # No `v1/**`/`v2/**` edit: `git status --porcelain -- v1 v2`
             # empty before committing. No Arabic codepoint introduced:
             # checked directly against the diff with a Unicode-range sweep
             # (Arabic block, Arabic Supplement, Arabic Presentation Forms
             # A/B — zero matches) in addition to `npm run gates`' own grep,
             # which passed — every new line addresses an ayah/rung/fail-count
             # by number or closed-set value, never corpus text.
             #
             # NOT addressed, named so a future run doesn't re-discover it as
             # new: `activity.ts#lastActiveDayMs()`'s inline re-derivation
             # (named by v3-D107, still untouched — out of this step's scope);
             # `floorQueue`'s cross-surah forgetting-risk read (named by
             # v3-D108, unchanged); Door 3 (open practice)/
             # `coldSuccessAdoption`/`diminishingReturns`/the SSR override
             # gap/`isQuestionDisabled()` all remain exactly as open as
             # v3-D106/D107/D108 left them — this run's scope was the
             # rescaffold rung alone.
             # NOTE (v3-D108): `packages/engine/src/floor.ts#floorQueue`/
             # `floorMinutes` (FR9, "the 2-minute floor session" — a due cold
             # gate, else the riskiest due review, else a guaranteed-win
             # warm-up, capped at ~2 minutes, never empty once anything is due
             # or encoded) were real and engine-tested (`habit.test.ts`,
             # `e01.test.ts`) since they landed but had ZERO production
             # callers — v3-D107's own sweep found this and deliberately
             # deferred it, named exactly as "needs its own `/home` CTA and a
             # reduced-queue entry point into the session loop." Built both.
             # `lib/session/run.ts` gained `startFloorSession` (mirroring
             # `startSession`'s exact `session_start`/resume discipline via a
             # new shared `startFromQueue` helper both now call) and a
             # `SessionMode` ("full" | "floor"). `FloorItem.kind: "warmup"` has
             # no `QueueItemKind` of its own, so it is graded as an ordinary
             # `"review"` — full-weight, `structured:true`, through the exact
             # same `answerCurrent`/`settleAnswer` path every other queue item
             # uses, never a second grading rule (same discipline v3-D106's
             # `startWeakSpotDrill` already follows). Atoms are filtered to
             # `kind === "ayah"` before reaching `floorQueue`, mirroring
             # `weakSpotOfferFor`'s own E-08 reasoning — a "connection" atom
             # has no reconstruct surface in v3. `/session` now takes a
             # `?mode=floor` search param (`SessionGate`/`SessionIsland` both
             # thread a `mode` prop down to it, defaulting to `"full"`), and
             # `lib/home/queue.ts#buildHomeSurah` gained `floorOffer` —
             # computed from the SAME fold `assembleFor` already produced, no
             # second log read — surfaced on `/home` as a quiet "Short on
             # time? Do a quick N-minute check-in instead" link, shown
             # INDEPENDENTLY of `ctaEnabled`/`dueCount`: a learner with ten
             # items due but two minutes to spare should see it too, not only
             # a learner with nothing due — `floor.ts`'s own "worst days"
             # framing is about short-on-time days, not only empty-queue days.
             # RED confirmed three ways: `git stash` of `run.ts` alone failed
             # exactly the 4 new `run.test.ts` cases (`startFloorSession is
             # not a function`), 30/34 others unaffected; `git stash` of
             # `lib/home/queue.ts` + `TodaySession.tsx` failed exactly the 2
             # new floor-offer assertions in `home-today.test.tsx`, 11/13
             # others unaffected. `TZ=UTC make test`: 2012 passing (was 2003,
             # +9 — exactly this run's new tests: 4 in `run.test.ts`, 3 in
             # `home-today.test.tsx`, 2 in `session-island.test.tsx`).
             # `check-test-floor.mjs`: OK, 2012 >= floor 1899 (+113 margin).
             # `TZ=UTC make build`: exit 0, 20 routes (unchanged — `/session`
             # moved from static to dynamic rendering since it now reads a
             # search param, but no route was added or removed). `npm run
             # gates`: all green (locked-css, fonts degraded-but-non-blocking,
             # boundaries 201 files — this run added no new file — corpus-
             # morphology, corpus-glyphs). No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff was reverted before
             # committing, same discipline as every prior entry). No Arabic
             # codepoint introduced (checked directly against the diff with a
             # Unicode-range sweep, and via `npm run gates`' own grep, which
             # passed): every new line addresses an ayah/minute/count by
             # number, never corpus text. NOT addressed, named so a future run
             # doesn't re-discover it as new: the "rescaffold" ladder rung and
             # `activity.ts#lastActiveDayMs()`'s inline re-derivation (both
             # named by v3-D107, untouched by this run — out of this step's
             # scope); FR9's `floorQueue`'s own review/warm-up branches read
             # forgetting-risk off ANY encoded ayah atom regardless of which
             # surah the learner is enrolled in TODAY — moot at single-surah
             # launch scope (`assembleFor`/`getEventsForSurah` already scope
             # the fold to one surah before this module ever sees it), but
             # worth re-checking once multi-surah enrollment (HANDOVER.md's
             # own still-open gap) exists. See DEFECTS.md and DECISIONS.md
             # v3-D108.
             # NOTE (v3-D107): DEFECTS.md#B12 — the day-1 cold gate (FR3,
             # gate.ts) could never actually FAIL through the real session
             # loop, which is the root cause of a second, deeper problem:
             # `gate.ts#gateForgiveness()`/`demoteToLearn()` (v2-D08's
             # forgiveness ladder) were real, unit-tested and fold-safe but
             # structurally UNREACHABLE, not merely unwired.
             # `advanceReconstruct` never advances on a wrong tap — a
             # learner just retries the same blank until right — so
             # `adv.correct` at the moment a pass completes is
             # unconditionally `true`. `answerAfterTap`'s gate branch (post-
             # B11, v3-D101) stamped `gate_result.correct: adv.correct` —
             # always `true` — so a cold gate started with a slip and
             # doggedly retried into completion recorded as a clean pass.
             # `AtomState.gateFails` only ever increments on a REAL
             # `gate_result:false`, so it could never exceed 0 in
             # production and the ladder's `gateForgiveness()` could never
             # return anything but `"cold"`. v2's own `pages/Gate.tsx` (read,
             # never touched) has the missing piece — a local `slipped` flag
             # deciding `passed = !slipped` at completion — never ported
             # when the session loop landed. Fixed: `SessionRun` gained
             # `gateSlipped`, set by any wrong tap while the current item is
             # a due gate and reset per fresh queue item; `gate_result.
             # correct` is now `!run.gateSlipped`. Also wired the demote half
             # of the ladder on top of the now-reachable `gateFails`: new
             # `lib/session/run.ts#demoteOfferFor`/`acceptGateDemote` +
             # `SessionIsland.tsx`'s "send it back to Learn" surface,
             # mirroring v2's `Gate.tsx#stage === "demote-offer"` exactly.
             # RED confirmed at both the `run.ts` level (a deliberate mid-
             # gate slip, recovered by retrying, previously recorded
             # `correct: true`; now `false`) and the component level (the
             # demote-offer UI tests failed against the unmodified
             # `SessionIsland.tsx` before the wiring landed). `TZ=UTC make
             # test`: 2003 passing (was 1995, +8 — exactly this run's new
             # tests). `TZ=UTC make build`: exit 0, 20 routes (unchanged).
             # `npm run gates`: all green. No v1/v2 edit, no Arabic
             # codepoint introduced. NOT addressed, named so a future run
             # doesn't re-discover it as new: the "rescaffold" ladder rung
             # (`RESCAFFOLD_AFTER_FAILS = 2`, a lighter ungraded S2 warm-up
             # pass before the next cold attempt) — v2's `Gate.tsx` runs it
             # as a second reconstruction phase within the same gate visit,
             # which `SessionRun`'s one-machine-per-item shape does not
             # support without a real, separate state-machine extension; a
             # learner with 2-3 consecutive fails still gets the ordinary
             # full cold check today, not the lighter warm-up. Also found by
             # this run's sweep and deliberately left for a future run:
             # `floor.ts`'s entire FR9 2-minute floor session
             # (`floorQueue`/`floorMinutes`, zero callers, needs its own
             # `/home` CTA and a reduced-queue session entry point) and
             # `activity.ts#lastActiveDayMs()` being re-derived by hand in
             # `run.ts` instead of imported (harmless — the inline copy is
             # byte-identical — but the same "re-derive instead of import"
             # shape as v3-D83's `gradeClassToWire` finding). See
             # DEFECTS.md#B12 and DECISIONS.md v3-D107.
             # NOTE (v3-D106): `packages/engine/src/freeplay.ts#weakSpots` (FR6
             # Door 2, "weak-spot gym") had ZERO production callers — v3-D98's
             # own header named it out of scope, pending "a real UI surface of
             # its own (a ranked list)." That surface now exists on the
             # `/session` summary screen, alongside Door 1's own CTA: new
             # `lib/session/run.ts#weakSpotOfferFor`/`startWeakSpotDrill`
             # (mirroring `extraLearnOfferFor`/`startExtraLearn`'s exact
             # shape) + a "Practice your weakest spot" button in
             # `SessionIsland.tsx`. Unlike Door 1's fresh candidate
             # (strength definitionally 0), a weak spot is something already
             # encoded, so its reconstruction is sized off its REAL current
             # strength; it commits through the same `answerCurrent`/
             # `settleAnswer` path as an ordinary scheduled review
             # (`kind: "review"`), so it is full-weight/`structured:true` by
             # construction, never a second grading rule. Only "ayah"-kind
             # weak spots are offered — a "connection" atom has no reconstruct
             # surface in v3 (`bridge.ts` atticked, DEFECTS.md#E-08). RED
             # confirmed by `git stash` of `run.ts`+`SessionIsland.tsx` only:
             # `run.test.ts` failed all 3 new tests, `session-island.test.tsx`
             # failed its CTA-appears test; `git stash pop` restored both to
             # green. `TZ=UTC make test`: 1995 passing (was 1990, +5 — exactly
             # this run's new tests). `TZ=UTC make build`: exit 0, 20 routes
             # (unchanged). No v1/v2 edit, no Arabic codepoint introduced.
             # Door 3 (open practice) and `coldSuccessAdoption`/
             # `diminishingReturns` remain unwired — each needs a free-play
             # surface that does not exist yet, named in DECISIONS.md v3-D106
             # so a future run doesn't re-discover them as new.
             # NOTE (v3-D105): `packages/engine/src/test.ts#testHistory` (v2-D17
             # Progress Report's per-Test history list) had ZERO production
             # callers — v3-D104's own header named this precisely: "a learner
             # who completes a Test sees the immediate score screen but no
             # later record of it on /progress... the natural next increment,
             # not a correctness gap... only a new small `lib/progress` panel
             # in the same shape as `RetentionPanel`/`GrowthPanel`." That panel
             # now exists: new `lib/progress/testHistory.ts`
             # (`buildTestHistorySummary` — the same "component never
             # computes, it only prints" split `retention.ts`/`growth.ts`
             # already follow) + `components/progress/TestHistoryPanel.tsx`
             # (presentational only) + `TestHistoryIsland.tsx` (mirrors
             # `GrowthIsland`'s four-state discipline, edge cases #72/#73),
             # wired into `/progress` as a new TEST HISTORY card, placed after
             # the existing TEST call-to-action card.
             #
             # One real decision: `score` on a `test_result` event is
             # documented (`types.ts`) and actually written
             # (`TestIsland.tsx#finishTest`) as `correct ÷ total`, a 0..1
             # ratio — never a raw count, unlike what v2's own `Progress.tsx`
             # rendering implied by dividing `h.score / h.total` again. The
             # correct COUNT is recovered once, in `testHistory.ts`
             # (`Math.round(score * total)`), so no view re-derives it or
             # repeats v2's own reading. Every row's score sentence
             # (`"4 / 5 correct (80%)"`) mirrors `TestIsland.tsx`'s own
             # result-screen wording exactly, so a learner reads the identical
             # sentence on the day of a Test and later on /progress. The date
             # label is `tz`-explicit (`Intl.DateTimeFormat` with `timeZone:
             # tz`, `tz` resolved once server-side and passed down), the same
             # convention `/plan`'s page and `lib/plan/forecast.ts#dateLabel`
             # already use — never the machine's ambient zone (Absolute A's
             # spirit, applied outside the engine where it isn't mandatory but
             # is still the established house style).
             #
             # RED confirmed directly: `git stash` on
             # `app/(app)/progress/page.tsx` only (kept the test file and all
             # three new library/component files, each a legitimate
             # standalone unit) and reran — 1 of 16 failed, exactly the
             # `toMatch(/TestHistoryIsland/)` wiring assertion; `git stash
             # pop` restored the fix, 16/16 green again.
             #
             # `TZ=UTC make test` (full monorepo, all seven suites, fresh
             # dependency install from a clean checkout): **1990 passing**
             # (was 1974) — 255 v2 vitest + 47 v2/api + 272 v3/api + 111
             # corpus-compiler + 417 engine + 61 fold-runner + **827** apps/web
             # (was 811, +16 — exactly this run's new tests).
             # `check-test-floor.mjs`: OK, 1990 >= floor 1899 (+91 margin,
             # `TEST-FLOOR` left unmoved, same discipline as every prior
             # entry). `TZ=UTC make build`: exit 0, 20 routes (unchanged — no
             # new route file, only an existing page section and two new
             # client-side modules). `npm run gates`: locked-css OK,
             # boundaries OK (200 files, up from 196 — no violation),
             # corpus-morphology and corpus-glyphs OK.
             #
             # No `v1/**`/`v2/**` edit — a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff produced by running the suite was reverted
             # before committing, same as v3-D104. No Arabic codepoint
             # introduced: every new line addresses a surah/ayah by number, a
             # score by `correct`/`total` (integers), or a timestamp by `ts`
             # (a number) — every rendered string is composed from those,
             # never from corpus text.
             #
             # Explicitly not addressed, named so a future run doesn't
             # re-discover it as new: the `disable` field /
             # `isQuestionDisabled()` (a qari-disabled question can still
             # surface in a Test or the real session loop) remains unwired —
             # unchanged since v3-D95's/v3-D104's own retrace, and not
             # something this card introduced or was scoped to fix.
             # NOTE (v3-D104): `packages/engine/src/test.ts` (v2 Phase 4, the
             # Test self-quiz feature — vocab/cloze/junction/locate/produce +
             # chaining-reorder over a learner-chosen range, read-only by
             # construction: rebuild.ts has no fold branch for any test_*
             # event) had 11 exported functions, unit-tested since it landed,
             # and ZERO production callers — v3-D102/D103's own named,
             # twice-deferred finding ("needs a whole new route end-to-end").
             # That route now exists: new `lib/test/build.ts` (pure item
             # selection, shuffle INJECTED for testability — one deliberate
             # fix over v2's own algorithm: a reorder item's span is now
             # bounded by the CHOSEN pool length too, not just the corpus
             # tail, so a single-ayah range can no longer quiz ayat outside
             # it) + `components/test/TestIsland.tsx`/`TestGate.tsx` (mirrors
             # SessionIsland/SessionGate's split) + `app/(app)/test/page.tsx`,
             # entry point on `/progress` (a new TEST card — v3-D05 already
             # closed the 4-tab bar). Every rendered option bank uses the
             # SAME seeded `displayOrder` every other quiz surface uses
             # (never Math.random, unlike v2's `Test.tsx`) and every tap is
             # followed by an explicit "Continue" (mirrors SessionIsland's
             # own reveal discipline, never v2's `setTimeout(450)` auto-
             # advance) — both chosen for consistency with this build's own
             # established conventions, not because v2 was wrong to differ.
             # A "produce" item nests a full reconstruct pass through the
             # SAME engine functions the real session loop uses, but never
             # appends a per-tap `reconstruct_tap` — only the whole pass
             # becomes ONE `test_answer`, verified directly (a dedicated test
             # drives every blank via trial-and-error and asserts zero
             # `reconstruct_tap` events land anywhere in the log). Every
             # `rung` is `gradeClassToWire("ungraded")`, never a literal —
             # DEFECTS.md#B2's clause 14 gate passes on the first commit, not
             # as a follow-up fix. `lib/test/build.test.ts` (13 tests) +
             # `test/test-island.test.tsx` (4 tests, incl. folding the whole
             # post-Test log and asserting zero atoms — invariant #5, proven
             # against the real component's real log, not asserted in the
             # abstract). `TZ=UTC make test`: 1974 passing (was 1957, +17 —
             # exactly this run's new tests). `TZ=UTC make build`: exit 0, 20
             # routes (was 19 — `/test` is new). No v1/v2 edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff was reverted before
             # committing), no Arabic codepoint introduced. NOT addressed,
             # named so a future run doesn't rediscover it: `testHistory()`
             # (v2-D17's per-Test history on `/progress`) stays unwired — a
             # learner sees the immediate score but no later record of it;
             # the events are already durable, this is a new small panel, not
             # a correctness gap. See DECISIONS.md v3-D104.
             # NOTE (v3-D103): `packages/engine/src/heatmap.ts#growthCurve`
             # (v2-D17/D20's Progress Report growth curve — one point per
             # learning-day with a newly-encoded ayah, cumulative count) had
             # ZERO production callers, unit-tested since the heatmap landed
             # (habit.test.ts) but never wired — v3-D102's own sweep found it
             # the previous run and deliberately deferred it, scoped exactly
             # as "needs an actual chart/sparkline on /progress — a genuinely
             # new rendering surface." That surface: new `lib/progress/growth.ts`
             # (`buildGrowthSummary` — the same "component never computes, it
             # only prints" split `retention.ts` already follows) +
             # `components/progress/GrowthIsland.tsx` (a client island mirroring
             # `RetentionIsland`'s four-state discipline, edge cases #72/#73) +
             # `GrowthPanel.tsx`, wired into `/progress` as a new GROWTH card.
             # Every bar carries a real, checkable `.sr-only` label ("3 encoded
             # by day 2") beside its `aria-hidden` height — never colour/shape
             # alone (§15/#87's rule, applied to a trend rather than a
             # category) — and height is scaled off the curve's OWN maximum,
             # floored at 6% so a small nonzero day is never rounded invisible
             # (same discipline as `.dist-bar__fill`'s data-driven widths).
             # RED confirmed: reverting just the page wiring (kept the new
             # `growth.ts`/`GrowthPanel`/`GrowthIsland` files, all legitimate
             # standalone units) failed 1 of 17 new `progress-growth.test.tsx`
             # tests, exactly the wiring assertion; reverted byte-identically,
             # 17/17 green again. `packages/engine/src/test.ts`'s entire Test
             # self-quiz feature (11 exported functions, real coverage, no
             # `/test` route anywhere) remains deliberately unwired — it needs
             # a whole new route, not a card on an existing one. `TZ=UTC make
             # test`: 1957 passing (was 1940, +17 — exactly this run's new
             # tests). `TZ=UTC make build`: exit 0, 19 routes (unchanged). No
             # v1/v2 edit, no Arabic codepoint introduced — every new line
             # addresses a word by `position` (an integer) or a day by
             # `ordinal`/`cumulativeEncoded` (integers derived from the event
             # log), never corpus text.
             # NOTE (v3-D102): `packages/engine/src/heatmap.ts#wordDiagnostics`
             # (the ayah-detail route's "one tap deeper" per-word accuracy
             # diagnostic, invariant #1: words are diagnostics, never the
             # graded atom) had ZERO production callers, unit-tested since the
             # heatmap landed (habit.test.ts) but never wired. Fixed:
             # `AyahStatsIsland.tsx` now computes `wordDiagnostics()` alongside
             # its existing row read and renders a "Tap accuracy, word by
             # word" list via the new `lib/progress/wordAccuracy.ts` (rows.ts's
             # own discipline: the component prints, never computes). A word
             # never tapped is DROPPED, never printed as "0%" — the same
             # unmeasured-vs-zero rule `rows.ts` already applies to the ayah
             # figures above it. RED confirmed by reverting just the wiring
             # (kept the new lib file, a legitimate standalone unit): 3 of 42
             # `ayah-detail.test.tsx` tests failed on exactly the new
             # assertions; reverted byte-identically, 42/42 green again.
             # `growthCurve()` (heatmap.ts's other unwired export, a Progress
             # Report growth-over-time curve, v2-D17/D20) and
             # `packages/engine/src/test.ts`'s entire Test self-quiz feature
             # (11 exported functions, real coverage, no `/test` route
             # anywhere) were found by the same sweep and deliberately left
             # for a future run — each needs its own UI surface, not a wiring
             # fix. `TZ=UTC make test`: 1940 passing (was 1935), floor 1899
             # satisfied (+41 margin). `TZ=UTC make build`: exit 0, 19 routes
             # (unchanged). No v1/v2 edit, no Arabic codepoint introduced.
             # NOTE (v3-D101): DEFECTS.md#B11 — the day-1 cold gate (FR3,
             # gate.ts) could never actually be PASSED on the shipped
             # `/session` route. `lib/session/run.ts#answerAfterTap` always
             # emitted `ayah_produced` for a completed reconstruction pass,
             # even when the completed queue item was a due gate
             # (`run.queue[cursor].kind === "gate"`, read once by `machineFor`
             # to size the reconstruction, never checked again at commit
             # time). `gate.ts#applyGateResult()` — the only place
             # `gatePassed` is ever set true — is folded exclusively from a
             # dedicated `gate_result` event; the mis-emitted S3
             # `ayah_produced` instead re-armed the SAME gate for the next
             # learning-day (rebuild.ts's ordinary rung-S3 branch calls
             # `scheduleGate()` again). Since `unlockPermitted()`'s default
             # tolerance is 0, a default-pace learner who completed one
             # ayah's Learn could NEVER unlock a second ayah — the gate
             # reappeared, was answered correctly, and silently rescheduled
             # itself forever, with no error surfaced anywhere. Same shape as
             # B10/B2: a caller re-deriving/misrouting a grading decision
             # instead of the dedicated resolver. Fixed: `answerAfterTap` now
             # emits `gate_result` (`correct: adv.correct`) instead of
             # `ayah_produced` when the completed item's kind is "gate".
             # Verified RED (reverting just the source, keeping the new
             # test, reproduced the failure on exactly `gateResults.length
             # === 0`) then green. NOT addressed: `sessionSummary.ts` still
             # only counts `ayah_produced`/`ayah_complete` toward
             # `ayatCompleted`, so a gate-only session shows 0 ayat completed
             # on the summary screen — a small, separate UI question. See
             # DEFECTS.md#B11 and DECISIONS.md v3-D101.
             # NOTE (v3-D100): `Admin\SystemHealthController` (build-plan step
             # 24 — "System Health: both checks, coverage alerts, degraded
             # banner, rebuild with mutex") had a fully-tested backend and ZERO
             # frontend callers — `find "app/(admin)" -type f` returned only
             # `/workbench` and `/settings/stripe`. New `lib/admin/health.ts` +
             # `components/admin/SystemHealthPanel.tsx` +
             # `app/(admin)/settings/health/page.tsx` give it a face, mirroring
             # `loadFrontier`'s three-state discipline (#167: unknown is never
             # painted as 0) and #168's queued-vs-failed rebuild distinction.
             # Adjacent finding while building it: `StripeSettingsPanel.tsx`
             # (zero prior test coverage) called `apiFetch("/admin/stripe")` —
             # missing the `/api` prefix every other call site in this app
             # uses — so the shipped Stripe settings screen 404'd before
             # Laravel ever saw the request. Fixed both call sites; a
             # regression test reproduces the bug against the unfixed
             # component first (RED), then confirms the fix. This run also
             # swept every other `onAnswer`-shaped wiring v3-D99 flagged as
             # unaudited (`FirstRecall`, `ExplainTrace`) for B10's exact drift
             # and found none — a genuine, verified negative. See
             # DECISIONS.md v3-D100.
             # NOTE (v3-D99): DEFECTS.md#B10, found while wiring v3-D98 (below).
             # `lib/session/run.ts#answerCurrent` graded a tap against the
             # ENGINE'S RAW, unshuffled `[correct, ...distractors]` order
             # (`currentItem(...).options`), but the index a real tap reports
             # is into the SHUFFLED display bank `lib/onboarding/pass.ts
             # #assemblePass` builds and `SessionIsland` actually renders —
             # the identical drift v3-D57/D58 already found and fixed once in
             # onboarding/the landing demo (`lib/demo/reconstruct.ts#applyTap`
             # is the already-correct precedent). A standalone diagnostic
             # against the real 112 corpus found 0 of 4 blanks of 112:1 where
             # the raw slot the old code read agreed with what the learner was
             # actually shown as correct — tapping the DISPLAYED correct tile
             # was graded against whichever face the shuffle happened to leave
             # at raw slot 0. This is the ONLY graded path in the product.
             # Fixed: `answerCurrent` now resolves the tapped surface via the
             # SAME `assemblePass` call `SessionIsland` renders from, mirroring
             # `applyTap` exactly. Confirmed with a genuine RED: reverting the
             # fix and re-running `run.test.ts` failed 10 of 21 tests,
             # including sessions that never reached `done` — a correct tap
             # graded wrong stalls the reconstruction outright, since a
             # wrong-graded tap never advances. Nothing caught this for five
             # days because `run.test.ts`'s own `playThrough` always submitted
             # raw index 0 (bypassing the shuffle entirely), the e2e suite's
             # one `/session` tap explicitly doesn't check correctness, and
             # `quiz.test.tsx` tests the cards in isolation with mocked
             # `onAnswer`. See DEFECTS.md#B10 and DECISIONS.md v3-D99.
             # NOTE (v3-D98): `packages/engine/src/freeplay.ts` (FR6, "three
             # doors after session complete" — extra Learn, weak-spot gym,
             # open practice, plus cold-success adoption and a
             # diminishing-returns nudge) had ZERO production callers, in v2
             # or v3, despite being fully unit-tested (17 assertions). Scoped
             # to Door 1 only (`extraLearnGrant`) — the one piece that slots
             # into the existing post-session summary screen with no new
             # route or picker UI. `lib/session/run.ts` gained
             # `extraLearnOfferFor`/`startExtraLearn`; `SessionIsland` offers
             # "Learn one more ayah (~N min)" once the assembled queue is
             # done and the engine's own fold still grants it. Doors 2/3, the
             # adoption offer and the diminishing-returns nudge are
             # deliberately NOT done — each needs its own UI surface. See
             # DECISIONS.md v3-D98.
             # NOTE (v3-D97): `packages/engine/src/streak.ts#computeStreak()`/
             # `completedDayIndices()` (FR9 — pause-on-miss, never zeroes,
             # 19 tests) had ZERO production callers. Unlike prior nights this
             # wasn't silent data corruption — it was a marketing claim with
             # nothing behind it: the landing page's own FAQ answers "Is this
             # another streak app?" in the present tense ("There is a streak,
             # and it is deliberately unimportant... no leaderboard, no
             # ranking..."), and nothing in the shipped app ever showed a
             # streak anywhere. Fixed, scoped narrowly: `lib/home/queue.ts`
             # now computes a quiet `${n}-day streak` (or null on zero — never
             # a nagging "0-day streak") from the SAME event log the due-count
             # already reads; `TodaySession.tsx` renders it via the locked
             # `.pill-streak` class (existed, unused, since the v1 port).
             # Deliberately NOT done: `atRisk`/`pausedOnMiss`/`makeupAvailable`
             # stay unsurfaced, and the rich streak-calendar/freeze-token UI
             # WIREFRAME/BUILD-PLAN name is v3-D06's flag-gated M11 social
             # scope, OFF by default — this fix backs the FAQ's own minimal,
             # private claim, not that larger surface. See DECISIONS.md v3-D97.
             # NOTE (v3-D96): `packages/engine/src/overrides.ts#applyOverrides()`
             # — "the ONE place override precedence is decided," closing
             # DEFECTS.md#B1/#B4 — was unit-tested three times but had ZERO
             # production callers. Both halves of the write/read API were real
             # and independently tested (`POST /api/overrides` admin-gated write,
             # `GET /api/overrides` public read), but `lib/corpus/client.ts
             # #fetchCorpus` — what `SessionIsland.tsx` actually drills a real
             # learner against — served the raw compiled corpus straight
             # through. A qari/admin correcting a wrong gloss or a bad
             # distractor via the already-shipped write path had that
             # correction silently never reach the learner being graded on it.
             # Fixed: new `lib/overrides/fetch.ts#fetchOverrides()` (mirrors
             # `lib/entitlement/sync.ts`'s never-throws/never-blocks discipline,
             # routed through `apiFetch`, the sole `/api` egress) + `fetchCorpus`
             # now applies the result via `applyOverrides()` before caching.
             # Deliberately NOT done: `lib/corpus/load.ts` (the SSR loader
             # behind `/plan`/`/progress`/`/surah/[surah]`/`/workbench`) still
             # serves the raw corpus — this codebase has no established
             # pattern for the Next.js server to call the Laravel API over
             # HTTP (every other live server state is client-fetched), so
             # inventing one is real scope, not tonight's wiring fix; and
             # `isQuestionDisabled()`/the `disable` field remains unconsumed
             # anywhere in the selection engine. See DECISIONS.md v3-D96.
             # NOTE (v3-D95): eight straight nights (v3-D82..D94) mined the
             # same bug class — "mechanism built and unit-tested, zero
             # production callers." This run's fresh sweep came back empty
             # against that same bar for the first time (see DECISIONS.md
             # v3-D95 for the full retrace of near-misses ruled out). Picked
             # up HANDOVER.md's own still-open E10 instead: nothing summed
             # the seven `make test` suites and compared against a floor, so
             # DEFECTS.md#B9's "build gate that can never fail" had a live
             # sibling — a suite could shrink and `make test` would still
             # exit 0. Built `v3/scripts/check-test-floor.mjs` (RED before
             # green, 9 new tests), wired into the root `Makefile`'s `test`
             # target. Mutation-verified 3 ways incl. a LIVE-FIRE proof: a
             # temporarily `.skip`'d real test in `sync-trigger.test.tsx`
             # left the vitest suite itself green (735 passed | 1 skipped)
             # but made `make test` exit 2 — proving the gate catches
             # exactly the silent-shrink case it was built for. See
             # DECISIONS.md v3-D95.
             # NOTE (v3-D94): `lib/idb/append.ts#retryAppend()`/`RetryableAppendError`
             # — edge case #74's "QuotaExceeded on tap write... card blocks with
             # retry banner; tap never silently dropped" — had ZERO production
             # callers. `lib/session/run.ts#answerCurrent` let a retryable commit
             # failure propagate raw, and `SessionIsland.tsx`'s only catch turned
             # EVERY failure into a static alert with no button — the retry banner
             # edge case #74 names did not exist; a learner who hit a real quota
             # error mid-drill was stuck on a dead end. Fixed: `answerCurrent` now
             # throws a new `SessionCommitFailure` (carrying a `resume()` that
             # retries the SPECIFIC failed commit via `retryAppend`, reusing its
             # id/deviceSeq, then continues exactly where it left off — never by
             # re-invoking `answerCurrent`, which would double-append an
             # already-landed event under a fresh id); `SessionIsland.tsx` renders
             # a real "Retry" button wired to `resume()`. A second candidate this
             # run's sweep found, `EntitlementMachine::merge()` (edge case #113),
             # was traced and left alone: account adoption has no UI or client
             # contract at all yet (per DECISIONS.md, `DeviceReset.tsx`'s own
             # comment), so wiring `merge()` is real M6 scope, not a one-night fix.
             # See DECISIONS.md v3-D94.
             # NOTE (v3-D93): `WriteLock.subscribe()`/`useWriterStatus()`
             # (lib/idb/writeLock.ts, lib/idb/useLogState.ts) — edge case #75's
             # multi-tab writer-takeover mechanism — had ZERO production callers.
             # `SessionIsland.tsx` took one `writeLock.acquire()` snapshot at
             # mount and never learned of a LATER promotion, even though
             # `WriteLock.release()`'s own docblock promises "a queued tab is
             # promoted without a reload." A learner who closed the other tab
             # stayed stuck on "This session is open in another tab... reload
             # this page" with no way back short of a manual reload. Fixed:
             # the mount effect now subscribes to `writeLock` and starts the
             # session the moment status flips to writer, no remount needed.
             # `useWriterStatus()` itself remains unconsumed (a separate,
             # smaller gap — see DECISIONS.md v3-D93). `TrialAttribution`
             # (v3-D91) and `permitsIssuance`/`permitsReview` (v3-D88) are
             # unchanged, still open product questions, not wiring gaps.
             # NOTE (v3-D92): `POST /api/verifications` gated `tier: qari` on the
             # generic `admin` allowlist only — `AdminRole::QARI` (build-plan step
             # 24) existed and its own migration docblock said roles "refine what
             # an already-allowlisted admin may do," but nothing ever checked one,
             # and no code path anywhere could even GRANT it. Any operator or
             # moderator admin could sign a scholar's qari-tier row undetected —
             # confirmed live: the existing test suite exercised this exact path
             # with a roleless admin fixture and passed. Fixed: `store()` now
             # requires `hasAdminRole(AdminRole::QARI)` for the qari tier; new
             # CLI-only `admin:grant-role {email} {role}` is the missing grant
             # path (roles refine an allowlisted admin, they never admit one).
             # Admin-tier writes (distractors/specs) stay open to any admin —
             # v3-D13 never gated them on scholarship. See DECISIONS.md v3-D92
             # and LAUNCH-CHECKLIST.md gate 16 (S5).
             # NOTE (v3-D91): `App\Flags\FlagService::autoWaiveDueKills()` (v3-D17's
             # 72h audited auto-waive, LAUNCH-CHECKLIST gate 9) was built and
             # unit-tested since the flag plane shipped but had ZERO production
             # callers — `routes/console.php` scheduled only the determinism
             # nightly and the PDPA purge, never this. A killed flag's admin
             # banner never actually auto-cleared after 72h on a real host. Fixed:
             # `flags:auto-waive` (`AutoWaiveKillsCommand`), scheduled daily
             # 04:00 UTC. See DECISIONS.md v3-D91. Still fires only once gate 20
             # (a host running `schedule:run`) exists.
             # NOTE (v3-D90): `lib/entitlement/sync.ts`'s own header CLAIMED
             # `refreshEntitlementSnapshot` was already "fire-and-forget from
             # every caller ... see lib/session/run.ts#startSession" — false;
             # `run.ts` has no React and nothing called it. This is the OTHER
             # unwired half of v3-D88 (the cache-WARM, not the gate — that
             # question is still open, see below). `components/session/
             # SessionIsland.tsx`'s mount effect now calls it fire-and-forget.
             # `permitsIssuance`/`permitsReview` STILL have zero gating
             # callers — only the cache warm moved. See DECISIONS.md v3-D90.
             # NOTE (v3-D89): `lib/sync/sync.ts#syncCycle()` — B5's actual fix
             # (merge.ts) reached via `pullFromServer` — had ZERO production
             # callers anywhere in apps/web since build-plan step 21: a
             # learner's second device never actually pulled their events.
             # `components/shell/SyncTrigger.tsx` now calls it on mount +
             # window `online`/`focus` (v2/src/sync/useBackgroundSync.ts's own
             # precedent for this exact question), gives `shouldAttemptSync()`
             # and `backoffMs()` their first real callers too, and is mounted
             # in app/(app)/layout.tsx beside <TabBar/>. See DECISIONS.md
             # v3-D89. `permitsIssuance`/`permitsReview` (v3-D88) remain
             # untouched — still a stop-and-report product question, not
             # resolved by this run's precedent.
             # NOTE (v3-D88): `PaywallGate::permitsIssuance()` and its client
             # mirror `lib/entitlement/gate.ts#permitsIssuance()` had ZERO
             # production callers, on EITHER side, six days after the session
             # loop (step 18) made the reason for deferring them stale.
             # `GET /api/entitlement` + `lib/entitlement/sync.ts` now give the
             # client a real snapshot to call `permitsIssuance` WITH — but the
             # actual call inside `lib/session/run.ts#startSession` is still
             # NOT wired, on purpose: doing so naively would deny REVIEW for a
             # lapsed learner too, since `/session` issues one mixed queue and
             # v3-D16 (this build's "single ethical commitment") requires
             # review to stay open forever. See DECISIONS.md v3-D88 for the
             # two ways to resolve that and why picking one needs Firdaus.
             # NOTE (v3-D87): LAUNCH-CHECKLIST gate 21 (per-corpus Amiri glyph
             # coverage) was mislabeled BLOCKED-ON-INFRA on a reason that had
             # already stopped applying once the launch surah set closed
             # (v3-D59). `check-corpus-glyphs.mjs` (no new dependency — a
             # from-scratch WOFF2/cmap parser, self-verified against
             # FONTS.md's independently-verified codepoint counts) now runs in
             # `npm run gates`/`prebuild` and reports zero uncovered
             # codepoints across all four launch surahs.
             # NOTE (v3-D50): v3/api/tests/Unit/.gitkeep is LOAD-BEARING.
             # NOTE (v3-D77): `make test`/`make build` both depend on `compile-corpus`
             # now — do not hand-run compile-corpus first and assume that's why it's green.
             # NOTE (v3-D82): v3-D77's compile-corpus fix missed `test-api3` itself —
             # OverrideHashRecomputeTest reads the real compiled 112/hashes.json with
             # no fixture fallback, so `test-api3` (and CI's `php` job for v3/api) was
             # red on a genuinely clean checkout. Both now compile the corpus first.
             # NOTE (v3-D83): DEFECTS.md#B2 was reborn outside JSX — `lib/session/run.ts`
             # (the real session loop, step 18) re-derived the exact `full ? S3 : S2`
             # ternary; `gradeClassToWire()` had ZERO callers anywhere. Fixed, and
             # check-boundaries.mjs clause 14 now greps app/+components/+lib/ for a
             # literal Rung on `rung:` so this cannot silently return.
             # NOTE (v3-D85): the admin "rebuild atom cache" button (step 24) never
             # actually rebuilt anything — no Process call, no queued job, and the
             # lock it acquired was never released; both its tests passed only
             # because they manually force-released that lock. Fixed SYNCHRONOUSLY
             # (matching v3-D81's CorpusHashRecomputer precedent) via the new
             # App\Support\AtomCacheRebuilder + worker/fold-runner/bin/rebuild-atom-cache.ts —
             # a queued job would have reproduced the same "nothing runs it" defect,
             # since nothing on this deployment runs a queue worker either.
             # Steps 1-26 + 29 done. 27/28 blocked on human content/qari (HANDOVER.md C1-C4).
             # 30's engineering: the P1 pager is now wired (v3-D82) — a confirmed P1
             # emails config('nightly.pager_emails') (defaults to ADMIN_EMAILS); still
             # needs a live SMTP account to actually deliver (gate 20). LAUNCH-CHECKLIST
             # gate 19 (PDPA delete/purge) landed its backend in v3-D79 and its frontend
             # surface (/settings) in v3-D80 — still open: the Postgres append-only grant
             # and a live nightly `pdpa:purge-due` run (gate 20, no staging host).
             # See LAUNCH-CHECKLIST.md's "critical path out of here" for what's
             # genuinely still open — re-verify against the repo, don't trust this
             # comment's numbers past their next change.
make build   # must pass — CI no longer tolerates failure (B9)
make doctor  # what's missing
```

`composer dev` starts the **wrong** Vite. Use `make dev`. See `LOCAL-SETUP.md`.

## Where things go

```
v3/api/            Laravel (its own app — v3-D08)
v3/apps/web/       Next.js App Router
v3/packages/engine/  the pure engine, ported from v2
v3/worker/         Node fold-runner — the ONLY server-side fold
v3/docs/           spec + plan
```
