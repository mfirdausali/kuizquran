# Known defects

Every one verified in source, not inferred. Each names its owning milestone and
the regression test that closes it.

**B1–B6** are v2 engine/data defects carried into the port. **B7–B9** were found
by executing the v2 harness. **B10, B11, B12** were found in v3's own session
loop (build-plan step 18), independent of the v2 port. **B13** is a port
omission in the Test route (build-plan step 15's override layer, consumed at
step 18+). **E-01…E-08** are multi-surah defects that only manifest once a
second surah exists.

---

## B13 — the `disable` override reached no learner ✅ CLOSED (build-plan step 15, v3-D110)

The override layer's four fields are closed-set-validated on both sides
(`OverridesController::CLOSED_FIELDS = ['gloss','distractor','group','disable']`).
Three reached a learner. `disable` never did, for two independent reasons that
hid each other:

1. **The list was discarded at the one call site that existed to use it.**
   `applyOverrides()` returns `{corpus, disabled, groups}`, but
   `lib/corpus/client.ts#fetchCorpus` took only `.corpus`
   (`applyOverrides(raw, overrides).corpus`). So
   `overrides.ts#isQuestionDisabled()` had **zero production callers** —
   `grep -rln isQuestionDisabled apps/web` returned nothing.
2. **v3's port dropped the filter.** `lib/test/build.ts#buildTestItems` is a
   port of `v2/src/pages/Test.tsx#buildItems`, whose third parameter IS
   `disabled` and which ends with an explicit post-generation filter plus an
   `itemDisableKey` helper. The v3 port dropped the parameter, the filter and
   the helper. Nothing noticed, because the list had no route to the function
   anyway.

⇒ An admin or qari who disabled a broken question through the already-shipped,
already-admin-gated `POST /api/overrides` changed nothing about what any
learner saw. `lib/overrides/fetch.ts`'s own header already claimed otherwise
("a disabled broken question... never reached a learner") — false when
written, the same shape as v3-D90's false docblock claim.

**Why nothing caught it:** the Laravel side tests the write path and the
engine tests `applyOverrides`/`isQuestionDisabled` in isolation with a
hand-passed list; `lib/test/build.test.ts` tested exactly the signature the
port shipped, so it could not miss a parameter that was never there.

**Fixed:** `fetchEffectiveCorpus()` + `EffectiveCorpus {corpus, disabled}`
(with `fetchCorpus` delegating, identity-asserted); `itemDisableKey` ported
verbatim and exported; `buildTestItems` takes `disabled` as a **required**
parameter (a default `[]` would re-create the defect by omission);
`TestIsland` threads it.

**Verified:** RED confirmed twice by `git stash` of the three source files
only, tests kept — 23 of 30 unit tests failed, and the component test failed
separately on exactly its `testKind === "vocab"` assertion, proving the RED
is the wiring rather than test isolation. The component test disables "vocab"
ayah-wide over all four ayat of 112; it cannot pass vacuously, since vocab is
`KIND_ORDER` slot 0 and an unfiltered Test always contains one. `TZ=UTC make
test`: 2030 passing (was 2016, +14 — exactly this run's new tests). `make
build`: exit 0, 20 routes (unchanged). Gates green. No v1/v2 edit, no Arabic
codepoint (429 added lines swept directly).

**Scope, deliberate:** v2's `Drill.tsx` does not consult `isQuestionDisabled`
either, and the session loop's graded surface is a reconstruct pass over one
ayah's own words — not a question-bank draw — so there is no per-question
selection for a `disable` row to act on. Named in `fetchCorpus`'s docblock so
the narrower call site is not later misread as an oversight.

See DECISIONS.md v3-D110.

---

## B12 — a cold gate could never actually FAIL ✅ CLOSED (build-plan step 18, v3-D107)

Once B11 made a cold gate PASSABLE, this run's sweep found it could still never
FAIL through the real session loop — the root cause of a second, deeper defect:
`gate.ts#gateForgiveness()`/`demoteToLearn()` (v2-D08's forgiveness ladder) were
real, unit-tested (`gate.test.ts`) and fold-safe (`rebuild.test.ts`'s own
`gate_demote` block) but structurally UNREACHABLE — not merely unwired.

`advanceReconstruct` (`reconstruct.ts`) never advances the blank index on a
wrong tap; a learner simply retries the SAME blank until correct, so `adv.correct`
is unconditionally `true` at the moment a reconstruction pass completes.
`answerAfterTap`'s gate branch (post-B11) stamped `gate_result.correct:
adv.correct` — always `true` — so a cold gate that started with a slip and was
doggedly retried into completion was recorded as a clean pass. v2's own
`pages/Gate.tsx` (the port source, read but never touched — never edited) got
this right: a local `slipped` flag, set on any wrong tap during the cold stage,
decides `passed = !slipped` at completion — "one pass, no partial credit... any
slip fails the whole gate" (`Gate.tsx`'s own header). That flag was never ported.

⇒ `AtomState.gateFails` only ever increments inside `applyGateResult`'s FAIL
branch, reached only by a `gate_result` event whose `correct` is `false` — so
`gateFails` could never exceed 0 in production, and `gateForgiveness()` could
never return anything but `"cold"`. The forgiveness ladder WIREFRAME.md's own
"cold gate — spine of the schedule" section promises ("after repeated fails the
app *offers* to send the ayah back to Learn") had no possible trigger.

**Why nothing caught it:** `gate.ts`'s own 13 tests exercise `applyGateResult`
in isolation with a hand-passed `passed: false`, never through a real tap
sequence; B11's own regression test (above) only drives the happy path
("the learner completed the gate CORRECTLY").

**Fixed:** `SessionRun` gained a `gateSlipped` field, reset whenever a new
queue item becomes current and set `true` by any wrong tap while the current
item is a due gate. `gate_result.correct` is now `!run.gateSlipped`, never
`adv.correct`. `lib/session/run.ts` also gained `demoteOfferFor`/
`acceptGateDemote` (the demote half of the ladder — see v3-D107 for why
"rescaffold", the lighter S2 warm-up rung, is a deliberately separate,
unaddressed gap) and `SessionIsland.tsx` now shows "send it back to Learn"
instead of the quiz card once the engine's own fold says to offer it.

**Verified:**
- RED confirmed directly: a test drives one deliberate wrong tap mid cold-gate
  pass, then recovers by retrying every blank correctly — against the
  unfixed source this asserted `gate_result.correct === false` and failed
  with `true`; against the fix it passes. A second test (the pre-existing
  B11 happy path) confirms zero regression: a slip-free pass still records
  `correct: true`.
- `demoteOfferFor`/`acceptGateDemote` proven at the `run.ts` level (seeded via
  4 real `gate_result:false` events, the same public `append()` entry point
  every real tap commits through) and at the component level (RED confirmed:
  the demote-offer UI tests failed against the unmodified `SessionIsland.tsx`
  — `findByRole` timeouts on the new button — before the wiring landed).
- `TZ=UTC make test`: 2003 passing (was 1995, +8 — exactly this run's new
  tests: 5 in `run.test.ts`, 3 in `session-island.test.tsx`). `check-test-floor.mjs`:
  OK, 2003 >= floor 1899 (+104 margin). `TZ=UTC make build`: exit 0, 20 routes
  (unchanged). `npm run gates`: locked-css OK, boundaries OK (201 files
  checked; this run created no new file — `git status` confirms only the 4
  existing files listed above changed — so the count vs. a prior entry's 200
  is pre-existing drift, not something introduced here; clause 5 does not
  flag the new `gateForgiveness`/`.kind` reads since those live in `lib/`,
  never `app/`/`components/`), corpus-morphology and
  corpus-glyphs OK. No `v1/**`/`v2/**` edit (verified: `git status --porcelain`
  clean on both trees before commit — a stray `v2/tsconfig.tsbuildinfo`
  build-cache diff from running the suite was reverted, same discipline as
  every prior entry). No Arabic codepoint introduced (checked directly against
  the diff, and via `npm run gates`' own Arabic-codepoint grep, which passed):
  every new line addresses an ayah by number, a fail count by integer, or a
  `Rung` via `gradeClassToWire()`, never a literal.

**Explicitly not addressed at the time, named so a future run doesn't
re-discover it as new:** the "rescaffold" rung of the ladder
(`RESCAFFOLD_AFTER_FAILS = 2`, a lighter, ungraded-for-pass/fail S2 warm-up
pass offered BEFORE the next cold attempt) was still unwired. v2's
`Gate.tsx` implements this as a second, distinct reconstruction phase within
the same gate visit; wiring it here would mean a queue item that transitions
between two `ReconstructState` machines mid-item — a real, separate
state-machine extension this run chose not to make alongside the root-cause
slip-tracking fix. Between 2 and 4 consecutive fails, a learner would still
get the ordinary full cold check, not the lighter warm-up.

**Closed 2026-08-19 (v3-D109).** `lib/session/run.ts` gained
`machineForItem()` (builds the reconstruct machine for a queue item AND
decides the rescaffold phase together) and `settleRescaffoldWarmup()` (the
in-place, same-cursor transition from the warm-up's completed
`ayah_produced` to the real cold check's fresh `full:true` machine) — see
DECISIONS.md v3-D109 for the full write-up.

---

## B11 — the day-1 cold gate could never actually be PASSED ✅ CLOSED (build-plan step 18, v3-D101)

`lib/session/run.ts#answerAfterTap` always emitted `type: "ayah_produced"` for
a completed reconstruction pass, regardless of whether the just-completed
queue item was an ordinary "learn"/"review" item or a due day-1 cold **gate**
item (`run.queue[run.cursor].kind === "gate"` — read once by `machineFor` to
size the reconstruction as full-ayah, but never checked again at commit time).

`gate.ts#applyGateResult()` is the ONLY place `AtomState.gatePassed` is ever
set `true`, and it is folded exclusively from a `gate_result` event
(`rebuild.ts:88-100`). A mis-emitted `ayah_produced` with rung S3 instead hits
the `"ayah_produced"` fold branch, which — because the rung is S3 — calls
`scheduleGate()` AGAIN, re-arming the identical gate for the next
learning-day. `gatePassed` never becomes `true`.

⇒ Since `unlockPermitted()`'s default `gateTolerance` is 0 (pace.ts's
"steady" mode), a default-pace learner who completed their first ayah's Learn
could never unlock a second ayah: every day the same cold gate reappeared,
was answered correctly, and was silently re-scheduled for tomorrow — an
infinite loop with no learner-visible error. Same shape as B10/B2: a caller
re-deriving/misrouting a grading decision instead of routing through the
dedicated, tested resolver.

**Why nothing caught it:** no test anywhere — engine-level or `run.test.ts`
— drove a "learn → next learning-day → complete the due gate" scenario
through the real session loop; `gate.ts`'s own 13 tests exercise
`applyGateResult`/`scheduleGate` in isolation, never through `run.ts`.

**Fixed:** `answerAfterTap` now checks `run.queue[run.cursor]?.kind ===
"gate"` and, when true, emits `gate_result` (`rung: gradeClassToWire("gate")`,
`correct: adv.correct`) instead of `ayah_produced`.

**Verified:**
- RED confirmed by reverting the fix (`git stash` of the source file only,
  test kept) and re-running `run.test.ts`: the new test failed on exactly
  `gateResults.length` being 0; reverted byte-identically, 22/22 green again.
- A regression test seeds a genuine S3 `ayah_produced` (the same public
  `append()` a real Carry-band completion uses, never a fabricated internal
  atom shape), advances to the next learning-day, confirms the assembled
  queue actually opens with a `"gate"` item, plays it through correctly, and
  asserts both a `gate_result` event lands (never a second `ayah_produced`
  for the same ayah) and the rebuilt atom is `gatePassed: true`.
- `TZ=UTC make test`: 1935 passing (was 1934), floor 1899 satisfied (+36
  margin). `TZ=UTC make build`: exit 0, 19 routes (unchanged). No `v1/**`/
  `v2/**` edit, no Arabic codepoint introduced.

**Explicitly not addressed at the time, named so a future run doesn't
re-discover it as new:** `sessionSummary.ts#summarizeSession` counted
`ayatCompleted` only from `ayah_complete`/`ayah_produced` events, so a
session whose only work was a passed gate showed 0 ayat completed on the
summary screen (previously it wrongly counted as 1, only because the gate
was mis-emitted as `ayah_produced`). No existing test asserted on this
combination. Whether/how the completion screen should credit a passed gate
was a small, separate UI question, not part of this fix's scope.

**Closed 2026-08-24 (v3-D133).** `summarizeSession` now credits a PASSED
`gate_result` as one completed ayah (deduped against a same-session
rescaffold warm-up's own `ayah_produced` for the same ayah); a failed gate
still counts as nothing completed. See DECISIONS.md v3-D133 for the full
write-up, including the two independent RED confirmations (engine unit
level and the real `startFloorSession` → `sessionSummaryOf` wiring).

## B10 — a tap graded against the engine's raw order, not the shuffled bank the learner actually saw ✅ CLOSED (build-plan step 18, v3-D99)

`lib/session/run.ts#answerCurrent(run, c, optionIndex, ctx)` did
`cur.options[optionIndex]`, where `cur = currentItem(run, c)` exposes the
engine's RAW, UNSHUFFLED `[correct, ...distractors]` order (`options.ts`'s own
docstring: "display order is the UI's concern"). But `optionIndex` is the
LOGICAL index a real tap reports — an index into the SHUFFLED display bank
`lib/onboarding/pass.ts#assemblePass` builds and `SessionIsland` renders from
(`components/quiz/QuizCard.tsx`'s own prop contract: "an index into the item's
own options... the caller commits this to the log and decides correctness
against the item's own correctIndex").

⇒ Tapping the tile the learner is SHOWN as correct was graded against
whichever face the shuffle happened to leave at RAW slot 0 — correct only
when that coincided, which a fresh corpus check found true for 0 of 4 blanks
of 112:1. A real learner's genuinely correct taps were routinely recorded as
slips (damaging strength on evidence that was never wrong), and the
reconstruction pass could stall outright, since a wrong-graded tap never
advances the blank. This is the ONLY graded path in the shipped product — the
same severity class as B6, on the surface B6 was originally about.

**This is the EXACT drift v3-D57/D58 already found and fixed once**, in
onboarding screen 2 and the landing demo — `lib/demo/reconstruct.ts#applyTap`
correctly resolves `step.item.options[optionIndex].text` (the shuffled Face's
own text), never a raw-order lookup. The session loop (built later, at step
18) reintroduced the identical defect independently.

**Why nothing caught it:** `lib/session/run.test.ts`'s own `playThrough`
helper submitted `currentItem(...).correctIndex` directly — always 0, by
construction of the raw array — bypassing both the DOM and the shuffle
entirely, so 15+ tests exercised "always tap raw index 0" and never noticed it
meant something different once real UI wiring was involved. The Playwright
e2e suite's one `/session` tap explicitly says "whether it is right or wrong
does not matter here" (`e2e/first-session.test.ts`) — no e2e test drives a
full, genuinely-correct multi-tap completion of the real session route.
Component tests (`test/quiz.test.tsx`) test the cards in isolation with
hand-fed `onAnswer` mocks, which cannot see this either.

*Closes when:* `answerCurrent` resolves the tapped SURFACE from the same
shuffled assembly the bank was rendered from, and a test drives a real
shuffled-index tap (not raw index 0) through to a correct, advancing grade.

**Fixed 2026-08-17 (v3-D99):** `answerCurrent` now calls
`assemblePass(run.machine, c)` (the SAME assembly `SessionIsland` already used
for rendering) and resolves `choice` from
`assembled.item.options[optionIndex].text` — mirroring `applyTap`'s already-
correct precedent exactly. `lib/session/run.test.ts`'s `playThrough` and every
other direct `answerCurrent` caller in that file now go through a new
`correctIndexFor(run, c)` helper (`assemblePass(...).item.correctIndex`)
instead of the raw, always-0 `currentItem(...).correctIndex`.

**Verified:**
- RED confirmed by temporarily reverting the fix and re-running
  `lib/session/run.test.ts`: 10 of 21 tests failed, including sessions that
  never reached `done` at all (a genuinely correct tap graded wrong, so the
  reconstruction stalled) — concrete proof of real-world impact, not a
  hypothetical. Reverted byte-identically; 21/21 green again.
- A dedicated regression test asserts a shuffled-correct tap where the raw
  slot is provably **not** 0 (`assembled.item.correctIndex !== 0`, so the test
  cannot pass vacuously on an identity shuffle) resolves `correct:true`.
- A component-level test (`test/session-island.test.tsx`) drives real DOM taps
  through `SessionIsland` via trial-and-error per blank (the same technique
  the e2e suite's `completeFirstRecall` uses, and for the same reason — no
  Arabic literal may be written to know the answer in advance) and confirms a
  full ayah completes and the log shows `correct:true` throughout.
- `TZ=UTC make test`: 1913 passing (was 1905), `make build` exit 0, boundaries
  gate OK (179 files, sacred-text clause 4 clean over every changed file).

See DECISIONS.md v3-D99 for the full write-up, including the FR6 Door-1 work
that surfaced this while auditing the same call path.

## B9 — the CI build gate was a no-op ✅ CLOSED (M0)

`.github/workflows/ci.yml:61` ran `$PM run build --if-present || true`, and a log
containing "No test files found" counted as a pass. A type-broken frontend could
auto-merge — and `RUNNING.md` designates this workflow the sole auto-merge gate.

**Fixed 2026-08-10:** `|| true` removed; `--passWithNoTests=false`. Closed first
because every later fix is only as trustworthy as the gate that admits it.

## B7 — admin privilege escalation (M3, `AUTH-`) ✅ CLOSED (build-plan step 13)

`AuthController::register()` sets any email with **no ownership proof**;
`EnsureIsAdmin.php:19-24` trusts that string; `MustVerifyEmail` is commented out
at `User.php:5`.

⇒ Anyone who knows an `ADMIN_EMAILS` address can claim it **before the real admin
registers** and become admin. Live path on a product about to take payments.

*Closes when:* email verification ships and a test asserts an unverified email
cannot pass `EnsureIsAdmin`.

**Fixed 2026-08-10:** `v3/api`'s `User` model implements `MustVerifyEmail` for
real; `EnsureIsAdmin` (`v3/api/app/Http/Middleware/EnsureIsAdmin.php`) now
requires `hasVerifiedEmail()` **and** allowlist membership — an unverified
claim of an `ADMIN_EMAILS` address is refused regardless. Closing test:
`tests/Feature/Auth/AdminAccessTest.php::test_unverified_admin_email_is_forbidden`
(mutation-checked: reverting the `hasVerifiedEmail()` clause turns it red).

## B8 — dead-token wedge ✅ CLOSED (build-plan step 21)

`auth.ts:51-52` — `ensureDevice()` returns early if *any* token exists, and
`clearToken()` is never called on a 401 anywhere in `src/`. A revoked token
permanently disables sync; the only recovery is hand-clearing localStorage.

*Closes when:* a 401 interceptor clears the token and re-mints, proven by a test
that revokes server-side and asserts recovery.

**Partial fix 2026-08-10:** the backend half now exists —
`PasswordResetController::reset()` revokes every one of the user's existing
Sanctum tokens (`$user->tokens()->delete()`) and mints a fresh one in the same
response, so a password reset recovers a wedged device without hand-clearing
storage (`tests/Feature/Auth/PasswordResetTest.php`). **Still open:** the
actual defect is `auth.ts:51-52` in the frontend (`apps/web`), which does not
exist yet — build-plan step 17 (M5). This entry stays open until that
interceptor ships; do not mark B8 closed on this fix alone.

**Closed 2026-08-11 (build-plan step 21).** v3 has no v2-shaped `ensureDevice()`
to repair — `apps/web` contained no `fetch`, no `Bearer` and no token handling at
all — so the defect is **prevented by construction**. `lib/sync/apiFetch.ts` is
the SOLE egress to `/api/*` (clause 6 greps for a second one), and on a 401 it
clears the token FIRST, mints via the unauthenticated `POST /api/auth/anonymous`,
and retries exactly once with the new token.

The wedge is a CONJUNCTION and both halves are broken (v3-D53): `hasLiveToken()`
is "exists AND not marked dead", never "a token string exists". **Mutation testing
found that half inert as first written** — because clearing and marking were the
same action, restoring v2's early-return SURVIVED. Splitting `markTokenDead()`
from `clearToken()` made each half independently observable; both mutations now go
red, including a test that a PRESENT-but-dead token is never ATTACHED to a
request.

Three redundant brakes prevent a re-mint loop (retry-once as a call parameter,
single-flight mint, post-failure cooldown), each with a call-COUNT assertion
rather than a "it terminated" assertion.

Closing tests, both layers: `apps/web/lib/sync/auth.test.ts` (14 tests — asserts
the STORED TOKEN CHANGED and that the retry carried the NEW token, not merely
that a request succeeded) and `v3/api/tests/Feature/Auth/TokenRevocationTest.php`
(6 tests — revokes server-side with `$user->tokens()->delete()` and proves the
real 401, so the client's stub is a faithful model rather than a fiction).
Mutations run and observed RED: remove `clearToken()`, restore v2's early-return,
remove the retry-once brake, remove the single-flight mint, route the mint through
the interceptor, un-authenticate `/events`, replace `insertOrIgnore` with
`insert`, and drop the pull's `user_id` scoping.

## B1 — the `custom` override is a loaded no-op ✅ CLOSED (build-plan step 15)

`Admin.tsx:311` ships a free-text `{prompt, options[], correct}` editor; Laravel
validates `'payload' => ['required','array']` and **nothing inside it**;
`overrides.ts:139` pushes to `customs[]` unresolved; no renderer reads it.

Rows accumulate now and would become learner-visible **retroactively** the moment
anyone builds the renderer. An admin can type Arabic into `correct` today.

*Closes by deletion:* v3 has no `custom` field. `POST` rejects `kind=custom`
forever; existing rows are archived with no serving path.

**Fixed 2026-08-10:** `overrides.ts`'s `OverrideField` union, its `case
"custom"` branch, and `OverrideResolution.customs` are deleted (not
carried through unresolved) — `overrides.test.ts`'s structural test proves
the string `"custom"` no longer appears in `overrides.ts` at all.
`v3/api`'s new `OverridesController::store()` validates `field` against a
closed 4-member set that has never included `custom`, returning 422 —
mutation-tested (re-admitting `custom` to the set turns the closing test
red, confirmed, reverted). No existing rows to archive (v3 is greenfield,
v3-D23) — the "archived with no serving path" half is vacuously satisfied
by there being no `custom` column or serving path ever built.

## B2 — React decides the grading rung (M2) ✅ CLOSED (build-plan step 8)

`Drill.tsx:203` and `Gate.tsx:100`: `const rung: Rung = item.full ? "S3" : "S2"`.
Invariant 6 leaking on the most consequential axis — S3 triggers `scheduleGate()`
and grants `GAIN.s3` (30) versus `s2` (12).

*Closes when:* `gradeClassToWire()` owns the mapping (v3-D11) and JSX is
grep-clean for `rung`.

**Fixed 2026-08-10:** `v3/packages/engine/src/gradeClass.ts` — `GradeClass`
closed set + `gradeClassToWire()` owning the mapping. No v2 UI file was
ported (v3 has no UI yet — M5 is build-plan step 18) and nothing in the
current port constructs a `rung` via a ternary, so the JSX-grep half of the
closing criterion is vacuously true; the substantive half (the function
existing so nothing later has anywhere else to put the decision) is done.
Exact per-value mapping recorded as v3-D26 (DECISIONS.md), explicitly
flagged for re-verification once M4's spec system gives it a real caller.

**Reopened and re-closed 2026-08-13 (v3-D83).** M5's session loop
(`lib/session/run.ts`, build-plan step 18) shipped B2's *exact* ternary —
`rung: adv.full ? "S3" : "S2"` — undetected, because `check-boundaries.mjs`
clause 5 only scanned `app/`/`components/` for named engine functions, never
`lib/`, and had no pattern for a Rung literal; `gradeClassToWire()` had zero
callers anywhere until this fix. Not a live grading bug (the ternary's
values happened to match the real mapping), but the exact "nowhere else for
that decision to live" property the fix was supposed to guarantee did not
hold. Closed for real: all three `rung:` sites in `run.ts` now call
`gradeClassToWire()`; `check-boundaries.mjs` gained **clause 14** (greps
`app/`+`components/`+`lib/` for any literal Rung assigned to `rung:`); a new
`run.test.ts` suite mocks `gradeClassToWire` and proves the WIRING (not just
the value) by asserting every emitted rung reflects the mock's override.
Mutation-verified both ways: reverting one site to the literal turns both
the gate and the test red, on the exact line; reverted byte-identically.

## B3 — `ayah_verifications` has no content hash ✅ CLOSED (build-plan step 15)

Migration is `unique(surah,ayah)` + `verified_by` + `note` + `created_at`. A qari
signs ayah 5, an admin then overrides its gloss, the row still reads verified.
**The GATE-A "verified frontier" metric is lying today.**

*Closes when:* the tiered hash (v3-D13) ships and an override on a verified ayah
flips the frontier amber in a test.

**Fixed 2026-08-10:** two halves, each tested independently.
`corpus-compiler/src/hash.ts` gained `ayahQariHashWithOverrides`/
`ayahAdminHashWithOverrides` — the override IS what changes the hash now
(mutation-tested: a no-op override-application patch turns the closing
test red). `v3/api` gained `corpus_ayah_hashes` (current-state, ingested
from TS via `corpus:ingest-hashes` — Laravel never computes a hash,
v3-D08) + `ayah_verifications` rebuilt APPEND-ONLY (not v2's single-
upserted row, which is exactly how B3 became possible) +
`VerificationsController`'s any-row-matches-current frontier (mutation-
tested: ignoring a hash mismatch turns the closing test red).

**The live wiring is CLOSED (2026-08-12, DECISIONS.md v3-D81).** This gap
described a real limitation as of step 15's original landing, but it no
longer holds: `App\Support\CorpusHashRecomputer` runs SYNCHRONOUSLY inside
`OverridesController::store()` — no queued job, so unlike the fold-runner's
deferred DB adapter (v3-D32) this needed no "running TS-side service" gap
at all. The moment an override is written, its surah's tiered hash table is
recomputed (`corpus-compiler/src/recomputeHashes.ts`, shelled to the same
way `DeterminismCheckCommand` shells to the fold-runner) and re-ingested
through the same `IngestHashesCommand::ingestRows()` a human hand-running
the command also uses. Closing test:
`tests/Feature/Overrides/OverrideHashRecomputeTest.php`'s
`test_b3_closed_end_to_end…` — against the REAL compiled surah-112 corpus, a
verified ayah's frontier flips to `stale` with no command run between the
override POST and the next frontier GET. Mutation-verified: hardcoding the
recompute call to a no-op success turns all 4 of that file's tests red;
reverted.

## B4 — override ties are unordered (M2) ✅ CLOSED (build-plan step 8)

`overrides.ts:117` sorts on `createdAt` alone; ties fall back to DB row order,
and the seeder bulk-inserts rows sharing a millisecond.

**Must land before the first B3 hash row** (H3) — a hash computed under
nondeterministic tie ordering is a nondeterministic hash.

*Closes when:* ordering is `(createdAt, id)` and a same-millisecond fixture is
stable across runs.

**Fixed 2026-08-10:** `applyOverrides` now sorts
`(a.createdAt - b.createdAt) || ((a.id ?? -1) - (b.id ?? -1))`. Proven stable
regardless of input array order (both directions tested) and across 5
repeated runs on a same-millisecond fixture.

## B5 — `mergeFromServer` drops `seq` ✅ CLOSED (build-plan step 21)

`db/eventLog.ts:113` — `const { seq: _drop, ...rest } = e`, so IndexedDB assigns
a fresh local `seq` and **log order becomes arrival order**. Two devices with
byte-identical event sets would order differently.

*Closes when:* merge preserves `deviceSeq` and a two-device test yields identical
folds regardless of arrival order.

**Fixed 2026-08-11:** `apps/web/lib/sync/merge.ts` preserves the wire VERBATIM —
the merged row is `{...wireEvent, syncedAt}` and the module has **no omit list at
all** (v3-D52). `check-boundaries.mjs` clause 7 greps `lib/sync/` for the
destructure-with-omit shape, so B5's literal syntax is now unwritable rather than
merely tested-against (violation probe run: gate exits 1, then 0 once removed).

Closing test: `apps/web/lib/sync/merge.test.ts` — two devices, byte-identical
event sets, 15 seeded arrival orders, asserting BOTH (1) a byte-identical log
order read back through the `by_ts` index and (2) an identical AtomsMap. The fold
uses the **real** rule: the fold-runner's own `canonicalOrder` and the engine's
own `rebuild`, compared key-by-key with the fold-runner's own
`compareAtomCaches` — never a reimplementation.

**The fixture is the test, and mutation testing rewrote it twice.** It carries
(a) ts collisions ACROSS devices, (b) deviceSeq contradicting ts order within a
device, (c) overlapping deviceSeq ranges across devices (#49), and (d) slips
interleaved with successes on the same ayah at colliding ts. Property (d) was
added *because the mutation table caught the suite lying*: with an all-correct
fixture the AtomsMap assertion survived the deviceSeq-dropping mutation, since
`update()` is order-insensitive for a run of correct retrievals sharing a
millisecond. The fold assertion was also re-based onto an INDEPENDENT ORACLE (the
fold of the original fixture in canonical order) rather than mere self-consistency
across shuffles — a merge that damages all interleavings identically passes a
self-consistency check while being genuinely wrong.

Mutations run, all observed RED then reverted byte-identically: drop `deviceSeq`
(B5 verbatim), drop `deviceId`, stamp a synthetic arrival-order `deviceSeq`,
ts-only sort in the canonical read, canonical tuple reordered to
`(ts, deviceSeq, deviceId, uuid)`, and the assertion-removal probe. **Assertions
(1) and (2) are each independently load-bearing** — the ts-only-sort and
tuple-reorder mutations are caught by (1) only, and are the reason (1) is
non-negotiable.

## B6 — string-match grading (M2) ✅ CLOSED (build-plan step 8)

`reconstruct.ts advanceReconstruct` grades with `choice === item.correct` — a
pure string comparison, in the **only graded path in the product**. 26 of 111
Yusuf ayat contain a repeated Arabic surface form (ayah 87 has one word 3
times), so tapping the *wrong* instance still matches and is graded correct.

*Closes when:* grading is surface-equivalence-at-position (v3-D12), proven by a
sweep over all 26 ayat.

**Fixed 2026-08-10:** `v3/packages/engine/src/arabic.ts` —
`normalizeArabicSurface` (NFC + tatweel-strip; harakat kept distinct, so a
wrong vowel-marking still grades wrong) + `surfaceEquals`, used in
`advanceReconstruct` in place of raw `===`. Computed the exact 26/111 Yusuf
ayat with a repeated normalized surface form (matches this entry's own count
exactly) and swept full reconstruct passes across all 26 — every position
grades correct on the legitimate answer and wrong on an unrelated one.

---

## Multi-surah defects

**E-01 — atom key collision (M2, the hard blocker) ✅ CLOSED (build-plan step 7).**
`atomKey(kind, ref)` is `` `${kind}:${ref}` `` and `AtomState` has no `surah` field,
so Yusuf ayah 5 and Al-Mulk ayah 5 are **the same atom**.

Larger than it looks: **five** sites build keys by raw interpolation, and
`scheduler.ts` never imports `atomKey()` at all —

```
engine/src/scheduler.ts:89,119,147
engine/src/floor.ts:33,60
```

A commit that rewrites only `atomKey()` call sites leaves these emitting unkeyed
strings that **silently fail to match**. A lookup miss, not a type error.

Must land **before any second-surah artifact exists anywhere** (H1). Afterwards
the merge is unrepairable: the events survive, but the atoms they produced are
ambiguous.

**Fixed 2026-08-10:** `atomKey`/`initAtom` now take `surah`;
`atomKey(surah, kind, ref) = `` `${surah}:${kind}:${ref}` ``; every call site
across atom/bridge/rebuild/heatmap/scheduler/floor updated, including the five
raw-interpolation sites this entry names — `e01.test.ts` grep-enforces that no
raw `kind:ref`-shaped template literal survives outside `atom.ts`. Golden-log
oracle regenerated (human-approved) to the new key shape; diffed by hand —
every strength/stability/reps value byte-identical, only the key format and a
new `surah` field changed.

| | Defect | Milestone | Status |
|---|---|---|---|
| **E-02** | One budget, N decay curves — `assembleQueue` takes one atoms array | M2 | ✅ CLOSED (step 9) |
| **E-03** | `unlockPermitted()` spans surahs — a pending gate in one blocks learning in another | M2 | ✅ CLOSED (step 9) |
| **E-05** | Pace is per-learner, not per-surah | M2 | Not an engine bug — see note below |
| **E-06** | `planFor()` gives every surah the full daily budget — every ETA lies | M2 | ✅ CLOSED (step 9) |
| **E-07** | Corpus fetch is per-surah and unguarded — N fetches per load, one 404 breaks the page | M1/M5 | Open (M5, no UI yet) |
| **E-08** | Chains can cross a surah boundary; `bridge.ts:14` has no bound check | M2 | ✅ CLOSED (step 5, incidentally) |

**E-02/E-03 fixed 2026-08-10 (build-plan step 9):** `unlockPermitted(atoms,
now, surah, maxPendingGates)` and `extraLearnGrant(atoms, surah, ...)` now
filter to one surah's atoms before counting pending gates — a gate due in a
different surah can no longer block unlock. `assembleQueue` defensively
filters its own atoms to `input.surah` before building anything, so a caller
that hands it atoms from more than one surah can never have them mixed into
one queue. New `multiSurah.ts#splitBudget` divides one total daily-minutes
budget across N surahs by weight — the mechanism that was simply missing
before, which both E-02 and E-06 needed.

**E-06 fixed 2026-08-10:** `planFor()` itself was already correct (it takes
whatever `minutesPerDay` it's given) — the bug was that nothing existed to
compute a surah's FAIR SHARE of the total when more than one is active, so
every caller had no honest option but to pass the full total to each.
`splitBudget()` is that missing mechanism; callers now pass a surah's split
share into `planFor`, never the raw total.

**E-08 closed incidentally at step 5:** `bridge.ts`'s `nextOpening`/
`bridgeItems` (the only code this entry's "`bridge.ts:14` has no bound check"
could refer to) was atticked entirely during the engine port (v3-D25) —
verified never wired into any shipped v2 screen, so it was never ported. The
unguarded call site this defect names does not exist in v3. Its by-construction
closure via `expand()` (seams only for `a..b-1`) is still Site/admit,
build-plan step 11 — but there is nothing left to construct a seam FROM today.

**E-05 — not an engine defect.** `pace.ts`'s `paceConfig`/`candidatesForPace`
are pure, stateless lookups already callable once per surah with zero shared
state between calls — nothing in the engine couples pace to "the learner"
globally. "Pace is per-learner, not per-surah" describes a STORAGE schema
choice (which surah's pace setting persists where) that belongs to the
sync/IndexedDB layer, build-plan M6 — a layer that doesn't exist yet. No
engine change closes this; flagged here so M6's schema design doesn't miss it.

E-08 dies **by construction**: `expand()` emits seams only for `a..b−1`, so the
seam at ayah N is never constructed and the unguarded call has no reachable
input.

---

## PAY-1 — the Stripe replay suite has ZERO fixtures, so M7's exit gate is RED

**Opened:** 2026-08-11, build-plan step 23. **Milestone:** M7.
**Closing test:** `v3/api/tests/Feature/Billing/ReplaySuiteTest.php`
(`test_fixture_set_is_present` + `test_all_orderings_reach_the_same_final_state`),
both currently reporting INCOMPLETE rather than passing.

**What is built and proven:** the entitlement state machine, all four states, the
guarded transitions (optimistic lock + provider-timestamp precedence), the
`unique(provider, provider_event_id)` idempotency index, the `max(tier)` merge,
trial attribution, and the HMAC-SHA256 signature verification — 16 + 7 + 9 tests,
every one mutation-verified.

**What is NOT proven, and cannot be until a human acts:** that Stripe's REAL
payloads carry the field names these handlers read. Every test drives the handlers
with event arrays in the recorded SHAPE, which exercises domain logic correctly but
says nothing about wire-format drift.

**Why it is not closed by writing fixtures now:** hand-written JSON would prove the
handlers parse hand-written JSON. That is the vacuous verification this build has
shipped five times (v3-D38/D45/D49/D50/D53) — and here it would be on the revenue
path. `ReplaySuiteTest` therefore asserts a MINIMUM FIXTURE COUNT before it asserts
any behaviour, so an empty fixture set cannot read as green.

**Unblocked by (human, calendar lead time — start now):**
1. Stripe MY business verification (KYC + bank + tax). BUILD-PLAN says "Stripe
   account from M0", so this is already LATE.
2. FPX + GrabPay per-method activation (edge case #120's lifetime rail).
3. `stripe trigger` recordings vendored into `v3/fixtures/stripe/`, including the
   PARTIAL-refund and DISPUTE-WON shapes, which the default triggers do not emit
   and which are exactly what #115/#116 exist for.

Full instructions: `v3/fixtures/stripe/README.md`.
