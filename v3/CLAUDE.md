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
make test    # 1934 passing (+2 incomplete, PAY-1, by design), typechecks first.
             # 255 v2 vitest + 47 v2/api + 272 v3/api + 111 corpus-compiler
             # + 417 engine + 61 fold-runner + 771 apps/web. (v3-D100, 2026-08-17)
             # `make test` enforces v3-D95's test-count floor (`v3/TEST-FLOOR`,
             # currently 1899, so the margin above is intentionally not yet
             # banked into the floor) — a suite that silently shrinks (deleted
             # test file, stray `.skip`) now fails the build even though every
             # test that DID run still passed.
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
