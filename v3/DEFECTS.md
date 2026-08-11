# Known defects

Every one verified in source, not inferred. Each names its owning milestone and
the regression test that closes it.

**B1–B6** are v2 engine/data defects carried into the port. **B7–B9** were found
by executing the v2 harness. **E-01…E-08** are multi-surah defects that only
manifest once a second surah exists.

---

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

**Explicitly deferred, not forgotten:** the LIVE wiring that automatically
re-runs `corpus:ingest-hashes` with an override-aware recompute the moment
an override is written — the same class of "needs a running TS-side
service reacting to a Laravel write" gap the fold-runner's DB adapter has
(DECISIONS.md v3-D32). Today, closing the loop end-to-end requires
manually re-running the ingest command after an override; the COMPUTATION
and the FRONTIER LOGIC are both proven correct, only the automatic trigger
is missing.

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
