# HANDOVER.md — iman.app v3, final audit

**Audited 2026-08-11** against `v3/docs/BUILD-PLAN.md`'s 32-step corrected build
order, read in full. Every verdict below was produced by running a command or
reading a file in this repo on the audit date, never from a docblock's claim.

**Everything below is reproducible.** Section E gives the commands.

---

## The one-sentence answer

The **substrate is real and the gates are honest**; the **product is not
assembled**. Steps 1–17 and 19–26 and 29 have genuine, mutation-verified
capability behind them, but the single surface that makes this a learning app —
a session a learner can complete — does not exist, and the only Arabic a
learner can reach today is served from a **stale engine test fixture**, not the
frozen corpus the qari would sign.

---

# A. The 32 steps

Verdict rules applied: **DONE** = a learner-reachable surface or a proven
capability. A component not wired to a route is **PARTIAL**. Where I could not
verify something, the row says so and names it.

| # | Step | Verdict | Evidence |
|---|---|---|---|
| 1 | Decision batch + scaffold + CI invariant-gate (ph.1) | **DONE** | `npm run gates` → 4 gates green (locked-css 1 documented hunk / 294 lines byte-identical; boundaries 136 files, 9 clauses; corpus-morphology). `DECISIONS.md` 77KB, v3-D08…D63. |
| 2 | Pin v2 SHA; cut golden log + fixtures | **DONE** | `CLAUDE.md` pins `c34f5c3`; `v3/fixtures/golden-log/`; `make golden-log` target exists. |
| 3 | Corpus compiler port, surah-parameterized, 12+103+112 | **DONE** (exceeds) | `output/manifest.json` carries **4** surahs 12/67/103/112 with real word counts (1777/333/14/15). 101 compiler tests green. |
| 4 | Corpus versioning: 16-hex, manifest, tiered hash tables | **DONE** | `manifest.json` — 16-hex `corpusHash`, per-surah `schemaVersion` + `hashSpecVersion`, `hashesPath` per surah. |
| 5 | Engine verbatim port green | **DONE** | 391 engine tests green; `RETIRED-TESTS.md` publishes the attic mapping. |
| 6 | Golden-log fold-parity snapshot | **DONE** | `packages/engine/test/golden-log-parity.test.ts` inside the 391. |
| 7 | E-01 surah keying, one mechanical commit | **DONE** | `atomKey(surah, kind, ref)`; `e01.test.ts` greps that no raw `kind:ref` literal survives outside `atom.ts`. |
| 8 | B2 + B4 + B6 + tz-explicit daybound | **PARTIAL** | B2/B4 closed and tested. **B6's guard is a live survivor** — see §B. tz-explicit `daybound.ts` present. |
| 9 | Multi-surah fixes E-02/03/05/06/08 | **DONE** | `multiSurah.ts#splitBudget`; surah-scoped `unlockPermitted`. E-05 reclassified to M6 storage with a written argument; E-08 closed by construction. |
| 10 | DrillEvent wire freeze, once, complete | **DONE** | `engine/test/wire-freeze.test.ts`; all 11 fields present incl. `gradeClass`, `tz`, `corpusHash`, `deviceSeq`. |
| 11 | Site + admit + rotation + per-device visitOrdinal | **DONE** | `site.ts`, `rotation.ts`, `selection.ts` in the 391. |
| 12 | selection_determinism_check | **DONE** | In-suite, snapshot-based, varying seeds. |
| 13 | Laravel skeleton + auth + password reset + mail | **DONE** | 194 passing v3/api tests; `PasswordResetController`, `EmailVerificationController`, `MustVerifyEmail` real. |
| 14 | Ingestion + pull + fold-runner + atom_cache + fold check | **PARTIAL** | Pure core proven (15 fold-runner tests, arrival-order invariance). **No DB adapter, no scheduler** — `worker/fold-runner/package.json` says so in its own `description`; `routes/console.php` registers nothing. The check cannot run nightly against anything. (v3-D32) |
| 15 | Specs / typed overrides (B1 dead) / tiered verifications | **PARTIAL** | Schema, controllers, any-row-matches frontier all tested. **The override→re-hash trigger is manual** — DEFECTS.md#B3 states this explicitly. |
| 16 | Question compiler §22 + explain() | **DONE** | `buildQuestion.ts`, `render.ts` (4 closed shapes), `explain()` proven against real engine output in `workbench-explain.test.ts` (17 tests). |
| 17 | App shell + design system + client islands | **DONE** | 14 routes build; `shell.test.ts` 43 tests; IDB islands `append`/`writeLock`/`state` tested. |
| 18 | **Quiz loop + full session lifecycle** | **NOT BUILT** | `app/(app)/session/page.tsx` is a `StubNote`. The 4 render shapes exist and are tested (47 tests), but **no corpus loader at request time, no commit-before-paint, no create/resume/summary/celebration**. The file documents its own absence. |
| 19 | Macro panel, ring, progress table, plan calendar | **PARTIAL** | Components + tests exist (`macro-ring`, `plan-calendar`, `progress-list`). `/progress` and `/home` are still `StubNote` routes, so they are not learner-reachable. |
| 20 | Continuous drill: range + mushaf page | **PARTIAL** | `/drill` is the one **real** learner surface — `DrillPicker` renders live. **But `lib/corpus/load.ts` reads `packages/engine/test/fixtures/`, and `AVAILABLE_SURAHS = [12]`.** See §A-note. |
| 21 | Sync outbox + pull + merge preserving deviceSeq | **DONE** | B5 mutation-verified by me today: 5 tests RED + boundary clause 7 fires. Chunking at 200 proven. |
| 22 | Onboarding (7 screens) + dashboard + ayah detail | **PARTIAL** | 7 screens real and committing (`commitOnboarding` writes `meta`, one transaction). **It redirects to `/home`, which is a stub.** Ayah detail is a stub. |
| 23 | Entitlements + Stripe + paywall + PDPA | **PARTIAL** | State machine, 4 states, guarded transitions, HMAC verify, idempotency index — all tested. **PAY-1 open: zero replay fixtures**, 2 tests deliberately INCOMPLETE. |
| 24 | Admin console + health + audit + roles | **DONE** | `/api/admin/*` routes; `SystemHealthController`, reveal-with-TTL, CSV, flags. |
| 25 | Workbench + qari mode (TOCTOU-proof signing) | **DONE** | `/workbench` builds; `workbench-sign.test.ts` (11) + `workbench-frontier.test.ts` (15). |
| 26 | Flag plane, all OFF | **DONE** | `FlagController` with kill/enable/ack; enable-hard ceremony + 72h auto-waive. |
| 27 | Content ops: MS execution, scene beats, distractor QA | **PARTIAL** | `make content-freeze` exits **1** and names the blocker: **surah 67 has 0 scene beats**. MS decision (v3-D15) MET; distractor QA MET and signed against **current** hashes. |
| 28 | Corpus + spec freeze → qari sessions | **HUMAN-GATED** | Corpus/spec freeze MET (all 4 hashes match manifest). Qari sessions are calendar. Gate correctly refuses to open. |
| 29 | Landing page | **DONE** | `/` is static, server-rendered, 5 argument sections + live `InlineDemo` on 112:1; `landing-claims.test.ts` 34 tests. |
| 30 | Launch hardening: 7 green nights, a11y, security, backup | **NOT BUILT** / **CALENDAR-GATED** | No scheduler ⇒ the 7-night window **cannot start**. No Playwright suite exists (`test/` is all vitest) despite M5 naming it a first-class deliverable. `BackupRestoreDrillCommand` exists. Human a11y pass unbooked. |
| 31 | *(post-launch)* Social behind flags | **NOT BUILT** | Correct — post-launch by construction. |
| 32 | *(post-launch)* Learning-science + recommender | **NOT BUILT** | Correct — post-launch by construction. |

### A-note — the drill corpus defect (the most consequential finding)

`/drill` is the **only** route where a learner reaches Quranic text through the
real engine. It loads from the wrong place:

```
lib/corpus/load.ts:44  export const AVAILABLE_SURAHS: readonly number[] = [12];
lib/corpus/load.ts:46  const FIXTURE_ROOT = path.resolve(process.cwd(),
                         "../../packages/engine/test/fixtures");
```

Proven divergent today:

| | engine test fixture | frozen compiled corpus |
|---|---|---|
| bytes | 2,921,713 | 3,409,220 |
| `hashSpecVersion` | `undefined` | `1` |
| provenance | `kuizquran/data/yusuf-*.json` | `v3/packages/corpus-compiler/data/raw/12-*.json` |
| byte-identical? | **no** | |

So the surface a learner can touch **bypasses the entire content-freeze and
verification chain**: it carries no `hashSpecVersion`, so no verification row can
ever match it, and it predates v3-D60's foil redraw — meaning it still contains
the near-duplicate option sets Firdaus rejected (44% of Al-Mulk's, 60% of
Al-Ikhlas's sets were affected; surah 12's own sets were re-emitted by that same
compile). **Nothing in CI catches this**: the content-freeze gate validates
`output/`, and the drill route never reads `output/`. Fixing it is small
(repoint the loader at `output/`, stage the artifact, extend `AVAILABLE_SURAHS`)
but it must land before any qari sign-off means anything about what learners see.

---

# B. The defect ledger

| ID | Claim | Status | Closing test |
|---|---|---|---|
| **B1** | `custom` override no-op | **CLOSED by deletion** | `overrides.test.ts` structural (string `"custom"` absent); `OverridesController` closed 4-member set → 422 |
| **B2** | React decides the rung | **CLOSED, narrow** | `gradeClass.ts` + `gradeClassToWire()`. Honest caveat in DEFECTS.md: the JSX-grep half was **vacuous** (no UI existed). `check-boundaries.mjs` clause 5 now enforces it for real. |
| **B3** | No content hash on verifications | **CLOSED, with a named live gap** | `hash.ts#ayahQariHashWithOverrides`; append-only `ayah_verifications`; any-row-matches frontier. **Gap:** the override→re-ingest trigger is manual. |
| **B4** | Override ties unordered | **CLOSED** | `(createdAt, id)`; same-ms fixture stable both directions × 5 runs |
| **B5** | `mergeFromServer` drops `seq` | **CLOSED — spot-checked by me** | See below |
| **B6** | String-match grading | **CLOSED IN SOURCE, GUARD SURVIVES — spot-checked by me** | See below |
| **B7** | Admin privilege escalation | **CLOSED** | `AdminAccessTest::test_unverified_admin_email_is_forbidden`; `EnsureIsAdmin` requires `hasVerifiedEmail()` **and** allowlist |
| **B8** | Dead-token wedge | **CLOSED** | `auth.test.ts` (14) + `TokenRevocationTest.php` (6); wedge split into two independently-observable halves after mutation found one inert |
| **B9** | CI build gate was a no-op | **CLOSED first** | `|| true` removed; `--passWithNoTests=false`; `npm run build` exits 0 |
| **E-01** | Atom key collision | **CLOSED** | `e01.test.ts`; oracle regenerated under human review |
| **E-02** | One budget, N decay curves | **CLOSED** | surah-filtered `assembleQueue` + `splitBudget` |
| **E-03** | `unlockPermitted` spans surahs | **CLOSED** | surah-scoped |
| **E-05** | Pace per-learner not per-surah | **RECLASSIFIED** — not an engine bug; deferred to M6 storage schema. Reasoning is written down and I agree with it. **Nothing enforces it lands**, since M6's schema is unbuilt. |
| **E-06** | `planFor()` ETAs lie | **CLOSED** | callers pass `splitBudget` share |
| **E-07** | N corpus fetches, one 404 breaks page | **OPEN** | Correctly open — no multi-surah dashboard exists yet |
| **E-08** | Chains cross surah boundary | **CLOSED incidentally** | `bridge.ts` atticked at step 5 (v3-D25) |
| **PAY-1** | Stripe replay suite has zero fixtures | **OPEN, by design** | `ReplaySuiteTest` asserts a minimum fixture count first, so an empty set **cannot read green**. 2 INCOMPLETE. |

## Spot-check 1 — B5 (deviceSeq preservation): **genuinely closed**

I reintroduced v2's exact defect in `lib/sync/merge.ts:194`:

```ts
const { deviceSeq: _drop, ...rest } = e as LocalEventRow;
let row: LocalEventRow = { ...(rest as LocalEventRow), syncedAt: ctx.now };
```

Result — **two independent brakes fired**:

- `node scripts/check-boundaries.mjs` → `✗ 1 violation … omit-destructuring in
  the sync island — this is DEFECTS.md#B5's literal syntax`
- `vitest run lib/sync/merge.test.ts` → **5 failed | 18 passed**, including both
  load-bearing assertions (byte-identical log ORDER *and* identical AtomsMap)

Reverted byte-identically (`git diff` empty), re-ran: 23/23 green, gate OK. **B5's
closure is real** and the DEFECTS.md write-up of it is accurate.

## Spot-check 2 — B6 (surface-equivalence grading): **THE GUARD IS A SURVIVOR**

I reverted `packages/engine/src/reconstruct.ts:133` to v2's exact defect:

```ts
const correct = choice === item.correct;      // was: surfaceEquals(choice, item.correct)
```

**All 391 engine tests passed. Test Files 43 passed (43).** The mutation
survived, and it survived in the only graded path in the product.

**Root cause** (`test/b6-repeated-word-sweep.test.ts:53,81`): the 26-ayah sweep
answers with `expected.text_uthmani` — the corpus bytes themselves — and its
negative case uses an *unrelated* word. Raw `===` satisfies both. The sweep
proves position-tracking is correct (genuinely valuable, and that IS what B6's
"tap the wrong instance" defect was about) but **it never exercises
normalization**, so nothing anywhere fails if NFC-folding and tatweel-stripping
are deleted.

**This matters beyond tidiness.** `normalizeArabicSurface` is the shared spine of
`gradeKey()`, and v3-D60 layered `displayKey()` on top of it to kill the
near-duplicate foils Firdaus rejected. The grading half of that spine is
currently unguarded: a regression in `arabic.ts` would be caught by
`arabic.test.ts` at unit level, but the *wiring* of it into grading is not
pinned. Reverted byte-identically; 391/391 green.

**Recommended fix (small, and it is a test-only change — no source edit):** add
one case to the sweep that answers with a tatweel-injected or NFD-decomposed form
of `expected.text_uthmani`, derived mechanically from corpus bytes at runtime —
no Arabic literal is written, so the sacred-text rule holds. That single
assertion turns the mutation red.

> Two spot-checks, one survivor. The build's own `CLAUDE.md` warns of eight
> shipped vacuous verifications; this is a ninth, and it is on the grading path.
> I did not audit the other closures at this depth — **treat the remaining
> ledger as probable-but-unproven**, and prefer the ones whose write-ups admit a
> limitation (B2, B3) since those authors were already reasoning honestly.

---

# C. What only a human can do

### C1 · The qari review — **blocks PUBLIC LAUNCH, absolutely**

Firdaus is the qari. Nothing ships without it.

**Correction to the audit brief.** The brief states the QA sample "must be
re-reviewed because the v3-D60 fix redrew the coordinates." **That already
happened.** All four `docs/qa-samples/*.json` are signed `Firdaus`,
`2026-08-11T12:54:59+00:00`, and their `corpusHash` values match the current
manifest exactly (12→`328401a1575c470b`, 67→`2ed7175147595241`,
103→`2391cae50f7c4a4a`, 112→`6c1902db4982288e`). v3-D61 records the sequence:
first 10 shown → 2 rejected → v3-D60 fix → **sampler redrew** → all 216 displayed
and approved. The distractor-QA criterion is genuinely MET.

**What is still owed from the qari: the sign-off itself** — 15–25h of scholar
time across 12 + 67 + 103 + 112 including seam renders, under the tiered hash.
**Blocked behind it:** launch.

**Blocking the qari right now:** `make content-freeze` exits 1 on surah 67's
scene beats (below). Booking a session before that is money burned — the gate
exists to make that visible.

### C2 · Scene beats for surah 67 — **the one live content blocker**

`make content-freeze`: `surah 67: 30 ayat, NOT atomic, and ZERO scene beats`.
103 and 112 are atomic (≤8 ayat) and owe none under v3-D21; 12 has all 19.
Days of authoring, Firdaus or a hired writer. **Blocks:** the freeze gate, hence
the qari, hence launch.

### C3 · Malay glosses (~11,300) — **NOT on the launch path**

v3-D15 excluded `gloss.ms` from hash v1; the gate verifies this structurally
(`ayahQariHash` reads `gloss.en` only; no compiled corpus carries an ms gloss).
**Correctly deferred.** If MS ever ships it must be authored *and* reviewed
**before** a qari pass, or every sign-off ambers at once (#155). A named Malay
reviewer with doctrinal authority is still unappointed (Q2, half-answered).

### C4 · Stripe MY business verification — **weeks of calendar, already late**

BUILD-PLAN says day 0; DEFECTS.md#PAY-1 says "this is already LATE." The code is
built and mutation-verified. What is missing is not code: KYC + bank + tax, FPX
and GrabPay per-method activation, and `stripe trigger` recordings vendored to
`v3/fixtures/stripe/` (**currently: README only, zero fixtures**) including the
partial-refund and dispute-won shapes the default triggers don't emit.
**Blocks:** M7 exit, and taking money.

### C5 · The 7-consecutive-green-nights window — **cannot start yet**

Not merely calendar-gated: **there is nothing to run.** No DB adapter for the
fold-runner and no scheduler entry (`routes/console.php` registers only
`inspire`). Both determinism checks are proven as *libraries*, never as
*monitors*. The window needs (a) that infrastructure, (b) live staging, (c) 7
days after the **last** engine/selection merge — so any late engine change,
including the B6 test fix, resets it.

### C6 · Also human, smaller

Human VoiceOver/NVDA a11y pass (unbooked; Lighthouse insufficient by §15).
Arabic visual QA screenshot-diff over rendering surfaces. Security review of
admin routes. Q4/Q5/Q7/Q9/Q12 in BUILD-PLAN remain unanswered — Q12 (who carries
the 3am pager) matters the moment C5's monitors exist.

---

# D. The shortest honest path to launch

Two tracks. **Start the human track today** — it is the long pole and it does not
wait on any engineering.

### Start now, in parallel, before any code

1. **Stripe MY verification** (C4). Weeks. Already late. Nothing else on the
   revenue path moves until it clears.
2. **Author surah 67's scene beats** (C2). Days. The sole live blocker on the
   freeze gate.
3. **Book the qari window** provisionally for ~6 weeks out, per BUILD-PLAN's
   "book when M8 starts, not after it ends."

### Engineering, in dependency order

4. **Fix the B6 sweep** (§B). Hours. Test-only. Do it first — it is on the
   grading path and it resets nothing.
5. **Repoint the drill corpus loader at `output/`** (§A-note), stage the
   artifacts, widen `AVAILABLE_SURAHS`, and **add a CI clause asserting no
   learner-reachable route reads `test/fixtures/`.** Days. Do it before any
   sign-off, or the qari certifies content learners never see.
6. **Build the session lifecycle — step 18, the critical item.** The corpus
   loader at request time, commit-before-paint (`tx.done` awaited before paint),
   create/resume/summary, bfcache resume, surah-completion celebration. The 4
   render shapes are done and tested; this is the supply and the loop around
   them. **~1.5–2 weeks.** Nothing else makes this a learning app.
7. **Fill in the stub routes** `/home`, `/progress`, `/library`, `/surah/*`
   against the real rebuilt log. Components largely exist. **~1 week.**
8. **Ship a service worker + manifest** (none exists today). Precache the shell,
   fonts, and the client corpus; `start_url=/home` (#92). **~3 days.** Required
   before "offline" is claimable at all.
9. **Fold-runner DB adapter + nightly scheduler + staging deploy** (C5). Advisory
   locks, dead-letter quarantine, late-arrival refold. **~1 week.** This is what
   lets the 7-night clock start.
10. **Playwright e2e** — full-Yusuf offline session, airplane-mode drill,
    two-device determinism. M5 named it first-class; it does not exist.
    **~3–4 days.**
11. **Stripe fixtures** once C4 clears; PAY-1 closes itself. **~2 days.**
12. **Hardening:** a11y human pass, security review, backup restore drill,
    Lighthouse, Arabic visual QA.

### Then, serialized — and these cannot overlap

13. `make content-freeze` **exits 0**.
14. **Qari sessions** (15–25h scholar time) → frontier 100% green on all four.
15. **7 consecutive green nights**, starting only after the last engine merge.
16. `LAUNCH-CHECKLIST.md` all green → **launch**.

**Realistic total: ~6–8 calendar weeks of engineering**, then a **hard serial
tail** of freeze → qari → 7 nights that no parallelism compresses. If Stripe and
the qari calendar are started today they run underneath the engineering; if
they are started when the code is ready, add their lead time to the end.

**The three things that blow this up**, unchanged from BUILD-PLAN and all still
live: a late engine change (resets the 7 nights), content landing after sign-off
(re-buys scholar hours), and marking a step DONE on a component that no route
reaches.

---

# E. How to run it

Every command below was executed on the audit date. Results are what I saw.

### Setup

```bash
make setup     # composer + npm across v2, v2/api, v3/api, 3 v3 packages, apps/web
make doctor    # verifies .env, APP_KEY, ADMIN_EMAILS
make dev       # SPA :5273, API :8000  —  `composer dev` starts the WRONG Vite
```

### The full suite — **exit 0, 1551 passing**

```bash
cd /Users/firdaus/Documents/2026/office-mfa/kuizquran
TZ=UTC make test
```

Pin `TZ=UTC` (JST machine). Verified per-package:

| Suite | Result |
|---|---|
| v2 vitest | 255 passed |
| v2/api PHPUnit | 47 passed |
| v3/api PHPUnit | 194 passed + **2 incomplete** (PAY-1, red by construction) |
| corpus-compiler | 101 passed |
| engine | 391 passed |
| fold-runner | 15 passed |
| apps/web | 548 passed |
| **total** | **1551** — exactly the floor, ✓ but with **zero margin** |

The 2 incomplete are *not* counted in the 1551. The floor is met on the nose, so
any test deleted anywhere drops below it — which is the intended tripwire.

`make test` runs `typecheck-v3` first. Confirm `npx tsc --version` prints
**`Version 5.9.3`**, not a TeX banner — before 2026-08-11 it silently resolved to
macOS's TeX `tsc` and every "typecheck clean" claim was false.

### Gates, typecheck, build — all green

```bash
cd v3/apps/web && npm run gates && npx tsc --noEmit && npm test && npm run build
```

- `gates` → locked-css OK (1 documented `@import`→`@font-face` hunk, 294 v1 lines
  byte-identical) · fonts **2/6, degraded** (Amiri present; 4 UI fonts missing,
  falls back to the locked token stacks — non-blocking, `public/fonts/FONTS.md`
  has the commands) · boundaries OK, 136 files, 9 clauses · corpus-morphology OK
  (no QAC `lemma`/`root`/`class` browser-reachable, v3-D24)
- `build` → **exit 0**, Next.js 16.3.0, 14 routes

### The content gate — **exits 1, correctly**

```bash
make content-freeze     # exit 1 = do NOT book the qari
make distractor-qa SURAH=112 PCT=10 [WRITE=1]
make compile-corpus
make golden-log         # human-reviewed diff ONLY
```

### Verifying a defect closure yourself

```bash
cd v3/apps/web && node scripts/check-boundaries.mjs   # clause 7 catches B5's syntax
cd v3/apps/web && npx vitest run lib/sync/merge.test.ts
```

---

## Can a learner TODAY go landing → onboarding → a completed first session, offline after first load?

# No. The path breaks in three places, and the last break is fatal.

Traced against the real files:

| Step | Route | Reality |
|---|---|---|
| 1. Landing | `/` | ✅ **Works.** Static server component; 5 sections; live `InlineDemo` reconstructing 112:1 from `public/corpus/112.json` through the real engine. `OnboardedSteer` redirects returning learners to `/home`. |
| 2. Onboarding | `/start` | ✅ **Works.** All 7 screens; screens 1–2 capture nothing; 4 answers committed in **one** IDB transaction (`commitOnboarding`), with a designed private-browsing failure state. |
| 3. Redirect | → `/home` | ⚠️ **Break 1.** `router.replace("/home")` lands on a `StubNote`: "Per-surah rows with due counts and the Continue CTA… both wait on the engine running against the rebuilt log." **There is no Continue CTA, so there is no route to a session.** |
| 4. Session | `/session` | ❌ **Break 2 — fatal.** A `StubNote`. Its own docblock: *"the SESSION LIFECYCLE that feeds it is not [built], so this route is still a stub… There is no corpus loader… nothing can produce a `RenderItem` at request time."* No commit-before-paint. No summary. No completion celebration. **A session cannot be started, let alone completed.** |
| 5. Offline | — | ❌ **Break 3.** **No service worker exists** — `grep -rn "serviceWorker"` over the app returns nothing; no `sw.js`, no `manifest.json`, no `next-pwa`. `app/layout.tsx` carries the metadata half only and says "The manifest itself is M10's." A second visit with no network gets the browser's offline page. |

**What a learner CAN do today:** read the landing page, tap through the live
112:1 demo, complete all 7 onboarding screens, and reach `/drill` — which
renders a real picker over surah 12 through the real engine, **but from the
stale test fixture** (§A-note), and which is not linked from any onboarding
exit.

**The honest summary:** the two ends of the journey are built and good — the
landing page and its demo are genuinely finished, and onboarding is careful work
that commits atomically and asks nothing it doesn't use. **The middle is
missing.** Step 18 is the gap between a well-engineered substrate and a product,
and it is the single highest-value thing to build next.

---

## Where this document's own confidence ends

- I mutation-tested **two** ledger entries. One held (B5), one did not (B6).
  The other closures are **unproven at that depth** by me.
- I did not exercise the admin console, workbench, or billing endpoints against
  a **running** server — those verdicts rest on route definitions and passing
  Pest tests, not on a live request.
- I could not verify anything requiring live staging, a Stripe account, or
  elapsed calendar time, because none of those exist in this repo.
- Fonts are 2/6. I recorded this as degraded-but-non-blocking on the gate's own
  reasoning; I did not visually confirm the fallback stacks render acceptably.

**Nothing was committed.** The two mutations were reverted byte-identically and
`git diff` was empty after each.
