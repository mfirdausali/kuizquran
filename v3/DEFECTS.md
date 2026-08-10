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

## B7 — admin privilege escalation (M3, `AUTH-`)

`AuthController::register()` sets any email with **no ownership proof**;
`EnsureIsAdmin.php:19-24` trusts that string; `MustVerifyEmail` is commented out
at `User.php:5`.

⇒ Anyone who knows an `ADMIN_EMAILS` address can claim it **before the real admin
registers** and become admin. Live path on a product about to take payments.

*Closes when:* email verification ships and a test asserts an unverified email
cannot pass `EnsureIsAdmin`.

## B8 — dead-token wedge (M3, `AUTH-`)

`auth.ts:51-52` — `ensureDevice()` returns early if *any* token exists, and
`clearToken()` is never called on a 401 anywhere in `src/`. A revoked token
permanently disables sync; the only recovery is hand-clearing localStorage.

*Closes when:* a 401 interceptor clears the token and re-mints, proven by a test
that revokes server-side and asserts recovery.

## B1 — the `custom` override is a loaded no-op (M3)

`Admin.tsx:311` ships a free-text `{prompt, options[], correct}` editor; Laravel
validates `'payload' => ['required','array']` and **nothing inside it**;
`overrides.ts:139` pushes to `customs[]` unresolved; no renderer reads it.

Rows accumulate now and would become learner-visible **retroactively** the moment
anyone builds the renderer. An admin can type Arabic into `correct` today.

*Closes by deletion:* v3 has no `custom` field. `POST` rejects `kind=custom`
forever; existing rows are archived with no serving path.

## B2 — React decides the grading rung (M2)

`Drill.tsx:203` and `Gate.tsx:100`: `const rung: Rung = item.full ? "S3" : "S2"`.
Invariant 6 leaking on the most consequential axis — S3 triggers `scheduleGate()`
and grants `GAIN.s3` (30) versus `s2` (12).

*Closes when:* `gradeClassToWire()` owns the mapping (v3-D11) and JSX is
grep-clean for `rung`.

## B3 — `ayah_verifications` has no content hash (M3)

Migration is `unique(surah,ayah)` + `verified_by` + `note` + `created_at`. A qari
signs ayah 5, an admin then overrides its gloss, the row still reads verified.
**The GATE-A "verified frontier" metric is lying today.**

*Closes when:* the tiered hash (v3-D13) ships and an override on a verified ayah
flips the frontier amber in a test.

## B4 — override ties are unordered (M2)

`overrides.ts:117` sorts on `createdAt` alone; ties fall back to DB row order,
and the seeder bulk-inserts rows sharing a millisecond.

**Must land before the first B3 hash row** (H3) — a hash computed under
nondeterministic tie ordering is a nondeterministic hash.

*Closes when:* ordering is `(createdAt, id)` and a same-millisecond fixture is
stable across runs.

## B5 — `mergeFromServer` drops `seq` (M6)

`db/eventLog.ts:113` — `const { seq: _drop, ...rest } = e`, so IndexedDB assigns
a fresh local `seq` and **log order becomes arrival order**. Two devices with
byte-identical event sets would order differently.

*Closes when:* merge preserves `deviceSeq` and a two-device test yields identical
folds regardless of arrival order.

## B6 — string-match grading (M2)

`reconstruct.ts advanceReconstruct` grades with `choice === item.correct` — a
pure string comparison, in the **only graded path in the product**. 26 of 111
Yusuf ayat contain a repeated Arabic surface form (ayah 87 has مِن ×3), so tapping
the *wrong* instance still matches and is graded correct.

*Closes when:* grading is surface-equivalence-at-position (v3-D12), proven by a
sweep over all 26 ayat.

---

## Multi-surah defects

**E-01 — atom key collision (M2, the hard blocker).** `atomKey(kind, ref)` is
`` `${kind}:${ref}` `` and `AtomState` has no `surah` field, so Yusuf ayah 5 and
Al-Mulk ayah 5 are **the same atom**.

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

| | Defect | Milestone |
|---|---|---|
| **E-02** | One budget, N decay curves — `assembleQueue` takes one atoms array | M2 |
| **E-03** | `unlockPermitted()` spans surahs — a pending gate in one blocks learning in another | M2 |
| **E-05** | Pace is per-learner, not per-surah | M2 |
| **E-06** | `planFor()` gives every surah the full daily budget — every ETA lies | M2 |
| **E-07** | Corpus fetch is per-surah and unguarded — N fetches per load, one 404 breaks the page | M1/M5 |
| **E-08** | Chains can cross a surah boundary; `bridge.ts:14` has no bound check | M2 |

E-08 dies **by construction**: `expand()` emits seams only for `a..b−1`, so the
seam at ayah N is never constructed and the unguarded call has no reachable
input.
