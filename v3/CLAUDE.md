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
make test    # 2876 passing (+2 incomplete, 6 skipped [Postgres/pcntl-gated,
             # environment-dependent], PAY-1, by design), typechecks first.
             # 255 v2 vitest + 47 v2/api + 402 v3/api + 120 corpus-compiler
             # + 443 engine + 63 fold-runner + 1546 apps/web. (v3-D251, 2026-09-25)
             # NOTE (v3-D251, 2026-09-25): `lib/session/run.test.ts`'s own
             # "UNTAUGHT ayah" test comment (Door 3 / FR6, added at v3-D117)
             # repeated the EXACT staleness v3-D244 closed nine nights
             # earlier, one file over: it said `coldSuccessAdoption` was
             # "still unwired, out of this run's scope" — false since
             # v3-D118, the very next night, wired it as
             # `adoptionOfferFor`/`acceptAdoption`, real, exported from
             # `run.ts` and called from `SessionIsland.tsx`. v3-D244's own
             # regression test (the `describe("this file's own docblocks do
             # not claim a wired door is unwired")` block, `run.test.ts:999`)
             # scans `run.ts`'s own docblock for exactly this phrasing but
             # never scanned THIS test file's own prose, so the sibling
             # instance sitting 1400 lines further down the very file that
             # guard lives in went unnoticed for nine more nights
             # (v3-D245..D250), each correctly closing "Door 3/adoption" on
             # the strength of the `run.ts` fix alone. Found by a fresh
             # sweep this run for the "test asserts a gap that has since
             # closed" shape (v3-D246/D248 checked the five Playwright e2e
             # specs for this; this run grepped every `.ts`/`.tsx` for
             # stale-staleness phrasing instead) after the usual zero-caller
             # scans (`apps/web/lib/**`, `packages/engine/src`, Laravel
             # model relations/migrations, the Console schedule, the flag
             # registry, and a field-by-field re-audit of
             # `AdminRolesController`, `NightlyWindowController`
             # +`NightlyWindowPanel.tsx`, `EntitlementController`,
             # `EventWireCodec`'s field symmetry, and `Event`'s own
             # `$fillable`/casts against its two newest migrations) all came
             # back genuinely complete or already-known/deferred — grep-
             # confirmed this was the ONE hit anywhere in the tree
             # (`grep -rn "still unwired\|out of this run"` returned exactly
             # this line) before writing any test.
             #
             # Fixed, one file, two hunks, no behavior change — `run.ts`,
             # `SessionIsland.tsx` and every real Door-3/adoption caller
             # were already correct and are byte-identical after this run:
             # the comment is corrected to state the real wiring while
             # keeping its true substantive point (this ONE test proves only
             # the passive half — practicing with no adoption tap teaches
             # nothing); a new permanent regression test is added to
             # v3-D244's own describe block so a recurrence in either file
             # is now caught automatically. The new test reads
             # `run.test.ts`'s own real source text and asserts the stale
             # phrase is absent, then — the biconditional half, mirroring
             # the sibling test exactly — asserts `SessionIsland.tsx` still
             # calls `acceptAdoption`. Its search phrase is built from an
             # array of separate words joined at runtime specifically so the
             # assertion's OWN declaration (which this same test reads,
             # since it scans the file it lives in) can never accidentally
             # satisfy the very pattern it forbids.
             #
             # RED confirmed directly: the new test was added FIRST, with
             # the stale comment left untouched, and run in isolation —
             # failed exactly on `expect(testSrc).not.toContain(staleClaim)`,
             # the real stale text still present. Comment fixed, rerun:
             # 2/2 green in that describe block (was 1, +1); full file
             # 102/102 (was 101, +1). `TZ=UTC make test`: 2876 passing (was
             # 2875, +1 — exactly this run's one new test; apps/web 1546,
             # was 1545; no other suite moved: 255 v2 vitest, 47 v2/api, 402
             # v3/api [2 incomplete/PAY-1 + 6 skipped, both environment-
             # dependent — the 6 skips are all `PerUserFoldLockTest`/
             # `PerUserFoldLockWiringTest` cases gated on an unreachable
             # Postgres connection in this sandbox, v3-D116's own documented
             # no-op-outside-Postgres design; `DeterminismCheckCommandTest`/
             # `DeterminismP1PagerTest` did NOT skip, since `worker/fold-
             # runner` was genuinely installed by this run's own `make
             # setup`], 120 corpus-compiler, 443 engine, 63 fold-runner),
             # exit 0. `check-test-floor.mjs`: OK, 2876 >= floor 1899 (+977
             # margin, unmoved). `TZ=UTC make build`: exit 0, 30 routes,
             # unchanged (a test-file-only change). `npm run gates`: all
             # green — locked-css OK, 1 documented hunk, 294 v1 lines byte-
             # identical; boundaries OK, 323 files, up from 322 in this
             # run's own baseline — confirmed the same pre-existing
             # gitignored `next-env.d.ts` bootstrap-artifact fluctuation
             # v3-D206/D227/D231/D236/D239 each already recorded via `git
             # status --porcelain --ignored`, not a new production file;
             # fonts degraded-but-non-blocking, pre-existing, 2/6 UI fonts
             # present; corpus-morphology OK, 362 words; corpus-glyphs OK,
             # 206 codepoints across 4 artifacts — all unchanged, no corpus
             # data in this diff. `npx tsc --noEmit`: clean. No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff reverted before committing). No Arabic
             # codepoint (the one changed file swept programmatically, in
             # Python, over the Arabic, Arabic Supplement, Arabic
             # Extended-A and both Presentation Forms Unicode blocks, plus a
             # `\u06xx`/`\u07xx`/`\u08xx`/`\uFBxx`/`\uFExx` escape and
             # `fromCharCode`/`fromCodePoint` sweep: CLEAN — every new
             # string is a TypeScript identifier, a comment sentence, or the
             # closed-set array-of-words the assertion builds its search
             # phrase from, never corpus text). No oracle/golden-log/
             # fixture/snapshot regenerated.
             #
             # Session start: fresh container, `make setup` ran clean from
             # scratch. `HEAD`/local `main` were stale (`fcfe765`, 21
             # commits behind) versus `origin/main`'s real tip (`db2b03c`,
             # v3-D250) — caught before any exploration via `git fetch
             # origin main` + `git ls-remote origin main`, then `git
             # checkout main && git merge --ff-only origin/main`, a clean
             # fast-forward, no work lost or at risk — the same recurring
             # stale-local-`main` trap this file has recorded roughly fifty
             # times since v3-D77.
             #
             # NOT addressed: every item on v3-D250's own "NOT addressed"
             # list, unchanged — "replan"/"makeup"; `DrillPicker.tsx`'s own
             # unused `now` prop; the unused `atoms`/`corpus`/`sessions`
             # IndexedDB object stores (v3-D232); `session_start`'s own
             # latency metric (v0.8); the streak/away-day day-space mismatch
             # (v3-D209); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()`; `App\Billing\TrialAttribution`
             # (v3-D148); `lib/pricing.ts#regionFromCountry()` (v3-D163);
             # `PaywallGate` as a whole class (v3-D88, v3-D151, v3-D219);
             # `App\Flags\FlagService::enabled()` (v3-D197); multi-surah
             # enrollment; the operational mailer/7-night launch window;
             # PAY-1's Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`;
             # `MacroFacts.litany.rhymeLabel` (v3-D188); `corpusHash`'s zero
             # fold-side consumer (v3-D206); `selection_determinism_check`
             # still replaying a committed fixture — all unchanged.
             # `run.test.ts`'s own stale adoption comment is now CLOSED and
             # permanently guarded — remove it from future "docblock says X,
             # reality is Y" sweeps. See DECISIONS.md v3-D251.
             # NOTE (v3-D250, 2026-09-25): `packages/engine/src/capacity.ts
             # #planFor()`'s own `habitProtocol` field (FR10's first-week
             # ramp: "underloaded: true, secondThreadFromDay: 3") had zero
             # production readers anywhere — `apps/web/lib/plan/forecast.ts
             # #buildForecast()`, the ONE real caller of `planFor()` on the
             # already-shipped `/plan` route, read only `plan.etaDays`, never
             # `plan.habitProtocol`, despite WIREFRAME.md §14's own explicit
             # instruction: "The forecast must reflect that deliberate ramp,
             # or week 1 will always look 'behind.'" `forecast.ts` had no test
             # file at all before this run. Fixed: `capacity.ts` gains
             # `etaDaysWithRamp(plan)` — days 1-indexed, capacity capped at
             # `min(ayahPerDay, 1)` before `secondThreadFromDay`, full rate
             # after — a no-op for the common `ayahPerDay===1` case, verified
             # directly; `planFor()`'s own `etaDays` is untouched.
             # `buildForecast()` now folds `etaDaysWithRamp(plan)` into its
             # per-surah max instead of `plan.etaDays`. RED confirmed at both
             # layers before implementing: `capacity.test.ts`'s 4 new cases
             # failed on `etaDaysWithRamp is not a function`; the new
             # `forecast.test.ts` (3 cases) proves the ramp genuinely
             # delays the ETA for a higher-capacity fixture (`ceil(20/7)=3`
             # un-ramped vs `5` ramped) and leaves the common single-thread
             # case untouched. `TZ=UTC make test`: 2875 passing (was 2868,
             # +7 — exactly this run's new tests: 4 engine + 3 apps/web; no
             # other suite moved). `check-test-floor.mjs`: OK, 2875 >= floor
             # 1899 (+976 margin, unmoved). `TZ=UTC make build`: exit 0, 30
             # routes, unchanged. `npm run gates`: all green — locked-css OK,
             # 1 documented hunk, 294 v1 lines byte-identical; boundaries OK,
             # 322 files, unchanged count; fonts degraded-but-non-blocking,
             # pre-existing, 2/6 UI fonts present; corpus-morphology OK, 362
             # words; corpus-glyphs OK, 206 codepoints across 4 artifacts —
             # all unchanged. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted before
             # committing). No Arabic codepoint (all four changed/new files
             # swept programmatically, in Python, over the Arabic, Arabic
             # Supplement, Arabic Extended-A and both Presentation Forms
             # Unicode blocks, plus a `\u06xx`/`\u07xx`/`\u08xx`/`\uFBxx`/
             # `\uFExx` escape and `fromCharCode`/`fromCodePoint` sweep:
             # CLEAN). No oracle/golden-log/fixture/snapshot regenerated.
             # Session start: fresh container, `make setup` ran clean from
             # scratch (both `v2/api`'s and `v3/api`'s `composer install`
             # hit the documented transient git-mirror-clone timeout and
             # recovered on the same invocation, no retry flag needed).
             # `HEAD` was detached exactly at `origin/main`'s own tip
             # (`0b6deb7`, v3-D249) — no stale-local-`main` trap this run.
             # Found by a dedicated fresh-sweep agent (Explore) directed at
             # CROSS-PACKAGE callers (a `packages/engine` export consumed
             # only from `apps/web`, or vice versa) rather than the
             # by-now-heavily-mined `apps/web/lib/**`-only territory —
             # independently re-verified directly against `capacity.ts`,
             # `forecast.ts` and WIREFRAME.md §14 (plus the underlying
             # `v3-wireframe.excalidraw`/`gen-wireframe.mjs` source, which
             # states the identical requirement in its own generated
             # sticky-note text) before writing any test. NOT addressed:
             # every item on v3-D249's own "NOT addressed" list, unchanged —
             # "replan"/"makeup"; `DrillPicker.tsx`'s own unused `now` prop;
             # the unused `atoms`/`corpus`/`sessions` IndexedDB object
             # stores (v3-D232); `session_start`'s own "app-open → first
             # drill" latency metric (v0.8); the streak/away-day day-space
             # mismatch (v3-D209); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()`; `App\Billing\TrialAttribution`
             # (v3-D148); `lib/pricing.ts#regionFromCountry()` (v3-D163);
             # `PaywallGate` as a whole class (v3-D88, v3-D151, v3-D219);
             # `App\Flags\FlagService::enabled()` (v3-D197); multi-surah
             # enrollment; the operational mailer/7-night launch window;
             # PAY-1's Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`;
             # `MacroFacts.litany.rhymeLabel` (v3-D188); `corpusHash`'s zero
             # fold-side consumer (v3-D206); `selection_determinism_check`
             # still replaying a committed fixture — all unchanged.
             # `planFor()`'s own `habitProtocol` is now CLOSED for `/plan`'s
             # forecast — remove it from future "no reader" sweeps. See
             # DECISIONS.md v3-D250.
             # NOTE (v3-D249, 2026-09-24): `lib/test/build.ts`/`TestIsland.tsx`'s
             # `test_*` events carried no site coordinate at all — v3-D229's own
             # deferred gap, left open through nineteen consecutive nights'
             # "NOT addressed" lists (v3-D230..D248) with the exact reason it
             # wasn't a one-line fix: `siteKey` alone is safe to stamp, but its
             # sibling `visitOrdinal` is not, since a Test item is never chosen by
             # `selection.ts#selectFor`'s rotation (`lib/test/build.ts`'s own
             # header: Test item SELECTION is a real `Math.random`, unlike a
             # graded visit's seeded rotation) — stamping a `visitOrdinal` would
             # falsely claim `replaySelection`'s per-site ordinal namespace
             # decided something for a "visit" nothing decided anything for.
             #
             # Fixed the safe half: `lib/test/build.ts` gains `itemSite(surah,
             # item)`/`itemSiteKey(surah, item)` — a junction item's site is the
             # SEAM at its own `from` (mirroring `lib/session/run.ts
             # #siteForItem`'s own `connection -> seam` mapping exactly), a
             # reorder item's site is the AYAH site at its own first ayah
             # (`itemAyah`'s own coordinate), every other kind its own `ayah`.
             # `TestIsland.tsx#recordAnswer` stamps `siteKey` on `test_answer`
             # ONLY — `test_start`/`test_result` stay without one, the same
             # "spans the whole activity, not one served question" shape
             # `session_start` already has no `siteKey` for. No `visitOrdinal`
             # added anywhere, on purpose — the reasoning above is structural,
             # not a scoping choice a future night could simply widen.
             #
             # RED confirmed directly: `git stash` of the two production files
             # alone (4 new `lib/test/build.test.ts` cases + 1 new `test/
             # test-island.test.tsx` case kept, 29 other pre-existing cases
             # untouched) failed exactly the 4 new cases on `itemSite`/
             # `itemSiteKey is not a function`, and the new component case on
             # `expected undefined to be '112:ayah:4'` — a real `test_answer`
             # event's own `siteKey` genuinely absent against the unmodified
             # component. One test needed a real fix along the way: the first
             # draft's junction unit test reused this file's own pre-existing
             # 2-ayah pool (the same one the pre-existing `itemAyah` test
             # silently tolerates finding no junction in), which never reaches
             # `KIND_ORDER`'s junction slot (index 2) at all — caught by using a
             # hard `throw` instead of that test's own silent skip, fixed by
             # widening to a 3-ayah pool that genuinely reaches it. Restored
             # byte-identically, reran: `lib/test/build.test.ts` 26/26 (was 22,
             # +4), `test/test-island.test.tsx` 8/8 (was 7, +1).
             #
             # `TZ=UTC make test`: 2868 passing (was 2863, +5 — exactly this
             # run's new tests; apps/web 1542, was 1537; no other suite moved:
             # 255 v2 vitest, 47 v2/api, 402 v3/api [2 incomplete/PAY-1 + 6
             # skipped, both environment-dependent], 120 corpus-compiler, 439
             # engine, 63 fold-runner), exit 0. `check-test-floor.mjs`: OK, 2868
             # >= floor 1899 (+969 margin, unmoved). `TZ=UTC make build`: exit 0,
             # 30 routes, unchanged (no route added). `npm run gates`: all green
             # (locked-css OK, 1 documented hunk, 294 v1 lines byte-identical;
             # boundaries OK, 321 files, unchanged count; fonts degraded-but-
             # non-blocking, pre-existing, 2/6 UI fonts present; corpus-
             # morphology OK, 362 words; corpus-glyphs OK, 206 codepoints across
             # 4 artifacts — all unchanged, no new corpus data). `npx tsc
             # --noEmit`: clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted before
             # committing). No Arabic codepoint (the full diff of all four
             # changed files swept programmatically, in Python, over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks, plus a `\u06xx`/`\u07xx`/
             # `\u08xx`/`\uFBxx`/`\uFExx` escape and `fromCharCode`/
             # `fromCodePoint` sweep: CLEAN). No oracle/golden-log/fixture/
             # snapshot regenerated.
             #
             # Session start: fresh container, no `node_modules`/`vendor`/
             # compiled corpus anywhere. `HEAD`/local `main`/`origin/main` did
             # NOT already agree: local `main` sat 19 commits behind at
             # `fcfe765` — the recurring stale-local-`main` trap this file has
             # recorded roughly fifty times since v3-D77 — caught before any
             # exploration via `git fetch origin main` + `git checkout main &&
             # git merge --ff-only origin/main`, a clean fast-forward, no work
             # lost or at risk. `make setup`'s two `composer install` calls both
             # hit the documented transient proxy/git-mirror timeout and
             # recovered on the same invocation, after the four PHP-independent
             # `npm install`s (`packages/engine`, `apps/web`, `packages/
             # corpus-compiler`, `worker/fold-runner`, plus `v2`'s own) ran
             # directly and successfully in parallel, the same recovery this
             # file's history has recorded roughly a dozen times before.
             #
             # NOT addressed: every item on v3-D248's own "NOT addressed" list
             # except this one — "replan"/"makeup"; `DrillPicker.tsx`'s own
             # unused `now` prop; the unused `atoms`/`corpus`/`sessions`
             # IndexedDB object stores (v3-D232); `session_start`'s own latency
             # metric (v0.8); the streak/away-day day-space mismatch (v3-D209);
             # `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`;
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate` as
             # a whole class (v3-D88, v3-D151, v3-D219);
             # `App\Flags\FlagService::enabled()` (v3-D197); multi-surah
             # enrollment; the operational mailer/7-night launch window; PAY-1's
             # Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift (v3-D127);
             # `packages/engine/src/placement.ts`; `MacroFacts.litany.rhymeLabel`
             # (v3-D188); `corpusHash`'s zero fold-side consumer (v3-D206);
             # `selection_determinism_check` still replaying a committed
             # fixture — all unchanged. `lib/test/build.ts`/`TestIsland.tsx`'s
             # own site-coordinate gap is now CLOSED for `siteKey` — remove it
             # from future sweeps; `visitOrdinal` was never added, deliberately,
             # and should not be re-attempted without a genuinely new argument
             # for why it would be safe. See DECISIONS.md v3-D249.
             # NOTE (v3-D248, 2026-09-24): fourth empty sweep for the zero-caller/
             # stale-docblock/wire-field-completeness bug class this file has
             # chased since v3-D82, run fresh rather than trusting v3-D246's own
             # "genuinely exhausted" verdict. Four veins, all previously
             # unswept in this exact combination, all came back clean:
             #
             # (1) A programmatic zero-caller sweep of every `export function`/
             # `export const`/`export class` in `apps/web/lib/**` (278 exports,
             # Python regex + `grep -rl` cross-check against `app/`+`components/`+
             # `lib/`+`test/`+`e2e/`, excluding the defining file). 26 candidates
             # surfaced; every one resolved to either an in-file-only helper (a
             # false positive of the method, not a real gap — e.g.
             # `STATUS_UNAVAILABLE`, `halfMonthLabel`, `CONNECTION_WEIGHT`,
             # `SESSION_HREF`, `clientCorpusUrl`, `LOCALES`/`DEFAULT_LOCALE`, each
             # verified by hand to have a real same-file caller) or an
             # already-named, already-excluded deferral (`regionFromCountry`,
             # `isLocale`).
             #
             # (2) A parallel sweep of every `public function` in `api/app/**`
             # (90 methods, same technique). 5 candidates, all already-known:
             # `AccountDeletionRequest::isDue()` (v3-D146, deliberately left —
             # the query-level check it duplicates is not misleading);
             # `User::routeNotificationForMail()` (a Laravel `Notifiable` trait
             # hook, called by the framework's own mail pipeline, never by
             # application code — a false positive of the grep method itself);
             # `AtomCacheRebuilder::rebuildUsers()` (a same-file false
             # positive — `rebuild()` calls it two lines below the excluded
             # defining-file boundary); `TrialAttribution::firstChosenSurahStart()`/
             # `::sourceOf()` (blocked on M7's still-unbuilt checkout flow,
             # unchanged since v3-D148).
             #
             # (3) A full line-by-line re-read of all FIVE Playwright e2e specs
             # (`first-session.test.ts`, `airplane-mode.test.ts`, `commit-
             # before-paint.test.ts`, `a11y-geometry.test.ts`, `idb-
             # helpers.test.ts`) for the "asserts a gap that has since closed"
             # shape v3-D245/D246 each flagged as only partially checked. All
             # five read current against the real shipped behavior (the
             # service worker, the session loop, the seven-screen onboarding
             # walk, the FR5 re-entry wiring) — no stale tripwire, no assertion
             # describing a gap that has since closed.
             #
             # (4) Field-by-field wire-completeness re-audits of three admin
             # panels not recently checked this way: `ContentFreezePanel.tsx`
             # (re-confirmed `FreezeReport.allMet` is v3-D194's own already-
             # excluded case — `ContentFreezeController::index()` literally
             # sets `'bookable' => $allMet`, so the two fields can never
             # disagree, verified by reading the controller source directly
             # rather than trusting the old note); `FlagsPanel.tsx` (all ten
             # `FlagController::index()` fields — key/description/enabled/
             # version/killedAt/killedBy/bannerVisible/ackAt/ackBy/
             # ackAutoWaived — render); `AdminRolesPanel.tsx` (all four
             # `AdminRolesController::index()` entry fields plus `limit`
             # render).
             #
             # ONE GENUINE ASYMMETRY FOUND, NOT FIXED, AND THE REASONING FOR
             # NOT FIXING IT RECORDED SO A FUTURE RUN DOESN'T RE-DISCOVER IT AS
             # A GAP: `EventWireCodec::toWire()`'s `$optional` array forwards
             # `resume` (the interruption event's resumePolicy classification)
             # to the fold-runner-bound wire payload but not its sibling
             # `resumeMassed` (added three commits later, v3-D218, same "for
             # interruption events only, v0.6 metric" docblock shape as
             # `resume` itself). Checked directly rather than assumed: BOTH
             # fields are dead weight to every consumer of that payload —
             # `packages/engine/src/rebuild.ts` has no `e.type === "interruption"`
             # branch at all (grepped every `type ===` check in the file: tap/
             # reconstruct_tap, rung_complete/ayah_produced, gate_result,
             # gate_demote, connection_born, junction_result, chain_step —
             # interruption is not among them, confirming invariant #5's
             # structural-absence discipline holds for this event type too),
             # and the wire payload's only two callers
             # (`DeterminismCheckCommand::sampleFromDatabase()`,
             # `AtomCacheRebuilder::rebuildUsers()`) both pipe it straight into
             # the Node fold-runner's `rebuild()` and nothing else. So there is
             # no observable behavior either field's presence or absence could
             # change, and therefore no RED any fix could demonstrate — the
             # bar every fix in this file has held itself to since v3-D82.
             # Recorded as a genuine, harmless inconsistency rather than
             # silently left for a future sweep to re-find and mistake for a
             # live gap.
             #
             # `v3/LAUNCH-CHECKLIST.md` re-read in full, "The critical path out
             # of here" section re-verified line by line against the current
             # repo state: unchanged since v3-D246 — one infrastructure gap
             # (staging host, cascading into the mailer/purge-schedule/7-night
             # window), two human recruitments (Stripe MY, the qari + Malay
             # reviewer), and the content freeze's own human half (surah 67's
             # scene beats). No item on that list is a code change.
             #
             # Session start: fresh container, no `node_modules`/`vendor`/
             # compiled corpus anywhere. `make setup`'s two `composer install`
             # calls (`v2/api`, `v3/api`) both hit the documented transient
             # proxy/git-mirror-clone timeout on `laravel/pint` (`v2/api`) and
             # completed clean on read-through with `COMPOSER_PROCESS_TIMEOUT=900`
             # (both, no code change) after the five PHP-independent `npm
             # install`s (v2, corpus-compiler, engine, fold-runner, apps/web)
             # ran directly and successfully in parallel — the same recovery
             # this file's history has recorded roughly a dozen times before.
             # `HEAD`/local `main`/`origin/main` all already agreed at
             # `559fc8e` (v3-D247) — no stale-local-`main` trap this run,
             # confirmed via `git fetch origin main` before any exploration.
             # `TZ=UTC make compile-corpus`: all four launch surahs PASS, no
             # hard failures. `TZ=UTC make test`: 2863 passing (255 v2 vitest +
             # 47 v2/api + 402 v3/api [2 incomplete/PAY-1 + 6
             # Postgres/pcntl-gated skips, both environment-dependent and
             # unrelated to this run — re-running `DeterminismCheckCommandTest`/
             # `DeterminismP1PagerTest` individually with `--filter` shows both
             # green in full, 25 tests, once the fold-runner install those
             # particular two files check for had settled; the 6 skipped in
             # the full-suite run are the Postgres-only `PerUserFoldLockTest`/
             # `PerUserFoldLockWiringTest` cases, v3-D116's own documented
             # no-op-outside-Postgres design] + 120 corpus-compiler + 439
             # engine + 63 fold-runner + 1537 apps/web), exit 0.
             # `check-test-floor.mjs`: OK, 2863 >= floor 1899 (+964 margin,
             # unmoved, same discipline as every prior entry). `TZ=UTC make
             # build`: exit 0, 30 routes, unchanged. `npm run gates` (via
             # `prebuild`): all green — locked-css OK, 1 documented hunk, 294
             # v1 lines byte-identical; boundaries OK, 321 files; fonts
             # degraded-but-non-blocking, pre-existing, 2/6 UI fonts present;
             # corpus-morphology OK, 362 words; corpus-glyphs OK, 206
             # codepoints across 4 artifacts — all unchanged from v3-D247's
             # own recorded numbers. No file touched (`git status --porcelain`
             # empty throughout this run's investigation). No `v1/**`/`v2/**`
             # edit. No Arabic codepoint (nothing written).
             #
             # NOT addressed, unchanged: everything on v3-D247's own list —
             # "replan"/"makeup"; `DrillPicker.tsx`'s unused `now` prop; the
             # unused `atoms`/`corpus`/`sessions` IndexedDB object stores
             # (v3-D232); `session_start`'s own latency metric (v0.8); the
             # streak/away-day day-space mismatch (v3-D209); `rhymeClassOf()`
             # (v3-D136); `EntitlementMachine::merge()`;
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate`
             # as a whole class (v3-D88, v3-D151, v3-D219);
             # `App\Flags\FlagService::enabled()` (v3-D197); multi-surah
             # enrollment; the operational mailer/7-night launch window;
             # PAY-1's Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`;
             # `MacroFacts.litany.rhymeLabel` (v3-D188); `corpusHash`'s zero
             # fold-side consumer (v3-D206); `selection_determinism_check`
             # still replaying a committed fixture;
             # `lib/test/build.ts`/`TestIsland.tsx`'s `test_*` events still
             # carrying no SITE coordinate (v3-D229); the harmless
             # `EventWireCodec::toWire()` `resume`/`resumeMassed` asymmetry
             # named above (now closed for future sweeps — recorded, not a
             # live gap) — all unchanged. A future run should not expect
             # another same-shaped finding from a fifth generic sweep without
             # either a genuinely fresh corner or a willingness to take on one
             # of the larger, already-named architectural items. See
             # DECISIONS.md v3-D248.
             # NOTE (v3-D247, 2026-09-24): FR5 "restart" — resume.ts's own
             # contract for a <1hr re-entry gap is literal: "restart the current
             # drill." `acknowledgeReentry` (wired v3-D217) only ever committed
             # the audit `interruption` event and refreshed `lastActivityAt`;
             # `run.machine` was never touched, so a learner who stepped away
             # mid-reconstruct and came back within the hour still saw their
             # half-finished blanks exactly as they left them — indistinguishable
             # from the ordinary <2min "resume" case, even though the same
             # screen's own notice ("that pause won't count toward your time on
             # task") implies something DID reset. Named explicitly on every
             # "NOT addressed" list since v3-D217.
             #
             # Ran a fresh migration-column-vs-model-cast audit FIRST (v3-D246's
             # own named fresh corner): read all 21 `v3/api` migrations against
             # all 20 Eloquent models field by field — every `$fillable` matches
             # its migration exactly, every boolean/JSON/enum column has the
             # matching cast. One real hypothesis surfaced (`Event`'s un-cast
             # bigint/integer columns returning as PHP strings under Postgres,
             # breaking the wire contract's `number` fields) and was checked
             # EMPIRICALLY against a real Postgres 16 instance rather than
             # assumed: PHP 8.4.19 (this project's own pinned CI version,
             # v3-D119) already returns bigint/integer/smallint/boolean/float
             # natively via the PDO_PGSQL native-type RFC — only `numeric`
             # columns (none in this schema) still stringify. A real concern for
             # pre-8.4 PHP, verified false for this stack; no code changed for
             # this half. Came back genuinely clean otherwise.
             #
             # Fixed: `SessionRun` gains `freshMachine` — the reconstruct
             # machine exactly as it stood the moment the CURRENT queue item
             # became current, before any tap. Refreshed at the six sites that
             # already build a fresh machine for a genuinely new item
             # (`startFromQueue`, `settleAnswer`'s cursor-advance branch,
             # `advancePastCurrent`, `settleRescaffoldWarmup`'s warm-up→cold
             # transition, `startExtraLearn`, `startWeakSpotDrill`), never
             # touched by a mid-item tap. `acknowledgeReentry`'s "restart"
             # branch resets `machine`/`rescaffolding` to that snapshot and
             # clears `gateSlipped`/`lastTap` — nothing re-derived from the
             # corpus/atoms, which would risk racing the very gap being
             # classified. Scoped to "restart" only (this file's own "one door
             # at a time" precedent) — "replan"/"makeup" remain genuinely
             # separate, larger scope, unchanged.
             #
             # RED confirmed directly: `git stash` of `run.ts` alone (all three
             # new `run.test.ts` cases + ten pre-existing bare-literal
             # `SessionRun` fixtures across `run.test.ts`/`session-
             # island.test.tsx` that needed `freshMachine` added — a genuine
             # TS compile-time catch, same shape as v3-D227's `siteVisit` —
             # kept) failed 2 of 3 new cases exactly as predicted (a
             # partially-tapped 4-word gate item's `machine` failed to reset;
             # an out-of-order "earlier item" check failed identically); the
             # third, a negative "replan is untouched" case, passed vacuously
             # and correctly. Restored byte-identically, reran: 3/3 green (was
             # 0, +3; `run.test.ts` 101/101, was 98).
             #
             # `TZ=UTC npx vitest run` (apps/web): 1537 passing (was 1534, +3).
             # `TZ=UTC make test` (fresh container, `make setup` + `make
             # compile-corpus` from scratch, no retries needed): 2867 passing —
             # 255 v2 vitest + 47 v2/api + 406 v3/api + 120 corpus-compiler +
             # 439 engine + 63 fold-runner + 1537 apps/web; every suite but
             # apps/web untouched by this diff (no PHP/engine/corpus-compiler/
             # fold-runner file changed) — v3/api's own 406 reads four higher
             # than this file's own 402 last recorded (v3-D245), a pre-existing
             # drift already present at session start from the 17 commits
             # (v3-D230…D246) fast-forwarded in, not introduced by this run.
             # `check-test-floor.mjs`: OK, 2867 >= floor 1899 (+968 margin,
             # unmoved). `TZ=UTC make build`: exit 0, 30 routes, unchanged. `npx
             # tsc --noEmit` (apps/web): clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted before
             # committing). No Arabic codepoint (the full diff of all three
             # changed files swept programmatically, in Python, over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks, plus a `fromCharCode`/
             # `fromCodePoint` and `\u06xx`/`\u07xx`/`\u08xx`/`\uFBxx`/`\uFExx`
             # escape sweep: CLEAN). No oracle/golden-log/fixture/snapshot
             # regenerated.
             #
             # Session start: fresh container, `HEAD` and local `main` both
             # already agreed with `origin/main` at `0c45b58` (v3-D246) via a
             # clean `git fetch` + `git checkout main && git merge --ff-only
             # origin/main` fast-forward — the recurring stale-local-`main`
             # trap this file has recorded roughly fifty times since v3-D77,
             # caught immediately with zero work at risk (the prior 17 commits
             # had already been pushed; only the local branch ref was stale).
             #
             # NOT addressed: "replan"/"makeup" (this entry's own scope
             # boundary); `DrillPicker.tsx`'s own unused `now` prop; the unused
             # `atoms`/`corpus`/`sessions` IndexedDB object stores (v3-D232);
             # `session_start`'s own latency metric (v0.8); the streak/away-day
             # day-space mismatch (v3-D209); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()`; `App\Billing\TrialAttribution`
             # (v3-D148); `lib/pricing.ts#regionFromCountry()` (v3-D163);
             # `PaywallGate` as a whole class (v3-D88/D151/D219);
             # `App\Flags\FlagService::enabled()` (v3-D197); multi-surah
             # enrollment; the operational mailer/7-night window; PAY-1's
             # Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift (v3-D127);
             # `packages/engine/src/placement.ts`; `MacroFacts.litany.rhymeLabel`
             # (v3-D188); `corpusHash`'s zero fold-side consumer (v3-D206);
             # `selection_determinism_check` still replaying a committed
             # fixture; `lib/test/build.ts`/`TestIsland.tsx`'s `test_*` events
             # still carrying no SITE coordinate (v3-D229) — all unchanged. See
             # DECISIONS.md v3-D247.
             # NOTE (v3-D246, 2026-09-24): third empty sweep for the "computed/
             # shipped, zero reader / stale docblock / drifted duplicate" bug
             # class — after v3-D196/D197's own empty sweeps, then 48 further
             # nights (v3-D198…D245) that each found a genuine new instance,
             # this run's fresh, independent sweep across
             # `worker/fold-runner/src`, `packages/corpus-compiler/src`,
             # `api/app/Console/Commands`, every optional field on
             # `packages/engine/src/types.ts`'s `Corpus`/`DrillEvent` family,
             # every component `*Props` interface, a cross-file cost/logic
             # drift check, every PHP public method in `app/Models`/
             # `app/Billing`/`app/Flags`/`app/Support`, a stale-docblock grep,
             # three admin panel wire-field-to-render completeness checks,
             # v3-D245's own fix, and the Playwright e2e specs (checked
             # directly for the "asserts a gap that has since closed" shape a
             # prior HANDOVER.md note warned about — both current, neither
             # stale) came back genuinely empty. `v3/LAUNCH-CHECKLIST.md`
             # re-read in full: its own "critical path out of here" section
             # states, and this run independently confirms, that every gate
             # engineering can close is closed — every remaining item is
             # BLOCKED-ON-HUMAN or BLOCKED-ON-INFRA by its own honest
             # labelling. `TZ=UTC make test`: 2860 passing, matching this
             # file's own recorded count exactly, no drift in any suite.
             # `check-test-floor.mjs`: OK, 2860 >= floor 1899 (+961 margin,
             # unmoved). `TZ=UTC make build`: exit 0, 30 routes, unchanged. No
             # file touched (`git status --porcelain` empty throughout). No
             # `v1/**`/`v2/**` edit. No Arabic codepoint (nothing written).
             # Session start: fresh container, `make setup` ran clean from
             # scratch; `HEAD` was found on a stale LOCAL `main` branch ref
             # sixteen commits behind (`fcfe765`, v3-D229) — the recurring
             # stale-local-`main` trap this file has recorded roughly fifty
             # times since v3-D77 — caught before any exploration via `git
             # fetch origin main` + `git checkout main && git merge --ff-only
             # origin/main`, a clean fast-forward, no work lost or at risk.
             # Documentation-only; test/build numbers unchanged. A future run
             # should not spend a full night on another generic sweep without
             # either a genuinely fresh corner (not yet done: a byte-for-byte
             # migration-column-vs-model-cast audit, a full line-by-line pass
             # over every e2e spec beyond the two checked here) or a
             # willingness to take on one of the larger, already-named
             # architectural items (`PaywallGate`, `EntitlementMachine::merge()`,
             # multi-surah enrollment, `rhymeClassOf()`, FR5's queue-level
             # behavior). See DECISIONS.md v3-D246.
             # NOTE (v3-D245, 2026-09-23): v3-D24 ("QAC `lemma`/`root`/`class` are
             # BUILD-TIME ONLY... stripped from the learner artifact") was only ever
             # implemented for the CLIENT-FETCH path
             # (`stage-corpus.mjs#stripMorphology`, enforced by
             # `check-corpus-morphology.mjs`, gate 18) — that gate's own header says
             # plainly it "reads the artifacts that are ACTUALLY IN `public/`."
             # `lib/corpus/load.ts` (`loadCorpus`/`loadEffectiveCorpus`, v3-D76) is a
             # SEPARATE SSR read path behind `/plan`, `/progress`, `/progress/list`,
             # `/surah/[surah]`, `/surah/[surah]/[ayah]`, `/drill`, `/practice` and
             # `/workbench`, and it served the raw compiled corpus — morphology
             # intact — straight into a `"use client"` island's own props on every
             # one of those routes. Next.js serializes a client component's props
             # into the page's own RSC payload WHOLE regardless of which fields the
             # component reads, so the GPL-licensed QAC morphological analysis
             # (Kais Dukes' copyrighted work) was reaching any browser that loaded
             # one of seven routes, entirely outside the one gate built to stop it.
             # Confirmed LIVE, not assumed: a real `next build` + `next start` +
             # `curl /plan`/`curl /drill` on the unfixed tree reproduced the real,
             # non-null QAC values verbatim in the served HTML.
             #
             # Fixed: one `stripMorphology()` in `lib/corpus/load.ts`, applied
             # inside `loadCorpus()` before caching, so `loadEffectiveCorpus()` and
             # all seven callers get it with no other call site touched — nulls
             # `lemma`/`root`/`class` (both already nullable on `CorpusWord`, so no
             # downstream type change) rather than deleting the keys.
             #
             # RED confirmed directly: a new describe block in
             # `test/corpus-load.test.ts` first proves the RAW compiled artifact
             # genuinely carries non-null `root` values (non-vacuous), then asserts
             # `loadCorpus()` returns null morphology on every word of all four
             # launch surahs, then asserts every OTHER field is untouched. Against
             # the unmodified `load.ts`, all four per-surah cases failed exactly as
             # predicted, printing the real leaked QAC value on failure (not
             # reproduced in this comment — same no-literal-Arabic principle the fix
             # itself enforces). The file's own pre-existing "byte-identical to the
             # compiled artifact" test was updated, not weakened: it now compares
             # against a copy of the raw file with the same three fields nulled, so
             # it still proves nothing ELSE about `loadCorpus`'s output drifted.
             # Reran: `corpus-load.test.ts` 14/14 (was 8, +6).
             #
             # A real mistake caught before committing: this fix's own first-draft
             # docblock quoted the two leaked Arabic strings verbatim as evidence —
             # exactly the Absolute B violation the fix exists to prevent, one level
             # up. `npm run gates`' own boundaries clause 4 caught it immediately
             # (`lib/corpus/load.ts:79: literal Arabic codepoint`); reworded to
             # describe the leak without quoting it, reran clean.
             #
             # Re-verified live after the final fix: a fresh `next build` + `next
             # start`, `curl /plan`, `curl /drill` and `curl /surah/12` all now show
             # nulled morphology in the served HTML — holds across every affected
             # route, not only the two originally reproduced. `TZ=UTC make test`:
             # 2860 passing (was 2854, +6 — exactly this run's six new tests;
             # apps/web 1534, was 1528; no other suite moved). `check-test-floor.mjs`:
             # OK, 2860 >= floor 1899 (+961 margin, unmoved). `TZ=UTC make build`:
             # exit 0, 30 routes (unchanged — one existing `lib/` file edited, no new
             # route). `npm run gates`: all green (locked-css OK, 1 documented hunk,
             # 294 v1 lines byte-identical; boundaries 322 files, clean after the
             # docblock fix above; fonts degraded-but-non-blocking, pre-existing,
             # 2/6 UI fonts present; corpus-morphology OK — unaffected by this diff,
             # since that gate scans `public/`, not `lib/corpus/load.ts`'s SSR path;
             # corpus-glyphs OK, 206 codepoints across 4 artifacts, unchanged). `npx
             # tsc --noEmit`: clean. No `v1/**`/`v2/**` edit. No Arabic codepoint in
             # the final diff (all three changed files swept programmatically, in
             # Python, over the Arabic, Arabic Supplement, Arabic Extended-A and
             # both Presentation Forms Unicode blocks, plus a `\u06xx`-escape and
             # `fromCharCode`/`fromCodePoint` mention check: CLEAN — the one
             # violation caught along the way was fixed before this check and
             # before committing). No oracle/golden-log/fixture/snapshot
             # regenerated.
             #
             # Session start: fresh container, `make setup` ran clean from scratch
             # (both `v2/api` and `v3/api` `composer install` succeeded first try,
             # no retry needed); `HEAD` was found detached at `758fbae` (v3-D244),
             # the same commit `origin/main` was already at, on a stale LOCAL `main`
             # branch ref fourteen commits behind (`fcfe765`, v3-D229) — the
             # recurring stale-local-`main` trap this file has recorded roughly
             # fifty times since v3-D77 — caught before any exploration via `git
             # fetch origin main` + `git checkout main && git merge --ff-only
             # origin/main`, a clean fast-forward, no work lost or at risk.
             #
             # Found by re-reading `lib/corpus/load.ts`'s own header against
             # `check-corpus-morphology.mjs`'s own header side by side, after this
             # run's own extensive zero-caller/stale-docblock sweep (matching
             # v3-D196/D197's own "exhausted" conclusion) came back clean — the two
             # headers together named a gap between "what this gate covers" and
             # "every place a browser can actually receive corpus data" that no
             # prior sweep had crossed, since every prior sweep of this bug class
             # looked for a MISSING reader, not an EXTRA one. NOT addressed:
             # `DrillPicker.tsx`'s own unused `now` prop; the unused
             # `atoms`/`corpus`/`sessions` IndexedDB object stores (v3-D232);
             # `session_start`'s own latency metric (v0.8); the streak/away-day
             # day-space mismatch (v3-D209); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()`; `App\Billing\TrialAttribution`
             # (v3-D148, re-confirmed still correctly scoped to M7's unbuilt
             # checkout flow); `lib/pricing.ts#regionFromCountry()` (v3-D163);
             # `PaywallGate` as a whole class (v3-D88/D151/D219); multi-surah
             # enrollment; the operational mailer/7-night launch window; PAY-1's
             # Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift (v3-D127);
             # `packages/engine/src/placement.ts`; `MacroFacts.litany.rhymeLabel`
             # (v3-D188); `corpusHash`'s zero fold-side consumer (v3-D206); FR5's
             # queue-level restart/replan/makeup behavior (v3-D217);
             # `selection_determinism_check` still replaying a committed fixture;
             # `lib/test/build.ts`/`TestIsland.tsx`'s `test_*` events still carrying
             # no SITE coordinate (v3-D229) — all unchanged. See DECISIONS.md
             # v3-D245.
             # NOTE (v3-D244, 2026-09-23): `lib/session/run.ts`'s own docblock,
             # directly above `weakSpotOfferFor` (FR6 Door 2, v3-D106), still said
             # "Door 3 (open practice) and the cold-success-adoption offer remain
             # unwired, named here so a future run does not re-discover them as
             # new." True the night it was written; false since v3-D117 wired Door
             # 3 (`startOpenPractice`, exported later in this same file) and false
             # since v3-D118 wired cold-success adoption
             # (`adoptionOfferFor`/`acceptAdoption`, also in this file) — both
             # confirmed real, both confirmed called from
             # `components/session/SessionIsland.tsx`. The SAME file's own import-
             # block comment, forty lines earlier, was correctly updated when each
             # of those nights landed; only the older, more-detailed docblock
             # directly above the function itself never caught up. Same "docblock
             # says X, reality is Y" shape v3-D90/D110/D123/D236 each already
             # closed elsewhere in this tree — sharper than most, since this
             # sentence's own stated purpose was "named here so a future run does
             # not re-discover them as new": a future run trusting this file's own
             # comments in isolation would have been steered, by the ONE line whose
             # entire job was preventing exactly that, into rebuilding something
             # that already ships — the same failure shape v3-D77 Finding 0 and
             # v3-D167's own process note both already named for a stale signpost
             # costing real time.
             #
             # With DEFECTS.md's B1-B13/E-01..E-08 all closed (only PAY-1 open, by
             # design) and every item on v3-D243's own "NOT addressed" list re-
             # confirmed as genuinely larger-scope or already non-divergent, this
             # run's own fresh sweep — a zero-external-caller pass over every
             # `apps/web/lib/**` export (two false-positive shapes found and
             # discarded: same-file-only usage, and a route registered via
             # Laravel's `[Controller::class, 'method']` array syntax that a
             # literal-call grep misses); a zero-caller pass over
             # `packages/engine/src`, `packages/corpus-compiler/src` and
             # `worker/fold-runner/src` (all three clean, matching every prior
             # night); a public-method-vs-route-table pass over every
             # `api/app/Http/Controllers/**` class; and a fresh security read of
             # the two newest admin surfaces, `AdminBillingController::override()`/
             # `AdminRolesController::index()`, against LAUNCH-CHECKLIST.md §16's
             # own five-finding rubric (both already sound: no fabricated provider
             # relationship, both raw ids pseudonymized, the write routed through
             # the same guarded `EntitlementMachine::apply()` every webhook uses) —
             # came back clean or already-closed everywhere except this one stale
             # docblock.
             #
             # Fixed: one docblock, no production behavior change (both doors were
             # already correctly wired) — the stale sentence replaced with a
             # pointer to where each door's own real wiring lives and the nights
             # that landed each, plus a dated CORRECTED note in
             # v3-D90/D110/D123/D236's own style.
             #
             # RED confirmed directly, mirroring v3-D236's own AGREEMENT-not-
             # wording technique: a new `describe` block in
             # `lib/session/run.test.ts` locates the docblock by scanning the
             # file's real source text, asserts it does not match `/door
             # 3[\s\S]{0,120}remain unwired/i` or `/cold-success-adoption
             # offer[\s\S]{0,40}remain unwired/i`, and — the biconditional half —
             # separately asserts `SessionIsland.tsx`'s own real source text DOES
             # reference `startOpenPractice`, `adoptionOfferFor` and
             # `acceptAdoption`, so the check cannot pass by a docblock edit alone
             # if the doors were somehow un-wired again. Run against the unmodified
             # source (`git stash` of `run.ts` alone, the new test kept) it failed
             # exactly as predicted, the docblock's own real text printed verbatim
             # in the failure. Restored byte-identically, reran:
             # `lib/session/run.test.ts` 98/98 green (was 97, +1).
             #
             # `TZ=UTC npx vitest run` (apps/web, full suite, `npm install` run
             # directly rather than waiting on the sequential `make setup` chain —
             # the `@engine` alias resolves to source via tsconfig/vitest.config.ts
             # path aliases, not an installed package, the same shortcut v3-D243
             # itself took): 1528 passing (was 1527, +1 — exactly this run's one
             # new test; 108 files, all green). `check-test-floor.mjs`: OK, 2854 >=
             # floor 1899 (+955 margin, unmoved). `TZ=UTC make build`: exit 0, 30
             # routes (unchanged — one existing `lib/` file and its own test file,
             # no new route or component). `npm run gates`: all green (locked-css
             # OK, 1 documented hunk, 294 v1 lines byte-identical; boundaries 321
             # files, unchanged count — no new production file; fonts degraded-but-
             # non-blocking, pre-existing, 2/6 UI fonts present; corpus-morphology
             # 362 words / corpus-glyphs 206 codepoints across 4 artifacts, both
             # unchanged — a comment-only fix touches no corpus data). `npx tsc
             # --noEmit` (apps/web): clean. `packages/engine` 439/439,
             # `packages/corpus-compiler` 120/120, `worker/fold-runner` 63/63, `v2`
             # vitest 255/255, `v2/api` 47/47, `v3/api` 402/402 (+2
             # incomplete/PAY-1, +6 skipped) — all unchanged, this diff touches no
             # PHP/engine/fold-runner/v1/v2 file at all. `TZ=UTC make test`: 2854
             # passing (was 2853, +1 — exactly this run's one new test), exit 0.
             #
             # No `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo` build-
             # cache diff produced by running the suite was reverted before
             # committing, same discipline as every prior entry — `git status
             # --porcelain -- v1 v2` empty immediately before committing). No
             # Arabic codepoint (both changed files swept programmatically, in
             # Python, over the Arabic, Arabic Supplement, Arabic Extended-A and
             # both Presentation Forms Unicode blocks, plus a `\u06xx`-escape and
             # `fromCharCode`/`fromCodePoint` mention check: CLEAN — every new
             # string is a TypeScript identifier, a docblock sentence, or a regex
             # literal, never corpus text). No oracle/golden-log/fixture/snapshot
             # regenerated.
             #
             # Session start: fresh container, no `node_modules`/`vendor`/compiled
             # corpus anywhere; `HEAD` and `origin/main` agreed at `0efabd6`
             # (v3-D243), but the local `main` branch ref sat fourteen commits
             # behind at `fcfe765` (v3-D229) — the recurring stale-local-`main`
             # trap this file has recorded roughly fifty times since v3-D77 —
             # caught before any exploration via `git fetch origin main` + `git
             # checkout main && git merge --ff-only origin/main`, a clean fast-
             # forward, no work lost or at risk. `make setup` failed partway on its
             # first attempt (v2/api's own `composer install` hit the documented
             # transient proxy timeout then a 300s git-mirror clone timeout on
             # `laravel/pint`); every OTHER install (apps/web, engine, corpus-
             # compiler, fold-runner, v2's own npm) is PHP-independent and was run
             # directly and successfully in parallel; both v2/api's and v3/api's
             # composer installs then completed cleanly on a retry with
             # `COMPOSER_PROCESS_TIMEOUT=900`, the same recovery this file's
             # history has recorded before, no code or config change.
             #
             # Found by re-reading v3-D117/v3-D118's own closing notes directly
             # against every docblock in `run.ts` that references either door,
             # after the mechanical zero-caller/security sweep above came back
             # otherwise exhausted. NOT addressed: `DrillPicker.tsx`'s own unused
             # `now` prop; the unused `atoms`/`corpus`/`sessions` IndexedDB object
             # stores (v3-D232); `session_start`'s own "app-open -> first drill"
             # latency metric (v0.8); the streak/away-day day-space mismatch
             # (v3-D209); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()`; `App\Billing\TrialAttribution`
             # (v3-D148); `lib/pricing.ts#regionFromCountry()` (v3-D163);
             # `PaywallGate` as a whole class — `PaywallGate::permitsReview()` re-
             # confirmed this run as still having zero callers anywhere, including
             # from `permitsIssuance()` in the same class, the same open product-
             # design question v3-D88/D151/D219 already named, not a wiring gap;
             # multi-surah enrollment; the operational mailer / 7-night launch
             # window; PAY-1's Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift (v3-D127);
             # `packages/engine/src/placement.ts`; `MacroFacts.litany.rhymeLabel`
             # (v3-D188); `StripeField.editable` (v3-D204); `corpusHash`'s zero
             # fold-side consumer (v3-D206); FR5's queue-level
             # restart/replan/makeup behavior (v3-D217);
             # `selection_determinism_check` still replaying a committed fixture;
             # `GlossDraftsPanel.tsx`'s hardcoded caption vs.
             # `shipping`/`excludedFromHashV1` (v3-D173, re-confirmed still non-
             # divergent as wired); `lib/test/build.ts`/`TestIsland.tsx`'s `test_*`
             # events still carrying no SITE coordinate (v3-D229) — all unchanged.
             # This run's own zero-caller sweep across `apps/web/lib/**`,
             # `packages/engine/src`, `packages/corpus-compiler/src` and
             # `worker/fold-runner/src` came back genuinely clean beyond the one
             # instance fixed here — a future run should not expect another same-
             # shaped finding without a genuinely fresh corner or a willingness to
             # take on one of the larger, deliberately-deferred items above. See
             # DECISIONS.md v3-D244.
             # NOTE (v3-D243, 2026-09-22): edge case #111's own register entry
             # ("Far-future client ts... accept + flag; fold clamps spacing at
             # received_at; skew measured client-now vs server-now, not
             # per-event") is now FULLY CLOSED — all three clauses built. The
             # first two closed on the two prior nights (v3-D240's per-event
             # flag, v3-D242's fold-side clamp); this run built the third and
             # last: a per-DEVICE clock-skew measurement, independent of any
             # one event's own `ts`. v3-D242's own closing note had already
             # scoped it precisely: "an aggregate per-device skew ESTIMATE
             # (comparing a device's own reported 'now' against the server's
             # at sync time)... left for a future run to scope deliberately."
             # Re-confirmed by grep before writing any code: every existing
             # use of the word "skew" in this tree meant either fold-runner
             # ENGINE-VERSION skew (`foldCheck.ts`'s WARN taxonomy) or #111's
             # own per-EVENT clock-skew signal (v3-D240/D242) — nothing
             # anywhere measured THIS device's clock against the server's
             # directly. The distinction matters: a device whose clock is
             # wrong but has not yet pulled/pushed anything with a `ts` more
             # than `FUTURE_TS_TOLERANCE_MS` (a year) away from now would
             # never trip `futureTs` at all, yet the skew is still real and
             # still corrupting spacing measurement in smaller, harder-to-
             # notice ways long before it reaches "implausible."
             #
             # Fixed: new `lib/sync/clockSkew.ts#measureClockSkew(response,
             # now)` reads the response's own standard HTTP `Date` header
             # (RFC 9110 §6.6.1, stamped by the server on every response, no
             # new endpoint or wire field) and returns `now - serverMs` —
             # positive ahead, negative behind, `null` (never a fabricated 0)
             # when unmeasurable. A new `CLOCK_SKEW_ALERT_MS` (5 min, two
             # orders of magnitude below `FUTURE_TS_TOLERANCE_MS`) gates when
             # it's worth surfacing. Wired through the EXACT chain `futureTs`
             # (v3-D240) already uses, so no new plumbing shape: `sync.ts
             # #pullFromServer` measures it once per received page
             # (overwritten each page — current state, not a delta) onto a
             # new `PullResult.clockSkewMs`; `CycleResult` mirrors it;
             # `lib/sync/summary.ts#SyncSummary` gains a fifth field,
             # optional on `report()`'s own input so no pre-existing call
             # site needed touching (same "additive, no fixture churn"
             # precedent `resumeMassed`/`futureTs` set); `SyncTrigger.tsx`
             # needed NO code change at all — it already passes the whole
             # `CycleResult` through to `report()`; `SyncStatus.tsx` gains a
             # fifth escalation fact, `clock off by Nm`, past the alert
             # threshold, alongside — never folded into — the existing four.
             #
             # ONE REAL BUG caught while wiring the prop, not just the
             # plumbing: every other `SyncStatusProps` field defaults via
             # `prop ?? live.value`, correct where `0`/`false` are real
             # overrides distinguishable from omission via `??`. `clockSkewMs`
             # is different — its domain legitimately INCLUDES `null` as a
             # real value ("not measured", the honest default), so an
             # explicit `clockSkewMs={null}` prop (exactly what a test
             # asserting "no escalation" would pass) collided with the
             # omitted-prop sentinel, ALSO `undefined`-shaped via `??`. RED
             # caught it directly: `<SyncStatus clockSkewMs={null} />`
             # against a live summary reporting a real skew still showed the
             # escalation (`null ?? live.clockSkewMs` reads the live value,
             # not `null`). Fixed with an explicit `clockSkewMs !== undefined
             # ? clockSkewMs : live.clockSkewMs` check instead of `??` — the
             # one prop on this component that needs it, reasoning recorded
             # in-line so a future nullable-with-meaningful-null prop does
             # not repeat the mistake.
             #
             # A SECOND, smaller catch: test-DOM collision, not a source bug.
             # `test/sync-status.test.tsx`'s own established convention ("this
             # file never unmounts between tests") means every `render()`
             # across the whole file accumulates in the shared
             # `document.body` — confirmed by a throwaway repro against the
             # UNMODIFIED file before writing any new test, and by reading
             # `@testing-library/dom`'s own `getNodeText` source directly
             # (direct-child TEXT NODES only, never full `textContent`) to
             # understand precisely why a SCOPED query in a new test does not
             # protect an UNRELATED, unscoped query elsewhere in the same
             # file. One of this run's own first-drafted tests reused
             # `appendEvents(2)` (already used, unscoped, by two OTHER
             # pre-existing tests) and broke one of them once both renders
             # had fully resolved (`Found multiple elements`); fixed by
             # picking an unused count (9), reasoning recorded in a comment.
             #
             # RED confirmed independently at every layer, each before any
             # production file was touched: `lib/sync/clockSkew.test.ts` (6
             # cases) failed on the module not existing; `lib/sync/
             # pull.test.ts`'s new block (3 cases) failed on
             # `result.clockSkewMs` reading `undefined`; `lib/sync/
             # summary.test.ts` (6 new cases, plus 11 pre-existing `toEqual`
             # assertions widened — `toEqual` fails on a missing expected key
             # exactly as it does on an extra one) failed identically;
             # `test/sync-status.test.tsx` (6 new) and `test/sync-
             # trigger.test.tsx` (2 new, plus 5 pre-existing `toEqual`
             # assertions widened) failed on `undefined` where `null` or a
             # real number was expected. The load-bearing `sync-
             # trigger.test.tsx` case drives a REAL `SyncTrigger` mount
             # through a REAL `syncCycle → pullFromServer →
             # measureClockSkew` chain against a stubbed `fetch` setting a
             # genuine `Date` header 12 minutes behind `Date.now()`, and
             # asserts the measured value lands within a wide tolerance band
             # — never a stubbed number handed straight to the summary.
             # Restored, reran green throughout.
             #
             # `TZ=UTC make test`: 2853 passing (was 2830, +23 — exactly this
             # run's new tests: 6 + 3 + 6 + 6 + 2; apps/web 1527, was 1504; no
             # other suite moved: 255 v2 vitest, 47 v2/api, 402 v3/api, 120
             # corpus-compiler, 439 engine, 63 fold-runner — this diff touches
             # no PHP/engine/fold-runner file at all). `check-test-floor.mjs`:
             # OK, 2853 >= floor 1899 (+954 margin, unmoved, same discipline
             # as every prior entry). `TZ=UTC make build`: exit 0, 30 routes
             # (unchanged — no new route/component, one new lib module under
             # the already-exempt `lib/sync/` egress surface). `npm run
             # gates`: all green (locked-css OK, 1 documented hunk, 294 v1
             # lines byte-identical; boundaries 321 files, unchanged count;
             # fonts degraded-but-non-blocking, pre-existing, 2/6 UI fonts
             # present; corpus-morphology 362 words / corpus-glyphs 206
             # codepoints across 4 artifacts, both unchanged — a transport-
             # layer clock measurement touches no corpus data). `npx tsc
             # --noEmit`: clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff produced by running
             # the suite was reverted before committing, same discipline as
             # every prior entry). No Arabic codepoint (every new/changed
             # file swept programmatically, in Python, over the Arabic,
             # Arabic Supplement, Arabic Extended-A and both Presentation
             # Forms Unicode blocks, plus a `\u06xx`-escape and
             # `fromCharCode`/`fromCodePoint` mention check: CLEAN — every
             # new string is a TypeScript identifier, a docblock sentence, a
             # millisecond arithmetic result, or a fixed English test-fixture
             # message, never corpus text). No oracle/golden-log/fixture/
             # snapshot regenerated. Session start: fresh container, no
             # `node_modules`/`vendor`/compiled corpus anywhere; `HEAD`,
             # local `main` and `origin/main` all agreed at `0f62b2f`
             # (v3-D242) except the local `main` BRANCH REF, which sat
             # thirteen commits behind at `fcfe765` (v3-D229) — the recurring
             # stale-local-`main` trap this file has recorded roughly fifty
             # times since v3-D77 — caught before any exploration via `git
             # fetch origin main` + `git checkout main && git merge --ff-only
             # origin/main`, a clean fast-forward, no work lost or at risk.
             # Found by reading v3-D242's own closing note directly (it had
             # already scoped this exact gap by name, by mechanism, and by
             # the concept it is distinct from) rather than dispatching a
             # fresh sweep agent — independently re-verified the real absence
             # of any client-now-vs-server-now measurement anywhere in the
             # tree before writing any test. NOT addressed: `DrillPicker.tsx`'s
             # own unused `now` prop; the unused `atoms`/`corpus`/`sessions`
             # IndexedDB object stores (v3-D232); `session_start`'s own
             # "app-open → first drill" latency metric (v0.8); the
             # streak/away-day day-space mismatch (v3-D209); `rhymeClassOf()`
             # (v3-D136); `EntitlementMachine::merge()`;
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate`
             # as a whole class; multi-surah enrollment; the operational
             # mailer / 7-night launch window; PAY-1's Stripe fixtures; surah
             # 67's scene beats; `worker/fold-runner/src/severity.ts`'s
             # taxonomy drift (v3-D127); `packages/engine/src/placement.ts`;
             # `MacroFacts.litany.rhymeLabel` (v3-D188); `StripeField.editable`
             # (v3-D204); `corpusHash`'s zero fold-side consumer (v3-D206);
             # FR5's queue-level restart/replan/makeup behavior (v3-D217);
             # `selection_determinism_check` still replaying a committed
             # fixture; `GlossDraftsPanel.tsx`'s hardcoded caption vs.
             # `shipping`/`excludedFromHashV1` (v3-D173, still non-divergent
             # as wired); `lib/test/build.ts`/`TestIsland.tsx`'s `test_*`
             # events still carrying no SITE coordinate (v3-D229) — all
             # unchanged. Edge case #111 is now FULLY CLOSED — all three
             # register clauses built and tested; remove it from all future
             # sweeps entirely. See DECISIONS.md v3-D243.
             # NOTE (v3-D242, 2026-09-22): edge case #111's own register entry
             # ("Far-future client ts... accept + flag; fold clamps spacing at
             # received_at; skew measured client-now vs server-now, not
             # per-event") had only its first clause built. v3-D240 (the prior
             # night) built the "flag" half (`merge.ts`'s `futureTs` now
             # reaches `SyncStatus`) and, sweeping for the second clause,
             # recorded a verified negative: "`received_at` is not even a
             # column on `events`." That claim was WRONG — `received_at` has
             # been a real, non-nullable, server-stamped column since the
             # table's first migration — but the underlying finding (nothing
             # clamps spacing with it) was right. `rebuild.ts#applyEvent`
             # used raw `e.ts` unconditionally for every
             # `RetrievalOutcome.ts`/`lastRetrieval`/`scheduleGate()`/
             # `applyGateResult()` call, so a device with a clock skewed
             # months into the future would have that poisoned timestamp
             # become the atom's own `lastRetrieval` and the day-1 gate's
             # `gateDueAt` PERMANENTLY — invariant #2 forbids ever rewriting
             # the stored `ts`, and `merge.ts`'s own comment already said so:
             # "clamping is the FOLD's job, not the merge's... `received_at`
             # is a server column absent from the wire shape — so the client
             # could not clamp to it even if it wanted to." And even a
             # willing fold-runner had nothing to clamp against:
             # `EventWireCodec::toWire()` — the one shared conversion BOTH
             # `AtomCacheRebuilder` and `DeterminismCheckCommand
             # ::sampleFromDatabase()` use to hand real events to the Node
             # fold-runner — never forwarded `received_at` at all.
             #
             # Fixed, four files, no wire/schema change (the column already
             # existed): `DrillEvent` gains `receivedAt?: number`, documented
             # explicitly as SERVER-ONLY — never sent to or from the client,
             # undefined for every client-side fold, which is therefore a
             # complete no-op under this fix. `rebuild.ts` gains
             # `effectiveTs(e)` (`e.receivedAt !== undefined && e.receivedAt
             # < e.ts ? e.receivedAt : e.ts`) and all seven raw `e.ts` reads
             # inside `applyEvent()` now route through it. The clamp is
             # ASYMMETRIC and deliberately so: it fires only when
             # `receivedAt < ts` (a device clock genuinely ahead of the
             # server) — an ORDINARY late-arriving event (`ts` behind
             # `receivedAt`, the common offline-then-synced case) is left
             # completely untouched, since clamping that direction would
             # corrupt every honest offline learner's real spacing to "just
             # now" on every sync, a strictly worse bug than the one being
             # fixed. `canonicalOrder.ts`'s own fold ORDER is also untouched
             # by design — the edge case's own wording scopes the fix to
             # "spacing," never to reordering the log.
             # `EventWireCodec::toWire()` gains an unconditional `receivedAt`
             # field, outside the existing null-skipping `$optional` loop
             # (never null on a real row) — since this is the one shared
             # chokepoint both fold-runner callers already route through,
             # one change reaches both the admin rebuild and the nightly
             # determinism check at once.
             #
             # RED confirmed independently at both layers, each via `git
             # stash` of the one source file with its test(s) kept, restored
             # byte-identically after: engine level, 4 of 6 new
             # `receivedAtClamp.test.ts` cases failed against the unmodified
             # `rebuild.ts` — a poisoned S3 completion's `lastRetrieval` read
             # the raw ~400-days-future `ts` (`expected 36288000000 to be
             # 1814400000`), its `gateDueAt` was ~400 days out, a poisoned
             # gate FAIL's re-arm date was likewise unclamped, and a poisoned
             # slip's `lastRetrieval` was unclamped too; the 2 negative cases
             # (no `receivedAt` at all; an ORDINARY late-arrival event) passed
             # vacuously and correctly, proving the fix clamps one specific
             # direction only. Reran: 439/439 engine (was 433, +6). PHP/
             # integration level, `EventWireCodec.php`'s one-line addition
             # reverted alone: the load-bearing
             # `EventsAtomCacheRefoldTest::test_a_far_future_ts_is_clamped_to_received_at_not_trusted_for_spacing`
             # — posts a real event with `ts` ~400 days in the future through
             # `/api/events`, through the REAL fold-runner subprocess (v3-D08:
             # PHP never folds), asserts `atom_cache.last_retrieval` equals
             # the stored row's own `received_at` and is strictly less than
             # the poisoned `ts`, and that `gate_due_at` is within 2 days of
             # `received_at` — failed exactly as predicted (`Failed asserting
             # that 1824665168427 is identical to 1790105168438`). Reran: 5/5
             # in that file (was 4, +1), 402/402 v3/api (was 401, +1; 2
             # incomplete + 6 skipped unchanged, PAY-1). The test also asserts
             # the STORED `events.ts` is still the poisoned value verbatim —
             # invariant #2, the log is never rewritten, only the derived
             # cache is clamped.
             #
             # `TZ=UTC make test`: 2830 passing (was 2823, +7 — exactly this
             # run's new tests: 6 engine + 1 v3/api; no other suite moved —
             # apps/web genuinely unchanged at 1504, this diff touches no
             # apps/web file at all). `check-test-floor.mjs`: OK, 2830 >=
             # floor 1899 (+931 margin, unmoved). `TZ=UTC make build`: exit
             # 0, 30 routes (unchanged). `npm run gates`: all green
             # (locked-css OK, 1 documented hunk, 294 v1 lines byte-
             # identical; boundaries 319 files, unchanged count — no
             # apps/web file in this diff; fonts degraded-but-non-blocking,
             # pre-existing, 2/6 UI fonts present; corpus-morphology 362
             # words / corpus-glyphs 206 codepoints across 4 artifacts, both
             # unchanged — a fold-spacing-only fix touches no corpus data).
             # `npx tsc --noEmit`, run separately across all four v3 node
             # packages: clean in all four. `worker/fold-runner`'s own
             # suite: 63/63, unchanged (imports `rebuild()` directly, no
             # fold-runner-side test needed). `./vendor/bin/pint --test` on
             # both changed PHP files: passed. No `v1/**`/`v2/**` edit (a
             # stray `v2/tsconfig.tsbuildinfo` build-cache diff produced by
             # running the suite was reverted before committing, same
             # discipline as every prior entry). No Arabic codepoint (every
             # changed/new file swept programmatically, in Python, over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks, plus a `\u06xx`-escape and
             # `fromCharCode`/`fromCodePoint` mention check: CLEAN — every
             # new string is a TypeScript/PHP identifier, a docblock
             # sentence, or a millisecond arithmetic result, never corpus
             # text). No oracle/golden-log/fixture/snapshot regenerated —
             # `golden-log-parity.test.ts` (3 cases, unchanged) still passes
             # unmodified, since the frozen fixture carries no `receivedAt`
             # and the fix is a pure no-op absent it. Session start: fresh
             # container, no `node_modules`/`vendor`/compiled corpus
             # anywhere; `make setup` ran clean from scratch (both v2/api and
             # v3/api composer installs hit the documented transient
             # api.github.com proxy timeout and recovered automatically via
             # the git-mirror fallback, no retry flag needed). THE
             # STALE-LOCAL-`main` TRAP RECURRED AGAIN: `HEAD` was correctly
             # detached at the real tip `bc7e08e` (v3-D241, matching
             # `origin/main` exactly), but the local `main` branch ref sat
             # twelve commits behind at `fcfe765` (v3-D229) — caught before
             # any exploration via `git fetch origin main` + `git checkout
             # main && git merge --ff-only origin/main`, a clean
             # fast-forward, no work lost or at risk. Found by reading
             # v3-D240's own closing note directly (it had already isolated
             # this exact gap and left it, "a real, separate, larger gap...
             # needs a new column and a fold-side read of it") rather than
             # dispatching a fresh sweep agent — independently re-verified
             # the real column, the real stamping site, the real shared
             # codec chokepoint, and all seven of `applyEvent()`'s raw `e.ts`
             # reads before writing any test. NOT addressed: edge case
             # #111's THIRD clause — "skew measured client-now vs
             # server-now, not per-event" — remains genuinely unimplemented
             # anywhere (every existing use of "skew" in this tree means
             # fold-runner ENGINE-VERSION skew, a different concept); a
             # separate, smaller feature, left for a future run.
             # `DrillPicker.tsx`'s own unused `now` prop; the unused
             # `atoms`/`corpus`/`sessions` IndexedDB object stores
             # (v3-D232); `session_start`'s own "app-open → first drill"
             # latency metric (v0.8); the streak/away-day day-space mismatch
             # (v3-D209); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()`; `App\Billing\TrialAttribution`
             # (v3-D148); `lib/pricing.ts#regionFromCountry()` (v3-D163);
             # `PaywallGate` as a whole class; multi-surah enrollment; the
             # operational mailer / 7-night launch window; PAY-1's Stripe
             # fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`;
             # `MacroFacts.litany.rhymeLabel` (v3-D188); `StripeField.editable`
             # (v3-D204); `corpusHash`'s zero fold-side consumer (v3-D206);
             # FR5's queue-level restart/replan/makeup behavior (v3-D217);
             # `selection_determinism_check` still replaying a committed
             # fixture; `GlossDraftsPanel.tsx`'s hardcoded caption vs.
             # `shipping`/`excludedFromHashV1` (v3-D173, still non-divergent
             # as wired); `lib/test/build.ts`/`TestIsland.tsx`'s `test_*`
             # events still carrying no SITE coordinate (v3-D229) — all
             # unchanged. Edge case #111's "fold clamps spacing at
             # received_at" is now CLOSED — remove it from future sweeps.
             # See DECISIONS.md v3-D242.
             # NOTE (v3-D241, 2026-09-22): `lib/admin/reveal.ts#revealIdentity()`
             # has a real, reachable `{state: "failed", reason}` outcome —
             # a thrown network error, or a genuine non-ok/non-422/non-404
             # HTTP status (the backend's own `DB::transaction()` closure has
             # no catch, so a real DB error there surfaces as a plain 500) —
             # computed on every real failure path since this module's own
             # header ("FAILURE IS A STATE, NEVER AN EXCEPTION") was written.
             # `PrivacyPanel.tsx` rendered every OTHER member of that union
             # (revealed/anonymous/not-found/pii-warning/rejected) but had no
             # branch for `"failed"` at all — confirmed directly, `grep -n
             # '"failed"' PrivacyPanel.tsx` returned nothing before this fix.
             # An operator who hit a real server error or a dropped
             # connection mid-reveal saw the button simply re-enable, with no
             # error text anywhere — on the one screen whose entire job is
             # showing an admin whether a privacy-sensitive request
             # succeeded. The established convention on every sibling admin
             # panel (verified directly against `FlagsPanel.tsx`'s three
             # action handlers) is to surface every outcome unconditionally;
             # this was the one panel, and the one action (`reveal`, not the
             # already-correct `re-check`), that broke it. Fixed: one new
             # conditional block, `{result?.state === "failed" ? <p
             # role="alert" className="caption">{result.reason}</p> : null}`,
             # mirroring the adjacent `"rejected"` branch's own shape — no
             # server/wire change, no new state invented.
             #
             # RED confirmed directly: 2 new cases in
             # `test/privacy-panel.test.tsx` (7 pre-existing cases
             # untouched), run against the tree before the production file
             # was touched — both failed identically, `screen.findByRole
             # ("alert")` timing out (a mocked 500 response, and a mocked
             # `fetch` throwing `TypeError`), since no such element existed
             # for either outcome; the first case also asserts neither the
             # `reveal-result` nor `pii-warning` testid leaked in, proving
             # the fix renders `"failed"`'s own message rather than falling
             # through to a different branch. Reran: 9/9 green (was 7, +2).
             #
             # `TZ=UTC make test`: 2823 passing (was 2821, +2 — exactly this
             # run's two new tests; apps/web 1504, was 1502; no other suite
             # moved: 255 v2 vitest, 47 v2/api, 401 v3/api, 120
             # corpus-compiler, 433 engine, 63 fold-runner), exit 0.
             # `check-test-floor.mjs`: OK, 2823 >= floor 1899 (+924 margin,
             # unmoved). `TZ=UTC make build`: exit 0, 30 routes (unchanged —
             # one existing component edited, no new route). `npm run
             # gates`: all green (locked-css OK, 1 documented hunk, 294 v1
             # lines byte-identical; boundaries 319 files, unchanged count —
             # no new production file; fonts degraded-but-non-blocking,
             # pre-existing, 2/6 UI fonts present; corpus-morphology 362
             # words / corpus-glyphs 206 codepoints across 4 artifacts, both
             # unchanged — a client-side render-branch fix touches no corpus
             # data). `npx tsc --noEmit`, run separately across all four v3
             # node packages: clean in all four. No PHP file changed, so
             # `pint` was not applicable. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff produced by running
             # the suite was reverted before committing, same discipline as
             # every prior entry). No Arabic codepoint (both changed files
             # swept programmatically, in Python, over the Arabic, Arabic
             # Supplement, Arabic Extended-A and both Presentation Forms
             # Unicode blocks, plus a `\uXXXX`-escape and
             # `fromCharCode`/`fromCodePoint` mention check: CLEAN — every
             # new string is a TypeScript identifier or a fixed English
             # test-fixture message, never corpus text). No oracle/
             # golden-log/fixture/snapshot regenerated. Session start: fresh
             # container, no `node_modules`/`vendor`/compiled corpus
             # anywhere; `make setup` ran clean from scratch, no retries
             # needed. `HEAD`, local `main` and `origin/main` all already
             # agreed at `12eaddb` (v3-D240) — no stale-local-`main` trap
             # this run. Found by reading `PrivacyPanel.tsx`'s full render
             # tree directly against `RevealResult`'s own declared union,
             # after verifying the "surface every outcome" convention first
             # against three real sibling call sites. Also checked and ruled
             # out before landing on this candidate:
             # `NightlyWindowLedger`/`Admin\NightlyWindowController`
             # (re-confirmed fully wired); `AdminRole`/
             # `Admin\AdminRolesController` (re-confirmed fully wired);
             # `Spec`/`SpecsController` (still deliberately unwired, larger
             # re-architecture scope, v3-D190); `AdminRevealToken`'s other
             # fields (`created_at_ms` genuinely internal-only, no reader
             # warranted); E-07 (re-checked directly against the current
             # route table — still genuinely unreachable, every real route
             # still fetches exactly one surah per page load). NOT
             # addressed: every item on v3-D240's own "NOT addressed" list,
             # unchanged — `DrillPicker.tsx`'s own unused `now` prop; the
             # unused `atoms`/`corpus`/`sessions` IndexedDB object stores
             # (v3-D232); `session_start`'s own "app-open → first drill"
             # latency metric (v0.8); the streak/away-day day-space mismatch
             # (v3-D209); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()`; `App\Billing\TrialAttribution`
             # (v3-D148); `lib/pricing.ts#regionFromCountry()` (v3-D163);
             # `PaywallGate` as a whole class; multi-surah enrollment; the
             # operational mailer/7-night launch window; PAY-1's Stripe
             # fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`;
             # `MacroFacts.litany.rhymeLabel` (v3-D188); `StripeField.editable`
             # (v3-D204); `corpusHash`'s zero fold-side consumer (v3-D206);
             # FR5's queue-level restart/replan/makeup behavior (v3-D217);
             # `selection_determinism_check` still replaying a committed
             # fixture; `GlossDraftsPanel.tsx`'s hardcoded caption vs.
             # `shipping`/`excludedFromHashV1` (v3-D173, still non-divergent
             # as wired); `lib/test/build.ts`/`TestIsland.tsx`'s `test_*`
             # events still carrying no SITE coordinate (v3-D229); edge case
             # #111's "fold clamps spacing at received_at" half, unimplemented
             # anywhere (v3-D240) — all unchanged. `PrivacyPanel.tsx`'s own
             # discarded `"failed"` reveal outcome is now CLOSED — remove it
             # from future sweeps. See DECISIONS.md v3-D241.
             # NOTE (v3-D239, 2026-09-21): `corpus-compiler/src/io.ts
             # #readInputs` assembles `generatedFrom: string[]` (the raw
             # verses/geometry/ruku/mental-model files, plus the QAC
             # morphology file and its version tag) on every compile, as a
             # required field on the compiler's own `CorpusMeta`.
             # `buildCorpus.ts` carries it through and `stage-corpus.mjs
             # #slim()` ships `meta` wholesale, so every staged
             # `public/corpus/<surah>.json` genuinely carries it — confirmed
             # directly against the real staged `public/corpus/67.json`. But
             # the engine's own `Corpus["meta"]` (`packages/engine/src
             # /types.ts`) never declared a place for it to land, so no
             # TypeScript-typed reader anywhere in `apps/web` could reach it
             # even by accident — the same "shipped, never declared on the
             # consuming type" shape `Corpus.lookalikes` (v3-D181),
             # `CorpusWord.line` (v3-D191) and `CorpusMeta.distractorOrigin`/
             # `.kernelYield` (v3-D192) already closed on sibling fields of
             # the identical `meta` object. `/workbench` already audits a
             # compiled corpus's own build provenance for a reviewer
             # (`corpusHash`, `hashSpecVersion`, `distractorOrigin`/
             # `kernelYield`, `droppedCollisions`, `mentalModel`) —
             # `generatedFrom` is the same class of fact (which raw files,
             # and which QAC version, fed this compile) and was the one such
             # fact the compiler already shipped that no reviewer could ever
             # see without reading `output/<surah>/corpus.json` by hand.
             # This exact field was independently found and deliberately
             # left the prior night: v3-D238's own sweep agent verified it
             # directly and its closing note named it by field, lower-
             # consequence than that night's own fix, left for a future
             # run. Fixed, mirroring `MentalModelPanel.tsx`'s own template
             # (the closest sibling — a surah-level, not per-ayah,
             # diagnostic): `Corpus["meta"]` gains an optional
             # `generatedFrom?: string[]`; a new `components/workbench
             # /GeneratedFromPanel.tsx` renders the list, or an honest "No
             # provenance recorded for this corpus subset." when absent —
             # never fabricated — wired into `WorkbenchIsland.tsx` beside
             # `MentalModelPanel`. Read-only, no write path, no
             # learner-facing consequence.
             #
             # RED confirmed directly: 2 new cases in
             # `test/workbench-ui.test.tsx` (49 pre-existing cases
             # untouched), run against the tree before either production
             # file was touched — both failed exactly as predicted,
             # `screen.findByRole("region", {name: /provenance/i})` timing
             # out, since no such region existed. The positive case uses the
             # frozen engine fixture's OWN real, pre-existing
             # `generatedFrom` value (`packages/engine/test/fixtures
             # /12.json` genuinely carries four v2-era source-file paths —
             # verified directly via a throwaway read before writing the
             # assertion) and asserts the panel renders all four verbatim,
             # so it cannot pass on a fabricated list; the negative case
             # deletes the field via destructuring and asserts both the
             # honest fallback sentence and the absence of the fixture's own
             # real paths — proving the fallback is a real distinct branch.
             # Reran: 51/51 green (was 49, +2).
             #
             # `TZ=UTC make test`: 2814 passing (was 2812, +2 — exactly this
             # run's two new tests; apps/web 1495, was 1493; no other suite
             # moved: 255 v2 vitest, 47 v2/api, 401 v3/api, 120
             # corpus-compiler, 433 engine, 63 fold-runner), exit 0.
             # `check-test-floor.mjs`: OK, 2814 >= floor 1899 (+915 margin,
             # unmoved, same discipline as every prior entry). `TZ=UTC make
             # build`: exit 0, 30 routes (unchanged — one new component, no
             # new route). `npm run gates`: all green (locked-css OK, 1
             # documented hunk, 294 v1 lines byte-identical; boundaries 320
             # files, up from 318 — confirmed as ONE genuine new production
             # file (`GeneratedFromPanel.tsx`) plus the same pre-existing
             # gitignored `next-env.d.ts` Next.js bootstrap-artifact
             # fluctuation v3-D206/D227/D231/D236 each already recorded,
             # confirmed via `git status --porcelain --ignored` and by the
             # FIRST `make build` in this fresh container (before
             # `next-env.d.ts` existed) reporting 318 for the identical
             # unmodified tree; fonts degraded-but-non-blocking,
             # pre-existing, 2/6 UI fonts present; corpus-morphology 362
             # words / corpus-glyphs 206 codepoints across 4 artifacts, both
             # unchanged — a diagnostic-only workbench-panel addition
             # carries no new corpus data). `npx tsc --noEmit`, run
             # separately across all four v3 node packages: clean in all
             # four. No PHP file changed, so `pint` was not applicable. No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff produced by running the suite was reverted
             # before committing, same discipline as every prior entry —
             # `git status --porcelain -- v1 v2` empty immediately before
             # committing). No Arabic codepoint (swept programmatically, in
             # Python, over every changed/new file's full contents, across
             # the Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks, plus a `\uXXXX`-escape and
             # `fromCharCode`/`fromCodePoint` mention check: CLEAN — every
             # new string is a TypeScript identifier, a docblock sentence,
             # or a file-path/version-tag string the compiler itself already
             # recorded, never corpus text). No oracle/golden-log/fixture/
             # snapshot regenerated. Session start: fresh container, no
             # `node_modules`/`vendor`/compiled corpus anywhere; `make
             # setup` ran clean from scratch, no retries needed. `HEAD` was
             # found detached at `5f98eba` (v3-D238), which `git fetch
             # origin main` then confirmed IS the true `origin/main` tip,
             # while the local `main` branch ref sat one commit behind at
             # `fcfe765` (v3-D229) — the recurring stale-local-`main` trap
             # this file has recorded roughly fifty times since v3-D77. No
             # work was at risk and nothing was unpushed; caught before any
             # exploration via `git fetch origin main`, then `git checkout
             # main && git merge --ff-only origin/main`, a clean
             # fast-forward. Found by directly re-reading v3-D238's own
             # closing note (it already named `CorpusMeta.generatedFrom` by
             # field, by shape, and by its own independent verification)
             # rather than dispatching a fresh sweep agent — independently
             # re-verified this run directly against `io.ts`,
             # `buildCorpus.ts`, `stage-corpus.mjs`, the real staged
             # `public/corpus/67.json`, the engine's `types.ts`, and the
             # frozen `12.json` fixture's own real `generatedFrom` value
             # before writing any test. NOT addressed: every item on
             # v3-D238's own "NOT addressed" list, unchanged —
             # `DrillPicker.tsx`'s own unused `now` prop; the unused
             # `atoms`/`corpus`/`sessions` IndexedDB object stores
             # (v3-D232); `session_start`'s own "app-open → first drill"
             # latency metric (v0.8); the streak/away-day day-space mismatch
             # (v3-D209); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()`; `App\Billing\TrialAttribution`
             # (v3-D148); `lib/pricing.ts#regionFromCountry()` (v3-D163);
             # `PaywallGate` as a whole class; multi-surah enrollment; the
             # operational mailer/7-night launch window; PAY-1's Stripe
             # fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`;
             # `MacroFacts.litany.rhymeLabel` (v3-D188); `StripeField.editable`
             # (v3-D204); `corpusHash`'s zero fold-side consumer (v3-D206);
             # FR5's queue-level restart/replan/makeup behavior (v3-D217);
             # `selection_determinism_check` still replaying a committed
             # fixture; `GlossDraftsPanel.tsx`'s hardcoded caption vs.
             # `shipping`/`excludedFromHashV1` (v3-D173, still
             # non-divergent as wired); `lib/test/build.ts`/`TestIsland.tsx`'s
             # `test_*` events still carrying no SITE coordinate (v3-D229) —
             # all unchanged. `CorpusMeta.generatedFrom` is now CLOSED —
             # remove it from future sweeps. See DECISIONS.md v3-D239.
             # NOTE (v3-D238, 2026-09-21): `components/plan/PlanIsland.tsx
             # #dueToday()`'s own comment read "Only the first, because the
             # Steady pace unlocks one new ayah a day" — true only for Steady.
             # `pace.ts` defines three real ceilings (Steady=1, Sprint=3,
             # Maintain=0) and the real session assembler already threads the
             # learner's actual pace through `candidatesForPace()` — but
             # `dueToday()` hardcoded exactly one `learn` candidate regardless
             # of mode, so `/plan`'s forecast silently undercounted a Sprint
             # learner's real capacity and fabricated a "Learn N" item (plus a
             # phantom future cold-gate projection, `forecast.ts
             # #concreteItems`) for a Maintain learner who can never
             # structurally unlock one — the "every ETA lies" class WIREFRAME
             # §14/E-06 exist to prevent, and the same "tested resolver
             # exists, the caller re-derives a narrower copy" shape as
             # `gateDue()` (v3-D227) and `gateStateOf()` (v3-D211/D212) on
             # this exact component. Fixed: `dueToday()` gains a
             # `pace: PaceMode = DEFAULT_PACE_MODE` parameter, collects every
             # unencoded ayah (mirroring `run.ts#learnCandidatesFor()`) and
             # hands them to `candidatesForPace()` instead of hand-capping at
             # the first one; `PlanIsland` gains a `paceMode` state resolved
             # in the same `readChoices()` effect v3-D221 already built
             # (`minutesPerDay` alone can't carry this — Maintain and Steady
             # share an 8 min/day budget but differ completely in what they
             # may unlock).
             #
             # RED confirmed directly: 5 new cases in
             # `test/plan-due-today.test.ts` (2 pre-existing `gateDue`
             # delegation cases untouched), run against the unmodified
             # function — 3 of 5 failed exactly as predicted (Sprint listing
             # only 1 instead of 3; Maintain listing 1 instead of 0; a
             # corpus-length-clamped Sprint case), while the 2 Steady-mode
             # cases passed vacuously, correctly, since Steady's ceiling of 1
             # was already the pre-existing behavior. Reran: 7/7 green (was
             # 2, +5). `npx vitest run test/plan-due-today.test.ts
             # test/plan-island.test.tsx test/plan-calendar.test.tsx
             # test/session-island.test.tsx`: 78/78 green — no regression on
             # any sibling `/plan`/`/session` consumer.
             #
             # `TZ=UTC make test`: 2812 passing (was 2807, +5 — exactly this
             # run's five new tests; apps/web 1493, was 1488; no other suite
             # moved: 255 v2 vitest, 47 v2/api, 401 v3/api, 120
             # corpus-compiler, 433 engine, 63 fold-runner), exit 0.
             # `check-test-floor.mjs`: OK, 2812 >= floor 1899 (+913 margin,
             # unmoved, same discipline as every prior entry). `TZ=UTC make
             # build`: exit 0, 30 routes (unchanged — one existing component
             # edited, no new route, component or production file). `npm run
             # gates`: all green (locked-css OK, 1 documented hunk, 294 v1
             # lines byte-identical; boundaries 319 files, unchanged count —
             # no new production file; fonts degraded-but-non-blocking,
             # pre-existing, 2/6 UI fonts present; corpus-morphology 362
             # words / corpus-glyphs 206 codepoints across 4 artifacts, both
             # unchanged — a plan-screen-only pace-wiring fix touches no
             # corpus data). `npx tsc --noEmit`, run separately across all
             # four v3 node packages: clean in all four. No PHP file changed,
             # so `pint` was not applicable. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff produced by running
             # the suite was reverted twice before committing, same
             # discipline as every prior entry — `git status --porcelain --
             # v1 v2` empty immediately before committing). No Arabic
             # codepoint (swept programmatically, in Python, over the diff's
             # own added lines, across the Arabic, Arabic Supplement, Arabic
             # Extended-A and both Presentation Forms Unicode blocks, plus a
             # `fromCharCode`/`fromCodePoint` mention check: CLEAN — every
             # new string is a TypeScript identifier or a fixed English
             # docblock/assertion sentence, never corpus text). No
             # oracle/golden-log/fixture/snapshot regenerated — this diff
             # touches one production file and one test file. Session start:
             # fresh container, no `node_modules`/`vendor`/compiled corpus
             # anywhere; `make setup` ran clean from scratch, no retries
             # needed. THE STALE-LOCAL-`main` TRAP RECURRED AGAIN: `HEAD` was
             # found detached at `a882c53` (v3-D237), which `git fetch origin
             # main` then confirmed IS the true `origin/main` tip, while the
             # local `main` branch ref sat eight commits behind at `fcfe765`
             # (v3-D229). No work was at risk and nothing was unpushed;
             # caught before any exploration via `git fetch origin main`,
             # then `git checkout main && git merge --ff-only origin/main`, a
             # clean fast-forward. Found by a dedicated fresh-sweep agent
             # (Explore) handed the full exclusion list carried through
             # v3-D237 and directed at recently-landed code, fold-runner,
             # corpus-compiler, and cross-file consistency between sibling
             # implementations of the same decision; it also independently
             # verified and ruled out `CorpusMeta.generatedFrom` (real,
             # shipped, genuinely undeclared and unread anywhere — left for a
             # future run, lower-consequence than a Plan-screen dishonesty
             # bug). NOT addressed: `CorpusMeta.generatedFrom` (above);
             # `DrillPicker.tsx`'s own unused `now` prop; the unused
             # `atoms`/`corpus`/`sessions` IndexedDB object stores (v3-D232);
             # `session_start`'s own "app-open → first drill" latency metric
             # (v0.8); the streak/away-day day-space mismatch (v3-D209);
             # `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`;
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate`
             # as a whole class; multi-surah enrollment; the operational
             # mailer/7-night launch window; PAY-1's Stripe fixtures; surah
             # 67's scene beats; `worker/fold-runner/src/severity.ts`'s
             # taxonomy drift (v3-D127); `packages/engine/src/placement.ts`;
             # `MacroFacts.litany.rhymeLabel` (v3-D188);
             # `StripeField.editable` (v3-D204); `corpusHash`'s zero
             # fold-side consumer (v3-D206); FR5's queue-level
             # restart/replan/makeup behavior (v3-D217);
             # `selection_determinism_check` still replaying a committed
             # fixture; `GlossDraftsPanel.tsx`'s hardcoded caption vs.
             # `shipping`/`excludedFromHashV1` (v3-D173, still non-divergent
             # as wired); `lib/test/build.ts`/`TestIsland.tsx`'s `test_*`
             # events still carrying no SITE coordinate (v3-D229) — all
             # unchanged. `PlanIsland.tsx#dueToday()`'s own pace-ceiling gap
             # is now CLOSED — remove it from future sweeps. See
             # DECISIONS.md v3-D238.
             # NOTE (v3-D237, 2026-09-21): `apps/web/lib/legal/attribution.ts
             # #attributionStrings()` — built specifically, per its own docblock,
             # "so a test can read the page's claims as data instead of scraping
             # markup", the same shape `lib/landing/copy.ts#landingStrings()`
             # uses to feed the SHARED v3-D19 claim detector
             # (`lib/landing/claims.ts#findClaims`/`findClaimsIn` — "the app
             # never claims to teach tajwid or replace a teacher... CI asserts
             # no landing or onboarding string makes either claim") — had
             # exactly ONE caller anywhere in the repo (`grep -rn
             # "attributionStrings"` confirmed it), and that caller was NOT the
             # shared detector: `test/attribution.test.tsx`'s own "claims no
             # endorsement" case ran a single hand-rolled, unscoped regex
             # (`/endorsed by|approved by|certified by|in partnership with/i`)
             # over it — a narrower, second, unaudited implementation of "does
             # this string make a claim it shouldn't", catching only
             # false-endorsement wording and NOTHING from the two categories
             # `findClaims` exists to catch (a tajwid-teaching/pronunciation
             # overclaim, or the app crediting itself for a learner's own
             # memorization). Every other landing/onboarding string in this
             # product is held to the ONE reviewed, heavily-negation-tested
             # detector, at TWO layers (`test/landing-claims.test.ts`'s runtime
             # check over `landingStrings()`, and `check-boundaries.mjs` clause
             # 11's source-level scan) — the attribution page, the one surface
             # whose entire purpose is a scrupulously accurate statement about
             # someone else's GPL-licensed work, was held to neither. NOT
             # cosmetic: a future edit to `lib/legal/attribution.ts` adding, say,
             # "helps you master tajwid using QAC's own morphology" would ship
             # silently — not caught by clause 11 (its own `CLAIM_SCOPE` is
             # deliberately landing/onboarding-only, v3-D19's literal text, and
             # `lib/legal/` is correctly not in it — widening that scope is a
             # separate, debatable product decision this run did NOT make, since
             # v3-D19 itself is scoped to "landing or onboarding string"), not by
             # `landing-claims.test.ts` (reads `landingStrings()` only, never
             # `attributionStrings()`), and not by the old endorsement-only
             # regex (wrong pattern family entirely). Fixed with ONE new test
             # case reusing the existing, already-negation-audited detector —
             # no production code changed, no new file, no scope widening:
             # `test/attribution.test.tsx` imports `findClaimsIn` from
             # `lib/landing/claims.ts` (the identical import
             # `landing-claims.test.ts` already uses) and asserts
             # `findClaimsIn(attributionStrings())` is empty, with a guard
             # (`strings.length > 5`) against the vacuous-pass shape this build
             # has shipped before (an emptied `attributionStrings()` would pass
             # trivially). RED confirmed by MUTATION, not by a live defect —
             # there was none; the current attribution copy is clean, so this
             # is a coverage fix, the same "test-only, no live behavior change"
             # shape as `lib/pricing-config-agreement.test.ts` (v3-D158),
             # `lib/entitlement/cache-config-agreement.test.ts` (v3-D150) and
             # `lib/macro/facts-agreement.test.ts` (v3-D137): a single sentence,
             # "This app teaches tajwid while you memorize.", was appended to
             # `CORRECTIONS` (the one string every existing test in the file
             # already reads, so the mutation could not accidentally dodge an
             # unrelated code path); the new test failed exactly as predicted —
             # `expected [ {…} ] to deeply equal []`, naming the caught sentence
             # and the matched fragment "teaches tajwid" — while the other 9
             # pre-existing cases in the file stayed green, unaffected. Reverted
             # byte-identically (`git diff --stat lib/legal/attribution.ts`
             # empty before re-running), reran: 10/10 green (was 9, +1).
             #
             # `TZ=UTC make test`: **2807 passing** (was 2806, +1 — exactly this
             # run's one new test; apps/web **1488**, was 1487; no other suite
             # moved: 255 v2 vitest, 47 v2/api, 401 v3/api, 120 corpus-compiler,
             # 433 engine, 63 fold-runner), exit 0. `check-test-floor.mjs`: OK,
             # 2807 >= floor 1899 (+908 margin, unmoved, same discipline as
             # every prior entry). `TZ=UTC make build`: exit 0, 30 routes
             # (unchanged — one existing test file edited, no new route,
             # component or production file). `npm run gates`: all green
             # (locked-css OK, 1 documented hunk, 294 v1 lines byte-identical;
             # boundaries 319 files — the `make build` prebuild chain itself
             # reported 318 on the FIRST build in this fresh container (no
             # `next-env.d.ts` yet), then 319 on a standalone `npm run gates`
             # run afterward — the same pre-existing gitignored Next.js
             # bootstrap-artifact fluctuation v3-D206/D227/D231/D236 each
             # already recorded, confirmed via `git status --porcelain
             # --ignored` showing that path as `!!`; no new production file
             # either way, since this diff is one test file; fonts
             # degraded-but-non-blocking, pre-existing, 2/6 UI fonts present;
             # corpus-morphology 362 words / corpus-glyphs 206 codepoints
             # across 4 artifacts, both unchanged — a test-only fix touches no
             # corpus data). `npx tsc --noEmit` (apps/web): clean, exit 0. No
             # PHP file changed, so `pint` was not applicable. No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff produced by running the suite was reverted
             # before committing, same discipline as every prior entry — `git
             # status --porcelain -- v1 v2` empty immediately before
             # committing). No Arabic codepoint (swept programmatically, in
             # Python, over the diff's own added lines, across the Arabic,
             # Arabic Supplement, Arabic Extended-A and both Presentation Forms
             # Unicode blocks, plus a `fromCharCode`/`fromCodePoint` mention
             # check: CLEAN — every new string is a TypeScript identifier, a
             # fixed English docblock/assertion sentence, or the mutation's own
             # synthetic English probe sentence, never corpus text; the probe
             # sentence itself was never committed). No oracle/golden-log/
             # fixture/snapshot regenerated — this diff touches one test file
             # only. Session start: fresh container, no
             # `node_modules`/`vendor`/compiled corpus anywhere; `make setup`
             # ran clean from scratch, no retries needed. THE STALE-LOCAL-`main`
             # TRAP RECURRED AGAIN, the same shape this file has recorded
             # roughly fifty times since v3-D77: `HEAD` was found DETACHED at
             # `9561e2b` (v3-D236), which `git fetch origin main` then
             # confirmed IS the true `origin/main` tip (`git ls-remote origin
             # main` agreed) — while the local `main` branch ref sat three
             # commits behind at `fcfe765` (v3-D229). No work was at risk and
             # nothing was unpushed; caught before any exploration via `git
             # fetch origin main`, then `git checkout main && git merge
             # --ff-only origin/main`, a clean fast-forward. Found by a
             # dedicated fresh-sweep agent (Explore) handed the full exclusion
             # list carried through v3-D236 and directed at Console Commands,
             # Middleware, `worker/fold-runner/src`, `packages/corpus-compiler
             # /src`, `apps/web/lib/library`/`onboarding`/`idb`, Eloquent model
             # relations, and a zero-external-caller export scan across
             # `apps/web/lib/**` — most candidates were already-closed or
             # already-excluded (recorded in the agent's own report so a future
             # sweep does not re-walk them); this was the one genuine,
             # previously-unreported instance, independently re-verified this
             # run directly against `attribution.ts`'s real source,
             # `attribution.test.tsx`'s real test list, `lib/landing/claims.ts`'s
             # real exports and `check-boundaries.mjs` clause 11's own
             # `CLAIM_SCOPE` before writing any test. NOT addressed: every item
             # on v3-D236's own "NOT addressed" list, unchanged —
             # `DrillPicker.tsx`'s own unused `now` prop; the unused `atoms`/
             # `corpus`/`sessions` IndexedDB object stores (v3-D232);
             # `session_start`'s own "app-open → first drill" latency metric
             # (v0.8); the streak/away-day day-space mismatch (v3-D209);
             # `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`;
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate` as
             # a whole class; multi-surah enrollment; the operational
             # mailer/7-night launch window; PAY-1's Stripe fixtures; surah
             # 67's scene beats; `worker/fold-runner/src/severity.ts`'s
             # taxonomy drift (v3-D127); `packages/engine/src/placement.ts`;
             # `MacroFacts.litany.rhymeLabel` (v3-D188); `StripeField.editable`
             # (v3-D204); `corpusHash`'s zero fold-side consumer (v3-D206);
             # FR5's queue-level restart/replan/makeup behavior (v3-D217);
             # `selection_determinism_check` still replaying a committed
             # fixture; `GlossDraftsPanel.tsx`'s hardcoded caption vs.
             # `shipping`/`excludedFromHashV1` (v3-D173, still non-divergent as
             # wired); `lib/test/build.ts`/`TestIsland.tsx`'s `test_*` events
             # still carrying no SITE coordinate (v3-D229) — all unchanged.
             # `attributionStrings()` is now held to the shared v3-D19
             # detector — remove it from future "second/narrower detector"
             # sweeps. See DECISIONS.md v3-D237.
             # NOTE (v3-D236, 2026-09-21): `lib/onboarding/surahs.ts` — the one
             # module that decides what a learner may ENROL in — opened with
             # two flat, confident, false statements about its own contents.
             # Its header read "Surah 67 IS NOT IN THIS BUILD. Verified
             # against ... manifest.json, which carries exactly three surahs:
             # 12 ..., 103 ..., 112 ..." while the manifest carries FOUR
             # (12/67/103/112 — confirmed this run by `make build`'s own
             # corpus-glyphs gate, "4 corpus artifact(s) (surahs 12, 67, 103,
             # 112)") and surah 67 sits in `OFFERED_SURAHS` SIXTY LINES BELOW
             # that claim, in the same file; and
             # `WIREFRAME_DEFAULT_SURAH`'s docblock read "see the header for
             # why it is not offered today", actively sending a reader to a
             # paragraph that would mislead them. Named explicitly by
             # v3-D232's own "NEWLY named and NOT addressed" list (by file, by
             # the exact false sentence, and by the second false docblock) and
             # repeated unchanged on every list from v3-D233 through v3-D235.
             # Documentation-only — no learner-facing behavior was ever wrong,
             # `OFFERED_SURAHS`/`DEFAULT_SURAH` were both already correct and
             # are byte-identical after this fix — but the same "docblock
             # claims X, reality is Y" shape v3-D90/D110/D124/D235 each
             # closed. Sharper than most of that class for one reason: the
             # ADJACENT test (`offers the wireframe's default IFF it is
             # compiled`) was written to FAIL the day 67 compiled, precisely
             # so a human would decide rather than drift — and it did fail,
             # and a human did decide (v3-D59, BUILD-PLAN Q3, 2026-08-11), and
             # that run updated the TEST's own comment ("only the title and
             # this comment moved, because the WORLD changed, not the rule")
             # while leaving the SOURCE file's header asserting the opposite.
             # The mechanism built to stop exactly this drift worked, and the
             # prose drifted anyway, because nothing pinned the prose.
             #
             # Fixed in two hunks, `lib/onboarding/surahs.ts` only, no
             # behavior change: the header's stale snapshot is replaced by the
             # real history plus the RULE rather than a membership count — "a
             # surah is offered IFF it is compiled", asserted both directions
             # by `test/onboarding.test.tsx` against the real
             # `output/manifest.json` — and now says in as many words DO NOT
             # RESTATE THE CURRENT MEMBERSHIP IN THIS COMMENT. That is the
             # substantive choice of the run: the fix is NOT "correct the
             # number to four", which would go stale again the next time the
             # launch set moves, it is "stop making a claim that can go
             # stale." `WIREFRAME_DEFAULT_SURAH`'s docblock now says why the
             # constant exists (the biconditional test asserts against it, and
             # it has been on BOTH sides of that biconditional), that it IS in
             # `OFFERED_SURAHS` today, and that it is still not
             # `DEFAULT_SURAH` — a separate choice whose own reasoning at
             # `DEFAULT_SURAH`'s declaration (Al-Asr at 3 ayat reaches the
             # first cold gate fastest, and the gate passing is what proves
             # the mechanism) is unchanged and still correct, exactly as
             # v3-D232 already noted when it named this gap.
             #
             # RED confirmed directly, TWICE: 2 new cases in
             # `test/onboarding.test.tsx`'s existing `screen 5 — the surahs
             # actually offered` describe block (its 3 pre-existing cases, and
             # the 28 others in the file, untouched), run against the
             # COMPLETELY UNMODIFIED source before either hunk was written
             # (`git status --porcelain` showed only the test file at the
             # time) — failed exactly `surah 67 is in OFFERED_SURAHS, so this
             # file must not also say it is absent: expected '// WHAT SCREEN 5
             # IS ALLOWED TO OFFER.…' not to match
             # /surah\s+67\b[\s\S]{0,160}?not in this build/i` and `expected
             # true to be false`; 2 failed / 31 passed. Then RE-CONFIRMED via
             # `git checkout --` of the production file alone (both new tests
             # kept, the fix restored afterward from a saved copy, not
             # re-typed) — identical two failures, 2 failed / 31 passed again
             # — before restoring byte-identically and rerunning green: 33/33
             # (was 31, +2). Both guards pin the AGREEMENT, never a wording,
             # and both are scoped to `OFFERED_SURAHS` itself, so the header
             # stays correct by construction for a surah that is genuinely
             # absent and neither case can be satisfied by deleting prose. The
             # second is a true biconditional (`claimsUnoffered ===
             # !offered`), the same shape as the neighbouring manifest test it
             # sits beside, so it cannot pass vacuously in either direction;
             # the first would have failed on the day 67 was added to the
             # list, which is the day this drift began.
             #
             # `TZ=UTC make test`: 2806 passing (was 2804, +2 — exactly this
             # run's two new tests; apps/web 1487, was 1485; no other suite
             # moved: 255 v2 vitest, 47 v2/api, 401 v3/api, 120
             # corpus-compiler, 433 engine, 63 fold-runner), exit 0.
             # `check-test-floor.mjs`: OK, 2806 >= floor 1899 (+907 margin,
             # unmoved). `TZ=UTC make build`: exit 0, 30 routes (unchanged —
             # two existing files edited, no new route, component or
             # production file). `npm run gates`: all green (locked-css OK, 1
             # documented hunk, 294 v1 lines byte-identical; boundaries 319
             # files, matching v3-D235's own count exactly — this run adds no
             # file at all, and the 318 the `prebuild` chain reported inside
             # `make build` is the same pre-existing gitignored
             # `next-env.d.ts` Next.js bootstrap-artifact fluctuation
             # v3-D206/D227/D231 each already recorded, confirmed directly
             # here TWO ways: `git status --porcelain --ignored` shows that
             # path as `!!`, and a SECOND `TZ=UTC make build` on this same
             # tree — run after the first build had created the artifact —
             # reported 319 from inside `prebuild` itself; fonts
             # degraded-but-non-blocking, pre-existing,
             # 2/6 UI fonts present; corpus-morphology 362 words /
             # corpus-glyphs 206 codepoints across 4 artifacts, both
             # unchanged — a comment-only fix touches no corpus data). `npx
             # tsc --noEmit`, run separately across all four v3 node packages:
             # clean in all four. No PHP file changed, so `pint` was not
             # applicable. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff produced by running
             # the suite was reverted before committing, same discipline as
             # every prior entry — `git status --porcelain -- v1 v2` empty
             # immediately before committing). No Arabic codepoint (swept
             # programmatically, in Python, twice — over both changed files'
             # full contents AND, separately, over only the diff's own added
             # lines — across the Arabic, Arabic Supplement, Arabic Extended-A
             # and both Presentation Forms Unicode blocks, plus a
             # `\u06xx`/`\u07xx`/`\u08xx`/`\uFBxx`/`\uFExx` escape and
             # `fromCharCode`/`fromCodePoint` sweep: CLEAN on all three
             # passes; every new string is a fixed English sentence, a
             # TypeScript identifier or a surah-number integer, and unlike
             # most files in this tree the TEST file here needed no coordinate
             # fixtures at all, since both new cases read source text). No
             # oracle/golden-log/fixture/snapshot regenerated — nothing under
             # `fixtures/`, `docs/qa-samples/` or any `*.json` artifact is in
             # this diff at all. Session start: fresh container, no
             # `node_modules`/`vendor`/compiled corpus anywhere; `make setup`
             # ran clean from scratch (exit 0 — several Composer dist
             # downloads for `v3/api` hit transient proxy timeouts and
             # recovered automatically via the documented git-mirror source
             # fallback, no retry flag needed). THE STALE-LOCAL-`main` TRAP
             # RECURRED: `HEAD` was found DETACHED at `ba7be06`, which `git
             # fetch origin main` then confirmed IS the true `origin/main` tip
             # (`git ls-remote origin main` agreed), while the local `main`
             # BRANCH REF sat six commits behind at `fcfe765` (v3-D229) — no
             # work at risk, nothing unpushed; caught before any exploration,
             # then `git checkout main && git merge --ff-only origin/main`, a
             # clean fast-forward. Found by re-reading v3-D232's own "NEWLY
             # named and NOT addressed" list directly rather than dispatching
             # a fresh sweep agent, and independently re-verified against
             # `surahs.ts`'s real source, the real `OFFERED_SURAHS`
             # membership, the neighbouring test's own comment and the
             # compiled manifest's real surah set before writing either test.
             # A repo-wide grep for the same shape was also run and is
             # recorded as a VERIFIED NEGATIVE so a future run does not
             # re-walk it: `grep -rn "three surahs|IS NOT IN THIS BUILD|not in
             # this build|not offered today"` across every
             # `.ts`/`.tsx`/`.php`/`.mjs` in `v3/` returned exactly three hits
             # — the two stale claims this entry fixes, plus
             # `lib/library/rows.ts:105`'s `STATUS_UNAVAILABLE = "not in this
             # build yet"`, which is a LIVE, dynamically-selected status
             # string for a surah that genuinely is not compiled, not a stale
             # comment, and is correctly left alone. This class of stale-prose
             # gap has no other instance in the v3 tree today. NOT addressed:
             # every item on v3-D235's own list, unchanged —
             # `DrillPicker.tsx`'s own unused `now` prop; the unused
             # `atoms`/`corpus`/`sessions` IndexedDB object stores (v3-D232);
             # `session_start`'s own "app-open -> first drill" latency metric
             # (v0.8); the streak/away-day day-space mismatch (v3-D209);
             # `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`;
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate`
             # as a whole class; multi-surah enrollment; the operational
             # mailer/7-night launch window; PAY-1's Stripe fixtures; surah
             # 67's scene beats; `worker/fold-runner/src/severity.ts`'s
             # taxonomy drift (v3-D127); `packages/engine/src/placement.ts`;
             # `MacroFacts.litany.rhymeLabel` (v3-D188); `StripeField.editable`
             # (v3-D204); `corpusHash`'s zero fold-side consumer (v3-D206);
             # FR5's queue-level restart/replan/makeup behavior (v3-D217);
             # `selection_determinism_check` still replaying a committed
             # fixture; `GlossDraftsPanel.tsx`'s hardcoded caption vs.
             # `shipping`/`excludedFromHashV1` (v3-D173, still non-divergent
             # as wired); `lib/test/build.ts`/`TestIsland.tsx`'s `test_*`
             # events still carrying no SITE coordinate (v3-D229) — all
             # unchanged. `lib/onboarding/surahs.ts`'s stale header is now
             # CLOSED, and GUARDED against re-drifting rather than merely
             # corrected — remove it from future sweeps. See DECISIONS.md
             # v3-D236.
             # NOTE (v3-D235, 2026-09-19): `AccountExportPanel.tsx`'s own
             # caption undersold its export by three tables. Named explicitly
             # by v3-D230's own "NEWLY named and NOT addressed" list and
             # repeated unchanged across v3-D231..D234: the caption read
             # "your profile and every drill event" — true the day the panel
             # shipped, stale the moment v3-D157 widened
             # `AccountController::export()` to also carry
             # `entitlement`/`entitlementTransitions`/`billingEvents`. The
             # FILE was never the gap — v3-D157's own test already proves the
             # downloaded bytes carry all three tables verbatim (the panel
             # serializes `result.data` directly, no field-by-field
             # re-assembly to drop one) — only the caption describing itself
             # to the learner reading it before they click "Download my
             # data" never caught up. Fixed: one sentence, "your profile and
             # every drill event" -> "your profile, every drill event, and
             # your billing and entitlement history" — no server/wire
             # change, both tables were already shipped and already
             # verified. A second, real catch along the way:
             # `check-boundaries.mjs` clause 9 (edge case #124, the
             # entitlement-read allowlist) correctly failed `make build` the
             # moment the caption said the word "entitlement" — the gate
             # working as designed. `lib/account/api.ts` (this panel's own
             # data-fetching counterpart) was already allowlisted for the
             # identical reason at v3-D157 ("reflects a learner's OWN
             # entitlement/entitlementTransitions rows back to them... a
             # read-only compliance surface, not an issuance/ingestion
             # decision"); `AccountExportPanel.tsx` is that file's direct UI
             # counterpart — it already downloaded this exact data (proven
             # by v3-D157's own test, unaffected by this fix) and calls no
             # `permitsIssuance`/`permitsReview` anywhere. Added
             # `components/settings/AccountExportPanel.tsx` to
             # `ENTITLEMENT_ALLOWLIST` with a comment naming this reasoning,
             # mirroring the v3-D157 entry's own template — a reviewable
             # act, per the clause's own invitation, not a workaround.
             # Rewording the caption to dodge the literal word instead was
             # considered and rejected: it would make the caption LESS
             # accurate for no real safety gain, since the file is
             # demonstrably not an enforcement point.
             #
             # RED confirmed directly: one new case in
             # `test/settings-ui.test.tsx`'s `AccountExportPanel` describe
             # block (17 pre-existing cases untouched), run against the
             # unmodified component, failed exactly `expected 'Download
             # everything recorded under yo…' to match /billing/i` — 1
             # failed, 16 passed. Restored after implementing: 17/17. The
             # test renders the panel with no fetch/click at all (the
             # caption is not state-derived) and asserts the caption
             # matches BOTH `/billing/i` and `/entitlement/i` — it cannot
             # pass on the old sentence or on a caption naming only one
             # table.
             #
             # `TZ=UTC make test`: 2804 passing (was 2803, +1 — exactly this
             # run's one new test; apps/web 1485, was 1484; no other suite
             # moved: 255 v2 vitest, 47 v2/api, 401 v3/api, 120
             # corpus-compiler, 433 engine, 63 fold-runner), exit 0.
             # `check-test-floor.mjs`: OK, 2804 >= floor 1899 (+905 margin,
             # unmoved). `TZ=UTC make build`: exit 0, 30 routes (unchanged —
             # one existing component edited, no new route/component file)
             # — first attempt failed on the boundaries clause above, second
             # attempt (after the allowlist fix) green. `npm run gates`: all
             # green (locked-css OK, 1 documented hunk, 294 v1 lines
             # byte-identical; boundaries 319 files, up from 318 — exactly
             # the one new test file, no new production file; fonts
             # degraded-but-non-blocking, pre-existing, 2/6 UI fonts
             # present; corpus-morphology 362 words / corpus-glyphs 206
             # codepoints, both unchanged — a caption-only fix touches no
             # corpus data). `npx tsc --noEmit`, run separately across all
             # four v3 node packages: clean in all four. No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff produced by running the suite was reverted
             # before committing). No Arabic codepoint (the three changed
             # files swept programmatically, in Python, over the Arabic,
             # Arabic Supplement, Arabic Extended-A and both Presentation
             # Forms Unicode blocks, plus a `\u06xx`/`\u07xx`/`\u08xx`/
             # `\uFBxx`/`\uFExx` escape and `fromCharCode`/`fromCodePoint`
             # sweep — a whole-file sweep of `check-boundaries.mjs` hit its
             # own PRE-EXISTING Unicode-range literals [the sacred-text
             # clause's own range definitions, unrelated to this diff],
             # confirmed clean by re-running the sweep restricted to only
             # this diff's added lines; every new string in the caption and
             # the test is a fixed English sentence, never corpus text). No
             # oracle/golden-log/fixture/snapshot regenerated. Session
             # start: fresh container, no
             # `node_modules`/`vendor`/compiled corpus anywhere; `make
             # setup` ran clean from scratch, no retries needed. `HEAD`,
             # local `main` and `origin/main` all already agreed at
             # `293adb8` (v3-D234) — no stale-ref trap this run, confirmed
             # directly via `git fetch origin main` before any exploration.
             # Found by re-reading v3-D230's own "NEWLY named and NOT
             # addressed" list directly (it already named this gap by file
             # and by the exact fields missing from the caption) rather than
             # dispatching a fresh sweep agent — independently re-verified
             # directly against `AccountExportPanel.tsx`'s real source,
             # `AccountController::export()`'s real response shape, and the
             # existing v3-D157 test before writing any new test. Two other
             # named candidates were investigated first and deliberately set
             # aside, recorded so they are not re-investigated from scratch:
             # (1) `GlossDraftsPanel.tsx`'s hardcoded caption vs. its live
             # `shipping`/`excludedFromHashV1` booleans (v3-D173) —
             # re-confirmed both fields are genuinely non-divergent as
             # currently wired: `shipping` is a literal `false` on every
             # response, and `excludedFromHashV1` (real and dynamic on the
             # SERVER) can never be observed as anything but `true` from
             # this panel, because `GlossDraftsPanel.tsx` hardcodes `const
             # LANG = "ms"` and `"ms"` is never in `HASH_READ_LANGS =
             # ['en']` — wiring the caption to these fields today would
             # render a permanently-true chip, not a real signal, matching
             # v3-D173's own "left alone" reasoning exactly; (2)
             # `packages/engine/src/types.ts#CorpusVerse.line` —
             # re-confirmed still the exact non-gap v3-D194 already
             # excluded: the COMPILER's own `Verse` type has no `line` field
             # at all, only `page`, with its own docblock stating why ("a
             # per-verse line number is not well-defined once an ayah
             # crosses a line boundary... the line drill reads word-level
             # `Word.line` instead") — the engine's `CorpusVerse.line` is
             # declared but genuinely never populated by anything, a dead
             # field rather than a computed-and-unconsumed one, a different
             # shape from this bug class entirely. NOT addressed: every item
             # on v3-D234's own list, unchanged — `DrillPicker.tsx`'s own
             # unused `now` prop (investigated directly this run:
             # `buildDrillPreview`/every function under `lib/drill/` takes
             # no `now` at all — the atom-readiness decision this picker
             # previews is purely `atom.encoded`-based, not time-based, so
             # there is no natural consumer for it today; wiring one in
             # would mean inventing a new time-sensitive decision in
             # `lib/drill/preview.ts`, real but separate, larger-scoped
             # work); the unused `atoms`/`corpus`/`sessions` IndexedDB
             # object stores (v3-D232, investigated directly this run:
             # genuinely zero writer AND zero reader anywhere, not merely an
             # unconsumed computed value — `SessionRow`'s own docblock names
             # a `/quiz/[sessionId]` route that does not exist, so there is
             # no existing mechanism to wire a caller to; building one from
             # scratch is real, separate, larger-scoped work); `session_start`'s
             # own "app-open -> first drill" latency metric (v0.8); the
             # streak/away-day day-space mismatch (v3-D209); `rhymeClassOf()`
             # (v3-D136); `EntitlementMachine::merge()`;
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate`
             # as a whole class; multi-surah enrollment; the operational
             # mailer/7-night launch window; PAY-1's Stripe fixtures; surah
             # 67's scene beats; `worker/fold-runner/src/severity.ts`'s
             # taxonomy drift (v3-D127); `packages/engine/src/placement.ts`;
             # `MacroFacts.litany.rhymeLabel` (v3-D188); `StripeField.editable`
             # (v3-D204); `corpusHash`'s zero fold-side consumer (v3-D206);
             # FR5's queue-level restart/replan/makeup behavior (v3-D217);
             # `selection_determinism_check` still replaying a committed
             # fixture; `lib/test/build.ts`/`TestIsland.tsx`'s `test_*`
             # events still carrying no SITE coordinate (v3-D229);
             # `lib/onboarding/surahs.ts`'s stale header comment about surah
             # 67 (v3-D232) — all unchanged. `AccountExportPanel.tsx`'s own
             # caption is now CLOSED for its missing billing/entitlement
             # mention — remove it from future sweeps. See DECISIONS.md
             # v3-D235.
             # NOTE (v3-D234, 2026-09-19): `MacroPanelIsland.tsx`'s own `broken`
             # branch discarded `state.reason` — named explicitly by v3-D232's
             # own "NEWLY named and NOT addressed" list as the ONE of nine
             # log-reading islands whose `broken` branch did not render it.
             # Every sibling (`PlanIsland`, `ProgressListIsland`,
             # `AyahStatsIsland`, `GrowthIsland`, `RetentionIsland`,
             # `TestHistoryIsland`, `SurahAyahListIsland`, `MySurahs`) prints
             # `Reason: <code>{state.reason}</code>` — this panel printed a
             # single fixed sentence with no reason at all, and
             # `ProgressListIsland`'s own comment already states why that
             # matters: "'you're in private browsing' and 'another tab is
             # mid-upgrade' are not the same problem." Low-consequence but
             # real — every page that mounts the macro panel also mounts a
             # sibling island that does name the reason — v3-D232 correctly
             # scoped it as real but not urgent, not as a non-gap.
             #
             # Fixed on the exact `AyahStatsIsland.tsx#AyahStatsView` /
             # `SurahAyahListIsland.tsx#SurahAyahListView` template: the hook
             # call stays in `MacroPanelIsland`, and a new EXPORTED pure
             # `MacroPanelView({state, surah, ayahCount, facts, now,
             # highlight})` owns the state -> render mapping, so a test can
             # hand it each `LogState` directly rather than mocking
             # IndexedDB. The `broken` branch's copy gains one clause,
             # `Reason: <code>{state.reason}</code>.`, between the existing
             # two sentences — no other branch changed, no wire/engine
             # change, `role="status"` on this panel kept as-is (this panel
             # never used the `role="alert"` banner class its siblings do,
             # and widening that was not this fix's job).
             #
             # RED confirmed directly: `git stash` of the one production
             # file alone (the new `test/macro-panel-island.test.tsx` kept)
             # failed all 3 new cases on `MacroPanelView` not existing
             # (`Element type is invalid... expected undefined`); `git stash
             # pop` restored the fix byte-identically, 3/3 green. Two of the
             # three cases seed DIFFERENT reasons (`private-mode` vs.
             # `another-tab-mid-upgrade`) on separate renders and assert
             # each one's own reason is present and the other's is absent,
             # so the fix cannot pass on one hardcoded string; the third
             # confirms `pending` is unaffected (still the skeleton, never a
             # number). `npx vitest run test/macro-ring.test.tsx
             # test/ayah-detail.test.tsx test/surah-ayah-list.test.tsx`:
             # 88/88 green, unchanged — no regression on any sibling
             # consumer of `MacroPanel`/`MacroPanelIsland`.
             #
             # `TZ=UTC make test`: 2803 passing (was 2800, +3 — exactly this
             # run's three new tests; apps/web 1484, was 1481; no other
             # suite moved: 255 v2 vitest, 47 v2/api, 401 v3/api, 120
             # corpus-compiler, 433 engine, 63 fold-runner), exit 0.
             # `check-test-floor.mjs`: OK, 2803 >= floor 1899 (+904 margin,
             # unmoved, same discipline as every prior entry). `TZ=UTC make
             # build`: exit 0, 30 routes (unchanged — one existing component
             # edited, no new route or component file). `npm run gates`:
             # all green (locked-css OK, 1 documented hunk, 294 v1 lines
             # byte-identical; boundaries 319 files, up from 318 — exactly
             # the one new test file, no new production file; fonts
             # degraded-but-non-blocking, pre-existing, 2/6 UI fonts
             # present; corpus-morphology 362 words / corpus-glyphs 206
             # codepoints, both unchanged — a display-only client-component
             # fix touches no corpus data). `npx tsc --noEmit` (apps/web):
             # clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff produced by
             # running the suite was reverted before committing, same
             # discipline as every prior entry — `git status --porcelain --
             # v1 v2` empty immediately before committing). No Arabic
             # codepoint (both changed/new files swept programmatically, in
             # Python, over the Arabic, Arabic Supplement, Arabic
             # Extended-A and both Presentation Forms Unicode blocks, plus a
             # `\u06xx`/`\u07xx`/`\u08xx`/`\uFBxx`/`\uFExx` escape and
             # `fromCharCode`/`fromCodePoint` sweep — zero matches; every
             # new string is a TypeScript identifier, a fixed English
             # sentence, or a synthetic closed-set reason placeholder
             # ("private-mode", "another-tab-mid-upgrade"), never corpus
             # text). No oracle/golden-log/fixture/snapshot regenerated.
             # Session start: fresh container, no
             # `node_modules`/`vendor`/compiled corpus anywhere; `make
             # setup` ran clean from scratch, no retries needed. `HEAD` was
             # found detached at `39fea6a` (v3-D233) on a STALE local `main`
             # branch ref four commits behind (`fcfe765`, v3-D229) — the
             # recurring "stale local main" trap this file has recorded
             # roughly fifty times since v3-D77 — caught before any
             # implementation work via `git fetch origin main` (which
             # confirmed the TRUE `origin/main` was already at `39fea6a`,
             # matching `HEAD` exactly — no unpushed work at risk) followed
             # by `git checkout main && git merge --ff-only origin/main`, a
             # clean fast-forward. Found by re-reading v3-D232's own
             # "NEWLY named and NOT addressed" list directly (it already
             # named this gap by file and by the exact sibling convention it
             # violates) rather than dispatching a fresh sweep agent —
             # independently re-verified directly against
             # `MacroPanelIsland.tsx`'s real source and `useLogState.ts`'s
             # `LogState`/`broken` shape before writing any test. NOT
             # addressed: every item on v3-D233's own "NOT addressed" list,
             # unchanged — `DrillPicker.tsx`'s own unused `now` prop;
             # `session_start`'s own "app-open -> first drill" latency
             # metric (v0.8); `CorpusVerse.line`; the streak/away-day
             # day-space mismatch (v3-D209); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate`
             # as a whole class (v3-D88, v3-D151); multi-surah enrollment;
             # the operational mailer/7-night launch window; PAY-1's Stripe
             # fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); `MacroFacts.litany.rhymeLabel`
             # (v3-D188); `StripeField.editable` (v3-D204); `corpusHash`'s
             # own zero fold-side consumer (v3-D206); FR5's own queue-level
             # behavior for "restart"/"replan"/"makeup" (v3-D217);
             # `selection_determinism_check` still replaying a committed
             # fixture; `GlossDraftsPanel.tsx`'s own hardcoded caption
             # (v3-D173); `lib/test/build.ts`/`TestIsland.tsx`'s own
             # `test_*` events still carrying no SITE coordinate (v3-D229's
             # own deliberate deferral); `AccountExportPanel.tsx`'s stale
             # caption (v3-D230); `lib/onboarding/surahs.ts`'s stale
             # header comment about surah 67 (v3-D232); the unused
             # `atoms`/`corpus`/`sessions` IndexedDB object stores
             # (v3-D232) — all unchanged. `MacroPanelIsland.tsx`'s own
             # `broken` branch is now CLOSED for its missing reason —
             # remove it from future sweeps. See DECISIONS.md v3-D234.
             # NOTE (v3-D233, 2026-09-19): `DrillEvent.gradeClass` — one of
             # the fields build-plan step 10 froze into the wire ONCE,
             # COMPLETE (v3-D10) — had NO PRODUCER anywhere in the product.
             # Its own docblock (`packages/engine/src/types.ts`) states the
             # contract it never met: "The GradeClass (`gradeClass.ts`,
             # v3-D11) this event's rung was resolved from, via
             # `gradeClassToWire()` — carried ALONGSIDE the already-resolved
             # `rung`, never instead of it." Every one of the THIRTEEN emit
             # sites in the product holds the `GradeClass` literal in its
             # hand, passes it through `gradeClassToWire()` to produce
             # `rung`, and then throws the class away: `grep -rn
             # "gradeClass:" apps/web/{lib,components,app}` (minus tests)
             # returned NOTHING before this fix. Everything downstream of
             # the emit was already built for it and only the emit was
             # missing — the same shape as `corpusHash` (v3-D206), `locale`
             # (v3-D213), `latency` (v3-D222) and `siteKey`/`visitOrdinal`
             # (v3-D227): `packages/engine/src/events.ts#makeEvent` declares
             # and stamps it (`MakeEventArgs.gradeClass`, events.ts:47,83);
             # `wire-freeze.test.ts` has round-tripped it since step 10 and
             # structurally asserts `rebuild.ts` never reads it; Laravel has
             # had an `events.grade_class` column, a `FIELD_MAP` entry
             # (`'gradeClass' => 'grade_class'`), a `NULLABLE_FIELDS` entry,
             # an `Event` `$fillable` entry and a symmetric `toWire()`
             # mapping since the step-14 migration — `EventsIngestionTest`
             # even asserts `gradeClass: 's2_partial'` persists as
             # `grade_class` — and `EventWireCodec` forwards it to the
             # fold-runner. Nothing ever sent a value. NOT COSMETIC,
             # because the mapping is MANY-TO-ONE: `GRADE_CLASS_TO_RUNG`
             # sends BOTH `gate` and `s3_full` to rung `"S3"`, so a stored
             # `rung: "S3"` does not name the class it was graded as. A
             # reader can guess today from the event's own `type`, but that
             # is a CALLER CONVENTION (`run.ts` happens to pair `gate` with
             # `gate_result`), not a fact the log records — and
             # `gradeClass` is precisely the field built to record it.
             # v3-D26 flags the whole mapping "for reconsideration once
             # M4's spec-driven question compiler lands", and the day any
             # mapping changes, events written under the old one are only
             # interpretable if they carry the class they were graded as;
             # an event log is append-only, so a class never written can
             # never be backfilled — the same unbackfillable-provenance
             # argument v3-D206/v3-D227 each made. Fixed in three
             # production files, no wire change, no schema change, no
             # migration, no backend change (the column, the codec and the
             # round-trip all already existed): `lib/session/run.ts` (9
             # sites), `lib/plan/awayDay.ts` (1), `components/test/
             # TestIsland.tsx` (3). The two completed-pass sites inside
             # `answerAfterTap` now resolve `const passClass: GradeClass =
             # adv.full ? "s3_full" : "s2_partial"` ONCE and derive BOTH
             # fields from that single binding, so the pair cannot drift;
             # the other eleven stamp their own literal beside the
             # `gradeClassToWire()` call that consumes it. DELIBERATELY NOT
             # a shared `gradeFields()` pair-helper, which was the first
             # design considered and rejected on a concrete ground:
             # `run.test.ts` mocks `@engine/gradeClass.ts` with a
             # `gradeClassToWireSpy` seam and v3-D83's own wiring test
             # proves every emitted rung reflects that override — a helper
             # calling `gradeClassToWire` through its module-internal
             # binding would bypass the spy and silently vacate that
             # guard. Keeping the 13 `rung:` keys also keeps
             # `check-boundaries.mjs` clause 14's ("no-hardcoded-rung")
             # covered surface at 13 sites rather than shrinking it to
             # zero. Drift is instead forbidden MECHANICALLY at runtime by
             # a log-wide invariant test (below) rather than by
             # construction at the call site. RED confirmed directly,
             # TWICE: 5 new cases (3 in `lib/session/run.test.ts`, 1 in
             # `lib/plan/awayDay.test.ts`, 1 in `test/test-island.test.tsx`)
             # were run against the tree BEFORE any production file was
             # touched (`git status --porcelain` on all three confirmed
             # empty at the time) and failed exactly as predicted —
             # `expected undefined to be "gate"`, `expected [ 's3_full',
             # 's2_partial' ] to include undefined`, `expected undefined to
             # be defined`, `expected undefined to be "ungraded"` (×2); 4
             # failed / 98 passed across the first two files, 1 failed / 6
             # passed in the third. Then RE-CONFIRMED via `git checkout --`
             # of the three production files alone (all 5 new tests kept,
             # restored afterward from a saved copy, not re-typed) —
             # identical failures, 5 failed / 104 passed of 109 — before
             # restoring the fix and rerunning green: 109/109 (run.test.ts
             # 97, was 94; awayDay 5, was 4; test-island 7, was 6). The
             # load-bearing case is the cold gate: it asserts the
             # `gate_result`'s `rung` IS `"S3"` and that
             # `gradeClassToWire("s3_full")` equals that same rung —
             # demonstrating the ambiguity in the test itself — and only
             # then that `gradeClass` is `"gate"`, so it cannot pass on a
             # value the rung already determined. A second case proves a
             # real completed pass carries `s3_full`/`s2_partial` (never
             # "ungraded", never undefined) and an intermediate tap carries
             # `rc`. The third is the anti-drift invariant: over EVERY
             # event a real session wrote, `gradeClassToWire(e.gradeClass)
             # === e.rung` — which forbids the pair diverging at any emit
             # site, present or future, without a test going red. One
             # supporting engine case was added to
             # `packages/engine/test/gradeClass.test.ts` and is HONESTLY
             # NOT a RED case: it documents the existing mapping's
             # many-to-oneness (`gate` and `s3_full` both -> "S3", and the
             # distinct-rung count is strictly less than the class count),
             # which was already true and is the reason the producer
             # matters. `TZ=UTC make test`: 2800 passing (was 2794, +6 —
             # exactly this run's six new tests; engine 433, was 432;
             # apps/web 1481, was 1476; no other suite moved: 255 v2
             # vitest, 47 v2/api, 401 v3/api, 120 corpus-compiler, 63
             # fold-runner), exit 0. `check-test-floor.mjs`: OK, 2800 >=
             # floor 1899 (+901 margin, unmoved, same discipline as every
             # prior entry). `TZ=UTC make build`: exit 0, 30 routes
             # (unchanged — three existing files edited, no new route or
             # component). `npm run gates`: all green (locked-css OK, 1
             # documented hunk, 294 v1 lines byte-identical; boundaries 318
             # files, unchanged count — no new production file — with
             # clause 14 `no-hardcoded-rung` itself passing; fonts
             # degraded-but-non-blocking, pre-existing, 2/6 UI fonts
             # present; corpus-morphology 362 words / corpus-glyphs 206
             # codepoints, both unchanged — an event-provenance-only fix
             # touches no corpus data). `npx tsc --noEmit`, run separately
             # across all four v3 node packages: clean in all four. No PHP
             # file changed this run, so `pint` was not applicable. No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff produced by running the suite was reverted
             # before committing, same discipline as every prior entry —
             # `git status --porcelain -- v1 v2` empty immediately before
             # committing). No Arabic codepoint (the full diff swept
             # programmatically, in Python, over the Arabic, Arabic
             # Supplement, Arabic Extended-A and both Presentation Forms
             # Unicode blocks, plus a `\u06xx`/`\u07xx`/`\u08xx`/`\uFBxx`/
             # `\uFExx` escape and `fromCharCode`/`fromCodePoint` sweep —
             # zero matches across all 215 added lines; every new string is
             # a TypeScript identifier, a closed-set `GradeClass` literal,
             # or a fixed English docblock sentence, never corpus text). No
             # oracle/golden-log/fixture/snapshot regenerated. Session
             # start: fresh container, no `node_modules`/`vendor`/compiled
             # corpus anywhere; `make setup` ran clean from scratch, no
             # retries needed. `HEAD`, local `main` and `origin/main` all
             # already agreed at `a169a16` (v3-D232) — no stale-local-main
             # trap this run, confirmed directly via `git fetch origin
             # main` AND `git ls-remote origin main` before any
             # exploration. Found by a fresh mechanical sweep this run,
             # after four OTHER veins came back clean and are recorded here
             # as verified negatives so a future run does not re-walk them:
             # (1) every custom Laravel config key now has a production
             # reader (the vein that produced v3-D149/D150 is exhausted);
             # (2) every application migration column has a reader — the
             # only no-reader columns left are Laravel's own framework
             # tables (`cache`, `jobs`, `job_batches`, `sessions`,
             # `personal_access_tokens`), closing the vein that produced
             # v3-D151/D168/D176/D223/D225/D230; (3) a PHP public-method
             # zero-caller scan over all of `api/app` surfaced only
             # already-deferred items (`TrialAttribution`,
             # `AccountDeletionRequest::isDue`) plus framework hooks; (4)
             # the client->server->fold field round-trip is complete —
             # `EventsController`'s `NULLABLE_FIELDS` carries every
             # `DrillEvent` field, `toWire()` mirrors it symmetrically, and
             # `EventWireCodec` forwards every field `rebuild.ts` actually
             # reads (verified field-by-field against rebuild's own reads:
             # type/ts/surah/ayah/rung/correct/pretest/stepKind/structured).
             # A zero-external-caller export scan over every TS package was
             # also run; after correcting a filter bug that wrongly
             # excluded `lib/test/`+`components/test/`, every remaining hit
             # was an in-file helper, a test-only helper
             # (`attributionStrings`, `findClaimsIn` — both genuinely
             # consumed by their own suites), or an already-deferred item.
             # Independently re-verified directly against `types.ts`,
             # `gradeClass.ts`, `events.ts`, `EventsController.php`,
             # `EventWireCodec.php` and all 13 emit sites before writing
             # any test. NOT addressed: every item on v3-D232's own "NOT
             # addressed" list, unchanged — `DrillPicker.tsx`'s own unused
             # `now` prop; `session_start`'s own "app-open -> first drill"
             # latency metric (v0.8); `CorpusVerse.line`; the streak/
             # away-day day-space mismatch (v3-D209); `rhymeClassOf()`
             # (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution`
             # (v3-D148); `lib/pricing.ts#regionFromCountry()` (v3-D163);
             # `PaywallGate` as a whole class (v3-D88, v3-D151);
             # multi-surah enrollment; the operational mailer/7-night
             # launch window; PAY-1's Stripe fixtures; surah 67's scene
             # beats; `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); `MacroFacts.litany.rhymeLabel`
             # (v3-D188); `StripeField.editable` (v3-D204); `corpusHash`'s
             # own zero fold-side consumer (v3-D206); FR5's own queue-level
             # behavior for "restart"/"replan"/"makeup" (v3-D217);
             # `selection_determinism_check` still replaying a committed
             # fixture; `GlossDraftsPanel.tsx`'s own hardcoded caption
             # (v3-D173); `lib/test/build.ts`/`TestIsland.tsx`'s own
             # `test_*` events still carrying no SITE coordinate (v3-D229's
             # own deliberate deferral — this fix gives those events their
             # grade PROVENANCE, which is a different field and does not
             # touch that deferral); `AccountExportPanel.tsx`'s stale
             # caption (v3-D230) — all unchanged. NEWLY named and NOT
             # addressed: `components/macro/MacroPanelIsland.tsx` is the
             # ONE of nine log-reading islands whose `broken` branch
             # discards `state.reason` — every sibling
             # (`PlanIsland`/`ProgressListIsland`/`AyahStatsIsland`/
             # `GrowthIsland`/`RetentionIsland`/`TestHistoryIsland`/
             # `SurahAyahListIsland`/`MySurahs`) renders `Reason:
             # <code>{state.reason}</code>`, and `ProgressListIsland`'s own
             # comment says why ("'you're in private browsing' and
             # 'another tab is mid-upgrade' are not the same problem");
             # real but low-consequence, since every page that mounts the
             # macro panel also mounts a sibling island that DOES name the
             # reason. Also newly named: `lib/onboarding/surahs.ts`'s file
             # header still says "Surah 67 IS NOT IN THIS BUILD... exactly
             # three surahs", stale since 67 was compiled and added to
             # `OFFERED_SURAHS`, and `WIREFRAME_DEFAULT_SURAH`'s own
             # docblock ("see the header for why it is not offered today")
             # is now false — documentation-only, `DEFAULT_SURAH = 103`
             # remains a deliberate, separately-reasoned choice. And the
             # `atoms`/`corpus`/`sessions` IndexedDB object stores have no
             # writer or reader at all (`SessionRow`'s docblock names a
             # `/quiz/[sessionId]` route that does not exist) — dead
             # schema, the `CorpusVerse.line` class v3-D194 already
             # excluded, recorded so it is not re-found as new.
             # `DrillEvent.gradeClass` is now CLOSED — remove it from
             # future "no producer" sweeps. See DECISIONS.md v3-D233.
             # NOTE (v3-D232, 2026-09-19): `App\Mail\DeterminismP1Alert` — the
             # P1 pager mailer, the highest-severity artifact in this codebase
             # — never mentioned `report['deadLetters']` (edge case #130's
             # dead-letter quarantine: a real `{userId, error}` pair per
             # learner `DeterminismCheckCommand::sampleFromDatabase()` had to
             # skip because their event/atom data would not `json_encode`,
             # merged into the FOLD report by `runFold()`). v3-D230's own "NOT
             # addressed" list named this exactly as the direct mailer-side
             # sibling of the `trigger` gap v3-D229 closed one night earlier:
             # `report['deadLetters']` already reached the admin console's
             # `NightlyWindowPanel` (v3-D230's `lastQuarantine`), but the
             # SAME array, sitting in the SAME `NightlyCheckRun.report` this
             # mailer already reads four other keys from
             # (`divergentCount`/`skewCount`/`atomsCompared`/`usersChecked`),
             # never reached the page a 3am on-call engineer actually reads.
             # Concretely: a P1 that ALSO quarantined a learner paged with no
             # hint that any learner had been skipped — an on-call engineer
             # reading "Divergent atoms: 1, Atoms compared: 12, Learners
             # sampled: 3" had no way to know two OTHER sampled learners were
             # silently excluded from that comparison entirely, dead-lettered
             # before the fold-runner ever saw them. Fixed, fold branch only
             # (dead letters are a fold-only concept — `sampleFromDatabase()`
             # is per-learner DB sampling; the selection check replays a
             # committed fixture log and has no per-learner sample to
             # quarantine, so its own report shape carries no `deadLetters`
             # key at all, matching v3-D215's own "two shapes share no field
             # names" discipline): `content()`'s fold branch gains
             # `'deadLetterCount' => count($report['deadLetters'] ?? [])`;
             # the blade view gains one conditional paragraph, rendered only
             # when the count is greater than zero — a negative sibling test
             # proves this is a real signal, not permanent chrome painted on
             # every fold email regardless of whether anyone was actually
             # quarantined. NO RAW LEARNER ID: this mailer's own header is
             # explicit that an SMTP-relayed, externally-logged email carries
             # no PII, only counts and the check/night identity — the admin
             # console (v3-D204/v3-D230's own pseudonymized readers) is where
             # the per-learner detail already lives, behind the audited
             # reveal path; this page only ever gets a COUNT plus a pointer
             # to that console, never a `userId`, matching every other count
             # this mailer already carries. RED confirmed directly, TWICE:
             # 3 new cases in `DeterminismP1PagerTest.php` (9 pre-existing
             # cases untouched) were run against the tree BEFORE either
             # production file was touched — the load-bearing positive case
             # (two seeded dead letters with distinct, deliberately
             # non-colliding six-digit `userId` values and error strings)
             # failed exactly `Failed asserting that ... contains
             # "dead-lettered"`; both negative cases (`deadLetters` key
             # entirely absent; the key present but explicitly `[]` — the
             # two distinct shapes `runFold()`'s own `array_merge` can
             # actually produce on a clean night) passed vacuously and
             # correctly, since the unmodified mailer never printed
             # "dead-lettered" for any input. Then RE-CONFIRMED via `git
             # checkout --` of the two production files alone (all three new
             # tests kept, restored from a saved copy afterward, not
             # re-typed) — identical failure, 11 of 12 passed, same message
             # — before restoring the fix and rerunning green: 12/12 (was 9,
             # +3), 49 assertions (was 45, +4 — the load-bearing case itself
             # carries five assertions: the real count, the "dead-lettered"
             # and "System Health" pointer strings present, and both raw
             # `userId` values and the raw error string absent). `php artisan
             # test` (v3/api, full suite): 401 passing (was 398, +3; 2
             # incomplete + 6 skipped unchanged, PAY-1). `./vendor/bin/pint
             # --test` on both changed PHP files: passed. `TZ=UTC make
             # test`: 2794 passing (was 2791, +3 — exactly this run's three
             # new tests; v3/api 401, was 398; no other suite moved: 255 v2
             # vitest, 47 v2/api, 120 corpus-compiler, 432 engine, 63
             # fold-runner, 1476 apps/web — apps/web genuinely unchanged,
             # this diff touches no apps/web file at all), exit 0.
             # `check-test-floor.mjs`: OK, 2794 >= floor 1899 (+895 margin,
             # unmoved, same discipline as every prior entry). `TZ=UTC make
             # build`: exit 0, 30 routes (unchanged — a Laravel-mailer-and-
             # view-only fix, no apps/web file touched). `npm run gates`:
             # all green (locked-css OK, 1 documented hunk, 294 v1 lines
             # byte-identical; fonts degraded-but-non-blocking, pre-existing,
             # 2/6 UI fonts present; boundaries 318 files, unchanged count —
             # no apps/web file in this diff at all; corpus-morphology 362
             # words / corpus-glyphs 206 codepoints, both unchanged — a
             # backend-mailer-only fix touches no corpus data). `npx tsc
             # --noEmit`, run separately across all four v3 node packages:
             # clean in all four (none of them touch PHP, confirming this
             # diff genuinely stayed backend-only). No `v1/**`/`v2/**` edit
             # (a stray `v2/tsconfig.tsbuildinfo` build-cache diff produced
             # by running the suite was reverted before committing, same
             # discipline as every prior entry — `git status --porcelain --
             # v1 v2` empty immediately before committing). No Arabic
             # codepoint (the full diff of all three changed files swept
             # programmatically, in Python, over the Arabic, Arabic
             # Supplement, Arabic Extended-A and both Presentation Forms
             # Unicode blocks, plus a `fromCharCode`/`fromCodePoint` and
             # `\u06xx`/`\u07xx`/`\u08xx`/`\uFBxx`/`\uFExx` escape sweep —
             # zero matches; every new/changed string is a PHP identifier, a
             # wire-adjacent field name, a fixed English docblock/prose
             # sentence, or a synthetic six-digit test-fixture `userId`
             # chosen specifically to avoid colliding with any other
             # rendered integer in the same email, never corpus text). No
             # oracle/golden-log/fixture/snapshot regenerated. Session
             # start: fresh container, no `node_modules`/`vendor`/compiled
             # corpus anywhere; `make setup` ran clean from scratch, no
             # retries needed. `HEAD`, local `main` and `origin/main` did
             # NOT already agree: `git fetch origin main` advanced
             # `origin/main` from `fcfe765` (v3-D229, this worktree's
             # starting `HEAD`) to `6d274b7` (v3-D231) — two commits
             # (v3-D230, v3-D231) genuinely pushed by two other sessions
             # since this worktree was created — fast-forwarded via `git
             # merge --ff-only` before any exploration, the same recurring
             # "stale local main" trap this file has recorded roughly fifty
             # times since v3-D77, caught before any implementation work.
             # Found by re-reading v3-D230's own "NOT addressed" list
             # directly (it already named this gap by file, field and
             # reason, calling it "the direct mailer-side sibling of this
             # fix, the same shape v3-D229 closed for `trigger`") rather
             # than dispatching a fresh sweep agent — independently
             # re-verified directly against `DeterminismCheckCommand.php`'s
             # `runFold()`/`sampleFromDatabase()`, `DeterminismP1Alert.php`,
             # its blade view, and `NightlyWindowController.php`'s own
             # `lastQuarantine` reader before writing any test, confirming
             # the fold-only scope (selection has no dead letters to carry)
             # and the no-raw-userId discipline this mailer's own header
             # already states. NOT addressed: every item on v3-D231's own
             # "NOT addressed" list, unchanged — `DrillPicker.tsx`'s own
             # unused `now` prop; `session_start`'s own "app-open -> first
             # drill" latency metric (v0.8); `CorpusVerse.line`; the
             # streak/away-day day-space mismatch (v3-D209); `rhymeClassOf()`
             # (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution`
             # (v3-D148); `lib/pricing.ts#regionFromCountry()` (v3-D163);
             # `PaywallGate` as a whole class (v3-D88, v3-D151); multi-surah
             # enrollment; the operational mailer/7-night launch window
             # (this fix makes a quarantine visible on BOTH the P1 page and
             # the admin console; it still needs a live SMTP account and a
             # host running the schedule); PAY-1's Stripe fixtures; surah
             # 67's scene beats; `worker/fold-runner/src/severity.ts`'s
             # taxonomy drift (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); `MacroFacts.litany.rhymeLabel` (v3-D188);
             # `StripeField.editable` (v3-D204); `corpusHash`'s own zero
             # fold-side consumer (v3-D206); FR5's own queue-level behavior
             # for "restart"/"replan"/"makeup" (v3-D217);
             # `selection_determinism_check` still replaying a committed
             # fixture rather than production logs; `GlossDraftsPanel.tsx`'s
             # own hardcoded caption vs. its live `shipping`/
             # `excludedFromHashV1` booleans (v3-D173);
             # `lib/test/build.ts`/`TestIsland.tsx`'s own `test_*` events
             # still carrying no site coordinate (v3-D229's own deliberate
             # deferral); `AccountExportPanel.tsx`'s stale caption
             # (v3-D230's own newly-named item, unchanged) — all unchanged.
             # `DeterminismP1Alert` now names its own dead-lettered learners
             # — remove it from future "NOT addressed" lists. See
             # DECISIONS.md v3-D232.
             # NOTE (v3-D231, 2026-09-18): `GlossDraftReviewRow.actorKind`
             # (`ai` | `human`) has been required and sent on every entry of
             # `gloss_draft_reviews`' append-only history since v3-D156
             # (`GlossDraftsController::toWire()`'s `reviews[]` map) — but
             # `GlossDraftsPanel.tsx`'s History `<details>` list, the one
             # screen built to show this trail, rendered `fromStatus`/
             # `toStatus`/`actor`/`note`/`createdAt` per entry and never
             # `actorKind`. Distinct from the DRAFT ROW's own `authorKind`
             # (rendered as "AI draft"/"human" since v3-D169) — that field
             # names who authored the CURRENT text; this one names who
             # performed EACH transition in the row's history, and the two
             # can genuinely disagree on the same draft. Reachable, not
             # theoretical: `store()`'s auto-un-review branch (editing a
             # `reviewed` row's text returns it to `draft`, DEFECTS.md#B3's
             # shape one layer up) stamps the new review row's `actor_kind`
             # from `$validated['authorKind']` — the SAME field the draft
             # form's own "Authored by" dropdown lets an admin set to "an AI
             # draft, pending human review" — while `review()`'s own explicit
             # approve/reject button always sends `actorKind: "human"` from
             # this one caller. So `gloss_draft_reviews` genuinely carries
             # both values today; only the render dropped the distinction.
             # Material to v3-D15/D20's own rule — "LLM MS... human review
             # mandatory before `reviewed`" — a reviewer auditing the history
             # to confirm a `reviewed` status was actually earned by a human
             # decision, not silently re-stamped by an AI-authored edit that
             # happened to land on a reviewed row, had no way to read that
             # fact. Fixed, display-only, no server/wire change: the history
             # `<li>` gains a trailing `(AI)`/`(human)` clause after the
             # reviewer's name. RED confirmed directly: `git stash` of
             # `GlossDraftsPanel.tsx` alone (the new test kept, 16
             # pre-existing cases in `test/gloss-drafts-panel.test.tsx`
             # untouched) failed exactly the new case —
             # `getAllByText(/\(human\)/i)` found nothing, since the
             # unmodified history `<li>` never prints `actorKind` at all; 16
             # of 17 passed. The test seeds TWO review entries on the SAME
             # row with DIFFERENT `actorKind` values (`"human"` then `"ai"`,
             # each with its own distinct `textAtReview`/`note`), so the
             # assertion cannot pass by reading one hardcoded value for both
             # entries. Restored byte-identically (`git diff` empty before
             # re-implementing), then implemented; reran: 17/17 green (was
             # 16, +1). `npx vitest run test/gloss-drafts-panel.test.tsx
             # lib/admin/`: 15 test files, 160/160 green — 17/17 in the
             # changed file, 143/143 across the other 14 `lib/admin/*.test.ts`
             # files, unaffected. `TZ=UTC make test`: 2791 passing (was 2790,
             # +1 — exactly this run's one new test; apps/web 1476, was
             # 1475; no other suite moved: 255 v2 vitest, 47 v2/api, 398
             # v3/api, 120 corpus-compiler, 432 engine, 63 fold-runner),
             # exit 0. `check-test-floor.mjs`: OK, 2791 >= floor 1899 (+892
             # margin, unmoved, same discipline as every prior entry).
             # `npm run -s typecheck` across all four v3 node packages
             # (inside `make test`): clean. `TZ=UTC make build`: exit 0, 30
             # routes (unchanged — a component-plus-existing-test change, no
             # new route or component file). `npm run gates`: all green —
             # locked-css OK (1 documented hunk, 294 v1 lines byte-
             # identical); fonts degraded-but-non-blocking, pre-existing,
             # 2/6 UI fonts present; boundaries 318 files (up from 317 —
             # confirmed via `git status --porcelain` to be the SAME
             # pre-existing gitignored Next.js `next-env.d.ts` bootstrap-
             # artifact fluctuation v3-D206's and v3-D227's own entries
             # already recorded, not a new production file — this diff
             # touches exactly two existing files); corpus-morphology 362
             # words / corpus-glyphs 206 codepoints, both unchanged — a
             # display-only admin-panel fix touches no corpus data. No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff produced by running the suite was reverted
             # before committing, same discipline as every prior entry —
             # `git status --porcelain -- v1 v2` empty immediately before
             # committing). No Arabic codepoint (both changed files and the
             # full diff swept programmatically, in Python, over the Arabic,
             # Arabic Supplement, Arabic Extended-A and both Presentation
             # Forms Unicode blocks, plus a `\u06xx`/`\u07xx`/`\u08xx`/
             # `\uFBxx`/`\uFExx` escape and `fromCharCode`/`fromCodePoint`
             # sweep — zero matches; every new string is a TypeScript
             # identifier, the fixed English words "AI"/"human", or a
             # synthetic English placeholder value matching this file's own
             # "NO MALAY CONTENT ANYWHERE" convention, never gloss or corpus
             # text). No oracle/golden-log/fixture/snapshot regenerated.
             # Session start: fresh container, no `node_modules`/`vendor`/
             # compiled corpus anywhere; `make setup` ran clean from scratch
             # (transient proxy timeouts on several Composer dist downloads
             # recovered automatically via the documented git-mirror source
             # fallback, no retry flag needed). `HEAD`, local `main` and
             # `origin/main` all already agreed at `de5bc59` (v3-D230) — no
             # stale-ref trap this run, confirmed directly via `git fetch
             # origin main` before any exploration. Found by a field-by-
             # field re-read of `GlossDraftsController::toWire()`'s
             # `reviews[]` shape against `GlossDraftsPanel.tsx`'s actual
             # history-render loop — the same technique that closed the
             # row-level sibling field (`authorKind`/`authoredBy`, v3-D169)
             # and the review-entry `createdAt` field (v3-D183) on this
             # exact panel, applied to the one remaining
             # `GlossDraftReviewRow` member neither of those runs touched;
             # independently re-verified directly against `GlossDraft.php`,
             # `GlossDraftReview.php`, the migration, and
             # `GlossDraftsController.php`'s `store()`/`review()` bodies
             # before writing any test — confirming the field is genuinely
             # reachable as `"ai"` via the auto-un-review branch, not merely
             # a defensive type with no live divergent value. Also swept
             # this run and confirmed clean or already-excluded:
             # `api/app/Console/Commands` (all six commands already fully
             # wired or deliberately CLI-only); `api/app` has no
             # `Jobs`/`Listeners`/`Events`/`Notifications`/`Policies`/
             # `Rules` directories at all (confirmed via `find`, not
             # assumed); `NightlyWindow.reason`/`windowReason` (already
             # wired end-to-end, re-confirmed directly); `App\Models\Spec`/
             # `App\Models\AdminRevealToken` (both already fully consumed by
             # their own real callers); `lib/library/rows.ts`'s `STATUS_*`
             # constants and `LibraryRow.practisable`/`.detailed` (already
             # feed the rendered `status` string, non-gaps matching
             # v3-D194's own precedent); `lib/legal/attribution.ts` (fully
             # wired into `/attribution`); `OverrideEditor.tsx`'s
             # `summarize()` (already renders `questionType` on the
             # `disable` branch). NOT addressed: every item on v3-D230's own
             # "NOT addressed" list, unchanged — `DrillPicker.tsx`'s own
             # unused `now` prop; `session_start`'s own "app-open -> first
             # drill" latency metric (v0.8); `CorpusVerse.line`; the
             # streak/away-day day-space mismatch (v3-D209); `rhymeClassOf()`
             # (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution`
             # (v3-D148); `lib/pricing.ts#regionFromCountry()` (v3-D163);
             # `PaywallGate` as a whole class (v3-D88, v3-D151); multi-surah
             # enrollment; the operational mailer/7-night launch window;
             # PAY-1's Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); `MacroFacts.litany.rhymeLabel`
             # (v3-D188); `StripeField.editable` (v3-D204); `corpusHash`'s
             # own zero fold-side consumer (v3-D206); FR5's own queue-level
             # behavior for "restart"/"replan"/"makeup" (v3-D217);
             # `selection_determinism_check` still replaying a committed
             # fixture rather than production logs; `GlossDraftsPanel.tsx`'s
             # own hardcoded caption vs. its live `shipping`/
             # `excludedFromHashV1` booleans (v3-D173);
             # `lib/test/build.ts`/`TestIsland.tsx`'s own `test_*` events
             # still carrying no site coordinate (v3-D229's own deliberate
             # deferral); `AccountExportPanel.tsx`'s stale caption;
             # `DeterminismP1Alert` not reporting dead letters — all
             # unchanged. `GlossDraftReviewRow.actorKind` is now CLOSED for
             # the admin console — remove it from future "no reader"
             # sweeps. See DECISIONS.md v3-D231.
             # NOTE (v3-D230, 2026-09-18): `nightly_check_runs.report
             # ['deadLetters']` — edge case #130's dead-letter quarantine
             # ("poison event wedges fold -> dead-letter quarantine; fold skips
             # + alerts", closed at v3-D114/D115), written by
             # `DeterminismCheckCommand::sampleFromDatabase()` as a real
             # `{userId, error}` pair for EVERY sampled learner whose own
             # event/atom rows cannot be `json_encode`d — had NO admin-facing
             # reader anywhere. `grep -rn "deadLetter" v3/api/app` returned
             # exactly two consumers before this fix, and neither names a
             # learner: `AtomCacheRebuilder`'s own (the separate, admin-
             # triggered REBUILD path, which v3-D204 already gave a real
             # per-learner reader) and `Cache::put('health:dead_letter_depth',
             # count($report['deadLetters'] ?? []))` — a bare DEPTH INTEGER,
             # rendered on `/settings/health`'s `SystemHealthPanel` as one more
             # numeric check row, naming neither the learner nor the reason.
             # `Admin\NightlyWindowController::findingsFor()` (v3-D178/D179)
             # only ever loads the ONE run that produced `lastP1`, and a dead
             # letter NEVER produces a P1 by construction — `runFold()` merges
             # PHP's dead letters in, upgrades an otherwise-green run to exit 3
             # / `severity: warn`, and says so in its own comment ("a
             # quarantined learner is never silently green, but is not by
             # itself proof of a genuine cache divergence either, so it never
             # pages a P1 on its own"). So the evidence sat in the row and
             # reached nobody. Sharper than the usual "computed, zero reader"
             # shape because of what the LEDGER does with a WARN:
             # `NightlyWindowLedger::nights()` scores a night green when every
             # check is `green` OR `warn` (its own rule 3 — "a WARN does NOT
             # reset, and does not break the chain", so an engine deploy's
             # version skew cannot make the gate unreachable). A learner whose
             # log is unencodable is therefore skipped, never folded, never
             # compared — and the night still counts toward BUILD-PLAN M10's
             # 7-consecutive-green-nights LAUNCH GATE, rendering on
             # `NightlyWindowPanel` as `fold_determinism_check=warn (schedule)`
             # with nothing else on screen. That is this ledger's own stated
             # failure mode ("an unobserved night must never read as a green
             # one") one level down: per learner instead of per night, with
             # both facts already sitting in the run row. Fixed on
             # `SystemHealthController::pseudonymizedDeadLetters()`'s exact
             # template (v3-D204, the sibling rebuild path's own reader), read-
             # only, no schema change and no ledger change:
             # `NightlyWindowController::index()` gains `lastQuarantine` — the
             # most recent run IN THE WINDOW whose report carries a non-empty
             # `deadLetters` — as `{night, check, entries:[{subjectPseudonym,
             # error}]}`, each raw `userId` replaced by the same HMAC
             # `Pseudonymizer` every other admin finding list uses (the raw
             # integer never reaches the wire), `null` — never a fabricated
             # empty list — when no run in the window quarantined anyone.
             # Window-scoped exactly as `NightlyWindowLedger::nights()` is,
             # including its undeclared-window case, so this screen never
             # points an operator at evidence from a window it is not counting.
             # `NightlyWindowLedger` itself is untouched — it stays learner-
             # identity-free as documented (edge case #169), the same split
             # v3-D178 already drew. `lib/admin/nightlyWindow.ts` gains
             # `NightlyWindowQuarantine`/`NightlyWindowQuarantineEntry` and a
             # `parseLastQuarantine()` that degrades a missing OR half-shaped
             # value to `null` rather than a partial object;
             # `NightlyWindowPanel.tsx` renders it as its own block beneath the
             # P1 alert (deliberately NOT inside `lastP1Findings`, since a dead
             # letter is not a P1's evidence), one `<li>` per skipped learner.
             # RED confirmed at all three layers via `git stash` of the three
             # production files (every new test kept), restored byte-identically
             # after. Backend: 1 of 13 `NightlyWindowTest` cases failed exactly
             # `Failed asserting that null is identical to '2026-09-02'` — the
             # load-bearing case, which FIRST asserts the quarantined night
             # still reads `green: true` and still advances the streak to 2
             # (the exact lie this fix closes) and only then asserts the
             # quarantine is named; its two negative siblings (no quarantine ->
             # null; a quarantine from BEFORE the window start is not reported)
             # passed vacuously against the unmodified controller, correctly,
             # since a missing key already reads null. Frontend lib: 2 of 17
             # `nightlyWindow.test.ts` cases failed — `expected { night:
             # '2026-09-02', …(2) } to be null` (a half-shaped entry was passed
             # straight through) and `expected undefined to be null` — while
             # the round-trip case passed VACUOUSLY and was left in with that
             # noted in its own comment: JS does not strip an unrecognized JSON
             # property just because a TS interface omits it, so `{...body}`
             # already carried `lastQuarantine` through, exactly the trap
             # v3-D225 recorded; only the malformed-degrades case can be RED
             # here. Panel: 1 of 13 `nightly-window-panel.test.tsx` cases
             # failed on `getByText(/u_abc123/)` timing out, seeding TWO
             # entries with DIFFERENT pseudonyms and DIFFERENT errors so one
             # hardcoded line cannot satisfy it, and asserting in the same case
             # that the night's own row still reads
             # `fold_determinism_check=warn (schedule)`; its negative sibling
             # (no quarantine -> no block at all) passed vacuously, correctly,
             # proving the block is a real signal rather than permanent chrome.
             # Restored, reran: 13/13 backend (was 10, +3; 69 assertions),
             # 17/17 lib (was 14, +3), 13/13 panel (was 11, +2). `php artisan
             # test` (v3/api): 398 passing (was 395, +3; 2 incomplete + 6
             # skipped unchanged, PAY-1) — re-run IN FULL after a late
             # hardening edit to the controller (a null/non-array `report` is a
             # real shape when scanning every run in a window, unlike
             # `findingsFor()`'s single known-good run), not merely the filtered
             # file. `./vendor/bin/pint --test`: `NightlyWindowController.php`
             # passed; `NightlyWindowTest.php` reports the identical
             # pre-existing `fully_qualified_strict_types`/`ordered_imports`
             # findings both BEFORE and AFTER this diff, confirmed directly by
             # stashing the change and re-running pint — pre-existing drift this
             # fix does not introduce, left alone, same discipline as v3-D219's
             # and v3-D225's own precedents. `TZ=UTC make test`: 2790 passing
             # (was 2782, +8 — exactly this run's eight new tests: 3 v3/api + 5
             # apps/web; v3/api 398, was 395; apps/web 1475, was 1470; no other
             # suite moved: 255 v2 vitest, 47 v2/api, 120 corpus-compiler, 432
             # engine, 63 fold-runner), exit 0. `check-test-floor.mjs`: OK, 2790
             # >= floor 1899 (+891 margin, unmoved, same discipline as every
             # prior entry). `TZ=UTC make build`: exit 0, 30 routes (unchanged —
             # a controller-plus-existing-panel change, no new route or
             # component file). `npm run gates`: all green (locked-css OK, 1
             # documented hunk / 294 v1 lines byte-identical; boundaries 317
             # files, unchanged count — no new production file, three existing
             # files edited plus their three existing test files; fonts
             # degraded-but-non-blocking, pre-existing, 2/6 UI fonts present;
             # corpus-morphology 362 words / corpus-glyphs 206 codepoints, both
             # unchanged — a nightly-ledger-reader-only fix, no corpus data
             # touched). `npm run typecheck` across all four v3 node packages
             # (inside `make test`): clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff produced by running
             # the suite was reverted before committing, same discipline as
             # every prior entry — `git status --porcelain -- v1 v2` empty
             # immediately before committing). No Arabic codepoint (all six
             # changed files AND the full diff swept programmatically, in
             # Python, over the Arabic, Arabic Supplement, Arabic Extended-A and
             # both Presentation Forms Unicode blocks, plus a `\u06xx`/`\u07xx`/
             # `\u08xx`/`\uFBxx`/`\uFExx` escape and `fromCharCode`/
             # `fromCodePoint` sweep — zero matches; every new string is a
             # PHP/TS identifier, a wire field name, an ISO night date, a
             # synthetic `u_...`-shaped pseudonym placeholder matching this
             # codebase's own convention, a real `json_encode` error message, or
             # a fixed English docblock/caption sentence, never corpus text). No
             # oracle/golden-log/fixture/snapshot regenerated. Session start:
             # fresh container, no `node_modules`/`vendor`/compiled corpus
             # anywhere; `make setup` ran clean from scratch, no retries needed.
             # `HEAD`/local `main`/`origin/main` all already agreed at `fcfe765`
             # (v3-D229) — no stale-local-main trap this run, confirmed directly
             # via `git fetch origin main` AND `git ls-remote origin main`
             # before any exploration. Found by a fresh sweep this run — a
             # PHP-response-key-vs-TS-reader scan over all of `api/app` against
             # every `.ts`/`.tsx` in the tree (the reverse of the wire-field
             # sweeps v3-D227 ran) surfaced `deadLetter` as a camelCase wire-
             # shaped key with no TypeScript reader anywhere; independently
             # re-verified by reading `DeterminismCheckCommand::runFold()`/
             # `sampleFromDatabase()`, `NightlyWindowLedger::nights()`'s own
             # green-includes-warn rule, `SystemHealthController
             # ::deadLetterDepth()` and `NightlyWindowController::findingsFor()`
             # directly before writing any test. Also swept and found clean or
             # already-excluded: a zero-caller export scan over every
             # `packages/engine/src` module (`placement.ts`/`selectFor`/
             # `seedFromKey` all already deferred; `rotation.ts#stride` has a
             # real in-file caller); an unread-prop scan over every
             # `components/**/*.tsx` (clean); an interface-field-vs-external-
             # reader scan over every `apps/web/lib/**` module (all hits were
             # in-file label builders or JSON-download payload fields, not
             # gaps); and `lib/landing/claims.ts`'s own detector, re-confirmed
             # NOT duplicated by `check-boundaries.mjs` clause 11 — that gate
             # EXTRACTS the pattern literals from `claims.ts`'s source text
             # rather than copying them, so there is one definition, by
             # construction. NOT addressed: every item on v3-D229's own "NOT
             # addressed" list, unchanged — `DrillPicker.tsx`'s own unused `now`
             # prop; `session_start`'s own "app-open -> first drill" latency
             # metric (v0.8); `CorpusVerse.line`; the streak/away-day day-space
             # mismatch (v3-D209); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate` as
             # a whole class (v3-D88, v3-D151); multi-surah enrollment; the
             # operational mailer/7-night launch window (this fix makes a
             # quarantine VISIBLE on the window screen; it still needs a live
             # SMTP account and a host running the schedule); PAY-1's Stripe
             # fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift (v3-D127);
             # `packages/engine/src/placement.ts` (v3-D111/D113/D123);
             # `MacroFacts.litany.rhymeLabel` (v3-D188); `StripeField.editable`
             # (v3-D204); `corpusHash`'s own zero fold-side consumer (v3-D206);
             # FR5's own queue-level behavior for "restart"/"replan"/"makeup"
             # (v3-D217); `lib/test/build.ts`/`TestIsland.tsx`'s own `test_*`
             # events still carrying no site coordinate (investigated directly
             # this run and left DELIBERATELY: `siteKey` alone would be safe,
             # but stamping its sibling `visitOrdinal` on a Test item would burn
             # ordinals in the same per-site namespace `replaySelection` reads,
             # making a replayed production trace diverge against visits nobody
             # was served — a half-fix or a hazard, not a one-line sibling of
             # v3-D214, and worth its own night's reasoning);
             # `selection_determinism_check` still replaying a committed fixture
             # rather than production logs; `GlossDraftsPanel.tsx`'s own
             # hardcoded caption vs. its live `shipping`/`excludedFromHashV1`
             # booleans (v3-D173) — all unchanged. NEWLY named and NOT
             # addressed: `AccountExportPanel.tsx`'s caption promises "your
             # profile and every drill event" while `AccountController::export`
             # also ships `entitlement`/`entitlementTransitions`/`billingEvents`
             # — the FILE is complete (this is not a PDPA gap), only its own
             # one-sentence description of itself is stale; and
             # `DeterminismP1Alert` still reports no dead letters at all, so a
             # P1 that ALSO quarantined a learner pages without that fact — the
             # direct mailer-side sibling of this fix, the same shape v3-D229
             # closed for `trigger`. The nightly check's own dead-letter
             # quarantine is now CLOSED for the admin console — remove it from
             # future "no reader" sweeps. See DECISIONS.md v3-D230.
             # NOTE (v3-D229, 2026-09-18): `App\Mail\DeterminismP1Alert` — the
             # mailer `DeterminismCheckCommand::pageOnCall()` sends for every
             # confirmed P1 (the highest-severity signal in this codebase — it
             # resets the 7-consecutive-green-nights launch gate) — took the
             # WHOLE `NightlyCheckRun` model in its constructor but
             # `content()` never read `$run->trigger` (`schedule`/`manual`/
             # `ci`) on either of its two report-shape branches. v3-D225 (the
             # immediately preceding decision) gave that SAME field its first
             # real reader, the admin console's `NightlyWindowPanel`
             # (`fold_determinism_check=green (schedule)` vs `...(manual)`),
             # built precisely so a human could tell real unattended
             # automation from a manual re-run — but the field never reached
             # the OTHER real consumer of `NightlyCheckRun`, the page a 3am
             # on-call engineer actually reads. `grep -n "trigger"
             # app/Mail/DeterminismP1Alert.php resources/views/emails/
             # determinism-p1-alert.blade.php` returned nothing but an
             # unrelated word ("the triggering check") before this fix.
             # Concretely: an engineer paged at 3am had to separately open
             # `/settings/health`'s `NightlyWindowPanel` just to learn
             # whether tonight's P1 is the real unattended cron happening to
             # production right now or a manual/CI run they might already
             # know about — a question the page itself already had the data
             # to answer. Fixed: both `content()` branches gain `'trigger' =>
             # $this->run->trigger`; the blade view gains one new line,
             # `<p><strong>Triggered by:</strong> {{ $trigger }}.</p>`,
             # directly beneath the existing "Night: ... UTC" line. No wire
             # change, no schema change (the column already existed,
             # non-null on every real run), no report-shape change on either
             # FoldCheckReport/SelectionCheckReport — `trigger` lives on the
             # `NightlyCheckRun` row itself, not inside `report`. RED
             # confirmed directly: 2 new cases in `DeterminismP1PagerTest.php`
             # (7 pre-existing cases untouched) — a fold-shaped run built
             # with `trigger: 'schedule'` and a selection-shaped run built
             # with `trigger: 'ci'`, run against the unmodified mailer — both
             # failed exactly `Failed asserting that ... contains
             # "<strong>Triggered by:</strong> schedule."` / `"...ci."`; the
             # selection case's own two negative assertions
             # (`assertStringNotContainsString` for both `schedule.` and
             # `manual.`) prove the fix reads the RUN'S OWN trigger rather
             # than a hardcoded default — a hardcoded `'schedule'` string
             # would fail the selection case's positive assertion, a
             # hardcoded `'ci'` would fail the fold case's; only reading
             # `$this->run->trigger` satisfies both. Restored byte-
             # identically, reran: 9/9 green (was 7, +2), 41 assertions (was
             # 39). `php artisan test` (v3/api): 395 passing (was 393, +2; 2
             # incomplete + 6 skipped unchanged, PAY-1). `./vendor/bin/pint
             # --test` on both changed PHP files: passed. `TZ=UTC make
             # test`: 2782 passing (was 2780, +2 — exactly this run's two new
             # tests; v3/api 395, was 393; no other suite moved). `check-
             # test-floor.mjs`: OK, 2782 >= floor 1899 (+883 margin, unmoved,
             # same discipline as every prior entry). `TZ=UTC make build`:
             # exit 0, 30 routes (unchanged — a Laravel-mailer-and-view-only
             # fix, no apps/web file touched). `npm run gates`: all green
             # (boundaries 317/318 files — the one-file fluctuation is the
             # pre-existing gitignored Next.js `next-env.d.ts` bootstrap-
             # artifact drift this file has recorded before, confirmed via
             # `git status --porcelain -- v3/apps/web` showing no tracked
             # apps/web change in this diff at all; fonts degraded-but-non-
             # blocking, pre-existing, 2/6 UI fonts present; corpus-
             # morphology 362 words / corpus-glyphs 206 codepoints, both
             # unchanged — a backend-mailer-only fix, no corpus recompile
             # touched by this diff's own content). No `v1/**`/`v2/**` edit
             # (`git status --porcelain -- v1 v2` empty immediately before
             # committing — a stray `v2/tsconfig.tsbuildinfo` build-cache
             # diff produced by running the suite was reverted first, same
             # discipline as every prior entry). No Arabic codepoint (all
             # three changed files swept programmatically, in Python, over
             # the Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks, plus a `\u06xx`/`\u07xx`/
             # `\u08xx`/`\uFBxx`/`\uFExx` escape and `fromCharCode`/
             # `fromCodePoint` sweep — zero matches; every new/changed
             # string is a PHP identifier, a wire-adjacent field name, a
             # closed-set trigger literal, or a fixed English docblock/prose
             # sentence, never corpus text). No oracle/golden-log/fixture/
             # snapshot regenerated. Session start: fresh container, no
             # `node_modules`/`vendor`/compiled corpus anywhere; `make
             # setup` ran clean from scratch, no retries needed.
             # `HEAD`/local `main`/`origin/main` all agreed at `38a55f6`
             # (v3-D228) once `git fetch origin` refreshed the stale
             # remote-tracking ref and `git merge --ff-only` fast-forwarded
             # local `main` — no divergent unpushed work found. Found by a
             # dedicated fresh-sweep agent (Explore) handed the full
             # exclusion list carried through v3-D228 and directed one hop
             # downstream of that same decision's own fix — it checked
             # whether the SAME `trigger` field reached the OTHER real
             # consumer of `NightlyCheckRun`, the P1 pager mailer, and found
             # it did not; independently re-verified by this run directly
             # against `DeterminismP1Alert.php`, the blade view, and the
             # migration/model before writing any test. NOT addressed:
             # every item on v3-D228's own "NOT addressed" list, unchanged
             # — `DrillPicker.tsx`'s own unused `now` prop; `session_start`'s
             # own "app-open -> first drill" latency metric (v0.8);
             # `CorpusVerse.line`; the streak/away-day day-space mismatch
             # (v3-D209); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate`
             # as a whole class (v3-D88, v3-D151); multi-surah enrollment;
             # the operational mailer/7-night launch window (this fix makes
             # the PAGE itself carry the trigger fact — it still needs a
             # live SMTP account and a host running the schedule to page
             # anyone at all); PAY-1's Stripe fixtures; surah 67's scene
             # beats; `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); `MacroFacts.litany.rhymeLabel`
             # (v3-D188); `StripeField.editable` (v3-D204); `corpusHash`'s
             # own zero fold-side consumer (v3-D206); FR5's own queue-level
             # behavior for "restart"/"replan"/"makeup" (v3-D217);
             # `lib/test/build.ts`/`TestIsland.tsx`'s own `test_*` events
             # still carrying no site coordinate; `selection_determinism_check`
             # still replaying a committed fixture rather than production
             # logs; `GlossDraftsPanel.tsx`'s own hardcoded caption vs. its
             # live `shipping`/`excludedFromHashV1` booleans (v3-D173,
             # re-confirmed real but still non-divergent, left alone) — all
             # unchanged. `DeterminismP1Alert`'s own trigger gap is now
             # CLOSED — remove it from future "NOT addressed" lists. See
             # DECISIONS.md v3-D229.
             # NOTE (v3-D228, 2026-09-18): `components/plan/PlanIsland.tsx
             # #dueToday` re-derived `packages/engine/src/gate.ts#gateDue()`'s
             # predicate inline (`atom.gateDueAt !== null && !atom.gatePassed
             # && atom.gateDueAt <= now`) instead of calling the engine's own
             # tested resolver — the "tested resolver exists, the caller
             # re-derives it inline" shape this build has repeatedly closed
             # (`gradeClassToWire` v3-D83, `lastActiveDayMs` v3-D113,
             # `digestsMatch` v3-D159, `gateStateOf` v3-D211/D212 — the
             # closest precedent, two implementations of the same gate-state
             # decision that had already silently drifted apart). The inline
             # copy omitted `gateDue()`'s own `atom.encoded` term entirely.
             # Not a live divergence today — `applyGateResult` sets
             # `gateDueAt`/`encoded` together on a failure, `demoteToLearn`
             # resets both together, verified directly against both bodies —
             # but a standing invitation for a future engine change to update
             # one copy and miss the other, on the one caller in `apps/web`
             # that decided this fact without importing the function built to
             # decide it. Named explicitly by v3-D227's own "NOT addressed"
             # list one entry earlier. Fixed: `dueToday` (now exported, for
             # its own test only) imports and calls `gateDue` in place of the
             # inline boolean; no other line changed. RED confirmed directly:
             # 2 new cases in `test/plan-due-today.test.ts`, run against the
             # tree before `dueToday` was exported, failed on `TypeError:
             # dueToday is not a function`; the load-bearing case then
             # constructs a synthetic, currently-unreachable atom
             # (`encoded: false` with a past `gateDueAt`) — exactly the shape
             # `gateDue()` itself refuses and the OLD inline predicate would
             # have silently admitted — and asserts `dueToday(...).gates` is
             # empty; a positive sibling proves a genuinely due gate is still
             # listed, so the fix cannot pass by always returning empty.
             # Reran: 2/2 green. `npx vitest run test/plan-due-today.test.ts
             # test/plan-island.test.tsx test/plan-calendar.test.tsx
             # test/session-island.test.tsx
             # lib/progress/gateStateOf-agreement.test.ts`: 75/75 green — no
             # regression on either sibling `/plan` consumer or the closest
             # precedent fix. `TZ=UTC make test`: 2780 passing (was 2778,
             # +2 — exactly this run's two new tests; apps/web 1470, was
             # 1468; no other suite moved). `check-test-floor.mjs`: OK, 2780
             # >= floor 1899 (+881 margin, unmoved, same discipline as every
             # prior entry). `TZ=UTC make build`: exit 0, 30 routes
             # (unchanged — a `lib/`-level fix inside the existing `/plan`
             # component tree, no new route or component). `npm run gates`:
             # all green (boundaries 317 files, unchanged count — no new
             # production file, one existing file edited plus one new test
             # file; fonts degraded-but-non-blocking, pre-existing, 2/6 UI
             # fonts present; corpus-morphology 362 words / corpus-glyphs 206
             # codepoints, both unchanged — no new corpus data, this is a
             # pure `/plan`-only gate-predicate wiring fix). `npx tsc
             # --noEmit` (apps/web): clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff produced by running
             # the suite was reverted before committing, same discipline as
             # every prior entry — `git status --porcelain -- v1 v2` empty
             # immediately before committing). No Arabic codepoint (both
             # changed/new files swept programmatically, in Python, over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks, plus a `fromCharCode`/
             # `fromCodePoint` sweep — zero matches; every new string is a
             # TypeScript identifier, a fixed English docblock/comment
             # sentence, or a `${surah}:ayah:${n}` coordinate built from
             # integers, never corpus text). No oracle/golden-log/fixture/
             # snapshot regenerated. Session start: fresh container, no
             # `node_modules`/`vendor`/compiled corpus anywhere; `make setup`
             # ran clean from scratch, no retries needed. `HEAD`/local
             # `main`/`origin/main` all agreed at `ce5895d` (v3-D227) once
             # `git fetch origin main` + `git checkout main && git merge
             # --ff-only origin/main` ran — local `main` was a stale ref 26
             # commits behind (`26cc664`), the same recurring trap this file
             # has recorded roughly fifty times since v3-D77, caught before
             # any implementation work. Found by re-reading v3-D227's own
             # "NOT addressed" list directly (it already named this gap by
             # file, function and reason) rather than dispatching a fresh
             # sweep — independently re-verified against `dueToday`,
             # `gateDue`, `applyGateResult` and `demoteToLearn`'s real source
             # before writing any test. NOT addressed: every item on
             # v3-D227's own "NOT addressed" list, unchanged —
             # `DrillPicker.tsx`'s own unused `now` prop; `session_start`'s
             # own "app-open -> first drill" latency metric (v0.8);
             # `CorpusVerse.line`; the streak/away-day day-space mismatch
             # (v3-D209); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate`
             # as a whole class (v3-D88, v3-D151); multi-surah enrollment;
             # the operational mailer/7-night launch window; PAY-1's Stripe
             # fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); `MacroFacts.litany.rhymeLabel` (v3-D188);
             # `StripeField.editable` (v3-D204); `corpusHash`'s own zero
             # fold-side consumer (v3-D206); FR5's own queue-level behavior
             # for "restart"/"replan"/"makeup" (v3-D217);
             # `lib/test/build.ts`/`TestIsland.tsx`'s own `test_*` events
             # still carrying no site coordinate; `selection_determinism_check`
             # still replaying a committed fixture rather than production
             # logs — all unchanged. `PlanIsland.tsx#dueToday`'s own
             # `gateDue` duplication is now CLOSED — remove it from future
             # "NOT addressed" lists. See DECISIONS.md v3-D228.
             # NOTE (v3-D227, 2026-09-17): `DrillEvent.siteKey` and
             # `DrillEvent.visitOrdinal` — two of the eleven fields build-plan
             # step 10 froze into the wire ONCE, COMPLETE (v3-D10) — had NO
             # PRODUCER anywhere in the product. Everything downstream of the
             # emit was built for them and only the emit was missing:
             # `packages/engine/src/types.ts` declares both with an explicit
             # contract ("`site.ts#siteKey()` of the Site this event's item was
             # served from... Set for events tied to a served question; absent
             # for pure evidence events (interruption, session_start, ...)" and
             # "`site.ts#nextVisitOrdinal()`'s output, stamped AT EMIT TIME
             # (WIREFRAME.md §23 Q2 — 'record the ordinal, don't derive it')");
             # `lib/idb/db.ts`'s first upgrade created a dedicated `by_siteKey`
             # IndexedDB index for exactly one query; that query —
             # `lib/idb/read.ts#nextVisitOrdinalForSite()`, whose own docblock
             # quotes §23 Q2 and delegates the arithmetic to the engine's
             # `nextVisitOrdinal()` — has been unit-tested since build-plan
             # step 17 (four assertions in `append.test.ts`) with ZERO
             # production callers; and Laravel has had `events.site_key` /
             # `events.visit_ordinal` columns since the step-14 migration, with
             # `EventsController::FIELD_MAP`/`NULLABLE_FIELDS` and
             # `EventWireCodec` all carrying both, and
             # `lib/idb/schema.ts#toWire()` stripping only `syncedAt` — so both
             # would have round-tripped untouched. Nothing ever sent a value.
             # `grep -rn "siteKey:\|visitOrdinal:" apps/web/{lib,components,app}`
             # (minus tests) returned exactly three hits, NONE of them an
             # event: the index declaration, `nextVisitOrdinalForSite`'s own
             # parameter, and `lib/workbench/explain.ts`'s admin PREVIEW trace
             # (a siteKey computed for a screen, never for the log). Not
             # cosmetic: `visitOrdinal` is what makes a served question
             # REPLAYABLE — `packages/engine/src/selection.ts#replaySelection`,
             # the fold `selection_determinism_check` (build-plan step 12, one
             # of BUILD-PLAN M10's two launch-gate primitives, whose confirmed
             # P1 resets the 7-night window) is built on, opens with
             # `if (e.visitOrdinal === undefined || !e.deviceId) continue;` and
             # then `siteFromEvent(e)` returns null for any event with no
             # `siteKey`, so EVERY event a real learner has ever committed is
             # skipped and a replay of a real log yields an EMPTY trace: zero
             # keys compared, seed after seed, reported green. (The nightly
             # runs against a committed fixture today and says so honestly —
             # `DeterminismCheckCommand::runSelection`'s own `scope` string —
             # but that fixture stands in for exactly the production log this
             # gap empties.) And unlike a render gap it is UNBACKFILLABLE: §23
             # Q2 is "record the ordinal, don't derive it" precisely because a
             # visit ordinal cannot be recovered from a log that never carried
             # it. Same shape and same fix template as `corpusHash` (v3-D206)
             # and `locale` (v3-D213): resolve the fact once per visit, stamp
             # it on every event of that visit. Fixed in ONE production file,
             # `lib/session/run.ts` — no wire change, no migration, no
             # component change, no backend change: `SessionRun` gains
             # `siteVisit: SiteVisit | null` (`{cursor, siteKey,
             # visitOrdinal}`), scoped by `cursor` so that every path which
             # advances the cursor (`settleAnswer`, `advancePastCurrent`,
             # `startExtraLearn`, `startWeakSpotDrill`, `acceptGateDemote`)
             # invalidates it BY CONSTRUCTION via its own existing spread and
             # needed no edit; `siteForItem()` maps a `QueueItem` to its `Site`
             # off its own E-01 atom key, so a `connection` atom's site is the
             # SEAM at its ref, never the ayah site sharing that number
             # (`site.ts#siteToAtomKey` is the inverse — getting it backwards
             # would file a junction's visits in the ayah's ordinal namespace,
             # the exact collision `siteKey`'s three-part shape prevents);
             # `ensureSiteVisit()` resolves the pair ONCE per queue item,
             # lazily at the first tap (an IndexedDB read a started-and-
             # abandoned session must not pay for), memoized on `cursor` so one
             # visit yields one ordinal — re-resolving per event would burn an
             # ordinal per tap and make a replayed trace meaningless.
             # `answerCurrent` resolves before building any event and passes
             # the RESOLVED run into the continuation, so an ordinal can never
             # be resolved on one run object and stamped from another. Stamped
             # on `reconstruct_tap`, on both `ayah_produced` branches (the
             # ordinary completion and v3-D109's rescaffold warm-up) and on
             # `gate_result` — the served-question events and only those,
             # exactly as the field's own docblock scopes them;
             # `session_start`, `interruption`, `gate_demote`, `adoption` and
             # `day_marked_away` stay deliberately uncoordinated, since
             # painting a coordinate onto a pure evidence event would corrupt
             # `nextVisitOrdinalForSite`'s own max-of-recorded arithmetic with
             # ordinals nobody visited. RED confirmed directly, TWICE: 6 new
             # cases in a dedicated `lib/session/run.test.ts` describe block
             # (88 pre-existing cases untouched), run against the unmodified
             # `run.ts` (`git status --porcelain -- lib/session/run.ts` empty
             # at the time) — 5 of 6 failed exactly as predicted (`expected
             # undefined to be '112:ayah:1'`, twice; `expected [] to deeply
             # equal [1, 2]`; `expected 1 to be 2` — a row whose `siteKey` is
             # `undefined` is not in the `by_siteKey` index AT ALL, so
             # `nextVisitOrdinalForSite` reads 1 forever; and the load-bearing
             # consequence case, `expected 0 to be greater than 0`, which is
             # `replaySelection()` over a REAL session log returning an empty
             # trace). The 6th ("`session_start` carries no site coordinate")
             # passed vacuously and correctly — it guards the opposite failure.
             # Two of the six were then rewritten: one had failed for the WRONG
             # reason (`startDrillSession` correctly refused `none-ready`, since
             # a first session's Learn items complete as S2 and nothing is
             # ENCODED yet — it now uses FR6 Door 3 open practice, which needs
             # no encoding and additionally proves the ordinal advances for an
             # UNGRADED visit), and one asserted "more than one site was
             # visited", false for a virgin surah-112 session because the
             # Steady pace ceiling (v3-D138) unlocks exactly one new ayah a day
             # — made TRUE rather than weakened, by seeding two day-1 S3
             # completions so day 2 genuinely assembles two due cold gates. RED
             # was then RE-CONFIRMED against the reverted production file with
             # the rewritten tests kept: 5 failed / 89 passed again, same five
             # messages. Restored byte-identically, reran: 94/94 green (was 88,
             # +6). `npx vitest run lib/session/run.test.ts
             # test/session-island.test.tsx test/test-island.test.tsx
             # lib/session/assemble-lastactive.test.ts`: 136/136 green — no
             # regression on any session-loop consumer. `TZ=UTC make test`:
             # 2778 passing (was 2772, +6 — exactly this run's six new tests;
             # apps/web 1468, was 1462; no other suite moved: 255 v2 vitest, 47
             # v2/api, 393 v3/api, 120 corpus-compiler, 432 engine, 63
             # fold-runner). `check-test-floor.mjs`: OK, 2778 >= floor 1899
             # (+879 margin, unmoved, same discipline as every prior entry).
             # `TZ=UTC make build`: exit 0, 30 routes (unchanged — a
             # `lib/session/run.ts`-only change, no route or component
             # touched). `npm run gates`: all green (boundaries 317 files,
             # unchanged count — no new production file, one existing file
             # edited plus two existing test files; fonts degraded-but-non-
             # blocking, pre-existing, 2/6 UI fonts present; corpus-morphology
             # 362 words / corpus-glyphs 206 codepoints, both unchanged — no
             # corpus recompile produced new data, this is a session-loop-only
             # provenance fix). `npx tsc --noEmit`, run separately across all
             # four v3 node packages: clean in all four — making `siteVisit`
             # REQUIRED rather than optional surfaced eleven pre-existing
             # bare-literal `SessionRun` fixtures across `run.test.ts` and
             # `test/session-island.test.tsx` needing `siteVisit: null`, a
             # genuine compile-time catch of the same shape v3-D217's own
             # `lastActivityAt` produced, deliberately preferred over v3-D218's
             # optional-field precedent because "this run has not resolved a
             # visit yet" is a real state worth naming. No `v1/**`/`v2/**` edit
             # (a stray `v2/tsconfig.tsbuildinfo` build-cache diff produced by
             # running the suite was reverted before committing, same
             # discipline as every prior entry — `git status --porcelain -- v1
             # v2` empty immediately before committing). No Arabic codepoint
             # (all three changed files swept programmatically, in Python, over
             # the Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks, plus a `fromCharCode`/
             # `fromCodePoint`/`\u06xx`/`\u07xx`/`\u08xx`/`\uFBxx`/`\uFExx`
             # escape sweep — zero matches across 404 added lines and zero
             # across each whole file; every new string is a TypeScript
             # identifier, a wire field name, a `${surah}:ayah:${n}` coordinate
             # built from integers, or a fixed English docblock sentence, never
             # corpus text). No oracle/golden-log/fixture/snapshot regenerated.
             # Session start: fresh container, no `node_modules`/`vendor`/
             # compiled corpus anywhere; `make setup` ran clean from scratch
             # (transient proxy timeouts on several composer dist downloads
             # recovered automatically via the documented git-mirror source
             # fallback, no retry flag needed). THE STALE-REF TRAP RECURRED IN
             # ITS MOST MISLEADING FORM YET: this run was handed a briefing
             # stating `origin/main` was at `26cc664` while `HEAD` sat detached
             # 25 commits ahead, concluding ~25 prior nightly runs had committed
             # real work and never pushed it. That conclusion was FALSE and the
             # reading behind it was a STALE REMOTE-TRACKING REF — `git log -1
             # origin/main` in a fresh container reads the cached ref, not the
             # remote. `git fetch origin main` printed `26cc664..2905fea main ->
             # origin/main` and `git ls-remote origin main` confirmed the real
             # `refs/heads/main` was ALREADY at `2905fea`: every one of those 25
             # commits had been pushed by the run that made it. Only the LOCAL
             # `main` branch ref was genuinely behind, fast-forwarded with `git
             # merge --ff-only` before any work; the subsequent `git push origin
             # main` reported `Everything up-to-date`. ALWAYS `git fetch` before
             # reading `origin/main`, and prefer `git ls-remote` when the answer
             # decides whether work is at risk. Found by a manual field-by-field
             # sweep (Grep/Glob, not a dispatched sub-agent) of `MakeEventArgs`/
             # `DrillEvent`'s full declared shape against `lib/session/run.ts`'s
             # real event-construction sites — the same technique that closed
             # `corpusHash`/v3-D206, `locale`/v3-D213 and `latency`/v3-D222,
             # applied to the two fields none of those three touched. Also swept,
             # all false positives or already-excluded: a zero-caller export scan
             # over every `packages/engine/src` module (`placement.ts` and
             # `selectFor`, both already deferred, plus internal-only helpers my
             # sweep's own file exclusion mis-flagged — `gateDue`,
             # `estLearnMinutes`, `reduceChip` all have real in-file callers); an
             # unused-prop scan over every `components/**/*.tsx` (clean); an
             # interface-field-vs-read scan over every `apps/web/lib/**` module
             # (`LibraryRow.practisable`/`.detailed` are real inputs to the
             # rendered `status` string — the `allMet`-class non-gap v3-D194
             # already named); and a wire-key scan of every `'key' =>` in
             # `v3/api/app` against all of `apps/web` (`StripeSettingsController
             # ::store()`'s `howTo`, a 501 refusal body no client posts to, plus
             # `SpecsController`'s `specId`/`authorId`, part of the spec/selection
             # subsystem v3-D190 already scoped out as re-architecture). NOT
             # addressed: every item on v3-D226's own "NOT addressed" list,
             # unchanged — `DrillPicker.tsx`'s own unused `now` prop;
             # `session_start`'s own "app-open -> first drill" latency metric
             # (v0.8); `CorpusVerse.line`; the streak/away-day day-space
             # mismatch (v3-D209); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate` as
             # a whole class (v3-D88, v3-D151); multi-surah enrollment; the
             # operational mailer/7-night launch window; PAY-1's Stripe
             # fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift (v3-D127);
             # `packages/engine/src/placement.ts` (v3-D111/D113/D123);
             # `MacroFacts.litany.rhymeLabel` (v3-D188); `StripeField.editable`
             # (v3-D204); `corpusHash`'s own zero fold-side consumer (v3-D206);
             # FR5's own queue-level behavior for "restart"/"replan"/"makeup"
             # (v3-D217) — all unchanged. NEWLY named and NOT addressed:
             # `components/plan/PlanIsland.tsx#dueToday` re-derives
             # `gate.ts#gateDue()`'s predicate inline and omits its
             # `atom.encoded` term — the same "tested resolver exists, the
             # caller re-derives it inline" shape v3-D212 closed for
             # `gateStateOf()`, not currently divergent (no reachable engine
             # transition leaves `gateDueAt` set with `encoded` false —
             # `demoteToLearn` clears both), a separate smaller fix;
             # `lib/test/build.ts`/`TestIsland.tsx`'s own `test_*` events still
             # carry no site coordinate (a deliberately read-only, ungraded
             # event family, invariant #5 — the same smaller sibling scope
             # v3-D213 left for v3-D214); and `selection_determinism_check`
             # still replays a committed fixture rather than production logs,
             # which needs a server-side corpus store (`replaySelection`'s own
             # long-standing deferral, unwidened here) — what changed is that a
             # production log is now REPLAYABLE AT ALL.
             # `DrillEvent.siteKey`/`.visitOrdinal` are now CLOSED for the
             # graded session loop — remove them from future "no producer"
             # sweeps. See DECISIONS.md v3-D227.
             # NOTE (v3-D226, 2026-09-17): `PlanIsland`'s away-day toggle
             # (WIREFRAME §14, `setDayAway`/`day_marked_away`, v3-D207/D220)
             # never checked `lib/idb/writeLock.ts`'s single-writer status
             # before rendering its "Mark this day away"/"I'm back" controls
             # in either the "ready" calendar or the pre-first-session empty
             # state — the one write path in `components/plan/**` that did
             # not. `append()` re-asserts writer status at commit time
             # (`assertWriter()`, edge case #75: "two tabs, one session ->
             # double-committed events") and throws `NotWriterError` for any
             # tab that does not hold the lock; `SessionIsland.tsx` and
             # `TestIsland.tsx` both already subscribe to
             # `writeLock`/`useWriterStatus()` and hide or gate their own
             # commit affordances for exactly that reason — `useWriterStatus()`
             # itself (`lib/idb/useLogState.ts`) had been built, unit-tested,
             # and exported since the multi-tab lock shipped, but had ZERO
             # production callers anywhere (flagged and left open at v3-D93:
             # "`useWriterStatus()` itself remains unconsumed (a separate,
             # smaller gap)"), unchanged across 130+ later nightly runs.
             # Concretely reachable: a learner with a real session running as
             # the writer in one tab, and `/plan` open in a second, who
             # clicked either away-day control in that second tab got a
             # silent, unhandled promise rejection — no toggle committed, no
             # error shown, the button still sitting there ready to be
             # clicked again with the identical silent failure. Fixed:
             # `PlanIsland` now calls `useWriterStatus()` (finally giving it
             # a real caller) and passes `onToggleAway` to `PlanCalendar`/
             # `EmptyPlanAwayList` only when this tab is genuinely the
             # writer — `PlanCalendar`'s own `MarkAwayButton` already
             # documented "omitted, no button, no affordance" as its
             # contract for exactly this shape, so no new UI language was
             # invented, only the missing wiring; `EmptyPlanAwayList.tsx`'s
             # own `onToggleAway` prop widened from required to optional to
             # match. `handleToggleAway` itself also gained a try/catch
             # around the `setDayAway` call — a defensive second layer
             # against the lock changing hands between render and the click
             # actually landing (async), so a stale `canWrite` snapshot can
             # never surface as an unhandled rejection even in that race;
             # `writeLock`'s own live subscription is what keeps the
             # rendered affordance itself honest from one render to the
             # next. RED confirmed directly: `git status --porcelain` before
             # any implementation confirmed both production files
             # untouched; 3 new cases in a dedicated `test/plan-island.test.tsx`
             # describe block (9 pre-existing cases in the file untouched) —
             # forcing `writeLock` to `{role: "reader", reason:
             # "another-tab"}` before rendering, the "ready"-calendar case
             # and the empty-state case both failed identically,
             # `expected <button ...> to be null` (the unmodified component
             # renders the button regardless of writer status); a third case
             # (starts as reader, asserts no button, then flips the SAME
             # mounted instance to writer via `writeLock.forceForTests` with
             # no remount) failed on the same assertion before the flip,
             # proving the fix must be reactive to a LIVE status change, not
             # merely read once at mount. Implemented after confirming RED,
             # reran: 12/12 green (was 9, +3). `npx vitest
             # run test/plan-island.test.tsx test/plan-calendar.test.tsx
             # test/session-island.test.tsx test/test-island.test.tsx`:
             # 77/77 green — no regression on either sibling multi-tab
             # consumer or the read-only calendar renderer. `TZ=UTC make
             # test`: 2772 passing (was 2769, +3 — exactly this run's three
             # new tests; apps/web 1462, was 1459; no other suite moved: 255
             # v2 vitest, 47 v2/api, 393 v3/api, 120 corpus-compiler, 432
             # engine, 63 fold-runner). `check-test-floor.mjs`: OK, 2772 >=
             # floor 1899 (+873 margin, unmoved, same discipline as every
             # prior entry). `TZ=UTC make build`: exit 0, 30 routes
             # (unchanged — edits inside the existing `/plan` component
             # tree, no new route). `npm run gates`: all green (boundaries
             # 317 files, unchanged count — no new production file, two
             # existing files edited plus one existing test file; fonts
             # degraded-but-non-blocking, pre-existing, 2/6 UI fonts
             # present; corpus-morphology 362 words / corpus-glyphs 206
             # codepoints, both unchanged — no corpus recompile, this is a
             # pure client-side write-lock-wiring fix). `npx tsc --noEmit`
             # (apps/web): clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff produced by
             # running the suite was reverted before committing, same
             # discipline as every prior entry — `git status --porcelain --
             # v1 v2` empty immediately before committing). No Arabic
             # codepoint (all three changed files swept programmatically,
             # in Python, over the Arabic, Arabic Supplement, Arabic
             # Extended-A and both Presentation Forms Unicode blocks, plus
             # a `fromCharCode`/`fromCodePoint`/`\u06xx`/`\u07xx`/`\u08xx`/
             # `\uFBxx`/`\uFExx` escape sweep — zero matches; every new
             # string is a fixed English docblock/comment sentence or a
             # closed-set `WriterStatus` role literal already used
             # elsewhere in this test file, never corpus text). Session
             # start: fresh container, no `node_modules`/`vendor`/compiled
             # corpus anywhere; `make setup` ran clean from scratch, no
             # retries needed. `HEAD`/local `main`/`origin/main` all already
             # agreed at `7c23b73` (v3-D225) — no stale-local-main trap this
             # run, confirmed directly via `git fetch origin main` before
             # any exploration. Found by a targeted, manual field-by-field
             # sweep (Grep/Glob, not a dispatched sub-agent) directed at
             # `worker/fold-runner/src` (re-confirmed clean — `foldCheck.ts`/
             # `selectionCheck.ts`/`severity.ts` all fully consumed by the
             # admin/mailer surfaces v3-D178/D179/D215 already built),
             # `packages/corpus-compiler/src` (re-confirmed
             # `connections.ts`/`manifest.ts`'s `generatedFrom` as
             # build-tooling artifacts with no natural admin/learner home,
             # matching the `schemaVersion`-class non-gap v3-D193 already
             # named), several Laravel Console Commands and models
             # (`PurgeDueAccountsCommand`, `Entitlement`,
             # `EntitlementTransition`, `Spec` — all already fully wired),
             # and a bulk export-usage scan across every `apps/web/lib/**`
             # module (most zero-external-caller hits were pure
             # internal-only helpers, a false-positive shape this sweep
             # learned to discount) before landing on `useWriterStatus()`
             # as the one genuine, previously-flagged-but-unfixed instance —
             # independently re-verified directly against
             # `lib/idb/writeLock.ts`, `lib/idb/append.ts`, `SessionIsland
             # .tsx` and `TestIsland.tsx`'s real source (confirming both
             # already guard their own commit paths, and `PlanIsland.tsx`
             # genuinely did not) before writing any test. NOT addressed:
             # every item on v3-D225's own "NOT addressed" list, unchanged
             # — `DrillPicker.tsx`'s own unused `now` prop; `session_start`'s
             # own "app-open -> first drill" latency metric (v0.8);
             # `CorpusVerse.line`; the streak/away-day day-space mismatch
             # (v3-D209); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate`
             # as a whole class (v3-D88, v3-D151); multi-surah enrollment;
             # the operational mailer/7-night launch window; PAY-1's Stripe
             # fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); `MacroFacts.litany.rhymeLabel`
             # (v3-D188); `StripeField.editable` (v3-D204); `corpusHash`'s
             # own zero fold-side consumer (v3-D206); FR5's own queue-level
             # behavior for "restart"/"replan"/"makeup" (v3-D217) — all
             # unchanged. `useWriterStatus()` is now CLOSED — remove it from
             # future "NOT addressed" lists. See DECISIONS.md v3-D226.
             # NOTE (v3-D225, 2026-09-17): `DeterminismCheckCommand`'s own
             # `--trigger` option (`schedule|manual|ci`) has been recorded on
             # every `nightly_check_runs` row since that table's migration —
             # `routes/console.php`'s real unattended cron passes
             # `--trigger=schedule` explicitly; any other invocation (an
             # operator debugging, or the manual re-run BUILD-PLAN's own
             # C5/H5 requires while no operational pager exists) defaults to
             # `manual` — but `NightlyWindowLedger::nights()`, the one place
             # the 7-consecutive-green-nights streak arithmetic lives, never
             # read it: its per-`(night, check)` winner-selection loop
             # tracked only the WORST severity, never which invocation
             # produced it, so `Admin\NightlyWindowController` (v3-D143's own
             # "a human watching this number by hand is the ENTIRE safety
             # net for the gate that blocks public launch") had nothing to
             # pass through and `NightlyWindowPanel.tsx` rendered
             # `${check}=${sev}` with no third fact. Sharper than a cosmetic
             # gap: the ledger's own header already guards the ADJACENT
             # failure by name — a scheduler that silently stops running,
             # producing gaps a naive `count(green)` would miss — but was
             # blind to the harder version of the same lie: a human who
             # notices the cron died and quietly re-runs `determinism:check
             # both` by hand every night leaves ZERO gaps and all-green
             # rows, satisfying the launch gate while the real unattended
             # automation stays dead. `trigger` is the one fact every run
             # already carries that exposes exactly that, and it never
             # reached the operator relying on this screen. Fixed,
             # read-only, no schema change (`trigger` was already a real
             # non-nullable column): `nights()` gains
             # `$byNightTrigger[$night][$check]`, tracked on the identical
             # "strictly worse severity wins" branch `$byNight` already
             # uses — so a re-run that upgrades a night's severity also
             # correctly carries THAT run's own trigger, never the first
             # run's. `NightlyWindowController` needed no change (already a
             # thin pass-through); `NightlyWindowNight` gains an optional
             # `triggers?: Record<string,string>` (optional so no
             # pre-existing test fixture needed touching, the same
             # "additive, no fixture churn" precedent `resumeMassed` set at
             # v3-D218); `NightlyWindowPanel.tsx` renders a trailing
             # `(trigger)` clause per check, e.g. `fold_determinism_check=
             # green (schedule)` vs `...=green (manual)`. RED confirmed at
             # three layers, each reverted and restored byte-identically:
             # ledger level, 2 new `WindowLedgerTest` cases failed exactly
             # `Undefined array key "triggers"` against the unmodified
             # source, the load-bearing one proving a re-run's OWN trigger
             # must win, not the night's first run — 27/27 green after (was
             # 24, +3). Controller level, 1 new `NightlyWindowTest` case
             # failed `Failed asserting that null is identical to
             # 'schedule'` — 10/10 green after (was 9, +1). Frontend: the
             # fetch-layer round-trip tests passed VACUOUSLY against the
             # unmodified lib (JS does not strip an unrecognized JSON
             # property just because a TS interface omits it — `triggers`
             # already flowed through `{...body}` regardless of
             # validation); the real RED landed at the RENDER layer — the
             # load-bearing `nightly-window-panel.test.tsx` case (two
             # checks, same night, DIFFERENT triggers, so it cannot pass on
             # one hardcoded label) failed on `screen.getByText(/fold_
             # determinism_check=green \(schedule\)/)` timing out, while
             # its negative sibling (no `triggers` field -> severity alone,
             # no fabricated suffix) passed vacuously, correctly. Restored
             # byte-identically, reran: `nightlyWindow.test.ts` 14/14 (was
             # 12, +2), `nightly-window-panel.test.tsx` 11/11 (was 9, +2).
             # `php artisan test` (v3/api): 393 passing (was 390, +3; 2
             # incomplete + 6 skipped unchanged, PAY-1). `./vendor/bin/pint
             # --test` on all three changed PHP files:
             # `NightlyWindowLedger.php` passed; both test files report the
             # identical pre-existing style findings both BEFORE and AFTER
             # this diff, confirmed directly by stashing the change and
             # re-running pint — pre-existing repo-wide drift this fix does
             # not introduce, left alone, same discipline as
             # `WebhookHandler.php`'s own precedent (v3-D203). `TZ=UTC make
             # test`: 2769 passing (was 2762, +7 — exactly this run's new
             # tests: 3 v3/api + 4 apps/web; v3/api 393, was 390; apps/web
             # 1459, was 1455; no other suite moved).
             # `check-test-floor.mjs`: OK, 2769 >= floor 1899 (+870 margin,
             # unmoved, same discipline as every prior entry). `TZ=UTC make
             # build`: exit 0, 30 routes (unchanged — a `lib/`+`api/`-only
             # change to an existing `/settings/health` component, no new
             # route). `npm run gates`: all green (boundaries 317 files,
             # unchanged count — no new production file, three existing
             # files edited plus their four existing test files; fonts
             # degraded-but-non-blocking, pre-existing, 2/6 UI fonts
             # present; corpus-morphology 362 words / corpus-glyphs 206
             # codepoints, both unchanged — no corpus recompile, this is a
             # nightly-ledger-only wiring change). `npx tsc --noEmit`
             # (apps/web): clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff produced by
             # running the suite was reverted before committing, same
             # discipline as every prior entry — `git status --porcelain --
             # v1 v2` empty immediately before committing). No Arabic
             # codepoint (the full diff swept programmatically, in Python,
             # over the Arabic, Arabic Supplement, Arabic Extended-A and
             # both Presentation Forms Unicode blocks, plus a
             # `fromCharCode`/`fromCodePoint`/`\u06xx`/`\u07xx`/`\u08xx`/
             # `\uFBxx`/`\uFExx` escape sweep — zero matches; every new
             # string is a PHP/TS identifier, a wire field name, the
             # closed-set trigger literal `"schedule"`/`"manual"`, or a
             # fixed English docblock/assertion sentence, never corpus
             # text). Session start: fresh container, no
             # `node_modules`/`vendor`/compiled corpus anywhere; `make
             # setup` ran clean from scratch, no retries needed. `HEAD` and
             # `origin/main` already agreed at `7c3bbdd` (v3-D224) on a
             # detached HEAD, but the local `main` branch ref was a
             # genuinely stale pointer 23 commits behind — caught before
             # any exploration via `git fetch origin main` + `git checkout
             # main && git merge --ff-only origin/main`, a clean
             # fast-forward, no work lost or at risk — the same recurring
             # trap this file has recorded roughly fifty times since
             # v3-D77. Found by a dedicated fresh-sweep agent (Explore)
             # handed the full exclusion list carried through v3-D224 and
             # directed at Laravel Console Commands, wire fields
             # fetched-but-unrendered across `apps/web/lib/admin`, and
             # Eloquent model/migration columns with no reader —
             # independently re-verified by this run directly against
             # `DeterminismCheckCommand.php`, `NightlyWindowLedger.php`, the
             # migration, `NightlyWindowController.php`,
             # `lib/admin/nightlyWindow.ts` and `NightlyWindowPanel.tsx`'s
             # real source before writing any test. NOT addressed: every
             # item on v3-D224's own "NOT addressed" list, unchanged —
             # `DrillPicker.tsx`'s own unused `now` prop; `session_start`'s
             # own "app-open -> first drill" latency metric (v0.8);
             # `CorpusVerse.line`; the streak/away-day day-space mismatch
             # (v3-D209); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate`
             # as a whole class (v3-D88, v3-D151); multi-surah enrollment;
             # the operational mailer/7-night window — this fix makes the
             # window screen able to SHOW who invoked each night's run, but
             # does not itself stand up a pager or a staging host; PAY-1's
             # Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); `MacroFacts.litany.rhymeLabel`
             # (v3-D188); `StripeField.editable` (v3-D204); `corpusHash`'s
             # own zero fold-side consumer (v3-D206); FR5's own queue-level
             # behavior for "restart"/"replan"/"makeup" (v3-D217) — all
             # unchanged. See DECISIONS.md v3-D225.
             # NOTE (v3-D224, 2026-09-17): `Admin\ContentFreezeController::
             # LAUNCH_SURAHS` read `[12, 103, 112]` — missing 67 — on the stale
             # reasoning in its own docblock: "the second surah is BUILD-PLAN's
             # own open question Q3 and cannot be enumerated." That question
             # was ANSWERED on 2026-08-11 (AL-MULK/67, v3-D59,
             # `docs/BUILD-PLAN.md`'s own Q3 entry) — the launch set has been
             # the closed, enumerable four-surah list `[12, 67, 103, 112]` ever
             # since, and `scripts/content-freeze.mjs`'s own `LAUNCH_SURAHS`
             # already states this correctly, even naming v3-D59 in its own
             # comment. This controller's copy simply never got the memo — it
             # was authored (build-plan step 28/M9) with no test ever
             # exercising the DEFAULT (no `?surahs=` query param) request
             # shape, only explicit single-surah query strings
             # (`?surahs=12`/`?surahs=103`), so the wrong default silently
             # never went red. Consequence, real not cosmetic:
             # `ContentFreezePanel.tsx` (`components/admin/
             # ContentFreezePanel.tsx`) — the ONE admin screen built to answer
             # "may I book the qari" (`loadContentFreeze()`'s own docblock:
             # "Omitted, the controller's own default... applies") — always
             # calls the endpoint with no `surahs` param, so it silently never
             # evaluated surah 67's own frontier/hashSpec criteria at all:
             # its header rendered "FREEZE CRITERIA — SURAHS 12, 103, 112"
             # with no mention of 67, and every evidence line came from the
             # other three surahs alone. 67 is precisely the surah
             # HANDOVER.md names as the sole remaining content-freeze blocker
             # (H2, scene beats) — an admin trusting a `bookable: true`
             # reading from this screen had no way to know it was never
             # checking the one surah most likely to still be red. Fixed:
             # `LAUNCH_SURAHS` corrected to `[12, 67, 103, 112]`, matching
             # `scripts/content-freeze.mjs` exactly; the stale docblock
             # rewritten to state the real history rather than the
             # once-true-now-false "cannot be enumerated" claim. RED
             # confirmed directly: `git stash` of the one production file
             # alone (both new `ContentFreezeTest` cases kept, 7 pre-existing
             # cases untouched) — the first case (`getJson`, no query string,
             # asserting `surahs === [12, 67, 103, 112]`) failed exactly
             # `Failed asserting that two arrays are identical` (`[12, 103,
             # 112]` vs the expected four); the second, load-bearing case
             # (seeds real green `CorpusAyahHash`/`AyahVerification` rows for
             # surah 67 ONLY, 12/103/112 deliberately left empty so the
             # overall report is correctly not-bookable either way) failed
             # exactly `Expected ... To contain: surah 67: 1/1 ayat green on
             # both tiers` — proving the default request never even reached
             # surah 67's real data, not merely that the number was cosmetic.
             # Restored byte-identically, reran: 9/9 green (was 7, +2).
             # `php artisan test`: 390 passing (was 388, +2; 2 incomplete +
             # 6 skipped unchanged, PAY-1). `./vendor/bin/pint --test` on
             # both changed files: passed. `TZ=UTC make test`: 2762 passing
             # (was 2760, +2 — exactly this run's two new tests; v3/api 390,
             # was 388; no other suite moved). `check-test-floor.mjs`: OK,
             # 2762 >= floor 1899 (+863 margin, unmoved, same discipline as
             # every prior entry). `TZ=UTC make build`: exit 0, 30 routes
             # (unchanged — a Laravel-controller-only fix, no apps/web file
             # touched). `npm run gates`: all green (boundaries 317 files,
             # unchanged count — no apps/web file in this diff; fonts
             # degraded-but-non-blocking, pre-existing, 2/6 UI fonts present;
             # corpus-morphology 362 words / corpus-glyphs 206 codepoints,
             # both unchanged — the corpus recompile this run performed as
             # part of `make test`/`make compile-corpus` reproduced the same
             # 4-surah manifest byte-for-byte, no new corpus data). No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff produced by running the suite was reverted
             # before committing, same discipline as every prior entry —
             # `git status --porcelain -- v1 v2` empty immediately before
             # committing). No Arabic codepoint (both changed files swept
             # programmatically, in Python, over the Arabic, Arabic
             # Supplement, Arabic Extended-A and both Presentation Forms
             # Unicode blocks, plus a `fromCharCode`/`fromCodePoint`/
             # `\u06xx`/`\u07xx`/`\u08xx`/`\uFBxx`/`\uFExx` escape sweep —
             # zero matches; every new/changed line is a PHP identifier, a
             # surah-number integer, or a fixed English docblock/test
             # sentence, never corpus text). Session start: dependencies
             # were not yet installed in this container (`v2`/`v2/api`/
             # `v3/api`/`v3/apps/web` all had empty `node_modules`/`vendor`);
             # `make setup` ran clean from scratch via the documented
             # git-mirror composer fallback for `v3/api` (transient proxy
             # timeouts cloning several packages via dist, recovered
             # automatically, no retry flag needed). `HEAD` and
             # `origin/main` already agreed at `f10780d` (v3-D223) — no
             # stale-local-main trap this run, confirmed directly via `git
             # fetch origin main` before any exploration; local `main` was
             # a genuinely stale ref 22 commits behind, fast-forwarded
             # before any implementation work. Found by re-reading
             # `docs/BUILD-PLAN.md`'s own answered Q3 entry and
             # `scripts/content-freeze.mjs`'s own correct `LAUNCH_SURAHS`
             # directly against every OTHER hardcoded launch-surah-set copy
             # in the tree (`grep -rn "12, 103, 112"` across `.php`/`.ts`/
             # `.tsx`), after a broad automated sweep — zero-caller TS/PHP
             # export checks across `apps/web/lib`, `packages/engine/src`,
             # `packages/corpus-compiler/src`, `worker/fold-runner/src`,
             # `api/app` (Models/Controllers/Console), an unused-JSX-prop
             # scan across every `components/**/*.tsx`, and a wire-type
             # field-vs-rendered-field pass across every `lib/admin/*.ts` /
             # `components/admin/*.tsx` pair — came back with only
             # already-known, already-excluded non-gaps (`DrillPicker.tsx`'s
             # `now` prop, v3-D222; `lib/admin/contentFreeze.ts`'s own
             # `allMet`, v3-D194) before this stale-constant instance
             # surfaced as the one genuine, previously-undocumented finding.
             # NOT addressed: every item on v3-D223's own "NOT addressed"
             # list, unchanged — `DrillPicker.tsx`'s own unused `now` prop;
             # `session_start`'s own "app-open -> first drill" latency
             # metric (v0.8); `CorpusVerse.line`; the streak/away-day
             # day-space mismatch (v3-D209); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate`
             # as a whole class (v3-D88, v3-D151); multi-surah enrollment;
             # the operational mailer/7-night window; PAY-1's Stripe
             # fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); `MacroFacts.litany.rhymeLabel`
             # (v3-D188); `StripeField.editable` (v3-D204); `corpusHash`'s
             # own zero fold-side consumer (v3-D206); FR5's own queue-level
             # behavior for "restart"/"replan"/"makeup" (v3-D217) — all
             # unchanged. See DECISIONS.md v3-D224.
             # NOTE (v3-D223, 2026-09-16): `Flag.killed_by`/`.ack_by` — stamped
             # by `FlagService::kill()`/`acknowledgeKill()` on every real
             # kill/ack (`v3/api/app/Flags/FlagService.php:91,176`), including
             # the unattended nightly auto-waive — reached no reader anywhere:
             # `Admin\FlagController::index()` put `killedAt`/`ackAt` on the
             # wire but never `killed_by`/`ack_by`, so `lib/admin/flags.ts
             # #FlagRow` never declared them and `FlagsPanel.tsx`'s kill
             # banner named only WHEN a flag was killed/acknowledged, never
             # WHO — despite the fact already sitting in the same row.
             # Sharper than v3-D209's own closed sibling on this same panel
             # (`FlagRow.ackAt`, fetched and typed but never rendered): here
             # the field never even reached the JSON response at all — `grep
             # -rn "killedBy\|ackBy" --include=*.php --include=*.ts
             # --include=*.tsx v3/` returned nothing anywhere before this
             # fix. Fixed on the exact `FlagAuditController`/
             # `AdminAuditController` template: `FlagController` constructor-
             # injects `Pseudonymizer` and `index()` adds `killedBy`/`ackBy`
             # via a new `actorPseudonym()` helper — `null` when the stored
             # value is `null` OR `""` (`(string) null` casts to `""`, not
             # `null`, for the auto-waive path's systemless actor) else a
             # real HMAC pseudonym; `FlagRow` gains matching required
             # fields, validated by `isFlagRow` (never merely passed
             # through); the banner gains a `by {pseudonym}` clause on both
             # sentences, present only for a real actor — an auto-waive
             # still renders no fabricated "by" clause, since its own
             # `ackBy` is genuinely null. RED confirmed independently at
             # both layers: 4 new `FlagPlaneTest` cases against the
             # unmodified controller all failed on `Undefined array key
             # "killedBy"`/`"ackBy"` — the field did not exist, not merely
             # wrong — 20/20 green after (was 16, +4); frontend, both source
             # files moved aside via `git stash` (tests kept) failed 1 of 14
             # `flags.test.ts` cases (`isFlagRow` wrongly accepted a row
             # missing both fields) and 3 of 12 `flags-panel.test.tsx` cases
             # (the banner never contained the pseudonym) — every other case
             # passed vacuously, including this file's own first-drafted
             # round-trip assertion, caught and replaced with a genuine
             # missing-field negative case before this note was written;
             # restored byte-identically, 14/14 + 12/12 green (was 13 + 9,
             # +1 +3). `php artisan test` (v3/api): 388 passing (was 384,
             # +4; 2 incomplete + 6 skipped unchanged, PAY-1). `./vendor/bin
             # /pint --test` on both changed PHP files: passed. `TZ=UTC make
             # test`: 2760 passing (was 2752, +8 — exactly this run's new
             # tests: 4 PHPUnit + 1 + 3 vitest; no other suite moved).
             # `check-test-floor.mjs`: OK, 2760 >= floor 1899 (+861 margin,
             # unmoved, same discipline as every prior entry). `TZ=UTC make
             # build`: exit 0, 30 routes (unchanged — a controller-plus-
             # admin-panel-only change, no route or component added). `npm
             # run gates`: all green (boundaries 317 files, unchanged count —
             # three existing production files edited plus their three
             # existing test files, no new production file; fonts
             # degraded-but-non-blocking, pre-existing, 2/6 UI fonts present;
             # corpus-morphology 362 words / corpus-glyphs 206 codepoints,
             # both unchanged — no corpus recompile, a pure admin-actor-
             # attribution wiring change). `npx tsc --noEmit` (apps/web):
             # clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff produced by
             # running the suite was reverted before committing, same
             # discipline as every prior entry — `git status --porcelain --
             # v1 v2` empty immediately before committing). No Arabic
             # codepoint (all six changed files swept programmatically, in
             # Python, over the Arabic, Arabic Supplement, Arabic
             # Extended-A and both Presentation Forms Unicode blocks, plus a
             # `fromCharCode`/`fromCodePoint`/`\u06xx`/`\u07xx`/`\u08xx`/
             # `\uFBxx`/`\uFExx` escape sweep — zero matches; every new
             # string is a PHP identifier, a wire field name, a fixed
             # English docblock/caption sentence, or a synthetic
             # `u_...`-shaped pseudonym test placeholder matching this
             # codebase's own established convention, never corpus text).
             # Session start: dependencies were not yet installed in this
             # container (`v2`/`v2/api`/`v3/api` all had empty
             # `node_modules`/`vendor`); `make setup` ran clean from
             # scratch, no retries needed. `HEAD` and `origin/main` already
             # agreed at `2548af6` (v3-D222) — no stale-local-main trap this
             # run, confirmed directly via `git fetch origin main` before
             # any exploration (a genuinely stale LOCAL `main` branch ref,
             # six commits behind, was found and fast-forwarded before
             # dependency install). Found by a dedicated fresh-sweep agent
             # (Explore) handed the exclusion list carried through v3-D222
             # and directed at Console Commands/Jobs/Notifications,
             # `apps/web/lib/**` zero-caller exports, unread component
             # props, Eloquent model fields, `packages/engine`/
             # `worker/fold-runner` exports, and wire-type fields
             # sent-but-unread — independently re-verified by this run
             # directly against `FlagService`/`FlagController`/`Flag`/the
             # migration before writing any test. NOT addressed: every item
             # on v3-D222's own "NOT addressed" list, unchanged —
             # `DrillPicker.tsx`'s own unused `now` prop; `session_start`'s
             # own "app-open -> first drill" latency metric (v0.8);
             # `CorpusVerse.line`; the streak/away-day day-space mismatch
             # (v3-D209); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate`
             # as a whole class (v3-D88, v3-D151); multi-surah enrollment;
             # the operational mailer/7-night window; PAY-1's Stripe
             # fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); `MacroFacts.litany.rhymeLabel`
             # (v3-D188); `StripeField.editable` (v3-D204); `corpusHash`'s
             # own zero fold-side consumer (v3-D206); FR5's own queue-level
             # behavior for "restart"/"replan"/"makeup" (v3-D217) — all
             # unchanged. See DECISIONS.md v3-D223.
             # NOTE (v3-D222, 2026-09-16): `DrillEvent.latency` ("item-shown ->
             # tap ms", WIREFRAME §15's own "built" v0.6 metric) had a real,
             # tested consumer (`lib/progress/rows.ts#timeOnTaskMs`, which
             # feeds the "Time" column on `/progress/list` and the ayah-detail
             # page) and NO producer anywhere — not in v3, not in v2
             # (`grep -rn "latency:" v2/src` outside `sync/outbox.ts`, which
             # only relays a value some producer was supposed to set, returns
             # nothing). Every real learner's `reconstruct_tap` therefore
             # carried no `latency`, `timeOnTaskMs`'s own `typeof e.latency
             # !== "number"` guard excluded every one, and `formatDuration(0)`
             # printed the fixed "-" placeholder — the one column WIREFRAME
             # §15 calls "the most motivating honest number the app has" had
             # shown nothing else for any real learner since it shipped.
             # Fixed with no new field: `answerCurrent` now stamps
             # `latency: Math.max(0, ctx.now - run.lastActivityAt)` on the
             # `reconstruct_tap` event — `lastActivityAt` was already, by its
             # own docblock (v3-D107/v3-D217), "the ts of this run's own most
             # recent commit... or startedAt before the first one", exactly
             # "when did the item now being answered become active"; this
             # reads a value `run.ts` already tracked rather than adding one,
             # the same "resolve once, stamp it" shape `corpusHash`/`glossLang`
             # already established. RED confirmed directly: 3 new cases in
             # `lib/session/run.test.ts` (88 pre-existing untouched), reverted
             # via `git stash` of `run.ts` alone (tests kept) — a day-2 due
             # cold gate's own full reconstruct (a first-encounter learn item
             # completes in one tap regardless of surah, verified directly,
             # so a genuine second tap needs a due gate instead) failed
             # `expected undefined to be 5000` on the first tap and
             # `expected undefined to be 2000` on the second (proving a
             # per-tap gap, never a cumulative total from `startedAt`); a
             # backward-clock case failed `expected undefined to be +0`; an
             # integration case driving a real gate session to completion and
             # reading the REAL `timeOnTaskMs` failed `expected 0 to be
             # greater than 0`. Restored byte-identically, reran: 88/88 green
             # (was 85, +3). `npx vitest run lib/session/run.test.ts test/
             # progress-list.test.tsx test/ayah-detail.test.tsx test/
             # session-island.test.tsx lib/session/assemble-lastactive.test.ts`:
             # 197/197 green — no regression on either real consumer.
             # `TZ=UTC make test`: 2752 passing (was 2749, +3 — exactly this
             # run's three new tests; apps/web 1451, was 1448; no other suite
             # moved). `check-test-floor.mjs`: OK, 2752 >= floor 1899 (+853
             # margin, unmoved, same discipline as every prior entry). `TZ=UTC
             # make build`: exit 0, 30 routes (unchanged — a
             # `lib/session/run.ts`-only change, no route or component
             # touched). `npm run gates`: all green (boundaries 317 files,
             # unchanged count — one existing production file edited plus its
             # one existing test file, no new production file; fonts
             # degraded-but-non-blocking, pre-existing, 2/6 UI fonts present;
             # corpus-morphology 362 words / corpus-glyphs 206 codepoints,
             # both unchanged — no corpus recompile, a session-loop-only
             # wiring change). `npx tsc --noEmit`, run separately across all
             # four v3 node packages: clean in all four. No `v1/**`/`v2/**`
             # edit (a stray `v2/tsconfig.tsbuildinfo` build-cache diff
             # produced by running the suite was reverted before committing,
             # same discipline as every prior entry — `git status
             # --porcelain -- v1 v2` empty immediately before committing). No
             # Arabic codepoint (the full diff swept programmatically, in
             # Python, over the Arabic, Arabic Supplement, Arabic Extended-A
             # and both Presentation Forms Unicode blocks, plus a
             # `fromCharCode`/`fromCodePoint`/`\u06xx`/`\u07xx`/`\u08xx`/
             # `\uFBxx`/`\uFExx` escape sweep — zero matches; every new
             # string is a TypeScript identifier, a millisecond arithmetic
             # result, or a fixed English docblock/comment sentence, never
             # corpus text). Session start: picked up mid-session, `make
             # setup` run once from scratch (a transient proxy timeout
             # cloning `laravel/pint` recovered via the documented git-mirror
             # source fallback, no retry flag needed); `HEAD` and
             # `origin/main` already agreed at `734030a` (v3-D221) — no
             # stale-local-main trap this run. Found by a direct field-by-
             # field sweep of `DrillEvent`/`MakeEventArgs` against `run.ts`'s
             # real event-construction sites (the same technique that closed
             # `corpusHash`/v3-D206 and `locale`/v3-D213), after a broader
             # zero-caller sweep across `apps/web/lib/**`, a Laravel model-
             # relation sweep, a Console-Commands/Jobs/Notifications sweep,
             # and a component-prop sweep (found one weaker, harmless
             # candidate — `DrillPicker.tsx`'s own unused `now` prop, a dead
             # parameter with no learner-facing consequence, not a computed-
             # and-discarded field with a real reader — left alone) all came
             # back with only already-excluded or non-gap candidates. NOT
             # addressed: `DrillPicker.tsx`'s unused `now` prop (above);
             # `session_start`'s own separate "app-open -> first drill" (v0.8)
             # latency metric, which needs an app-open timestamp `run.ts` has
             # no state for; `CorpusVerse.line` (declared, never populated by
             # the compiler — re-confirmed the same dead-field shape v3-D194
             # already excluded); the streak/away-day day-space mismatch
             # (v3-D209); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate`
             # as a whole class (v3-D88, v3-D151); multi-surah enrollment;
             # the operational mailer/7-night window; PAY-1's Stripe
             # fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); `MacroFacts.litany.rhymeLabel` (v3-D188);
             # `StripeField.editable` (v3-D204); `corpusHash`'s own zero
             # fold-side consumer (v3-D206); FR5's own queue-level behavior
             # for "restart"/"replan"/"makeup" (v3-D217) — all unchanged. See
             # DECISIONS.md v3-D222.
             # NOTE (v3-D221, 2026-09-16): `PlanIsland`'s trajectory zone
             # assumed every learner's pace was Steady's 8 min/day —
             # `app/(app)/plan/page.tsx`'s own prop was literally named
             # `STEADY_MINUTES_PER_DAY` and `PlanIsland` never called
             # `readChoices()` at all, despite `pace.ts#paceConfig()` (Sprint's
             # real 16 min/day, Maintain's reviews-only 8) being persisted
             # since onboarding and already consumed by two sibling callers,
             # `SessionGate.tsx` and `TodaySession.tsx` (v3-D138 closed the
             # identical gap for the session loop and the `/home` due count).
             # `grep -rn "readChoices" apps/web/components/plan` returned
             # nothing before this fix. Real, not cosmetic:
             # `minutesPerDay` drives `forecast.ts#buildForecast()`'s
             # `paceLabel` (the trajectory's own "~N min/day" commitment
             # sentence) and `etaDays`/`finishLabel` (the "mid-March" finish
             # date via `planFor()`) — a Sprint learner saw a trajectory built
             # on half their real pace and a finish date roughly twice as far
             # out as reality; a Maintain learner (reviews only,
             # `newAyahCeiling: 0`) was shown a finite finish date implying
             # ongoing new-ayah progress that will never happen. Precisely
             # the "every ETA lies" failure E-06 (`splitBudget()`, build-plan
             # step 9) was closed to prevent — E-06 stops one surah's budget
             # stealing another's; this stopped the lie of picking the wrong
             # budget size in the first place. `PlanCalendar.tsx`'s
             # trajectory caption also hardcoded "about eight minutes a
             # day" one line above the real `forecast.paceLabel` it would
             # contradict for any non-Steady learner — dropped in favor of
             # the one real number, never a second copy. Fixed:
             # `PlanIsland` gains a `useEffect`/`useState` reading
             # `readChoices()` on mount (mirroring `SessionGate.tsx`/
             # `TodaySession.tsx`'s own precedent exactly) and resolves
             # `paceConfig(choices?.pace ?? DEFAULT_PACE_MODE).budgetMin` in
             # place of the prop, now FALLBACK-ONLY until that read resolves,
             # independent of the existing log-read effect so it never blocks
             # first paint on the fold. RED confirmed directly: two new cases
             # in a dedicated `test/plan-island.test.tsx` describe block (7
             # pre-existing cases untouched) — the load-bearing case commits
             # `pace: "sprint"` via the real `commitOnboarding()`, reaches
             # "ready" via a harmless past-day away-toggle (this file's own
             # established technique, never fabricating a forecast), and
             # failed on `expected element with text ~15 min/day to exist`
             # against the unmodified component — the trajectory zone kept
             # showing `~10 min/day`, Steady's own fallback label; the
             # sibling no-onboarding-choice case passed vacuously, correctly,
             # since it already exercised the same fallback path. Reran: 9/9
             # green (was 7, +2). `TZ=UTC make test`: 2749 passing (was 2747,
             # +2 — exactly this run's two new tests; apps/web 1448, was
             # 1446; no other suite moved). `check-test-floor.mjs`: OK, 2749
             # >= floor 1899 (+850 margin, unmoved, same discipline as every
             # prior entry). `TZ=UTC make build`: exit 0, 30 routes
             # (unchanged — edits inside the existing `/plan` component
             # tree, no new route). `npm run gates`: all green (boundaries
             # 317 files, unchanged count — no new production file, three
             # existing files edited plus one existing test file; fonts
             # degraded-but-non-blocking, pre-existing, 2/6 UI fonts present;
             # corpus-morphology 362 words / corpus-glyphs 206 codepoints,
             # both unchanged — no corpus recompile, this is a
             # plan-only pace-wiring change). `npx tsc --noEmit` (apps/web):
             # clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff produced by running
             # the suite was reverted before committing, same discipline as
             # every prior entry — `git status --porcelain -- v1 v2` empty
             # immediately before committing). No Arabic codepoint (the full
             # diff swept programmatically, in Python, over the Arabic,
             # Arabic Supplement, Arabic Extended-A and both Presentation
             # Forms Unicode blocks, plus a `fromCharCode`/`fromCodePoint`/
             # `\u06xx`/`\u07xx`/`\u08xx`/`\uFBxx`/`\uFExx` escape sweep —
             # zero matches; every new string is a fixed English
             # caption/comment or a closed-set pace-mode fixture value
             # ("sprint", already used elsewhere in this test file), never
             # corpus text). Session start: picked up mid-session on a
             # container where `make setup` and a baseline `TZ=UTC make
             # test`/`make build` had already been run fresh from a clean
             # checkout this same run (2747 passing, matching v3-D220's own
             # recorded count exactly — no drift, no stale-local-main trap:
             # `HEAD` and `origin/main` already agreed at `fd9ce26`, this
             # entry's own parent). Found by a dedicated fresh-sweep agent
             # (Explore) handed the full exclusion list carried through
             # v3-D220 and directed at the away-day feature's own siblings,
             # the resume/interruption feature, `worker/fold-runner/src`,
             # Console Commands, and a zero-caller function sweep over
             # `apps/web/lib/**` — independently re-verified by this run
             # directly against `PlanIsland.tsx`, `page.tsx`,
             # `PlanCalendar.tsx`, `pace.ts` and `choices.ts`'s real source
             # before writing any test. NOT addressed: every item on
             # v3-D220's own "NOT addressed" list, unchanged — the
             # streak/away-day day-space mismatch (v3-D209);
             # `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution`
             # (v3-D148); `lib/pricing.ts#regionFromCountry()` (v3-D163);
             # `PaywallGate` as a whole class (v3-D88, v3-D151); multi-surah
             # enrollment; the operational mailer/7-night window; PAY-1's
             # Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); `MacroFacts.litany.rhymeLabel`
             # (v3-D188); `StripeField.editable` (v3-D204); `corpusHash`'s
             # own zero fold-side consumer (v3-D206); FR5's own queue-level
             # behavior for "restart"/"replan"/"makeup" (v3-D217) — all
             # unchanged. `/plan`'s pace assumption is now CLOSED — remove it
             # from future "NOT addressed" lists. See DECISIONS.md v3-D221.
             # NOTE (v3-D220, 2026-09-16): `PlanIsland`'s "empty" case (zero
             # events recorded for the enrolled surah) correctly refused to
             # project a forecast from nothing — §14's own honesty mechanic,
             # #73's "skeletons are never zeros" applied to a log rather than
             # a load — but its own sibling feature, "mark a future day away"
             # (WIREFRAME §14, wired end-to-end at v3-D207), needs no
             # forecast at all: `setDayAway`/`day_marked_away` is a plain
             # toggle over a day INDEX, evidence-only by construction
             # (`rebuild.ts` has no branch for it, invariant #5). Named
             # explicitly in `test/plan-island.test.tsx`'s own v3-D207
             # comment ("a log with zero events shows the honest zero-state
             # instead of a forecast — this test is about the away-day
             # wiring, not the zero-state") and repeated on every "NOT
             # addressed" list since v3-D207 as "real, separate, smaller UX
             # scope, deliberately left." A learner who had not yet completed
             # a first session had no way to pre-mark known travel — booking
             # it before a first session is not a rarer case than booking it
             # after, and the empty-state screen offered nothing but a
             # sentence. Fixed: new `components/plan/EmptyPlanAwayList.tsx`,
             # rendered alongside the existing honest zero-state sentence
             # (never in place of it — the sentence is still true, this adds
             # a second, independent fact beside it). It decides nothing
             # about scheduling — no item, no load, no zone, since none of
             # those exist yet and fabricating one would be exactly the
             # "projecting a schedule for a learner who has not started" lie
             # the zero-state sentence exists to refuse — it only enumerates
             # the same future window `forecast.ts` already names
             # (`ESTIMATED_THROUGH_DAY`, offsets 1..14, never 0 — a day
             # already underway is not a planned absence, the same rule
             # `PlanCalendar.tsx#MarkAwayButton` already enforces) and calls
             # the same `onToggleAway` handler `PlanIsland` already built for
             # the "ready" case. `lib/plan/forecast.ts#dateLabel` is now
             # exported (was private) so the new component labels a day
             # identically to the real calendar, rather than re-deriving the
             # same `Intl.DateTimeFormat` call a second time — the exact
             # "tested resolver exists, a second copy is grown beside it"
             # shape this build has repeatedly closed elsewhere
             # (`gradeClassToWire`, `lastActiveDayMs`, `digestsMatch`,
             # `EntitlementState::permitsNewContent()`). Once a toggle
             # commits, the log is no longer empty (one `day_marked_away`
             # event), so `useLogState` naturally re-renders the SAME real
             # `PlanCalendar` the "ready" case always used — no second
             # rendering path, no divergent implementation of "away" for the
             # pre-first-session case.
             #
             # RED confirmed directly: four new cases in a dedicated
             # `test/plan-island.test.tsx` describe block, run against the
             # unmodified component (3 pre-existing describe-block tests in
             # the file untouched) — 2 of 4 failed exactly as predicted
             # (`expected null to be truthy` on the day row; a `TypeError`
             # on `within(null)` for the commit case), the other 2 (the
             # zero-state sentence still renders; today is never offered)
             # passed vacuously, correctly, since neither depends on the fix.
             # Implemented; reran: 7/7 green (was 3, +4). The load-bearing
             # commit case does not stub the write path — it clicks the real
             # button, awaits the real `setDayAway`/`append()` call, and
             # asserts the REAL `PlanCalendar`'s own `data-away="true"` row
             # appears afterward, proving the empty-state list and the ready-
             # state calendar agree on the same offset for the same toggle,
             # not merely that a click handler fires.
             #
             # `TZ=UTC make test`: 2747 passing (was 2743, +4 — exactly this
             # run's four new tests; apps/web 1446, was 1442; no other suite
             # moved: 255 v2 vitest, 47 v2/api, 384 v3/api, 120
             # corpus-compiler, 432 engine, 63 fold-runner).
             # `check-test-floor.mjs`: OK, 2747 >= floor 1899 (+848 margin,
             # unmoved, same discipline as every prior entry). `TZ=UTC make
             # build`: exit 0, 30 routes (unchanged — no new route, edits
             # inside the existing `/plan` component tree). `npm run gates`:
             # all green (boundaries 317 files, up from 316 — exactly the
             # one new production file; fonts degraded-but-non-blocking,
             # pre-existing, 2/6 UI fonts present; corpus-morphology 362
             # words / corpus-glyphs 206 codepoints, both unchanged — no
             # corpus recompile, this is a plan-calendar-only change). `npx
             # tsc --noEmit`, run separately across all four v3 node
             # packages (`dateLabel`'s export is additive, so no existing
             # caller needed updating): clean in all four. No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff produced by running the suite was reverted
             # before committing, same discipline as every prior entry —
             # `git status --porcelain -- v1 v2` empty immediately before
             # committing). No Arabic codepoint (all four changed/new files
             # swept programmatically, in Python, over the Arabic, Arabic
             # Supplement, Arabic Extended-A and both Presentation Forms
             # Unicode blocks, plus a `fromCharCode`/`fromCodePoint`/
             # `\u06xx`/`\u07xx`/`\u08xx`/`\uFBxx`/`\uFExx` escape sweep —
             # zero matches; every new string is a fixed English caption/
             # button label or a day-offset integer, never corpus text).
             # Session start: fresh container, no
             # `node_modules`/`vendor`/compiled corpus anywhere; `HEAD` was
             # found detached at `6a62525`, exactly `origin/main`'s own tip
             # (v3-D219) — no stale-local-main trap this run, confirmed
             # directly via `git fetch origin main` before any exploration.
             # `make setup` ran from scratch, no retries needed. Found by
             # re-reading v3-D207's own repeatedly-carried "NOT addressed"
             # note directly (it already named this gap by file and by
             # reason) rather than dispatching a fresh zero-caller sweep —
             # independently re-verified against `PlanIsland.tsx`'s real
             # source and `test/plan-island.test.tsx`'s own comment before
             # writing any test. NOT addressed: every item on v3-D219's own
             # "NOT addressed" list, unchanged — the streak/away-day
             # day-space mismatch (v3-D209); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate`
             # as a whole class (v3-D88, v3-D151); multi-surah enrollment;
             # the operational mailer/7-night window; PAY-1's Stripe
             # fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); `MacroFacts.litany.rhymeLabel`
             # (v3-D188); `StripeField.editable` (v3-D204); `corpusHash`'s
             # own zero fold-side consumer (v3-D206); FR5's own queue-level
             # behavior for "restart"/"replan"/"makeup" (v3-D217) — all
             # unchanged. See DECISIONS.md v3-D220.
             # NOTE (v3-D218, 2026-09-15): `packages/engine/src/resume.ts
             # #ResumeDecision.massed` — computed by `resumePolicy()` on
             # every interruption classification since FR5 landed (v3-D217,
             # earlier the SAME day), real and dynamic (`true` only for a
             # same-hour "restart", `false` otherwise) — had exactly ONE
             # reader anywhere: `resume.test.ts`'s own assertions. The real
             # production call site v3-D217 just built,
             # `lib/session/run.ts#acknowledgeReentry()`, stamped its
             # sibling `decision.action` onto the committed `interruption`
             # event but silently dropped `decision.massed` — the one fact
             # `ResumeDecision`'s own docblock says exists to distinguish a
             # quick same-hour restart from a longer gap within the
             # identical "restart" bucket. `grep -rn "massed"` outside test
             # files confirmed the only hit anywhere was `update.ts`'s own,
             # UNRELATED `massed` computation (a per-atom `lastRetrieval`
             # same-day check that already applies invariant #4's ×0.35
             # damping correctly regardless of this field — confirmed
             # directly by reading `update.ts:98-102` before writing any
             # test, so this fix is diagnostic/audit-trail only, not a
             # grading-correctness fix). Found by a dedicated fresh-sweep
             # agent (Explore) handed the full exclusion list carried
             # through v3-D217 and directed at `worker/fold-runner/src`,
             # `packages/corpus-compiler/src`, `v3/api/app/**` and
             # `apps/web/lib/**`; independently re-verified by this run
             # directly against `resume.ts`, `run.ts` and `update.ts`'s real
             # source before writing any test. Fixed, one field carried
             # through three layers, mirroring `resume`'s own established
             # plumbing exactly: `DrillEvent`/`MakeEventArgs` gain an
             # optional `resumeMassed?: boolean`; `acknowledgeReentry` now
             # stamps `resumeMassed: decision.massed` alongside
             # `resume: decision.action`; the `events` table gains a real
             # `resume_massed` nullable boolean column (a migration, since
             # `resume` itself already has one and this is its direct
             # sibling) with matching `FIELD_MAP`/`NULLABLE_FIELDS`/
             # `$fillable`/cast entries, the exact template v3-D207's
             # `awayDayIndex`/`away` pair established. RED confirmed at both
             # layers, each reverted via `git stash`/moving the migration
             # aside (every new test kept) and restored byte-identically
             # after: engine/session-loop level, 2 cases in `run.test.ts` (a
             # strengthened existing assertion plus one new test proving a
             # `>1hr` "replan" gap carries `resumeMassed: false`, so the fix
             # cannot be a hardcoded `true`) failed exactly `expected
             # undefined to be true`/`false`; 85/85 green after (was 83,
             # +1 net — one strengthened test, one new). Laravel level, 2
             # new cases (`EventsIngestionTest`, `EventsPullTest`) failed on
             # `Undefined array key "resumeMassed"` / a missing
             # `resume_massed` column value against the unmodified
             # controller/model; 10/10 and 9/9 green after (was 9/9 and 8/9,
             # +1 each). `php artisan test` (v3/api): 381 passing (was 379,
             # +2; 2 incomplete + 6 skipped unchanged, PAY-1).
             # `./vendor/bin/pint --test` on all five changed/new PHP files:
             # passed. `TZ=UTC make test`: 2740 passing (was 2737, +3 —
             # exactly this run's new tests: 1 apps/web + 2 v3/api; no other
             # suite moved). `check-test-floor.mjs`: OK, 2740 >= floor 1899
             # (+841 margin, unmoved, same discipline as every prior entry).
             # `TZ=UTC make build`: exit 0, 30 routes (unchanged — no new
             # route or component, a lib/model/controller-only change).
             # `npm run gates`: all green (boundaries 316 files, unchanged
             # count — no new production file under `apps/web`; fonts
             # degraded-but-non-blocking, pre-existing, 2/6 UI fonts
             # present; corpus-morphology 362 words / corpus-glyphs 206
             # codepoints, both unchanged — no corpus recompile, this is a
             # wire-field-only change). `npx tsc --noEmit`, run separately
             # across all four v3 node packages (the field is optional, so
             # no existing fixture needed updating, unlike v3-D217's own
             # required `lastActivityAt` field): clean in all four. No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff produced by running the suite was reverted
             # before committing, same discipline as every prior entry —
             # `git status --porcelain -- v1 v2` empty immediately before
             # committing). No Arabic codepoint (all nine changed/new files
             # swept programmatically, in Python, over the Arabic, Arabic
             # Supplement, Arabic Extended-A and both Presentation Forms
             # Unicode blocks, plus a `fromCharCode`/`fromCodePoint`/
             # `\u06xx`/`\u07xx`/`\u08xx`/`\uFBxx`/`\uFExx` escape sweep —
             # zero matches; every new string is a TypeScript/PHP
             # identifier, a wire field name, a fixed English docblock
             # sentence, or a closed-set test fixture value ("restart",
             # "replan"), never corpus text). Session start: fresh
             # container, no `node_modules`/`vendor`/compiled corpus
             # anywhere; local `HEAD` was found detached at `d678e54`,
             # exactly `origin/main`'s own tip (v3-D217) — no
             # stale-local-main trap this run, confirmed directly via `git
             # fetch origin main` before any exploration (the fetch itself
             # advanced a PRE-EXISTING stale remote-tracking ref from
             # `26cc664` to `d678e54`; no work was ever unpushed). `make
             # setup` then `make compile-corpus` both ran from scratch, no
             # retries needed. NOT addressed: the full FR5 queue-level
             # restart/replan/makeup behavior (v3-D217, still deliberately
             # deferred); every item on v3-D217's own "NOT addressed" list,
             # unchanged (the streak/away-day day-space mismatch, v3-D209;
             # `rhymeClassOf()`, v3-D136; `EntitlementMachine::merge()`;
             # `App\Billing\TrialAttribution`;
             # `lib/pricing.ts#regionFromCountry()`; `PaywallGate` as a
             # whole class; multi-surah enrollment; the operational
             # mailer/7-night window; PAY-1's Stripe fixtures; surah 67's
             # scene beats; `worker/fold-runner/src/severity.ts`'s taxonomy
             # drift; `packages/engine/src/placement.ts`;
             # `MacroFacts.litany.rhymeLabel`; `StripeField.editable`;
             # `corpusHash`'s own zero fold-side consumer; `lib/plan/
             # forecast.ts`'s empty-log zero-state). See DECISIONS.md
             # v3-D218.
             # NOTE (v3-D219, 2026-09-16): `App\Billing\PaywallGate` re-derived
             # `EntitlementState`'s own two named decisions instead of calling
             # them. `permitsNewContent()` ("the ONLY question the paywall may
             # ever ask") and `permitsReview()` ("a single named place for the
             # never-hostage rule v3-D16") both exist specifically so this
             # question has one home — but `permitsIssuance()` re-derived the
             # first via an if/else chain whose FINAL branch fell through
             # unconditionally to `lapsed_review_only`, correct only because
             # exactly four states exist today, and `permitsReview()`
             # hardcoded `true` a second time, ignoring `$entitlement`
             # entirely. Same "tested resolver exists, the one caller
             # re-derives it inline" shape as `gradeClassToWire` (v3-D83),
             # `lastActiveDayMs` (v3-D113), `digestsMatch` (v3-D159) — found
             # by re-reading `PaywallGate` against `EntitlementState` after
             # v3-D217's own "NOT addressed" list named `PaywallGate` as a
             # whole class still worth checking. Not a live divergence for
             # today's four states (both methods already agree, coincidentally
             # rather than by construction) but a fifth state would silently
             # diverge — `permitsNewContent()`'s own closed `match` would
             # throw, `permitsIssuance()`'s manual chain would instead mislabel
             # it `lapsed_review_only`. Fixed: `permitsIssuance()` now checks
             # `$state->permitsNewContent()` first and denies only when it
             # returns false (today reachable by `LapsedReviewOnly` alone,
             # unchanged); the three admitted states keep their own existing
             # branches; the old unconditional fallback is now unreachable
             # code guarded by a `throw new \LogicException` naming any future
             # unhandled state explicitly, never a silent mislabel.
             # `permitsReview()` now returns `$entitlement === null ||
             # $entitlement->state->permitsReview()` — a null entitlement (no
             # account yet) still defaults to the same unconditional `true`.
             # RED confirmed directly, mirroring `EntitlementBoundaryTest`'s
             # own STRUCTURAL technique (source, not behavior — a behavioral
             # test can only prove the two methods currently agree, never that
             # one delegates to the other): `git stash` of `PaywallGate.php`
             # alone (all 3 new tests kept, 8 pre-existing cases untouched)
             # failed exactly the 2 structural cases —
             # `assertStringContainsString('permitsNewContent()', $body)` /
             # `'permitsReview()'` both failed against the untouched
             # if/else-chain and hardcoded-`true` bodies; the third,
             # regression case (iterates all four `EntitlementState::cases()`,
             # asserts `permitsIssuance()`'s own `->permitted` equals
             # `$state->permitsNewContent()` directly) passed vacuously,
             # correctly — it guards a FUTURE refactor, not this run's own
             # RED. Restored byte-identically, reran: 11/11 green in
             # `PaywallBoundaryTest` (was 8, +3), 56 assertions. `TZ=UTC make
             # test`: 2743 passing (was 2740 after v3-D218's own fix landed
             # first, +3 — exactly this run's three new PHPUnit cases; v3/api
             # 384, was 381; no other suite moved). `check-test-floor.mjs`:
             # OK, 2743 >= floor 1899 (+844 margin, unmoved). `TZ=UTC make
             # build`: exit 0, 30 routes (unchanged —
             # a Laravel-only fix, no apps/web file touched). `npm run
             # gates`: all green (boundaries 316 files, unchanged count — no
             # new production file, one existing PHP file edited plus its
             # one existing test file; fonts degraded-but-non-blocking,
             # pre-existing, 2/6 UI fonts present; corpus-morphology 362
             # words / corpus-glyphs 206 codepoints, both unchanged — no
             # corpus recompile). `./vendor/bin/pint --test` on both changed
             # files: `PaywallGate.php` passed; `PaywallBoundaryTest.php`
             # reports the identical single `single_quote` finding on the
             # SAME pre-existing line both before and after this diff,
             # confirmed directly by stashing and re-running pint —
             # pre-existing drift this fix does not introduce, left alone,
             # same discipline as `WebhookHandler.php`'s own precedent
             # (v3-D203). No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff produced by running
             # the suite was reverted before committing, same discipline as
             # every prior entry — `git status --porcelain -- v1 v2` empty
             # immediately before committing). No Arabic codepoint (both
             # changed files swept programmatically, in Python, over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks, plus a
             # `fromCharCode`/`fromCodePoint`/`\u06xx`/`\u07xx`/`\u08xx`/
             # `\uFBxx`/`\uFExx` escape sweep — zero matches; every new line
             # is a PHP identifier, a method name, or a fixed English
             # docblock/assertion-message sentence, never corpus text).
             # Session start: this run picked up mid-session after a
             # container restart during a prior autonomous run had already
             # left this exact fix uncommitted and unverified on disk; the
             # inherited diff was read directly, RED was independently
             # re-confirmed against it before trusting it, and every gate
             # was run fresh rather than assumed. `origin/main` had moved to
             # `61ca26d` (v3-D218, the `resumeMassed` fix, a concurrent
             # session's own independent work — disjoint files, no
             # conflict) while this fix was in flight; rebased cleanly onto
             # it and renumbered this entry from a collision at v3-D218 to
             # v3-D219. NOT addressed:
             # `PaywallGate` as a whole class still has zero production
             # callers — this fix makes what it COMPUTES self-consistent,
             # not whether anything calls it; wiring it into session
             # assembly still needs Firdaus's still-open call on
             # review-vs-new-content in one mixed queue (v3-D88,
             # unresolved). Every item on v3-D217's own "NOT addressed"
             # list, unchanged (the streak/away-day day-space mismatch,
             # v3-D209; `rhymeClassOf()`; `EntitlementMachine::merge()`;
             # `App\Billing\TrialAttribution`;
             # `lib/pricing.ts#regionFromCountry()`; multi-surah enrollment;
             # the operational mailer/7-night window; PAY-1's Stripe
             # fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift;
             # `packages/engine/src/placement.ts`;
             # `MacroFacts.litany.rhymeLabel`; `StripeField.editable`;
             # `corpusHash`'s own zero fold-side consumer; `lib/plan/
             # forecast.ts`'s empty-log zero-state; FR5's own queue-level
             # behavior for "restart"/"replan"/"makeup") — all unchanged.
             # See DECISIONS.md v3-D219.
             # NOTE (v3-D217, 2026-09-15): `packages/engine/src/resume.ts
             # #resumePolicy()` (FR5's re-entry classifier) had exactly ONE
             # caller anywhere — `lib/progress/rows.ts#timeOnTaskMs`, which
             # reads only its `discardLatency` boolean — despite that same
             # function's own docblock claiming "the same function the
             # session loop uses." Grepping `lib/session/run.ts` and every
             # `components/session/*` file for `resumePolicy` returned
             # nothing before this fix: the claim was false when written.
             # The `interruption` EventType/`DrillEvent.resume` field had
             # zero constructors anywhere outside test fixtures — a learner
             # who backgrounded the app mid-drill for ninety minutes and
             # came back left no trace of the gap in their own log and was
             # told nothing about it. Scoped deliberately, mirroring this
             # codebase's own "one door at a time" precedent (FR6's Doors
             # 1/2/3, each its own night): the full re-entry behavior
             # (actually restarting the current item, re-planning the
             # remaining queue, or running a make-up merge for
             # "restart"/"replan"/"makeup") is NOT built this run — a
             # genuinely separate, larger scope, named so a future run
             # doesn't have to re-derive that boundary from scratch. Fixed,
             # three layers: `resume.ts` gains `resumeNotice(action)` (the
             # one-line copy for a real gap, mirroring
             # `freeplay.ts#diminishingReturns`'s own precedent for
             # engine-owned copy); `lib/session/run.ts` gains
             # `SessionRun.lastActivityAt` (refreshed centrally inside
             # `commitThenContinue`, one choke point), `classifyReentry()`
             # and `acknowledgeReentry()` (commits a real `interruption`
             # event — `structured: false`, exactly like
             # `test_*`/`day_marked_away`, so `rebuild.ts`'s structural
             # absence of a branch for it means this can never move a
             # strength or a due date); `SessionIsland.tsx` gains a
             # `window` "focus" effect — the SAME re-entry signal
             # `SyncTrigger.tsx` already uses for the identical question —
             # that classifies a real gap, commits the audit event, and
             # renders the honest notice, cleared on the learner's next
             # interaction. RED confirmed at all three layers, each via
             # `git stash` of the production file(s) alone (every new test
             # kept) and restored byte-identically after: engine (2 new
             # `resume.test.ts` cases) failed on `resumeNotice is not a
             # function`; `run.ts` (7 new `run.test.ts` cases) failed on
             # `classifyReentry`/`acknowledgeReentry is not a function`;
             # the component (3 new `session-island.test.tsx` cases)
             # failed exactly 2 of 3 — `findByTestId("reentry-notice")`
             # timing out on the load-bearing positive case and the
             # notice-clearing case — while the negative case ("an
             # ordinary short gap earns no notice") passed vacuously,
             # correctly. The load-bearing `run.ts` case proves the fold is
             # genuinely untouched by an `interruption` event
             # (`rebuild()` before/after, deep-equal on the affected atom);
             # a second proves the gap is measured from the LAST commit
             # (a real wrong tap that never advances the run), not from
             # `startedAt`. The component's positive case spies `Date.now`
             # directly rather than `vi.useFakeTimers()`, which serialized
             # against fake-indexeddb's own internal scheduling and
             # produced a 5-second test timeout on the first draft — caught
             # and fixed before this note was written. `TZ=UTC make test`:
             # 2737 passing (was 2725, +12 — exactly this run's new tests: 2
             # engine + 7 + 3 apps/web; engine 432, was 430; apps/web 1441,
             # was 1431; no other suite moved). `check-test-floor.mjs`: OK,
             # 2737 >= floor 1899 (+838 margin, unmoved). `TZ=UTC make
             # build`: exit 0, 30 routes (unchanged — no new route or
             # component file, edits inside the existing `/session`
             # component tree and its `lib/` layer). `npm run gates`: all
             # green (boundaries 315 files — no new production file, three
             # existing production files edited plus three existing test
             # files; fonts degraded-but-non-blocking, pre-existing, 2/6 UI
             # fonts present; corpus-morphology 362 words / corpus-glyphs
             # 206 codepoints, both unchanged — no corpus recompile, all
             # three staged corpusHashes byte-identical to v3-D216's own).
             # `npx tsc --noEmit`, run separately across all four v3 node
             # packages (widening `SessionRun` with a new required field
             # surfaced eleven pre-existing bare-literal fixtures across
             # `run.test.ts`/`session-island.test.tsx` that needed
             # `lastActivityAt` added — a genuine TS compile-time catch,
             # not a test-only concern): clean in all four. No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff produced by running the suite was reverted
             # before committing, same discipline as every prior entry —
             # `git status --porcelain -- v1 v2` empty immediately before
             # committing). No Arabic codepoint (all six changed files
             # swept programmatically, in Python, over the Arabic, Arabic
             # Supplement, Arabic Extended-A and both Presentation Forms
             # Unicode blocks, plus a `fromCharCode`/`fromCodePoint`/
             # `\u06xx`/`\u07xx`/`\u08xx`/`\uFBxx`/`\uFExx` escape sweep —
             # zero matches; every new string is a TypeScript identifier, a
             # fixed English sentence, a wire field name, or a millisecond
             # arithmetic result, never corpus text). Session start: fresh
             # container, no `node_modules`/`vendor`/compiled corpus
             # anywhere; `HEAD` was found detached at `e8c4cfd`, exactly
             # `origin/main`'s own tip (v3-D216) — no stale-local-main trap
             # this run, confirmed directly via `git fetch origin main`
             # before any exploration. `make setup` then `make
             # compile-corpus` both ran from scratch, no retries needed.
             # Found by a dedicated fresh-sweep agent (Explore) handed the
             # full exclusion list carried through v3-D216 and directed at
             # `worker/fold-runner/src`, `packages/corpus-compiler/src`,
             # `v3/api/app/**` and `apps/web/lib/**` subdirectories; it also
             # independently confirmed `corpus-compiler/src/report.ts
             # #buildReport()` (flagged unconfirmed at v3-D216) is a real,
             # deliberate human-read build artifact, not the zero-caller
             # shape — closed off future "NOT addressed" lists as
             # resolved-not-a-gap. NOT addressed: FR5's own queue-level
             # behavior for "restart"/"replan"/"makeup" (above); every item
             # on v3-D216's own "NOT addressed" list, unchanged (the
             # streak/away-day day-space mismatch, v3-D209; `rhymeClassOf()`,
             # v3-D136; `EntitlementMachine::merge()`;
             # `App\Billing\TrialAttribution`;
             # `lib/pricing.ts#regionFromCountry()`; `PaywallGate` as a
             # whole class; multi-surah enrollment; the operational
             # mailer/7-night window; PAY-1's Stripe fixtures; surah 67's
             # scene beats; `worker/fold-runner/src/severity.ts`'s taxonomy
             # drift; `packages/engine/src/placement.ts`;
             # `MacroFacts.litany.rhymeLabel`; `StripeField.editable`;
             # `corpusHash`'s own zero fold-side consumer; `lib/plan/
             # forecast.ts`'s empty-log zero-state). See DECISIONS.md
             # v3-D217.
             # NOTE (v3-D215, 2026-09-14): a confirmed `selection_determinism_
             # check` P1 paged its on-call engineer a page SHAPED FOR THE
             # OTHER CHECK. `App\Mail\DeterminismP1Alert::content()` has been
             # dispatched for a confirmed P1 on either nightly check since
             # v3-D82 (`record()`/`pageOnCall()` call it identically for
             # `fold_determinism_check` and `selection_determinism_check`,
             # both scheduled nightly via `determinism:check both`), but it
             # unconditionally read `report['divergentCount']`/`['skewCount']`/
             # `['atomsCompared']`/`['usersChecked']` — `FoldCheckReport`'s
             # own shape. `SelectionCheckReport`
             # (`worker/fold-runner/src/selectionCheck.ts`) has none of those
             # keys — `seeds`/`eventsReplayed`/`tracesCompared`/`divergences`
             # instead — so every `??` fallback silently read 0, and the
             # fixed body prose ("a live atom_cache row that disagrees with a
             # fresh fold... Invariant #2 is broken") was flatly wrong for a
             # shuffle-order divergence, which has no atom_cache and no
             # invariant-#2 relationship at all. The page a 3am on-call
             # engineer reads to decide whether to act, for the highest-
             # severity signal in this codebase (a confirmed P1 resets the
             # 7-night launch window), read "Divergent atoms: 0. Atoms
             # compared: 0. Learners sampled: 0" — indistinguishable from a
             # broken template — while three real seeds and two real
             # divergent traces sat computed and unused in the same report.
             # Distinct from v3-D179 (gave the admin console's own
             # `/settings/health` panel a `selectionFindings()` reader for
             # the same report shape) — this mailer is a separate consumer
             # of the identical `NightlyCheckRun.report` column v3-D179 never
             # touched, and had carried the wrong-shape read since its own
             # creation at v3-D82. Fixed, mailer + view only, no report
             # schema change: `content()` branches on `$this->check` — a
             # selection run builds `seedsCompared`/`eventsReplayed`/
             # `tracesCompared`/`divergentTraces` instead of the fold-shaped
             # keys; the blade view gains an `@if ($kind === 'selection')`
             # branch with matching body prose and its own four bullets, the
             # fold branch's markup byte-identical to before. No PII either
             # way — `divergences` carries no learner id at all (a selection
             # check replays a committed fixture log, never production
             # data). RED confirmed directly: two new cases in
             # `DeterminismP1PagerTest.php` (5 pre-existing, all `check:
             # 'fold'`, untouched) — the load-bearing case constructs a
             # `NightlyCheckRun` directly with a real selection-shaped report
             # (3 seeds, 2 divergences, mirroring `NightlyWindowTest`'s own
             # precedent for this construction — the committed selection-log
             # fixture is never touched, no oracle regenerated) and renders
             # `(new DeterminismP1Alert($run))->render()`, asserting the real
             # counts reach the HTML while the fold-only labels and prose are
             # absent — failed exactly `Failed asserting that '...' contains
             # "Seeds compared"` against the unmodified class; the sibling
             # fold-content case passed vacuously, correctly (that branch was
             # already right). Restored byte-identically, reran: 7/7 green
             # (was 5, +2). `php artisan test` (v3/api): 379 passing (was
             # 377, +2; 2 incomplete + 6 skipped unchanged, PAY-1).
             # `./vendor/bin/pint --test` on all three changed files: passed.
             # `TZ=UTC make test`: 2723 passing (was 2721, +2 — exactly this
             # run's two new tests; v3/api 379, was 377; no other suite
             # moved — apps/web unchanged at 1431 since no apps/web file was
             # touched). `check-test-floor.mjs`: OK, 2723 >= floor 1899 (+824
             # margin, unmoved, same discipline as every prior entry).
             # `TZ=UTC make build`: exit 0, 30 routes (unchanged — no
             # apps/web route or component touched, Laravel-only fix). `npm
             # run gates`: all green (boundaries 316 files, unchanged count —
             # no new production file under apps/web; fonts degraded-but-
             # non-blocking, pre-existing, 2/6 UI fonts present; corpus-
             # morphology 362 words / corpus-glyphs 206 codepoints, both
             # unchanged — no new corpus data). No `v1/**`/`v2/**` edit (a
             # stray `v2/tsconfig.tsbuildinfo` build-cache diff produced by
             # running the suite was reverted before committing, same
             # discipline as every prior entry — `git status --porcelain --
             # v1 v2` empty immediately before committing). No Arabic
             # codepoint (all three changed files swept programmatically, in
             # Python, over the Arabic, Arabic Supplement, Arabic Extended-A
             # and both Presentation Forms Unicode blocks, plus a
             # `fromCharCode`/`fromCodePoint`/`\u06xx`/`\u07xx`/`\u08xx`/
             # `\uFBxx`/`\uFExx` escape sweep — zero matches; every new
             # string is a PHP identifier, a wire field name, a fixed
             # English sentence, or a synthetic seed/traceKey/lane test
             # fixture value ported from `NightlyWindowTest`'s own
             # precedent, never corpus text). Session start: fresh
             # container, no `node_modules`/`vendor`/compiled corpus
             # anywhere; `HEAD` was found detached at `9da82ee`, the same
             # commit `origin/main` was already at, on a stale LOCAL `main`
             # branch ref thirteen commits behind (`26cc664`, v3-D201) — the
             # recurring "stale local main" trap this file has recorded
             # roughly fifty times since v3-D77 — caught before any
             # implementation work via `git fetch` + `git checkout main &&
             # git merge --ff-only origin/main`, a clean fast-forward, no
             # work lost or at risk. `make setup` then `make compile-corpus`
             # both run from scratch, no retries needed. Found by a
             # dedicated fresh-sweep agent (Explore) handed the full
             # exclusion list carried through v3-D214 and directed at
             # `worker/fold-runner/src`, `api/app/Console/Commands`,
             # `api/app/Mail`, and the newest migrations/type fields — it
             # independently re-confirmed the away-day feature (v3-D207),
             # the admin controller/`lib/admin` type-pair family, and
             # `DrillEvent.locale` (v3-D213/D214) all genuinely fully wired
             # before landing on this instance; independently re-verified by
             # this run directly against `DeterminismP1Alert.php`, the blade
             # view, and both report shapes' real TypeScript source before
             # writing any test. NOT addressed: every item on v3-D214's own
             # "NOT addressed" list, unchanged (the streak/away-day
             # day-space mismatch, v3-D209; `rhymeClassOf()`, v3-D136;
             # `EntitlementMachine::merge()`; `App\Billing\TrialAttribution`;
             # `lib/pricing.ts#regionFromCountry()`; `PaywallGate` as a whole
             # class; multi-surah enrollment; the operational mailer/7-night
             # window — this fix makes the mailer's OWN content correct for
             # both checks, but does not stand up a live SMTP account or a
             # staging host, C5/gate 20's own "who carries the 3am pager" is
             # still unanswered; PAY-1's Stripe fixtures; surah 67's scene
             # beats; `worker/fold-runner/src/severity.ts`'s taxonomy drift;
             # `packages/engine/src/placement.ts`;
             # `MacroFacts.litany.rhymeLabel`; `StripeField.editable`;
             # `corpusHash`'s own zero fold-side consumer; `lib/plan/
             # forecast.ts`'s empty-log zero-state). See DECISIONS.md
             # v3-D215.
             # NOTE (v3-D214, 2026-09-14): `TestIsland.tsx`'s own `test_start`/
             # `test_answer`/`test_result` events still carried no `locale` —
             # v3-D213's own "NOT addressed" list named this exactly as its
             # closing item, a smaller sibling of that fix: `DrillEvent.locale`
             # is a generic field on every `EventType` (the backend column
             # already accepts it for any event, no schema change needed), and
             # `TestIsland.tsx` already takes `glossLang: GlossLang` as a
             # REQUIRED prop — used to build every gloss-bearing Test item —
             # but none of the three `DrillEvent` literals it builds
             # (`test_start`, `test_answer`, `test_result`) ever stamped it.
             # `grep -n "locale" apps/web/lib/test/build.ts
             # apps/web/components/test/TestIsland.tsx` returned nothing
             # before this fix. Fixed on the exact one-line pattern `run.ts`
             # already established (v3-D213): all three literals gain
             # `locale: glossLang` — the component's own prop, never
             # re-derived, never defaulted; no engine/wire/backend change. RED
             # confirmed directly: one new case in `test-island.test.tsx`
             # (added to the existing describe block, 5 pre-existing cases
             # untouched) runs a full Test with `glossLang="ms"` (every other
             # case in the file uses "en", so this cannot pass by accident)
             # and asserts every `test_start`/`test_answer`/`test_result`
             # event carries `locale === "ms"` — against the unmodified
             # component this failed exactly `expected undefined to be 'ms'`;
             # restored byte-identically (`git stash` of `TestIsland.tsx`
             # alone), reran: 6/6 green (was 5, +1). `TZ=UTC make test`: 2721
             # passing (was 2720, +1 — exactly this run's one new test;
             # apps/web 1431, was 1430; no other suite moved: 255 v2 vitest,
             # 47 v2/api, 377 v3/api, 120 corpus-compiler, 430 engine, 61
             # fold-runner). `check-test-floor.mjs`: OK, 2721 >= floor 1899
             # (+822 margin, unmoved, same discipline as every prior entry).
             # `TZ=UTC make build`: exit 0, 30 routes (unchanged — no route
             # touched, edits inside the existing `/test` component). `npm run
             # gates`: all green (boundaries 315 files via `make build`'s own
             # `prebuild` chain, unchanged count — no new production file, one
             # existing component edited plus one existing test file; a later
             # standalone `npm run gates` reported 316, the same pre-existing
             # gitignored `next-env.d.ts` Next.js bootstrap-artifact
             # fluctuation v3-D206's own entry already recorded, confirmed via
             # `git status --porcelain` to be no part of this diff; fonts
             # degraded-but-non-blocking, pre-existing, 2/6 UI fonts present;
             # corpus-morphology 362 words / corpus-glyphs 206 codepoints,
             # both unchanged — no new corpus data, only an already-existing
             # wire field now carried by one more event family). `npx tsc
             # --noEmit` (run standalone, and again inside `next build`'s own
             # TypeScript pass): clean, exit 0. No `v1/**`/`v2/**` edit (a
             # stray `v2/tsconfig.tsbuildinfo` build-cache diff produced by
             # running the suite was reverted before committing, same
             # discipline as every prior entry — `git status --porcelain --
             # v1 v2` empty immediately before committing). No Arabic
             # codepoint (both changed files swept programmatically, in
             # Python, over the Arabic, Arabic Supplement, Arabic Extended-A
             # and both Presentation Forms Unicode blocks, plus a
             # `fromCharCode`/`fromCodePoint`/`\u06xx`/`\u07xx`/`\u08xx`/
             # `\uFBxx`/`\uFExx` escape sweep — zero matches; the only new
             # literal string is the closed-set value `"ms"`, already used
             # elsewhere in this same test file, never corpus text). Session
             # start: fresh container, no `node_modules`/`vendor`/compiled
             # corpus anywhere; local `main` and `origin/main` both already
             # agreed at `a0b7476` (v3-D213) — no stale-local-main trap this
             # run, confirmed directly via `git fetch origin main` before any
             # exploration. `make setup` then `make compile-corpus` both run
             # from scratch, no retries needed. Found by re-reading v3-D213's
             # own "NOT addressed" list directly (it already named this gap
             # by file and field) rather than dispatching a fresh sweep agent
             # — independently re-verified against the real source (the grep
             # above) before writing any test. NOT addressed: every item on
             # v3-D213's own "NOT addressed" list, unchanged (the
             # streak/away-day day-space mismatch, v3-D209; `rhymeClassOf()`,
             # v3-D136; `EntitlementMachine::merge()`;
             # `App\Billing\TrialAttribution`;
             # `lib/pricing.ts#regionFromCountry()`; `PaywallGate` as a whole
             # class; multi-surah enrollment; the operational mailer/7-night
             # window; PAY-1's Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift;
             # `packages/engine/src/placement.ts`;
             # `MacroFacts.litany.rhymeLabel`; `StripeField.editable`;
             # `corpusHash`'s own zero fold-side consumer; `lib/plan/
             # forecast.ts`'s empty-log zero-state). With this,
             # `DrillEvent.locale` is now stamped by every event-producing
             # surface in `apps/web`. See DECISIONS.md v3-D214.
             # NOTE (v3-D213, 2026-09-14): `DrillEvent.locale` — frozen at
             # build-plan step 10 with a documented purpose ("Gloss language
             # active for this event", v2-D27) and round-tripped by
             # `wire-freeze.test.ts` with two distinct values since — was
             # never stamped by the real session loop: `lib/session/run.ts`'s
             # `StartInput` had no `glossLang` member, so all four `start*`
             # entry points built every `session_start`/`reconstruct_tap`/
             # `ayah_produced`/`gate_result`/`gate_demote`/`adoption` event
             # with no `locale` at all. Sharper than the usual "computed,
             # zero reader" shape: the fact this field exists to pin was
             # already sitting durably captured on the same device, unread —
             # `lib/onboarding/choices.ts#OnboardingChoices.glossLang` is
             # real, required, committed atomically at onboarding, and the
             # very field `wordGloss()` reads on every S1/vocab item —
             # `SessionGate.tsx` already read `choices.surah`/`choices.pace`
             # via the same `readChoices()` call but discarded
             # `choices.glossLang` on the same line. Fixed on the exact
             # `corpusHash` template (v3-D206): `StartInput`/`SessionRun`
             # gain an optional `glossLang`, resolved ONCE in the shared
             # `startFromQueue` and stamped as `locale` on all eight
             # event-emission sites; `SessionGate.tsx` reads
             # `choices.glossLang` and passes it to `SessionIsland` as a new
             # prop (mirroring `pace`'s own v3-D138 precedent exactly);
             # `SessionIsland.tsx` threads it into all four `start*` calls,
             # never added to the mount effect's own dependency array (same
             # precedent `pace` set — a later choice change does not restart
             # an in-flight session). RED confirmed at both layers, each via
             # `git stash` of the three source files alone (every new test
             # kept), restored byte-identically after: engine/session-loop
             # level, all 4 new `run.test.ts` cases in a dedicated `v3-D213`
             # describe block failed exactly as predicted (`expected
             # undefined to be 'ms'` on the two positive cases and
             # `acceptGateDemote`/`acceptAdoption`'s own cases; the negative
             # "never fabricates" case passed vacuously, correctly, since
             # `undefined` was already the pre-fix behavior everywhere) —
             # 77/77 green after (was 73, +4). Component level, one new
             # `session-island.test.tsx` describe block (2 cases) — the
             # positive case (`glossLang="ms"` prop, drives one real DOM tap)
             # failed identically; restored, 31/31 green after (was 29, +2).
             # Both positive cases pass a caller-supplied `glossLang`
             # directly (the frozen/compiled fixtures this file otherwise
             # reads carry no onboarding choice to read one from) and assert
             # every relevant event type carries it, proving the wiring
             # rather than one lucky literal. `TZ=UTC make test`: 2720
             # passing (was 2714, +6 — exactly this run's new tests: 4 + 2;
             # apps/web 1430, was 1424; no other suite moved: 255 v2 vitest,
             # 47 v2/api, 377 v3/api, 120 corpus-compiler, 430 engine, 61
             # fold-runner). `check-test-floor.mjs`: OK, 2720 >= floor 1899
             # (+821 margin, unmoved, same discipline as every prior entry).
             # `TZ=UTC make build`: exit 0, 30 routes (unchanged — no route
             # touched, edits inside the existing `/session` component tree
             # and its `lib/` layer). `npm run gates`: all green (boundaries
             # 315 files, unchanged count — no new production file, three
             # existing files edited plus two existing test files; fonts
             # degraded-but-non-blocking, pre-existing, 2/6 UI fonts present;
             # corpus-morphology 362 words / corpus-glyphs 206 codepoints,
             # both unchanged — no new corpus data, only a wire field carried
             # through). `npx tsc --noEmit` (via `next build`'s own
             # TypeScript pass): clean, exit 0, `Version 5.9.3` confirmed. No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff produced by running the suite was reverted
             # before committing, same discipline as every prior entry —
             # `git status --porcelain -- v1 v2` empty immediately before
             # committing). No Arabic codepoint (all five changed/new files
             # swept programmatically, in Python, over the Arabic, Arabic
             # Supplement, Arabic Extended-A and both Presentation Forms
             # Unicode blocks, plus a `fromCharCode`/`fromCodePoint`/
             # `\u06xx`/`\u07xx`/`\u08xx`/`\uFBxx`/`\uFExx` escape sweep —
             # zero matches; every new string is a wire field name, the
             # closed-set literal `"en"`/`"ms"`, or a fixed English docblock
             # sentence, never corpus text). Session start: fresh container,
             # no `node_modules`/`vendor`/compiled corpus anywhere; local
             # `main` and `origin/main` both already agreed at `86453e2`
             # (v3-D212) — no stale-local-main trap this run, confirmed
             # directly via `git fetch origin main` before any exploration.
             # `make setup` then `make compile-corpus` both run from
             # scratch, no retries needed. Found by a dedicated fresh-sweep
             # agent handed the exclusion list carried through v3-D212 and
             # directed at fields whose producer exists and is tested but
             # whose actual value never reaches a real emitted event — a
             # narrower cut than the usual zero-caller search, since
             # `makeEvent()` does have callers (fixture generators, tests),
             # just none of them in the real session loop. NOT addressed:
             # every item on v3-D212's own "NOT addressed" list, unchanged
             # (the streak/away-day day-space mismatch, v3-D209;
             # `rhymeClassOf()`, v3-D136; `EntitlementMachine::merge()`;
             # `App\Billing\TrialAttribution`;
             # `lib/pricing.ts#regionFromCountry()`; `PaywallGate` as a whole
             # class; multi-surah enrollment; the operational mailer/7-night
             # window; PAY-1's Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift;
             # `packages/engine/src/placement.ts`;
             # `MacroFacts.litany.rhymeLabel`; `StripeField.editable`;
             # `corpusHash`'s own zero fold-side consumer;
             # `lib/plan/forecast.ts`'s empty-log zero-state); also not
             # addressed: `test.ts`/`TestIsland.tsx`'s own
             # `test_answer`/`test_result` events still carry no `locale`
             # either — a different, deliberately read-only/ungraded event
             # family (invariant #5), left alone this run as a smaller,
             # separate, lower-stakes gap than the graded session loop this
             # run closed. See DECISIONS.md v3-D213.
             # NOTE (v3-D212, 2026-09-14): `components/macro/graphNodes.ts`
             # carried its OWN unexported copy of `lib/progress/rows.ts`'s
             # `gateStateOf()` instead of importing it — named and
             # deliberately left by v3-D211's own "NOT addressed" list as "a
             # real, smaller 'two implementations of one decision' shape,
             # distinct from the vocabulary-drift class v3-D210 closed." The
             # two copies actually DISAGREED for one input shape: rows.ts
             # checked `atom.gateDueAt === null` before `atom.gateFails > 0`
             # (so a null `gateDueAt` short-circuited straight to
             # "passed"/"none" regardless of `gateFails`), while
             # graphNodes.ts checked `gateFails > 0` first. Real engine
             # transitions (`gate.ts#applyGateResult` sets both together on a
             # failure; `demoteToLearn` resets both together) never produce
             # `gateFails > 0` with `gateDueAt` still `null`, so this never
             # showed a learner the wrong word — but `test/macro-ring.test.tsx`'s
             # own v3-D210 "a FAILED gate is named" case constructs exactly
             # that combination (`gateAtom(103, 1, { gateFails: 1 })`, leaving
             # `gateDueAt` at `initAtom`'s default `null`) and only passed
             # because it exercised graphNodes.ts's copy, not rows.ts's — the
             # two implementations had already drifted apart with nothing
             # noticing. Fixed: `rows.ts#gateStateOf` is now exported and
             # reordered to check `gateFails > 0` before `gateDueAt === null`
             # (graphNodes.ts's ordering — verified behavior-identical to the
             # old rows.ts ordering across every REACHABLE state, since
             # `gateFails > 0` implies `gateDueAt !== null` in practice);
             # `graphNodes.ts` deletes its local copy and imports+re-exports
             # the one function, alongside `GateState` the type (already
             # re-exported since v3-D210). RED confirmed directly: a new
             # `lib/progress/gateStateOf-agreement.test.ts` (2 cases) run
             # against the unmodified duplication failed both — the first on
             # `import { gateStateOf } from "./rows.ts"` resolving to
             # `undefined` (not yet exported) so `toBe` compared a real
             # function against `undefined`; the second with `TypeError:
             # gateStateOf is not a function` for the same reason. Restored
             # byte-identically (`git diff` empty before implementing), then
             # implemented; reran: 2/2 green. `npx vitest run
             # lib/progress/gateStateOf-agreement.test.ts test/macro-ring.test.tsx
             # test/ayah-detail.test.tsx test/progress-list.test.tsx`: 108/108
             # green (was 106, +2 — exactly this run's new file; the other
             # three files' own pre-existing counts, 33+46+27, unchanged —
             # confirming no regression on either real consumer). `TZ=UTC
             # make test`: 2714 passing (was 2712, +2; apps/web 1424, was
             # 1422; every other suite unchanged: 255 v2 vitest, 47 v2/api,
             # 377 v3/api, 120 corpus-compiler, 430 engine, 61 fold-runner).
             # `check-test-floor.mjs`: OK, 2714 >= floor 1899 (+815 margin,
             # unmoved, same discipline as every prior entry). `TZ=UTC make
             # build`: exit 0, 30 routes (unchanged — no route touched, a
             # pure lib/component consolidation). `npm run gates`: all green
             # (boundaries 315 files, unchanged count — no new production
             # file, two existing files edited plus one new test file; fonts
             # degraded-but-non-blocking, pre-existing, 2/6 UI fonts present;
             # corpus-morphology 362 words / corpus-glyphs 206 codepoints,
             # both unchanged — no new corpus data, only a function moved to
             # one place). `npx tsc --noEmit` (apps/web, via `next build`'s
             # own pass): clean, exit 0. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff produced by running
             # the suite was reverted before committing, same discipline as
             # every prior entry — `git status --porcelain -- v1 v2` empty
             # immediately before committing). No Arabic codepoint (all three
             # changed/new files swept programmatically, in Python, over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks, plus a `fromCharCode`/
             # `fromCodePoint`/`\u06xx`/`\u07xx`/`\u08xx`/`\uFBxx`/`\uFExx`
             # escape sweep — zero matches; every new string is a fixed
             # English docblock sentence or a synthetic gate-state test
             # fixture value, never corpus text). Session start: fresh
             # container, no `node_modules`/`vendor`/compiled corpus
             # anywhere; `HEAD` was found detached at `edf46c7` (v3-D211),
             # the same commit `origin/main` was already at, on a stale LOCAL
             # `main` branch ref ten commits behind (`26cc664`, v3-D201) —
             # the recurring "stale local main" trap this file has recorded
             # roughly forty times since v3-D77 — caught before any
             # implementation work via `git fetch` + `git checkout main &&
             # git merge --ff-only origin/main`, a clean fast-forward, no
             # work lost or at risk. `make setup` then run from scratch, no
             # retries needed. Found by re-reading v3-D211's own "NOT
             # addressed" list directly rather than dispatching a fresh sweep
             # agent — the item was already named, concrete, and small enough
             # to verify by hand (a two-function diff, not a codebase-wide
             # search). NOT addressed: every item on v3-D211's own "NOT
             # addressed" list, unchanged (the streak/away-day day-space
             # mismatch, v3-D209; `rhymeClassOf()`, v3-D136;
             # `EntitlementMachine::merge()`; `App\Billing\TrialAttribution`;
             # `lib/pricing.ts#regionFromCountry()`; `PaywallGate` as a whole
             # class; multi-surah enrollment; the operational mailer/7-night
             # window; PAY-1's Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift;
             # `packages/engine/src/placement.ts`;
             # `MacroFacts.litany.rhymeLabel`; `StripeField.editable`;
             # `corpusHash`'s own zero fold-side consumer;
             # `lib/plan/forecast.ts`'s empty-log zero-state) — all
             # unchanged. See DECISIONS.md v3-D212.
             # NOTE (v3-D211, 2026-09-13): `lib/progress/rows.ts#gateStateOf()`
             # has computed the real, reachable "failed" member of `GateState`
             # since the forgiveness ladder shipped (gate.ts#applyGateResult,
             # DEFECTS.md#B12/v3-D107: a failed cold-gate attempt sets
             # `gateFails += 1` and re-arms `gateDueAt` for the retry) — but
             # the SAME file's own `nextWord()`, the function deciding the
             # "Next"/`nextLabel` cell §10 documents as "the date shown is
             # the date used", branched on "due"/"armed" only and fell
             # through to the ordinary half-life-based due-date computation
             # for "failed" — the identical arithmetic a perfectly healthy
             # atom uses. A learner who failed their gate saw a plain "in N
             # days", indistinguishable from a healthy review, on both real
             # consumers (`ProgressTable.tsx`, `AyahStatsIsland.tsx`) —
             # `grep -rn "\.gate\b" apps/web/components/progress
             # apps/web/lib/progress` returned only `rows.ts`'s own
             # definition. The pre-existing regression test's own assertion
             # (`/^(Today|in \d+ days?|Gate .*)$/`) could not catch this: an
             # alternation is satisfied by the WRONG "in N days" fallback
             # just as well as the right string — it pinned a shape, not the
             # fact. Fixed, display-only, no engine/wire change: `nextWord()`
             # gains one branch, mirroring the existing "armed" branch's
             # shape — reads the atom's own `gateDueAt` and returns "Gate
             # check failed — retry today" / "Gate check failed — retry in
             # N day(s)", reusing `RingDiagram.tsx#gateWord()`'s own "gate
             # check failed" vocabulary (v3-D210) rather than inventing a
             # second phrase for the same fact. RED confirmed directly: two
             # new `it()` blocks in `test/ayah-detail.test.tsx` (44
             # pre-existing cases untouched) — a case building an atom with
             # `gateFails: 1` and a real future `gateDueAt` (2 days out)
             # failed exactly `expected 'in 7 days' to match
             # /gate.*failed/i` against the unmodified `rows.ts`; a negative
             # case (the file's existing never-gated fixture) asserts
             # `nextLabel` never contains "failed", passing vacuously
             # against the unfixed code too, correctly — it proves the fix
             # doesn't paint "failed" onto every row. Restored
             # byte-identically, then implemented; reran: 46/46 green in the
             # file (was 44, +2). `npx vitest run test/progress-list.test.tsx`:
             # 27/27 green, unchanged (the sibling `ProgressTable` consumer,
             # no regression on the ordinary due/armed/none paths). `TZ=UTC
             # make test`: 2712 passing (was 2710, +2; apps/web 1422, was
             # 1420; no other suite moved). `check-test-floor.mjs`: OK, 2712
             # >= floor 1899 (+813 margin, unmoved). `TZ=UTC make build`:
             # exit 0, 30 routes (unchanged — edits inside the existing
             # `/progress`/`/progress/list`/ayah-detail component tree via a
             # shared `lib/` function, no new route). `npm run gates`: all
             # green (boundaries 315 files, unchanged count — one existing
             # production file edited plus its one existing test file, no
             # new production file; fonts degraded-but-non-blocking,
             # pre-existing, 2/6 UI fonts present; corpus-morphology 362
             # words / corpus-glyphs 206 codepoints, both unchanged — no new
             # corpus data). `npx tsc --noEmit` (apps/web): clean, exit 0.
             # No `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff reverted before committing, same discipline
             # as every prior entry). No Arabic codepoint (both changed
             # files swept programmatically, in Python, over the Arabic,
             # Arabic Supplement, Arabic Extended-A and both Presentation
             # Forms Unicode blocks, plus a `fromCharCode`/`fromCodePoint`/
             # `\u06xx`/`\u08xx`/`\uFBxx`/`\uFExx` escape sweep — zero
             # matches; every new string is a fixed English caption or a
             # synthetic gate-state test fixture value, never corpus text).
             # Session start: fresh container, no
             # `node_modules`/`vendor`/compiled corpus anywhere; local `HEAD`
             # and `origin/main` both already agreed at `b6bd205` (v3-D210)
             # — no stale-local-main trap this run, confirmed directly via
             # `git fetch origin main` before any exploration. Found by a
             # dedicated fresh-sweep agent handed the full exclusion list
             # carried through v3-D210 and told not to re-report any of it,
             # directed away from `components/macro/*` (just exhaustively
             # swept at v3-D210) toward sibling wire-type fields not yet
             # checked field-by-field; it independently re-confirmed
             # `lib/session/run.ts`'s full 28-export surface (all wired) and
             # several Laravel `BelongsTo` relations as the already-known
             # "pseudonymize the raw FK instead" pattern before landing on
             # this instance — independently verified by this run directly
             # against `rows.ts` and both real consumers before any test was
             # written. NOT addressed:
             # `components/macro/graphNodes.ts#gateStateOf()` duplicates
             # `rows.ts`'s own `gateStateOf()` logic in a second, unexported
             # local copy rather than importing it — a real, smaller "two
             # implementations of one decision" shape, left alone this run
             # to keep the fix to the one field genuinely reaching learners
             # with wrong text. See DECISIONS.md v3-D211.
             # NOTE (v3-D210, 2026-09-13): `GraphNode.gate` — precomputed by
             # `graphNodes.ts#gateStateOf()` for EVERY mark the memory ring
             # renders since the ring shipped (build-plan step 19), a real,
             # dynamic value (the day-1 cold gate genuinely cycles none ->
             # armed -> due -> passed/failed as a learner drills) — but
             # `RingDiagram.tsx#labelFor()`, the function this file's own
             # header and the `#87` tests name as THE documented accessible
             # text alternative for the whole SVG, never read `node.gate` at
             # all. `grep -n "\.gate\b" components/macro/*.tsx` (excluding
             # tests) returned nothing: `GraphNodeMark.tsx` (the SVG paint)
             # reads stage/encoded/strengthPct only, `summarize()`'s `<desc>`
             # aggregate reads `stageLabel` only. The field's own docblock
             # names edge case #101 by number ("gate-armed/due states +
             # why-locked explanation") and says it is "re-exported from the
             # progress row builder so the ring and the table cannot drift
             # into two different vocabularies for the same fact" — the
             # vocabulary (`lib/progress/rows.ts#nextWord()`'s "Gate due
             # today"/"Gate in N days") existed, the ring just never used its
             # own copy of it. Consequence: `/progress` renders
             # `MacroPanelIsland` STANDALONE — unlike `/surah/[surah]`
             # (`SurahAyahListIsland` beside it) or the ayah-detail page
             # (`AyahStatsIsland`'s own `nextLabel`), it has no per-ayah
             # sibling list at all, so the ring's own link list is the ONLY
             # place a learner or screen-reader user encounters per-mark
             # state there, and it silently omitted whether a mark's atom had
             # a cold gate armed, due, or already failed. Fixed,
             # display-only, no engine/wire change: a new
             # `RingDiagram.tsx#gateWord()` maps `GateState` to one trailing
             # clause — "due" -> ", gate due", "armed" -> ", gate armed",
             # "failed" -> ", gate check failed", "none"/"passed" -> nothing
             # — appended inside `labelFor()` before the existing "you are
             # here" clause; kept as ITS OWN clause rather than folded into
             # `stageLabel`, since a `#87` test already pins `stageLabel`'s
             # five-word vocabulary byte-for-byte against
             # `lib/progress/rows.ts`, and widening it here would risk the
             # exact "two vocabularies for one fact" drift the field's own
             # docblock exists to prevent. RED confirmed directly: two new
             # `it()` blocks in `test/macro-ring.test.tsx` (31 pre-existing
             # cases untouched), run against the unmodified component — a
             # case seeding two DIFFERENT atoms (one due, one armed 3 days
             # out, so one hardcoded word cannot satisfy both) failed exactly
             # `expected 'Ayah 103:1, Learning, 0%' to match /gate due/i`; a
             # `gateFails: 1` case failed identically on `/gate.*failed/i`; a
             # third, negative case (never-gated + already-passed, asserting
             # neither text contains "gate") passed vacuously, correctly — it
             # proves the fix doesn't paint "gate" onto every mark
             # indiscriminately, not that the fix works. Restored
             # byte-identically, then implemented; reran: 33/33 green in the
             # file (was 30, +3). `TZ=UTC make test`: 2710 passing (was 2707,
             # +3; apps/web 1420, was 1417; no other suite moved).
             # `check-test-floor.mjs`: OK, 2710 >= floor 1899 (+811 margin,
             # unmoved). `TZ=UTC make build`: exit 0, 30 routes (unchanged —
             # edits inside the existing `/progress`/`/surah/[surah]`
             # component tree, no new route). `npm run gates`: all green
             # (boundaries 315 files — no new production file this diff, one
             # existing component edited plus its one existing test file;
             # the count differs from v3-D209's own "314" because this
             # session's merge of eight upstream commits added files before
             # this fix touched anything, not because of this fix; fonts
             # degraded-but-non-blocking, pre-existing; corpus-morphology/
             # corpus-glyphs unchanged — no new corpus data). `npx tsc
             # --noEmit` (apps/web): clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted before
             # committing, same discipline as every prior entry). No Arabic
             # codepoint (both changed files swept programmatically, in
             # Python, over the Arabic, Arabic Supplement, Arabic
             # Extended-A and both Presentation Forms Unicode blocks, plus a
             # `fromCharCode`/`fromCodePoint`/`\u06xx`/`\u08xx`/`\uFBxx`/
             # `\uFExx` escape sweep — zero matches; every new string is a
             # fixed English caption or a synthetic gate-state test fixture
             # value, never corpus text). Session start: fresh container, no
             # `node_modules`/`vendor`/compiled corpus anywhere; `HEAD` was
             # found detached at `92bbe54`, the same commit `origin/main`
             # was already at, on a stale LOCAL `main` branch ref eight
             # commits behind (`26cc664`, v3-D201) — the recurring "stale
             # local main" trap this file has recorded roughly forty times
             # since v3-D77 — caught before any implementation work via `git
             # fetch` + `git checkout main && git merge --ff-only
             # origin/main`, a clean fast-forward, no work lost or at risk.
             # `make setup` then `make compile-corpus` both run from
             # scratch, no retries needed. Found by a dedicated fresh-sweep
             # agent handed the full exclusion list carried through v3-D209
             # and told not to re-report any of it, directed at under-swept
             # corners rather than the by-now-exhausted `Corpus`/
             # `CorpusMeta`/admin-controller/panel-pair territory — it
             # independently re-confirmed those areas clean before landing
             # on this genuinely new instance in `components/macro/*`, a
             # file none of the prior ~130 nights in this bug class had
             # checked field-by-field. NOT addressed: every item on
             # v3-D209's own "NOT addressed" list, unchanged. See
             # DECISIONS.md v3-D210.
             # NOTE (v3-D209, 2026-09-13): `FlagRow.ackAt` — stamped for real by
             # `FlagService::acknowledgeKill()` on every kill-banner
             # acknowledgement (and every 72h auto-waive) since the flag plane
             # shipped, sent on the wire by `FlagController` since
             # `lib/admin/flags.ts` first typed `FlagRow` — but
             # `FlagsPanel.tsx`'s own kill banner never rendered it. Sharper
             # than this build's usual "fetched, zero read surface" shape:
             # `Flag::bannerVisible()` (`v3/api/app/Models/Flag.php`) reads
             # `killed_at` ONLY — edge case #159's own docblock: "the banner
             # persists after a kill until an explicit new ramp" — so the
             # banner and its "Acknowledge" button stay up FOREVER after a
             # real acknowledgement, not just before one. The caption's fixed
             # text, "— not yet acknowledged.", was therefore actively FALSE
             # for every flag an admin had already acknowledged: the one
             # console screen built to show this audit trail was lying about
             # its own state, not merely omitting a nice-to-have field. `grep
             # -rn "\.ackAt\b" apps/web` (excluding tests) confirmed the only
             # hit anywhere was `isFlagRow`'s own runtime type guard. Fixed
             # with one conditional clause: `flag.ackAt` present renders
             # "— acknowledged at {ackAt}" (plus the existing auto-waived
             # clause, now attached to the true branch instead of always
             # appended) in place of the false sentence; `flag.ackAt === null`
             # renders the original, still-accurate "— not yet acknowledged."
             # verbatim — the pre-existing case is unchanged, not merely
             # coincidentally passing. RED confirmed directly: `git stash` of
             # `FlagsPanel.tsx` alone (3 new/strengthened assertions kept, 7
             # pre-existing cases untouched) — the pre-existing "not yet
             # acknowledged" case's own assertion was strengthened first
             # (passed vacuously, correctly, since that fixture's `ackAt` was
             # already null and the sentence was already true) and two new
             # cases (an acknowledged kill; an auto-waived one) both failed
             # genuinely on `expected '...not yet acknowledged.' to contain
             # '2026-08-21T09:00:00Z'` against the unmodified component;
             # restored byte-identically, 9/9 green (was 7, +2 net new).
             # `TZ=UTC make test`: 2707 passing (was 2705, +2; apps/web 1417,
             # was 1415; no other suite moved). `check-test-floor.mjs`: OK,
             # 2707 >= floor 1899 (+808 margin, unmoved, same discipline as
             # every prior entry). `TZ=UTC make build`: exit 0, 30 routes
             # (unchanged — edits inside the existing `/settings/flags`
             # component, no new route). `npm run gates` (via `prebuild`):
             # all green — boundaries 314 files (no new production file, one
             # existing file edited plus its one existing test file; fonts
             # degraded-but-non-blocking, pre-existing; corpus-morphology 362
             # words / corpus-glyphs 206 codepoints, both unchanged — no new
             # corpus data, only a caption over two already-shipped wire
             # fields). `npx tsc --noEmit` (apps/web): clean. No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff reverted before committing, same discipline
             # as every prior entry — `git status --porcelain -- v1 v2` empty
             # immediately before committing). No Arabic codepoint (both
             # changed files swept programmatically, in Python, over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks, plus a `fromCharCode`/
             # `fromCodePoint`/`\u06xx`/`\u08xx`/`\uFBxx`/`\uFExx` sweep —
             # zero matches; every new string is a fixed English caption or a
             # synthetic ISO-timestamp test fixture, never corpus text).
             # Session start: fresh container, no `node_modules`/`vendor`/
             # compiled corpus anywhere; `HEAD` was found detached at
             # `610f31d`, the same commit `origin/main` was already at, on a
             # stale LOCAL `main` branch ref six commits behind (`26cc664`,
             # v3-D201) — the recurring "stale local main" trap this file has
             # recorded roughly forty times since v3-D77 — caught before any
             # implementation work via `git fetch` + `git checkout main &&
             # git merge --ff-only origin/main`, no work lost or at risk.
             # `make setup` then `make compile-corpus` both run from scratch,
             # no retries needed. Found by a dedicated fresh-sweep agent
             # handed the full exclusion list carried through v3-D208 and
             # told not to re-report any of it; a first candidate the same
             # sweep surfaced — `computeStreak()`/`completedDayIndices()`
             # (`packages/engine/src/streak.ts`) never bridging the `/home`
             # streak pill over a `day_marked_away` event — was investigated
             # directly and deliberately NOT implemented this run: an
             # `awayDayIndex` is a PLAIN UTC calendar-day index
             # (`awayDays.ts#dayIndexOf`, `Math.floor(epochMs/86_400_000)`)
             # while `computeStreak`'s own walk operates in
             # `daybound.ts#learningDayIndex` space — tz-explicit, a
             # configurable rollover hour, DEFAULT_DAY_CONFIG's own
             # `rolloverHour: 4.5` — and these two integer day-index spaces
             # do not correspond 1:1 for a learner off UTC or off a
             # midnight rollover; a single UTC calendar day can straddle two
             # different learning-days. Bridging them correctly needs a real
             # day-space-conversion design (and a decision on whether the
             # streak should even honor away-marking at all, given FR9's own
             # separate "a miss pauses, never zeroes" model), not a one-line
             # render fix — exactly the kind of larger, judgment-carrying
             # change this build's own discipline defers rather than forces
             # into one night. Recorded here, not implemented, so a future
             # run does not have to re-derive the day-space mismatch from
             # scratch, and does not attempt it as a quick render-only fix
             # by mistake.
             # NOTE (v3-D208, 2026-09-13): `HomeSurahRow.floorOffer.count` —
             # FR9's floor-session item count, computed by `floorOfferFor()`
             # off the real `floorQueue()`/`floorMinutes()` since v3-D108 —
             # had exactly one production reader, `TodaySession.tsx`'s "Short
             # on time?" caption, and that reader rendered only the sibling
             # `minutes` field, never `count`. Unlike a constant field, this
             # one genuinely varies (1 or 2, per `floorQueue`'s own ≤2-minute
             # cap), so a learner had no way to tell "one quick tap" from
             # "two" before opening the floor session. Fixed with one caption
             # clause: "Do a quick N-minute check-in (M items) instead",
             # singular/plural per this codebase's own established
             # `${n} item${n === 1 ? "" : "s"}` convention. RED confirmed
             # twice: the pre-existing single-item fixture's assertion was
             # strengthened onto the same oracle already used for `minutes`
             # and failed genuinely; a NEW case (two different ayat each
             # carried through a real learn → gate-pass → 20-day-idle cycle,
             # landing in `floorQueue`'s "due review" branch rather than the
             # sibling test's warm-up fallback) guards that its own fixture
             # genuinely yields `count === 2` before asserting the rendered
             # text contains "2 items" and NOT "1 item" — so the fix cannot
             # pass by always printing either string. `TZ=UTC make test`:
             # 2705 passing (was 2704, +1 — exactly this run's one new
             # `it()`; apps/web 1415, was 1414; no other suite moved).
             # `check-test-floor.mjs`: OK, 2705 >= floor 1899 (+806 margin,
             # unmoved). `TZ=UTC make build`: exit 0, 30 routes (unchanged —
             # edits inside the existing `/home` component tree, no new
             # route). `npm run gates`: all green (boundaries 315 files, no
             # new production file — one existing file edited plus its one
             # existing test file; fonts degraded-but-non-blocking,
             # pre-existing; corpus-morphology/corpus-glyphs unchanged — no
             # new corpus data). `npx tsc --noEmit`: clean. No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff reverted before committing, same discipline
             # as every prior entry). No Arabic codepoint (both changed
             # files swept programmatically, in Python, over the Arabic,
             # Arabic Supplement, Arabic Extended-A and both Presentation
             # Forms Unicode blocks, plus a `fromCharCode`/`fromCodePoint`/
             # `\u06xx`/`\u08xx`/`\uFBxx`/`\uFExx` sweep — zero matches;
             # every new string is the fixed English word "item"/"items" or
             # a wire-derived integer, never corpus text). Session start:
             # fresh container, `HEAD` was found detached at `df0e6c5`, the
             # same commit `origin/main` was already at, on a stale LOCAL
             # `main` branch ref six commits behind (`26cc664`, v3-D201) —
             # the recurring "stale local main" trap this file has recorded
             # roughly forty times since v3-D77 — caught before any
             # implementation work via `git fetch` + `git checkout main &&
             # git merge --ff-only origin/main`, no work lost or at risk.
             # Found by a dedicated fresh-sweep agent handed the full
             # exclusion list through v3-D207 and directed away from the
             # exhausted `Corpus`/`CorpusMeta` type family toward
             # `apps/web/lib/home/queue.ts`'s own local types instead. NOT
             # addressed: every item on v3-D207's own "NOT addressed" list,
             # unchanged. See DECISIONS.md v3-D208.
             # NOTE (v3-D207, 2026-09-12): WIREFRAME §14 "Planned absences" —
             # `lib/plan/forecast.ts#buildForecast()` has accepted an
             # `awayDays: number[]` input since build-plan step 19, and
             # `PlanCalendar.tsx`'s own `AwayDay` component has rendered
             # "Away — no review expected" since the same commit, but
             # `PlanIsland.tsx` hardcoded `awayDays: []` with a comment
             # naming exactly why: "marking a day away is a WRITE, and the
             # write path (an event type, an outbox row) is M6's." v3-D190's
             # own fresh sweep found this and deliberately left it as "real,
             # larger scope, not a minimal wiring fix" — the identical item
             # then repeated unchanged across eighteen consecutive nightly
             # "NOT addressed" lists (v3-D190 through v3-D206), unlike this
             # build's usual one-field wiring fixes because it genuinely
             # needed a new event type, not just a new render. Picked up
             # this run as a self-contained feature, unlike this list's other
             # long-deferred items (`rhymeClassOf()` needs vendored rhyme
             # data; `TrialAttribution`/`PaywallGate` need a live Stripe
             # checkout flow that does not exist; the 7-night window needs a
             # live host). Built end to end: a new `day_marked_away`
             # `EventType` (not a field on an existing one) carrying
             # `awayDayIndex` (the ABSOLUTE calendar-day index,
             # `packages/engine/src/awayDays.ts#dayIndexOf(ms) =
             # Math.floor(ms / 86_400_000)` — the SAME plain arithmetic
             # `forecast.ts` already uses for its own day offsets,
             # deliberately not `daybound.ts`'s tz-explicit learning-day
             # boundary, to avoid mixing two definitions of "day" in one
             # feature) and `away` (the toggle — a later event for the same
             # day always wins, append-only, never edited in place).
             # Evidence-only by construction: `rebuild.ts` gets no new
             # branch at all, the same structural-absence discipline
             # invariant #5 already requires for `session_start`/`test_*` —
             # a dedicated test proves `rebuild([dayMarkedAwayEvent]).size
             # === 0`. The read side (`awayDayOffsets()`) mirrors
             # `heatmap.ts#testHistory`'s own "component never computes, it
             # only prints" split — a pure function over the raw log,
             # trusting log order for latest-wins, dropping any day already
             # in the past by `now`. The write side
             # (`apps/web/lib/plan/awayDay.ts#setDayAway`) commits through
             # the SAME commit-before-paint `append()` every other event
             # uses — no new storage mechanism, no new sync path; the pull
             # protocol's existing `NULLABLE_FIELDS` loop and B5's own "no
             # omit list at all" merge both carry the two new fields through
             # automatically once registered. Wired both ends: `PlanIsland.tsx`
             # now computes `awayDayOffsets(state.data, now)` instead of the
             # hardcoded `[]` and passes a new `onToggleAway` handler down,
             # with a `refreshNonce` state bumped after a successful toggle
             # and threaded into `useLogState`'s own `deps` (that hook holds
             # no live subscription, so without this a write would commit
             # but the screen would never reflect it); `PlanCalendar.tsx`
             # gains an optional `onToggleAway?` prop — omitted, it renders
             # exactly as before, no button, matching its own header's
             # promise ("this file decides nothing"); present, each future
             # day (offset >= 1 only — WIREFRAME's own wording is "any
             # FUTURE day", so TODAY never gets the control) gets a "Mark
             # this day away" / "I'm back — unmark this day" button, reusing
             # the existing locked `.btn`/`.btn--ghost` classes. Laravel
             # gained a real migration (`away_day_index`/`away` columns on
             # `events` — the first ALTER on that table since the v3-D10
             # freeze; every prior post-freeze field addition was
             # TypeScript-only) plus the matching `FIELD_MAP`/
             # `NULLABLE_FIELDS`/`$fillable`/cast entries.
             # `EventWireCodec.php` (the fold-runner/determinism-check path)
             # is deliberately untouched, matching `specSnapshot`'s own
             # precedent — the fold never reads either field, so there is
             # nothing for the fold-runner to gain from carrying them. RED
             # confirmed independently at every layer, each reverted and
             # restored byte-identically: engine (`test/awayDays.test.ts`,
             # 10 cases, failed on a missing module before the file existed,
             # 10/10 green after); `lib/plan/awayDay.test.ts` (4 cases,
             # fake-indexeddb, the real `append()` path, same shape); a new
             # `test/plan-calendar.test.tsx` describe block (5 cases — mark,
             # unmark, no control on TODAY, offered in the estimated zone
             # too, no button at all without a handler — 3 of 5 failed
             # genuinely against the unmodified component, the other 2
             # passing vacuously as expected since no button existed either
             # way, 25/25 green after); a new `test/plan-island.test.tsx`
             # (3 cases against the REAL `PlanIsland` component and a real
             # compiled surah-112 corpus, all 3 failed against the
             # hardcoded `awayDays: []` and missing prop, 3/3 green after);
             # one new case each in `EventsIngestionTest.php`/
             # `EventsPullTest.php` (both failed genuinely — an
             # `assertDatabaseHas` mismatch and an `Undefined array key
             # "awayDayIndex"` respectively — against the unmodified
             # migration/controller, 2/2 green after). `TZ=UTC make setup`
             # from a fresh container, no retries needed; `make
             # compile-corpus` run once before any test relying on the real
             # 112 corpus. `TZ=UTC make test`: 2704 passing (was 2680, +24 —
             # exactly this run's new tests: 10 engine + 4 + 3 + 5 apps/web
             # + 2 v3/api; apps/web 1414, was 1402; engine 430, was 420;
             # v3/api 377, was 375; no other suite moved). `check-test-
             # floor.mjs`: OK, 2704 >= floor 1899 (+805 margin, unmoved,
             # same discipline as every prior entry). `TZ=UTC make build`:
             # exit 0, 30 routes (unchanged — the toggle lives inside the
             # existing `/plan` component tree, no new route). `npm run
             # gates`: all green (boundaries 314 files, up from 311 —
             # exactly the three new non-test production files:
             # `packages/engine/src/awayDays.ts`, `apps/web/lib/plan
             # /awayDay.ts`, the migration; fonts degraded-but-non-blocking,
             # pre-existing; corpus-morphology/corpus-glyphs unchanged — no
             # new corpus data, this is a plain calendar toggle, never
             # corpus text). `npx tsc --noEmit`, run separately across all
             # four v3 node packages: clean in all four.
             # `packages/engine`'s own suite: 430/430 (was 420, +10).
             # `worker/fold-runner`'s own suite: 61/61, unchanged (it
             # imports `rebuild()` directly from `packages/engine`, so the
             # new no-op event type needed no fold-runner-side change).
             # `corpus-compiler`'s own suite: 120/120, unchanged
             # (unrelated). `php artisan test` (v3/api): 377 passing (was
             # 375, +2), 2 incomplete + 6 skipped unchanged. `./vendor/bin
             # /pint --test` on every changed PHP file: passed. No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff reverted before committing, same discipline
             # as every prior entry). No Arabic codepoint (every
             # new/changed file swept programmatically, in Python, over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks, plus a `\u06xx`/`\u08xx`/
             # `\uFBxx`/`\uFExx` escape and `fromCharCode`/`fromCodePoint`
             # sweep — zero matches; every new string is a wire field name,
             # a day-index integer, a plain English button label, or a
             # synthetic test fixture value, never corpus text). Session
             # start: fresh container, `HEAD` was found detached at
             # `c769f86`, the same commit `origin/main` was already at, on
             # a stale LOCAL `main` branch ref five commits behind
             # (`26cc664`, v3-D201) — the recurring "stale local main" trap
             # this file has recorded roughly forty times since v3-D77 —
             # caught before any implementation work via `git fetch` + `git
             # checkout main && git merge --ff-only origin/main`, no work
             # lost or at risk. NOT addressed: `lib/plan/forecast.ts`'s
             # `awayDays` is now CLOSED — remove it from future "NOT
             # addressed" lists. The "empty" log zero-state still shows no
             # calendar at all, so a learner who has not yet completed a
             # first session cannot pre-mark a future travel date away —
             # real, separate, smaller UX scope, deliberately left;
             # `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution`
             # (v3-D148); `lib/pricing.ts#regionFromCountry()` (v3-D163);
             # `PaywallGate` as a whole class / `permitsIssuance`/
             # `permitsReview` (v3-D88, v3-D151); multi-surah enrollment;
             # the operational mailer/7-night window; PAY-1's Stripe
             # fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); `MacroFacts.litany.rhymeLabel`
             # (v3-D188); `StripeField.editable` (v3-D204, a documentation
             # constant); `corpusHash`'s own zero fold-side consumer
             # (v3-D206) — all unchanged. See DECISIONS.md v3-D207.
             # NOTE (v3-D206, 2026-09-12): `DrillEvent.corpusHash` — step 10's
             # own frozen wire field, documented since the wire froze to "pin
             # provenance so a later corpus recompile can never retroactively
             # reinterpret a historical event under different content" — had
             # a fully-tested STORAGE half (`lib/idb/append.ts#append()`'s
             # `AppendContext.corpusHash`, `@engine/events.ts#makeEvent()`)
             # and no PRODUCER at all: `grep -rn "corpusHash"
             # apps/web/lib/session apps/web/components` returned nothing
             # before this fix. Two independent gaps hid each other. First,
             # `lib/session/run.ts` — the one module that actually commits a
             # real learner's events, the direct site of B2/B10/B11/B12 —
             # never read `Corpus["meta"].corpusHash` at any of its 8 event-
             # emission sites, because `Corpus["meta"]`
             # (`packages/engine/src/types.ts`) had never declared such a
             # field to read; every real `SessionIsland.tsx` call site built
             # its `ctx` as bare `{ now, tz }`. Second, even a `run.ts` that
             # read it faithfully would have read `undefined` for every real
             # corpus: `output/manifest.json`'s own
             # `ManifestEntry.corpusHash` (`corpus-compiler/src/manifest.ts
             # #corpusContentHash16`, already consumed by
             # `content-freeze.mjs`/`distractor-qa.mjs`'s own gates) was
             # never mirrored into the staged client payload by
             # `stage-corpus.mjs#slim()` — the one boundary where a compiled
             # corpus crosses into a browser. Consequence: every event a real
             # learner has ever committed carries no corpus-content pin at
             # all, silently defeating the one protection this field exists
             # to provide — material since this build recompiles routinely
             # (v3-D136, v3-D188..D205 each changed every launch surah's own
             # corpusHash). Fixed at both ends: `Corpus["meta"]` gains an
             # optional `corpusHash?: string`, documented as mirroring the
             # manifest's value, never self-computed client-side (that would
             # hash the wrong — slimmed — bytes); `stage-corpus.mjs` reads
             # `output/manifest.json` once and `slim()` spreads the surah's
             # own `corpusHash` into the staged `meta`; `SessionRun` gains an
             # optional `corpusHash`, resolved ONCE in `startFromQueue` (the
             # same "resolve a provenance fact once, carry it on the run"
             # shape `structured`/`openPracticeDrill` already establish,
             # proven directly by a mid-session-drift test) and stamped on
             # all 8 event sites — `session_start`, `reconstruct_tap`, both
             # `ayah_produced` branches, `gate_result`, `gate_demote`, and
             # the adoption pair. No public function signature changed
             # outside `run.ts` itself — every session entry point already
             # funnels through the shared `startFromQueue`, and every
             # event-emitting function already takes `run: SessionRun`.
             # RED confirmed directly: `git stash` of `run.ts` alone (the
             # new test file, the `types.ts` declaration and
             # `stage-corpus.mjs` kept — the type declaration is inert
             # without the implementation reading it) failed 4 of 5 new
             # cases exactly on `expected undefined to be
             # 'deadbeefcafef00d'` (the 5th, the never-fabricates-a-hash
             # degrade case, passed vacuously, correctly); restored
             # byte-identically, 73/73 green in the file (was 68, +5).
             # Verified end-to-end against the REAL compiled + staged
             # corpus, not only the synthetic test fixture — this build's
             # own repeated caution against vacuous verification applies
             # directly here: `make compile-corpus` produced
             # `output/manifest.json` with real per-surah hashes (`112:
             # 908ca9edbd2ab2e4`, `12: 6d04e4f9fd466905`, among others); a
             # rerun of `npm run stage-corpus` produced `public/corpus
             # /112.json` whose own `meta.corpusHash` was confirmed
             # byte-identical to the manifest's `112` entry by parsing the
             # staged JSON directly, not merely trusted from the script's
             # console output. `TZ=UTC make test` (fresh container, `make
             # setup` from scratch with no retries needed, `make
             # compile-corpus` run once before any implementation): 2680
             # passing (was 2675, +5 — exactly this run's new tests;
             # apps/web 1402, was 1397; no other suite moved).
             # `check-test-floor.mjs`: OK, 2680 >= floor 1899 (+781 margin,
             # unmoved). `TZ=UTC make build`: exit 0, 30 routes (unchanged —
             # no route touched). `npm run gates` (via `prebuild`, the
             # canonical invocation, boundaries run BEFORE `stage-corpus` in
             # that chain): all green — boundaries 311 files, unchanged
             # count (no new production file — `stage-corpus.mjs` lives
             # under `scripts/`, which the gate skips by name; fonts
             # degraded-but-non-blocking, pre-existing; corpus-morphology
             # 362 words / corpus-glyphs 206 codepoints, both unchanged — a
             # 16-hex string is never a new corpus codepoint. (A standalone,
             # LATER `npm run gates` invocation, run after `next build` had
             # already created the gitignored, untracked `next-env.d.ts` in
             # this fresh container, reported 312 — a pre-existing Next.js
             # bootstrap artifact confirmed via `git status --porcelain` to
             # be no part of this diff, not something this fix introduced.)
             # `npx tsc --noEmit`, run separately across all four v3 node
             # packages (widening a shared engine type can silently break a
             # sibling package's own typecheck without touching its
             # source): clean in all four. `packages/engine`'s own `npm
             # test`: 420/420, unchanged (the new field is optional and
             # additive, no engine test file touched).
             # `corpus-compiler`'s own `npm test`: 120/120, unchanged (only
             # its OUTPUT is read, by a script outside the package). No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff reverted before committing, same discipline
             # as every prior entry). No Arabic codepoint (all four changed
             # files swept programmatically, in Python, over the Arabic,
             # Arabic Supplement, Arabic Extended-A and both Presentation
             # Forms Unicode blocks, plus a `\u06xx`/`\u08xx`/`\uFBxx`/
             # `\uFExx` escape and `fromCharCode`/`fromCodePoint` sweep —
             # zero matches; every new string is a wire field name, a
             # synthetic 16-hex test placeholder, or a real 16-hex content
             # hash the compiler itself computed, never corpus text).
             # Session start: fresh container, `make setup` run from
             # scratch, no retries needed; local `main` and `origin/main`
             # both already agreed at `3d952a5` (v3-D205) — no
             # stale-local-main trap this session. Found by a field-by-field
             # pass over `DrillEvent`/`Corpus["meta"]`
             # (`packages/engine/src/types.ts`) against `lib/session
             # /run.ts`'s actual event-construction sites — the EVENT type
             # on the opposite side of the same pipe this build's many
             # `Corpus.meta`-field sweeps (v3-D191..D205) had not yet
             # checked against. A Laravel model-relation sweep
             # (`AccountDeletionRequest::user()`, `AdminAudit::actor()`, and
             # the rest of `app/Models/*.php`'s declared relations) was also
             # run this session and came back matching only already-known,
             # deliberately-left shapes (a raw FK query used instead of the
             # relation) — not pursued further. NOT addressed:
             # `corpusHash` still has ZERO fold-side consumer —
             # `packages/engine/src/selection.ts#replaySelection`'s own
             # docblock already names this as a deliberate, pre-existing
             # deferral ("once a corpus store exists — out of scope here"),
             # unwidened by this fix; `lib/test/build.ts`'s read-only
             # `test_*` events still build their own `ctx` without
             # `corpusHash` — deliberately out of scope, weaker need since
             # those events are never folded; every item on v3-D205's own
             # "NOT addressed" list, unchanged. See DECISIONS.md v3-D206.
             # NOTE (v3-D205, 2026-09-12): `RawAct.summary` — an act's own
             # authored narrative PARAGRAPH, vendored alongside `emotionalBeat`/
             # `sceneImage` since the mental model shipped, and the direct
             # sibling of the field v3-D201 fixed one entry earlier on the same
             # `buildSceneBeats()` function — was parsed into memory on every
             # compile and silently dropped: never copied into the compiled
             # `SceneBeat`, never declared on the engine's own `CorpusSceneBeat`
             # type, so `SceneBeatsPanel.tsx` (v3-D201's own new panel) could
             # not render it even though it already renders the sibling
             # `emotionalBeat` field. A reviewer checking whether a surah's
             # human-authored one-line scene-beat `label` genuinely captures
             # its act had the act's name and emotional register but not the
             # paragraph the label is meant to distill. Fixed: `SceneBeat`/
             # `CorpusSceneBeat` gain an optional `summary?: string`;
             # `buildSceneBeats()` copies `summary: a.summary` through;
             # `SceneBeatsPanel.tsx` renders it in a new conditional clause,
             # mirroring the existing `emotionalBeat` clause exactly, never
             # fabricated for the many older/frozen fixtures that predate the
             # field. RED confirmed independently at both layers, each
             # reverted and restored byte-identically: compiler level, the
             # existing emotionalBeat test in `buildCorpus.test.ts` (whose own
             # fixture already seeds two acts with DISTINCT summary strings,
             # unused until now) was strengthened with two new assertions —
             # failed exactly `expected undefined to be 'fixture summary
             # one'` against the unmodified `sceneBeats.ts`; 8/8 green after
             # (was 8, +0 net — a strengthened existing test). Component
             # level, two new cases in `workbench-ui.test.tsx` (mirroring
             # v3-D201's own two emotionalBeat cases exactly — a positive case
             # attaching a real, distinct summary to the frozen fixture's act
             # 1, which predates the field entirely; a negative case
             # confirming the frozen fixture genuinely carries none and the
             # panel never fabricates one) both failed against the unmodified
             # panel; 49/49 green after (was 47, +2). `TZ=UTC make test`: 2675
             # passing (was 2673, +2; apps/web 1397, was 1395; corpus-compiler
             # 120 unchanged — a strengthened test carries no separate count;
             # no other suite moved). `check-test-floor.mjs`: OK, 2675 >=
             # floor 1899 (+776 margin, unmoved). `TZ=UTC make build`: exit 0,
             # 30 routes (unchanged — edits inside the existing `/workbench`
             # component tree, no new route). `npm run gates`: all green
             # (boundaries 311 files, unchanged count — no new production
             # file, one existing component edited plus its test, plus three
             # existing type/logic files; fonts degraded-but-non-blocking,
             # pre-existing; corpus-morphology/corpus-glyphs unchanged — the
             # new field is fixed English editorial text vendored from an
             # already-committed raw data file, never a new corpus
             # codepoint). `npx tsc --noEmit`, run separately across
             # `apps/web`/`packages/engine`/`packages/corpus-compiler`: clean
             # in all three. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted before
             # committing, same discipline as every prior entry). No Arabic
             # codepoint (every changed file swept programmatically, in
             # Python, over the Arabic, Arabic Supplement, Arabic Extended-A
             # and both Presentation Forms Unicode blocks, plus a
             # `\u06xx`/`\u08xx`/`\uFBxx`/`\uFExx` escape and `fromCharCode`
             # sweep — zero matches; every new string is a wire field name or
             # a synthetic English test-fixture placeholder, never Quranic
             # Arabic). Session start: fresh container, `HEAD` was found
             # detached at `ed42ee1`, the same commit `origin/main` was
             # already at, on a stale LOCAL `main` branch ref three commits
             # behind (`26cc664`, v3-D201) — the recurring "stale local main"
             # trap this file has recorded roughly forty times since v3-D77 —
             # caught before any implementation work via `git fetch` + `git
             # checkout main && git merge --ff-only origin/main`, no work
             # lost or at risk; `make setup` then run from scratch, no
             # retries needed. Found by re-reading v3-D201's own fix against
             # `RawAct`'s full declared shape field by field, rather than
             # trusting that fixing one field on a struct closes every field
             # on it — `summary` was the one field `buildSceneBeats()` still
             # dropped after v3-D201; `name`/`ayahRange` were already carried
             # through and `sceneImage` is separately consumed by
             # `ayahToAct()` for `CorpusWord.sceneImage` (already wired, v3-D191).
             # NOT addressed: every item on v3-D204's own "NOT addressed"
             # list, unchanged. See DECISIONS.md v3-D205.
             # NOTE (v3-D204, 2026-09-12): `AtomCacheRebuilder::rebuildLocked()`'s
             # own dead-letter quarantine (edge case #130, closed at
             # v3-D114/v3-D115) computes a real per-learner `{userId, error}`
             # pair on every rebuild, but `SystemHealthController
             # ::rebuildAtomCache()` sent it straight to the wire — the ONE
             # admin surface that put a RAW, unpseudonymized learner id in a
             # response, where every sibling finding list
             # (`AdminBillingController`, `NightlyWindowController`, v3-D178)
             # runs a learner id through `Pseudonymizer` first — and the client
             # then collapsed the whole array to a bare `deadLetterCount`,
             # discarding `userId`/`error` entirely. An admin who saw "2
             # learner(s) skipped (unencodable data)" had no way to find out
             # WHICH learner or WHY, despite the server already knowing both.
             # Fixed: `SystemHealthController` now constructor-injects
             # `Pseudonymizer` and maps each dead letter to
             # `{subjectPseudonym, error}` before responding;
             # `lib/admin/health.ts`'s `RebuildOutcome` gains a matching
             # `deadLetters?: DeadLetterEntry[]` (malformed entries dropped,
             # never fabricated); `SystemHealthPanel.tsx` renders one line per
             # skipped learner beneath the existing summary sentence. RED
             # confirmed at all three layers: the existing
             # `test_a_poisoned_learner_is_dead_lettered...` PHPUnit case was
             # strengthened to assert `deadLetters.0` has no `userId` key and
             # its `subjectPseudonym` matches `Pseudonymizer::for()` —
             # failed exactly that assertion against the unmodified
             # controller, 9/9 green after (was 9, +0 net — a strengthened
             # existing case). Two new `health.test.ts` cases (full detail
             # parsed; a malformed entry dropped without corrupting the
             # count) both failed on `expected undefined to deeply equal
             # [...]` against the unmodified lib — 16/16 green after (was
             # 14, +2). One new `system-health-panel.test.tsx` case (two
             # entries with DIFFERENT pseudonyms/errors, both must render)
             # failed on `getByText` finding nothing — 10/10 green after
             # (was 9, +1). `TZ=UTC make test`: 2673 passing (was 2670, +3;
             # apps/web 1395, was 1392; v3/api 375 unchanged — a strengthened
             # test carries no separate count; no other suite moved).
             # `check-test-floor.mjs`: OK, 2673 >= floor 1899 (+774 margin,
             # unmoved). `TZ=UTC make build`: exit 0, 30 routes (unchanged —
             # edits inside the existing `/settings/health` component, no
             # new route). `npm run gates`: all green (boundaries 312 files;
             # fonts degraded-but-non-blocking, pre-existing;
             # corpus-morphology/corpus-glyphs unchanged). `npx tsc
             # --noEmit` (apps/web): clean. `./vendor/bin/pint --test` on
             # both changed PHP files: passed. No `v1/**`/`v2/**` edit (a
             # stray `v2/tsconfig.tsbuildinfo` build-cache diff reverted
             # before committing, same discipline as every prior entry). No
             # Arabic codepoint (all six changed files swept
             # programmatically, in Python, over the Arabic, Arabic
             # Supplement, Arabic Extended-A and both Presentation Forms
             # Unicode blocks, plus a `\u06xx`/`\u08xx`/`\uFBxx`/`\uFExx`
             # escape and `fromCharCode` sweep — zero matches; every new
             # string is a PHP identifier, a synthetic pseudonym/error test
             # fixture, or a fixed English caption, never corpus text).
             # Session start: fresh container, `TZ=UTC make setup` run from
             # scratch (from the repo root — this repo's Makefile lives at
             # `/home/user/kuizquran/Makefile`, not inside `v3/`) with no
             # retries needed; `HEAD` and local `main` both already matched
             # `origin/main` at `f66b0b6` (v3-D203) — no stale-local-main
             # trap this run. Found by a dedicated fresh sweep across
             # `apps/web/lib` (every subdirectory), `packages/engine/src`,
             # `packages/corpus-compiler/src`, `worker/fold-runner/src`,
             # `api/app/Http/Controllers`, `api/app/Console`, config files,
             # and roughly a dozen admin controller/panel pairs — most came
             # back clean or re-confirmed an already-excluded item; this was
             # the one genuine, previously-undocumented instance, verified
             # directly against both the PHP source and the TS parser
             # before writing any test. One candidate investigated and
             # deliberately left: `StripeField.editable` on
             # `/settings/stripe`'s wire response is always the literal
             # `false` for every field, never dynamically computed — a
             # documentation constant, not a genuinely computed value in
             # this bug class's sense. NOT addressed: every item on
             # v3-D203's own "NOT addressed" list, unchanged — see
             # DECISIONS.md v3-D204 for the full enumeration. See
             # DECISIONS.md v3-D204.
             # NOTE (v3-D203, 2026-09-11): a webhook's own refusal reason —
             # `App\Billing\EntitlementMachine::apply()`'s
             # `TransitionResult::ignoredStale($detail)`, real and dynamic for
             # the ordering-precedence guard (edge case #118: names the two
             # ACTUAL timestamps that raced) — was computed on every refused
             # transition and then discarded at `WebhookHandler::process()`'s
             # own string-collapsing return: `$result === null ? … :
             # ($result->wasApplied() ? 'applied' : $result->outcome)` kept
             # only the closed-set outcome, never `$result->detail`. `grep -rn
             # "->detail\b" api/app api/tests` returned nothing before this
             # fix — not in `WebhookHandler`, not in `AdminBillingController`
             # (reads the DERIVED `entitlement_transitions` log, which gains
             # no row when nothing transitioned), and not in
             # `BillingEventsPanel.tsx`, which already renders
             # `billing_events.error` verbatim under an honest "—" fallback —
             # that column was populated only by the exception-catch branch's
             # `$e->getMessage()`, never by this one. Unlike most instances of
             # this bug class, no new wire field or panel was needed — `error`
             # was already wired and rendered, simply never populated for the
             # `ignored_stale` branch. An operator on `/settings/billing`'s
             # Billing Events panel saw `outcome: ignored_stale` with no way
             # to tell whether the entitlement row had vanished mid-
             # transaction or which two timestamps actually lost the ordering
             # race, despite the machine having already computed exactly
             # that. Fixed: `process()` now returns `?TransitionResult`
             # instead of a collapsed string; `ingest()` derives the outcome
             # string exactly as before (byte-identical mapping) and
             # separately writes `'error' => $result?->detail` — null for
             # `applied`/`conflict`/`ignored_unhandled` exactly as before,
             # verified directly against the unmodified
             # `test_an_unhandled_event_type_still_journals_with_no_subject`
             # case, which stayed green untouched. `lib/admin/
             # billingEvents.ts`'s stale docblock ("Set only when outcome ===
             # 'error'") widened to name both populating branches; no
             # component edit needed. RED confirmed directly: `git stash` of
             # `WebhookHandler.php` alone (the strengthened
             # `test_out_of_order_event_is_ignored_never_last_write_wins`
             # kept, its two pre-existing assertions untouched) failed
             # exactly the new assertion — `expected null to be 'provider
             # event at 1700000000000 is older than the last applied at
             # 1700005000000'` — against the unmodified handler; restored
             # byte-identically, 85/85 green in that file (was 84 + 2 PAY-1
             # incomplete; a strengthened existing test, +0 net test count,
             # +1 assertion). The assertion names both real seeded timestamps
             # (1_700_005_000 and 1_700_000_000, ×1000 for the millisecond
             # column), so it cannot pass on a placeholder string. `php
             # artisan test --filter=Billing`: 84 passed + 2 incomplete
             # (unchanged), 246 assertions.
             # `php artisan test --filter=BillingEventsTest`: 9/9 green,
             # unchanged — including the unhandled-event case's own
             # `assertNull($entries[0]['error'])`, proving the fix did not
             # widen `error` beyond the one branch it targets. `TZ=UTC make
             # test` (full monorepo, all seven suites, from a fresh `make
             # setup` on a clean container — both composer installs
             # completed via the documented git-mirror fallback, no retry
             # needed): 2670 passing (unchanged from v3-D202's own count — no
             # new test file/case, a strengthened existing test carries no
             # separate count; every per-suite number unchanged).
             # `check-test-floor.mjs`: OK, 2670 >= floor 1899 (+771 margin,
             # unmoved). `TZ=UTC make build`: exit 0, 30 routes (unchanged —
             # backend-only fix, one frontend docblock-only edit). `npm run
             # gates`: all green (boundaries 311 files, unchanged count — no
             # new production file; fonts degraded-but-non-blocking,
             # pre-existing; corpus-morphology/corpus-glyphs unchanged). `npx
             # tsc --noEmit` (apps/web): clean — the one touched frontend
             # file is comment-only. `./vendor/bin/pint --test`:
             # `WebhookHandler.php` reports the identical five style-fixer
             # findings both BEFORE and AFTER this diff (verified directly by
             # stashing the change and re-running pint) — confirmed
             # pre-existing repo-wide drift shared by ~17 other untouched
             # files in the same run, not something this fix introduced;
             # left alone. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted before
             # committing, same discipline as every prior entry). No Arabic
             # codepoint (all three changed files swept programmatically, in
             # Python, over the Arabic, Arabic Supplement, Arabic Extended-A
             # and both Presentation Forms Unicode blocks, plus a `\u06xx`/
             # `\u08xx`/`\uFBxx`/`\uFExx` escape and `fromCharCode` sweep —
             # zero matches; every new/changed line is a PHP identifier, a
             # millisecond timestamp derived from a test fixture integer, a
             # wire field name, or a fixed English docblock sentence, never
             # corpus text). Session start: fresh container, no
             # `node_modules`/`vendor`/`.env` anywhere, `make setup` run from
             # scratch; `HEAD` was found detached at `433803d`, the same
             # commit `origin/main` was already at, on a stale LOCAL `main`
             # branch ref one commit behind (`26cc664`, v3-D201) — the
             # recurring "stale local main" trap this file has recorded
             # roughly forty times since v3-D77 — caught before any
             # implementation work via `git fetch` + `git checkout main &&
             # git merge --ff-only origin/main`, no work lost or at risk.
             # Found by a dedicated fresh-sweep agent handed the full
             # exclusion list through v3-D202 and told not to re-report any
             # of it; it also re-confirmed clean the `Corpus`/`CorpusMeta`/
             # `CorpusWord`/`CorpusDistractor`/`CorpusSceneBeat`/
             # `MacroFacts`/`LookAlike` type family (exhausted), nine
             # Eloquent relations in `api/app/Models` (already wired or
             # deliberate FKs), several admin controller/panel pairs
             # (`AdminBillingController`/`BillingAuditPanel`,
             # `AdminRevealController`/`PrivacyPanel`,
             # `PurgeLedgerController`/`PurgeLedgerPanel` — each renders
             # every field it sends), and directly re-checked
             # `corpus-compiler/src/manifest.ts`'s `ManifestEntry` (v3-D202's
             # own flagged weaker candidate) as genuinely build-tooling-only
             # with no natural admin/learner home — not pursued, matching
             # that entry's own warning. NOT addressed: every item on
             # v3-D202's own "NOT addressed" list, unchanged (see
             # DECISIONS.md v3-D203 for the full enumeration);
             # `TransitionResult::conflict()` carries no `$detail` at all
             # (the optimistic-lock-retry case has no per-event explanation
             # to compute) — considered and correctly left alone, not a
             # parallel gap. See DECISIONS.md v3-D203.
             # NOTE (v3-D202, 2026-09-11): a surah's own mental-model summary
             # (title / one-line narrative spine / memory hooks / pairing
             # strategy) — the SURAH-LEVEL half of `RawMentalModel`, vendored
             # in `data/raw/<surah>-mental-model.json` alongside `acts` since
             # M1 — was parsed into memory on every compile
             # (`corpus-compiler/src/io.ts`'s `readInputs`) and then silently
             # discarded: `buildCorpus.ts` read only `mentalModel.acts` (via
             # `ayahToAct`/`buildSceneBeats`), never `.title`/`.oneLineSpine`/
             # `.memoryHooks`/`.pairingStrategy`, and `meta` carried only a
             # boolean `hasMentalModel`, never the content itself. Unlike
             # v3-D201's sibling fix (the PER-ACT `emotionalBeat`, which at
             # least reached `buildSceneBeats()`'s input), these four fields
             # never left `buildCorpus()` at all — not merely unrendered, but
             # absent from the compiled artifact entirely. Verified against
             # real vendored data, not assumed: surah 12's own
             # `data/raw/12-mental-model.json` carries a real title, a
             # one-line spine and 9 memory hooks — authored content BUILD-
             # PLAN's own Q13/edge-case #22 name as a per-surah macro-panel
             # requirement — and none of it ever reached a reviewer. Verified
             # safe against the qari hash first: `manifest.ts
             # #buildAyahHashTable` reads only `sb.label` off `sceneBeats`
             # and never touches `meta` at all, so a new `meta.mentalModel`
             # field cannot touch the tiered verification hash (DEFECTS.md
             # #B3). Fixed, additive, diagnostic-only, no SCHEMA_VERSION bump
             # (same precedent as v3-D201's own optional field): `CorpusMeta`
             # gains `mentalModel?: MentalModelSummary`; `buildCorpus()`
             # copies the four fields through (never fabricated when no
             # mental model is authored — `meta.mentalModel` stays `undefined`
             # exactly when `hasMentalModel` is `false`); the engine's own
             # `Corpus["meta"]` gains the matching optional field; new
             # `MentalModelPanel.tsx` mirrors `DistractorYieldPanel.tsx`'s own
             # surah-level (not per-ayah), read-only, writes-nothing
             # discipline, wired into `WorkbenchIsland.tsx` beside it.
             # Deliberately admin-diagnostic only, not learner-facing or
             # wired into the learner's own `MacroPanel` — this content sits
             # in the identical "authored narrative interpretation of
             # scripture" category as a scene-beat `label`, and inventing a
             # new learner-facing surface for it is real, separate,
             # larger-scope product work, not a one-night wiring fix. RED
             # confirmed independently at both layers, each reverted and
             # restored byte-identically: compiler level, both new
             # `buildCorpus.test.ts` cases run against the tree before the
             # fix — the "no mentalModel" case's own `meta.mentalModel`
             # assertion passed vacuously (correctly: it never depended on
             # the fix), the positive case failed on `expected undefined to
             # deeply equal {...}` — 8/8 green after (was 7, +1 net: one
             # assertion added to an existing test, one new test); component
             # level, both new `workbench-ui.test.tsx` cases failed on
             # `findByRole("region", {name: /mental model/i})` timing out (no
             # such region existed) — 47/47 green after (was 45, +2). The
             # positive case attaches a real, distinct mental-model summary
             # to the frozen engine fixture (which predates the field
             # entirely, so it cannot pass on a hardcoded string); the
             # negative case confirms the frozen fixture genuinely carries no
             # `meta.mentalModel` (asserted directly, not assumed) and that
             # the panel says so honestly rather than rendering an empty
             # shell. A dedicated sweep agent first proposed a DIFFERENT
             # candidate this run — `packages/engine/src/streak.ts
             # #StreakState.makeupAvailable` — which was investigated and
             # REJECTED before any code was written: v3-D97's own "NOT
             # addressed" note already names `atRisk`/`pausedOnMiss`/
             # `makeupAvailable` as DELIBERATELY unsurfaced (WIREFRAME's own
             # "Social & motivation" §19/§20 section groups all three under
             # v3-D06's flag-gated, post-launch M11 social scope), and
             # surfacing `makeupAvailable` with any "keep your streak" framing
             # would trip the product's own explicit "no loss-framed pushes"
             # guardrail (`docs/WIREFRAME.md`'s six-guardrail list) — this was
             # a known, already-decided non-gap the sweep agent missed by not
             # searching far enough back in DECISIONS.md's own history, not a
             # fresh finding; caught by re-deriving from the repo per
             # NIGHTLY.md's own rule rather than trusting the agent's report.
             # `TZ=UTC make setup` run from scratch on a fresh container (no
             # `node_modules`/`vendor` anywhere) — clean, no retries needed.
             # `TZ=UTC make test`: 2670 passing (was 2667, +3: 1 corpus-
             # compiler + 2 apps/web; no other suite moved).
             # `check-test-floor.mjs`: OK, 2670 >= floor 1899 (+771 margin,
             # unmoved, same discipline as every prior entry). `TZ=UTC make
             # build`: exit 0, 30 routes (unchanged — edits inside the
             # existing `/workbench` component tree, no new route). `npm run
             # gates`: all green (boundaries 311 files, up from 310 — exactly
             # the one new apps/web production file; fonts degraded-but-
             # non-blocking, pre-existing; corpus-morphology 362 words /
             # corpus-glyphs 206 codepoints, both unchanged — the new field is
             # English editorial text, not a corpus codepoint). `npx tsc
             # --noEmit`, run separately across all four v3 node packages:
             # clean in all four. Verified end to end against the REAL
             # compiled corpus, not only fixtures: `packages/corpus-compiler/
             # output/12/corpus.json`'s own `meta.mentalModel` now carries
             # surah 12's real vendored title/spine/9 memory hooks/pairing
             # strategy; surah 67's own `output/67/corpus.json` correctly
             # shows `hasMentalModel: false, mentalModel: null` (no vendored
             # `67-mental-model.json` file exists, only draft scene-beat
             # labels) — no fabrication for a surah that genuinely has none.
             # No `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff reverted before committing, same discipline
             # as every prior entry). No Arabic codepoint (every new/changed
             # file swept programmatically, in Python, over the Arabic,
             # Arabic Supplement, Arabic Extended-A and both Presentation
             # Forms Unicode blocks, plus a `\u06xx`/`\u08xx`/`\uFBxx`/
             # `\uFExx` escape and `fromCharCode` sweep — zero matches; every
             # new string is a wire field name, a fixture coordinate, or the
             # compiler's own vendored English editorial text from a
             # committed raw data file, never generated, never Quranic
             # Arabic). Session start: fresh container, `git status` clean,
             # `HEAD` and local `main` both matched `origin/main` at
             # `26cc664` (v3-D201) — no stale-local-main trap this run. NOT
             # addressed: every item on v3-D201's own "NOT addressed" list,
             # unchanged; `StreakState.atRisk`/`.pausedOnMiss`/
             # `.makeupAvailable` remain deliberately unsurfaced (v3-D97,
             # M11 social scope, re-confirmed this run) — see DECISIONS.md
             # v3-D202.
             # NOTE (v3-D201, 2026-09-11): a scene beat's own emotional
             # register — `RawAct.emotionalBeat`, hand-authored and vendored
             # in `data/raw/12-mental-model.json` for all 19 of surah 12's
             # acts alongside `sceneImage`, distinct from the human-only
             # interpretive `label` — was parsed on every compile and
             # silently dropped: `sceneBeats.ts#buildSceneBeats()` never
             # copied it through, and the engine's own `CorpusSceneBeat`
             # type never declared it. More broadly `corpus.sceneBeats` as a
             # whole had zero production readers in apps/web (the only
             # reference outside tests was a comment in OnboardingFlow.tsx
             # explaining why placement.ts, FR10, cannot honestly use it for
             # a 4-ayah surah). Verified safe against the qari hash first:
             # `hash.ts#ayahQariHash` takes only `sceneBeatLabel: string |
             # null` as a scalar, and `manifest.ts#buildAyahHashTable`
             # extracts only `sb.label` — no new field can touch the hash.
             # Fixed, additive, diagnostic-only: `SceneBeat`/
             # `CorpusSceneBeat` gain optional `emotionalBeat?: string`;
             # `buildSceneBeats()` copies it through (undefined when
             # unauthored, never fabricated); new `SceneBeatsPanel.tsx`
             # mirrors `LookAlikesPanel.tsx`'s own per-ayah-filtered,
             # read-only precedent, wired into `WorkbenchIsland.tsx` —
             # rendering the open ayah's whole previously-unreachable act
             # (number, range, source name, label) plus the emotional
             # register when present. RED confirmed independently at both
             # layers, each reverted and restored byte-identically: compiler
             # level, the module's first-ever positive-path scene-beat test
             # failed on `expected undefined to be '...'`, 119/119 green
             # after (was 118, +1); component level, all 3 new cases failed
             # on `findByRole("region", ...)` timing out (no such region
             # existed), 45/45 green after (was 42, +3). The positive case
             # attaches a real emotional-register string to the frozen
             # fixture's own act 1 (which predates the field entirely, so it
             # cannot pass on a hardcoded string); the degrade case proves
             # the frozen fixture's genuinely-absent field never fabricates
             # an "emotional register" line. `TZ=UTC make test` (run twice,
             # after a fresh `make setup` from scratch — both `v2/api` and
             # `v3/api` composer installs needed one retry with
             # `COMPOSER_PROCESS_TIMEOUT=900` after the documented transient
             # proxy timeout cloning `laravel/framework` via git-mirror
             # fallback; the interrupted first `make setup` had also
             # silently skipped `corpus-compiler`'s own `npm install`,
             # caught and fixed; `typecheck-v3` then caught two genuine
             # `noUncheckedIndexedAccess` errors in the new tests' own raw
             # index reads, fixed with explicit `undefined`-narrowing, never
             # a non-null assertion, v3-D158's own discipline): 2667 passing
             # (was 2663, +4; corpus-compiler 119, was 118; apps/web 1390,
             # was 1387; no other suite moved). `check-test-floor.mjs`: OK,
             # 2667 >= floor 1899 (+768 margin, unmoved). `TZ=UTC make
             # build`: exit 0, 30 routes (unchanged — edits inside the
             # existing `/workbench` component tree, no new route;
             # corpus-morphology/corpus-glyphs both unchanged, 206
             # codepoints — `emotionalBeat` is fixed English vendored text,
             # never a new corpus codepoint). `npm run gates`: all green
             # (boundaries 310 files, up from 309 — exactly the one new
             # apps/web production file; fonts degraded-but-non-blocking,
             # pre-existing). `npx tsc --noEmit`, run separately across all
             # four v3 node packages: clean in all four. No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff reverted before committing, same discipline
             # as every prior entry). No Arabic codepoint (every new/changed
             # file plus the full diff swept programmatically, in Python,
             # over the Arabic, Arabic Supplement, Arabic Extended-A and
             # both Presentation Forms Unicode blocks, plus a `\u06xx`/
             # `\u08xx`/`\uFBxx`/`\uFExx` escape and `fromCharCode` sweep —
             # zero matches; every new string is a fixture coordinate
             # integer, a wire field name, or the compiler's own vendored
             # English editorial text from a committed raw data file, never
             # generated, never Quranic Arabic). Session start: `HEAD` was
             # found detached at `585b531`, the same commit `origin/main`
             # was already at, on a stale LOCAL `main` branch ref 27 commits
             # behind (`4be9924`, v3-D174) — the recurring "stale local
             # main" trap v3-D77/D91/D127/D138/D159/D167/D170/D172/D174–D200
             # each independently hit, caught before any implementation
             # work via `git fetch` + `git checkout main && git merge
             # --ff-only origin/main`, no work lost or at risk. NOT
             # addressed: every item on v3-D200's own "NOT addressed" list,
             # unchanged — see DECISIONS.md v3-D201. See DECISIONS.md
             # v3-D201.
             # NOTE (v3-D200, 2026-09-11): the seam-side sibling of v3-D199's
             # own fix, named and deliberately left by that entry's own
             # closing note. `lib/drill/preview.ts#buildDrillPreview()`
             # already computed each skipped seam's own FROM ayah
             # (`site.ayah`, `skipReason: "seam-not-reached"`) alongside the
             # ayah data v3-D199 wired up, but `DrillPreview` exposed only
             # the AGGREGATE `skippedSeamCount` and `DrillPicker.tsx`'s
             # `DrillSummary` rendered only the combined `partialNotice`
             # sentence — a learner watching the joint count drop had no way
             # to tell WHICH joint was unreached. Fixed, additive, no
             # engine/wire change: `DrillPreview` gains
             # `skippedSeamFromAyahs: number[]` (ascending, the FROM ayah of
             # each seam whose connection atom does not exist yet — a seam
             # has no ayah number of its own, this file's own established
             # reasoning); `DrillSummary` gains one new paragraph, present
             # only when non-empty: `Not yet reached: joint after ayah 5.`
             # singular, `Not yet reached: joints after ayat 2, 3, 5.`
             # plural — mirroring v3-D199's own singular/plural convention on
             # the sibling ayah field. RED confirmed independently at both
             # layers, each reverted via `git stash` and restored
             # byte-identically: library level, both new cases failed on
             # `expected undefined to deeply equal [...]`, 20/20 green after
             # (was 18, +2); component level, 2 of 3 new cases failed on
             # `getByText` finding nothing (the negative "says nothing when
             # every joint is reached" case passed vacuously, correctly — it
             # never depended on the fix), 17/17 green after (was 14, +3).
             # The load-bearing component case borns the seams after ayah 1
             # and ayah 4 of the default 1..6 range (out of ascending order,
             # so a pass cannot be reading insertion order) and asserts the
             # exact string `"Not yet reached: joints after ayat 2, 3, 5."`,
             # which cannot pass on a hardcoded placeholder or a bare count.
             # `TZ=UTC make test`: 2663 passing (was 2658, +5; apps/web 1387,
             # was 1382; no other suite moved). `check-test-floor.mjs`: OK,
             # 2663 >= floor 1899 (+764 margin, unmoved). `TZ=UTC make
             # build`: exit 0, 30 routes (unchanged — edits inside the
             # existing `/drill` component tree, no new route). `npm run
             # gates`: all green (boundaries 310 files, unchanged count — no
             # new production file; fonts degraded-but-non-blocking,
             # pre-existing; corpus-morphology 362 words / corpus-glyphs 206
             # codepoints, both unchanged). `npx tsc --noEmit`: clean,
             # `Version 5.9.3` confirmed. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted before
             # committing, same discipline as every prior entry). No Arabic
             # codepoint (all four changed files swept programmatically, in
             # Python, over the Arabic, Arabic Supplement, Arabic
             # Extended-A and both Presentation Forms Unicode blocks, plus a
             # `\u06xx`-escape and `fromCharCode` sweep — zero matches;
             # every new string is a fixed English sentence built from a
             # fixture ayah integer, never corpus text). Session start:
             # fresh container, `make setup` run from scratch; `HEAD` was
             # found detached at `1a36245`, the same commit `origin/main`
             # was already at, on a stale LOCAL `main` branch ref 13 commits
             # behind (`4be9924`, v3-D174) — the recurring "stale local
             # main" trap v3-D77/D91/D127/D138/D159/D167/D170/D172/D174–D199
             # each independently hit, caught before any implementation
             # work via `git fetch` + `git checkout main && git merge
             # --ff-only origin/main`, no work lost or at risk. NOT
             # addressed: every item on v3-D199's own "NOT addressed" list,
             # unchanged — see DECISIONS.md v3-D200 for the full
             # enumeration. See DECISIONS.md v3-D200.
             # NOTE (v3-D199, 2026-09-10): `lib/drill/preview.ts`'s own
             # `buildDrillPreview()` computed a `PreviewSite` per site since
             # the picker shipped (build-plan step 20), each carrying its own
             # `site.ayah`/`skipReason` — but `DrillPreview` exposed only the
             # AGGREGATE `skippedAyahCount`, and `DrillPicker.tsx`'s
             # `DrillSummary` rendered only `preview.partialNotice` ("7 of 10
             # ayat here are ready. The other 3 haven't been learned yet.").
             # `grep -rn "\.skipReason\b|drilledSites" apps/web` outside
             # tests returned only `preview.ts`'s own definition/computation
             # — zero production readers. A learner saw a count drop with no
             # way to tell WHICH ayat to go learn first, despite the module
             # already knowing exactly which ones. Found by a dedicated
             # fresh-sweep agent directed at `lib/plan`/`lib/library`/
             # `lib/home`/`lib/drill` and their components — corners the
             # last two sweeps (v3-D196/D197) had not named. Fixed,
             # additive, no engine/wire change: `DrillPreview` gains
             # `skippedAyahNumbers: number[]` (ascending, ayah-kind only,
             # `not-learned` reason — never a seam, which has no single ayah
             # number of its own); `DrillSummary` gains one new paragraph,
             # present only when non-empty: `Not yet ready: ayah 6.`
             # singular, `Not yet ready: ayat 2, 4, 5, 6.` plural — the same
             # singular/plural convention `SessionIsland.tsx`'s `ayatRefs`
             # rendering already established (v3-D190), on a different
             # field, different screen. RED confirmed independently at both
             # layers, each reverted via `git stash` and restored
             # byte-identically: library level, both new/strengthened cases
             # failed on `expected undefined to equal [...]`, 18/18 green
             # after (was 16, +2); component level, 2 of 3 new cases failed
             # on `getByText` finding nothing (the negative "says nothing
             # when everything is ready" case passed vacuously, correctly —
             # it never depended on the fix), 14/14 green after (was 11,
             # +3). The load-bearing component case encodes ayat 1 and 3 of
             # the default 1..6 range and asserts the exact string `"Not yet
             # ready: ayat 2, 4, 5, 6."`, which cannot pass on a hardcoded
             # placeholder or a bare count. `TZ=UTC make test`: 2658 passing
             # (was 2654, +4; apps/web 1382, was 1378; no other suite
             # moved). `check-test-floor.mjs`: OK, 2658 >= floor 1899 (+759
             # margin, unmoved). `TZ=UTC make build`: exit 0, 30 routes
             # (unchanged — edits inside the existing `/drill` component
             # tree, no new route). `npm run gates`: all green (boundaries
             # 310 files, unchanged count — no new production file; fonts
             # degraded-but-non-blocking, pre-existing; corpus-morphology
             # 362 words / corpus-glyphs 206 codepoints, both unchanged).
             # `npx tsc --noEmit`, run separately across all four v3 node
             # packages: clean in all four. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted twice
             # before committing, same discipline as every prior entry). No
             # Arabic codepoint (all four changed files swept
             # programmatically, in Python, over the Arabic, Arabic
             # Supplement, Arabic Extended-A and both Presentation Forms
             # Unicode blocks, plus a `\u06xx`-escape and `fromCharCode`
             # sweep — zero matches; every new string is a fixed English
             # sentence built from a fixture ayah integer, never corpus
             # text). NOT addressed: the skipped-SEAM sibling of this fix
             # (`skippedSeamCount` has the identical aggregate-only shape —
             # a learner is never told WHICH joint is unreached) was
             # considered and deliberately left for a future run rather
             # than widening this one past a single field; every item on
             # v3-D198's own "NOT addressed" list, unchanged. See
             # DECISIONS.md v3-D199.
             # NOTE (v3-D198, 2026-09-10): the late-arrival refold — v3-D32's
             # other deferred half, and the one item on v3-D196/D197's own
             # repeated "NOT addressed" list that was neither human/calendar-
             # gated nor a fraught product decision. `atom_cache` had exactly
             # one writer anywhere: the admin's manual "rebuild atom cache"
             # button. `EventsController::store()` — the real sync-cycle
             # ingestion path — wrote to `events` and never touched
             # `atom_cache` at all, so a real learner's cache went stale the
             # instant they synced a new event and stayed stale until a human
             # clicked rebuild. This silently defeated
             # `DeterminismCheckCommand`'s DB-sampling path (it byte-compares
             # a fresh fold against `atom_cache` — a cache nothing kept
             # current would eventually read every active learner as a
             # confirmed P1, the exact false-alarm/deafness risk BUILD-PLAN's
             # own top-risk #6 names) and left `/progress`/`/home`/the
             # workbench frontier one admin click behind reality. Fixed by
             # exposing existing, already-tested machinery rather than a new
             # code path: `AtomCacheRebuilder::rebuild()` is now a thin
             # wrapper over a new public `rebuildUsers()`/`rebuildOne()`, and
             # `EventsController::store()` calls `rebuildOne($userId)` after
             # any batch that writes new rows — synchronously, matching
             # v3-D81/v3-D85's own established "no queue worker on this
             # deployment" reasoning, not a new architectural choice — wrapped
             # in try/catch so a refold failure (events is truth, atom_cache
             # is a derived cache) never rejects or rolls back an
             # already-accepted event, only logs. RED confirmed directly:
             # `git stash` of the two production files (the new 4-case test
             # file kept) failed 3 of 4 exactly as predicted (the positive
             # case, the second-batch-advances case, the failure-durability
             # case; the idempotent-replay case passed vacuously, correctly —
             # it never depended on the fix); restored byte-identically, 4/4
             # green. The load-bearing case drives a real `rung_complete`
             # event through the real engine (the fold-runner subprocess,
             # v3-D08) and asserts `reps=1`/`strength>0` on the resulting row,
             # not merely that some row exists; a second case posts a SECOND
             # graded event and asserts `reps` moves 1→2, proving each ingest
             # re-runs the whole-log fold rather than caching the first
             # request's result forever. `php artisan test` (v3/api, after
             # `make compile-corpus`): 375 passing (was 371, +4; 2 incomplete
             # by design/PAY-1 and 6 skipped, both unchanged) — every
             # pre-existing test that posts to `/api/events`
             # (`EventsIngestionTest`, `EventsPullTest`,
             # `TokenRevocationTest`, `PaywallBoundaryTest`) still passes
             # unchanged. `TZ=UTC make test`: 2654 passing (was 2650, +4; no
             # other suite moved). `check-test-floor.mjs`: OK, 2654 >= floor
             # 1899 (+755 margin, unmoved). `TZ=UTC make build`: exit 0, 30
             # routes (unchanged — backend-only fix, no apps/web file
             # touched). `npm run gates`: all green (boundaries 310 files,
             # unchanged count; fonts degraded-but-non-blocking,
             # pre-existing; corpus-morphology/corpus-glyphs unchanged).
             # `./vendor/bin/pint --test`: passed. No `v1/**`/`v2/**` edit (a
             # stray `v2/tsconfig.tsbuildinfo` build-cache diff reverted
             # before committing, same discipline as every prior entry). No
             # Arabic codepoint (both changed PHP files plus the new test
             # file swept programmatically, in Python, over the Arabic,
             # Arabic Supplement, Arabic Extended-A and both Presentation
             # Forms Unicode blocks — zero matches; every new string is a PHP
             # identifier, a fixture coordinate integer, or a fixed English
             # log message, never corpus text). NOT addressed: this fix makes
             # `atom_cache` worth comparing against but does not itself stand
             # up a staging host or feed it real traffic (C5/gate 20,
             # unchanged); a per-request refold failure is only logged, with
             # no dedicated operator-facing alert (the existing admin health
             # panel remains the human fallback); every item on v3-D197's own
             # "NOT addressed" list, unchanged. See DECISIONS.md v3-D198.
             # NOTE (v3-D197, 2026-09-10): second consecutive empty sweep — after
             # v3-D196, a fresh pass over `lib/session/run.ts` (28 exports),
             # `components/quiz/*`/`macro/*`/`progress/*`/`onboarding/*`
             # (prop-by-prop), migrations, admin controller/caller pairs, and
             # console scheduling found no new zero-caller gap; every candidate
             # traced to a real caller or an already-excluded reason
             # (`OnboardingChoices.placement` → the `placement.ts` gap;
             # `FlagService::enabled()` → real zero-caller, but every registered
             # flag gates a feature that doesn't exist yet, same shape as
             # `PaywallGate`). A direct regression check (full apps/web vitest +
             # v3/api PHPUnit) matched the counts already on record — no drift in
             # any DEFECTS.md closure claim. Documentation-only; test/build
             # numbers unchanged. This bug class is now genuinely exhausted
             # across most of the codebase; a future run should not expect
             # another one-night find without a genuinely fresh corner or a
             # willingness to take on a larger architectural item. See
             # DECISIONS.md v3-D197.
             # NOTE (v3-D196, 2026-09-10): the "computed/shipped, zero reader" and
             # "stale-justification stub" sweep came back empty this run — the
             # widest single-run pass this bug class has had since v3-D95's own
             # original empty sweep (every controller, every model relation,
             # every engine/fold-runner export, every apps/web/lib export
             # function-by-function). Documentation-only; test/build numbers
             # unchanged (this run's sweep was dispatched, and reported empty,
             # before v3-D195's own StripeField.setVia fix landed concurrently
             # from a different session — renumbered from a collision at
             # v3-D195 to v3-D196 on rebase). One candidate investigated and
             # deliberately left: `components/home/DeviceReset.tsx`'s
             # permanently-disabled "Clear this device" button superficially
             # resembles v3-D194's shape (its stated blocking dependency,
             # account adoption, landed a dozen+ nights ago) but is NOT the
             # same — no clear-then-restore-from-server mechanism exists
             # anywhere in this codebase to wire up, and building one
             # carelessly would itself be a data-loss defect, not a fix. Left
             # alone deliberately, the same category of judgment call already
             # made for `EntitlementMachine::merge()` and multi-surah
             # enrollment. See DECISIONS.md v3-D196.
             # NOTE (v3-D195, 2026-09-10): `StripeField.setVia` — computed per
             # credential by `StripeSettingsController::index()`
             # (`$env.' in the API environment'`, distinct per field) and
             # declared as a required member of the panel's own `StripeField`
             # interface since the probe shipped — was never read anywhere in
             # the render; only `f.label`/`f.purpose`/`f.env`/`f.present`/
             # `f.validPrefix`/`f.fingerprint` were. Same "fetched, typed,
             # required, zero read surface" shape this build has closed
             # repeatedly elsewhere. Fixed with one new caption line per row,
             # `Set via {f.setVia}.`, beneath the existing `<code>{f.env}</code>`
             # line. RED confirmed directly: `git stash` of the one production
             # file (the new test kept, 4 pre-existing cases untouched) failed
             # exactly the new case; restored byte-identically, 5/5 green. The
             # test seeds two rows with two DIFFERENT setVia strings, so it
             # cannot pass on one hardcoded caption. `TZ=UTC make test`: 2650
             # passing (was 2649, +1; apps/web 1378, was 1377). `check-test-
             # floor.mjs`: OK, 2650 >= floor 1899 (+751 margin, unmoved).
             # `TZ=UTC make build`: exit 0, 30 routes (unchanged). `npm run
             # gates`: all green (boundaries 310 files, unchanged count — one
             # existing production file edited plus its one existing test
             # file). `npx tsc --noEmit`, run separately across all four v3
             # node packages: clean in all four. No `v1/**`/`v2/**` edit. No
             # Arabic codepoint (both changed files swept programmatically
             # over every Arabic block plus both Presentation Forms blocks —
             # zero matches; every new string is an env-var name or a fixed
             # English caption, never corpus text). Found by a dedicated
             # fresh-sweep agent handed the full exclusion list carried
             # through v3-D192, running concurrently with two other sessions
             # that landed v3-D193 (`CorpusMeta.droppedCollisions`) and
             # v3-D194 (`AuthController` `hasHistory`) — all three picked
             # disjoint candidates in disjoint files and rebased cleanly onto
             # each other in sequence. Its stronger secondary candidate,
             # `ProbeResult.reason` on the same panel, was left deliberately —
             # `probe.message` already covers the human-readable case for
             # every branch. See DECISIONS.md v3-D195.
             # NOTE (v3-D194, 2026-09-10): `AuthController::login()`/`me()` both
             # hardcoded `'hasHistory' => false` unconditionally, on a comment
             # blaming the events table not existing yet — a reason that expired
             # dozens of nights ago (events landed at build-plan step 14). Unlike
             # this build's usual "computed and shipped, never read" shape, the
             # SERVER itself never computed a real value at all —
             # `AccountIdentity` (the type `AccountAuthPanel.tsx` actually
             # renders from) never even parsed `hasHistory`. Matters exactly at
             # the moment `login()`'s own docblock warns about: switching this
             # device to a different account "replaces what this device shows,
             # it does not merge it" — a learner had no way to know beforehand
             # whether that account held any history at all. Fixed: both
             # endpoints now compute `$user->events()->exists()`, a real
             # per-account read of the already-declared `events()` relation;
             # `AccountIdentity` gains a required `hasHistory: boolean`
             # (degrade-to-false on anything but a literal `true`, same
             # discipline as `emailVerified`); `AccountAuthPanel.tsx` renders
             # "This account has existing history from a previous session." only
             # when true. RED confirmed at both layers independently, each
             # reverted and restored byte-identically: backend — 2 of 4 new
             # PHPUnit cases failed genuinely (the two `false` cases pass
             # vacuously against the stub, as expected — not the load-bearing
             # half); restored, 12/12 green (was 8). Frontend — 5 of 32 failed
             # (missing key, degrade case, both component cases); restored,
             # 32/32 green (was 28). `TZ=UTC make test`: 2649 passing (was 2641,
             # +8: 4 PHPUnit + 2 + 2 vitest; v3/api 371, was 367; apps/web 1377,
             # was 1373). `check-test-floor.mjs`: OK, 2649 >= floor 1899 (+750
             # margin, unmoved). `TZ=UTC make build`: exit 0, 30 routes
             # (unchanged). `npm run gates`: all green (boundaries 310 files,
             # unchanged count — no new production file, three existing files
             # edited). `npx tsc --noEmit`: clean. No `v1/**`/`v2/**` edit (stray
             # `v2/tsconfig.tsbuildinfo` reverted before committing). No Arabic
             # codepoint (full diff swept programmatically over every Arabic
             # block plus both Presentation Forms blocks — zero matches; every
             # new string is a wire field name, a fixed English sentence, or a
             # synthetic test placeholder, never corpus text). Found by a
             # dedicated fresh-sweep agent told the entire `Corpus`/
             # `CorpusMeta`/`CorpusWord`/`CorpusDistractor` type family was now
             # exhausted (five prior runs) and directed instead at Laravel model
             # relations/fields and several `apps/web/lib` subdirectories.
             # Several real candidates checked and rejected as false positives
             # or already-excluded: `lib/library/rows.ts`'s `STATUS_*`
             # constants (feed a rendered `status` field); `lib/admin
             # /contentFreeze.ts`'s `allMet` (deliberately redundant with the
             # server's own `bookable` field); `lib/workbench/explain.ts`'s
             # `optionCount`/`rejectedBy` (feed a rendered `note` string); the
             # engine's `CorpusVerse.line` (declared but never populated by the
             # compiler at all — a dead field, a different shape from the
             # target bug class); `CorpusWord.act`/`.sceneImage` (consumed only
             # by the already-deferred `placement.ts`). See DECISIONS.md
             # v3-D194.
             # NOTE (v3-D193, 2026-09-10): `CorpusMeta.droppedCollisions` — the
             # compiler's own audit trail of authored distractor rows dropped at
             # compile because they collided with their own target under the
             # engine's grading equivalence (NFC + tatweel strip, DEFECTS.md#B6),
             # required and shipped verbatim since build-plan step 3 — was never
             # declared on the engine's own `Corpus["meta"]` type, so nothing
             # could read it. Same "shipped, never declared" shape as
             # `Corpus.lookalikes` (v3-D181), `CorpusWord.line` (v3-D191) and
             # `CorpusMeta.distractorOrigin`/`.kernelYield` (v3-D192) — this is
             # the exact sibling field v3-D192's own closing note named and left.
             # A word named here shipped with FEWER distractors than authored, a
             # fact `DistractorYieldPanel`'s histogram cannot distinguish from a
             # word nobody authored more foils for. Verified against real data:
             # surah 12's admin corpus carries 8 dropped coordinates; the frozen
             # engine fixture independently carries 5, including `{ayah:4,
             # position:1}` — a genuine pre-existing fixture fact. Fixed: `Corpus
             # ["meta"]` gains optional `droppedCollisions?: LookAlikeWordRef[]`
             # (reusing the existing coordinate type); new
             # `DroppedCollisionsPanel.tsx` mirrors `LookAlikesPanel.tsx`'s
             # per-ayah-filtered, read-only discipline, wired into
             # `WorkbenchIsland.tsx` beside it. RED confirmed directly:
             # reverting the two production files (new panel moved aside, its 2
             # new tests kept, 40 pre-existing untouched) failed both on the
             # panel's region never rendering; restored, 42/42 green. `TZ=UTC
             # make test`: 2641 passing (was 2639, +2; apps/web 1373, was 1371).
             # `check-test-floor.mjs`: OK, 2641 >= floor 1899 (+742 margin,
             # unmoved). `TZ=UTC make build`: exit 0, 30 routes (unchanged).
             # `npm run gates`: all green (boundaries 310 files, up from 309 —
             # exactly the one new production file). `npx tsc --noEmit`, run
             # separately across all four v3 node packages: clean in all four.
             # No `v1/**`/`v2/**` edit (stray `v2/tsconfig.tsbuildinfo` reverted
             # before committing). No Arabic codepoint (every new/changed file
             # swept programmatically over every Arabic block plus both
             # Presentation Forms blocks — zero matches; every new string is a
             # fixture coordinate integer or a fixed English caption, never
             # corpus text). Found by a dedicated fresh-sweep agent directed at
             # the exact lead v3-D192 named and left. The agent also correctly
             # rejected the other four sibling fields v3-D192 flagged
             # (`hasMentalModel`/`hasGeometry`/`distractorsAuthored`/
             # `schemaVersion`) as deliberate non-gaps, not merely deferred —
             # each is either directly derivable from already-rendered data or
             # (for `schemaVersion`) carries no reviewer-actionable content — so
             # a future run should not re-open any of the four. See
             # DECISIONS.md v3-D193.
             # NOTE (v3-D192, 2026-09-10): `CorpusMeta.distractorOrigin`/
             # `.kernelYield` — the compiler's own authored-vs-kernel row split
             # and its per-word foil-yield histogram, required fields computed on
             # every compile since build-plan step 3 and shipped to the browser
             # verbatim (`stage-corpus.mjs#slim()` passes `meta` through
             # wholesale) — were never declared on the engine's own `Corpus`
             # type, so nothing could read either even by accident. Same
             # "shipped, never declared on the consuming type" shape as
             # `Corpus.lookalikes` (v3-D181), `CorpusDistractor.origin`
             # (v3-D187) and `CorpusWord.line` (v3-D191), here on two sibling
             # `CorpusMeta` fields none of those runs touched. Verified against
             # the real compiled corpora: surah 12 reports `{authored:8877,
             # kernel:0}`; surah 67 reports `{authored:0, kernel:1665}` —
             # genuinely different data, not a constant. Fixed: `Corpus["meta"]`
             # gains optional `distractorOrigin`/`kernelYield`; new
             # `DistractorYieldPanel.tsx` (mirrors `LookAlikesPanel.tsx`/
             # `MacroClassificationPanel.tsx`'s read-only discipline) renders
             # both on `/workbench`, wired into `WorkbenchIsland.tsx`. RED
             # confirmed directly: reverting the two production files (new
             # panel moved aside, its 3 new tests kept, 37 pre-existing
             # untouched) failed all 3 on the panel's region never rendering;
             # restored, 40/40 green. `TZ=UTC make test`: 2639 passing (was
             # 2636, +3; apps/web 1371, was 1368). `check-test-floor.mjs`: OK,
             # 2639 >= floor 1899 (+740 margin, unmoved). `TZ=UTC make build`:
             # exit 0, 30 routes (unchanged). `npm run gates`: all green
             # (boundaries 309 files, up from 308 — exactly the one new
             # production file). `npx tsc --noEmit`, run separately across all
             # four v3 node packages: clean in all four. No `v1/**`/`v2/**` edit
             # (stray `v2/tsconfig.tsbuildinfo` reverted before committing). No
             # Arabic codepoint (every new/changed file swept programmatically
             # over every Arabic block plus both Presentation Forms blocks —
             # zero matches; every new string is a wire field name, an integer,
             # or a fixed English label, never corpus text). Found by a
             # dedicated fresh-sweep agent handed the full exclusion list
             # through v3-D191, directed at `packages/engine/src/types.ts`'s
             # own wire fields with zero renders — specifically `Corpus.meta`'s
             # own sibling fields, never checked field-by-field before. NOT
             # addressed, named so a future run doesn't re-discover them as new:
             # `CorpusMeta.droppedCollisions`/`.hasMentalModel`/`.hasGeometry`/
             # `.distractorsAuthored`/`.schemaVersion` share the identical
             # shipped-but-undeclared shape — real, same class, deliberately
             # left to avoid over-scoping a single night's fix past two closely
             # related fields. See DECISIONS.md v3-D192.
             # NOTE (v3-D191, 2026-09-10): `CorpusWord.line` — a real, non-null
             # mushaf line number computed for every word of all four launch
             # surahs since the compiler's geometry merge (M1), shipped to the
             # browser verbatim (`stage-corpus.mjs#slim()` strips only
             # `lemma`/`root`/`class`, never `line`) — was never even DECLARED
             # on the engine's own `CorpusWord` type, so nothing anywhere could
             # read it; TypeScript would reject the access outright. Same
             # "shipped, never declared on the consuming type" shape as
             # `Corpus.lookalikes` (v3-D181) and `CorpusDistractor.origin`
             # (v3-D187), here on the per-word geometry field. Fixed: `CorpusWord`
             # gains an optional `line?: number | null`; new
             # `lib/corpus/wordReference.ts#mushafLineLabel()` decides the
             # three-way degradation (real number/null/undefined) with a
             # `typeof` check, never truthiness; the ayah-detail page's own
             # "WORD BY WORD" list renders it beside each word's gloss. RED
             # confirmed directly: reverting the two production files (new
             # `wordReference.ts`/its test kept) failed the dedicated wiring
             # assertion in `ayah-detail.test.tsx` genuinely (source no longer
             # mentioned `mushafLineLabel`); restored, 48/48 green (44 + 4).
             # `TZ=UTC make test`: 2636 passing (was 2631, +5; apps/web 1368,
             # was 1363). `check-test-floor.mjs`: OK, 2636 >= floor 1899 (+737
             # margin, unmoved). `TZ=UTC make build`: exit 0, 30 routes
             # (unchanged). `npm run gates`: all green (boundaries 308 files, up
             # from 306 — exactly the one new production file). `npx tsc
             # --noEmit`, run separately across all four v3 node packages:
             # clean in all four. No `v1/**`/`v2/**` edit (stray
             # `v2/tsconfig.tsbuildinfo` reverted before committing). No Arabic
             # codepoint (every new/changed file swept programmatically over
             # every Arabic block plus both Presentation Forms blocks — zero
             # matches; every new string is a wire field name or the fixed
             # English word "line" plus an integer, never corpus text). Found
             # by a dedicated fresh-sweep agent handed the full exclusion list
             # through v3-D190, directed at `packages/engine/src/types.ts`'s
             # own wire fields with zero renders. One candidate checked and
             # rejected: `App\Models\AdminAudit::actor()` (zero-caller
             # relation, but the controller deliberately reads the raw FK and
             # pseudonymizes it instead — an intentional choice, not a gap).
             # See DECISIONS.md v3-D191.
             # NOTE (v3-D190, 2026-09-10): `SessionSummary.ayatRefs` — computed by
             # `summarizeSession()` on every session (it's literally what
             # `ayatCompleted` is the LENGTH of) — had exactly one read anywhere
             # outside the engine: an assertion in `lib/session/run.test.ts`.
             # `SessionIsland.tsx`'s summary block printed the ayat COUNT but
             # never WHICH ayat a learner had just drilled. Fixed with one new
             # summary line ("Ayah N completed." / "Ayat N, M completed."),
             # rendered only when `ayatRefs.length > 0` — never fabricated for a
             # session whose only work was a failed gate. RED confirmed directly:
             # `git stash` of `SessionIsland.tsx` alone (2 new tests kept, 27
             # pre-existing untouched) failed both on a missing testid node, not
             # a text mismatch; restored, 29/29 green. `TZ=UTC make test`: 2631
             # passing (was 2629, +2 — exactly this run's new tests; apps/web
             # 1363, was 1361). `check-test-floor.mjs`: OK, 2631 >= floor 1899
             # (+732 margin, unmoved). `TZ=UTC make build`: exit 0, 30 routes
             # (unchanged). `npm run gates`: all green (boundaries 306 files,
             # unchanged count). `npx tsc --noEmit`: clean. No `v1/**`/`v2/**`
             # edit (stray `v2/tsconfig.tsbuildinfo` reverted before committing).
             # No Arabic codepoint (full diff swept programmatically over every
             # Arabic block plus both Presentation Forms blocks — zero matches;
             # every new string is a fixed English sentence built from a
             # fixture-derived ayah integer). Found by a dedicated fresh-sweep
             # agent handed the full exclusion list through v3-D189. Two other
             # real candidates surfaced and deliberately left:
             # `lib/idb/writeLock.ts#useWriterStatus()` (zero-caller, but its
             # behavior is already achieved via duplicated inline code — a reuse
             # issue, not a learner-facing gap); `lib/plan/forecast.ts`'s
             # `awayDays` (real WIREFRAME §629 gap, needs a new event type + a
             # write path — larger scope). The spec/selection-engine subsystem
             # (`selectFor`/`Spec`/`/api/specs`) is confirmed genuinely unwired
             # into any learner-facing route, but closing it means
             # re-architecting how the live session picks questions —
             # PaywallGate-sized scope, not a nightly fix. See DECISIONS.md
             # v3-D190.
             # NOTE (v3-D189, 2026-09-10): `entitlements.current_period_end`/
             # `.grace_until` — written by `WebhookHandler::onSubscriptionUpdated()`/
             # `onPaymentFailed()` since M7 shipped, real Stripe-sourced dates, not
             # synthetic — reached no learner: `EntitlementController::show()`
             # never put either on the wire, so the `/settings` "YOUR PLAN" card
             # (v3-D182) could say a learner was `active` or in `grace` but never
             # when a subscription renews or when a failed charge would next
             # retry. Same "written since the writer shipped, zero read surface"
             # shape this build has closed ~90 times since v3-D82, here on two
             # sibling fields of a table a prior run already built a display card
             # for. Fixed, read-only, no schema change: `show()` adds both fields
             # verbatim; `EntitlementSnapshot` gains matching fields, parsed with
             # the same total-degradation discipline every other field already
             # uses; `buildPlanSummary()`'s `active`/`grace` branches each gain
             # one conditional trailing clause, present only when the server sent
             # a real date — never fabricated for a lifetime purchase or an
             # unattributed grace row. RED confirmed directly: `git stash` of the
             # four production files (tests kept) failed exactly as predicted —
             # the backend case read `null` where a real epoch-ms value was
             # expected; the frontend round-trip case was missing both new keys;
             # both `planSummary` cases rendered the plain base sentence with no
             # renewal/retry clause; the panel case's rendered text never
             # contained the expected ISO string. Restored byte-identically,
             # reran green: 7/7 PHPUnit (was 6), `sync.test.ts` 15/15,
             # `planSummary.test.ts` 11/11, `settings-plan-panel.test.tsx` 7/7,
             # `entitlement.test.ts` 13/13. `TZ=UTC make test`: 2629 passing (was
             # 2623, +6 — v3/api 367 (+1), apps/web 1361 (+5); no other suite
             # moved). `check-test-floor.mjs`: OK, 2629 >= floor 1899 (+730
             # margin, unmoved, same discipline as every prior entry). `TZ=UTC
             # make build`: exit 0, 30 routes (unchanged — no new route, edits
             # inside the existing `/settings` PlanPanel data path). `npm run
             # gates`: all green (boundaries 305 files, unchanged count — no new
             # production file, four existing files edited plus their four
             # existing test files; fonts degraded-but-non-blocking,
             # pre-existing; corpus-morphology 362 words / corpus-glyphs 206
             # codepoints, both unchanged — no new corpus data). `npx tsc
             # --noEmit`: clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff produced by running the
             # suite was reverted before committing, same discipline as every
             # prior entry — `git status --porcelain -- v1 v2` empty immediately
             # before committing). No Arabic codepoint (the full diff swept
             # programmatically, in Python, over the Arabic, Arabic Supplement,
             # Arabic Extended-A and both Presentation Forms Unicode blocks —
             # zero matches; every new string is a wire field name, an ISO
             # timestamp derived from a fixture integer, or a fixed English
             # sentence fragment, never corpus text). Session start: fresh
             # container, `make setup` run from scratch; v3/api's `composer
             # install` hit the same transient proxy timeout named at prior
             # entries cloning `laravel/framework` via git-mirror fallback —
             # retried with `COMPOSER_PROCESS_TIMEOUT=900` and completed clean,
             # no code/config change, then `make setup` re-run to finish the
             # remaining npm installs. `HEAD` and local `main` both matched
             # `origin/main` at `38ff0c5` already — no stale-local-main trap this
             # run. NOT addressed: every item on v3-D188's own "NOT addressed"
             # list, unchanged — `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate` as a
             # whole class / `permitsIssuance`/`permitsReview` (v3-D88, v3-D151);
             # multi-surah enrollment; the operational mailer/7-night window;
             # PAY-1's Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift (v3-D127);
             # `packages/engine/src/placement.ts` (v3-D111/D113/D123); the
             # late-arrival refold half of v3-D32; `AccountDeletionRequest
             # ::isDue()` (v3-D146); the `AdminRole::OPERATOR`/`MODERATOR` gating
             # question (v3-D185); `MacroFacts.litany.rhymeLabel` (v3-D188) — all
             # unchanged. See DECISIONS.md v3-D189.
             # NOTE (v3-D188, 2026-09-09): `MacroFacts.reason` — the compiler's own
             # audit trail for WHICH v3-D21 rule fired ("ayahCount=3", "ruku=12",
             # "rhyme -uun 78%", "refrain x3", "default"), a required field, ships
             # to the browser on every compiled corpus's own `meta.macro` since
             # v3-D136 wired real ruku counts — had exactly one read anywhere in
             # the tree: two `expect(f.reason)` assertions in the compiler's own
             # `macro.test.ts`. Its own docblock says "rendered nowhere by
             # default" — correct for the LEARNER-facing `MacroPanel`, which has
             # no business showing a compiler internal to a learner — but nothing
             # on the ADMIN side showed it either: a reviewer looking at a
             # borderline classification (a surah landing exactly at
             # `RING_MIN_RUKU`, or one that fell through to ARC because a
             # vendoring error left its ruku/rhyme inputs missing) had no way to
             # see WHY the compiler decided what it did, short of reading source.
             # Found by a dedicated fresh-sweep agent handed the full list of
             # already-known/deferred items and told not to re-report any of
             # them, directed at Console Commands, Middleware, `lib/`
             # subdirectories not recently named, and a full exported-symbol pass
             # over `packages/engine/src`/`packages/corpus-compiler/src`/
             # `worker/fold-runner/src` — both zero-caller sweeps came back
             # clean, and this was the one candidate that survived direct
             # verification (the agent's other lead, `MacroFacts.litany
             # .rhymeLabel`, was checked and rejected: real, but currently
             # unreachable in production — none of the four launch surahs
             # classify LITANY today, confirmed directly from the vendored ruku
             # files, 12=RING/67=ARC/103+112=ATOMIC — and its only non-empty path
             # needs `rhymeClassOf()`, already deferred since v3-D136). Fixed
             # with a new diagnostic-only panel, mirroring `LookAlikesPanel.tsx`'s
             # own precedent (v3-D181): `MacroClassificationPanel.tsx` renders
             # the surah's archetype and reason; `macroFactsFor()` (which imports
             # the compiler's `classify()` directly) is computed server-side in
             # `/workbench/page.tsx`, exactly like the surah page and `/progress`
             # already do, and threaded to `WorkbenchIsland` as a new required
             # `macro` prop — never inside the "use client" island, which would
             # ship the classifier and its thresholds to the browser (the exact
             # arrangement `lib/macro/facts.ts`'s own docblock, §A.1, rejects).
             # RED confirmed directly: the new tests (3 in a dedicated describe
             # block, plus 1 wiring assertion reading `/workbench/page.tsx`'s own
             # source, mirroring the file's existing `loadEffectiveCorpus` source
             # check) failed against the unmodified tree — `getByRole("region",
             # {name: /macro classification/i})` found nothing; implemented,
             # reran: 37/37 green in `workbench-ui.test.tsx` (was 33, +4). Three
             # pre-existing `WorkbenchIsland` call sites needed a `macro` prop
             # added (now required, not defaulted) — each passes the real
             # `macroFactsFor(corpus)` computed from the frozen fixture, never a
             # placeholder. The LITANY test case seeds a DIFFERENT archetype and
             # reason ("refrain x3") than the RING case ("ruku=12") and asserts
             # the RING string is absent, so neither could pass on a hardcoded
             # string; a third case calls the real `macroFactsFor` against the
             # frozen 12.json fixture and asserts it independently resolves to
             # ARC/"default" (no vendored ruku/rhyme data in that fixture) before
             # asserting the same values render — proving genuine end-to-end
             # integration, not a fabricated prop. `TZ=UTC make test`: 2623
             # passing (was 2619, +4 — exactly this run's new tests; apps/web
             # 1356, was 1352; no other suite moved). `check-test-floor.mjs`: OK,
             # 2623 >= floor 1899 (+724 margin, unmoved, same discipline as every
             # prior entry). `TZ=UTC make build`: exit 0, 30 routes (unchanged —
             # edits inside the existing `/workbench` component tree, no new
             # route). `npm run gates`: all green (boundaries 306 files, up from
             # 304 — exactly the one new production file; fonts
             # degraded-but-non-blocking, pre-existing; corpus-morphology 362
             # words / corpus-glyphs 206 codepoints, both unchanged — no new
             # corpus data). `npx tsc --noEmit`: clean. No `v1/**`/`v2/**` edit (a
             # stray `v2/tsconfig.tsbuildinfo` build-cache diff reverted before
             # committing, same discipline as every prior entry — `git status
             # --porcelain -- v1 v2` empty immediately before committing). No
             # Arabic codepoint (the full diff swept programmatically, in
             # Python, over the Arabic, Arabic Supplement, Arabic Extended-A and
             # both Presentation Forms Unicode blocks, plus a `\u06xx`/`\u08xx`/
             # `\uFBxx`/`\uFExx` escape and `fromCharCode` sweep — zero matches;
             # every new string is a wire field name, a fixed English caption,
             # or a synthetic MacroFacts test fixture value, never corpus text).
             # Session start: fresh container, `make setup` run from scratch (no
             # `node_modules`/`vendor` anywhere); `HEAD` was found detached at
             # `0429285`, the same commit `origin/main` was already at, on a
             # stale LOCAL `main` branch ref thirteen commits behind (`4be9924`,
             # v3-D174) — the recurring "stale local main" trap
             # v3-D77/D91/D127/D138/D159/D167/D170/D172/D174-D187 each
             # independently hit, caught before any implementation work via `git
             # fetch` + `git checkout main && git merge --ff-only origin/main`,
             # no work lost or at risk. NOT addressed: `rhymeClassOf()`
             # (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution` (v3-D148);
             # `PaywallGate` (v3-D88/D151); multi-surah enrollment; the
             # mailer/7-night window; PAY-1 fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift (v3-D127);
             # `packages/engine/src/placement.ts` (v3-D111/D113/D123); the
             # late-arrival refold half of v3-D32; `AccountDeletionRequest
             # ::isDue()` (v3-D146) — all unchanged. See DECISIONS.md v3-D188.
             # NOTE (v3-D187, 2026-09-09): `CorpusDistractor.origin` ("authored" vs
             # "kernel" compile-time provenance) shipped to the browser verbatim
             # since `buildCorpus.ts` stamped it, exactly like `prd_rank`/
             # `src_type`/`why` did before v3-D186 closed that gap the previous
             # night — but the engine's own `CorpusDistractor` wire type never
             # declared the field, so no client could read it even by accident.
             # v3-D186's own closing note named this exactly and deliberately
             # left it: "a fourth field on the same struct with the identical
             # shape... left for a future run." This run is that future run.
             # `OverrideEditor.tsx`'s "current distractors" list (v3-D186) showed
             # rank/classification/reason but not whether a row was
             # compiler-authored, kernel-derived, or (a third, admin-only value
             # this run also introduces) admin-written through the override
             # picker itself — material, since NIGHTLY.md's own foil-kernel
             # table flags kernel rows for qari adjudication. Fixed:
             # `CorpusDistractor` gains `origin: string` (loosened from the
             # compiler's closed `"authored" | "kernel"` union, matching
             # `prd_rank`/`src_type`'s own precedent, so the admin write path
             # can stamp its own `"admin"` value); `applyOverrides()` needed no
             # change (it already spreads the whole payload object through);
             # the current-distractors `<li>` now renders `({d.src_type},
             # {d.origin})`; `onSubmitDistractor` now stamps `origin: "admin"`
             # on every replacement row it posts. RED confirmed directly: `git
             # stash` of `OverrideEditor.tsx` alone (one new `it()` plus one
             # strengthened existing assertion, both kept; 19 pre-existing cases
             # untouched) failed exactly those 2 predicted cases — no
             # `/authored/` text anywhere in the rendered region, and the posted
             # body's distractor rows lacked `origin: "admin"`; restored
             # byte-identically, 21/21 green. The render test seeds two rows on
             # the SAME target word with DIFFERENT origin values so it cannot
             # pass by reading only one; making `origin` required also forced
             # `write.test.ts`'s three `distractorOverride(...)` call-site
             # fixtures to carry it — a genuine TS compile-time catch, not a
             # test-only concern, since that function's real parameter type is
             # `Array<Omit<CorpusDistractor, "ayah" | "position">>`. `TZ=UTC make
             # test`: 2619 passing (was 2618, +1 — one new `it()` plus one
             # strengthened existing assertion, so net +1 not +2; apps/web 1352,
             # was 1351; no other suite moved: 255 v2 vitest, 47 v2/api, 366
             # v3/api, 118 corpus-compiler, 420 engine, 61 fold-runner).
             # `check-test-floor.mjs`: OK, 2619 >= floor 1899 (+720 margin,
             # unmoved, same discipline as every prior entry). `TZ=UTC make
             # build`: exit 0, 30 routes (unchanged — edits inside the existing
             # `/workbench` component tree, no new route). `npm run gates`: all
             # green (boundaries 304 files, unchanged count — one existing
             # production file edited plus two existing test files, no new
             # production file; fonts degraded-but-non-blocking, pre-existing;
             # corpus-morphology 362 words / corpus-glyphs 206 codepoints, both
             # unchanged — no new corpus data, only a type field and a renderer
             # for data already compiled). `npx tsc --noEmit`, run separately
             # across all four v3 node packages (`apps/web`, `packages/engine`,
             # `packages/corpus-compiler`, `worker/fold-runner` — widening a
             # shared engine type can silently break a sibling package's own
             # typecheck without touching its source): clean in all four.
             # `packages/engine`'s own `npm test`: 420/420, unchanged (no engine
             # test file touched — `overrides.test.ts`'s `payload: unknown`-typed
             # literals need no `origin` field to keep compiling, since
             # TypeScript does not excess-property-check an object literal
             # assigned to an `unknown`-typed location). No `v1/**`/`v2/**` edit
             # (a stray `v2/tsconfig.tsbuildinfo` build-cache diff reverted
             # before committing, same discipline as every prior entry — `git
             # status --porcelain -- v1 v2` empty immediately before
             # committing). No Arabic codepoint (the full diff swept
             # programmatically, in Python, over the Arabic, Arabic Supplement,
             # Arabic Extended-A and both Presentation Forms Unicode blocks,
             # plus a `\u06xx`/`\u08xx`/`\uFBxx`/`\uFExx` escape and
             # `fromCharCode` sweep — zero matches; every new string is a wire
             # field name or a synthetic placeholder value — "authored"/
             # "kernel"/"admin", the compiler's own real closed-set values plus
             # the admin path's own established convention — never a real
             # ayah's bytes). Session start: fresh container, `make setup` run
             # from scratch (no `node_modules`/`vendor` anywhere); `HEAD` was
             # found detached at `04ed7f0`, the same commit `origin/main` was
             # already at, on a stale LOCAL `main` branch ref twelve commits
             # behind (`4be9924`, v3-D174) — the recurring "stale local main"
             # trap
             # v3-D77/D91/D127/D138/D159/D167/D170/D172/D174/D175/D176/D177/D178/D179/D180/D181/D182/D183/D184/D185/D186
             # each independently hit, caught before any implementation work
             # via `git fetch` + `git checkout main && git merge --ff-only
             # origin/main`, no work lost or at risk. NOT addressed: every item
             # on v3-D186's own "NOT addressed" list, unchanged (see
             # DECISIONS.md v3-D186/v3-D187 for the full enumeration). See
             # DECISIONS.md v3-D187.
             # NOTE (v3-D186, 2026-09-08): `CorpusDistractor.prd_rank`/`.src_type`/
             # `.why` — every distractor's classification onto the FR1 rank
             # taxonomy and the compiler's own reason string for choosing it
             # (`corpus-compiler/src/prdRank.ts#mapPrdRank()`, called for every
             # authored and kernel-generated distractor since `buildCorpus.ts`
             # shipped) — were computed, typed as required fields on
             # `CorpusDistractor` (`packages/engine/src/types.ts`), and shipped
             # to the browser VERBATIM by `stage-corpus.mjs#slim()` (the same
             # function that DOES strip the QAC morphology fields, v3-D24, but
             # does nothing for these three), yet nothing under `apps/web` ever
             # read any of them back: `grep -rn "prd_rank|src_type|srcType|
             # prdRank" apps/web --include=*.ts --include=*.tsx` (excluding
             # tests and the two literal placeholder strings `write.ts` posts
             # for a BRAND NEW admin-authored replacement) returned nothing.
             # Sharpest consequence on the one screen built to judge distractor
             # quality: `OverrideEditor.tsx`'s "Replace distractors" fieldset
             # let an admin pick a target word and up to four replacements, but
             # never showed what the word's CURRENT distractors were or WHY the
             # compiler chose them — an admin corrected blind, unable to tell
             # a genuinely bad foil (the reason this panel exists) from one
             # they simply hadn't read the rationale for. Same "computed,
             # shipped, zero read surface" shape this build has closed ~90
             # times since v3-D82, here on the compiler's own distractor
             # rationale rather than a database audit column. Fixed,
             # read-only, no write-path or wire-schema change (both fields
             # were already required and already reaching the browser):
             # `OverrideEditorProps` gains a `distractors: readonly
             # CorpusDistractor[]` prop (`corpus.distractors`, threaded from
             # `WorkbenchIsland` exactly like `surahWords` already is); a new
             # `currentDistractors` `useMemo` filters+sorts it to the chosen
             # target word (mirroring `distractorsFor()`'s own "sorted by rank
             # ascending" contract, repeated rather than imported since this is
             # a plain array slice, not a `Corpus` object); selecting a target
             # word now renders a `role="region"` list of its own current
             # distractors (rank, `prd_rank`, `src_type`, `why`) above the
             # replacement pickers, or an honest "No distractors recorded for
             # this word yet" when none exist — never silently reusing another
             # word's rows. RED confirmed directly: `git stash` of the two
             # component files only (both new tests kept, 18 pre-existing
             # cases in `workbench-override-editor.test.tsx` untouched) failed
             # exactly the 2 new cases (`getByRole("region", {name: /current
             # distractors/i})` found nothing — the unfixed component renders
             # no such region at all); restored byte-identically, 20/20 green.
             # The positive case seeds TWO distractors on the SAME target word
             # with distinct `prd_rank`/`src_type`/`why` values, so it cannot
             # pass by reading only one of them; the negative case selects a
             # DIFFERENT word with zero recorded distractors and asserts both
             # the honest fallback text and the absence of the first word's
             # rows, proving the empty state is real rather than a shared
             # placeholder. `TZ=UTC make test`: 2618 passing (was 2616, +2 —
             # exactly this run's two new `it()` blocks; apps/web 1351, was
             # 1349; no other suite moved: 255 v2 vitest, 47 v2/api, 366
             # v3/api, 118 corpus-compiler, 420 engine, 61 fold-runner).
             # `check-test-floor.mjs`: OK, 2618 >= floor 1899 (+719 margin,
             # unmoved, same discipline as every prior entry). `TZ=UTC make
             # build`: exit 0, 30 routes (unchanged — edits inside the existing
             # `/workbench` component tree, no new route). `npm run gates`:
             # all green (boundaries 305 files, up from 304 — no new
             # production file, two existing files edited plus their one
             # existing test file; fonts degraded-but-non-blocking,
             # pre-existing; corpus-morphology 362 words / corpus-glyphs 206
             # codepoints, both unchanged — no new corpus data, only a prop
             # and a renderer for data already compiled). `npx tsc --noEmit`
             # (via `next build`'s own TypeScript pass): clean. No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff produced by running the suite was reverted
             # before committing, twice this run, same discipline as every
             # prior entry — `git status --porcelain -- v1 v2` empty
             # immediately before committing). No Arabic codepoint (the full
             # diff swept programmatically, in Python, over the Arabic,
             # Arabic Supplement, Arabic Extended-A and both Presentation
             # Forms Unicode blocks, plus a `\u06xx`/`\u08xx`/`\uFBxx`/`\uFExx`
             # escape and `fromCharCode` sweep — zero matches; every new
             # string is a wire field name, a fixed English caption, or a
             # synthetic placeholder value ("look-alike-foil", matching this
             # test file's own established no-Arabic convention — never a
             # real ayah's bytes). Found by a dedicated fresh-sweep agent
             # handed the full list of already-known/deferred items carried
             # forward through v3-D185 and told not to re-report any of them,
             # directed at Laravel Console Commands/Middleware, Eloquent
             # relations, `apps/web/lib` subdirectories not recently named,
             # and engine/corpus-compiler/fold-runner exported functions —
             # both the engine/fold-runner zero-caller sweep and the
             # React-component-mount sweep came back clean (every component
             # under `components/` is transitively reachable from `app/`), and
             # this was the one candidate that survived direct verification
             # (grep-confirmed at every claimed step before implementing,
             # rather than trusted from the agent's report). Session start:
             # fresh container, `make setup` run from scratch (no
             # `node_modules`/`vendor` anywhere); `HEAD` was found detached at
             # `1bb0e64`, the same commit `origin/main` was already at, on a
             # stale LOCAL `main` branch ref eleven commits behind (`4be9924`,
             # v3-D174) — the recurring "stale local main" trap
             # v3-D77/D91/D127/D138/D159/D167/D170/D172/D174/D175/D176/D177/D178/D179/D180/D181/D182/D183/D184/D185
             # each independently hit, caught before any implementation work
             # via `git fetch` + `git checkout main && git merge --ff-only
             # origin/main`, no work lost or at risk. NOT addressed: every
             # item on v3-D185's own "NOT addressed" list, unchanged (see
             # DECISIONS.md v3-D185 for the full enumeration — rhymeClassOf(),
             # EntitlementMachine::merge(), TrialAttribution, PaywallGate,
             # multi-surah enrollment, the mailer/7-night window, PAY-1
             # fixtures, surah 67's scene beats, and the rest). See
             # DECISIONS.md v3-D186.
             # NOTE (v3-D185, 2026-09-08): `admin_roles.granted_at`/`.granted_by`
             # — stamped on every grant since `admin:grant-role` shipped
             # (v3-D92), the ONLY writer of this table — had no admin-facing
             # reader anywhere: `GET /api/admin/whoami` returns only the
             # CALLING admin's own roles (`$user->adminRoles()`, consumed
             # solely to disable the qari-signature radio for a non-qari
             # admin, v3-D131), and no `/admin/roles` route existed at all
             # (confirmed against the full `routes/api.php` admin group).
             # Since `tier: qari` is this app's one security-gated action
             # (v3-D92), an operator auditing "who currently holds qari
             # access, and who granted it" had a database console and
             # nothing else. Same "written, wire-carried, zero read surface"
             # shape this build has closed ~60 times since v3-D82, here on
             # the role-grant audit trail rather than a sibling table.
             # Distinct from the already-recorded `AdminRole::OPERATOR`/
             # `MODERATOR` gap (no gated action to attach to, a
             # product-scope question) — that is about those two roles
             # having nothing to DO yet; this is about the audit trail every
             # grant, `qari` included, already produces never reaching a
             # reader. Fixed on the exact template `PurgeLedgerController`/
             # `AdminAuditController` already established: new
             # `Admin\AdminRolesController::index()` (`GET /api/admin/roles`,
             # READ-ONLY BY CONSTRUCTION) + `lib/admin/roles.ts` +
             # `AdminRolesPanel.tsx`, on a new standalone `/settings/roles`
             # route (no existing page is a natural home, same precedent
             # `/settings/audit`/`/settings/privacy` set). The role-holder's
             # `user_id` is pseudonymized on the way out (the same HMAC
             # `Pseudonymizer` every other admin surface applies to a raw
             # `users` FK); `granted_by` passes through unpseudonymized — it
             # is a free-text operator string (an email or `"cli"`), not a
             # `users` id, the same treatment `AdminAuditController` already
             # gives `ip`/`request_id`. Two SQL-level filters: `role` (the
             # closed set) and `userId` (raw, from the database — a
             # pseudonym is one-way by design and cannot be reversed to
             # query by). RED confirmed at all three layers, each moved
             # aside with its tests kept and restored byte-identically
             # after: backend (`AdminRolesController.php` moved aside — 9 of
             # 10 new PHPUnit cases failed on a missing-file error, the
             # tenth being the auth-gate test which needed no controller to
             # fail correctly); frontend lib (`roles.ts` moved aside — 0/9,
             # module resolution); frontend panel (`AdminRolesPanel.tsx` +
             # the new page moved aside — 0/7, module resolution). Restored,
             # reran: 10/10 + 9/9 + 7/7 green. The load-bearing backend case
             # grants two roles through the REAL command (never a hand-built
             # row) at two different `granted_at` values and asserts
             # newest-first ordering, each row's own `role`/`grantedBy`, and
             # that the pseudonym is genuinely a one-way HMAC
             # (`assertNotEquals` the raw id). `TZ=UTC make test`: 2616
             # passing (was 2590, +26 — exactly this run's new tests: 10
             # PHPUnit + 9 + 7 vitest; v3/api 366, was 356; apps/web 1349,
             # was 1333; no other suite moved). `check-test-floor.mjs`: OK,
             # 2616 >= floor 1899 (+717 margin, unmoved, same discipline as
             # every prior entry). `TZ=UTC make build`: exit 0, 30 routes
             # (was 29 — `/settings/roles` is new). `npm run gates` (via
             # `prebuild`): all green (boundaries 304 files, up from 299 —
             # exactly the three new apps/web production files; fonts
             # degraded-but-non-blocking, pre-existing; corpus-morphology
             # 362 words / corpus-glyphs 206 codepoints, both unchanged — no
             # new corpus data). `npx tsc --noEmit` (via `next build`'s own
             # TypeScript pass): clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff produced by
             # running the suite was reverted before committing, same
             # discipline as every prior entry — `git status --porcelain --
             # v1 v2` empty immediately before committing). No Arabic
             # codepoint (every new/changed file swept programmatically, in
             # Python, over the Arabic, Arabic Supplement, Arabic
             # Extended-A and both Presentation Forms Unicode blocks — zero
             # matches; every new string is a wire field name, a closed-set
             # role value, a pseudonym/timestamp/email test fixture, or a
             # fixed English label, never corpus text). Found by a dedicated
             # fresh-sweep agent handed the full list of already-known/
             # deferred items carried forward through v3-D184 and told not
             # to re-report any of them, directed at `v3/api`'s Console
             # Commands/Middleware/Jobs, `apps/web/lib` subdirectories not
             # recently named, and zero-caller Eloquent relations. Session
             # start: fresh container, `make setup` run from scratch (no
             # `node_modules`/`vendor` anywhere); local `HEAD` was found
             # detached at `c205251`, the same commit `origin/main` was
             # already at, on a stale LOCAL `main` branch ref ten commits
             # behind (`4be9924`, v3-D174) — the recurring "stale local
             # main" trap
             # v3-D77/D91/D127/D138/D159/D167/D170/D172/D174/D175/D176/D177/D178/D179/D180/D181/D182/D183/D184
             # each independently hit, caught before any implementation
             # work via `git fetch` + `git checkout main && git merge
             # --ff-only origin/main`, no work lost or at risk. NOT
             # addressed: every item on v3-D184's own "NOT addressed" list,
             # unchanged; the `AdminRole::OPERATOR`/`MODERATOR` gating
             # question (no gated action to attach to) remains a separate,
             # open product-scope question, untouched by this fix. See
             # DECISIONS.md v3-D185.
             # NOTE (v3-D184, 2026-09-08): `GlossDraftRow.createdAt`/`.updatedAt`/
             # `.reviewedAt` — the DRAFT ROW's own timestamps, as opposed to each
             # review ENTRY's own `createdAt` fixed the prior night (v3-D183) —
             # were fetched and typed (`lib/admin/glossDrafts.ts#GlossDraftRow`,
             # required for createdAt/updatedAt, genuinely nullable for
             # reviewedAt) since this panel shipped, but never rendered:
             # `grep -n "row\.createdAt\|row\.updatedAt\|row\.reviewedAt"
             # GlossDraftsPanel.tsx` returned nothing before this fix —
             # `reviewedAt` was read only as a boolean null-check inside the
             # draft-save success message (`outcome.draft.reviewedAt === null`),
             # never printed; `createdAt`/`updatedAt` had zero reads anywhere.
             # Named explicitly as v3-D183's own leftover ("a smaller, separate,
             # adjacent gap on the same panel, left for a future run") rather
             # than a fresh sweep finding. A reviewer had no way to tell when a
             # draft row was first created, when it was last touched (an edit
             # after review silently returns it to `draft` — `store()`'s own
             # un-review branch — with no visible trace of when that happened),
             # or when the CURRENT review decision was actually made. Fixed,
             # display-only, no server/wire change: two new columns, "Created"
             # and "Updated" (`new Date(row.createdAt/.updatedAt).toISOString()`,
             # both required, no fallback needed), and the existing "Reviewed
             # by" cell gains `— {ISO timestamp}` when `row.reviewedAt !== null`
             # — all three in this panel's own `ltr-island` convention, the
             # same one `OverrideEditor.tsx` (v3-D180) and this panel's own
             # review-history list (v3-D183) already use for exactly this shape
             # of value. RED confirmed directly: `git stash` of
             # `GlossDraftsPanel.tsx` alone (both new tests kept, 14
             # pre-existing cases in `gloss-drafts-panel.test.tsx` untouched)
             # failed exactly the 2 new cases — one `getByText` on an ISO
             # string threw (no such text existed), the other's
             # `getAllByText` returned 0 instead of 2; restored byte-
             # identically, 16/16 green. The first new test seeds THREE
             # distinct values (createdAt/updatedAt/reviewedAt all different)
             # so no single rendered timestamp can satisfy more than one
             # assertion; the second proves a never-reviewed row renders its
             # own createdAt/updatedAt (equal in that fixture, so the ISO
             # string legitimately appears twice, asserted via
             # `getAllByText(...).toHaveLength(2)`) while adding no fabricated
             # reviewedAt timestamp. `TZ=UTC make test`: 2590 passing (was
             # 2588, +2 — exactly this run's two new `it()` blocks; apps/web
             # 1333, was 1331; no other suite moved: 255 v2 vitest, 47 v2/api,
             # 356 v3/api, 118 corpus-compiler, 420 engine, 61 fold-runner).
             # `check-test-floor.mjs`: OK, 2590 >= floor 1899 (+691 margin,
             # unmoved, same discipline as every prior entry). `TZ=UTC make
             # build`: exit 0, 29 routes (unchanged — edits inside the
             # existing `/settings/gloss-drafts` component, no new route).
             # `npm run gates` (via `prebuild`): all green (boundaries 299
             # files, unchanged count — one existing production file edited
             # plus its one existing test file, no new production file; fonts
             # degraded-but-non-blocking, pre-existing; corpus-morphology 362
             # words / corpus-glyphs 206 codepoints, both unchanged — no new
             # corpus data). `npx tsc --noEmit` (via `next build`'s own
             # TypeScript pass): clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff produced by running
             # the suite was reverted before committing, same discipline as
             # every prior entry — `git status --porcelain -- v1 v2` empty
             # immediately before committing). No Arabic codepoint (both
             # changed files swept programmatically, in Python, over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks — zero matches; every new
             # string is a wire field read through `new
             # Date(...).toISOString()`, never corpus text). Session start:
             # fresh container, `make setup` run from scratch (no
             # `node_modules`/`vendor` anywhere — composer install for
             # `v3/api` hit a transient proxy timeout cloning `laravel/pint`
             # on the first attempt; retried with `COMPOSER_PROCESS_TIMEOUT=900`
             # and completed clean, no code or config change); local `HEAD`
             # was found detached at `bd55afc`, the same commit `origin/main`
             # was already at, on a stale LOCAL `main` branch ref nine commits
             # behind (`4be9924`, v3-D174) — the recurring "stale local main"
             # trap
             # v3-D77/D91/D127/D138/D159/D167/D170/D172/D174/D175/D176/D177/D178/D179/D180/D181/D182/D183
             # each independently hit, caught before any implementation work
             # via `git fetch` + `git checkout main && git merge --ff-only
             # origin/main`, no work lost or at risk. NOT addressed: every
             # item on v3-D183's own "NOT addressed" list, unchanged.
             # NOTE (v3-D183, 2026-09-08): `GlossDraftReviewRow.createdAt` — the
             # append-only review trail's own "WHEN" half, required and
             # non-nullable, sent on every review entry since
             # `GlossDraftsController::toWire()` first emitted `reviews[]`
             # (v3-D156) — was fetched and typed
             # (`lib/admin/glossDrafts.ts#GlossDraftReviewRow`) but never
             # rendered anywhere: `GlossDraftsPanel.tsx`'s History `<details>`
             # printed `fromStatus → toStatus by {actor}` plus the optional
             # note, never `createdAt`. Same "written, wire-carried, zero
             # read surface" shape this build has closed on this exact
             # panel's OWN history list three times before, field by field
             # (`textAtReview` at v3-D160, `authorKind`/`authoredBy` at
             # v3-D169, `note` at v3-D170) — and the direct sibling of
             # `QuestionOverride.createdAt` in `OverrideEditor.tsx`, fixed
             # one workbench panel over at v3-D180. Two review entries on
             # the same draft (e.g. rejected, corrected, approved) were
             # distinguishable only by trusting the array's own JSON
             # order — a fact never shown on screen — never by an actual
             # visible timestamp, so a reviewer could not tell how long ago
             # either correction happened or put two same-day corrections
             # in order. Fixed, display-only, no server/wire change:
             # each history `<li>` gains `— {ISO timestamp}` in an
             # `ltr-island` span, following `OverrideEditor.tsx`'s own
             # established convention for exactly this shape of history row
             # verbatim (`— <span className="ltr-island">{new Date(rev
             # .createdAt).toISOString()}</span>`). RED confirmed directly:
             # `git stash` of `GlossDraftsPanel.tsx` alone (the new test
             # kept, 13 pre-existing cases in `gloss-drafts-panel.test.tsx`
             # untouched) failed exactly the new case (`getByText` on the
             # ISO string threw — no such text existed in the rendered
             # DOM); restored byte-identically, 14/14 green. The new test
             # seeds two review entries on the SAME draft at two different
             # `createdAt` values and asserts BOTH ISO strings render,
             # proving each entry carries its own timestamp rather than one
             # shared or hardcoded value. `TZ=UTC make test`: 2588 passing
             # (was 2587, +1 — exactly this run's one new `it()` block;
             # apps/web 1331, was 1330; no other suite moved: 255 v2
             # vitest, 47 v2/api, 356 v3/api, 118 corpus-compiler, 420
             # engine, 61 fold-runner). `check-test-floor.mjs`: OK, 2588 >=
             # floor 1899 (+689 margin, unmoved, same discipline as every
             # prior entry). `TZ=UTC make build`: exit 0, 29 routes
             # (unchanged — edits inside the existing
             # `/settings/gloss-drafts` component, no new route). `npm run
             # gates` (via `prebuild`): all green (boundaries 299 files,
             # unchanged count — one existing production file edited plus
             # its one existing test file, no new production file; fonts
             # degraded-but-non-blocking, pre-existing; corpus-morphology
             # 362 words / corpus-glyphs 206 codepoints, both unchanged —
             # no new corpus data). `npx tsc --noEmit` (via `next build`'s
             # own TypeScript pass): clean. No `v1/**`/`v2/**` edit (a
             # stray `v2/tsconfig.tsbuildinfo` build-cache diff produced by
             # running the suite was reverted before committing, same
             # discipline as every prior entry — `git status --porcelain
             # -- v1 v2` empty immediately before committing). No Arabic
             # codepoint (both changed files swept programmatically, in
             # Python, over the Arabic, Arabic Supplement, Arabic
             # Extended-A and both Presentation Forms Unicode blocks — zero
             # matches; every new string is a wire field read through
             # `new Date(...).toISOString()`, never corpus text).
             # Found by a dedicated fresh-sweep agent (Explore) handed the
             # full list of already-known/deferred items carried forward
             # through v3-D182 and told not to re-report any of them,
             # directed at Laravel Console Commands/Middleware/Jobs,
             # apps/web/lib subdirectories not recently named, and
             # zero-renderer React components — it identified this as the
             # direct, unfixed sibling of v3-D180's own change on
             # `OverrideEditor.tsx`, one panel over. Session start: fresh
             # container, `make setup` run from scratch (no
             # `node_modules`/`vendor` anywhere); local `HEAD` was found
             # detached at `4d4f56a`, the same commit `origin/main` was
             # already at (a stale LOCAL `main` branch ref eight commits
             # behind, at `4be9924`, v3-D174) — the recurring "stale local
             # main" trap
             # v3-D77/D91/D127/D138/D159/D167/D170/D172/D174/D175/D176/D177/D178/D179/D180/D181/D182
             # each independently hit, caught before any implementation
             # work via `git fetch` + `git checkout main && git merge
             # --ff-only origin/main`, no work lost or at risk. NOT
             # addressed: every item on v3-D182's own "NOT addressed" list,
             # unchanged; `row.createdAt`/`row.updatedAt`/`row.reviewedAt`
             # (the draft ROW's own timestamps, as opposed to each review
             # ENTRY's) remain unrendered too — a smaller, separate,
             # adjacent gap on the same panel, left for a future run.
             # NOTE (v3-D182, 2026-09-08): `lib/entitlement/sync.ts#readEntitlement
             # Snapshot()`/`refreshEntitlementSnapshot()` (v3-D88/v3-D89) have
             # fetched and cached a learner's real entitlement snapshot in
             # IndexedDB on every `SessionIsland.tsx` mount for ~90 nights, but
             # nothing under `apps/web` ever RENDERED it — `grep -rn
             # "readEntitlementSnapshot"` outside test files returned only the
             # definition itself, and a field-level check
             # (`grep -rln "snapshot\.state\|snapshot\.tier\|snapshot\.trialSurah\|
             # \.trialStartedAt\b" components app --include="*.tsx"`) came back
             # empty. The only screen that ever showed entitlement data was the
             # ADMIN billing console (`/settings/billing`), and only for looking
             # up OTHER users — a learner thirteen days into a fourteen-day
             # trial, or one who had already paid for lifetime access, had no
             # way to see that fact anywhere in their own account. Distinct from
             # the long-open, deliberately-deferred `PaywallGate`/
             # `permitsIssuance`/`permitsReview` gap (v3-D88, v3-D151): that one
             # is an unresolved GATING question (what "lapsed" should deny in a
             # mixed review/new-content queue); this is a pure, passive DISPLAY
             # of already-fetched, already-cached data, with no dependency on
             # the still-missing Stripe checkout flow — `EntitlementController
             # ::show()` already returns a sensible `trial`/`tier:none` default
             # even with zero `Entitlement` rows in the DB, confirmed directly.
             # Fixed: new `lib/settings/planSummary.ts#buildPlanSummary()` (pure
             # — the component only prints what this computes, the same split
             # `rows.ts`/`growth.ts`/`frontier.ts` already established) maps a
             # snapshot to a human sentence per state (`trial` computes days
             # remaining from `trialStartedAt` against `gate.ts`'s own
             # `TRIAL_DAYS_MS` — imported, not re-declared a third time, since a
             # second copy would only recreate the exact drift-shaped gap this
             # fix exists to close; `active`/`grace`/`lapsed_review_only` each
             # get a fixed, honest sentence, never a bare wire literal) + a new
             # `components/settings/PlanPanel.tsx` (mirrors `AnchorHourPanel`'s
             # three-state discipline exactly: `loading` / `unavailable` /
             # `ready`; tries a live `refreshEntitlementSnapshot()` first, falls
             # back to the cached `readEntitlementSnapshot()` on failure — never
             # a blank screen for an offline learner who has synced before —
             # and only shows the honest `unavailable` banner when neither a
             # live fetch nor a prior cache exists), wired into `/settings` as a
             # new "YOUR PLAN" card, first among the existing four (Account,
             # Anchor, Data, Delete). `check-boundaries.mjs`'s
             # `ENTITLEMENT_ALLOWLIST` (edge case #124's enforcement-surface
             # guard) required both new files added by name — a real gate catch
             # along the way, not a pre-anticipated exemption. RED confirmed
             # directly: both new source files moved aside (all 15 new tests
             # kept — 9 in `planSummary.test.ts`, 6 in
             # `settings-plan-panel.test.tsx`) failed on module-resolution
             # errors; restored byte-identically, 15/15 green. The component
             # suite's own load-bearing cases: a live 200 renders the state
             # sentence and tier/region; a trial 3 days in reports "11 days
             # left" (computed, not hardcoded); a failed live fetch after a
             # PRIOR successful render (which persisted a real cache entry via
             # the real IndexedDB path) still renders the cached state plus an
             # honest "last known status" caption, proving the fallback reads a
             # REAL cache, not a stub; a failed fetch with no prior cache shows
             # the `alert` banner, not a blank card; `lapsed_review_only` never
             # leaks the bare wire literal, only "review... stays open forever."
             # `TZ=UTC make test`: 2587 passing (was 2572, +15 — exactly this
             # run's new tests: 9 + 6; apps/web 1330, was 1315; no other suite
             # moved). `check-test-floor.mjs`: OK, 2587 >= floor 1899 (+688
             # margin, unmoved, same discipline as every prior entry). `TZ=UTC
             # make build`: exit 0, 29 routes (unchanged — edits inside the
             # existing `/settings` page, no new route; `stage-corpus.mjs`
             # ships no entitlement data of any kind, so the client-shipped
             # corpus subset is unaffected). `npm run gates` (via `prebuild`):
             # all green after the boundaries fix above (boundaries 297 files,
             # up from 295 — the two new production files; fonts
             # degraded-but-non-blocking, pre-existing; corpus-morphology and
             # corpus-glyphs unchanged — no new corpus data). `npx tsc
             # --noEmit` (via `next build`'s own TypeScript pass): clean. No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff reverted before committing, same discipline as
             # every prior entry). No Arabic codepoint (every changed/new file
             # swept programmatically, in Python, over the Arabic, Arabic
             # Supplement, Arabic Extended-A and both Presentation Forms
             # Unicode blocks — zero matches; every new string is a wire field
             # read, a millisecond arithmetic result, or a fixed English
             # sentence, never corpus text). Found by a dedicated fresh-sweep
             # agent handed the full list of already-known/deferred items
             # carried forward through v3-D181 (that list's own tail item,
             # `corpus-compiler`'s `connections` table, was checked directly
             # this run FIRST and confirmed a genuinely-unused build-validation
             # artifact, not a wiring gap — the engine computes connection
             # atoms independently from `ayahCount` via `atomKey()`/
             # `bridge.ts`, never reads that table; recorded so a future run
             # does not re-open it) and told not to re-report any of them,
             # directed at `api/app` model/controller relations and
             # `apps/web/lib` zero-caller exports rather than the
             # engine/corpus-compiler/fold-runner packages v3-D181's sweep had
             # just covered. Session start: fresh container, `make setup` run
             # from scratch (no `node_modules`/`vendor` anywhere); local `HEAD`
             # was found detached at `006ec48`, the same commit `origin/main`
             # was already at, on a stale LOCAL `main` branch ref seven commits
             # behind (`4be9924` vs. the real tip, v3-D181) — the recurring
             # "stale local main" trap
             # v3-D77/D91/D127/D138/D159/D167/D170/D172/D174/D175/D176/D177/D178/D179/D180/D181
             # each independently hit, caught before any implementation work
             # via `git fetch` + `git checkout main && git merge --ff-only
             # origin/main`, no work lost or at risk. NOT addressed: every item
             # on v3-D181's own "NOT addressed" list, unchanged (the
             # `connections` item is now resolved as a false lead, not merely
             # deferred — see above).
             # NOTE (v3-D181, 2026-09-05): `corpus-compiler`'s
             # `buildLookAlikes()` (cross-verse confusion pairs — exact-
             # recurrence and near-identical-script word collisions across
             # different ayat, same surah) has been computed on every
             # compile, structurally validated, and counted in the build
             # summary since build-plan step 3 — but the engine's own
             # `Corpus` type never declared the `lookalikes` field at all,
             # so no component could reach it even by accident (`grep -rln
             # "lookalikes\|LookAlike" packages/engine/src apps/web/lib
             # apps/web/components api/app` returned nothing before this
             # fix). Sharper than this build's usual "fetched but
             # unrendered" shape: this was "not even declared." Fixed:
             # `packages/engine/src/types.ts` gains `LookAlike`/
             # `LookAlikeWordRef` and an optional `lookalikes?: LookAlike[]`
             # on `Corpus`; a new `LookAlikesPanel.tsx` (mirroring
             # `ExplainTrace.tsx`'s diagnostic-only, writes-nothing
             # discipline) renders the open ayah's own cross-verse pairs on
             # `/workbench`, wired into `WorkbenchIsland.tsx` between
             # `OverrideEditor` and `ExplainTrace`. Every rendered string is
             # a fixture coordinate integer or the compiler's own fixed
             # English/transliterated reason string, never Arabic. RED
             # confirmed directly: the new component and the two wiring
             # points reverted, both new `workbench-ui.test.tsx` cases kept
             # (31 pre-existing untouched) — both failed
             # (`findByRole("region", {name: /look-alikes/i})` timed out,
             # no such region existed); restored byte-identically, 33/33
             # green. The positive case verified against the frozen engine
             # fixture's own real (pre-existing, previously-unread) 258
             # look-alike rows: ayah 1 carries exactly one pair, `{1:3} ↔
             # {7:6}`, "identical form across ayat" — confirmed with a
             # throwaway script before writing the assertion, not assumed.
             # `TZ=UTC make test`: 2572 passing (was 2570, +2 — exactly this
             # run's two new `it()` blocks; apps/web 1315, was 1313; no
             # other suite moved). `check-test-floor.mjs`: OK, 2572 >= floor
             # 1899 (+673 margin, unmoved, same discipline as every prior
             # entry). `TZ=UTC make build`: exit 0, 29 routes (unchanged —
             # edits inside the existing `/workbench` component tree, no
             # new route; the client-shipped `public/corpus/` subset is
             # unchanged — `stage-corpus.mjs#slim()` never shipped
             # `lookalikes` to the browser and still doesn't; this fix reads
             # the SSR-only `output/` copy). `npm run gates`: all green
             # (boundaries 295 files, up from 294 — exactly the one new
             # component file; fonts degraded-but-non-blocking,
             # pre-existing; corpus-morphology 362 words / corpus-glyphs 206
             # codepoints, both unchanged — no new corpus data, only a type
             # and a renderer for data already compiled). `npx tsc
             # --noEmit`: clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted before
             # committing, same discipline as every prior entry). No Arabic
             # codepoint (every changed/new file swept programmatically, in
             # Python, over the Arabic, Arabic Supplement, Arabic Extended-A
             # and both Presentation Forms Unicode blocks — zero matches).
             # Found by a dedicated fresh-sweep agent handed the full list
             # of already-known/deferred items carried forward through
             # v3-D180 and told not to re-report any of them, directed at
             # this build's own engine/corpus-compiler/fold-runner packages
             # rather than the admin-panel wire fields ~20 prior nights had
             # already mined — it also independently surfaced (not fixed
             # this run, not independently verified) that
             # `corpus-compiler`'s `connections` table is ALSO absent from
             # the engine's `Corpus` type, but the engine computes
             # connection atoms from the compiled ayah range directly
             # (`atom.ts`/`bridge.ts`), never from that table, so it is
             # plausibly a genuinely-unused build artifact rather than a
             # wiring gap — left for a future sweep to confirm or fix.
             # Session start: fresh container, `make setup` run from
             # scratch; local `HEAD` was found detached at the same commit
             # `origin/main` was already at, on a stale LOCAL `main` branch
             # ref six commits behind (`4be9924` vs. the real tip
             # `0e4d515`, v3-D180) — the recurring "stale local main" trap
             # v3-D77/D91/D127/D138/D159/D167/D170/D172/D174/D175/D176/D177/D178/D179/D180
             # each independently hit, caught before any implementation
             # work via `git fetch` + `git checkout main && git merge
             # --ff-only origin/main`, no work lost or at risk. NOT
             # addressed: every item on v3-D180's own "NOT addressed" list,
             # unchanged. See DECISIONS.md v3-D181.
             # NOTE (v3-D180, 2026-09-05): `OverrideEditor.tsx`'s history list
             # never rendered `QuestionOverride.createdAt` — a required,
             # non-nullable wire field, sent on every row since the override
             # layer shipped, and the actual `(createdAt, id)` precedence key
             # DEFECTS.md#B4 closed (`applyOverrides()`'s own docblock: "the
             # ordering that matters is (createdAt, id)"), not a decorative
             # timestamp. `grep -n "createdAt" components/workbench/
             # OverrideEditor.tsx` showed exactly one hit before this fix — a
             # React `key`, never printed. Same "fetched, typed, required,
             # zero human-visible read surface" shape this same component's
             # own history list has been fixed on twice before, field by
             # field (`editorEmail` at v3-D163, `note` at v3-D171): an admin
             # correcting the same word twice (fix a typo, then later refine
             # the wording) saw two visually-identical lines with no way to
             # tell which correction is currently in effect or how long ago
             # either happened. Fixed, display-only, no server/wire change:
             # the history `<li>` gains `— {new Date(o.createdAt)
             # .toISOString()}` inside an `ltr-island` span, following
             # `QariMode.tsx`'s own established convention for rendering a
             # `createdAt` and `FrontierNavigator.tsx`'s convention for
             # wrapping a machine timestamp in `ltr-island`. RED confirmed
             # directly: `git stash` of `OverrideEditor.tsx` alone (the new
             # test kept, 17 pre-existing cases untouched) failed on two
             # same-field overrides at different `createdAt` values — neither
             # ISO string reached the rendered list; restored
             # byte-identically, 18/18 green. The pre-existing "degrades to
             # an honest placeholder" test's `/— by — — note: —/` regex
             # matched unanchored against the new trailing clause, so it
             # needed no change — proof the fix is additive, not a rewrite of
             # an existing line. `TZ=UTC make test`: 2570 passing (was 2569,
             # +1 — exactly this run's one new `it()` block; apps/web 1313,
             # was 1312; no other suite moved). `check-test-floor.mjs`: OK,
             # 2570 >= floor 1899 (+671 margin, unmoved, same discipline as
             # every prior entry). `TZ=UTC make build`: exit 0, 29 routes
             # (unchanged — edits inside the existing `/workbench` component,
             # no new route). `npm run gates`: all green (boundaries 294
             # files, unchanged count — one existing production file edited
             # plus its one existing test file, no new production file;
             # fonts degraded-but-non-blocking, pre-existing; corpus-
             # morphology and corpus-glyphs unchanged). `npx tsc --noEmit`:
             # clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted before
             # committing, same discipline as every prior entry). No Arabic
             # codepoint (both changed files swept programmatically, in
             # Python, over the Arabic, Arabic Supplement, Arabic Extended-A
             # and both Presentation Forms Unicode blocks — zero matches;
             # every new string is a wire field read or an ISO timestamp
             # derived from a fixture integer, never corpus text). Found by a
             # dedicated fresh-sweep agent handed the full list of already-
             # known/deferred items carried forward through v3-D179 and told
             # not to re-report any of them. Session start: fresh container,
             # `make setup` run from scratch; local `HEAD` was found detached
             # at the same commit `origin/main` was already at, on a stale
             # LOCAL `main` branch ref five commits behind (`4be9924` vs.
             # the real tip `5c3efa1`, v3-D179) — the recurring "stale local
             # main" trap
             # v3-D77/D91/D127/D138/D159/D167/D170/D172/D174/D175/D176/D177/D178/D179
             # each independently hit, caught before any implementation work
             # via `git fetch` + `git checkout main && git merge --ff-only
             # origin/main`, no work lost or at risk. NOT addressed: every
             # item on v3-D179's own "NOT addressed" list, unchanged. See
             # DECISIONS.md v3-D180.
             # NOTE (v3-D179, 2026-09-05): `selection_determinism_check`'s own
             # per-seed evidence (`SelectionCheckReport.divergences`,
             # worker/fold-runner/src/selectionCheck.ts) was silently
             # discarded by v3-D178's own `findingsFor()` — shipped THE
             # PREVIOUS NIGHT — which read `report['findings']`
             # unconditionally, the fold check's shape only.
             # `nightly_check_runs.report` is written by BOTH checks under
             # different keys in the same JSON column; a confirmed
             # `selection_determinism_check` P1 (a reachable, first-class
             # outcome — `selectionCheck.ts:102`) rendered on
             # `/settings/health` with an empty findings list,
             # indistinguishable from "checked, nothing found" — the exact
             # gap v3-D178 believed it had closed for "the two BUILD-PLAN
             # M10 launch-gate primitives." Grep-confirmed: zero references
             # to `divergences` anywhere in the controller before this fix,
             # and every existing P1 test fixture seeded only
             # `fold_determinism_check`. Fixed: `findingsFor()` branches on
             # which check produced the P1; a new `selectionFindings()`
             # reads `report['divergences']` and maps each to
             # `{type: 'selection', seed, traceKey, baseline, replayed}` —
             # no learner id to pseudonymize here, since this check replays
             # a COMMITTED FIXTURE log, never production events
             # (`runSelection()`'s own `report['scope']`); `seed`/`traceKey`
             # are the reproducible evidence a human re-runs to see the
             # divergence again. `foldFindings()` is v3-D178's own logic,
             # unchanged, each finding now tagged `type: 'fold'`.
             # `NightlyWindowFinding` becomes a discriminated union on the
             # client, parsed and rendered per its own `type` — a malformed
             # entry of either shape still degrades the WHOLE list to
             # `null`, same discipline as v3-D178. RED confirmed at all
             # three layers: backend (both PHPUnit cases failed against the
             # unmodified controller — the strengthened fold case on
             # `expected null to be 'fold'`, the new selection case on
             # `expected size 0 to be 2`); frontend (`git stash` of the two
             # source files, tests kept, failed exactly 2 of 21 — the
             # selection round-trip case and the panel's selection-render
             # case; a third new degrade-to-null case passed vacuously
             # against the unfixed parser, which already rejected the
             # unrecognized shape for the wrong reason — expected, and not
             # the RED-carrying case). All three restored byte-identically
             # and reran green. The load-bearing backend case seeds a night
             # where fold is green and ONLY selection is p1 with 2 real
             # divergences, asserting `lastP1.check` itself correctly names
             # `selection_determinism_check` (proving the pre-existing,
             # unmodified per-check severity scan already picks the right
             # check) and that both divergences round-trip verbatim, plus
             # that `"userId"` never appears in the response — no fabricated
             # learner identity invented to fill the pseudonym-shaped gap.
             # `TZ=UTC make test`: 2569 passing (was 2565, +4 — exactly this
             # run's new tests: 1 PHPUnit (a strengthened existing case,
             # +0 net, plus 1 new case) + 2 + 1 vitest; v3/api 356, was 355;
             # apps/web 1312, was 1309; no other suite moved).
             # `check-test-floor.mjs`: OK, 2569 >= floor 1899 (+670 margin,
             # unmoved, same discipline as every prior entry). `TZ=UTC make
             # build`: exit 0, 29 routes (unchanged — edits inside the
             # existing `/settings/health` component's `lib/`+`api/`
             # layers, no new route). `npm run gates`: all green
             # (boundaries 294 files, unchanged count — three existing
             # production files edited plus their three existing test
             # files, no new production file; fonts
             # degraded-but-non-blocking, pre-existing; corpus-morphology
             # and corpus-glyphs unchanged). `npx tsc --noEmit`: clean (one
             # real iteration — the first draft's `isFoldFinding`/
             # `isSelectionFinding` helpers used a `f is
             # NightlyWindowFoldFinding` predicate return type, which `tsc`
             # rejected with TS2677 since neither interface carries an
             # index signature assignable from `Record<string, unknown>`;
             # fixed by widening both to plain `boolean` and letting the
             # caller's own union predicate narrow). No `v1/**`/`v2/**`
             # edit (a stray `v2/tsconfig.tsbuildinfo` build-cache diff
             # reverted before committing, same discipline as every prior
             # entry). No Arabic codepoint (the full diff swept
             # programmatically, in Python, over the Arabic, Arabic
             # Supplement, Arabic Extended-A and both Presentation Forms
             # Unicode blocks — zero matches; every new string is a wire
             # field name/discriminator literal, a fixture seed/trace-key
             # value, or a fixed English caption, never corpus text). Found
             # by a dedicated fresh-sweep agent handed the full list of
             # already-known/deferred items carried forward through v3-D178
             # and told not to re-report any of them — it identified this
             # as the direct, un-fixed sibling half of v3-D178's own change
             # rather than a new area. Session start: fresh container,
             # `make setup` run from scratch; local `HEAD` was found
             # detached at `f9e0d71`, the same commit `origin/main` was
             # already at (a stale LOCAL `main` branch ref one commit
             # behind, at `4be9924`, v3-D174) — the recurring "stale local
             # main" trap
             # v3-D77/D91/D127/D138/D159/D167/D170/D172/D174/D175/D176/D177/D178
             # each independently hit, caught before any implementation
             # work via `git fetch` + `git checkout main && git merge
             # --ff-only origin/main`, no work lost or at risk. NOT
             # addressed: every item on v3-D178's own "NOT addressed" list,
             # unchanged. See DECISIONS.md v3-D179.
             # NOTE (v3-D178, 2026-09-05): `nightly_check_runs.report` — the
             # determinism runner's per-atom evidence, written every night by
             # `DeterminismCheckCommand::record()` since the ledger shipped —
             # was never read by the one admin screen built to end "an
             # operator has to check by hand" (v3-D143's own words):
             # `Admin\NightlyWindowController::index()` returned only
             # `NightlyWindowLedger::status()`, which derives everything from
             # `check`/`night`/`severity` alone and never touches `report` at
             # all (`grep -n "report" api/app/Support/NightlyWindowLedger.php`
             # — zero hits). `App\Mail\DeterminismP1Alert`'s own docblock
             # names the intended read path verbatim — "an operator follows
             # up in the admin console... for the per-atom findings" — but
             # nothing ever built that follow-up, so a confirmed P1 (the
             # single highest-severity event in this system, the one that
             # resets the 7-consecutive-green-nights launch gate) paged with
             # counts only; finding WHICH learner or atom key diverged still
             # meant a raw database query. Fixed narrowly: the ledger itself
             # stays learner-identity-free exactly as documented; the
             # controller separately fetches the ONE `NightlyCheckRun` row
             # that produced `lastP1` and adds a `lastP1Findings` field, each
             # finding's `userId` pseudonymized through the same HMAC every
             # other admin surface uses (`AdminBillingController::toWire()`'s
             # `subjectPseudonym`) — never the raw integer, never truncated,
             # `null` (never a fabricated empty list) when there is no
             # confirmed P1. `lib/admin/nightlyWindow.ts`/`NightlyWindowPanel
             # .tsx` gain the matching parse-and-render, the parse degrading
             # the WHOLE list to `null` on any malformed entry rather than a
             # partial fabrication, same discipline as `frontier.ts`'s
             # `hashIngestedAt` (v3-D176). RED confirmed at all three layers
             # (backend, client lib, panel), each reverted from the fix alone
             # with tests kept, each restored byte-identically and rerun
             # green: 8/8 PHPUnit (was 6, +2), 10/10 lib vitest (was 7, +3),
             # 8/8 panel vitest (was 6, +2). The load-bearing backend case
             # seeds two real findings, asserts the literal substring
             # `"userId"` never appears in the response body, and asserts
             # each `subjectPseudonym` equals the same `Pseudonymizer`
             # instance's own `->for($id)` output for two DIFFERENT ids,
             # proving real per-learner HMAC pseudonymization rather than a
             # constant placeholder. `TZ=UTC make test`: 2565 passing (was
             # 2558, +7 — exactly this run's new tests: 2 PHPUnit + 3 + 2
             # vitest; v3/api 355, was 353; apps/web 1309, was 1304; no other
             # suite moved). `check-test-floor.mjs`: OK, 2565 >= floor 1899
             # (+666 margin, unmoved, same discipline as every prior entry).
             # `TZ=UTC make build`: exit 0, 29 routes (unchanged — edits
             # inside the existing `/settings/health` component's
             # `lib/`+`api/` layers, no new route). `npm run gates`: all
             # green (boundaries 294 files, unchanged count — three existing
             # production files edited plus their three existing test files,
             # no new production file; fonts degraded-but-non-blocking,
             # pre-existing; corpus-morphology and corpus-glyphs unchanged).
             # `npx tsc --noEmit`: clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted before
             # committing, same discipline as every prior entry). No Arabic
             # codepoint (the full diff swept programmatically, in Python,
             # over the Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks — zero matches; every new
             # string is a wire field name, a pseudonym/atom-key/engine-
             # version test fixture value, or a fixed English caption, never
             # corpus text). Found by a dedicated fresh-sweep agent handed
             # the full list of already-known/deferred items carried forward
             # through v3-D177 and told not to re-report any of them,
             # directed at areas admitted as only lightly swept
             # (`corpus-compiler/src`, `fold-runner/src`, Laravel model
             # relations, wire fields fetched-but-unrendered) — it did not
             # surface a second instance of this shape elsewhere. Session
             # start: fresh container, `make setup` run from scratch; local
             # `HEAD` was found detached one commit ahead of a stale local
             # `main` ref (the branch pointer at `4be9924` vs. `origin/main`'s
             # real tip `246c27b`, v3-D177) — the recurring "stale local
             # main" trap
             # v3-D77/D91/D127/D138/D159/D167/D170/D172/D174/D175/D176 each
             # independently hit — caught via `git fetch` + `git checkout
             # main && git merge --ff-only origin/main` before any
             # implementation work, no work lost or at risk. NOT addressed:
             # every item on v3-D177's own "NOT addressed" list, unchanged.
             # See DECISIONS.md v3-D178.
             # NOTE (v3-D177, 2026-09-04): `VerificationRow.contentHash`/
             # `.hashSpecVersion` — required, non-nullable fields on every
             # signature-history row since step 15/v3-D167 — were fetched
             # and typed but never rendered: `QariMode.tsx`'s history
             # `<li>` printed `tier`/`reviewerKind`/`verifiedBy`/
             # `createdAt`/`note` only, so a reviewer could not tell which
             # hash spec version or content hash a PRIOR signature actually
             # certified — material once an override recompute (v3-D174)
             # or a recompile moves the current hash out from under an
             # older row. Named as a real, weaker runner-up in v3-D176's
             # own closing note and left for this run. Fixed, display-only,
             # no server/wire change: the history `<li>` gains `— hash spec
             # v{row.hashSpecVersion} — content hash {row.contentHash}`,
             # both in the existing `ltr-island` class this file already
             # uses for the same kind of value in `SignOutcome`. RED
             # confirmed directly: the pre-existing v3-D167 history test's
             # assertions were strengthened to check for the fixture's
             # already-present `contentHash: "abc"` / `hashSpecVersion: 1`
             # (set at v3-D167, never previously asserted on) and failed
             # genuinely against the unmodified component; restored
             # byte-identically, 12/12 green (unchanged count — a
             # strengthened existing case, not a new one). `TZ=UTC make
             # test`: 2558 passing (unchanged from v3-D176's own count —
             # no new test file or case; apps/web 1304, unchanged; no other
             # suite moved). `check-test-floor.mjs`: OK, 2558 >= floor 1899
             # (+659 margin, unmoved, same discipline as every prior
             # entry). `TZ=UTC make build`: exit 0, 29 routes (unchanged —
             # edits inside the existing `/workbench` component, no new
             # route). `npm run gates`: all green (boundaries 295 files,
             # unchanged count — one existing production file edited plus
             # its one existing test file, no new production file; fonts
             # degraded-but-non-blocking, pre-existing; corpus-morphology
             # and corpus-glyphs unchanged). `npx tsc --noEmit`: clean. No
             # `v1/**`/`v2/**` edit (stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff reverted before committing, same
             # discipline as every prior entry). No Arabic codepoint (both
             # changed files swept programmatically, in Python, over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks — zero matches; every new
             # string is a fixed English label or a wire field read, and
             # the test's hash/version values are the pre-existing
             # synthetic fixture literals, never corpus text). Session
             # start: fresh container, `make setup` run from scratch;
             # local `HEAD` was found detached on a stale cached `main` ref
             # (`4be9924`) one commit behind `origin/main`'s real tip
             # (`51ce9cb`, v3-D176) — the recurring "stale local main" trap
             # v3-D77/D91/D127/D138/D159/D167/D170/D172/D174/D175 each
             # independently hit — caught via `git fetch` + `git checkout
             # main && git merge --ff-only origin/main` before any
             # implementation work, no work lost or at risk. NOT
             # addressed: `GlossDraftsLoad.shipping`/`.excludedFromHashV1`
             # (v3-D173, non-divergent); `FlagRow.ackAt` (v3-D170,
             # weaker); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate`
             # as a whole class (v3-D88, v3-D151); multi-surah enrollment;
             # the operational mailer/7-night window; PAY-1's Stripe
             # fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); the late-arrival refold half of v3-D32;
             # `AccountDeletionRequest::isDue()` (v3-D146);
             # `lib/i18n/dictionaries.ts#isLocale()`; `BillingEventsPanel
             # .tsx`'s single-event detail view (v3-D166);
             # `SystemHealthController::METRICS`'s `atom_cache_coverage`/
             # `events_ingested_24h` (v3-D168) — all unchanged. See
             # DECISIONS.md v3-D177.
             # NOTE (v3-D176, 2026-09-04): `corpus_ayah_hashes.ingested_at`
             # — stamped on every write since step 15 by the table's only
             # writer, `IngestHashesCommand::ingestRows` (shared with
             # `CorpusHashRecomputer` since v3-D174's synchronous
             # override-write recompute) — was never reported anywhere:
             # `VerificationsController::index()`'s per-ayah `frontier`
             # entry carried only `qari`/`admin` tier status, never the
             # timestamp of the row those statuses are computed against.
             # An admin/qari on `/workbench` had no way to tell "this
             # ayah's hash was just recomputed" from "this hash row is
             # stale from before the corpus last changed" — the same
             # "written since the writer shipped, zero read surface"
             # shape this build has closed ~90 times since v3-D82, here on
             # the frontier's own hash-freshness fact rather than a
             # sibling admin audit table. Fixed: `index()` now sets
             # `$status['ingestedAt'] = $hashRow->ingested_at` per ayah
             # (a wire-additive change, no other field moved);
             # `lib/workbench/frontier.ts`'s `FrontierWire`/`FrontierRow`
             # gain a matching `ingestedAt?: number`/`hashIngestedAt:
             # number | null` (a missing or non-numeric value degrades to
             # `null`, never a fabricated timestamp — `buildWorklist`'s
             # own total-degradation discipline, same as every other
             # field it parses); `FrontierNavigator.tsx`'s `Row` renders
             # a new `hash ingested {ISO-8601}` caption beneath the
             # existing note, present only when the value is non-null.
             # RED confirmed at three independent layers, each reverted
             # byte-identically and rerun green: backend (2 new
             # `VerificationsTest` cases against the unmodified
             # controller both failed on `expected null to be 1000`, one
             # proving each ayah reports its OWN row's timestamp, the
             # other proving a re-ingest — an override's recompute —
             # moves it forward, not merely that a static value passes
             # through); `frontier.ts` (2 new cases: the per-ayah
             # timestamp carries through untouched, and a missing/
             # malformed value degrades to `null` rather than `undefined`
             # or a crash); the component (1 new case renders the ISO
             # string, its negative sibling proves the caption is absent
             # — not merely blank — when the server sends nothing, so the
             # positive case cannot be reading a fabricated date).
             # `TZ=UTC make test`: 2558 passing (was 2552, +6 — exactly
             # this run's new tests: 2 PHPUnit + 2 + 2 vitest; v3/api 353,
             # was 351; apps/web 1304, was 1300; no other suite moved).
             # `check-test-floor.mjs`: OK, 2558 >= floor 1899 (+659
             # margin, unmoved, same discipline as every prior entry).
             # `TZ=UTC make build`: exit 0, 29 routes (unchanged — edits
             # inside the existing `/workbench` component's `lib/` layer
             # plus one existing controller, no new route). `npm run
             # gates`: all green (boundaries 295 files, unchanged count —
             # three existing production files edited plus their three
             # existing test files, no new production file; fonts
             # degraded-but-non-blocking, pre-existing; corpus-morphology
             # and corpus-glyphs unchanged). `npx tsc --noEmit`: clean.
             # No `v1/**`/`v2/**` edit (`git status --porcelain -- v1 v2`
             # empty immediately before committing). No Arabic codepoint
             # (the full diff swept programmatically, in Python, over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks — zero matches; every
             # new string is a wire field name, an ISO timestamp derived
             # from a fixture integer, or a fixed English caption, never
             # corpus text). Found by a dedicated fresh-sweep agent handed
             # the full list of already-known/deferred items (the
             # v3-D175 list plus v3-D175 itself) and told not to
             # re-report any of them — it also independently surfaced
             # (not fixed this run, weaker) `VerificationRow.contentHash`/
             # `.hashSpecVersion` in `apps/web/lib/workbench/frontier.ts`,
             # fetched and typed but never rendered in `QariMode.tsx`'s
             # signature-history list — a real instance of the same shape,
             # but an opaque hash string is less actionable to a human
             # than a timestamp, so left for a future run. Session start:
             # fresh container, `make setup` run from scratch; local
             # `main` was found 1 commit behind `origin/main` (on
             # `4be9924` vs. the real tip `8e53020`, v3-D175) — the
             # recurring "stale local main" trap
             # v3-D77/D91/D127/D138/D159/D167/D170/D172/D174 each
             # independently hit — caught via `git fetch` + `git checkout
             # main && git merge --ff-only origin/main` before any
             # implementation work, no work lost or at risk (the only
             # casualty was a `tail`/`grep` on DECISIONS.md run against
             # the stale content before the merge, corrected by re-reading
             # after). NOT addressed: `VerificationRow.contentHash`/
             # `.hashSpecVersion` (above); `GlossDraftsLoad.shipping`/
             # `.excludedFromHashV1` (v3-D173, non-divergent); `FlagRow
             # .ackAt` (v3-D170, weaker); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate`
             # as a whole class (v3-D88, v3-D151); multi-surah enrollment;
             # the operational mailer/7-night window; PAY-1's Stripe
             # fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); the late-arrival refold half of v3-D32;
             # `AccountDeletionRequest::isDue()` (v3-D146);
             # `lib/i18n/dictionaries.ts#isLocale()`; `BillingEventsPanel
             # .tsx`'s single-event detail view (v3-D166);
             # `SystemHealthController::METRICS`'s `atom_cache_coverage`/
             # `events_ingested_24h` (v3-D168) — all unchanged. See
             # DECISIONS.md v3-D176.
             # NOTE (v3-D175, 2026-09-04): `buildDrillPreview`'s own
             # `partialNotice` — this file's own header calls it "the honest
             # up-front explanation of the denominator" — was gated on
             # `skippedAyahCount` alone. `SkipReason`'s own docblock names TWO
             # distinct reasons on purpose ("not-learned" for an ayah,
             # "seam-not-reached" for a seam — "a missing connection atom
             # genuinely is a different thing"), and `skippedSeamCount` was
             # computed and returned since the picker shipped, but nothing
             # ever explained an unreached joint on screen: a learner with
             # every ayah ready but one unreached seam saw a lower joint
             # count than the range implied, with no partialNotice at all —
             # the seam-side sibling of the gap this field exists to close.
             # Fixed in `lib/drill/preview.ts` only (no component change —
             # `DrillSummary` already prints `partialNotice` verbatim):
             # `partialNotice` is now composed of two independent clauses —
             # the pre-existing ayah sentence, byte-identical, and a new
             # singular/plural seam sentence — joined by a space, each null
             # when nothing of that kind is skipped. RED confirmed directly
             # against the unmodified module (`git stash` of the one source
             # file, both new test cases kept, 15 pre-existing cases
             # untouched): a range with every ayah encoded but one seam's
             # connection atom deliberately absent failed on `expected null
             # to be "1 joint hasn't been reached yet, so it's skipped
             # too."`; a second case (3 skipped ayat AND 2 skipped seams on
             # the same page fixture the pre-existing ayah-only test uses)
             # failed on the combined string missing its seam sentence.
             # Restored byte-identically, 17/17 green (was 15, +2). `TZ=UTC
             # make test`: 2552 passing (was 2550, +2 — exactly this run's
             # new tests; apps/web 1300, was 1298; no other suite moved).
             # `check-test-floor.mjs`: OK, 2552 >= floor 1899 (+653 margin,
             # unmoved). `TZ=UTC make build`: exit 0, 29 routes (unchanged —
             # fix lives entirely in the existing `/drill` component's
             # `lib/` layer, no new route). `npm run gates`: all green
             # (boundaries 295 files checked — one existing production
             # file edited plus its one existing test file, no new
             # production file, confirmed via `git status`; fonts
             # degraded-but-non-blocking, pre-existing; corpus-morphology
             # and corpus-glyphs unchanged).
             # `npx tsc --noEmit`: clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted before
             # committing, same discipline as every prior entry). No Arabic
             # codepoint (the diff swept programmatically, in Python, over
             # the Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks — zero matches; every new
             # string is a fixed English sentence about a joint count, never
             # corpus text). Picked up from v3-D174's own "NOT addressed"
             # list, which named this exact gap and deliberately left it as
             # "a lower-consequence 'why did the joint count drop' UX gap,
             # not a verification-integrity gap." Session start: fresh
             # container, `make setup` run from scratch; local `main` was
             # found at `4be9924`, the same commit `origin/main` was already
             # at — the recurring "stale local main" trap
             # v3-D77/D91/D127/D138/D159/D167/D170/D172/D174 each
             # independently hit was checked for directly and did not recur
             # this run. NOT addressed:
             # `GlossDraftsLoad.shipping`/`.excludedFromHashV1` (v3-D173);
             # `FlagRow.ackAt` (v3-D170); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate`
             # as a whole class (v3-D88, v3-D151); multi-surah enrollment;
             # the operational mailer/7-night window; PAY-1's Stripe
             # fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); the late-arrival refold half of v3-D32;
             # `AccountDeletionRequest::isDue()` (v3-D146);
             # `lib/i18n/dictionaries.ts#isLocale()`; `BillingEventsPanel
             # .tsx`'s single-event detail view (v3-D166);
             # `SystemHealthController::METRICS`'s `atom_cache_coverage`/
             # `events_ingested_24h` (v3-D168) — all unchanged. See
             # DECISIONS.md v3-D175.
             # NOTE (v3-D174, 2026-09-04): `CorpusHashRecomputer`'s own
             # recompute verdict (`{ok:bool, rows?:int, error?:string}`,
             # returned unconditionally by `OverridesController::store()` on
             # every write since v3-D81) was fetched nowhere: `write.ts
             # #submitOverride` read only `body.override`, so `OverrideEditor
             # .tsx`'s four success messages ("gloss corrected", "disabled",
             # "distractors replaced", "words grouped") printed the same
             # string whether or not the surah's tiered verification hash
             # actually recomputed. An admin correcting content on a
             # not-yet-compiled surah could not tell their write from a
             # genuinely-recomputed one — a previously-`verified` ayah could
             # keep reading `verified` on the workbench frontier instead of
             # `stale`, DEFECTS.md#B3's own failure mode, re-opened silently
             # on the one client that writes overrides. Fixed:
             # `SubmitOverrideResult`'s `"created"` variant gains a required
             # `hashRecompute: HashRecomputeOutcome`, parsed from the
             # response (a missing/malformed field degrades to a reported
             # failure, never a silent `ok:true`); `OverrideEditor.tsx`
             # appends a `hashRecomputeWarning()` suffix to each success
             # message when `ok` is false, naming the server's own reported
             # reason, never replacing the success message (the write did
             # succeed). RED confirmed at both layers independently: three
             # new `write.test.ts` cases against the unmodified module
             # failed exactly as predicted (a discarded verdict, a crash on
             # `undefined.ok` for both a failed and a missing verdict);
             # implemented, 15/15 green (was 12). A new component test
             # posting `hashRecompute:{ok:false,error:"surah 12 has never
             # been compiled"}` failed on `expected 'gloss corrected' to
             # match /did not recompute/i` against the unmodified component
             # — the plain string, no warning; implemented, 17/17 green (was
             # 15, +2: the warning case and its negative sibling, proving a
             # SUCCESSFUL recompute paints no warning — the signal is real,
             # not permanent noise). `TZ=UTC make test`: 2550 passing (was
             # 2545, +5 — exactly this run's new tests: 3 + 2; apps/web
             # 1298, was 1293; no other suite moved). `check-test-floor.mjs`:
             # OK, 2550 >= floor 1899 (+651 margin, unmoved). `TZ=UTC make
             # build`: exit 0, 29 routes (unchanged — edits inside the
             # existing `/workbench` component, no new route). `npm run
             # gates`: all green (boundaries 295 files, unchanged count —
             # two existing production files edited plus their two existing
             # test files, no new production file; fonts
             # degraded-but-non-blocking, pre-existing; corpus-morphology
             # and corpus-glyphs unchanged). `npx tsc --noEmit`: clean. No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff reverted before committing, same discipline
             # as every prior entry). No Arabic codepoint (the full diff
             # swept programmatically, in Python, over the Arabic, Arabic
             # Supplement, Arabic Extended-A and both Presentation Forms
             # Unicode blocks — zero matches; every new string is a fixed
             # English label, a wire field name, or a synthetic test
             # fixture placeholder, never corpus text). Found by a dedicated
             # fresh-sweep agent handed the full list of already-
             # known/deferred items and told not to re-report them — it
             # also independently surfaced (not fixed this run)
             # `lib/drill/preview.ts#skipReason`/`skippedSeamCount` in
             # `DrillPicker.tsx` (a lower-consequence "why did the joint
             # count drop" UX gap, not a verification-integrity gap).
             # Session start: fresh container, `make setup` run from
             # scratch; local `main` was found detached at `e338e71`, the
             # same commit `origin/main` was already at — the recurring
             # "stale local main" trap named since v3-D77 was checked for
             # directly and did not recur. NOT addressed:
             # `lib/drill/preview.ts#skipReason`/`skippedSeamCount` (above);
             # `GlossDraftsLoad.shipping`/`.excludedFromHashV1`
             # (v3-D173); `FlagRow.ackAt` (v3-D170); `rhymeClassOf()`
             # (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution`
             # (v3-D148); `lib/pricing.ts#regionFromCountry()` (v3-D163);
             # `PaywallGate` as a whole class (v3-D88, v3-D151); multi-surah
             # enrollment; the operational mailer/7-night window; PAY-1's
             # Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); the late-arrival refold half of v3-D32;
             # `AccountDeletionRequest::isDue()` (v3-D146);
             # `lib/i18n/dictionaries.ts#isLocale()`; `BillingEventsPanel
             # .tsx`'s single-event detail view (v3-D166);
             # `SystemHealthController::METRICS`'s `atom_cache_coverage`/
             # `events_ingested_24h` (v3-D168) — all unchanged. See
             # DECISIONS.md v3-D174.
             # NOTE (v3-D173, 2026-09-03): `BillingEventEntry.provider` —
             # a genuinely dynamic field (`WebhookHandler::ingest(array
             # $event, string $provider = 'stripe')` takes it as a real
             # parameter, not a hardcoded literal — was fetched, typed and
             # required by `lib/admin/billingEvents.ts#isBillingEventEntry`
             # since the panel shipped (v3-D148), and never once rendered:
             # `grep -n "e\." BillingEventsPanel.tsx` showed 8 columns, none
             # of them `.provider`, contradicting the panel's own header
             # claim "EVERY FIELD IS RENDERED VERBATIM" — the same false
             # claim v3-D164/D165/D166/D168 each already fixed on sibling
             # audit panels, here on a field two prior passes over this
             # SAME panel (v3-D166) left standing. Fixed, display-only, no
             # server/wire change: one new "Provider" column rendering
             # `e.provider` verbatim (a required non-nullable string, no
             # fallback needed). RED confirmed directly against the
             # unmodified component (`git stash` of `BillingEventsPanel.tsx`
             # alone, the new test case kept, 8 pre-existing cases
             # untouched): a `provider: "curlec"` fixture (BUILD-PLAN Q7's
             # own named second-provider candidate, not an invented string)
             # failed on `screen.getByText("curlec")` — no such text
             # anywhere in the rendered table; restored byte-identically,
             # 9/9 green. `TZ=UTC make test`: 2545 passing (was 2544, +1 —
             # exactly this run's one new `it()` block; apps/web 1293, was
             # 1292; no other suite moved). `check-test-floor.mjs`: OK, 2545
             # >= floor 1899 (+646 margin, unmoved). `TZ=UTC make build`:
             # exit 0, 29 routes (unchanged — edits inside the existing
             # `/settings/billing` component, no new route). `npm run
             # gates`: all green (boundaries unchanged count — one existing
             # production file edited plus its one existing test file, no
             # new production file; fonts degraded-but-non-blocking,
             # pre-existing; corpus-morphology/corpus-glyphs unchanged).
             # `npx tsc --noEmit`: clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted before
             # committing, same discipline as every prior entry). No Arabic
             # codepoint (both changed files swept programmatically over
             # the Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks — zero matches; every new
             # string is a fixed English column header or a synthetic
             # provider-name test fixture, never corpus text). Found by a
             # dedicated fresh-sweep agent handed the full list of already-
             # known/deferred items and told not to re-report them,
             # grep-verified independently before implementing — it also
             # independently surfaced (not fixed this run)
             # `GlossDraftsLoad.shipping`/`.excludedFromHashV1` in
             # `GlossDraftsPanel.tsx`, replaced by static hand-authored
             # prose instead of the live fields — real, but currently
             # non-divergent (`shipping` is always `false` server-side and
             # the panel hardcodes one language today), so left for a
             # future run. Session start: fresh container, `make setup` run
             # from scratch; local `main` was found 13 commits behind
             # `origin/main` (detached `HEAD` at `68bf199` vs. the real tip
             # `96b0ae6`, v3-D172) — the recurring "stale local main" trap
             # v3-D77/D91/D127/D138/D159/D167/D170/D172 each independently
             # hit — caught via `git fetch` + `git checkout main && git
             # merge --ff-only origin/main` before any exploration, no work
             # lost or at risk. NOT addressed:
             # `GlossDraftsLoad.shipping`/`.excludedFromHashV1` (above);
             # `FlagRow.ackAt` in `FlagsPanel.tsx` (v3-D170, weaker);
             # `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution`
             # (v3-D148); `lib/pricing.ts#regionFromCountry()` (v3-D163);
             # `PaywallGate` as a whole class (v3-D88, v3-D151); multi-surah
             # enrollment; the operational mailer/7-night window; PAY-1's
             # Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); the late-arrival refold half of v3-D32;
             # `AccountDeletionRequest::isDue()` (v3-D146);
             # `lib/i18n/dictionaries.ts#isLocale()`;
             # `SystemHealthController::METRICS`'s `atom_cache_coverage`/
             # `events_ingested_24h` (v3-D168) — all unchanged. See
             # DECISIONS.md v3-D173.
             # NOTE (v3-D172, 2026-09-03): `StripeSettingsController::test()`'s
             # own `livemode` — Stripe's authoritative answer to "is this
             # live?", named in the controller's own comment as beating a
             # guess from the key prefix "because the two disagreeing is
             # worth knowing" — was fetched and typed
             # (`StripeSettingsPanel.tsx`'s own `ProbeResult.livemode`)
             # since the probe shipped and never once compared against
             # anything: `grep -n "probe\." StripeSettingsPanel.tsx` showed
             # exactly one read, `probe.message`. The CONNECTION section's
             # own "Mode: {data.mode}" line is a SEPARATE, prefix-derived
             # guess computed at `index()` time — a swapped test/live
             # secret with a correct-looking prefix could disagree with
             # Stripe's own report and nothing on screen said so, on the
             # one console screen that touches live payment credentials.
             # Same "written/fetched, zero read surface" shape this build
             # has closed repeatedly (v3-D164..D171), found this run by a
             # dedicated fresh-sweep agent handed the full list of already-
             # known/deferred items and told not to re-report them,
             # grep-verified independently before implementing. Fixed,
             # display-only, no server/wire change: the CONNECTION section
             # gains one new `banner banner--warn`/`role="alert"` (matching
             # this codebase's own established convention —
             # `SystemHealthPanel.tsx`, `ContentFreezePanel.tsx`,
             # `AccountDeletionPanel.tsx`, and this panel's own pre-existing
             # `mixedModes` banner), rendered only when a successful probe's
             # `livemode` genuinely disagrees with the configured
             # `data.mode`; silent when they agree, unknown, or unprobed.
             # RED confirmed directly against the unmodified component
             # (`git stash` of `StripeSettingsPanel.tsx` alone, both new
             # `stripe-settings-panel.test.tsx` cases kept, the file's two
             # pre-existing path-prefix cases untouched): a probe with
             # `livemode: true` against a `mode: "test"` fixture failed on
             # `screen.findByRole("alert")` timing out, exactly as
             # predicted; restored byte-identically, 4/4 green. A second
             # case proves the negative — `mode: "live"` (agreement)
             # asserts `screen.queryByRole("alert")` is `null` — so the fix
             # cannot be a banner that always paints once a probe succeeds;
             # it must actually compare. `TZ=UTC make test`: 2544 passing
             # (was 2542, +2 — exactly this run's two new `it()` blocks;
             # apps/web 1292, was 1290; no other suite moved). `check-test-
             # floor.mjs`: OK, 2544 >= floor 1899 (+645 margin, unmoved).
             # `TZ=UTC make build`: exit 0, 29 routes (unchanged — edits
             # inside the existing `/settings/stripe` component, no new
             # route). `npm run gates`: all green (boundaries 295 files,
             # unchanged count — one existing production file edited plus
             # its one existing test file, no new production file; fonts
             # degraded-but-non-blocking, pre-existing; corpus-morphology
             # and corpus-glyphs unchanged). `npx tsc --noEmit` (via `npm
             # run typecheck`): clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted before
             # committing, same discipline as every prior entry). No Arabic
             # codepoint (both changed files swept programmatically, in
             # Python, over the Arabic, Arabic Supplement, Arabic
             # Extended-A and both Presentation Forms Unicode blocks — zero
             # matches; every new string is a fixed English label or a
             # synthetic test fixture placeholder, never corpus text).
             # Session start: fresh container, `make setup` run from
             # scratch (no `node_modules`/`vendor` anywhere); local `main`
             # was found 12 commits behind `origin/main` (detached `HEAD`
             # at `68bf199` vs. the real tip `34b76b0`, v3-D171) — the
             # recurring "stale local main" trap
             # v3-D77/D91/D127/D138/D159/D167/D170 each independently hit
             # — caught via `git fetch` + `git checkout main && git merge
             # --ff-only origin/main` before any exploration, no work lost
             # or at risk. NOT addressed: `FlagRow.ackAt` in
             # `FlagsPanel.tsx` (v3-D170, weaker); `rhymeClassOf()`
             # (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution`
             # (v3-D148); `lib/pricing.ts#regionFromCountry()` (v3-D163);
             # `PaywallGate` as a whole class (v3-D88, v3-D151);
             # multi-surah enrollment; the operational mailer/7-night
             # window; PAY-1's Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); the late-arrival refold half of v3-D32;
             # `AccountDeletionRequest::isDue()` (v3-D146);
             # `lib/i18n/dictionaries.ts#isLocale()`; `BillingEventsPanel
             # .tsx`'s single-event detail view (v3-D166);
             # `SystemHealthController::METRICS`'s
             # `atom_cache_coverage`/`events_ingested_24h` (v3-D168) — all
             # unchanged. See DECISIONS.md v3-D172.
             # NOTE (v3-D171, 2026-09-03): `QuestionOverride.note` — an
             # admin's own reasoning for a correction, captured by
             # `OverrideEditor.tsx`'s own four "Note (optional)" form fields
             # (gloss/disable/distractor/group), persisted, and sent on the
             # wire on every row (`OverridesController::toWire()`'s own
             # `'note' => $r->note`) — was never rendered in the panel's own
             # override-history list. `summarize(o)` reported WHAT changed
             # and `editorEmail` (v3-D163) reported WHO changed it, but WHY
             # was invisible. Same "written, wire-carried, zero read
             # surface" shape v3-D169/D170 just closed on the sibling
             # `GlossDraftsPanel.tsx` — here one workbench panel over, and
             # not a new finding: v3-D170's own sweep named this exact gap
             # ("self-named open since v3-D163") and left it; six decisions
             # (v3-D164..D170) repeated it on their own "NOT addressed"
             # lists without fixing it. Fixed, display-only, no server/wire
             # change: the existing history line gains `— note: {o.note ??
             # "—"}`, appended after the existing `— by {editorEmail ??
             # "—"}` clause — the panel's own established fallback
             # convention, never a fabricated reason. RED confirmed
             # directly against the unmodified component (13 pre-existing
             # cases in `test/workbench-override-editor.test.tsx`
             # untouched): the pre-existing "degrades to an honest
             # placeholder when no editor email is known" test's assertion
             # was strengthened from `/— by —/` to `/— by — — note: —/`
             # (both `editorEmail` and `note` are already null in that
             # fixture) and failed as predicted before the change; a new
             # dedicated case rendering a non-null note failed on
             # `getElementError` (no such node). Implemented, reran: 15/15
             # green (was 13). `TZ=UTC make test`: 2542 passing (was 2541,
             # +1 — exactly this run's one net-new `it()` block; the
             # em-dash strengthening was added to an EXISTING test, so it
             # carries no separate count; apps/web 1290, was 1289; no other
             # suite moved). `check-test-floor.mjs`: OK, 2542 >= floor 1899
             # (+643 margin, unmoved). `TZ=UTC make build`: exit 0, 29
             # routes (unchanged — edits inside the existing `/workbench`
             # component, no new route). `npm run gates`: all green
             # (boundaries 294 files, unchanged count — one existing
             # production file edited plus its one existing test file, no
             # new production file; fonts degraded-but-non-blocking,
             # pre-existing; corpus-morphology and corpus-glyphs
             # unchanged). `npx tsc --noEmit`: clean. Session start: local
             # `main` was found two commits behind `origin/main` (`68bf199`
             # vs the real tip `e0fc4d6`, v3-D170) — the recurring "stale
             # local main" trap v3-D77/D91/D127/D138/D159/D167 each
             # independently hit — caught via `git fetch` + `git checkout
             # main && git merge --ff-only origin/main` before any
             # exploration, no work lost or at risk. No `v1/**`/`v2/**`
             # edit (stray `v2/tsconfig.tsbuildinfo` reverted before
             # committing, same discipline as every prior entry). No
             # Arabic codepoint (both changed files swept programmatically
             # over the Arabic, Arabic Supplement, Arabic Extended-A and
             # both Presentation Forms Unicode blocks — zero matches; every
             # new string is a fixed English label or a plain English
             # placeholder note, never corpus text). NOT addressed:
             # `FlagRow.ackAt` in `FlagsPanel.tsx` (v3-D170, weaker —
             # redundant with `FlagAuditPanel.tsx`); `rhymeClassOf()`
             # (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution`
             # (v3-D148); `lib/pricing.ts#regionFromCountry()` (v3-D163);
             # `PaywallGate` as a whole class (v3-D88, v3-D151);
             # multi-surah enrollment; the operational mailer/7-night
             # window; PAY-1's Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); the late-arrival refold half of
             # v3-D32; `AccountDeletionRequest::isDue()` (v3-D146);
             # `lib/i18n/dictionaries.ts#isLocale()`;
             # `BillingEventsPanel.tsx`'s single-event detail view
             # (v3-D166); `SystemHealthController::METRICS`'s
             # `atom_cache_coverage`/`events_ingested_24h` (v3-D168) — all
             # unchanged. See DECISIONS.md v3-D171.
             # NOTE (v3-D170, 2026-09-03): `GlossDraftRow.note` — the
             # author's own note, captured by `GlossDraftsPanel.tsx`'s own
             # "Note (optional)" form field at draft time, persisted
             # (`gloss_drafts.note`), and sent on the wire on every row
             # (`GlossDraftsController.php:317`) — was never rendered
             # anywhere in the table. Only a REVIEW's own note (one layer
             # down, inside the History `<details>`, wired at v3-D156/D160)
             # was shown; the draft's own current note — where an author
             # flags e.g. "checked against Basmeih, unsure of register"
             # BEFORE a reviewer decides "Mark reviewed" — was invisible.
             # Same "written, wire-carried, zero read surface" shape this
             # build has closed on this SAME `GlossDraftsPanel.tsx` twice
             # already (`authorKind`/`authoredBy` at v3-D169, `textAtReview`
             # at v3-D160), one field over each time. Found by a fresh
             # Explore-agent sweep directed away from every already-known
             # instance of this bug class; the sweep also independently
             # surfaced (not fixed this run): `QuestionOverride.note` never
             # rendered in `OverrideEditor.tsx`'s history list (self-named
             # open since v3-D163); `FlagRow.ackAt` never rendered on
             # `FlagsPanel.tsx`'s own row (weaker — redundant with
             # `FlagAuditPanel.tsx`). Fixed, display-only, no server/wire
             # change: one new "Note" column between "Authored by" and
             # "Reviewed by", rendering `row.note ?? "—"` — the panel's own
             # existing null-fallback convention. RED confirmed directly
             # against the unmodified component (11 pre-existing cases in
             # `test/gloss-drafts-panel.test.tsx` untouched): a strengthened
             # assertion on the existing READY-state test
             # (`getAllByText("—")` expected to double from 1 to 2, since
             # DRAFT_ROW's own `note` is null) failed at 1; a new dedicated
             # case rendering a non-null note failed on `getElementError`
             # (no such node). Implemented, reran: 13/13 green (was 11).
             # `TZ=UTC make test`: 2541 passing (was 2540, +1 — exactly this
             # run's one net-new `it()` block; the em-dash-count assertion
             # was added to an EXISTING test, so it carries no separate
             # count; apps/web 1289, was 1288; no other suite moved).
             # `check-test-floor.mjs`: OK, 2541 >= floor 1899 (+642 margin,
             # unmoved). `TZ=UTC make build`: exit 0, 29 routes (unchanged —
             # edits inside the existing `/settings/gloss-drafts` component,
             # no new route). `npm run gates`: all green (boundaries 295
             # files, unchanged count — one existing production file edited
             # plus its one existing test file, no new production file;
             # fonts degraded-but-non-blocking, pre-existing; corpus-
             # morphology and corpus-glyphs unchanged). `npx tsc --noEmit`:
             # clean. Session start: fresh container, `make setup` run from
             # scratch; local `main` was found one branch-checkout away from
             # a stale ref (`68bf199`, v3-D159) versus `origin/main`'s real
             # tip (`f4197b5`, v3-D169) — the recurring "stale local main"
             # trap v3-D77/D91/D127/D138/D159/D167 each independently hit —
             # caught before any exploration via `git fetch` + `git checkout
             # main && git merge --ff-only origin/main`, no work lost or at
             # risk. No `v1/**`/`v2/**` edit (stray `v2/tsconfig.tsbuildinfo`
             # reverted before committing, same discipline as every prior
             # entry). No Arabic codepoint (the diff swept programmatically
             # over the Arabic, Arabic Supplement, Arabic Extended-A and
             # both Presentation Forms Unicode blocks, plus a `\u06xx`/
             # `\u08xx`-escape and `fromCharCode` sweep — zero matches;
             # every new string is a fixed English column header or a plain
             # English placeholder note, matching this file's own "NO MALAY
             # CONTENT ANYWHERE" header). NOT addressed:
             # `QuestionOverride.note` in `OverrideEditor.tsx`;
             # `FlagRow.ackAt` in `FlagsPanel.tsx`; `rhymeClassOf()`
             # (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution`
             # (v3-D148); `lib/pricing.ts#regionFromCountry()` (v3-D163);
             # `PaywallGate` as a whole class (v3-D88, v3-D151); multi-surah
             # enrollment; the operational mailer/7-night window; PAY-1's
             # Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); the late-arrival refold half of v3-D32;
             # `AccountDeletionRequest::isDue()` (v3-D146);
             # `lib/i18n/dictionaries.ts#isLocale()`; `BillingEventsPanel
             # .tsx`'s single-event detail view (v3-D166);
             # `SystemHealthController::METRICS`'s `atom_cache_coverage`/
             # `events_ingested_24h` (v3-D168) — all unchanged. See
             # DECISIONS.md v3-D170.
             # NOTE (v3-D169, 2026-09-02): `GlossDraftsPanel.tsx` fetched and
             # typed `authorKind`/`authoredBy` (`lib/admin/glossDrafts.ts
             # #GlossDraftRow`, required by `isGlossDraftRow()`'s own runtime
             # check) since the gloss-draft workflow shipped (v3-D145) —
             # `GlossDraftsController::toWire()` sends both on every row,
             # backed by real `author_kind`/`authored_by` columns
             # (`gloss_drafts` migration, `store()` sets both from the admin's
             # form input) — but the one screen that lists an ayah's drafts
             # never rendered either: six columns (Pos/Status/Text/Reviewed
             # by/History/Action), no seventh naming who — or what — wrote the
             # draft. Same "written, wire-carried, zero read surface" shape
             # this build has closed repeatedly on sibling review-workflow
             # surfaces (`Override::editor()` v3-D163, `gloss_draft_reviews`'
             # own history v3-D156/D160, `ayah_verifications`' per-row history
             # v3-D167) — here on the SAME `GlossDraftsPanel.tsx` those
             # entries already touched, one field over. Sharper consequence
             # than most instances of this class: the panel's own "Author"
             # form field exists precisely so a reviewer can later tell an
             # AI-drafted gloss from a human-authored one — v3-D15/D20's "LLM
             # MS... human review mandatory before `reviewed`" depends on
             # knowing which drafts came from an LLM batch — and a reviewer
             # could see WHO reviewed a draft but never who (or what) wrote it
             # in the first place. Fixed, display-only, no server/wire change:
             # one new "Authored by" column rendering `` `${authorKind ===
             # "ai" ? "AI draft" : "human"} · ${authoredBy ?? "—"}` `` — "—"
             # only for a null `authoredBy`, never a fabricated name, matching
             # the panel's existing "—" convention for `reviewedBy` exactly.
             # RED confirmed directly: reverting the component alone (both new
             # test cases kept — one assertion added to the existing
             # READY-state test, one new dedicated case for an AI-authored
             # row with a null `authoredBy`) failed exactly 2 of 12 in
             # `gloss-drafts-panel.test.tsx`, 10 pre-existing cases unaffected;
             # restored byte-identically, 12/12 green. The negative case
             # proves the null-author fallback is real (`AI draft · —` renders
             # and the human-author string does not) rather than merely
             # proving the happy path. `TZ=UTC make test`: 2540 passing (was
             # 2539, +1 — exactly this run's one net-new `it()` block; apps/web
             # 1288, was 1287; no other suite moved). `check-test-floor.mjs`:
             # OK, 2540 >= floor 1899 (+641 margin, unmoved). `TZ=UTC make
             # build`: exit 0, 29 routes (unchanged — edits inside the
             # existing `/settings/gloss-drafts` component). `npm run gates`:
             # all green (boundaries 295 files, unchanged count — one
             # existing production file edited plus its one existing test
             # file, no new production file; fonts degraded-but-non-blocking,
             # pre-existing). `npx tsc --noEmit`: clean. No `v1/**`/`v2/**`
             # edit (stray `v2/tsconfig.tsbuildinfo` reverted before
             # committing, same discipline as every prior entry). No Arabic
             # codepoint (the diff swept programmatically over the Arabic,
             # Arabic Supplement, Arabic Extended-A and both Presentation
             # Forms Unicode blocks, plus a `\u06xx`/`\u08xx`-escape and
             # `fromCharCode` sweep — zero matches; every new string is a
             # fixed English column header, the literal words "AI
             # draft"/"human"/"—", or the pre-existing fixture's synthetic
             # "admin@example.com" placeholder, never corpus or gloss
             # content). NOT addressed: `SystemHealthController::METRICS`'s
             # `atom_cache_coverage`/`events_ingested_24h` (v3-D168, a known,
             # reasoned omission); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate`
             # as a whole class (v3-D88, v3-D151); multi-surah enrollment;
             # the operational mailer/7-night window; PAY-1's Stripe
             # fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); the late-arrival refold half of v3-D32;
             # `AccountDeletionRequest::isDue()` (v3-D146);
             # `lib/i18n/dictionaries.ts#isLocale()`; `BillingEventsPanel
             # .tsx`'s single-event detail view (v3-D166) — all unchanged.
             # See DECISIONS.md v3-D169.
             # NOTE (v3-D168, 2026-09-02): `BillingAuditPanel.tsx`'s own
             # "EVERY FIELD IS RENDERED VERBATIM" header claim was false for
             # `providerEventId` — fetched, typed and validated
             # (`lib/admin/billingAudit.ts#BillingAuditEntry`) since
             # `AdminBillingController::index()` first put it on the wire
             # (v3-D147/D148 era), a genuine non-synthetic column
             # (`entitlement_transitions.provider_event_id`, written by
             # `EntitlementMachine::apply()` on every webhook-caused
             # transition), but never rendered by the one panel that exists
             # to show this history: the table had exactly 7 columns (When/
             # Learner/From/To/Cause/Actor/Reason), no eighth. Same
             # "docblock claims X, grep proves Y" / "fetched, typed, zero
             # read surface" shape this build has closed on sibling audit
             # panels (admin_audit's ip/requestId at v3-D164, the flag-kill
             # ceremony's booleans at v3-D165, BillingEventsPanel's own
             # providerCreatedAt/processedAt at v3-D166 — a DIFFERENT panel
             # reading billing_events, not entitlement_transitions —
             # ayah_verifications' own history at v3-D167) — here on the one
             # sibling panel none of those five touched. An operator
             # reconciling a webhook-caused entitlement flip against
             # Stripe's own dashboard had no way to find the specific event
             # that caused it, only the literal string "webhook". Fixed,
             # display-only, no server/wire change: one new "Provider event"
             # column between Cause and Actor, rendering `e.providerEventId
             # ?? "—"` — "—" for every non-webhook cause (trial_start,
             # admin_override, reconcile), matching this table's own
             # existing "—" convention for fromState/reason exactly. RED
             # confirmed directly: a new `screen.getByText("evt_1")`
             # assertion added to the pre-existing READY-state test (whose
             # own fixture already carried `providerEventId: "evt_1"` on the
             # webhook row, set at v3-D147/D148 and never previously
             # asserted on) failed against the unmodified component exactly
             # as predicted — the rendered DOM's row ran When→Learner→From→
             # To→Cause→Actor→Reason with no eighth cell; the same test's
             # em-dash count (previously 3) was updated to 4 in the same
             # edit, since trial-start's own `providerEventId` is also null
             # and the new column adds one more "—" cell. Implemented,
             # reran: 9/9 green, unchanged file count (no new `it()` block —
             # the RED was carried entirely by strengthening an existing
             # test's assertions, so the apps/web test count is +0 net).
             # `TZ=UTC make test`: 2539 passing (unchanged from v3-D167's own
             # count — no new test file or case; apps/web 1287, unchanged;
             # no suite moved). `check-test-floor.mjs`: OK, 2539 >= floor
             # 1899 (+640 margin, unmoved). `TZ=UTC make build`: exit 0, 29
             # routes (unchanged — edits inside the existing
             # `/settings/billing` component). `npm run gates`: all green
             # (boundaries 295 files, unchanged count — one existing
             # production file edited plus its one existing test file, no
             # new production file; fonts degraded-but-non-blocking,
             # pre-existing). `npx tsc --noEmit`: clean. No `v1/**`/`v2/**`
             # edit (stray `v2/tsconfig.tsbuildinfo` reverted before
             # committing, same discipline as every prior entry). No Arabic
             # codepoint (the diff swept programmatically over the Arabic,
             # Arabic Supplement, Arabic Extended-A and both Presentation
             # Forms Unicode blocks — zero matches; the only new string is a
             # fixed English column header, and the rendered values are
             # either the pre-existing fixture's synthetic "evt_1"
             # placeholder or the table's own existing "—" fallback, never
             # corpus text). Session start: this run began on a detached
             # HEAD one commit ahead of a stale local `main` — a leftover
             # from the PRIOR session's own v3-D167 recovery, not a fresh
             # trap — and `git fetch origin main` showed `origin/main`
             # already at that same tip (the prior session's push had
             # landed cleanly), so `git checkout main && git merge
             # --ff-only origin/main` fast-forwarded safely; the "stale
             # local main" shape v3-D77/D91/D127/D138/D159/D167 each
             # independently hit was checked for directly and did not
             # recur. NOT addressed: `SystemHealthController::METRICS`
             # declaring `atom_cache_coverage`/`events_ingested_24h` as
             # registered members `index()` never computes is already
             # self-documented as a deliberate, reasoned omission in
             # `SystemHealthPanel.tsx`'s own header, not a new finding;
             # `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution`
             # (v3-D148); `lib/pricing.ts#regionFromCountry()` (v3-D163);
             # `PaywallGate` as a whole class (v3-D88, v3-D151); multi-surah
             # enrollment; the operational mailer/7-night window; PAY-1's
             # Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); the late-arrival refold half of v3-D32;
             # `AccountDeletionRequest::isDue()` (v3-D146);
             # `lib/i18n/dictionaries.ts#isLocale()`; `BillingEventsPanel
             # .tsx`'s single-event detail view (v3-D166) — all unchanged.
             # See DECISIONS.md v3-D168.
             # NOTE (v3-D167, 2026-09-02): `/workbench`'s per-ayah verification
             # history (`ayah_verifications.verified_by`/`.note`/`.created_at`,
             # sent whole on `VerificationsController::index()`'s
             # `verifications` field since step 15) was fetched and typed
             # client-side (`lib/workbench/frontier.ts#VerificationRow`) and,
             # since v3-D152, reduced to ONE aggregate boolean via
             # `describeCertification()` — but no single row ever reached a
             # screen. An admin/qari opening an ayah saw today's chip and, for
             # a few seconds after their OWN submission, that one outcome —
             # never who signed a PRIOR verification, when, or their review
             # note. Same "written/fetched, zero read surface" shape closed
             # six times before on other tables (admin_audit, flag_ramp_audit,
             # entitlement_transitions, purge_ledger, gloss_draft_reviews,
             # billing_events) — here on `ayah_verifications` itself, GATE-A's
             # own launch-blocking table. Fixed, display-only, no server/wire
             # change: `verifications.ts#FrontierLoad`'s `ready` state gains a
             # `verifications: readonly VerificationRow[]` field (the same
             # array `certification` is already computed from);
             # `WorkbenchIsland.tsx` filters it to the open ayah and passes it
             # to `QariMode.tsx` as a new optional `history` prop, rendered as
             # a "Signature history for this ayah" list (tier, reviewer kind,
             # `verifiedBy ?? "—"`, `new Date(createdAt).toISOString()`, the
             # note when present) above the signing form. RED confirmed
             # directly: `git stash` of the three source files (every test
             # kept, plus nine pre-existing `FrontierNavigator`-only test
             # literals in `workbench-ui.test.tsx` that needed a
             # `verifications: []` field to satisfy the newly-required type)
             # failed exactly the 7 new cases — 2 in `loadFrontier` (the raw
             # array is carried through / defaults to `[]`), 1 real
             # `WorkbenchIsland`-level wiring test (renders ayah 1's own
             # reviewer, hides ayah 2's, re-scopes on an ayah change via the
             # real Ayah number input, against the frozen 12.json fixture),
             # and 4 in `QariMode` (renders all five fields; falls back to
             # "—" for a null `verifiedBy` and drops a null note rather than a
             # stray ": —"; says so honestly when history is empty; stays
             # crash-free with the prop omitted) — the other 34 cases in those
             # two files unaffected; restored byte-identically, all green.
             # `TZ=UTC make test`: 2539 passing (was 2532, +7 — exactly this
             # run's new tests; apps/web 1287, was 1280; no other suite
             # moved). `check-test-floor.mjs`: OK, 2539 >= floor 1899 (+640
             # margin, unmoved). `TZ=UTC make build`: exit 0, 29 routes
             # (unchanged — edits inside the existing `/workbench` component
             # tree). `npm run gates`: all green (boundaries 295 files,
             # unchanged count — no new production file, three existing files
             # edited plus their two existing test files; fonts
             # degraded-but-non-blocking, pre-existing). `npx tsc --noEmit`:
             # clean (making `verifications` REQUIRED, not optional, surfaced
             # nine pre-existing `FrontierNavigator`-only literals that needed
             # the field added — each is `FrontierNavigator`-scoped and never
             # touches `verifications`, so `[]` is the correct value, not a
             # workaround). No `v1/**`/`v2/**` edit (stray
             # `v2/tsconfig.tsbuildinfo` reverted before committing, same
             # discipline as every prior entry). No Arabic codepoint (full
             # diff swept over every Arabic block plus both Presentation
             # Forms blocks, plus a `\u06xx`/`\u08xx`-escape and
             # `fromCharCode` sweep — zero matches; every new string is a wire
             # field name, an ISO timestamp derived from a fixture integer, a
             # fixture coordinate, or a synthetic placeholder email/note,
             # never corpus text). PROCESS NOTE: this session hit the
             # identical "stale local `main` ref" trap v3-D77/D91/D127/D138/
             # D159 each named before — an early `git checkout main`, before
             # any exploration, silently moved HEAD from the real tip
             # (`b7535af`, v3-D166) onto a stale local `main` seven commits
             # behind (`68bf199`, v3-D159). Caught via `git log -- v3/
             # CLAUDE.md` disagreeing with this session's own earlier `git
             # log -1` — before any commit was made. Recovered with `git
             # stash` of the uncommitted fix, `git fetch origin main` + `git
             # merge --ff-only origin/main` (zero risk to work in progress),
             # `git stash pop`, then a full re-verification against the
             # corrected tree before writing this note or committing — see
             # DECISIONS.md v3-D167's own process note for the full account.
             # NOT addressed: `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate`
             # as a whole class (v3-D88, v3-D151); multi-surah enrollment;
             # the operational mailer/7-night window; PAY-1's Stripe
             # fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); the late-arrival refold half of v3-D32;
             # `AccountDeletionRequest::isDue()` (v3-D146);
             # `lib/i18n/dictionaries.ts#isLocale()`; `BillingEventsPanel.tsx`'s
             # single-event detail view (v3-D166) — all unchanged. See
             # DECISIONS.md v3-D167.
             # NOTE (v3-D166, 2026-09-02): `BillingEventsPanel.tsx` — named by
             # v3-D164's own "NOT addressed" list and repeated unchanged by
             # v3-D165's — fetched `providerCreatedAt`/`processedAt`
             # (`lib/admin/billingEvents.ts#BillingEventEntry`, sent in full
             # by `BillingEventsController::index()` since v3-D148) but
             # rendered neither; the table showed only `receivedAt` (when
             # this server first saw the delivery), a materially different
             # timestamp from Stripe's own `created` or from when processing
             # actually finished. The header's "EVERY FIELD IS RENDERED
             # VERBATIM" claim was false for two of eight fields — the same
             # shape as `FlagAuditPanel.tsx`'s (v3-D165) and
             # `AuditLogPanel.tsx`'s (v3-D164) own dropped fields, the third
             # and last of the three v3-D164's sweep found. `processedAt` is
             # the one field the journal's own docblock says it exists to
             # make visible ("a crash mid-handler leaves a replayable row
             # rather than a silently-lost event") — an operator had no way
             # to see it at all. Fixed, display-only, no server/wire change:
             # two new columns, "Provider created" and "Processed", next to
             # the existing "Received" column, each an ISO-8601 string or
             # the table's existing "—" placeholder when null (both fields
             # are genuinely nullable) — never a fabricated timestamp.
             # RED confirmed directly: `git stash` of
             # `BillingEventsPanel.tsx` alone (both new tests kept, 6
             # pre-existing cases untouched) failed exactly the 2 new cases
             # in `billing-events-panel.test.tsx`, 6 unaffected; restored
             # byte-identically, 8/8 green. The positive case's
             # `processedAt` fixture value is 100ms off `receivedAt` so
             # `getByText` cannot match the wrong column; the null case's
             # fixture keeps `subjectPseudonym`/`error`/`outcome` non-null so
             # its two counted "—"s can only come from the two new columns.
             # `TZ=UTC make test`: 2532 passing (was 2530, +2 — exactly this
             # run's new tests; apps/web 1280, was 1278; no other suite
             # moved). `check-test-floor.mjs`: OK, 2532 >= floor 1899 (+633
             # margin, unmoved, same discipline as every prior entry).
             # `TZ=UTC make build`: exit 0, 29 routes (unchanged — no new
             # route; edits inside an existing component on the existing
             # `/settings/billing` route). `npm run gates`: all green
             # (boundaries 294 files, unchanged count — one existing file
             # edited plus its test, no new production file; fonts
             # degraded-but-non-blocking, pre-existing; corpus-morphology
             # and corpus-glyphs unchanged). `npx tsc --noEmit`: clean. No
             # `v1/**`/`v2/**` edit (stray `v2/tsconfig.tsbuildinfo`
             # reverted before committing, same discipline as every prior
             # entry). No Arabic codepoint (full diff swept over every
             # Arabic block plus both Presentation Forms blocks, plus a
             # `\u06xx`/`\u08xx`-escape and `fromCharCode` sweep — zero
             # matches; every new string is a fixed English column header or
             # an ISO timestamp derived from a fixture integer, never corpus
             # text). With this, all three sibling gaps v3-D164's sweep
             # found are closed — a future sweep should look elsewhere for
             # the next instance of this bug class. NOT addressed:
             # `BillingEventsPanel.tsx` still has no single-event detail
             # view (the raw `payload` is deliberately never sent at all —
             # a different, smaller follow-up); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate`
             # as a whole class (v3-D88, v3-D151); multi-surah enrollment;
             # the operational mailer/7-night window; PAY-1's Stripe
             # fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); the late-arrival refold half of v3-D32;
             # `AccountDeletionRequest::isDue()` (v3-D146);
             # `lib/i18n/dictionaries.ts#isLocale()` — all unchanged. See
             # DECISIONS.md v3-D166.
             # NOTE (v3-D165, 2026-09-01): `FlagAuditPanel.tsx` — v3-D164's own
             # "NOT addressed" list named this exactly — fetched all four of
             # the enable-hard ceremony's inputs (`lib/admin/flagAudit.ts
             # #FlagAuditEntry`: `reason`, `acknowledgesRetentionRisk`,
             # `acknowledgesNoDarkPattern`, `typedFlagName`, all sent by
             # `FlagAuditController::index()`) but rendered only `reason` —
             # the same "fetched and discarded" shape v3-D164 fixed for
             # `BillingEventsPanel.tsx`'s `processedAt`/`providerCreatedAt`,
             # here one surface over. The panel's own header claimed "EVERY
             # FIELD IS RENDERED VERBATIM" — false for the two safety
             # checkboxes and the typed-name confirmation, the three fields
             # `FlagController::store()`'s ceremony validation actually
             # requires (`>=20-char reason` *and* both booleans `true` *and*
             # `typed_flag_name` matching the flag key exactly) before an
             # "enable" row can exist at all — an operator reviewing "who
             # ramped this flag back on" could see the reason but not
             # whether the two ethics acknowledgements or the typed
             # confirmation were ever genuinely made. Fixed, display-only,
             # no server change: three new columns ("Retention ack", "No
             # dark pattern ack", "Typed name"). `flag_ramp_audit`'s two
             # boolean columns default `false` and `typed_flag_name` is
             # `null` for every OTHER action (`kill`/`ack`/`auto_waive` —
             # `FlagService::kill()`/`acknowledgeKill()` never touch the
             # ceremony fields at all) — rendering `false` there as a literal
             # "no" would read as a person's real answer to a ceremony that
             # was never presented, so all three cells fall back to "—"
             # (never a fabricated "no") whenever `action !== "enable"`,
             # matching this table's own existing "system" (never a blank
             # cell) and `AuditLogPanel`'s v3-D164 "—" convention for
             # `ip`/`requestId` exactly. RED confirmed directly: `git stash`
             # of `FlagAuditPanel.tsx` alone (the new test kept) reran
             # `flag-audit-panel.test.tsx` — exactly the new ceremony-fields
             # case failed (`Unable to find an element with the text: yes`),
             # the 5 pre-existing cases in the file unaffected; restored
             # byte-identically (`git diff` empty), reran: 6/6 green. The
             # test's own auto_waive-row assertion (`queryByText("yes")` is
             # `null`) proves the "—" fallback is real, not merely that the
             # enable row happens to render "yes" somewhere on the page.
             # `TZ=UTC make test`: 2530 passing (was 2529, +1 — exactly this
             # run's one net-new test; apps/web 1278, was 1277; no other
             # suite moved: 255 v2 vitest, 47 v2/api, 351 v3/api, 118
             # corpus-compiler, 420 engine, 61 fold-runner). `check-test-
             # floor.mjs`: OK, 2530 >= floor 1899 (+631 margin, unmoved,
             # same discipline as every prior entry). `TZ=UTC make build`:
             # exit 0, 29 routes (unchanged — no new route; this edits
             # inside an existing `/settings/flags` component). `npm run
             # gates`: all green (boundaries 295 files, unchanged count —
             # no new production file, two existing files edited; fonts
             # degraded-but-non-blocking, pre-existing). `npx tsc --noEmit`:
             # clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff produced by
             # running the suite was reverted before committing, same
             # discipline as every prior entry — `git status --porcelain --
             # v1 v2` empty immediately before commit). No Arabic codepoint
             # (the full diff swept over every Arabic block plus both
             # Presentation Forms blocks, plus a `\u06xx`/`\u08xx`-escape
             # and `fromCharCode` sweep — zero matches; every new string is
             # a wire field label or the literal words "yes"/"no"/"—", never
             # corpus text). NOT addressed, named so a future run doesn't
             # re-discover it as new: this run's own scope was scoped to the
             # single item v3-D164 named for `FlagAuditPanel.tsx` alone —
             # the sync layer's own zero-caller sweep (v3-D88 onward) and
             # every other item on v3-D164's own longer "NOT addressed" list
             # (`rhymeClassOf()`, `EntitlementMachine::merge()`,
             # `App\Billing\TrialAttribution`, `PaywallGate`, multi-surah
             # enrollment, the operational mailer/7-night window, PAY-1's
             # Stripe fixtures, surah 67's scene beats,
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift,
             # `packages/engine/src/placement.ts`, the late-arrival refold
             # half of v3-D32, `AccountDeletionRequest::isDue()`) are
             # unchanged. See DECISIONS.md v3-D165.
             # NOTE (v3-D164, 2026-09-01): `admin_audit.ip`/`.request_id` were
             # stamped by all four writers (`AdminRevealController::reveal`,
             # `AdminUsersController::exportCsv`,
             # `SystemHealthController::rebuildAtomCache`,
             # `StripeSettingsController::test`) but `AdminAuditController
             # ::index()`'s wire map dropped both before the response left the
             # server — `AuditLogPanel.tsx`'s own "EVERY FIELD IS RENDERED
             # VERBATIM" header claim was false for the one detail that ties an
             # audit row to a concrete HTTP request. Fixed: the controller's
             # map gains `ip`/`requestId`; `lib/admin/audit.ts#AuditEntry` +
             # its validator require both; `AuditLogPanel.tsx` gains two
             # columns, each falling back to the existing "—" placeholder.
             # Neither is pseudonymized (an admin's own IP, not learner PII).
             # RED confirmed at both layers, each via `git stash` of the
             # source alone, tests kept: backend failed exactly the new
             # `test_ip_and_request_id_reach_the_wire` case (`Undefined array
             # key "ip"`), 5 others unaffected; frontend failed exactly 2 of
             # 14 vitest cases (the new missing-fields-become-unavailable
             # case, and the existing READY case updated to expect a second
             # "—" placeholder), 12 unaffected; both restored byte-identically
             # and reran green. `TZ=UTC make test`: 2529 passing (was 2526,
             # +3 — exactly this run's new tests: 1 + 2; v3/api 351, was 350;
             # apps/web 1277, was 1275; no other suite moved). `check-test-
             # floor.mjs`: OK, 2529 >= floor 1899 (+630 margin, unmoved).
             # `TZ=UTC make build`: exit 0, 29 routes (unchanged — edits
             # inside an existing `/settings/audit` component). `npm run
             # gates`: all green (boundaries 294 files, unchanged count — two
             # existing files edited, no new production file; fonts
             # degraded-but-non-blocking, pre-existing). `npx tsc --noEmit`:
             # clean. No `v1/**`/`v2/**` edit (stray `v2/tsconfig.tsbuildinfo`
             # reverted before committing, same discipline as every prior
             # entry). No Arabic codepoint (full diff swept over every Arabic
             # block plus both Presentation Forms blocks, plus a
             # `\u06xx`/`\u08xx`-escape and `fromCharCode` sweep — zero
             # matches; every new string is a wire field name or a synthetic
             # IP/request-id test fixture, never corpus text). NOT addressed:
             # `FlagAuditPanel.tsx` fetches all four kill-ceremony inputs but
             # renders only `reason` — the two safety checkboxes and the
             # typed-name confirmation are fetched and discarded, same shape,
             # separate scope; `BillingEventsPanel.tsx` similarly drops
             # `processedAt`/`providerCreatedAt`. Both real, both left for a
             # future run. See DECISIONS.md v3-D164.
             # NOTE (v3-D163, 2026-09-01): `App\Models\Override::editor()` — a
             # `BelongsTo<User>` relation, existing since the override layer
             # shipped (v2-D21/D55), its own docblock naming its purpose ("for
             # the editor's audit list") — had zero callers anywhere, not even
             # a test (`grep -rn "->editor\b" app tests` returned nothing
             # beyond the declaration). `OverridesController::toWire()` sent
             # only the raw `editor_id` integer as `editorId`, and
             # `OverrideEditor.tsx` (the one screen that lists an ayah's
             # override history, wired at v3-D125) never rendered it — an
             # admin correcting a gloss today and reopening the same ayah's
             # history tomorrow could not tell whether they, another admin,
             # or a qari made a given row. Fixed on the exact convention
             # `AyahVerification.verified_by` already set for "who did this"
             # display: `toWire()` gains `editorEmail` (`$r->editor?->email`,
             # `index()` eager-loading `with('editor')`, `store()` setting
             # the relation directly from `$request->user()`), the wire type
             # (`overrides.ts#QuestionOverride`) gains a matching
             # `editorEmail?: string | null`, and `OverrideEditor.tsx`
             # renders `{summarize(o)} — by {o.editorEmail ?? "—"}` — `"—"`
             # for a pre-fix row or a deleted editor account, never a guess.
             # RED confirmed directly: `git stash` of the three source files
             # only (both test files, including the new cases, kept) failed
             # exactly the new cases — backend 1, frontend 2 — 8 and 12 other
             # cases respectively unaffected; restored byte-identically,
             # 9/9 + 14/14 green. `TZ=UTC make test`: 2526 passing (was 2523,
             # +3 — exactly this run's new tests: 1 + 2; v3/api 350, was 349;
             # apps/web 1275, was 1273; no other suite moved). `check-test-
             # floor.mjs`: OK, 2526 >= floor 1899 (+627 margin, unmoved).
             # `TZ=UTC make build`: exit 0, 29 routes (unchanged — no new
             # route; edits inside an existing `/workbench` component). `npm
             # run gates`: all green (boundaries 295 files, unchanged count —
             # no new production file, three existing files edited; fonts
             # degraded-but-non-blocking, pre-existing). `npx tsc --noEmit`:
             # clean. No `v1/**`/`v2/**` edit (stray `v2/tsconfig.tsbuildinfo`
             # reverted before committing, same discipline as every prior
             # entry). No Arabic codepoint (full diff swept over every Arabic
             # block plus both Presentation Forms blocks, plus a
             # `\u06xx`/`\u08xx`-escape and `fromCharCode` sweep — zero
             # matches; every new string is a fixed English label or a
             # synthetic placeholder email, never corpus text). NOT
             # addressed: the same `<li>` never renders a row's own `note`
             # field either — a smaller, separate, adjacent gap left alone;
             # `lib/pricing.ts#regionFromCountry()` — also found unit-tested
             # with zero production callers this run, but only because the
             # checkout flow that would call it doesn't exist yet, the
             # identical blocked-on-live-Stripe scope as `TrialAttribution`,
             # not an independent gap; `lib/i18n/dictionaries.ts#isLocale()`
             # — confirmed a deliberate pre-launch scaffold seam, not a gap.
             # See DECISIONS.md v3-D163.
             # NOTE (v3-D162, 2026-09-01): `lib/sync/token.ts#isTokenDead()` —
             # v3-D161's own "NOT addressed" list named this exactly as "the
             # more complete follow-up to this entry, not a separate new
             # finding" — had answered "has a 401 been observed and not yet
             # recovered from" since B8 closed, unit-tested, with zero
             # production callers anywhere. `apiFetch.ts`'s 401 interceptor
             # calls `clearToken()` (marking the token dead) then attempts a
             # re-mint; if that mint ALSO fails (the endpoint down, or BRAKE
             # 3's 60s cooldown blocking a second attempt), the token stays
             # dead indefinitely with nothing on screen saying so — a learner
             # in this state saw the identical quiet "N waiting to sync"
             # caption an ordinary offline learner sees, with no way to learn
             # that "wait for network" would never be enough on its own.
             # Fixed on the exact template v3-D161 established one layer
             # over: `lib/sync/summary.ts#SyncSummary` gains a third field,
             # `authDead: boolean`; `SyncTrigger.tsx` reads `isTokenDead()`
             # directly (not derivable from `CycleResult`, which carries no
             # token-liveness field) at the moment each cycle finishes and
             # reports it alongside the existing two counts;
             # `SyncStatus.tsx` gains a matching optional `authDead?:
             # boolean` prop, defaulting to the live value via `??` (an
             # explicit `false` still wins over a live `true`). Unlike a
             # #110 quarantine, a dead token recovers on its own once a
             # later re-mint succeeds, so — like the other two fields —
             # it is reported as the CURRENT state every cycle, never
             # latched.
             #
             # RED confirmed directly: `git stash` of the three source files
             # only (every test file, including the pre-existing v3-D161
             # ones whose `toEqual` now expects a third key, kept) and
             # rerunning `lib/sync/summary.test.ts` + `test/sync-status
             # .test.tsx` + `test/sync-trigger.test.tsx` failed exactly 11 of
             # 31 cases (the new authDead-only cases plus the pre-existing
             # v3-D161 wiring assertion), 20 others unaffected; restored
             # byte-identically (`git diff` empty), reran: 31/31 green. The
             # `SyncTrigger` wiring test reproduces a REAL unrecovered 401
             # (a mocked `/api/events` 401 plus a mocked `/api/auth
             # /anonymous` 500, so the actual `clearToken()`/`mintAnonymous()`
             # chain runs and genuinely fails), not a stubbed flag; its
             # "clears again" companion needed one iteration — a first draft
             # dispatched a manual `focus` event moments after the failure
             # and expected immediate recovery, which failed on BRAKE 3's
             # real 60-second mint cooldown rather than on the fix itself,
             # fixed by switching to fake timers and letting the component's
             # own already-proven backoff-retry loop carry a later cycle
             # past the real cooldown.
             #
             # `TZ=UTC make test`: 2523 passing (was 2516, +7 — exactly this
             # run's new tests: 2 + 3 + 2; apps/web 1273, was 1266; no other
             # suite moved: 255 v2 vitest, 47 v2/api, 349 v3/api, 118
             # corpus-compiler, 420 engine, 61 fold-runner).
             # `check-test-floor.mjs`: OK, 2523 >= floor 1899 (+624 margin,
             # unmoved, same discipline as every prior entry). `TZ=UTC make
             # build`: exit 0, 29 routes (unchanged — no route/UI surface
             # added; both edited components are existing background/status
             # modules already mounted). `npm run gates`: all green (fonts
             # degraded-but-non-blocking, pre-existing; boundaries 295
             # files — no new production file, three existing files edited
             # plus their three existing test files; corpus-morphology and
             # corpus-glyphs unchanged by this diff). `npx tsc --noEmit`:
             # clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff produced by
             # running the suite was reverted before committing, same
             # discipline as every prior entry — `git status --porcelain --
             # v1 v2` empty immediately before commit). No Arabic codepoint
             # (the full diff swept programmatically over the Arabic,
             # Arabic Supplement, Arabic Extended-A and both Presentation
             # Forms Unicode blocks, plus a `\u06xx`/`\u08xx`-escape and
             # `fromCharCode` sweep — zero matches; every new string is a
             # fixed English status phrase, a boolean, or a plain fixture
             # token, never corpus text).
             #
             # NOT addressed, named so a future run doesn't re-discover it
             # as new: `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution`
             # (v3-D148); `PaywallGate` as a whole class /
             # `permitsIssuance`/`permitsReview` (v3-D88, v3-D151 — still a
             # genuine open product-design question, not a wiring gap);
             # multi-surah enrollment; the operational mailer/7-night window
             # (still needs a live host/SMTP/seven real nights); PAY-1's
             # Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127, deliberately not restructured);
             # `packages/engine/src/placement.ts` (a design choice,
             # v3-D111/D113/D123); the late-arrival refold half of v3-D32
             # (no automatic refold-on-ingest pipeline exists yet — real,
             # separate, larger scope); `AccountDeletionRequest::isDue()`
             # (v3-D146, a zero-caller convenience method deliberately left
             # alone) — all unchanged. With this, the sync layer's own
             # zero-caller sweep (v3-D88, D89, D90, D93, D94, D161, D162) is,
             # as far as this run could find, exhausted. See DECISIONS.md
             # v3-D162.
             # NOTE (v3-D161, 2026-08-31): `SyncStatus.tsx`'s own two
             # escalation props — `cannotSync` (#110, a permanently
             # quarantined oversize event) and `divergences` (#50, a payload
             # divergence found on pull) — have existed, been unit-tested,
             # and defaulted to `0` since build-plan step 21. Both counts are
             # computed for real on every single sync cycle
             # (`lib/sync/sync.ts#syncCycle`'s `CycleResult.quarantined`/
             # `.divergences`, fed by `outbox.ts#selectPending` and
             # `merge.ts#mergeFromServer`), but `SyncTrigger.tsx` — the ONE
             # place a real cycle ever runs — collapsed the whole result to
             # a single `degraded` boolean and discarded both arrays
             # entirely, and `home/page.tsx` mounts `<SyncStatus />` with no
             # props at all. So the escalation branch SyncStatus's own header
             # was built specifically to show ("'waiting' and 'cannot' are
             # different facts and must not share a number") could never
             # paint outside a test that hand-fed it a literal — a learner
             # whose device produced an oversize event, or whose pull hit a
             # genuine #50 divergence, saw the identical quiet "N waiting to
             # sync" caption an ordinary offline learner sees, forever, with
             # no way to learn that specific event will never sync. Found by
             # an Explore agent's fresh sweep for this build's recurring
             # "mechanism built and tested, zero production caller" class
             # (v3-D82 onward), directed away from ~30 already-closed
             # instances and the handful of named genuine non-gaps
             # (`rhymeClassOf`, `EntitlementMachine::merge`, `PaywallGate`,
             # etc.) so it would not re-report one of those.
             #
             # Fixed with a new module, not a prop-threading change through
             # a server component (`home/page.tsx` is a Server Component and
             # cannot hold live client state to pass down): `lib/sync/
             # summary.ts#syncSummary`, a module-level singleton with the
             # same `.current`/`.subscribe()` shape `lib/idb/writeLock.ts`'s
             # `WriteLock` already established for exactly this
             # cross-component-without-cross-importing problem.
             # `SyncTrigger` calls `syncSummary.report(result)` once per
             # completed cycle (a synchronous, side-effect-free write —
             # #103's "never blocks" contract is unchanged, this adds no
             # network call); `SyncStatus` reads it via a new
             # `useSyncSummary()` hook and falls back to the live value only
             # when its own `cannotSync`/`divergences` PROPS are omitted
             # (`??`, not a default-parameter `= 0`), so every existing test
             # that hands it a literal for isolated rendering is unaffected
             # and an explicit prop still wins. Neither component imports
             # the other, matching `SyncTrigger`'s own header ("no session,
             # drill or grading path may... read its state, because it has
             # none to read") — this is a dedicated side-channel for the one
             # user-facing purpose #103/#50/#110 already named, not an
             # exception to that rule.
             #
             # RED confirmed directly: `git stash` of the two component
             # files only (`SyncStatus.tsx`, `SyncTrigger.tsx` — the new
             # `lib/sync/summary.ts` module and all new tests kept) and
             # rerunning `test/sync-trigger.test.tsx` + `test/sync-status
             # .test.tsx` failed exactly the two new wiring-proof cases (a
             # real cycle over a genuinely oversize appended event — padded
             # via `specSnapshot`, over `EVENT_BYTE_MAX`, no Arabic anywhere
             # — never reached `syncSummary`; a bare `<SyncStatus />` mount
             # never painted the live count), 16 other cases in those two
             # files unaffected; restored byte-identically (`git diff`
             # empty), reran: 24/24 green (9 new: 6 in the new
             # `lib/sync/summary.test.ts` for the store primitive itself, 1
             # in `sync-trigger.test.tsx`, 2 in `sync-status.test.tsx`). The
             # store-level tests also pin the load-bearing "overwrite, never
             # accumulate" property directly (`outbox.ts#selectPending`
             # re-scans and re-reports every still-quarantined row on every
             # cycle, so a LATER cycle with fewer quarantined rows must
             # drop the old count, never add to it) and that an unchanged
             # report is a no-op for subscribers (no re-render on an
             # identical value).
             #
             # `TZ=UTC make test`: 2516 passing (was 2507, +9 — exactly this
             # run's new tests; apps/web 1266, was 1257; no other suite
             # moved: 255 v2 vitest, 47 v2/api, 349 v3/api, 118
             # corpus-compiler, 420 engine, 61 fold-runner).
             # `check-test-floor.mjs`: OK, 2516 >= floor 1899 (+617 margin,
             # unmoved, same discipline as every prior entry). `TZ=UTC make
             # build`: exit 0, 29 routes (unchanged — no route/UI surface
             # added; both edited files are existing background/status
             # components already mounted). `npm run gates`: all green
             # (fonts degraded-but-non-blocking, pre-existing; boundaries
             # 294 files, up from 293 — exactly the one new production file,
             # `lib/sync/summary.ts`; corpus-morphology and corpus-glyphs
             # unchanged). `npx tsc --noEmit`: clean. No `v1/**`/`v2/**` edit
             # (a stray `v2/tsconfig.tsbuildinfo` build-cache diff produced
             # by running the suite was reverted before committing, same
             # discipline as every prior entry — `git status --porcelain --
             # v1 v2` empty immediately before commit). No Arabic codepoint
             # (every new/changed file swept programmatically over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks, plus a `\u06xx`/`\u08xx`-
             # escape and `fromCharCode` sweep — zero matches; the one
             # oversize test fixture pads with a plain ASCII filler string,
             # never Arabic, and every fixture coordinate is a plain surah/
             # ayah integer matching this file's own established
             # convention).
             #
             # NOT addressed, named so a future run doesn't re-discover it
             # as new: `lib/sync/token.ts#isTokenDead()` has the identical
             # zero-caller shape one layer over — no UI distinguishes "sync
             # is stuck because the device's token died and hasn't recovered
             # yet" from ordinary pending/offline, and is partially subsumed
             # by `sync.ts`'s own `degraded: "auth"` reason, which
             # `SyncTrigger` also still discards; `rhymeClassOf()`
             # (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution`
             # (v3-D148); `PaywallGate` as a whole class /
             # `permitsIssuance`/`permitsReview` (v3-D88, v3-D151 — still a
             # genuine open product-design question, not a wiring gap);
             # multi-surah enrollment; the operational mailer/7-night window
             # (still needs a live host/SMTP/seven real nights); PAY-1's
             # Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127, deliberately not restructured);
             # `packages/engine/src/placement.ts` (a design choice,
             # v3-D111/D113/D123); the late-arrival refold half of v3-D32
             # (no automatic refold-on-ingest pipeline exists yet — real,
             # separate, larger scope); `AccountDeletionRequest::isDue()`
             # (v3-D146, a zero-caller convenience method deliberately left
             # alone) — all unchanged. See DECISIONS.md v3-D161.
             # NOTE (v3-D160, 2026-08-31): `GlossDraftReview.text_at_review` —
             # the field the model's own docblock says exists for exactly the
             # B3 reason ("snapshots the bytes a reviewer actually approved...
             # an approval that does not name what was approved silently
             # survives an edit that invalidated it") — was captured on every
             # transition (`GlossDraftsController::review()` and `store()`'s
             # auto-un-review branch), threaded onto the wire as
             # `textAtReview` (`toWire()`), and typed client-side
             # (`lib/admin/glossDrafts.ts#GlossDraftReviewRow`), but
             # `GlossDraftsPanel.tsx` — the one screen v3-D156 built
             # specifically to surface this review history — never rendered
             # it: its history `<li>` printed `fromStatus`/`toStatus`/
             # `actor`/`note` only. One night after v3-D156 closed the
             # "history is written, never read" gap for this table, the
             # richest field of that same history repeated the identical
             # mistake one layer down: a reviewer can approve a gloss draft,
             # the row can later be edited (which `store()`'s own un-review
             # branch handles by returning it to `draft`), and the admin
             # looking at the History column would see that an edit
             # happened (via the note) but never what the ORIGINAL approved
             # bytes actually were — the exact anti-corruption guarantee the
             # field's own docblock names, silently unmet by the one UI that
             # exists to check it. Fixed: `GlossDraftsPanel.tsx`'s history
             # `<li>` now also renders `rev.textAtReview` (labelled "approved
             # text: ...") whenever it is non-null, alongside the existing
             # transition/actor/note line — no server-side change, this was
             # a display-only gap. RED confirmed directly: reverted just the
             # component (`git stash` of `GlossDraftsPanel.tsx` only, test
             # kept) and reran — exactly the new test failed (`current
             # draft text needs recheck` — the row's CURRENT text — rendered,
             # but `originally approved wording before the edit` — the
             # historical approved bytes from an EARLIER review entry, now
             # different from the row's current text — did not), the other
             # 10 cases in the file unaffected; restored byte-identically
             # (`git diff` empty), reran: 11/11 green. The new test
             # deliberately uses a row whose CURRENT text differs from every
             # review's `textAtReview`, so the assertion could not pass
             # vacuously by reading the Text column instead of the history
             # (the pre-existing "renders each row's review-history note"
             # test from v3-D156 could not have caught this: its fixture's
             # `textAtReview` values happened to equal the row's own current
             # `text`, so `screen.getByText("first draft text")` was
             # satisfied by the Text column alone regardless of whether the
             # history rendered `textAtReview` at all). `TZ=UTC make test`:
             # 2507 passing (was 2506, +1 — exactly this run's new test;
             # apps/web 1257, was 1256; no other suite moved: 255 v2 vitest,
             # 47 v2/api, 349 v3/api, 118 corpus-compiler, 420 engine, 61
             # fold-runner). `check-test-floor.mjs`: OK, 2507 >= floor 1899
             # (+608 margin, unmoved, same discipline as every prior entry).
             # `TZ=UTC make build`: exit 0, 29 routes (unchanged — no
             # route/UI surface added, this edits inside an existing
             # component on the existing `/settings/gloss-drafts` route).
             # `npm run gates`: all green (fonts degraded-but-non-blocking,
             # pre-existing; boundaries 293 files, unchanged count — no new
             # production file, one existing file edited; corpus-morphology
             # and corpus-glyphs unchanged). `npx tsc --noEmit`: clean. No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff produced by running the suite was reverted
             # before committing, same discipline as every prior entry —
             # `git status --porcelain -- v1 v2` empty immediately before
             # commit). No Arabic codepoint (the full diff — both the
             # component and the test file — swept programmatically over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks, plus a `\u06xx`/
             # `\u08xx`-escape and `fromCharCode` sweep — zero matches; every
             # new string is workflow-review prose an admin might type, or a
             # plain English test fixture placeholder, never gloss or corpus
             # content — this surface authors Malay prose, and every value
             # in the new test is a synthetic English placeholder matching
             # the file's own established convention).
             #
             # NOT addressed, named so a future run doesn't re-discover it
             # as new: `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution`
             # (v3-D148); `PaywallGate` as a whole class /
             # `permitsIssuance`/`permitsReview` (v3-D88, v3-D151 — still a
             # genuine open product-design question, not a wiring gap);
             # multi-surah enrollment; the operational mailer/7-night
             # window (still needs a live host/SMTP/seven real nights);
             # PAY-1's Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127, deliberately not restructured); `packages/engine/
             # src/placement.ts` (a design choice, v3-D111/D113/D123); the
             # late-arrival refold half of v3-D32 (no automatic
             # refold-on-ingest pipeline exists yet — real, separate, larger
             # scope); `AccountDeletionRequest::isDue()` (v3-D146, a
             # zero-caller convenience method deliberately left alone — the
             # query-level check it duplicates is not misleading) — all
             # unchanged. See DECISIONS.md v3-D160.
             # NOTE (v3-D159, 2026-08-31): `lib/sync/digest.ts#digestsMatch()`
             # — the exported, documented function built to answer "whether
             # two events carry the same wire payload" (edge case #50) — had
             # zero callers anywhere: `merge.ts`'s own #50 comparison
             # (`mergeFromServer`'s skip-on-idempotent-replay check) called
             # `eventDigest(existing) === eventDigest(row)` directly instead,
             # re-deriving the identical comparison inline rather than using
             # the dedicated function built for exactly this question — the
             # same "tested/documented helper exists, the one call site that
             # needs it re-derives it inline" shape as v3-D83
             # (`gradeClassToWire`) and v3-D113 (`lastActiveDayMs`), found by
             # a function-export sweep of `apps/web/lib` after the usual
             # "mechanism built and tested, zero production caller" sweep
             # came back clean everywhere else checked this run (an Explore
             # agent's earlier pass this run had flagged `billing_events` as
             # zero-caller too, but that was a stale-checkout false positive
             # — v3-D148 already built and shipped its admin viewer; see the
             # process note below). A SECOND, sharper gap surfaced alongside
             # it: `digest.ts` — despite being the shared spine `eventDigest`
             # depends on and the one module whose own docblock states two
             # load-bearing obligations by name ("ABSENT === NULL ===
             # UNDEFINED"; "KEY ORDER IS IRRELEVANT") — had **no test file of
             # its own** (`find apps/web/lib/sync -iname "*.test.*"` listed
             # `outbox.test.ts`/`merge.test.ts`/`auth.test.ts`/`pull.test.ts`,
             # never `digest.test.ts`); both obligations were only ever
             # exercised INCIDENTALLY through `merge.test.ts`'s realistic
             # event fixtures, never pinned directly. Fixed: new
             # `lib/sync/digest.test.ts` (12 tests) proves both obligations
             # directly (including the recursive/nested case and the array
             # case, where null/undefined collapse to the same sentinel but
             # POSITION is never dropped — arrays are meaning-bearing order,
             # never sorted) plus `digestsMatch`'s own equality/inequality
             # behavior and its agreement with a direct `eventDigest`
             # comparison; `merge.ts:236` now calls `digestsMatch(existing,
             # row)` instead of the inline double `eventDigest(...)` call
             # (the individual digest strings are still computed separately
             # a few lines below, for the `Divergence` record itself, which
             # needs the actual digest strings, not just the boolean).
             # Mutation-verified directly: `digestsMatch` temporarily forced
             # to always return `true` failed exactly 2 of
             # `merge.test.ts`'s 23 pre-existing divergence-detection
             # cases (`expected [] to have a length of 1 but got +0`, both on
             # the #50 divergence-record assertions) — proving the wiring is
             # real, not merely a renamed no-op; reverted byte-identically
             # (`git diff lib/sync/digest.ts` empty), 35/35 green again (23
             # merge + 12 new digest). `TZ=UTC make test`: 2506 passing (was
             # 2494, +12 — exactly this run's new tests; apps/web 1256, was
             # 1244; no other suite moved: 255 v2 vitest, 47 v2/api, 349
             # v3/api, 118 corpus-compiler, 420 engine, 61 fold-runner).
             # `check-test-floor.mjs`: OK, 2506 >= floor 1899 (+607 margin,
             # unmoved, same discipline as every prior entry). `TZ=UTC make
             # build`: exit 0, 29 routes (unchanged — no route/UI touched,
             # this is a sync-layer-internal fix). No `v1/**`/`v2/**` edit (a
             # stray `v2/tsconfig.tsbuildinfo` build-cache diff produced by
             # running the suite was reverted before committing, same
             # discipline as every prior entry — `git status --porcelain --
             # v1 v2` empty immediately before commit). No Arabic codepoint
             # (the new test file and the merge.ts diff swept programmatically
             # over the Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks — zero matches; every string
             # in the new file is a plain-object fixture key/value, a fixture
             # coordinate (surah 12 ayah 1, matching this file's own
             # established convention), or English prose, never corpus text).
             #
             # A process note, recorded because it cost real time early this
             # run: the session started on a completely uninitialized
             # checkout (no `node_modules`/`vendor` anywhere — `make setup`
             # had never been run in this container) with `HEAD` briefly
             # landing on a stale cached `main` ref one `git checkout main`
             # away from the real tip — the exact "detached HEAD, stale
             # local `main`" shape v3-D77 Finding 0 named and v3-D91/D127/D138
             # each re-hit since. `git fetch origin main` followed by `git
             # merge --ff-only origin/main` recovered the real tip (`471c785`,
             # v3-D158) cleanly, with zero risk of losing work (a fast-forward
             # merge, not a reset) — but an Explore agent dispatched to sweep
             # for the next zero-caller mechanism BEFORE that fetch reported
             # `billing_events`' admin viewer as missing, which was already
             # built and shipped at v3-D148. Verified directly against the
             # corrected tree (`ls api/app/Http/Controllers/Admin/
             # BillingEventsController.php` and `lib/admin/billingEvents.ts`
             # both present) before trusting the agent's finding, per
             # NIGHTLY.md's own rule to re-derive from the repo rather than
             # any prior claim — caught before any duplicate work was
             # attempted, unlike the "hours of reconciliation" v3-D77's
             # original finding cost.
             #
             # NOT addressed, named so a future run doesn't re-discover it as
             # new: `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution`
             # (v3-D148); `PaywallGate` as a whole class /
             # `permitsIssuance`/`permitsReview` (v3-D88, v3-D151 — still a
             # genuine open product-design question, not a wiring gap);
             # multi-surah enrollment; the operational mailer/7-night window
             # (still needs a live host/SMTP/seven real nights); PAY-1's
             # Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127, a real cross-runtime duplication but deliberately
             # not restructured — see that entry); `packages/engine/src/
             # placement.ts` (a design choice, v3-D111/D113/D123); the
             # "late-arrival refold" half of v3-D32 (this build has no
             # automatic refold-on-ingest pipeline at all yet — real,
             # separate, larger scope, re-confirmed still open this run) —
             # all unchanged. See DECISIONS.md v3-D159.
             # NOTE (v3-D158, 2026-08-31): `PricingConstantsTest.php` and
             # `test/pricing.test.ts` — the CI pricing clause BUILD-PLAN.md's
             # own gate list names — each assert their OWN file's price
             # amounts against the same hardcoded v3-D07 prose string, but
             # neither reads the other file, unlike the identical mirror-drift
             # shape v3-D149/D150 already guarded for `offline_ttl_days`/
             # `OFFLINE_TTL_MS` and `trial.days`/`TRIAL_DAYS_MS` via a
             # dedicated `*-config-agreement.test.ts`. The actual money
             # amounts — `config/pricing.php`'s `MY`/`INTL` `monthly`/
             # `lifetime`/`currency`/`rails`, the numbers Stripe will actually
             # charge — never got the same guard, confirmed via `grep -rln
             # "PRICING_CONFIG_PATH\|config/pricing.php" apps/web`: only the
             # two OTHER agreement tests and the two files themselves, no
             # third guard covering price amounts. `config/pricing.php`'s own
             # docblock names the intended web-side enforcement,
             # `check-pricing.mjs` — that script does not exist anywhere in
             # the tree; the real mechanism (`check-boundaries.mjs` clause 10)
             # only stops a SECOND price literal appearing outside
             # `lib/pricing.ts`, it never compares `lib/pricing.ts`'s values
             # against `config/pricing.php`'s. Concretely: a future edit to
             # the real charged amount in `config/pricing.php` that is not
             # mirrored into `lib/pricing.ts`'s DISPLAY amount would leave
             # both existing suites green — each independently matches its
             # own hardcoded copy of the v3-D07 text — while a learner sees
             # one price on the landing/billing screen and is charged
             # another, a direct billing-trust bug, strictly worse in
             # consequence than the two amounts already guarded. Fixed:
             # `apps/web/lib/pricing-config-agreement.test.ts` (new, colocated
             # with `pricing.ts` matching the two precedent files' own
             # placement in `lib/entitlement/`), which reads
             # `config/pricing.php`'s raw text via regex (same technique
             # `PricingConstantsTest::
             # test_no_price_literal_exists_outside_the_pricing_config`
             # already uses) and asserts `PRICING.MY`/`PRICING.INTL`'s
             # `currency`/`monthly`/`lifetime` and both regions'
             # `monthlyRails`/`lifetimeRails` all match the parsed PHP source
             # exactly. No production code path changed — this is a guard
             # test only, the same shape as v3-D150. RED confirmed twice,
             # directly: mutating `config/pricing.php`'s `MY.monthly` from
             # 2000 to 2500 failed the new test exactly (`expected 2000 to be
             # 2500`); separately, mutating `MY.lifetime`'s rails to drop
             # `grabpay` failed the rails case exactly (`+ "grabpay"` in the
             # diff). Both reverted byte-identically (`git status --porcelain
             # config/pricing.php` empty before committing) and reran green,
             # 3/3. `TZ=UTC make test`: 2494 passing (was 2491, +3 — exactly
             # this run's new tests; apps/web 1244, was 1241; no other suite
             # moved: 255 v2 vitest, 47 v2/api, 349 v3/api, 118
             # corpus-compiler, 420 engine, 61 fold-runner).
             # `check-test-floor.mjs`: OK, 2494 >= floor 1899 (+595 margin,
             # unmoved). `TZ=UTC make build`: exit 0, 29 routes (unchanged —
             # no new route, this is a test-only file). `npm run gates`: all
             # green (fonts degraded-but-non-blocking, pre-existing;
             # boundaries 292 files, up from 291 — exactly the one new file;
             # corpus-morphology and corpus-glyphs unchanged). `npx tsc
             # --noEmit`: clean (this run's first draft tripped
             # `noUncheckedIndexedAccess` on five separate regex
             # capture-group accesses — fixed with explicit `=== undefined`
             # narrowing and a type-predicate filter, never a non-null
             # assertion). No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted first, same
             # discipline as every prior entry — `git status --porcelain --
             # v1 v2` empty immediately before commit). No Arabic codepoint
             # (the new file swept programmatically over the Arabic, Arabic
             # Supplement, Arabic Extended-A and both Presentation Forms
             # Unicode blocks, plus a `\u06xx`/`fromCharCode` sweep — zero
             # matches; every line addresses a minor-unit integer, a
             # currency/rail by closed-set string, or a file path, never
             # corpus text). NOT addressed: `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148); `PaywallGate` as a
             # whole class / `permitsIssuance`/`permitsReview` (v3-D88,
             # v3-D151 — a genuine open product-design question, not a wiring
             # gap); multi-surah enrollment; the operational mailer/7-night
             # window; PAY-1's Stripe fixtures; surah 67's scene beats — all
             # unchanged. See DECISIONS.md v3-D158.
             # NOTE (v3-D156, 2026-08-30): `gloss_draft_reviews` — the MS gloss
             # workflow's own APPEND-ONLY review history, declared via
             # `GlossDraft::reviews()` since the table's migration landed —
             # had zero readers anywhere: `grep -rn "->reviews(\|::reviews("
             # api/app api/routes api/tests` returned nothing. `review()`/
             # `store()`'s auto-un-review branch both write a real
             # `GlossDraftReview` row on every transition, including a
             # reviewer's rejection NOTE — the one thing an author needs to
             # act on — but `toWire()` had no `reviews` field, so that note
             # was durably recorded and then permanently invisible from the
             # one screen (`GlossDraftsPanel.tsx`) a human looks at. Same
             # "written, populated, zero read surface" shape closed six times
             # before (`admin_audit` v3-D129, `flag_ramp_audit` v3-D130,
             # `entitlement_transitions` v3-D141, `purge_ledger` v3-D142,
             # `billing_events` v3-D148) — found one layer under v3-D145's own
             # general gloss-drafts wiring pass. Fixed: `toWire()` gained a
             # chronological `reviews` array (queried via the already-declared
             # relation, `$r->reviews()->orderBy('id')->get()`); the frontend
             # (`glossDrafts.ts`, `GlossDraftsPanel.tsx`) gained a matching
             # optional `reviews?` field and a "History" column rendering each
             # transition + note, empty only when genuinely no history exists
             # yet. RED confirmed at both layers, independently reverted and
             # reproduced, then restored byte-identically: backend (2 new
             # `GlossDraftsTest` cases against the unmodified controller
             # failed on a missing `reviews` key), frontend (`git stash` of
             # the three source files reproduced the identical failure on the
             # positive "renders the rejection note" case). `TZ=UTC make
             # test`: 2487 passing (was 2482, +5 — exactly this run's new
             # tests: 2 PHPUnit + 1 + 2 vitest; v3/api 347, was 345; apps/web
             # 1239, was 1236; no other suite moved). `check-test-floor.mjs`:
             # OK, 2487 >= floor 1899 (+588 margin, unmoved). `TZ=UTC make
             # build`: exit 0, 29 routes (unchanged — no new route). `npm run
             # gates`: all green (boundaries 291 files, unchanged count — no
             # new file, three existing files edited; fonts degraded-but-non-
             # blocking, pre-existing; corpus-glyphs 206 codepoints,
             # unchanged). `npx tsc --noEmit`: clean. No `v1/**`/`v2/**` edit
             # (stray `v2/tsconfig.tsbuildinfo` reverted first, same
             # discipline as every prior entry). No Arabic codepoint (every
             # changed file swept over every Arabic block plus both
             # Presentation Forms blocks, plus a `\u06xx`/`fromCharCode`
             # sweep — zero matches; every new line addresses a status, an
             # actor identifier, a note string, or a timestamp, never gloss
             # content — test fixture notes are plain English placeholders,
             # matching this file's own established convention). NOT
             # addressed: `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148); `PaywallGate` as a
             # whole class / `permitsIssuance`/`permitsReview` (v3-D88,
             # v3-D151 — a genuine open product-design question, not a wiring
             # gap); multi-surah enrollment; the operational mailer/7-night
             # window; PAY-1's Stripe fixtures; surah 67's scene beats — all
             # unchanged. See DECISIONS.md v3-D156.
             # NOTE (v3-D155, 2026-08-30): `EmailVerificationController::verify()`'s
             # own signed-link route — v3-D153's own "NOT addressed" list named
             # this exactly, and v3-D154 (the reset-password confirmation
             # screen, this same night's earlier sibling gap) re-named it again
             # — had no in-app landing page. Left at Laravel's default, the
             # notification's link pointed at the BACKEND'S OWN
             # `email/verify/{id}/{hash}` route directly — a route that sits
             # behind BOTH `signed` AND `auth:sanctum`
             # (`EmailVerificationController`'s own docblock), so a bare click
             # from an email client, carrying no Bearer header, would 401
             # before a learner saw anything. `grep -rln "email/verify"
             # apps/web/lib apps/web/app apps/web/components` (excluding
             # `auth.ts`'s own docblock references to the gap) returned
             # nothing. Fixed: `AppServiceProvider`'s new
             # `VerifyEmail::createUrlUsing` closure routes the link through
             # the frontend instead, carrying the same four pieces
             # (`id`, `hash`, `expires`, `signature`) `URL::temporarySignedRoute`
             # would have put on the backend URL — read back by
             # `lib/account/verifyLink.ts#parseVerifyLinkParams` (the
             # `?id=&hash=&expires=&signature=` query contract, degrading a
             # missing/malformed set to `null` rather than a throw, edge case
             # #78, same convention as `resetLink.ts`) — plus
             # `confirmEmailVerification()` in `lib/account/auth.ts` (GETs
             # `/api/email/verify/{id}/{hash}?expires=&signature=` through
             # `apiFetch`, so THIS device's own Bearer token is attached —
             # the route is deliberately device-bound: the currently
             # authenticated device must be the SAME user the link names,
             # per `EmailVerificationTest::test_link_cannot_verify_a_different_users_email`,
             # which this fix does not relax) + `components/account
             # /VerifyEmailScreen.tsx` (fires automatically on mount — unlike
             # `ResetPasswordForm`, the link itself is the credential, no form
             # to submit — with four states: verifying / verified /
             # already-verified / failed, the last naming the device-mismatch
             # possibility honestly rather than as a generic error) + a new
             # top-level `app/verify-email/page.tsx`, outside every route
             # group like `/reset-password` and `/attribution` — reachable
             # from an email client, not from inside the authenticated `(app)`
             # shell. RED confirmed at both layers: the backend
             # (`AppServiceProvider.php`'s closure reverted via `git stash`)
             # failed exactly the new `EmailVerificationTest` case (the real,
             # unfaked notification's action URL still pointed at the bare
             # API host, not the frontend); the frontend (the four new/
             # changed source files moved aside, tests kept) failed all 3 new
             # `confirmEmailVerification` cases in `auth.test.ts` on
             # `confirmEmailVerification is not a function` and both new test
             # files (`verifyLink.test.ts`, `verify-email-screen.test.tsx`) on
             # module-resolution errors; every file restored byte-identically,
             # 31/31 green (20 in `auth.test.ts` — 17 pre-existing + 3 new —
             # plus 7 in `verifyLink.test.ts` plus 4 in
             # `verify-email-screen.test.tsx`) and `EmailVerificationTest`
             # 6/6 (was 5/5). `TZ=UTC make test`: 2482 passing (was 2467,
             # +15 — exactly this run's new tests: 1 PHPUnit + 14 vitest — 3
             # + 7 + 4; apps/web 1236, was 1222; v3/api 345, was 344; no
             # other suite moved). `check-test-floor.mjs`: OK, 2482 >= floor
             # 1899 (+583 margin, unmoved). `TZ=UTC make build`: exit 0, 29
             # routes (was 28 — `/verify-email` is new, dynamic like
             # `/reset-password`). `npm run gates`: all green (fonts
             # degraded-but-non-blocking, pre-existing; boundaries 291 files,
             # up from 285 — the five new apps/web files; corpus-glyphs 206
             # codepoints, unchanged). `npx tsc --noEmit`: clean, `Version
             # 5.9.3` confirmed. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted first, same
             # discipline as every prior entry — `git status --porcelain --
             # v1 v2` empty immediately before commit). No Arabic codepoint
             # (every new/changed file swept programmatically over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks, plus a `\u06xx`/
             # `fromCharCode` sweep — zero matches; every new line addresses
             # an id, a hash, an expiry timestamp, a signature, a boolean, an
             # HTTP path, or English prose, never corpus text).
             #
             # NOT addressed, named so a future run doesn't re-discover it as
             # new: `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution`
             # (v3-D148); `PaywallGate` as a whole class (v3-D151);
             # multi-surah enrollment; the operational mailer/7-night window
             # (still needs a live host/SMTP/seven real nights); PAY-1's
             # Stripe fixtures; surah 67's scene beats — all unchanged.
             # NOTE (v3-D154, 2026-08-30): the reset-password CONFIRMATION
             # screen — v3-D153's own "NOT addressed" list named this exactly
             # as "the more urgent half of the RM500-buyer-forgets-their-
             # password risk" — did not exist. `PasswordResetController::reset()`
             # (`POST /api/reset-password`) and `requestPasswordReset()` (the
             # send-link half, wired into `AccountAuthPanel` at v3-D153) were
             # both real, but nothing let a learner who clicked the emailed
             # link actually finish: `grep -rln "reset-password" apps/web/lib
             # apps/web/app apps/web/components` (excluding `auth.ts`'s own
             # not-yet-built reference) returned nothing. Fixed: new
             # `lib/account/resetLink.ts#parseResetLinkParams` (the
             # `?token=&email=` query contract `AppServiceProvider.php`'s
             # `ResetPassword::createUrlUsing` closure actually emits, ported
             # 1:1 from that closure's own string template) +
             # `confirmPasswordReset()` in `lib/account/auth.ts` (posts to
             # `/api/reset-password`, adopts the fresh post-reset token via
             # `setAuthenticatedIdentity` exactly like `loginAccount` — a
             # completed reset signs this device in) +
             # `components/account/ResetPasswordForm.tsx` (checks password-
             # confirmation match CLIENT-SIDE before ever spending the
             # one-time reset token on a doomed request) + a new top-level
             # `app/reset-password/page.tsx`, outside every route group like
             # `/attribution` — reachable from an email client, not from
             # inside the authenticated `(app)` shell. RED confirmed
             # directly: all three new/changed test files were run against
             # the tree before their source existed and failed on
             # `confirmPasswordReset is not a function` / module-resolution
             # errors; implemented after, 12/12 new tests green (3 in
             # `auth.test.ts` + 5 in `resetLink.test.ts` + 4 in
             # `reset-password-form.test.tsx`). `TZ=UTC make test`: 2467
             # passing (was 2455, +12 — exactly this run's new tests; apps/web
             # 1222, was 1210; no other suite moved). `check-test-floor.mjs`:
             # OK, 2467 >= floor 1899 (+568 margin, unmoved). `TZ=UTC make
             # build`: exit 0, 28 routes (was 27 — `/reset-password` is new).
             # `npm run gates`: all green (fonts degraded-but-non-blocking,
             # pre-existing; boundaries 285 files, up from 280 — exactly the
             # four new apps/web files; corpus-glyphs 206 codepoints,
             # unchanged). `npx tsc --noEmit`: clean. No `v1/**`/`v2/**` edit
             # (a stray `v2/tsconfig.tsbuildinfo` build-cache diff reverted
             # first, same discipline as every prior entry — `git status
             # --porcelain -- v1 v2` empty immediately before commit). No
             # Arabic codepoint (every new/changed file swept programmatically
             # over the Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks, plus a `\u06xx`/
             # `fromCharCode` sweep — zero matches; every new line addresses
             # an email string, a password field, a boolean, an HTTP path, or
             # English prose, never corpus text).
             #
             # NOT addressed, named so a future run doesn't re-discover it as
             # new: `EmailVerificationController::verify()`'s own signed-link
             # route still has no in-app landing page — a smaller, separate
             # gap named at v3-D153. `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148); `PaywallGate` as a
             # whole class (v3-D151); multi-surah enrollment; the operational
             # mailer/7-night window (still needs a live host/SMTP/seven real
             # nights); PAY-1's Stripe fixtures; surah 67's scene beats — all
             # unchanged.
             # NOTE (v3-D153, 2026-08-29): the learner account flow —
             # `AuthController` (register/login/logout/me),
             # `PasswordResetController` and `EmailVerificationController` —
             # has existed, routed and fully server-tested since build-plan
             # step 13 with ZERO frontend callers anywhere: `grep -rln
             # "auth/register\|auth/login\|auth/logout\|forgot-password\|
             # email/verify" apps/web/lib apps/web/app apps/web/components`
             # returned nothing. CLAUDE.md's own corruption-risk ordering
             # names this exactly: "AUTH- closes before any PAY- task... an
             # RM500 lifetime buyer who forgets their password loses
             # everything" — and PAY- work (PaywallGate, TrialAttribution)
             # is already under active construction (v3-D147..D151). Fixed:
             # new `lib/account/auth.ts` (mirrors `lib/admin/session.ts`'s
             # login/logout shape) + `components/settings/AccountAuthPanel.tsx`
             # (checking / anonymous-with-create-or-sign-in / named-with-
             # verify-and-sign-out), wired into `/settings` as a new "YOUR
             # ACCOUNT" card. A second, real defect surfaced while writing
             # the RED test for login: `AuthController::login()`'s 401 (a
             # public, unauthenticated route) was being caught by
             # `apiFetch`'s B8 401-interceptor, silently clearing a live
             # device token and attempting a re-mint on a WRONG-PASSWORD
             # response — the exact "a 401 from X triggering a remint IS the
             # loop" shape `ANONYMOUS_PATH`'s own exemption already named.
             # Fixed by generalizing it: `apiFetch.ts` gained
             # `NO_REMINT_PATHS` (currently `{"/api/auth/login"}`). RED
             # confirmed at three independent points (auth.ts moved aside,
             # the NO_REMINT_PATHS check reverted, AccountAuthPanel.tsx moved
             # aside), each restored byte-identically. `TZ=UTC make test`:
             # 2455 passing (was 2432, +23 — exactly this run's new tests:
             # 14 + 8 + 1; apps/web 1210, was 1187; no other suite moved).
             # `check-test-floor.mjs`: OK, 2455 >= floor 1899 (+556 margin,
             # unmoved). `TZ=UTC make build`: exit 0, 27 routes (unchanged —
             # renders inside the existing `/settings` page). `npm run
             # gates`: all green (boundaries 280 files, up from 276 —
             # exactly the four new apps/web files; fonts degraded-but-non-
             # blocking, pre-existing; corpus-glyphs 206 codepoints,
             # unchanged). `npx tsc --noEmit`: clean. No `v1/**`/`v2/**`
             # edit (stray `v2/tsconfig.tsbuildinfo` reverted first, same
             # discipline as every prior entry). No Arabic codepoint (every
             # new/changed file swept over every Arabic block plus both
             # Presentation Forms blocks, plus a `\u06xx`/`fromCharCode`
             # sweep — zero matches; every new line addresses an email
             # string, a boolean, an HTTP path, or English prose, never
             # corpus text). NOT addressed: the reset-password CONFIRMATION
             # screen (a new public route consuming the emailed token —
             # `requestPasswordReset`, the send-link half, is wired, but
             # nothing yet lets a learner complete a reset; the more urgent
             # half of the very risk this fix's own motivating rule names,
             # left for a near-future run); `EmailVerificationController
             # ::verify()`'s signed-link route still has no in-app landing
             # page; `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `TrialAttribution` (v3-D148);
             # `PaywallGate` as a whole class (v3-D151); multi-surah
             # enrollment; the 7-night window; PAY-1's Stripe fixtures;
             # surah 67's scene beats. See DECISIONS.md v3-D153.
             # NOTE (v3-D152, 2026-08-29): `lib/workbench/sign.ts
             # #describeCertification()` — v3-D22's own claim rule, "the ONE
             # function built to answer 'may this UI say a scholar verified
             # this'" — had zero callers anywhere, unit-tested since it
             # landed but never wired into the `/workbench` frontier pane
             # that is its one natural home. Sharper than this build's usual
             # zero-caller shape: `check-boundaries.mjs` clause 15 already
             # existed, written by a prior run specifically anticipating
             # this gap, and its own header said so: "no shipped surface
             # renders a certification claim today, so the invariant
             # currently holds VACUOUSLY." An admin looking at the
             # `VERIFICATION FRONTIER` pane, even 100% green, had no
             # on-screen way to tell whether any row was ever signed by a
             # human qari versus AI-only — the API already sent the raw
             # `verifications` rows needed to answer that (step 15), and
             # every client reader discarded them. Fixed by moving
             # `Tier`/`ReviewerKind`/`VerificationRow` into `frontier.ts`
             # (the wire-contract module, re-exported from `sign.ts` for
             # `QariMode.tsx`'s existing import), adding `verifications?:
             # VerificationRow[]` to `FrontierResponse`, and having
             # `loadFrontier` compute `describeCertification(rows ?? [],
             # worklist.allGreen)` once and carry it as a new required
             # `certification` field on `FrontierLoad`'s ready state.
             # `FrontierNavigator.tsx` prints `.sentence` verbatim beneath
             # the header — the component still decides nothing about WHAT
             # may be claimed. Deliberately renamed the CSS modifier from
             # the obvious `wb-cert--scholar` to `wb-cert--affirmed` after
             # confirming (both by replaying clause 15's own regex and by
             # re-running the real gate) that the obvious name would NOT
             # have tripped it on this line, but a future edit easily could.
             # RED confirmed directly: `git stash` of the five source files
             # (test kept) reran `workbench-ui.test.tsx` — exactly 5 of 26
             # failed (`getByTestId` misses, `Cannot read properties of
             # undefined` crashes), 21 unaffected; restored byte-identically,
             # 26/26 green. `TZ=UTC make test`: 2432 passing (was 2427, +5 —
             # exactly this run's new tests; apps/web 1187, was 1182; no
             # other suite moved). `check-test-floor.mjs`: OK, 2432 >= floor
             # 1899 (+533 margin, unmoved). `TZ=UTC make build`: exit 0, 27
             # routes (unchanged — renders inside the existing `/workbench`
             # page). `npm run gates`: all green, including the clause this
             # run closes (boundaries 277 files, up from 276; fonts
             # degraded-but-non-blocking, pre-existing; corpus-glyphs 206
             # codepoints, unchanged). `npx tsc --noEmit`: clean. No
             # `v1/**`/`v2/**` edit (stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff reverted first, same discipline as every
             # prior entry). No Arabic codepoint (the full diff swept
             # programmatically over every Arabic block plus both
             # Presentation Forms blocks — zero matches; every new line
             # addresses a boolean, a wire field name, a CSS class, or
             # English prose, never corpus text). NOT addressed:
             # `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `TrialAttribution` (v3-D148);
             # `PaywallGate` as a whole class (v3-D151); multi-surah
             # enrollment; the 7-night window (still needs a live
             # host/SMTP/seven real nights); PAY-1's Stripe fixtures; surah
             # 67's scene beats. See DECISIONS.md v3-D152.
             # NOTE (v3-D151, 2026-08-29): v3-D07, verbatim: "a limited free
             # trial (one surah, OR 14 days)". `PaywallGate::permitsIssuance()`
             # (PHP) and its client mirror `lib/entitlement/gate.ts` had only
             # ever checked the SURAH half — `trial_started_at` (written since
             # 2026-08-10 by `TrialAttribution::apply()`) had zero readers
             # anywhere, and `GET /api/entitlement` never even put it on the
             # wire. Concretely: once M7's checkout ships, a real trial learner
             # 200 days in would be treated identically to one 2 minutes in —
             # only choosing a SECOND surah ever ended their trial. Fixed both
             # sides: `PaywallGate`'s Trial branch now denies (code
             # `trial_expired`) once `now - trial_started_at >=
             # config('pricing.trial.days') * 86400000`, even for the trial
             # surah itself; an unstarted trial (`trial_started_at === null`)
             # has no clock to violate. `EntitlementController::show()` now
             # carries `trialStartedAt`; the client mirror gained the
             # identical check against a new `TRIAL_DAYS_MS` constant, kept in
             # agreement with `config/pricing.php` by a new
             # `trial-config-agreement.test.ts` (the same raw-PHP-scan pattern
             # v3-D150 established for `OFFLINE_TTL_MS`). Caught while writing
             # the client test: `permitsIssuance`'s offline-cache staleness
             # check (7-day `OFFLINE_TTL_MS`) runs BEFORE the trial branch, so
             # a test that advanced only `now` (not `cachedAt`) past the
             # 14-day mark went stale-but-owned first and passed vacuously —
             # fixed by advancing `cachedAt` alongside `now`, matching this
             # file's own pre-existing "denied identically at day 1 and year
             # 10" convention. RED confirmed at every layer (PHP, controller,
             # TS gate), each reverted byte-identically. `TZ=UTC make test`:
             # 2427 passing (was 2419, +8 — exactly this run's new tests: 3
             # PHPUnit + 5 vitest; no other suite moved). `check-test-floor
             # .mjs`: OK, 2427 >= floor 1899 (+528 margin, unmoved). `TZ=UTC
             # make build`: exit 0, 27 routes (unchanged). `npx tsc --noEmit`:
             # clean. No `v1/**`/`v2/**` edit. No Arabic codepoint (full diff
             # + the one new file swept over every Arabic block plus both
             # Presentation Forms blocks — zero matches; every new line
             # addresses a day count, a millisecond constant, a config key, or
             # PHP/TS prose, never corpus text). NOT addressed:
             # `PaywallGate` as a WHOLE class still has zero production
             # callers — this fixes what it COMPUTES, not whether anything
             # calls it; wiring it into session assembly needs Firdaus's
             # still-open call on review-vs-new-content in one mixed queue
             # (v3-D88, unresolved). `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `TrialAttribution` (v3-D148); multi-surah enrollment; the
             # 7-night window (still needs a live host/SMTP/seven real
             # nights); PAY-1's Stripe fixtures; surah 67's scene beats. See
             # DECISIONS.md v3-D151.
             # NOTE (v3-D150, 2026-08-29): `config('pricing.offline_ttl_days')`
             # had zero Laravel-side readers (confirmed again this run) while
             # `apps/web/lib/entitlement/cache.ts#OFFLINE_TTL_MS` independently
             # hardcoded the identical value — v3-D149's own "not addressed"
             # list named this exactly. Unlike most of this build's config/
             # zero-caller gaps, the fix is NOT a live wire: the TTL is a pure
             # client-side cache-staleness policy with no server-side use
             # (`GET /api/entitlement` correctly carries no TTL field), so
             # inventing an HTTP config-fetch path for one integer would be
             # the exact speculative new pattern v3-D149 declined to build.
             # Fixed on the v3-D137 `MacroFacts` mirror-agreement template
             # instead: new `apps/web/lib/entitlement/cache-config-agreement
             # .test.ts` reads `api/config/pricing.php`'s raw text (the same
             # raw-file-scan technique `PricingConstantsTest
             # ::test_no_price_literal_exists_outside_the_pricing_config`
             # already uses, here run in reverse — a vitest test reading PHP
             # source) and asserts `OFFLINE_TTL_MS === parsedDays * 24 * 60 *
             # 60 * 1000`. Both docblocks now point at the real guard instead
             # of merely claiming agreement in prose. RED confirmed both
             # directions independently, each reverted byte-identically:
             # mutating `offline_ttl_days` 7→14 failed the new test exactly
             # (`- 1209600000 / + 604800000`); separately, mutating
             # `OFFLINE_TTL_MS` to 3 days failed it again on the same
             # assertion with the new numbers (`- 604800000 / + 259200000`).
             # `TZ=UTC make test`: 2419 passing (was 2418, +1 — exactly this
             # run's new test; apps/web alone 1177, was 1176). `check-test-
             # floor.mjs`: OK, 2419 >= floor 1899 (+520 margin, unmoved).
             # `TZ=UTC make build`: exit 0, 27 routes (unchanged — no route/UI
             # touched). `npm run gates`: all green (fonts degraded-but-non-
             # blocking, pre-existing; boundaries 276 files, up from 275 —
             # exactly the one new test file; corpus-glyphs 206 codepoints,
             # unchanged). No `v1/**`/`v2/**` edit (stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted first, same
             # discipline as every prior entry). No Arabic codepoint (all
             # three changed/new files swept over the Arabic, Arabic
             # Supplement, Arabic Extended-A and both Presentation Forms
             # blocks — zero matches; every new line addresses a day count, a
             # millisecond constant, a file path, or PHP/TS prose, never
             # corpus text). NOT addressed: this run's sweep did not extend
             # beyond the one item v3-D149 already named —`rhymeClassOf()`
             # (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `TrialAttribution` (v3-D148);
             # multi-surah enrollment; the 7-night window itself (still needs
             # a live host/SMTP/seven real nights); PAY-1's Stripe fixtures;
             # surah 67's scene beats. See DECISIONS.md v3-D150.
             # NOTE (v3-D149, 2026-08-28): `config('nightly.sample_size')`
             # ("How many learners the fold check samples per night") was
             # written, documented, and never read by anything —
             # `DeterminismCheckCommand`'s own signature hardcoded a SECOND,
             # independent default (`{--sample=50}`), and the scheduled
             # nightly invocation (`routes/console.php`) never passes
             # `--sample` at all. So `NIGHTLY_SAMPLE_SIZE` had ZERO effect on
             # the run that actually feeds the 7-consecutive-green-nights
             # launch-gate ledger every night — a config knob silently
             # doing nothing, one layer up from this build's usual
             # "controller never built" gap (found by extending the
             # zero-caller sweep to config KEYS, not just classes/routes).
             # Fixed: the signature's hard default is removed; `runFold()`
             # now falls back to `config('nightly.sample_size', 50)` only
             # when `--sample` is genuinely absent — an explicit `--sample`
             # still wins (the existing `PerUserFoldLockWiringTest` cases,
             # which always pass it explicitly, are unaffected). RED
             # confirmed directly: a new test seeds 3 clean learners, sets
             # `config(['nightly.sample_size' => 2])`, runs the command with
             # NO `--sample` flag (exactly what the schedule does), and
             # asserts `report['usersChecked'] === 2` — against the
             # untouched command this failed exactly as predicted (`3` vs
             # `2`, all three sampled, config ignored); mutation-verified via
             # `git stash` of the source file alone, tests kept — identical
             # RED reproduced, reverted byte-identically, 13/13 green again.
             # `php artisan test`: 341 passing (was 339, +2). `TZ=UTC make
             # test`: 2418 passing (was 2416, +2; no other suite moved).
             # `check-test-floor.mjs`: OK, 2418 >= floor 1899 (+519 margin,
             # unmoved). `TZ=UTC make build`: exit 0, 27 routes (unchanged —
             # backend-only fix, no route/UI touched). No `v1/**`/`v2/**`
             # edit (stray `v2/tsconfig.tsbuildinfo` reverted first, same
             # discipline as every prior entry). No Arabic codepoint (both
             # changed files swept over the Arabic, Arabic Supplement,
             # Arabic Extended-A and both Presentation Forms blocks — zero
             # matches; every new line addresses a learner count, a config
             # key, or a PHP identifier, never corpus text). NOT addressed:
             # `config('pricing.offline_ttl_days')` has the identical
             # zero-Laravel-reader shape but a matching hardcoded value
             # already lives in `apps/web/lib/entitlement/cache.ts` with no
             # established Next→Laravel config-sharing pattern to fix it
             # through (smaller, less clean-cut, left for a future run);
             # `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `TrialAttribution` (v3-D148);
             # multi-surah enrollment; the 7-night window itself (still
             # needs a live host/SMTP/seven real nights); PAY-1's Stripe
             # fixtures; surah 67's scene beats. See DECISIONS.md v3-D149.
             # NOTE (v3-D148, 2026-08-28): `billing_events` — the RAW webhook
             # journal `WebhookHandler::ingest()` writes on every inbound
             # Stripe delivery, `insertOrIgnore`-first-then-`outcome`-updated
             # — had a fully-cast model (`App\Models\BillingEvent`, a
             # `user()` relation) since step 23 with ZERO readers anywhere:
             # `grep -rln "BillingEvent::" app/Http` returned nothing. A
             # DIFFERENT table than the one v3-D141/D147's admin billing
             # surface already wired — `AdminBillingController::index()`
             # reads `entitlement_transitions` (the DERIVED state-change
             # log, which only gains a row when a webhook actually changes
             # state); a delivery that fails to parse, hits an unhandled
             # type, or throws mid-`process()` leaves NOTHING there — only a
             # row in the raw journal, with `outcome: "ignored_unhandled"`
             # or `outcome: "error"` and the real exception message. Same
             # "written, populated, zero read surface" shape this build has
             # closed four times before (`admin_audit` v3-D129,
             # `flag_ramp_audit` v3-D130, `entitlement_transitions` v3-D141,
             # `purge_ledger` v3-D142), missed here because each of those
             # four looked only at the table its own ticket named. Fixed:
             # new `Admin\BillingEventsController::index()` (`GET
             # /api/admin/billing/events`, read-only, no write route
             # registered) + `lib/admin/billingEvents.ts` +
             # `BillingEventsPanel` added beneath the existing
             # `BillingAuditPanel` on `/settings/billing` (no new route).
             # `userId`/`outcome` filters and `user_id` pseudonymization
             # mirror every other admin audit viewer.
             #
             # A SECOND, DEEPER BUG surfaced while writing the RED test for
             # pseudonymization: `billing_events.user_id` (nullable,
             # `nullOnDelete`, with a full `user()` relation) was NEVER
             # WRITTEN by anything — `WebhookHandler::ingest()`'s
             # `insertOrIgnore` and both later `->update()` calls all
             # omitted it, so every journal row in production has been
             # permanently `user_id: null` since step 23, defeating the
             # `?userId=` filter and the one correlation an operator would
             # actually want. Not hypothetical — the first RED run of
             # `test_the_subject_is_pseudonymized_not_the_raw_user_id`
             # failed genuinely (null where a real pseudonym was expected)
             # against the untouched `WebhookHandler`. Fixed in the same
             # file: `resolveEntitlement($event)` now runs ONCE in
             # `ingest()` itself (`process()` takes it as a parameter,
             # avoiding a second DB read) and its `user_id` is threaded into
             # both `update()` calls, including the error path.
             #
             # RED confirmed at three independent layers: backend
             # (`BillingEventsController.php` moved aside + the route
             # addition reverted) — all 9 new PHPUnit cases failed on 404;
             # restored, then 2 of 9 STILL failed genuinely before
             # `WebhookHandler.php` was touched (the `user_id` bug, proving
             # the test caught a real gap, not a tautology); frontend
             # (`billingEvents.ts`/`BillingEventsPanel.tsx` never existed
             # before this run, so their absence was the RED signal) — 8 + 6
             # cases, all green after. `TZ=UTC make test`: 2416 passing (was
             # 2393, +23 — exactly this run's new tests: 9 PHPUnit + 8 + 6
             # vitest; no other suite moved). `check-test-floor.mjs`: OK,
             # 2416 >= floor 1899 (+517 margin, unmoved). `TZ=UTC make
             # build`: exit 0, 27 routes (unchanged — renders inside the
             # existing `/settings/billing` page). `npm run gates`: all
             # green (fonts degraded-but-non-blocking, pre-existing;
             # boundaries 275 files, up from 271 — exactly the four new
             # apps/web files). `npx tsc --noEmit`: clean, `Version 5.9.3`
             # confirmed. No `v1/**`/`v2/**` edit (`git status --porcelain
             # -- v1 v2` empty immediately before commit — a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted first,
             # same discipline as every prior entry). No Arabic codepoint
             # (every changed/new file swept over the Arabic, Arabic
             # Supplement, Arabic Extended-A and both Presentation Forms
             # blocks — zero matches; every new line addresses a provider
             # event id, an outcome by closed-set string, a PHP-identifier
             # error message, or a user id, never corpus text). NOT
             # addressed: a single-event detail view (the raw `payload`,
             # deliberately withheld from the list) is real, separate,
             # smaller follow-up work; `App\Billing\TrialAttribution` is a
             # fully-built, zero-caller class found during this same sweep,
             # traced to the identical root cause v3-D147 already named (no
             # code path creates the first `Entitlement` row — a real,
             # separate, Stripe-checkout-gated M7 scope item, not a new
             # gap); `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); multi-surah enrollment; the
             # operational mailer/7-night window; PAY-1's Stripe fixtures;
             # surah 67's scene beats. See DECISIONS.md v3-D148.
             # NOTE (v3-D147, 2026-08-28): `EntitlementMachine::CAUSE_ADMIN_OVERRIDE`
             # (one of four declared transition causes, alongside
             # CAUSE_WEBHOOK/CAUSE_TRIAL_START/CAUSE_RECONCILE — all three of
             # which have real callers) existed since M7 shipped with zero
             # callers anywhere. `AdminBillingController`'s own header said
             # "READ-ONLY BY CONSTRUCTION" — true, and also the entire gap: a
             # test (v3-D141) had already manufactured an EntitlementTransition
             # row with this cause directly via Eloquent, specifically to prove
             # the READ side's actor-pseudonymization was "ready for that day"
             # that never arrived — the same "tests the read side, no write
             # side exists" shape as v3-D129/D130/D141/D142/D143. Fixed: new
             # `AdminBillingController::override()` (`POST
             # /api/admin/billing/{userId}/override`, admin-gated, >=10-char
             # reason, optional state/tier via EntitlementState::tryFrom/
             # EntitlementTier::tryFrom, at least one required) routes through
             # the SAME guarded `EntitlementMachine::apply()` every webhook
             # uses — never a raw `Entitlement::update()` — passing the calling
             # admin's own id as `actor` for the first time ever (every other
             # cause still passes 'system'). Deliberately scoped to
             # state/tier only — no provider/period/grace fields, which would
             # let an admin fabricate or backdate a real payment relationship.
             # `lib/admin/billingAudit.ts` gained `submitBillingOverride()` +
             # `BillingStateValue`/`BillingTierValue`/`BillingOverrideInput`/
             # `BillingOverrideOutcome` (named WITHOUT the word
             # check-boundaries.mjs clause 9 forbids outside its allowlist —
             # the first draft used `EntitlementStateValue`/
             # `overrideEntitlement` and tripped 18 real violations on `make
             # build`, renamed and reran clean); `BillingAuditPanel.tsx` gained
             # the override form beneath the existing read table.
             #
             # ALSO FOUND, real but genuinely out of scope, named so a future
             # run doesn't re-discover it: no code path anywhere in `v3/api`
             # ever creates the FIRST `Entitlement` row for a real user — no
             # checkout route/controller exists at all. Row provisioning is
             # M7's still-unbuilt checkout flow, the same Stripe-account-gated
             # scope PAY-1 already names. `override()` requires an EXISTING
             # row (404 otherwise) rather than guessing defaults for one.
             #
             # RED confirmed at all three layers before implementing: 7 new
             # `AdminBillingTest` cases all failed (404s — the route did not
             # exist), 5 new `billingAudit.test.ts` cases all failed
             # (`submitBillingOverride is not a function`), 3 new
             # `billing-audit-panel.test.tsx` cases all failed (no such
             # label). Mutation-verified both layers: a fake-success backend
             # response (skipping `apply()` entirely) failed exactly the
             # load-bearing state-changed assertion; a fake-success frontend
             # handler (skipping `submitBillingOverride()` entirely) failed
             # both the success- and rejection-wiring cases. Both reverted
             # byte-identically. `TZ=UTC make test`: 2393 passing (was 2378,
             # +15 — exactly this run's new tests: 7 PHPUnit + 5 + 3 vitest;
             # no other suite moved). `check-test-floor.mjs`: OK, 2393 >=
             # floor 1899 (+494 margin, unmoved). `TZ=UTC make build`: exit 0,
             # 27 routes (unchanged — renders inside the existing
             # `/settings/billing` page). `npm run gates`: all green (fonts
             # degraded-but-non-blocking, pre-existing; boundaries 271 files,
             # unchanged count). `npx tsc --noEmit`: clean. No
             # `v1/**`/`v2/**` edit. No Arabic codepoint (all seven changed
             # files swept over every Arabic block plus both Presentation
             # Forms blocks — zero matches; every new line addresses a
             # state/tier by closed-set string, a user id, a reason string,
             # or an identifier, never corpus text). NOT addressed: the
             # missing checkout-flow entitlement provisioning above;
             # `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); multi-surah enrollment; the mailer/
             # 7-night window; PAY-1's Stripe fixtures; surah 67's scene
             # beats. See DECISIONS.md v3-D147.
             # NOTE (v3-D146, 2026-08-28): `test/shell.test.ts`'s "the
             # dashboard's log-derived line is an exhaustively-stated client
             # island" test verified `components/home/LogSummary.tsx`'s shape
             # correctly but never checked it was reachable from a real
             # route — and it wasn't. `TodaySession.tsx` superseded it as
             # `/home`'s real due-count island back at build-plan step
             # 18/19 (v3-D74); nothing was ever repointed. A fresh sweep (an
             # Explore agent, excluding every already-named deferred item —
             # rhymeClassOf, EntitlementMachine::merge, multi-surah
             # enrollment, the mailer, the 7-night window, PAY-1, scene
             # beats) found this: a structurally sound, well-tested
             # component with zero wiring, the "tests pass, wiring unproven"
             # shape this build has caught before (B6, v3-D83) — here on the
             # test side. Deleted `LogSummary.tsx`; corrected `home/page.tsx`'s
             # stale doc-comment; retargeted the test to the real live file
             # (`TodaySession`'s five-way state union, a superset of
             # `LogSummary`'s four) plus a new permanent wiring assertion
             # (`home/page.tsx` must render `<TodaySession/>`) and a new
             # test asserting `LogSummary.tsx` no longer exists at all. RED
             # confirmed directly: a temporary probe asserting `/home`
             # rendered `<LogSummary/>` failed exactly as predicted (1
             # failed, 43 passed) before any fix; folded into the real fix
             # rather than left running. `TZ=UTC make test`: 2378 passing
             # (was 2377, +1 — exactly this run's net new test). `check-
             # test-floor.mjs`: OK, 2378 >= floor 1899 (+479 margin, unmoved).
             # `TZ=UTC make build`: exit 0, 27 routes (unchanged). `npm run
             # gates`: all green (fonts degraded-but-non-blocking,
             # pre-existing; boundaries 271 files, down from 272 — exactly
             # the one deleted file). `npx tsc --noEmit`: clean. No
             # `v1/**`/`v2/**` edit. No Arabic codepoint (the two changed
             # files swept over every Arabic block plus both Presentation
             # Forms blocks — zero matches). NOT addressed: the sweep's
             # other candidate, `AccountDeletionRequest::isDue()` (a
             # zero-caller convenience method; `PurgeDueAccountsCommand`
             # already does the equivalent check at the query level, so
             # nothing is misleading about it — left alone deliberately, see
             # DECISIONS.md v3-D146); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # multi-surah enrollment (a product decision, not a wiring
             # gap); the mailer/7-night window (infra/calendar); PAY-1
             # (needs a real Stripe account); surah 67's scene beats
             # (human-only). See DECISIONS.md v3-D146.
             # NOTE (v3-D145, 2026-08-27): `GlossDraftsController` (the MS
             # gloss authoring workflow, live and tested since build-plan
             # step 27) had been mislabeled "ratification-gated" wholesale
             # in every nightly note since v3-D125. Re-read the actual gate
             # (BUILD-PLAN's agent-deployment rule, the migration's own
             # header, the controller's own header): ratification is scoped
             # to AUTHORING MALAY CONTENT, not to building the workflow tool
             # a human authors through — the table still ships empty, and
             # `merged` (the one transition that would ship content) stays
             # refused unconditionally server-side regardless of who calls
             # it. Wired the missing scaffold: `lib/admin/glossDrafts.ts`
             # (load/save/review, never throws) + `GlossDraftsPanel.tsx`
             # (per-surah worklist, a coordinate-keyed draft form — never a
             # corpus-word picker, since this authors words the corpus
             # doesn't have yet — and exactly two review actions,
             # deliberately NO merge button anywhere) + new
             # `/settings/gloss-drafts` route. A fresh zero-caller sweep
             # this run also extended to `worker/fold-runner/src` (clean,
             # matches v3-D127) and `corpus-compiler/src` (6 candidates, all
             # verified internal-only uses, not gaps) — the two packages no
             # prior sweep had named explicitly — plus a re-check of
             # `/surah/[surah]` (new since v3-D139, added after v3-D132's
             # SSR-override fix) confirming it renders no gloss/distractor
             # text, so the SSR override gap stays not-a-live-bug. One real
             # gate catch along the way: the panel's first caption draft
             # ("cannot amber a qari signature") tripped
             # `check-boundaries.mjs`'s scholar-claim guard (v3-D22) despite
             # being a negation the guard can't parse — reworded to "cannot
             # move any ayah's verified frontier," same claim, no trigger
             # phrase. `TZ=UTC make test`: 2377 passing (was 2359, +18 —
             # exactly this run's new tests: 10 + 8; no other suite moved).
             # `check-test-floor.mjs`: OK, 2377 >= floor 1899 (+478 margin,
             # unmoved). `TZ=UTC make build`: exit 0, 27 routes (was 26 —
             # `/settings/gloss-drafts` is new). `npm run gates`: all green
             # (fonts degraded-but-non-blocking, pre-existing; boundaries
             # 272 files, up from 266 — exactly the six new files — green
             # only after the caption reword, a real RED from the gate
             # itself). `npx tsc --noEmit`: clean. No `v1/**`/`v2/**` edit.
             # No Arabic codepoint (all five new files swept over every
             # Arabic block plus both Presentation Forms blocks — zero
             # matches; every string is workflow prose, a coordinate
             # integer, or a closed-set value, never gloss content). NOT
             # addressed: `rhymeClassOf()` (v3-D136); the SSR override
             # gap's other leftover items (v3-D132, unchanged);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144, correctly
             # deferred — real M6 scope); the operational mailer's live-SMTP
             # gap and the 7-night window (both infra/calendar, unchanged).
             # See DECISIONS.md v3-D145.
             # NOTE (v3-D144, 2026-08-27): `LAUNCH-CHECKLIST.md` gate 20 and
             # `routes/console.php`'s own `onFailure` comment both still said
             # "no mail dispatch exists... no operational mailer configured"
             # for the P1 pager — false since v3-D82 (2026-08-13), which built
             # `DeterminismCheckCommand::record()`'s real `pageOnCall()` +
             # `App\Mail\DeterminismP1Alert`, proven by
             # `DeterminismP1PagerTest.php`. Both documents corrected to say
             # what actually remains: a live SMTP account/config in
             # production and BUILD-PLAN Q12 (who is on call), not the
             # send-mail code. Documentation-only; test/build numbers
             # unchanged. A fresh zero-caller sweep across engine/api/apps-web
             # found nothing else safely in scope (see DECISIONS.md v3-D144
             # for the full write-up, incl. a ruled-out B6-shaped hypothesis
             # on `test.ts#isCorrectChoice` and the confirmed-real-but-out-
             # of-scope `EntitlementMachine::merge()` gap).
             # NOTE (v3-D143): the 7-consecutive-green-nights window
             # (BUILD-PLAN M10's launch gate, `NightlyWindowLedger::status()`)
             # was readable only via `php artisan nightly:window` on a
             # machine with SSH access — no HTTP route, no admin screen, ever
             # read `NightlyCheckRun`/`NightlyWindow` back, the same "built +
             # populated + zero read surface" shape v3-D129/D130/D141/D142
             # each closed for `admin_audit`/`flag_ramp_audit`/
             # `entitlement_transitions`/`purge_ledger`. HANDOVER.md's own C5
             # names the consequence directly: a human has to check the CLI
             # daily by hand, and (H5) nobody is paged on a P1 either — that
             # manual daily check was the ENTIRE safety net for the one gate
             # that blocks public launch. Fixed on the same template:
             # `Admin\NightlyWindowController::index()` (`GET
             # /api/admin/nightly-window`, read-only, a thin pass-through of
             # `NightlyWindowLedger::status()` — no second implementation of
             # the streak arithmetic) + `lib/admin/nightlyWindow.ts` +
             # `NightlyWindowPanel.tsx`, added beneath the existing
             # `SystemHealthPanel` on `/settings/health` (already hosts "the
             # two nightly determinism checks" this window is derived from —
             # no new route needed). A confirmed P1 renders as an explicit,
             # visible alert naming the night and the check, not just a lower
             # streak number. READ-ONLY BY CONSTRUCTION: this screen may
             # never declare or reset the window — that stays
             # `nightly:window --start`, BUILD-PLAN's own required human CLI
             # action. RED confirmed at all three layers (backend
             # route+controller moved aside, fetch client moved aside, panel
             # component moved aside; each failed on 404 or module
             # resolution, each restored byte-identically and reran green).
             # `TZ=UTC make test`: 2359 passing (was 2340, +19 — exactly this
             # run's new tests: 6 PHPUnit + 7 + 6 vitest). `check-test-floor.mjs`:
             # OK, 2359 >= floor 1899 (+460 margin). `TZ=UTC make build`: exit
             # 0, 26 routes (unchanged — `/settings/health` already existed).
             # `npm run gates`: all green (boundaries 266 files). `npx tsc
             # --noEmit`: clean. No `v1/**`/`v2/**` edit. No Arabic codepoint
             # (every new/changed file swept over the Arabic, Arabic
             # Supplement, Arabic Extended-A and both Presentation Forms
             # blocks — zero matches). NOT addressed: `rhymeClassOf()`
             # (v3-D136); `GlossDraftsController` (ratification-gated); the
             # SSR override gap's leftover items (v3-D132); the
             # account-adoption frontend (v3-D88..D94, deliberately
             # deferred); the operational mailer gap (HANDOVER.md C5/gate
             # 20 — a confirmed P1 is now visible on this screen but still
             # pages nobody); the TEST-FLOOR margin (left unmoved on
             # purpose). See DECISIONS.md v3-D143.
             # NOTE (v3-D142): a fresh sweep for this build's recurring
             # "mechanism built and tested, zero production caller" class
             # (v3-D82 onward) found `purge_ledger` — the PDPA hard-purge
             # audit trail `pdpa:purge-due` (scheduled nightly since v3-D79)
             # writes to on every hard delete — had a real writer and zero
             # admin-facing readers, the same "written, never read" shape
             # v3-D129/D130/D141 each closed for `admin_audit`/
             # `flag_ramp_audit`/`entitlement_transitions`. An operator asked
             # "was learner X actually purged, and when" had a database
             # console and nothing else. Fixed on the same template:
             # `Admin\PurgeLedgerController::index()` (`GET
             # /api/admin/purge-ledger`, read-only) + `lib/admin/purgeLedger.ts`
             # + `PurgeLedgerPanel.tsx`, added beneath the existing
             # `PrivacyPanel` on `/settings/privacy` (no new route needed —
             # that page already hosts the other privacy-plane tools). RED
             # confirmed at all three layers (backend route+controller moved
             # aside, fetch client moved aside, panel component moved aside;
             # each failed on 404 or module resolution, each restored
             # byte-identically and reran green). `TZ=UTC make test`: 2340
             # passing (was 2320, +20 — exactly this run's new tests: 7
             # PHPUnit + 7 + 6 vitest). `check-test-floor.mjs`: OK, 2340 >=
             # floor 1899 (+441 margin). `TZ=UTC make build`: exit 0, 26
             # routes (unchanged — `/settings/privacy` already existed).
             # `npm run gates`: all green (fonts degraded-but-non-blocking,
             # pre-existing; boundaries 263 files, up from 259 — exactly the
             # four new apps/web files). `npx tsc --noEmit`: clean. No
             # `v1/**`/`v2/**` edit. No Arabic codepoint (every new/changed
             # file swept over the Arabic, Arabic Supplement, Arabic
             # Extended-A and both Presentation Forms blocks — zero matches).
             # NOT addressed: `rhymeClassOf()` (v3-D136);
             # `GlossDraftsController` (ratification-gated); the SSR override
             # gap's leftover items (v3-D132); the account-adoption frontend
             # (v3-D88..D94, deliberately deferred); the TEST-FLOOR margin
             # (left unmoved on purpose, v3-D95 onward). See DECISIONS.md
             # v3-D142.
             #
             # NOTE (v3-D141 — backfilled): commit `57cb7c3` wired the admin
             # billing surface (`Admin\AdminBillingController`, `GET
             # /api/admin/billing`, `lib/admin/billingAudit.ts`,
             # `BillingAuditPanel`, new `/settings/billing` route) closing
             # `entitlement_transitions`'s own "written, never read" gap —
             # same shape as v3-D129/D130. That commit's own message cited
             # "DECISIONS.md v3-D141 for the full writeup," but no such entry
             # was ever written, and this running comment was never updated
             # to the 2320 the commit itself reported. This note and a short
             # DECISIONS.md entry ("v3-D141 documentation gap") record that
             # the gap exists and point at the commit's own diff and test
             # file (`AdminBillingTest.php`, 8 cases) as the honest record of
             # what that run did, rather than fabricating a RED-confirmation
             # narrative this run did not itself perform.
             # NOTE (v3-D140): the daily anchor hour (`daybound.ts#anchorTime()`,
             # `User.anchor_hour`, `AuthController`'s `anchorHour` field on every
             # identity response) has existed since build-plan steps 5/13 with no
             # write path anywhere in `v3/api` and no reader anywhere in
             # `apps/web` — the value was silently discarded on arrival
             # (`apiFetch.ts#mintAnonymous` parses it into `AnonymousIdentity`
             # and never reads it again). Found by a fresh sweep of areas the
             # prior ~50 "built and tested, zero production caller" runs
             # (v3-D82 through v3-D139) had not explicitly checked clean:
             # `corpus-compiler/src`, `api/app` outside `Http/Controllers`, and
             # a full export sweep of `apps/web/lib`+`components`. Confirmed
             # via grep that `cfg.anchorHour` has exactly one reader anywhere in
             # `packages/engine/src` (`anchorTime()` itself) — it genuinely does
             # not change what the scheduler does tomorrow, which is why this
             # stayed OUT of onboarding: `lib/onboarding/choices.ts`'s own
             # header requires every captured field to "name the engine
             # function that consumes it," and this one doesn't.
             #
             # Fixed as a Settings-only preference, deliberately not a new
             # onboarding screen or a notification feature (the landing page's
             # own FAQ promises "no guilt notifications... a reminder that they
             # failed" — this run built no delivery mechanism of any kind, only
             # a stored preference and a display of it): new
             # `SettingsController` (`GET`/`POST /api/settings`, a near-verbatim
             # port of v2's own controller of the same name) +
             # `lib/settings/anchorHour.ts` (the `apiFetch`-only client,
             # mirroring `lib/account/api.ts`'s never-throws discipline) + a new
             # `AnchorHourPanel` card added to the existing `/settings` page.
             # `ANCHOR_CHOICES` (six secular, no-prayer-name time labels) is
             # ported verbatim from v2's `session/anchor.ts`.
             #
             # RED confirmed at all three layers: backend (`SettingsController`
             # moved aside + the two new route lines reverted, test kept) —
             # 404 on all 7 new PHPUnit cases; the fetch client (`anchorHour.ts`
             # moved aside, test kept) — module-resolution failure on all 6; the
             # component (`AnchorHourPanel.tsx` moved aside, the 5 new cases in
             # `test/settings-ui.test.tsx` kept) — module-resolution failure on
             # all 5. Each restored byte-identically and reran green. The
             # load-bearing component case proves a rejected save keeps
             # reporting the PREVIOUS confirmed value, never the failed
             # attempt — a bug this run's own first draft had, caught and fixed
             # during authoring before any test ran against it.
             #
             # `TZ=UTC make test`: 2299 passing (was 2281, +18 — exactly this
             # run's new tests: 7 PHPUnit + 6 + 5 vitest; no other suite moved).
             # `check-test-floor.mjs`: OK, 2299 >= floor 1899 (+400 margin).
             # `TZ=UTC make build`: exit 0, 25 routes (unchanged — `/settings`
             # already existed, this adds a card not a route). `npm run gates`:
             # locked-css OK, fonts degraded-but-non-blocking (pre-existing),
             # boundaries OK (253 files, up from 250 — exactly the three new
             # apps/web files), corpus-morphology OK, corpus-glyphs OK (206
             # codepoints, unchanged). `npx tsc --noEmit`: clean. No
             # `v1/**`/`v2/**` edit (stray `v2/tsconfig.tsbuildinfo` reverted
             # before committing). No Arabic codepoint (every new/changed file
             # swept over the Arabic, Arabic Supplement, Arabic Extended-A and
             # both Presentation Forms blocks — zero matches; every new line
             # addresses an hour, an English label ported verbatim from v2's
             # own copy, a boolean, or an href/testid string, never corpus
             # text). NOT addressed: `rhymeClassOf()` (v3-D136);
             # `GlossDraftsController` (ratification-gated); the SSR override
             # gap's leftover items (v3-D132); v2's "anchor adherence" admin
             # metric — v3 has no `AdminMetrics` equivalent at all, porting one
             # is real, separate, larger scope. See DECISIONS.md v3-D140.
             # NOTE (v3-D139): `/surah/[surah]`'s AYAT section rendered exactly
             # one hardcoded row, "Ayah 1", regardless of which surah was open
             # or how many ayat it has — a real, currently-reachable defect
             # (this route is linked from the dashboard's "MY SURAHS" list and
             # the library). `lib/progress/rows.ts#rowAtomKey`'s own docblock
             # already named the intended caller ("Exported for the surah
             # page's own use") that never existed. Also closed, negatively:
             # v3-D138's own flagged-but-unconfirmed `glossLang` worry —
             # traced directly, `/test` IS gloss-language's sole consumer BY
             # DESIGN (`ladder.ts`'s own header: S1 meaning items never grade
             # strength, and `s1Options`'s only caller anywhere is
             # `test.ts#vocabItem`), not an unwired gap.
             #
             # Fixed: new `components/surah/SurahAyahListIsland.tsx`
             # (island + exported pure `SurahAyahListView`, the same split
             # `AyahStatsIsland.tsx#AyahStatsView` already established) reuses
             # `buildProgressRows()` — the one place `/progress/list` and the
             # ayah-detail route already trust for stage/strength — filtered
             # to `kind === "ayah"` (seams stay the macro panel's job, not a
             # second rendering of the same joints). Three states: pending →
             # skeletons never zeros (#73); empty → every ayah still gets its
             # own honest "Not started" row, never omitted; broken → says so,
             # names the reason. The page drops its hardcoded Link/StageBadge/
             # StubNote and passes the real corpus + a server-resolved `now`.
             #
             # RED confirmed directly: the new (untracked) component file
             # moved aside, test kept — `Failed to resolve import
             # ".../SurahAyahListIsland"`; restored byte-identically, 9/9
             # green. The load-bearing case seeds 9 real `ayah_produced`
             # events through the actual `rebuild()`/`buildProgressRows`
             # pipeline and asserts the rendered row does NOT read "Not
             # started" and carries a real stage dot/label/value — proving
             # the wiring, not a fixture shortcut; a second case asserts the
             # row COUNT equals the corpus's real `ayahCount` (parametrized
             # 1/4/7/10), so a regression to a different hardcoded constant
             # still fails.
             #
             # `TZ=UTC make test`: 2281 passing (was 2272, +9 — exactly this
             # run's new test file; no other suite moved). `check-test-floor.mjs`:
             # OK, 2281 >= floor 1899 (+382 margin). `TZ=UTC make build`: exit
             # 0, 25 routes (unchanged — `/surah/[surah]` already existed).
             # `npm run gates`: locked-css OK, fonts degraded-but-non-blocking
             # (pre-existing), boundaries OK (251 files, up from 250 — exactly
             # the one new component file), corpus-morphology OK, corpus-
             # glyphs OK (206 codepoints, unchanged). `npx tsc --noEmit`
             # (via next build): clean. No `v1/**`/`v2/**` edit (stray
             # `v2/tsconfig.tsbuildinfo` reverted before committing). No
             # Arabic codepoint (full diff swept over every Arabic block plus
             # both Presentation Forms blocks and a `\u06xx`/`fromCharCode`
             # sweep — zero matches; every new line addresses an ayah number,
             # a boolean, or an href/testid string; the test's own Arabic
             # comes from the real `packages/engine/test/fixtures/12.json`
             # fixture, addressed by coordinate). NOT addressed: `rhymeClassOf()`
             # (v3-D136); `GlossDraftsController` (ratification-gated); the
             # SSR override gap's leftover items (v3-D132) — all unchanged.
             # See DECISIONS.md v3-D139.
             # NOTE (v3-D138): a fresh sweep for the recurring "mechanism built
             # and unit-tested, zero production caller" bug class (v3-D82
             # onward) found `packages/engine/src/pace.ts` — the Steady/
             # Sprint/Maintain pace dial, v2-BUG-1's own fix ("v1's
             # useSession.ts hardcoded budgetMin:8, so Steady and Sprint
             # collapsed to the same drip") — had its READ half (onboarding
             # screen 6 -> `commitOnboarding`) wired but its CONSUMING half
             # missing: `lib/session/run.ts#assembleFor` built
             # `assembleQueue`'s `cfg` with `learnCandidates` only, never
             # `budgetMin`/`gateTolerance`, and never called
             # `candidatesForPace()` at all — so `choices.ts`'s own docblock
             # claim ("Every field is consumed by the scheduler") was false
             # for `pace`. A Maintain learner ("doesn't unlock at all") still
             # got new Learn items; a Sprint learner never got the 16-minute
             # budget or the looser 1-gate tolerance; and on the small 112
             # surah, Steady's own newAyahCeiling:1 was never enforced either
             # — a virgin learner's first session silently unlocked all 4
             # ayat at once, hiding in this file's own pre-existing test
             # comments as "a fact about the corpus being small."
             #
             # Fixed end to end: `assembleFor`/`StartInput` gain an optional
             # `pace` (default `DEFAULT_PACE_MODE`, so an unmigrated caller is
             # unchanged), feeding `paceConfig(pace)`'s three fields into
             # `assembleQueue` together so they cannot drift apart;
             # `lib/home/queue.ts#buildHomeSurah` (the dashboard's due-count,
             # which must equal what the session actually serves — this
             # module's own header says so) takes the same parameter;
             # `SessionGate.tsx`/`TodaySession.tsx` read `choices.pace` and
             # thread it through `SessionIsland` to `startSession`.
             #
             # RED confirmed directly: `git stash` of the six source files
             # (tests kept) failed 4 of 6 new `run.test.ts` cases exactly as
             # predicted (Steady queued 4 learn items not 1; Maintain queued
             # one at all; Sprint capped at 4 not 3; Sprint's looser gate
             # tolerance never actually unlocked); restored, 6/6 green. Two
             # PRE-EXISTING tests broke on the (correct) behavior change and
             # were updated, not weakened: a Door-1 test whose own comment
             # admitted it relied on "a single natural session already learns
             # every one of its 4 ayat" now seeds all four directly via the
             # same public `append()` a real completion uses; and
             # `test/home-today.test.tsx`'s own independent second
             # implementation of the scheduler call (`engineDueCount` — kept
             # deliberately separate from `lib/home/queue.ts` so the test
             # proves agreement with the ENGINE, not with itself) now applies
             # the same pace ceiling, so it stays an honest oracle rather than
             # a re-legitimized copy of the old bug.
             #
             # `TZ=UTC make test`: 2272 passing (was 2266, +6 — exactly this
             # run's six new cases; the two rewritten tests are net +0, no
             # other suite moved). `check-test-floor.mjs`: OK, 2272 >= floor
             # 1899 (+373 margin). `TZ=UTC make build`: exit 0, 25 routes
             # (unchanged — a data-flow fix inside existing components/lib
             # modules, no new route). `npm run gates`: locked-css OK, fonts
             # degraded-but-non-blocking (pre-existing), boundaries OK (248
             # files, unchanged — zero new files this run), corpus-morphology
             # OK, corpus-glyphs OK (206 codepoints, unchanged). `npx tsc
             # --noEmit`: clean (`Version 6.0.2` confirmed). No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff reverted before committing). No Arabic
             # codepoint (full diff swept programmatically over every Arabic
             # block plus both Presentation Forms blocks — zero matches;
             # every changed line addresses a pace-mode string literal, an
             # ayah number, a minute count, or a boolean). NOT addressed:
             # `rhymeClassOf()` (v3-D136); `GlossDraftsController`
             # (ratification-gated); the SSR override gap's leftover items
             # (v3-D132); a possible parallel gap in `glossLang` flagged but
             # NOT independently confirmed by this run's sweep (the `/test`
             # route may legitimately be gloss-language's only consumer if
             # `/session` never renders a meaning-question type) — all
             # unchanged/unconfirmed. See DECISIONS.md v3-D138.
             # NOTE (v3-D137): v3-D136's own "not addressed" list named this
             # exactly: `components/macro/facts.ts`'s docblock claimed "the
             # test suite asserts these two declarations [the compiler's
             # `MacroFacts` and the UI's structural mirror of it] stay in
             # agreement" — grep-verified false, no such test existed
             # anywhere. Every other item on BUILD-PLAN's 32-step order is
             # DONE or human/calendar-blocked (27/28 need surah 67's scene
             # beats + the qari sessions; PAY-1 needs a live Stripe account;
             # step 30's remainder needs a staging host, live SMTP, and seven
             # real elapsed nights), so this run continued the v3-D82-onward
             # pattern of closing a real, narrowly-scoped, already-named gap.
             #
             # `MacroFacts` is erased at compile time, so "the two
             # declarations agree" has no runtime object to `expect()` — the
             # only place it is checkable is inside the type checker. New
             # `apps/web/lib/macro/facts-agreement.test.ts` type-only-imports
             # both declarations and feeds them into the standard strict
             # type-equality trick (`(<T>() => T extends A ? 1 : 2) extends
             # (<T>() => T extends B ? 1 : 2)`, which also catches a lone
             # field's optionality flipping); a divergence fails `tsc
             # --noEmit` (`typecheck-v3`, already part of `make test`) right
             # on that line, naming both declarations. The import is
             # `type`-only, so — unlike `lib/macro/facts.ts`'s existing,
             # deliberate, server-only VALUE import of `classify` — it
             # produces zero runtime bytes and never risks shipping the
             # classifier to the browser, the exact risk
             # `components/macro/facts.ts`'s own header warns against.
             #
             # RED confirmed directly: added a throwaway
             # `__drift_probe_v3D137?: string` field to the UI's `MacroFacts`
             # only, ran `npx tsc --noEmit` — exactly one error, on the
             # guard's own line (`TS2344: Type 'false' does not satisfy the
             # constraint 'true'`); reverted byte-identically (`git diff`
             # empty), clean again. `npx vitest run
             # lib/macro/facts-agreement.test.ts`: 1/1 green.
             #
             # `TZ=UTC make test`: 2266 passing (was 2265, +1 — exactly this
             # run's one new test; no other suite moved). `check-test-floor.mjs`:
             # OK, 2266 >= floor 1899 (+367 margin). `TZ=UTC make build`: exit
             # 0, 25 routes (unchanged — no new route, no production source
             # file touched). `npm run gates`: locked-css OK, fonts
             # degraded-but-non-blocking (pre-existing), boundaries OK (249
             # files, up from 248 — exactly the one new file), corpus-
             # morphology OK, corpus-glyphs OK (206 codepoints, unchanged —
             # this change carries no corpus data). `npx tsc --noEmit`:
             # clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted before
             # committing). No Arabic codepoint (the new file and the
             # temporary mutation both swept over every Arabic block plus
             # both Presentation Forms blocks — zero matches; every string in
             # the new file is a TypeScript identifier, a docblock, or the
             # `"@/components/macro/facts.ts"` import specifier already used
             # verbatim by `apps/web/test/macro-facts.test.ts`). NOT
             # addressed: `rhymeClassOf()` (v3-D136's own deferred LITANY
             # rhyme-share limb); `GlossDraftsController` (still
             # ratification-gated); the SSR override gap's leftover items
             # (v3-D132: six other `loadCorpus` callers, `API_BASE_URL`,
             # E-07) — all unchanged. See DECISIONS.md v3-D137.
             # NOTE (v3-D136): v3-D43 (2026-08-11) built `macro.ts#classify()`
             # (v3-D21's ATOMIC/RING/LITANY/ARC panel classifier) and its own
             # closing note said so explicitly: "only ATOMIC was decidable...
             # every non-ATOMIC surah would silently fall to ARC." Two weeks
             # and 90+ later decisions swept this codebase for exactly this
             # bug class ("mechanism built and tested, zero production
             # caller") and never found this one, because the real caller —
             # `apps/web/lib/macro/facts.ts#macroFactsFor`, whose own header
             # already documented the gap ("WHEN THE COMPILER EMITS
             # meta.macro... this module reads it directly and the fallback
             # below stops being reachable. That is the one-line change;
             # nothing else moves") — lives in a DIFFERENT package than
             # `classify()`, importing it directly from source across the
             # monorepo boundary. Every prior sweep grepped for callers
             # WITHIN the defining package, so a cross-package caller that
             # exists but supplies no real inputs read as "wired" when it
             # was still degenerating to the classifier's own worst case.
             # Concretely, for the real launch corpus: surah 12 (Yusuf, 111
             # ayat, 12 ruku) was rendering its macro panel as ARC — the
             # exact failure mode v3-D43's own motivating example named —
             # while it should be RING.
             #
             # Fixed the RING half completely: vendored each launch surah's
             # real Tanzil ruku count (`data/raw/{12,67,103,112}-ruku.json`,
             # fetched via `curl .../verses/by_chapter/<N>?fields=ruku_number`
             # and reduced to a per-surah COUNT of distinct global ruku
             # numbers — 12/2/1/1 respectively, cross-checked against the
             # well-known Yusuf/Al-Mulk divisions) and wired it through
             # `io.ts#loadInputs` -> `buildFromInputs` -> `buildCorpus.ts`,
             # which now calls `classify({ ayahCount, rukuCount, verseTexts
             # })` unconditionally and stamps the result on a new, always-
             # present `CorpusMeta.macro` field (`types.ts`). Verse texts are
             # threaded through too, so verbatim-refrain LITANY (the
             # classifier's OTHER decidable-without-new-data limb) is also
             # now live, at no extra cost. The rhyme-share LITANY limb needs
             # a `rhymeClassOf()` this run did NOT build — no vendored rhyme
             # data or transliteration table exists yet, and inventing one
             # is real, separate scope (see below) — so a surah that is
             # genuinely LITANY-by-rhyme still degrades honestly to ARC
             # (`authored: false`) exactly as before; nothing regresses,
             # nothing is silently claimed. `evenSegments()`'s existing
             # ring-geometry choice (even partitions, not real per-ruku
             # ayah boundaries) is unchanged — this fix supplies the COUNT
             # classify() already knew how to consume, not a new algorithm.
             #
             # `macroFactsFor` needed zero changes — its own `if (meta.macro)
             # return meta.macro` branch, previously unreachable in
             # production (every real corpus lacked the field), is now the
             # live path for every compiled surah; the fallback `classify()`
             # call is now reachable only via the frozen pre-emission engine
             # fixture (`packages/engine/test/fixtures/12.json`,
             # `test/ayah-detail.test.tsx`'s own deliberately-stable source,
             # never regenerated). Also fixed in passing: that file's own
             # docblock claimed "the test suite asserts these two
             # declarations [the compiler's and the UI's mirrored
             # `MacroFacts` types] stay in agreement" — grep-verified false,
             # no such test exists anywhere. Left unfixed and named rather
             # than silently absorbed into this run's scope: it is a real,
             # separate, small gap, and this run's job was the classifier
             # wiring, not an audit of every docblock claim it touched.
             #
             # RED confirmed directly: the new `corpus-compiler/test/
             # macro-wiring.test.ts` (7 cases) was run against the tree
             # before `buildCorpus.ts`/`io.ts`/`types.ts` were touched and
             # failed all 7 on `corpus.meta.macro` being `undefined`;
             # implemented after, 7/7 green, 118/118 in the full compiler
             # suite (was 111). A companion `apps/web/test/macro-facts.test.ts`
             # (3 cases, previously ZERO coverage on this function) proves
             # `macroFactsFor` returns a present `meta.macro` OBJECT-IDENTICAL
             # (not a re-derived copy) and still falls back correctly to
             # ATOMIC/ARC when it is absent; `test/ayah-detail.test.tsx`'s
             # 42 pre-existing cases (which load the frozen engine fixture,
             # so exercise the fallback path) are unaffected — reran
             # 42/42 green, unchanged.
             #
             # `TZ=UTC make test`: 2265 passing (was 2255, +10 — exactly
             # this run's new tests: 7 corpus-compiler + 3 apps/web; no
             # other suite moved). `check-test-floor.mjs`: OK, 2265 >= floor
             # 1899 (+366 margin). `TZ=UTC make build`: exit 0, 25 routes
             # (unchanged — no new route, this is a compiler+data change).
             # `npm run gates`: locked-css OK, fonts degraded-but-non-
             # blocking (pre-existing), boundaries OK (up by one test file
             # over v3-D135's own count), corpus-morphology OK, corpus-glyphs
             # OK (206 codepoints, unchanged — `meta.macro` carries no
             # Arabic). No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted before
             # committing). No Arabic codepoint (the full diff plus all five
             # new files swept over the Arabic, Arabic Supplement, Arabic
             # Extended-A and both Presentation Forms Unicode blocks — zero
             # matches; the vendored ruku files are bare integers and a
             # documented curl URL, never corpus text).
             #
             # KNOWN SIDE EFFECT, not a defect: every compiled corpus's
             # file-level content hash (`corpusHash`, `manifest.ts
             # #corpusContentHash16`) changes, because it hashes the whole
             # serialized artifact and `meta.macro` is a genuinely new field
             # on every surah. The per-ayah qari/admin VERIFICATION hashes
             # (`hash.ts#ayahQariHash`/`ayahAdminHash`, DEFECTS.md#B3) are
             # UNCHANGED — they hash specific verse/word/gloss/distractor
             # fields only, never the meta object — so this cannot amber an
             # existing sign-off. `docs/qa-samples/*.json`'s committed
             # `corpusHash` values will read STALE on the next
             # `make content-freeze` after a recompile, the same expected,
             # already-designed-for consequence AL-MULK-SCENE-BEATS.md
             # documents for scene-beat authoring — the gate reports this
             # honestly rather than lying, and it is not something to route
             # around.
             #
             # NOT addressed, named so a future run doesn't re-discover it
             # as new: `rhymeClassOf()` (the LITANY rhyme-share limb) is
             # real, separate, scope — needs a vendored per-ayah rhyme
             # profile (not currently fetched anywhere) and a transliteration
             # scheme designed carefully enough to stay inside Absolute B
             # (a rhyme LABEL must be a transliteration, never Arabic
             # bytes); `components/macro/facts.ts`'s untested "mirror"
             # docblock claim (above); `GlossDraftsController` remains
             # gated on the unrecorded ratification (v3-D125 era); the SSR
             # override gap's own leftover items (v3-D132) are unchanged.
             # See DECISIONS.md v3-D136.
             # NOTE (v3-D135): `OverrideEditor` (v3-D125/D126/D134) still had
             # no write surface for `group` (multi-word idiom grouping) — the
             # LAST of the four override fields left unbuilt, named across
             # v3-D126/D129/D130/D131/D134's own "not addressed" lists every
             # time this file was touched. The READ side was never the gap:
             # `applyOverrides` has resolved `group` overrides (stamping
             # `CorpusWord.groupPositions`, read by `ladder.ts`'s S1 pass)
             # since DATA-1 landed; only `POST /api/overrides` with
             # `field: "group"` had zero frontend callers. Needs no word-tap,
             # same proof as distractor's own closure last run: `GroupPayload
             # #groupWith` is same-ayah-only member positions, narrower than
             # distractor's whole-surah pool, so the picker is an anchor-word
             # dropdown plus `GROUP_SLOTS` (3) "group with" dropdowns, both
             # sourced from THIS AYAH's own `words` — never a free-text
             # field, never `surahWords`. Fixed: `lib/overrides/write.ts
             # #groupOverride` (mirrors glossOverride/disableOverride/
             # distractorOverride, stamps `questionType: "s1"` matching
             # `ladder.ts`'s S1 consumer) + a new "Group words (idiom)"
             # fieldset in `OverrideEditor.tsx`, self-excluding the anchor
             # from its own replacement pool (same discipline
             # `distractorCandidates` already applies); `summarize()`'s
             # existing but previously-unreachable `group` branch now also
             # reports the member count. RED confirmed directly: `git stash`
             # of the two source files alone (5 new tests kept — 2 in
             # `write.test.ts`, 3 in `workbench-override-editor.test.tsx`)
             # failed all 5, the 19 pre-existing cases in those files
             # unaffected; restored byte-identically, 24/24 green. `TZ=UTC
             # make test`: 2255 passing (was 2250, +5 — exactly this run's
             # new tests; no other suite moved). `check-test-floor.mjs`: OK,
             # 2255 >= floor 1899 (+356 margin). `TZ=UTC make build`: exit 0,
             # 25 routes (unchanged — renders inside the existing
             # `/workbench` page). `npx tsc --noEmit`: clean. `npm run
             # gates`: all green (fonts degraded-but-non-blocking,
             # pre-existing; boundaries 246 files, unchanged count — no new
             # production file). `make doctor`: clean. No `v1/**`/`v2/**`
             # edit. No Arabic codepoint (full diff swept over every Arabic
             # block + presentation forms via a codepoint-aware scan, zero
             # matches; every new line addresses a word position, an
             # anchor/member integer, or a compound key string, never corpus
             # text — test fixtures use synthetic placeholders
             # "target"/"other"/"member"/"third", matching the file's own
             # convention). With this, **all four** override fields
             # (`gloss`, `disable`, `distractor`, `group`) have a real
             # admin/qari write surface — the override authoring layer named
             # across v3-D125/D126/D129/D130/D131/D134 is now complete. NOT
             # addressed: `GlossDraftsController` (ratification-gated); the
             # SSR override gap's own leftover items (v3-D132: six
             # `loadCorpus` callers, `API_BASE_URL`, E-07). See
             # DECISIONS.md v3-D135.
             # NOTE (v3-D134): `OverrideEditor` (v3-D125/D126) was scoped to
             # `gloss`/`disable` only — `distractor`'s own header named the
             # gap three times over ("needs a word-tap CorpusRef picker...
             # real, separate future work", repeated verbatim by v3-D132)
             # without noticing gloss/disable's OWN picker — a `<select>`
             # built from `words[].text_uthmani`, never a free-text field or
             # a tap — already satisfies the "no typed Arabic" guarantee for
             # exactly this shape; `WorkbenchIsland`'s "cannot type Arabic
             # into any answer field" is about the SPEC EDITOR's still-
             # unbuilt answer picker (§22b, a genuinely different surface),
             # not about override authoring. Fixed: `lib/overrides/write.ts
             # #distractorOverride` (mirrors glossOverride/disableOverride)
             # + a new "Replace distractors" fieldset in `OverrideEditor.tsx`
             # — a target-word dropdown (this ayah's `words`) plus 4
             # replacement-word dropdowns sourced from a new `surahWords`
             # prop (the WHOLE surah, threaded from `WorkbenchIsland`'s
             # existing `corpus.words`), keyed `${ayah}:${position}` since
             # `CorpusWord.position` is only unique within an ayah and a
             # useful replacement may come from elsewhere in the surah (the
             # foil-kernel table above: same-root, same-surah). Rank =
             # pick order; the target word is excluded from its own
             # replacement pool. `group` (idiom grouping) stays deferred —
             # smaller, rarer, real separate work. RED confirmed directly:
             # `git stash` of the three source files alone (5 new tests
             # kept — 2 in `write.test.ts`, 3 in
             # `workbench-override-editor.test.tsx`) failed all 5, the 14
             # pre-existing cases in those files unaffected; restored
             # byte-identically, 19/19 green. `TZ=UTC make test`: 2250
             # passing (was 2245, +5 — exactly this run's new tests; no
             # other suite moved). `check-test-floor.mjs`: OK, 2250 >= floor
             # 1899 (+351 margin). `TZ=UTC make build`: exit 0, 25 routes
             # (unchanged — renders inside the existing `/workbench` page).
             # `npx tsc --noEmit`: clean. `npm run gates`: all green (fonts
             # degraded-but-non-blocking, pre-existing; boundaries 246
             # files, unchanged count — no new production file). No
             # `v1/**`/`v2/**` edit. No Arabic codepoint (full diff swept
             # over every Arabic block + presentation forms, zero matches;
             # every new line addresses a word position, a rank integer, or
             # a compound key string, never corpus text — test fixtures use
             # synthetic placeholders "target"/"other"/"third", matching the
             # file's own convention). NOT addressed: `group` override
             # authoring; `GlossDraftsController` (ratification-gated); the
             # SSR override gap's own leftover items (v3-D132: six
             # `loadCorpus` callers, `API_BASE_URL`, E-07). See
             # DECISIONS.md v3-D134.
             # NOTE (v3-D133): B11's own closing note (v3-D101, 2026-08-17)
             # named a gap it deliberately left open — "a session whose only
             # work was a passed gate now shows 0 ayat completed on the
             # summary screen... a small, separate UI question" — and it sat
             # untouched through 30+ later decisions (confirmed by grepping
             # every DECISIONS.md entry since for `ayatCompleted`).
             # `packages/engine/src/sessionSummary.ts#summarizeSession`
             # counted `ayatCompleted` only from `ayah_complete`/
             # `ayah_produced` events; a completed cold gate commits
             # `gate_result` INSTEAD (by design, v3-D101/D107), so a queue
             # whose only due item was a gate (real and reachable — a due
             # gate is `floorQueue`'s own top priority, v3-D108) credited
             # nothing on `SessionIsland.tsx:591`'s real "{N} ayat" summary
             # line for a learner who had just passed their scheduling-
             # critical cold check. Fixed: a third fold branch — a PASSED
             # `gate_result` pushes its ayah onto `ayatRefs` exactly like
             # `ayah_produced`/`ayah_complete` already do, deduped against a
             # same-session rescaffold warm-up's own S2 completion for the
             # same ayah (v3-D109); a FAILED gate still counts as nothing.
             # RED confirmed twice, independently: reverting the engine
             # source alone failed the new positive `sessionSummary.test.ts`
             # case (`expected +0 to be 1`) while two same-file edge cases
             # passed vacuously against the unfixed code — proof that a
             # well-chosen positive case, not just edge cases, was
             # load-bearing here; separately, a new `run.test.ts` case drives
             # a REAL `startFloorSession` → gate completion through
             # `answerCurrent` → `sessionSummaryOf`, the exact function
             # `SessionIsland` calls, and failed identically against the
             # reverted source. That second test deliberately does NOT reuse
             # this file's own shared `playThrough` helper, which hardcodes
             # taps at a fixed `T0`-anchored `now` — harmless for every OTHER
             # assertion in the file (all read the raw log unfiltered by
             # time) but wrong for anything that depends on
             # `sessionSummaryOf`'s own `ts >= run.startedAt` slice, since a
             # real tap's `now` is always at or after its own session's
             # start; a local, correctly time-ordered loop was used instead,
             # rather than widening this fix into the 29 other call sites
             # that already rely on the helper's current shape. `TZ=UTC make
             # test`: 2245 passing (was 2241, +4 — exactly this run's new
             # tests: 3 + 1 net; no other suite moved). `check-test-floor.mjs`:
             # OK, 2245 >= floor 1899 (+346 margin). `TZ=UTC make build`: exit
             # 0, 25 routes (unchanged — no new route, no new UI, a pure
             # logic fix inside an already-wired function). `npx tsc
             # --noEmit`: clean. `npm run gates`: all green (fonts
             # degraded-but-non-blocking, pre-existing; boundaries 247 files,
             # unchanged count — no new production file). No `v1/**`/`v2/**`
             # edit. No Arabic codepoint (every new/changed file swept over
             # the Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms blocks, plus a `\u06xx`/`\u08xx`-escape and
             # `fromCharCode` sweep — zero matches; every new line addresses
             # an ayah number, a boolean, or a millisecond timestamp, never
             # corpus text). NOT addressed: the `playThrough` helper's
             # fixed-T0 timing quirk itself (real, separate, wider-reaching);
             # v3-D132's own "not addressed" list (six other `loadCorpus`
             # callers, `API_BASE_URL`, E-07) is unchanged. See DECISIONS.md
             # v3-D133.
             # NOTE (v3-D132): the SSR corpus loader (`lib/corpus/load.ts`)
             # never applied overrides — a qari/admin gloss correction
             # written through the already-shipped `POST /api/overrides`
             # reached the CLIENT drill session (v3-D96) but never a
             # server-rendered page. `/surah/[surah]/[ayah]` prints
             # `wordGloss(word)` straight from the raw corpus; `/workbench`'s
             # `explain(corpus, spec)` traces a preview against it too, so an
             # admin judging whether a correction is needed — or verifying
             # one already made — saw stale, pre-correction text from the
             # very tool built to review it. v3-D96/D110 both named this SSR
             # half explicitly and left it, reasoning the codebase "has no
             # established pattern for the Next.js server to call the
             # Laravel API over HTTP" — still mostly true, but
             # `GET /api/overrides` carries no `admin` middleware (verified
             # against `routes/api.php`), so no bearer token or 401
             # interceptor needed reinventing server-side; what remained was
             # a small, narrowly-scoped fetch. Fixed: new
             # `lib/overrides/fetchServer.ts#fetchServerOverrides` (the SSR
             # counterpart to `lib/overrides/fetch.ts`, duplicated rather
             # than imported — a `"use client"` module's plain function
             # exports do not resolve across the RSC boundary, the same
             # failure `lib/corpus/staged.ts` documents for a constant) +
             # `lib/corpus/load.ts#loadEffectiveCorpus` (mirrors
             # `lib/corpus/client.ts#EffectiveCorpus`; delegates to the
             # existing cached `loadCorpus` for the raw read, but does NOT
             # cache the override merge itself — `loadCorpus`'s cache lives
             # for the server PROCESS lifetime, and overrides are
             # admin-mutable, so caching the merge would hide a correction
             # until restart). `loadCorpus` itself is UNCHANGED; six other
             # callers (`/plan`, `/progress`, `/progress/list`, `/drill`,
             # `/practice`, `lib/library/rows.ts`) still read it directly,
             # verified by grep to render no `gloss`/`distractor` text. RED
             # confirmed by reverting the tracked source files (new files
             # moved aside, tests kept): 9 of 72 apps/web test files failed —
             # module resolution on `loadEffectiveCorpus`, plus two wiring
             # assertions against the unmodified page sources. `TZ=UTC make
             # test`: 2241 passing (was 2231, +10 — exactly this run's new
             # tests: 8 + 1 + 1; no other suite moved). `check-test-floor.mjs`:
             # OK, 2241 >= floor 1899 (+342 margin). `TZ=UTC make build`:
             # exit 0, 25 routes (unchanged — no new route). `npx tsc
             # --noEmit`: clean. `npm run gates`: all green (fonts
             # degraded-but-non-blocking, pre-existing; boundaries 246 files,
             # up from 244, two new files — `check-boundaries.mjs` clause 6
             # gained a narrowly-justified second egress exemption for
             # `fetchServer.ts`, explained in its own comment). No
             # `v1/**`/`v2/**` edit. No Arabic codepoint (every new/changed
             # file swept over the Arabic, Arabic Supplement, Arabic
             # Extended-A and both Presentation Forms blocks, plus a
             # `\u06xx`/`\u08xx`-escape and `fromCharCode` sweep — zero
             # matches; the test marker is a plain English constant over a
             # fixture coordinate). NOT addressed: the six other-callers list
             # above (none currently render override-sensitive text, so this
             # is not a partial pass); `API_BASE_URL`'s
             # `http://localhost:8001` default is a local-dev placeholder —
             # gate 20's real hosting shape is still open and should set it
             # explicitly once decided; DEFECTS.md#E-07 (per-surah corpus
             # fetch unguarded) is untouched. See DECISIONS.md v3-D132.
             # NOTE (v3-D131): `QariMode` offered the qari-tier signature to
             # every admin regardless of role — role-based UI gating,
             # named unaddressed since v3-D127 and repeated through
             # v3-D128/D129/D130's own "NOT addressed" lists.
             # `VerificationsController::store` has required
             # `AdminRole::QARI` for `tier: qari` since v3-D92,
             # server-enforced correctly; the gap was that `GET
             # /api/admin/whoami`'s own `roles` field, returned since
             # v3-D127, was read in exactly one place — the session-bar
             # string in `AdminGate` — so every admin saw "Qari tier" as a
             # live option, defaulted to it, and only learned from a 403
             # after filling in the whole form that they were never
             # eligible. Fixed: new `lib/admin/identity-context.tsx`
             # (`AdminIdentityProvider`/`useAdminRoles()`, deny-by-default —
             # `[]` with no provider, never a throw) threads the identity
             # `AdminGate` already fetches down via React context, no
             # second `/whoami` call. `QariMode` disables the qari-tier
             # radio (with a caption explaining why, never a silent hide),
             # defaults the initial selection to `admin` when the caller
             # cannot sign qari, and folds the check into the sign button's
             # own `canSign` gate. The admin tier stays ungated (v3-D13
             # never conditioned it on scholarship). Nothing about what the
             # SERVER accepts changed — this is entirely what the UI
             # honestly offers before a request is sent. RED confirmed two
             # ways: moving the new context module aside failed the whole
             # test file on import resolution; separately, restoring the
             # context module but reverting only `AdminGate`/`QariMode`
             # (old ungated `QariMode` against the new context) failed 5 of
             # 8 new tests genuinely — the disabled state, the caption and
             # the tier default were all absent — while 3 passed vacuously
             # (the admin-tier-never-gated assertions). `TZ=UTC make test`:
             # 2231 passing (was 2223, +8 — exactly this run's new tests in
             # `test/workbench-qari-mode.test.tsx`). `check-test-floor.mjs`:
             # OK, 2231 >= floor 1899 (+332 margin). `TZ=UTC make build`:
             # exit 0, 25 routes (unchanged — no new route). `npx tsc
             # --noEmit`: clean. `npm run gates`: all green (fonts
             # degraded-but-non-blocking, pre-existing; boundaries 244
             # files, up from 242, two new files). No `v1/**`/`v2/**` edit.
             # No Arabic codepoint (every new/changed file swept over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms blocks, plus a `\u06xx`/`\u08xx`-escape
             # and `fromCharCode` sweep — zero matches). A server-side
             # grep (`hasAdminRole`/`AdminRole::`) confirms `tier: qari` is
             # the ONLY role-gated action in the app today, so this closes
             # the gap completely for the current surface rather than
             # partially covering a longer list. NOT addressed:
             # `GlossDraftsController` (still ratification-gated);
             # `distractor`/`group` override authoring (v3-D126) — both
             # unchanged. See DECISIONS.md v3-D131.
             # NOTE (v3-D130): `FlagRampAudit` had three writers
             # (`FlagService::kill`/`ramp`/`acknowledgeKill`, the last also
             # called unattended by the nightly `autoWaiveDueKills`
             # scheduler) and zero readers — the exact gap v3-D125 named for
             # this table and v3-D129 explicitly deferred ("picking one
             # audit trail and doing it well... was the scope choice").
             # Fixed: new `Admin\FlagAuditController::index()` (`GET
             # /api/admin/flags/audit`, read-only — no write route
             # registered at all) + `lib/admin/flagAudit.ts` (mirrors
             # `lib/admin/audit.ts`'s three-state discipline) +
             # `components/admin/FlagAuditPanel.tsx`, wired directly into
             # the existing `/settings/flags` page beneath `FlagsPanel`
             # (unlike `admin_audit`, this trail is scoped entirely to the
             # flag plane, so it gets no second nav destination). The actor
             # is pseudonymized on the way out, same as `AdminAuditController`
             # — but `flag_ramp_audit.actor_admin_id` IS NULLABLE (the
             # scheduler's auto-waive has no admin at all), so the naive
             # port of that one-liner would have fataled on the first
             # auto-waive row; `FlagAuditController` special-cases the null
             # actor explicitly and a dedicated test seeds exactly that row
             # and asserts a 200 with `actor: null`, not a 500. RED
             # confirmed at every layer: the backend route did not exist
             # (all 7 new PHPUnit cases 404'd against unmodified
             # `routes/api.php`; one iteration needed — the controller's
             # first draft omitted `use App\Http\Controllers\Controller;`
             # and fataled on `Class "App\Http\Controllers\Admin\Controller"
             # not found`, fixed, reran clean); `lib/admin/flagAudit.ts` and
             # `FlagAuditPanel.tsx` were each moved aside with their tests
             # kept and `vitest run` re-executed — both failed on module
             # resolution; every file restored byte-identically, all green
             # after. `TZ=UTC make test`: 2223 passing (was 2204, +19 —
             # exactly this run's new tests: 7 PHPUnit + 7 + 5 vitest).
             # `check-test-floor.mjs`: OK, 2223 >= floor 1899 (+324 margin).
             # `TZ=UTC make build`: exit 0, 25 routes (unchanged — no new
             # route). `npx tsc --noEmit`: clean. `npm run gates`: all green
             # (fonts degraded-but-non-blocking, pre-existing; boundaries 242
             # files, up from 238, four new files). No `v1/**`/`v2/**` edit.
             # No Arabic codepoint (every new/changed file swept over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms blocks, plus a `\u06xx`/`\u08xx`-escape and
             # `fromCharCode` sweep — zero matches). NOT addressed:
             # `GlossDraftsController` (still ratification-gated);
             # `distractor`/`group` override authoring (v3-D126); role-based
             # UI gating within the admin console (v3-D127) — all unchanged.
             # With this, both audit trails BUILD-PLAN M8 names have a real
             # reader; the "built + populated + zero read surface" sweep
             # that produced v3-D129/D130 has exhausted the two known
             # append-only audit tables. See DECISIONS.md v3-D130.
             # NOTE (v3-D129): `admin_audit` had four writers
             # (`AdminRevealController::reveal`, `AdminUsersController
             # ::exportCsv`, `SystemHealthController::rebuildAtomCache`,
             # `StripeSettingsController::test`) and zero readers — no
             # controller anywhere ever read the append-only audit trail
             # back, so the `AdminAudit::booted()` update/delete guard was
             # unverifiable by any human short of a database console.
             # BUILD-PLAN M8 names this exact gap: "nav homes for
             # flags/reports/templates/audit viewer." v3-D128's own closing
             # claim ("every admin controller with a real read surface has
             # a frontend caller, the sweep is exhausted") was true of
             # *controllers* and false of the *model* four of them wrote
             # to. Fixed: new `Admin\AdminAuditController::index()` (`GET
             # /api/admin/audit`, read-only — no write route registered at
             # all) + `lib/admin/audit.ts` (mirrors `lib/admin/flags.ts`'s
             # three-state discipline) + `components/admin/AuditLogPanel.tsx`,
             # wired into a new standalone `/settings/audit` route. The
             # ACTOR is pseudonymized on the way out too — `actor_admin_id`
             # is a raw FK that had never been read back anywhere; returning
             # it verbatim would have made this the one screen that
             # deanonymizes an admin's own identity to their peers, so the
             # same `Pseudonymizer` HMAC every other admin surface uses is
             # applied here too (dedicated test asserts the response never
             # carries the raw integer id). Capped at 200 recent entries,
             # not paginated — a review surface, not a table browser,
             # matching `AdminUsersController`'s own "no browse-all-learners
             # picker" scope discipline (v3-D128); a `subject` query param
             # narrows to one pseudonym. RED confirmed at every layer: the
             # backend route did not exist (all 5 new PHPUnit cases 404'd
             # against unmodified `routes/api.php`); `lib/admin/audit.ts`
             # and `AuditLogPanel.tsx` were each moved aside with their
             # tests kept and `vitest run` re-executed — both failed on
             # module resolution; every file restored byte-identically, all
             # green after. `TZ=UTC make test`: 2204 passing (was 2187, +17
             # — exactly this run's new tests: 5 PHPUnit + 7 + 5 vitest).
             # `check-test-floor.mjs`: OK, 2204 >= floor 1899 (+305 margin).
             # `TZ=UTC make build`: exit 0, 25 routes (was 24 —
             # `/settings/audit` is new). `npx tsc --noEmit`: clean. `npm
             # run gates`: all green (fonts degraded-but-non-blocking,
             # pre-existing; boundaries 238 files, up from 233, five new
             # files). No `v1/**`/`v2/**` edit (stray
             # `v2/tsconfig.tsbuildinfo` reverted before committing). No
             # Arabic codepoint (every new/changed file swept over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms blocks, plus a `\u06xx`/`\u08xx`-escape and
             # `fromCharCode` sweep — zero matches). NOT addressed:
             # `FlagRampAudit` (v3-D125) has the identical "written, never
             # read" shape and its own audit viewer is still unbuilt;
             # `GlossDraftsController` remains ratification-gated;
             # `distractor`/`group` override authoring (v3-D126) and
             # role-based UI gating within the admin console (v3-D127) are
             # both unchanged. See DECISIONS.md v3-D129.
             # NOTE (v3-D128): `Admin\RevealController` and
             # `Admin\AdminUsersController::exportCsv` — WIREFRAME §16's
             # reveal-identity and bulk-CSV-export surfaces, two of the three
             # zero-caller admin controllers v3-D125 named and twice deferred
             # ("its own careful UI pass") — had zero frontend callers, the
             # same "built + tested + zero production callers" shape as
             # v3-D100/D124/D125/D126/D127. Fixed: new `lib/admin/reveal.ts`
             # (`revealIdentity`/`checkRevealToken`, mirroring
             # `lib/admin/flags.ts`'s "the server decides everything"
             # discipline — reason-code set, >=10-char minimum, the PII-scan-
             # then-acknowledge flow and the reveal TTL are all server-decided
             # and rendered verbatim) + `lib/admin/users.ts`
             # (`downloadUsersCsv`, driving a real authenticated browser
             # download via an object URL since the endpoint needs a Bearer
             # token a plain `<a href>` cannot carry) + new
             # `components/admin/PrivacyPanel.tsx`, wired into a new
             # standalone `/settings/privacy` route. Deliberately no
             # "browse all learners" picker — `AdminUsersController` exposes
             # no JSON listing, only the identity-free CSV, so the reveal
             # form takes a typed user id the way an operator already has it
             # (a support ticket), matching v3-D110's own scope discipline
             # rather than inventing a second backend surface. Edge cases
             # #148 (an anonymous subject renders a distinct `anonymous`
             # state, never conflated with `not-found`) and #149 (a
             # PII-shaped reason renders the server's own `detected[]`/`hint`
             # and re-submits only on an explicit acknowledgement) are
             # rendered exactly as the server decided them, never re-derived
             # client-side. `GlossDraftsController`, the third surface
             # v3-D125 named, stays untouched — gated on Firdaus's
             # unrecorded ratification. RED confirmed three times (one per
             # new file pair): each new source file was moved aside with its
             # test kept and `vitest run` re-executed — all three failed on
             # module resolution; restored byte-identically, all green.
             # `TZ=UTC make test`: 2187 passing (was 2165, +22 — exactly this
             # run's new tests: 11 + 4 + 7). `check-test-floor.mjs`: OK, 2187
             # >= floor 1899 (+288 margin). `TZ=UTC make build`: exit 0, 24
             # routes (was 23 — `/settings/privacy` is new). `npm run gates`:
             # all green (fonts degraded-but-non-blocking, pre-existing;
             # boundaries 233 files, up from 230, three new production
             # files). No `v1/**`/`v2/**` edit. No Arabic codepoint. NOT
             # addressed: `GlossDraftsController` (the last v3-D125 surface,
             # still ratification-gated); `distractor`/`group` override
             # authoring (v3-D126); role-based UI gating within the admin
             # console (v3-D127) — this panel is reachable by any
             # allowlisted admin regardless of role. With this, every admin
             # controller with a real write/read surface has a frontend
             # caller — see DECISIONS.md v3-D128.
             # NOTE (v3-D127): the admin client-side auth gate — named unbuilt
             # since v3-D92 and repeated through v3-D100/D124/D125/D126, each
             # quoting the same reason: "a redirect with no server
             # enforcement behind it would be security theatre." The missing
             # half was a real login+check round-trip, not a backend gap —
             # `POST /api/admin/login` (`AdminAuthController`) has existed,
             # timing-oracle-hardened, since build-plan step 24, with zero
             # frontend callers. Fixed: new `GET /api/admin/whoami` (same
             # `admin` middleware chain every write already sits behind) +
             # `lib/admin/session.ts` (checkAdminSession/adminLogin/
             # adminLogout) + `components/admin/AdminGate.tsx`, wired into
             # `(admin)/layout.tsx` around `{children}` — gates all five
             # admin screens (`/workbench`, `/settings/health`, `/settings/
             # flags`, `/settings/content-freeze`, `/settings/stripe`) with
             # one change, since they share this layout. Changes NOTHING
             # about what data an unauthorized REQUEST can reach (every
             # admin write was already `EnsureIsAdmin`-gated); it only stops
             # an unauthorized VISITOR from seeing staff chrome instead of a
             # real login form. This run also swept `v3/worker/fold-runner/src`
             # (the layer v3-D126 named as the next unswept one) and found it
             # genuinely clean — see DECISIONS.md v3-D127 for both the
             # negative fold-runner finding and the gate fix's full write-up.
             # `TZ=UTC make test`: 2165 passing (was 2144, +21 — exactly this
             # run's new tests: 5 PHPUnit + 16 vitest). `check-test-floor.mjs`:
             # OK, 2165 >= floor 1899 (+266 margin). `TZ=UTC make build`: exit
             # 0, 23 routes (unchanged — no new route). `npm run gates`: all
             # green (fonts degraded-but-non-blocking, pre-existing;
             # boundaries 226 files, up from 223, three new production
             # files). No `v1/**`/`v2/**` edit. No Arabic codepoint. NOT
             # addressed: `distractor`/`group` override authoring; role-based
             # UI gating within the admin console (AdminGate proves ADMIN,
             # not WHICH admin role); the three other zero-caller admin
             # surfaces v3-D125 named. See DECISIONS.md v3-D127.
             # NOTE (v3-D126): `OverridesController::store` (`POST
             # /api/overrides`, the admin WRITE path B1/B3's closures depend
             # on) had zero frontend callers — v3-D125's own closing note
             # named this exact gap: "there is still no UI anywhere for an
             # admin/qari to actually correct a gloss or distractor...
             # workbench signs verifications only, never writes an
             # override." Scoped to the two fields that need no typed
             # Arabic: `gloss` (an EN/MS text correction) and `disable` (a
             # toggle over an existing word position, chosen from a
             # dropdown, never typed). `distractor` needs a word-tap
             # CorpusRef picker — the same reason `WorkbenchIsland`'s own
             # spec editor leaves its answer picker unbuilt rather than
             # stubbed with a free-text field, since that field's payload is
             # raw Arabic — and `group` (multi-word idiom grouping) is
             # deferred alongside it, both real separate future work. Fixed:
             # new `lib/overrides/write.ts` (mirrors `lib/workbench/sign.ts`'s
             # never-throws discipline) + `components/workbench/OverrideEditor.tsx`,
             # wired into `WorkbenchIsland` beside `QariMode`. Lists existing
             # overrides for the open ayah (reusing
             # `lib/overrides/fetch.ts#fetchOverrides`, the same function the
             # learner corpus loader calls), a gloss-correction form, and a
             # disable/re-enable form (question-type dropdown mirrors
             # `lib/test/build.ts#TestItemKind`, the actual set
             # `isQuestionDisabled` is checked against). Re-enable posts a
             # NEW row with `disabled: false` — never an edit in place,
             # matching `DisablePayload`'s own append-only contract. RED
             # confirmed directly: both new test files were run against the
             # tree before either source file existed and failed on
             # module-resolution errors; implemented after, 14/14 green.
             # `TZ=UTC make test`: 2144 passing (was 2130, +14 — exactly this
             # run's new tests). `check-test-floor.mjs`: OK, 2144 >= floor
             # 1899 (+245 margin). `TZ=UTC make build`: exit 0, 23 routes
             # (unchanged — no new route, renders inside the existing
             # `/workbench` route). `npm run gates`: all green (fonts
             # degraded-but-non-blocking, pre-existing; boundaries 223 files,
             # up from 218, four new files). No `v1/**`/`v2/**` edit (stray
             # `v2/tsconfig.tsbuildinfo` reverted before committing). No
             # Arabic codepoint (every new/changed file swept over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms blocks, zero matches). NOT addressed:
             # `distractor`/`group` override authoring (needs the word-tap
             # CorpusRef picker); the admin client-side auth gate
             # (pre-existing, named gap). The other three zero-caller
             # surfaces v3-D125 named (`AdminRevealController`/
             # `AdminUsersController`, `GlossDraftsController`) are
             # unchanged. `v3/worker/fold-runner/src` remains entirely
             # unswept. See DECISIONS.md v3-D126.
             # NOTE (v3-D125): `Admin\FlagController` (build-plan step 26/M8,
             # the flag plane) had zero frontend callers — BUILD-PLAN's own M8
             # line names "nav homes for flags/reports/templates/audit viewer"
             # as a deliverable never built, and `grep -rln "admin/flags"
             # apps/web` (excluding this run's new files) returned nothing.
             # Same "built + tested, zero production caller" shape as
             # v3-D100/D124, found by continuing v3-D124's own named next
             # step: the sweep of `v3/api/app/Http/Controllers`. Fixed: new
             # `lib/admin/flags.ts` (mirrors `lib/admin/health.ts`'s
             # three-state discipline) + `components/admin/FlagsPanel.tsx` +
             # a new standalone `/settings/flags` route (mirrors
             # `/settings/health`'s and `/settings/content-freeze`'s shape).
             # Kill stays one click (no ceremony); enable renders the full
             # ceremony form but validates none of it client-side beyond
             # making the form usable — every rule (>=20-char reason, verbatim
             # typed name, both ethics booleans, the version-conflict check)
             # is asserted only by the server and its response rendered
             # verbatim, per BUILD-PLAN's own "SERVER-ENFORCED" requirement.
             # Also resolved, not just noted: v3-D124's own "worth a future
             # run's attention" 401-vs-403 finding turned out to be NOT a bug.
             # `SystemHealthTest::setUp()` authenticates every test in the
             # class (incl. `test_health_requires_admin`, which merely empties
             # the admin allowlist) — so that test hits `EnsureIsAdmin`'s
             # allowlist check and correctly gets 403; `ContentFreezeTest
             # ::test_the_freeze_report_requires_admin` never authenticates at
             # all, so `auth:sanctum` itself correctly returns 401 before
             # `EnsureIsAdmin` runs. No middleware inconsistency exists; the
             # two tests exercise different scenarios and both status codes
             # are textbook-correct for their own case. No code changed for
             # this finding — recorded so it is not re-opened as live. RED
             # confirmed directly: both new test files were run against the
             # tree before either source file existed and failed on
             # module-resolution errors; implemented after, 20/20 green.
             # `TZ=UTC make test`: 2130 passing (was 2110, +20 — exactly this
             # run's new tests). `check-test-floor.mjs`: OK, 2130 >= floor
             # 1899 (+231 margin). `TZ=UTC make build`: exit 0, 23 routes (was
             # 22 — `/settings/flags` is new). `npm run gates`: all green
             # (fonts degraded-but-non-blocking, pre-existing; boundaries 218
             # files, up from 214, four new files). No `v1/**`/`v2/**` edit
             # (stray `v2/tsconfig.tsbuildinfo` reverted before committing).
             # No Arabic codepoint (full diff swept over every Arabic block +
             # both Presentation Forms blocks, zero matches). NOT addressed:
             # the flag plane's "reports/templates/audit viewer" nav homes
             # (FlagRampAudit rows have no viewer anywhere); the admin
             # client-side auth gate (pre-existing, named gap). Sweep of
             # `v3/api/app/Http/Controllers` is now fully READ (not fully
             # wired) — three more zero-caller surfaces found and
             # deliberately left, each for a stated reason, not a quick fix:
             # `AdminRevealController`/`AdminUsersController` (§16
             # privacy-reveal tooling, deserves its own careful UI pass),
             # `GlossDraftsController` (gated on Firdaus's ratification, none
             # recorded), and — most consequential — `OverridesController
             # ::store` (`POST /api/overrides`, the ADMIN WRITE path,
             # distinct from the public GET path `lib/overrides/fetch.ts`
             # already calls): there is still no UI anywhere for an admin/
             # qari to actually write a gloss/distractor override; workbench
             # signs verifications only. `v3/worker/fold-runner/src` remains
             # entirely unswept. See DECISIONS.md v3-D125.
             # NOTE (v3-D124): `Admin\ContentFreezeController` (build-plan step
             # 28/M9's freeze gate) had zero frontend callers — its own
             # docblock claimed "the workbench shows them together", false
             # from the day it was written (`grep -rn` for it across
             # apps/web/app/(admin)/workbench and components/workbench
             # returned nothing). Same "docblock says X, reality is Y" shape
             # as v3-D90/D110/D123. Fixed: new `lib/admin/contentFreeze.ts`
             # (mirrors `lib/admin/health.ts#loadHealth`'s three-state
             # discipline) + `components/admin/ContentFreezePanel.tsx`,
             # rendered at a new standalone `/settings/content-freeze` route
             # (mirrors `/settings/health`'s shape — this endpoint spans every
             # launch surah at once, so a per-surah `/workbench` screen is the
             # wrong shape for it). No freeze/book button, matching the
             # controller's own "freezing is a human act." Both stale
             # docblocks (the controller's, and the route comment in
             # `routes/api.php`) corrected in place. RED confirmed directly:
             # both new test files were run against the tree before either
             # source file existed and failed on module-resolution errors;
             # implemented after, 13/13 green. Also surfaced, not fixed: the
             # route's own "requires admin" test asserts 401 while
             # `SystemHealthTest`'s structurally identical test asserts 403 —
             # an `auth:sanctum`/`EnsureIsAdmin` inconsistency between the two
             # controllers, worth a future run's attention. `TZ=UTC make
             # test`: 2110 passing (was 2097, +13 — exactly this run's new
             # tests). `check-test-floor.mjs`: OK, 2110 >= floor 1899 (+211
             # margin). `TZ=UTC make build`: exit 0, 22 routes (was 21 —
             # `/settings/content-freeze` is new). `npm run gates`: all green
             # (fonts degraded-but-non-blocking, pre-existing; boundaries 214
             # files, up from 208, five new files). No `v1/**`/`v2/**` edit
             # (stray `v2/tsconfig.tsbuildinfo` reverted before committing).
             # No Arabic codepoint (full diff swept over every Arabic block +
             # both Presentation Forms blocks, zero matches). NOT addressed:
             # the 401/403 inconsistency above; the admin client-side auth
             # gate remains unbuilt across every admin screen (pre-existing,
             # named gap); the freeze gate's build-artifact half
             # (`scripts/content-freeze.mjs`) still has no UI, run by hand.
             # Next unswept layer for this bug class:
             # `v3/api/app/Http/Controllers` beyond this one controller (not
             # exhaustively checked) and `v3/worker/fold-runner/src` (not
             # swept at all). See DECISIONS.md v3-D124.
             # NOTE (v3-D123): `backup:restore-drill`'s PURGE-AWARE property
             # (build-plan step 30/M10) was fabricated — it called
             # `$doomed->delete()` directly and hand-wrote a JSON file shaped
             # like a ledger row, sharing no code with the REAL PDPA purge
             # path (`PurgeDueAccountsCommand`/`AccountDeletionRequest`/
             # `PurgeLedgerEntry`, build-plan step 23) that shipped hours
             # after this drill was first written and was never wired in.
             # Two OTHER files' docblocks (`PurgeLedgerEntry`,
             # `AccountDeletionTest`) both separately claimed this drill
             # already reconciled against/exercised the real thing — also
             # false, same "docblock says X, reality is Y" shape as v3-D90/
             # D110. Fixed: the purge step now creates a real
             # `AccountDeletionRequest` and calls
             # `$this->call(PurgeDueAccountsCommand::class)` — the exact
             # command that runs nightly — and the JSON file the drill writes
             # is now a CAPTURE of the real `PurgeLedgerEntry` row that
             # command wrote, not an authored fabrication. `find tests
             # -iname "*Backup*"` returned nothing before this run — the
             # command had zero test coverage in either direction; new
             # `tests/Feature/Backup/BackupRestoreDrillTest.php` (3 tests).
             # RED confirmed directly: `git stash` of the source file alone
             # (tests kept) reran against the original fabrication — 2 of 3
             # new tests failed, exactly on `assertArrayHasKey('id', ...)`
             # (a fabricated ledger has no Eloquent primary key) and on the
             # literal string `pdpa:purge-due — purged 1, skipped 0` never
             # appearing in the drill's own console output (the real command
             # was never called). Reverted byte-identically; 3/3 green again.
             # This was found by a fresh sweep for this build's recurring
             # "built + tested, zero real caller" bug class after the ENGINE
             # layer (`packages/engine/src`, every exported function) came
             # back genuinely clean — a real negative finding, same shape as
             # v3-D95's own empty sweep, recorded so a future run does not
             # re-walk that file list; `placement.ts`/FR10 remains the one
             # deliberately-unwired exception (v3-D111).
             # `TZ=UTC make test`: 2097 passing (was 2094, +3 — exactly this
             # run's new tests; no other suite moved). `check-test-floor.mjs`:
             # OK, 2097 >= floor 1899 (+198 margin, TEST-FLOOR unmoved).
             # `TZ=UTC make build`: exit 0, 21 routes (unchanged — no new
             # route). `npm run gates`: locked-css OK, fonts degraded-but-
             # non-blocking (pre-existing), boundaries OK (208 files,
             # unchanged), corpus-morphology and corpus-glyphs OK. No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff reverted before committing). No Arabic
             # codepoint introduced: every changed/new file swept
             # individually over the Arabic, Arabic Supplement, Arabic
             # Extended-A and both Presentation Forms blocks — zero matches
             # in the diff (three pre-existing matches elsewhere in
             # DECISIONS.md, from earlier entries, are untouched by this
             # change). NOT addressed, named so a future run doesn't
             # re-discover it as new: the drill still runs SQLite-only in
             # this sandbox — the staging-Postgres restore run remains a
             # separate, still-open LAUNCH-CHECKLIST line, unchanged by this
             # fix. See DECISIONS.md v3-D123.
             # NOTE (v3-D119..D122, same night as D118): the REAL GitHub
             # Actions CI had been `failure` on every commit for at least nine
             # commits running (back through dfa2f76/D115) — nothing before
             # this run ever checked the actual CI status of a just-pushed
             # commit, only local `make build`/`make test`. Four INDEPENDENT
             # gaps, found one at a time by reading each real run's job logs
             # after fixing the previous one: (1) `node-version: 20` in
             # `.github/workflows/ci.yml` couldn't run `compile.ts`'s
             # `--experimental-strip-types` (needs Node >=22.6) — bumped to 22;
             # (2) `v3/api`'s `composer.lock` had resolved packages (symfony
             # 8.1.x, nesbot/carbon 3.13.2) needing PHP >=8.4.1, but CI pinned
             # `php-version: "8.3"` — bumped to 8.4 (v2/api's own `^8.3`
             # constraint is unaffected); (3) `v3/api`'s default sqlite test
             # DB (phpunit.xml deliberately does NOT override to `:memory:`,
             # unlike v2/api's) was never migrated in CI — only the SEPARATE
             # throwaway Postgres wiring-test DB was — added `php artisan
             # migrate --force` against the default connection, v3/api only;
             # (4) `worker/fold-runner` (the sole server-side fold,
             # `AtomCacheRebuilder`/the DB-sampling determinism path both
             # shell out to it) was never `npm install`ed in this CI job —
             # added that step. Each fix was verified against the REAL next
             # GitHub Actions run (not locally — this sandbox's own node/php/
             # fold-runner state was never the broken one, which is exactly
             # why none of this was caught by nine straight nights of
             # `make test` reporting green). Final run (commit `c4057bd`):
             # all four jobs `success` — first fully green `main` in this
             # investigation's whole visible history. No test's expectations
             # changed, no gate weakened; every fix made an existing,
             # already-written assertion reachable for the first time. See
             # DECISIONS.md v3-D119 through v3-D122 for the full, individually
             # reproduced root-cause chain.
             # NOTE (v3-D118): `packages/engine/src/freeplay.ts#coldSuccessAdoption`
             # — the LAST of FR6's five exported functions to reach a learner —
             # had zero production callers, exactly the gap v3-D117's own header
             # named: "the offer itself is a genuine separate write path...
             # deserves its own night." A learner who free-drilled an untaught
             # ayah cold and hard through Door 3 had no way to actually adopt it
             # into their memorization — the pass is deliberately free-play
             # (`structured:false`), so nothing about it ever touches the atom,
             # by construction. WIREFRAME.md's own event table already settles
             # that `adoption` itself is evidence-only ("Logged, no strength
             # signal") — `rebuild.ts` correctly has no fold branch for it, the
             # same structural absence `session_start`/`rung_start` already use.
             # So the real encode is an ordinary structured `ayah_produced`
             # (`rung: gradeClassToWire("s3_full")`, never a literal); `adoption`
             # rides alongside it purely as the audit trail, the same division
             # `gate_demote`'s own `sentToReviews` field draws.
             #
             # `lib/session/run.ts` gains `SessionRun.openPracticeDrill` (the
             # learner's CHOSEN Door 3 difficulty, stored verbatim — `run.machine`
             # carries no `full` field once a pass completes, so this is the one
             # place the choice survives to session-end), `adoptionOfferFor(run)`
             # (re-derives the fold, calls `coldSuccessAdoption(atoms, ayah,
             # run.openPracticeDrill, run.slips === 0)` — a Door 3 queue is always
             # exactly one item, so `run.slips` at completion is scoped to
             # precisely that pass, the "cold" signal), and `acceptAdoption(run,
             # ctx)` (re-verifies the offer before committing anything, commits
             # the encode then the audit event as two chained retry-safe
             # commits). No "accepted" flag anywhere: `adoptionOfferFor` is
             # SELF-CLOSING — once the atom is genuinely encoded,
             # `coldSuccessAdoption`'s own `untaught` check reads false on the
             # next call. `SessionIsland.tsx` gains the matching offer effect +
             # "Adopt ayah N" button, mirroring Doors 1/2 exactly.
             #
             # Mutation-verified: `git stash` of the two SOURCE files alone
             # (`run.ts`, `SessionIsland.tsx`; every test kept) failed exactly
             # the 8 new test cases (7 in `run.test.ts`, 1 in
             # `session-island.test.tsx`), 80 other cases in those two files
             # unaffected; restored byte-identically, 88/88 green again. The
             # component-level "offers the CTA" test deliberately does NOT use
             # `completeSession()`'s trial-and-error tile clicking — a coin-flip
             # wrong tap before the right one would be a genuine slip, silently
             # falsifying the "cold pass" the offer requires. Instead it
             # precomputes, PURELY (`advanceReconstruct` is a pure engine
             # function — no DB write, so it never double-commits against the
             # on-screen run), the exact correct DISPLAY index at each blank,
             # then clicks exactly those tiles.
             #
             # `TZ=UTC make test`: 2094 passing (was 2085, +9 — exactly this
             # run's new tests: 7 in `run.test.ts` + 2 in
             # `session-island.test.tsx`; no other suite moved).
             # `check-test-floor.mjs`: OK, 2094 >= floor 1899 (+195 margin,
             # `TEST-FLOOR` left unmoved). `TZ=UTC make build`: exit 0, 21 routes
             # (unchanged — no new route). `npm run gates`: locked-css OK, fonts
             # degraded-but-non-blocking (pre-existing), boundaries OK (208
             # files, unchanged — no new file), corpus-morphology and
             # corpus-glyphs OK. `npx tsc --noEmit`: clean, `Version 5.9.3`
             # confirmed. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted before
             # committing). No Arabic codepoint introduced: every changed file
             # swept individually over the Arabic, Arabic Supplement, Arabic
             # Extended-A and both Presentation Forms blocks, plus a
             # `\u06xx`/`\u08xx`-escape and `fromCharCode` sweep — zero matches;
             # every new line addresses an ayah number, a strength value, a
             # slip count, or a closed-set difficulty ("S2"/"S3"), never corpus
             # text.
             #
             # NOT addressed, named so a future run doesn't re-discover it as
             # new: the diminishing-returns nudge stays wired onto Door 2 only
             # (v3-D111) — Door 3 has no equivalent, though the case for one is
             # weaker (open practice never damages a strong atom regardless of
             # rep count). The SSR override gap (`lib/corpus/load.ts`,
             # v3-D96/D110) and late-arrival refold (v3-D32/D116) are
             # unchanged. With this, all five of `freeplay.ts`'s FR6 exports
             # have a real production caller — the "built and tested, zero
             # callers" sweep that produced v3-D82 through D117 has exhausted
             # this file; a future run should look elsewhere for the next
             # instance. See DECISIONS.md v3-D118.
             # NOTE (v3-D117): FR6 Door 3 ("open practice") — the last of
             # freeplay.ts's three doors — had zero production callers, named
             # out of scope by v3-D98, D106, D111, D112 and D113 alike for the
             # identical reason: "needs an any-ayah picker route that does not
             # exist." That route now exists: new `/practice`
             # (`components/practice/PracticePicker.tsx` +
             # `app/(app)/practice/page.tsx`), a new `lib/practice/handoff.ts`
             # URL contract mirroring `lib/drill/handoff.ts`'s own shape, and
             # `lib/session/run.ts#startOpenPractice` — always free-play
             # (`structured:false`, unconditionally; freeplay.ts's own header:
             # "weak-spot gym is the exception" and Door 3 gets none), so an
             # untaught ayah practiced here can never accidentally encode and a
             # strong one can never be damaged, true by construction via
             # `update.ts:71`'s guard rather than by caller discipline. Unlike
             # every other entry point in `run.ts`, Door 3 forces the LEARNER'S
             # chosen difficulty (S2 partial / S3 full — narrowed from
             # `openPracticePick`'s own `Drill` type, which also admits "S1"
             # and "chain": S1/pretest is a first-ENCOUNTER property, not a
             # repeatable exercise, and "chain" needs `bridge.ts`, atticked at
             # the engine port, DEFECTS.md#E-08) rather than the atom's real
             # strength — a new `startFromQueue` `initialMachine` override,
             # used only by Door 3. `SessionIsland`'s summary screen gains an
             # unconditional "Practice any ayah freely" link (never an
             # engine-computed grant like Doors 1/2 — a learner can always
             # freely practice, so nothing gates it behind a fetch).
             #
             # Mutation-verified: `git stash` of every changed/new SOURCE file
             # (tests kept) failed exactly the 9 new Door-3 test cases across
             # four files, 70 other cases in those same files unaffected;
             # restored byte-identically, 88/88 green again. The load-bearing
             # "S2 forces PARTIAL blanking" test seeds a genuinely CARRY-band
             # atom by spacing real S3 completions across different learning
             # days until the fold itself reports strength >=80 — confirming
             # its own precondition rather than assuming a rep count reaches
             # it (a single S3 append only reaches ~26 strength from a fresh
             # atom, comfortably inside "learn" band, not "carry").
             #
             # `TZ=UTC make test`: 2085 passing (was 2071, +14 net across all
             # suites — 18 new apps/web tests across four files, no other
             # suite moved). `check-test-floor.mjs`: OK, 2085 >= floor 1899
             # (+186 margin, `TEST-FLOOR` left unmoved). `TZ=UTC make build`:
             # exit 0, 21 routes (was 20 — `/practice` is new). `npm run
             # gates`: locked-css OK, fonts degraded-but-non-blocking
             # (pre-existing), boundaries OK (208 files, up from 203 — five
             # new files, no violation), corpus-morphology and corpus-glyphs
             # OK. No `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff reverted before committing). No Arabic
             # codepoint introduced: every changed/new file swept individually
             # over the Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms blocks — zero matches; every new line
             # addresses an ayah number, a strength value, or a closed-set
             # difficulty ("S2"/"S3"), never corpus text.
             #
             # NOT addressed, named so a future run doesn't re-discover it as
             # new: `coldSuccessAdoption` remains unwired — Door 3 now gives it
             # a real surface to attach to (an untaught ayah's hard-drill pass)
             # but the offer itself is a genuine separate, tap-gated write path
             # and deserves its own night. The SSR override gap
             # (`lib/corpus/load.ts`, v3-D96/D110) and late-arrival refold
             # (v3-D32/D116) are unchanged. With this, FR6's "three doors
             # after session complete" is fully wired — only the adoption
             # offer and surfacing the diminishing-returns nudge beyond Door 2
             # remain as intentionally scoped-out refinements, not gaps. See
             # DECISIONS.md v3-D117.
             # NOTE (v3-D116): v3-D32/v3-D70's deferred per-user Postgres advisory
             # lock, closed. Both `AtomCacheRebuilder::rebuild()` (writes
             # `atom_cache`, admin-triggered) and `DeterminismCheckCommand`'s
             # DB-sampling path (reads `atom_cache`, nightly-triggered) are two
             # entirely separate lock keys with no relationship to each other —
             # `DeterminismCheckCommand`'s own header already named the gap: its
             # `Cache::lock` is RUN-level (two nightlies cannot overlap) but does
             # nothing to stop a nightly reading a learner's cache mid-rebuild via
             # the completely separate `REBUILD_LOCK` path. v3-D32 deferred a
             # per-user fix for exactly this because "sqlite, this repo's dev DB,
             # has no `pg_advisory_lock` to test against" — no longer true: this
             # sandbox has a real Postgres 16 server (confirmed installed but
             # stopped; started it), and this build's actual deployment target
             # (DECISIONS.md: Forge + managed Postgres) is Postgres in production
             # regardless. New `App\Support\PerUserFoldLock::withLocks(userIds,
             # fn)` acquires a SESSION-level `pg_advisory_lock` (not
             # transaction-scoped — the critical sections it guards span an
             # external Node subprocess call, and holding a DB transaction open
             # for that long is its own hazard) per user id, in a fixed sorted
             # order (deadlock avoidance across callers wanting overlapping id
             # sets), always released in a `finally`. No-ops on any non-Postgres
             # connection (sqlite, this repo's dev/test default) — single-process,
             # nothing to interleave with; stated in the class's own header, not
             # hidden. Wired into `AtomCacheRebuilder::rebuild()` (locks every
             # candidate user for the full span: event read, the fold-runner
             # call, and the delete+insert) and `DeterminismCheckCommand
             # ::sampleFromDatabase()` (locks exactly the one learner being read,
             # for exactly as long as the read takes, via a new
             # `sampleOneUserLocked()` extracted from the loop body).
             #
             # VERIFIED AGAINST REAL POSTGRES, NOT A MOCK. v3-D32's own
             # deferral reasoning ruled out exactly the shortcut of testing this
             # against sqlite or a fake lock — that would prove nothing about
             # whether Postgres actually serializes two callers on it, the same
             # vacuous-verification shape this build has shipped nine times
             # (HANDOVER.md's own count). `PerUserFoldLockTest` (5 tests) opens a
             # real Postgres connection and: proves `isSupported()` reflects the
             # driver; proves the sqlite no-op path never issues a Postgres-only
             # statement; proves a lock is released after success AND after the
             # callback throws (via a SEPARATE raw PDO session's non-blocking
             # `pg_try_advisory_lock`); and — the load-bearing case — forks a
             # genuinely separate OS process (`pcntl_fork`) that holds the
             # advisory lock for one user id for 450ms while the parent proves a
             # DIFFERENT id returns in <200ms (no cross-user contention) and the
             # SAME id blocks for >250ms (genuine waiting, not a coincidental
             # pass). `PerUserFoldLockWiringTest` (2 tests) proves the two real
             # CALLERS route through it, against a second throwaway migrated
             # Postgres database (`imanapp_lock_test`): a fork holds the lock for
             # 1800ms and each caller's elapsed time is asserted against its OWN
             # freshly-measured unlocked baseline (~390-410ms of pure Node
             # subprocess-startup overhead on this machine) plus a 1200ms margin
             # — a fixed threshold like "250ms" would have passed on the UNWIRED
             # tree too, on subprocess overhead alone, which is exactly what the
             # first draft of this test did before being caught and rewritten.
             #
             # RED confirmed at every layer, each by reverting only the source
             # (tests kept): the mutation stub (`isSupported()` hardcoded false,
             # `withLocks` a bare passthrough) failed exactly the two load-bearing
             # `PerUserFoldLockTest` assertions (`assertTrue(isSupported())` and
             # the same-id timing floor); reverting ONLY the two call sites (each
             # caller invoking its locked-body method directly, skipping
             # `PerUserFoldLock::withLocks`) failed exactly
             # `PerUserFoldLockWiringTest`'s two margin assertions, with the
             # actual measured numbers in the failure message (e.g. "baseline
             # 379ms, locked run 366ms, expected at least 1579ms") — proving the
             # unwired tree races straight past the other session's held lock.
             # Both reverted byte-identically and reran green.
             #
             # Also added: a `postgres:16` service to `.github/workflows/ci.yml`'s
             # `php` job (both matrix legs declare it; only `v3/api` uses it) plus
             # a migrated `imanapp_lock_test` database for the wiring suite — a
             # test that only ever runs on a machine that happens to have
             # Postgres would make "skips cleanly when unreachable" into CI's
             # silent, permanent, unnoticed default, the same shape as every
             # other vacuous-verification finding this build has caught. Env var
             # defaults (`PGSQL_LOCK_TEST_*`) match the official `postgres` image's
             # own defaults, so the two test files and the CI service agree
             # without any file needing to know about the other.
             #
             # `TZ=UTC make test`: 2071 passing (was 2064, +7 — exactly this run's
             # new tests: 5 in `PerUserFoldLockTest` + 2 in
             # `PerUserFoldLockWiringTest`; no other suite moved).
             # `check-test-floor.mjs`: OK, 2071 >= floor 1899 (+172 margin,
             # `TEST-FLOOR` left unmoved). `TZ=UTC make build`: exit 0, 20 routes
             # (unchanged). `npm run gates`: locked-css OK, fonts
             # degraded-but-non-blocking (pre-existing), boundaries OK (203
             # files), corpus-morphology OK, corpus-glyphs OK. `npx tsc --noEmit`:
             # clean, `Version 5.9.3` confirmed. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff was reverted before
             # committing, same discipline as every prior entry — `git status
             # --porcelain -- v1 v2` empty immediately before commit). No Arabic
             # codepoint introduced: every changed/new file swept over the Arabic,
             # Arabic Supplement, and both Presentation Forms blocks — zero
             # matches; every new line addresses a user id, a millisecond count,
             # or a config key, never corpus text.
             #
             # NOT addressed, named so a future run doesn't re-discover it as
             # new: late-arrival refold (v3-D32's other deferred half) remains
             # open — this build has no automatic refold-on-ingest at all today
             # (atom_cache is populated only by the admin's manual rebuild), so
             # "late-arrival" presupposes a normal-arrival refold pipeline that
             # does not exist yet; building one is real, separate, larger scope,
             # not a lock-shaped fix. `AtomCacheRebuilder::rebuild()` also now
             # holds ALL candidate users' locks for the full rebuild span (event
             # read + subprocess call + write) rather than one user at a time —
             # correct for the race it closes, but means a whole-database rebuild
             # will make every OTHER user's nightly read wait for the whole
             # rebuild to finish, not just their own turn; acceptable for a rare,
             # admin-triggered, whole-cache action, but worth knowing if rebuild
             # frequency ever changes. See DECISIONS.md v3-D116.
             # NOTE (v3-D115): edge case #130's OTHER half — `AtomCacheRebuilder`
             # (the admin "rebuild atom cache" action) shares the EXACT same
             # json_encode batching wedge v3-D114 fixed for the nightly check, but
             # is sharper: because this rebuilder REPLACES (delete-then-reinsert,
             # WIREFRAME §16), a naive fix that dead-lettered a poisoned learner's
             # ENCODING but still deleted their existing atom_cache rows before
             # excluding them from re-insert would silently WIPE their cache with
             # nothing to replace it — strictly worse than today's whole-rebuild
             # failure, exactly the trap v3-D114 named and deferred. Fixed by
             # reconciling both halves together: each candidate user's entry is
             # now json_encode()-tested in isolation before joining the batch; a
             # user that fails is dead-lettered and excluded, and the subsequent
             # `DELETE ... WHERE user_id IN (...)` is scoped to exactly the user
             # IDs actually sent to the runner — never the original candidate
             # list — so a dead-lettered learner's existing row is never touched.
             # `SystemHealthController`/`lib/admin/health.ts`/`SystemHealthPanel.tsx`
             # thread the dead-letter count through so an admin who clicks
             # "rebuild" is told a learner was skipped, never a bare "complete."
             # RED confirmed three times, one per layer (`git stash` of the
             # backend pair, then `health.ts` alone, then `SystemHealthPanel.tsx`
             # alone, tests kept each time): the backend case reproduced the
             # exact live wedge (`Expected... 200 but received 500`); both
             # frontend cases failed on exactly the new assertions, siblings
             # unaffected; each reverted byte-identically and re-ran green. The
             # load-bearing backend assertion `assertEquals`s the poisoned
             # learner's PRE-rebuild row (seeded via a real prior `rebuild()`
             # call through the actual fold-runner, then corrupted afterward)
             # against its POST-rebuild row, byte for byte — proving "never
             # wiped," not merely "still present." `TZ=UTC make test`: 2064
             # passing (was 2059, +5 — exactly this run's new tests: 1 PHPUnit +
             # 2 + 2 vitest; no other suite moved). `check-test-floor.mjs`: OK,
             # 2064 >= floor 1899 (+165 margin, TEST-FLOOR unmoved). `TZ=UTC make
             # build`: exit 0, 20 routes (unchanged). `npm run gates`: all green
             # (fonts degraded-but-non-blocking, pre-existing; boundaries 204
             # files). `npx tsc --noEmit` clean. No v1/v2 edit (stray
             # v2/tsconfig.tsbuildinfo build-cache diff reverted before
             # committing). No Arabic codepoint (full diff swept over every
             # Arabic block + presentation forms + \u06xx/fromCharCode, zero
             # matches). With this, both known fold-runner stdin callers
             # (`grep -rn "FoldRunnerProcess::run" app/` — exactly two) are
             # dead-letter-safe. Per-user Postgres advisory locks (v3-D32) and
             # late-arrival refold remain open, unchanged by this run. See
             # DECISIONS.md v3-D115.
             # NOTE (v3-D114): DEFECTS.md/edge case #130 — `sampleFromDatabase()`
             # batched every sampled learner into ONE envelope and `json_encode()`d
             # it whole; that call fails ATOMICALLY on the first invalid-UTF8 byte
             # (or NaN/Infinity float — Postgres can store either in `strength`)
             # anywhere in it, so ONE learner's corrupted `device_id` silently
             # blanked the stdin payload and reported "no input on stdin" as an
             # ERROR night for every OTHER, perfectly clean, learner sampled
             # alongside them — indefinitely, with no hint which learner or field
             # was actually broken. `rebuild()`/`applyEvent()` are fully total (no
             # malformed-but-typed event makes them throw, verified by reading
             # every branch), so this — not an engine exception — is the real
             # "poison event wedges fold" shape in this codebase. Fixed:
             # `sampleFromDatabase()` now `json_encode()`-tests each learner's own
             # slice in isolation before merging it into the shared envelope; a
             # learner that fails is dead-lettered (`{userId, error}`) and excluded
             # — "log intact," the row is never touched, only skipped for tonight's
             # run. `runFold()` merges PHP-side dead letters into the report and
             # upgrades an otherwise-green exit to WARN (report.severity kept in
             # step with the exit code that decides it) — never silently green over
             # a quarantined learner, never a P1 from a dead letter alone.
             # `record()` now writes `health:dead_letter_depth`, giving
             # `SystemHealthController::METRICS`'s long-registered-but-unimplemented
             # `dead_letter_depth` (in `METRICS` since M8, zero producer until now)
             # a real backend; `index()` returns it as a third check, and
             # `SystemHealthPanel.tsx`'s stale header comment ("no dead-letter
             # mechanism anywhere in this codebase") is corrected — the render
             # table is already generic over `checks.length`, so no frontend code
             # change was needed. RED confirmed directly: `git stash` of the two
             # source files (test kept) reran the new test against the unmodified
             # command — `Expected status code 0 but received 1`, the wedge
             # reproduced live; `git stash pop` restored the fix byte-identically.
             # The test needed one iteration to be trustworthy: an early draft gave
             # the "clean" learner no matching `atom_cache` row, which
             # `foldCheck.ts`'s own contract correctly reads as a genuine P1
             # divergence — a different bug that would have made the RED proof
             # ambiguous. Fixed by seeding both learners' caches via the real
             # `AtomCacheRebuilder` from their still-clean events, THEN corrupting
             # the poisoned learner's row afterward. `TZ=UTC make test`: 2059
             # passing (was 2058, +1 — exactly this run's one new PHPUnit test; no
             # other suite moved). `check-test-floor.mjs`: OK, 2059 >= floor 1899
             # (+160 margin, TEST-FLOOR unmoved). `TZ=UTC make build`: exit 0, 20
             # routes (unchanged). `npm run gates`: all green (fonts
             # degraded-but-non-blocking, pre-existing; boundaries 204 files).
             # `npx tsc --noEmit` clean. No v1/v2 edit (a stray
             # v2/tsconfig.tsbuildinfo build-cache diff was reverted before
             # committing). No Arabic codepoint (full diff swept over every Arabic
             # block + presentation forms + \u06xx/fromCharCode, zero matches).
             # NOT addressed, named so a future run doesn't re-discover it as new:
             # `App\Support\AtomCacheRebuilder` shares the EXACT same json_encode
             # wedge (it also batches every learner into one envelope) — but unlike
             # the nightly check, it DELETEs a rebuilt user's whole atom_cache row
             # set before reinserting only what the runner returns, so excluding a
             # poisoned learner from its batch while still deleting their existing
             # rows would silently WIPE their cache with nothing to replace it, a
             # strictly worse outcome than today's whole-rebuild failure. Fixing it
             # needs the delete and the dead-letter set reconciled together — a
             # real, separate, small task, not a copy of tonight's fix. Per-user
             # Postgres advisory locks (v3-D32, deferred as untestable against
             # sqlite-only) and late-arrival refold remain open too — this sandbox
             # now has a real Postgres 16 server installed, so that premise no
             # longer holds, but building and proving it is separate, larger scope.
             # See DECISIONS.md v3-D114.
             # NOTE (v3-D113): `packages/engine/src/activity.ts#lastActiveDayMs`
             # (the v2-BUG-2 fix — derives the learner's last-active day from the
             # append-only log so the make-up merge fires; its own header: derived
             # there "so the session caller has no excuse to hardcode it again")
             # had ZERO production callers. `lib/session/run.ts#assembleFor` — the
             # ONE queue-assembly seam every start path AND the /home due-count
             # route funnel through — hardcoded it anyway, an inline
             # `prior.reduce((max,e)=>(e.ts>max?e.ts:max),0)`. The "re-derive
             # instead of import" shape v3-D107/D108 twice named and deferred, and
             # the same shape as v3-D83's gradeClassToWire finding. Not a live
             # bug (the two agree for every positive-ts log) but the inline copy
             # also floored at 0 vs the engine's -Infinity — the exact latent
             # divergence one source of truth forecloses. Fixed: `assembleFor`
             # now calls `lastActiveDayMs(prior)`; one line, one import, one place.
             # RED-first mirrors the gradeClassToWire wiring proof (v3-D83): new
             # `lib/session/assemble-lastactive.test.ts` mocks `@engine/scheduler`
             # to capture the `lastActiveDay` assembleQueue receives + spies
             # `@engine/activity`; against unmodified run.ts the captured value was
             # the inline max-ts (T0), not the spy's sentinel — RED
             # (`expected 1786438800000 to be 1786352400000`); wired → GREEN, and
             # a companion proves the real un-overridden derivation still carries
             # the true max-ts through. `TZ=UTC make test`: 2058 passing (was
             # 2056, +2 — exactly this run's two new tests; no other suite moved).
             # `check-test-floor.mjs`: OK, 2058 >= floor 1899 (+159 margin,
             # TEST-FLOOR unmoved). `TZ=UTC make build`: exit 0, 20 routes
             # (unchanged). `npm run gates`: all green (fonts degraded-but-non-
             # blocking, pre-existing; boundaries 203 files). `npx tsc --noEmit`
             # clean. No v1/v2 edit (stray v2/tsconfig.tsbuildinfo reverted). No
             # Arabic codepoint (both files swept over every Arabic block +
             # \u06xx/fromCharCode, zero matches). With this the "built, tested,
             # zero-caller mechanism with an existing home" seam is exhausted;
             # what remains (FR6 Door 3/coldSuccessAdoption, the SSR override gap,
             # placement/FR10, the unrendered greeting) is design/architecture/
             # human-gated, not one-night wiring. See DECISIONS.md v3-D113.
             # NOTE (v3-D112): build-plan step 20 (`/drill`, continuous drill)
             # dead-ended — `components/drill/DrillPicker.tsx` rendered a live
             # preview of what a chosen range/page would drill but had NO Start
             # button and no handoff into the session loop, so the whole
             # continuous-drill surface was a step marked DONE on a component no
             # route could run. Coupled second half: the picker's own "Victory
             # lap — nothing can be damaged" radio had nothing behind it, because
             # every emit site in `lib/session/run.ts` hardcoded
             # `structured: true`, so the `structured:false` free-play path the
             # victory lap needs (invariant #5 / `update.ts:71`'s structured
             # guard) had zero production reach — shipping Start without the flag
             # would have made that radio a dark pattern. Fixed both, end to end:
             # `run.ts` gained `startDrillSession` (folds the log, filters the
             # chosen ayat to the ENCODED ones off the fold — a not-yet-learned
             # ayah is a guess, `lib/drill/preview.ts`'s BUG-3 gap guard — orders
             # them ascending, runs them as ordinary `review` items through the
             # EXACT same answerCurrent/answerAfterTap/settleAnswer path, no
             # second grading rule so B2's "gradeClassToWire is the ONE function"
             # holds); `SessionRun` gained a `structured` field the shared
             # `startFromQueue` carries onto the `reconstruct_tap` and
             # `ayah_produced` emits (`run.structured`, not a literal); a new
             # `none-ready` unavailable reason. `startExtraLearn`/
             # `startWeakSpotDrill` now set `structured:true` EXPLICITLY (a
             # victory-lap drill reaches the summary too, and its false must not
             # leak into a granted Learn or the full-weight weak-spot gym).
             # `lib/drill/sites.ts` gained `ayatForSelection` (range/page → ayah
             # numbers; seams dropped, E-08 — no reconstruct surface in v3);
             # `lib/drill/handoff.ts` (new) is the `/drill`→`/session` URL
             # contract both directions (`victory` the only opt-in to the lap; a
             # mistyped grade stays graded; a hand-edited out-of-range URL
             # degrades to `none-ready`, never a 500, #78). `DrillPicker` gained
             # a Start LINK shown only when a READY ayah exists (`ayahCount`, not
             # `stepCount` — a page whose only ready step is a seam never offers
             # a drill that would dead-end); `SessionPage`→`SessionGate`→
             # `SessionIsland` thread the parsed `DrillSpec`, the drill runs
             # within the ENROLLED surah. RED confirmed by `git stash` of `run.ts`
             # only (5 new `run.test.ts` cases kept): all failed on exactly
             # `startDrillSession is not a function`; pop → 5/5 green. The
             # load-bearing case runs a victory-lap drill to completion and
             # asserts every fresh `ayah_produced` AND `reconstruct_tap` is
             # `structured:false` and the atom's strength is byte-identical to
             # before — "nothing can be damaged" against the real fold; a
             # companion proves a WRONG tap in a victory lap still damages
             # nothing. `TZ=UTC make test`: 2056 passing (was 2037, +19 — exactly
             # this run's new tests: 5 run.test.ts + 3 session-island + 3
             # drill-picker + 8 drill-handoff; no other suite moved).
             # `check-test-floor.mjs`: OK, 2056 >= floor 1899 (+157 margin,
             # TEST-FLOOR unmoved). `TZ=UTC make build`: exit 0, 20 routes
             # (unchanged — `/drill` and `/session` both already existed).
             # `npm run gates`: all green (fonts degraded-but-non-blocking,
             # pre-existing; boundaries 202 files). `npx tsc --noEmit` clean. No
             # v1/v2 edit, no Arabic codepoint (every added line addresses an
             # ayah/range/page by number or a mode by closed-set value). SEAM
             # drilling remains out of reach (E-08, same as floor/weak-spot);
             # Door 3 (`openPracticePick`)/`coldSuccessAdoption` remain unwired
             # (need the any-ayah picker route that does not exist). See
             # DECISIONS.md v3-D112.
             # NOTE (v3-D111): FR6's diminishing-returns nudge
             # (`packages/engine/src/freeplay.ts#diminishingReturns`) — an
             # honest line for a learner who keeps massing the SAME atom in one
             # day — was real and unit-tested since freeplay landed but had ZERO
             # production callers. v3-D106's own header named it out of scope
             # alongside Door 3 and the cold-success-adoption offer ("each needs
             # its own UI surface"). Of the three FR6 remainders it is the only
             # one with an EXISTING home: FR6 Door 2, the weak-spot gym
             # (`weakSpotOfferFor`, wired v3-D106), which re-offers whichever
             # encoded atom is riskiest — so a learner tapping "Practice your
             # weakest spot" repeatedly drills the same ayah, and past the
             # threshold invariant #4's ×0.35 massed-same-day damping makes the
             # next rep worth ~a third of a spaced one. `lib/session/run.ts`
             # gained `diminishingReturnsNudge(run, ayah, now)` (counts the
             # fold's own same-learning-day structured `ayah_produced`
             # completions of the ayah — the reps the damping penalizes;
             # `structured:false` free-play echoes excluded, invariant #5;
             # same-day scoped under DEFAULT_DAY_CONFIG, matching
             # `weakSpotOfferFor`'s own `rebuild(prior)`), and
             # `SessionIsland.tsx` renders the engine's string as a
             # `role="status"` caption BENEATH the Door 2 button — never instead
             # of it; the learner keeps the choice, the component decides neither
             # count, threshold nor words (invariant #6, check-boundaries clause
             # 5 still green at 200 files: the engine call lives in `lib/`).
             # RED confirmed by `git stash` of the two source files only (tests
             # kept): all 5 new `run.test.ts` cases failed on exactly
             # `diminishingReturnsNudge is not a function`, and the positive
             # component case failed on the missing `diminishing-returns-nudge`
             # testid; `git stash pop` restored both byte-identically, 60/60
             # green across the two files. `TZ=UTC make test`: 2037 passing (was
             # 2030, +7 — exactly this run's new tests: 5 + 2; no other suite
             # moved). `check-test-floor.mjs`: OK, 2037 >= floor 1899 (+138
             # margin, TEST-FLOOR unmoved). `TZ=UTC make build`: exit 0, 20
             # routes (unchanged). `npm run gates`: all green (fonts
             # degraded-but-non-blocking, pre-existing). `npx tsc --noEmit`
             # clean. No v1/v2 edit, no Arabic codepoint (every added line
             # addresses an ayah/rep-count by number). Door 3 (open practice)
             # and `coldSuccessAdoption` remain unwired (each needs the any-ayah
             # picker route that does not exist); the placement binary-search
             # onboarding (FR10, `placement.ts`) remains a deliberate design
             # choice, not a wiring gap. See DECISIONS.md v3-D111.
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
