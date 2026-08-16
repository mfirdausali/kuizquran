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
make test    # 1890 passing (+2 incomplete, PAY-1, by design), typechecks first.
             # 255 v2 vitest + 47 v2/api + 272 v3/api + 111 corpus-compiler
             # + 417 engine + 61 fold-runner + 727 apps/web. (v3-D94, 2026-08-16)
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
