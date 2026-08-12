# LAUNCH-CHECKLIST.md

**Build-plan step 30 / M10.** The handover document. Every gate named in
BUILD-PLAN's "Gates & checks" section appears here exactly once, in one of three
states:

| State | Meaning |
|---|---|
| **GREEN** | Proven now, by a command written in the row. Re-runnable. |
| **BLOCKED-ON-HUMAN** | Cannot be closed by any amount of engineering. Names who, and what. |
| **BLOCKED-ON-INFRA** | Needs a thing that does not exist yet (an account, a staging host, calendar time). |

> **This document is only useful if it is honest.** A checklist that reports
> green because a check exists — rather than because it passed — is the
> `v3-D50` failure (71 tests that never ran while every report said green).
> Where a gate is red, this file says red and says why. Nothing here is marked
> green on the strength of a docblock.

Generated 2026-08-11. Verified against the repo, not against memory.

> **Note (2026-08-12, v3-D79):** the test counts in this document (gate 0's
> 1504, and the per-suite table it quotes) predate several later runs and are
> stale — `v3/CLAUDE.md`'s `make test` comment carries the current number.
> Only gate 19 was re-verified and edited in this pass. Every other gate's
> verdict here is as of 2026-08-11 and should be re-checked against the repo
> before being trusted, per this document's own opening rule.

---

## 0 · The one-command state of the world

```bash
cd v3/apps/web && npm run gates && npx tsc --noEmit && npm test && npm run build
cd v3 && TZ=UTC make test        # from repo root: TZ=UTC make test
```

At the time of writing: **`make test` exits 0 with 1504 passing** (255 v2 vitest
+ 47 v2/api + 194 v3/api + 101 corpus-compiler + 391 engine + 15 fold-runner +
548 apps/web — baseline was 1431), plus **2 deliberately incomplete** (the Stripe replay suite — see
gate 11, red by construction and refusing to pass vacuously).

---

## 1 · CI invariant-gate (phase 1) — **GREEN**

Every clause BUILD-PLAN names, proven by:

```bash
cd v3/apps/web && npm run gates
cd v3/api && TZ=UTC php artisan test --filter=Boundaries
```

| Clause | Where | State |
|---|---|---|
| Engine arch isolation (engine imports no react/next/dom) | `packages/engine` arch tests | GREEN |
| Purity lints (`Date.now`, `Math.random`, crypto, zero-arg `new Date()`, local-date getters) | engine suite | GREEN |
| Closed-union type tests (`Rung`, `CorpusRef`-no-literal) | engine suite | GREEN |
| Arabic-codepoint diff grep (incl. presentation forms, `\u` escapes, `.php/.json/.sql`) | `check-boundaries.mjs` clause 4 | GREEN |
| v1/v2 path guard | CI | GREEN |
| Locked-CSS byte-diff vs v1 (modulo the documented `@import` strip) | `check-locked-css.mjs` | GREEN — 1 hunk at line 17, 294 lines byte-identical |
| Pricing-constants test quoting v3-D07 | `test/pricing.test.ts` | GREEN |
| Entitlement boundary (v3-D55, both directions) | `EntitlementBoundaryTest` + `check-boundaries.mjs` clause 9 | GREEN |
| Invariants 1/3/4/5 property pack | engine suite | GREEN |

**Note.** The Arabic-codepoint clause fired during this very step, on a test
file that had written the Arabic range as `\u` escapes to *detect* Arabic. The
gate was right; the test was rewritten to assert the stronger structural
property instead. The gate was not weakened.

---

## 2 · Golden-log fold-parity — **GREEN**

```bash
cd v3/packages/engine && npm test        # 391 tests
```

Fold of the pinned-v2-SHA (`c34f5c3`) golden log matches the committed oracle.
Oracle regeneration remains human-approved (CLAUDE.md rule 4) — no agent has
regenerated it.

---

## 3 · `fold_determinism_check` — **RUNNER GREEN · BLOCKED-ON-INFRA for production data**

**What changed (v3-D67):** the check now has a *runner*, a *schedule* and a
*ledger*. Before this, the gap was not only the missing staging host — nothing
in the repo ran the check on **any** host, and
`SystemHealthController::foldDeterminism` read a cache key **no line of code
anywhere ever wrote**. That is fixed.

Provable right now, no database and no host required:

```bash
make determinism-check          # both checks against committed fixtures
cd v3/api && php artisan determinism:check both --fixture
cd v3/api && php artisan schedule:list   # shows the nightly, 03:00 UTC
```

The BUILD-PLAN taxonomy is real rather than a log string — it is the runner's
**exit code** (`worker/fold-runner/src/severity.ts`): green 0 · **warn 3** ·
**p1 4** · error 5. Demonstrated: the *identical* 0.0001 perturbation of a
cached atom exits **4 (P1)** when the cached row carries the current
engine_version and **3 (WARN)** when it carries an older one.

**Still blocked:** the check runs against the **committed golden-log fixture**,
not "sampled users' server logs". The DB-fed path (`determinism:check fold`
without `--fixture`) is written and tested — against an empty database, where it
correctly reports **error, not green** — but has never run against real data,
because no such data and no host exist. Requires gate 20.

---

## 4 · `selection_determinism_check` — **RUNNER GREEN · BLOCKED-ON-INFRA for production data**

Same shape as gate 3, plus a defect this run found and closed (**v3-D69**):

BUILD-PLAN says this check runs "against the shuffled golden log". Measured:
`fixtures/golden-log/events.json` holds **24 events and 0 selection-bearing
ones** — it predates the step-10 wire freeze. `replaySelection` skips events
without siteKey/deviceId/visitOrdinal, so a runner pointed at the golden log
would have compared **nothing** and exited green **every night forever**.

Closed by generating `fixtures/selection-log/` (36 events, 5 sites, 2 devices,
including the two-device merge and a seam site) and by giving the runner a
**vacuity floor**: fewer than 20 traces compared is an `error`, never a green.
The golden log is unchanged and remains the *fold* check's fixture.

```bash
cd v3/worker/fold-runner && node_modules/.bin/vite-node bin/selection-determinism-check.ts
#   green · 36 events · 432 traces compared across 12 seeds
node_modules/.bin/vite-node bin/selection-determinism-check.ts -- --events ../../fixtures/golden-log/events.json
#   exit 5 — "Refusing to report green over an empty comparison"
```

**Still blocked:** replaying selection against *production* logs needs the
pinned corpus per event `corpusHash`, and no server-side corpus store exists
(`selection.ts`'s own `replaySelection` header says so). The nightly proves the
deployed code is shuffle-invariant against the committed log; it does not yet
prove it against real logs. Requires gate 20 **and** a corpus store.

---

## 5 · E-01-before-second-surah — **GREEN (permanently satisfied)**

The E-01 keying commit is an ancestor of HEAD. Surah keying landed before any
second-surah artifact existed. This gate has no remaining appeal surface.

---

## 6 · Content-freeze-before-qari — **BLOCKED-ON-HUMAN**

**Who:** Firdaus, plus the named Malay reviewer (unfilled — see gate 7).

Entry criteria, none of which an agent may satisfy:

- [ ] MS decision executed (authored+reviewed, or formally excluded from hash v1)
- [ ] Scene beats authored for every launch surah
- [ ] Distractor QA sampled (10% per surah) — tooling exists: `v3/scripts/distractor-qa.mjs`
- [ ] `hashSpecVersion` frozen
- [ ] Corpus + specs frozen — tooling exists: `v3/scripts/content-freeze.mjs`

The *tooling* is built. The *content* is human-only forever (CLAUDE.md).

---

## 7 · Qari review — **BLOCKED-ON-HUMAN (the hard gate)**

**Who:** a qari with doctrinal authority. Not yet named (BUILD-PLAN Q4 open).
**Scope:** ALL launch-serving surahs (12, 112, 103, second surah) including seam
renders. **Budget:** 15–25 scholar hours. **Lead time:** weeks.

The *tooling* is complete and green: tiered content hash, TOCTOU-proof signing
(shown-hash carried, server recomputes at commit), any-row-matches-current
predicate, red rejection state with per-ayah serving kill, workbench qari mode.

**No agent may sign a verification row.** This gate blocks PUBLIC LAUNCH
absolutely, and it cannot start until gate 6 closes.

---

## 8 · Malay glosses — **BLOCKED-ON-HUMAN**

**Who:** a named Malay reviewer with doctrinal authority. **Not yet recruited.**

Per BUILD-PLAN Q2 this must be settled *before* the verification migration
ships, because it changes the hash schema itself. `gloss_drafts` exists as a
flagged non-shipping table; **no agent may author or ship a gloss.**

Decision still owed: launch EN-only with `gloss.ms` excluded from hash v1, or
author+review MS before the qari pass (adding ~11h review + drafting to the
critical path, ahead of gate 7).

---

## 9 · Dark-pattern / ethics gate — **GREEN (mechanism) / BLOCKED-ON-HUMAN (governance)**

```bash
cd v3/api && TZ=UTC php artisan test --filter=FlagPlane   # 16 tests
```

| Property | State |
|---|---|
| Enable-hard ceremony (reason ≥20 chars + two ethics booleans + verbatim flag name), server-enforced | GREEN |
| Kill-easy: one click, unconditional write, no ceremony | GREEN |
| Ack never re-enables (#159) | GREEN |
| 72h auto-waive, audited | GREEN |
| **All 11 flags default OFF** | GREEN — `FlagRegistry`: 11 `false`, 0 `true` |
| Pre-committed shutdown rule in DECISIONS.md before any ramp | BLOCKED-ON-HUMAN — Firdaus |
| Second admin at launch, or the degraded solo rules | BLOCKED-ON-HUMAN — BUILD-PLAN Q9 |

**Fixed during this step:** the enable route defaulted its expected version to
the version it had just read back, which made the optimistic-concurrency check a
no-op for any caller omitting the field — a versionless ramp could resurrect a
flag another operator had just killed. Now required; regression test asserts the
*outcome* (the killed flag stays killed), not the 422.

---

## 10 · 7-consecutive-green-nights — **COUNTABLE NOW · BLOCKED-ON-INFRA (hard serial tail)**

**Nothing about this is compressible.** It is 7 calendar days on live staging,
starting only *after* the last engine/selection merge, with both determinism
checks green nightly (a confirmed P1 resets the window; a WARN does not).

**What changed (v3-D68):** the window is now a **ledger**, not a wish. It was
previously uncountable in a stronger sense than "no host" — there was no record
of nights, no definition of the arithmetic anywhere in code, and nothing that
ran the checks it counts. Now:

```bash
cd v3/api && php artisan nightly:window --start=<YYYY-MM-DD> --reason="engine merge <sha>"
make nightly-window        # streak + a dated table of every night behind it
```

`nightly_check_runs` stores one **immutable row per run** — severity, raw exit
code, and the runner's full JSON report (what it actually compared). The streak
is *derived* from those rows, so it arrives with evidence rather than requiring
trust — which is what edge case #169 ("7-green-nights arithmetic → contested
gate") predicts will be needed. Exit code is the gate: 0 only when satisfied.

Four rules, each tested directly and each proven by mutation (`WindowLedgerTest`,
15 tests): both checks required per night · **a confirmed P1 resets to zero**,
and a same-night re-run does not launder it · **a WARN does not reset** · nights
before the declared start never count. A calendar **gap** also breaks the streak
— a scheduler that silently stopped for three days leaves green rows a naive
`count(green)` would happily call "4 and counting".

Demonstrated end to end locally: seven fixture nights → `streak 7 of 7,
satisfied YES`; then one corrupted-oracle night → `streak 0 of 7, last P1
2026-08-12 (fold_determinism_check) — reset the window`.

Depends on gates 3, 4 and 20. **The window has NOT started.** It starts on real
infrastructure, on real nights, against real data — none of which exists. What
this run delivered is the ability to *count* it honestly once it does, not the
window itself.

---

## 11 · Stripe webhook replay suite — **BLOCKED-ON-INFRA (red by construction)**

```bash
cd v3/api && TZ=UTC php artisan test --filter=ReplaySuite
#   2 incomplete, 2 passed — incomplete BY DESIGN
```

Per **v3-D56**: no test-mode Stripe account exists, so `v3/fixtures/stripe/` is
empty and `ReplaySuiteTest` asserts a **minimum fixture count before it asserts
any behaviour**. It is marked incomplete-with-reason rather than passing
vacuously over zero cases — refusing v3-D50's failure mode explicitly.

The state machine, transition guards, idempotency index and ordering-invariance
tests are real and green. **The suite this gate names is red until fixtures are
recorded against a real Stripe test account.**

---

## 12 · Stripe business verification — **BLOCKED-ON-HUMAN (weeks of calendar)**

**Who:** Firdaus. **Lead time:** weeks. **Should have started day 0.**

Stripe MY business verification is pure calendar and gates all live payment. It
also blocks gate 11 (no test account → no fixtures). FPX cannot do recurring, so
MY monthly is card-only at launch unless Curlec is added (BUILD-PLAN Q7, open).

---

## 13 · Backup restore drill — **GREEN (SQLite) / BLOCKED-ON-INFRA (Postgres)**

```bash
cd v3/api && TZ=UTC php artisan backup:restore-drill
```

Built and **run** in this step. A real round trip — dump → encrypt → wipe →
decrypt → restore → verify — that exits non-zero when the restored copy differs.
Last run: **503 rows across 17 critical tables, PASSED.**

| Property | How it is proven |
|---|---|
| It actually restores | Per-table row counts **and** a checksum over the event log's wire columns in canonical order. A restore preserving counts while corrupting a column fails. |
| Encrypted | The artifact is grepped for a known plaintext needle that is definitely in the database; finding it fails the drill. A property of the ARTIFACT, not of the code path. |
| Purge-aware | A PDPA delete is recorded *after* the backup is taken; the restore is then reconciled against the purge ledger and the forgotten subject must not come back. A non-purged subject must survive. |
| Referential integrity | `PRAGMA foreign_key_check` after the load. |

**Falsifiability proven by mutation:** bypassing `openssl_encrypt` → red;
truncating the dump to 90% → red (and the drill reports the partial restore as
a verdict rather than crashing).

**Two honest limits, printed by the command itself on every green run:**

1. It ran against **SQLite**. A green SQLite drill does not prove a Postgres
   restore. → BLOCKED-ON-INFRA (gate 20).
2. **The PDPA delete endpoint now exists (v3-D79) and writes to a real
   `purge_ledger` table** — but the drill still reconciles against its own
   throwaway JSON file, not that table, and this is deliberate rather than
   stale: the ledger a real restore reconciles against must survive
   independently of the very backup being restored, or a disaster that takes
   out the primary database also takes out the record of who was purged
   between the last backup and the incident. The drill's external file stands
   in for that independent source; wiring it to read the live `purge_ledger`
   table directly would defeat the property this drill exists to prove,
   because that table would be wiped and restored right along with
   everything else. → see gate 19.

---

## 14 · Human VoiceOver / NVDA a11y pass — **BLOCKED-ON-HUMAN**

**Who:** Firdaus or a hired tester, on real assistive tech.

BUILD-PLAN is explicit that **Lighthouse alone is insufficient**. What an agent
could verify has been verified (gate 15); what remains is whether a screen
reader user can actually complete a session.

---

## 15 · §15 a11y audit (mechanical half) — **GREEN**

```bash
cd v3/apps/web && npm test -- test/a11y-tap-targets.test.ts test/progress-list.test.tsx
```

Audited in this step. **Findings and fixes:**

| # | Finding | Fix |
|---|---|---|
| A1 | **`.option` was 40px tall** — locked `padding: 9px 12px` + 14px×1.5 line + hairlines — under the 44px floor. It is the entire answer surface of the `choice` and `locateChoice` shapes: the most-tapped control in the product, missing the floor on every quiz screen. `.tile` was correctly wrapped by `.tile-hit` everywhere; `.option` was wrapped nowhere. | `min-height: var(--tap-min)` in `iman-ext.css` (the locked file is byte-gated and cannot be edited). |
| A2 | Making `.option` a flex container silently **inerts the locked `text-align: right`** on `.option--arabic`, left-aligning every Arabic option. | `justify-content: flex-start` — under the locked `direction: rtl` this resolves to the right edge, so one declaration reproduces both alignments without naming a physical side. |
| A3 | **`btn--quiet` was defined by no stylesheet.** The progress table's empty-state "Clear" button rendered as a full-width default `.btn` mid-sentence. Invisible to typecheck, lint, and every role-based render test. | Corrected to the locked `btn--ghost`, plus `hit` for the floor and a scoped `width: auto` for inline use. |

**Verified already-correct** (this codebase had done real a11y work): the
`prefers-reduced-motion` blanket rule at `iman-ui.css:185`; `StageBadge` as the
*only* stage renderer, always dot + word + number with the dot `aria-hidden`
(edge case #87); `dir="rtl" lang="ar"` on the Arabic cell only, never the row,
with `unicode-bidi: isolate`; semantic `<table>` with `scope="col"`/`scope="row"`
and `aria-sort` driving the visual arrow from the same attribute the screen
reader announces; `sr-only`, skip link, and visible `<label>` on the search box.

**New regression test** (`test/a11y-tap-targets.test.ts`, 13 tests) computes the
height a browser would lay out from the winning declarations across both
stylesheets, rather than grepping for `--tap-min` — a grep-shaped test passes on
exactly the codebase this audit found. Mutation-proven: removing the ext floor →
red; dropping the flex alignment → red; restoring `btn--quiet` → red.

**Latent risk, not a live defect:** `reveal.ts` documents that colour is never
the only reveal signal because `.option.is-err` also shakes — but the locked file
kills all animation under `prefers-reduced-motion`. Both live callers
(`InlineDemo`, `FirstRecall`) pair the reveal with `role="status"` text, so the
contract holds today by caller discipline rather than by construction. A future
caller that omits the text would be colour-alone for a reduced-motion
deuteranope.

**UPDATE (session loop landed).** This prediction came true immediately.
`SessionIsland` — the third live caller, and the one a learner actually spends
their time in — shipped a colour-only verdict with no paired text. Fixed: it
now renders a `role="status"` line ("Correct." / "Not quite — try again.")
alongside the reveal. The contract is still caller discipline rather than
construction, so a FOURTH caller can reintroduce this; closing it properly means
moving the text inside the card, which is a change to the locked render layer
and wants its own decision.

---

## 16 · Security review of admin routes — **GREEN (three findings fixed)**

```bash
cd v3/api && TZ=UTC php artisan test --filter="Admin|FlagPlane"
```

Full written review in **§A** below. Four real findings, all fixed and
regression-tested with mutation proof:

| # | Finding | State |
|---|---|---|
| S1 | A reveal token was looked up **by value alone** — usable by any admin, not only its minter. Since `reveal` writes one audit row at mint time naming one actor, a second operator extending someone else's reveal left the audit log naming the wrong person. | FIXED — scoped to `admin_id`; refusal identical for expired/unknown/not-yours (no token oracle). |
| S2 | The **bulk CSV export wrote no audit row.** No identity columns, so it looked exempt — but stable pseudonyms + signup dates + event counts is a full behavioural profile of the entire user base, joinable against any one previously revealed identity. | FIXED — audited *before* the stream opens, so a dump that dies mid-flight is still recorded. |
| S3 | `enable()` **defaulted the expected flag version to the version it had just read**, making the concurrency check a no-op for any caller omitting it — a versionless ramp could overwrite a concurrent kill. | FIXED — version now required; test asserts the killed flag stays killed. |
| S4 | The append-only audit's **layer 1 was a promise with nothing behind it.** `AdminAudit` and the migration both cite `docs/ADMIN-CONSOLE.md` for the Postgres `REVOKE UPDATE, DELETE` grant, and the docblock claimed an `AdminAuditTest` asserted it was documented. **Neither the file nor that test existed** — so the only layer that survives a raw query or a bypassed model was undocumented and unappliable. | FIXED — grant, verification query and destructive proof written; a test asserts they exist and are runnable. **Applying it to production remains a human step (gate 20).** |

**Verified already-correct:** fails-closed admin auth with one generic error for
all four failure cases **and constant timing** (the dummy-hash path is real and
unconditional); `EnsureIsAdmin` requiring a verified email (B7's fix, closing the
allowlist-squatting race); append-only audit enforced in *both* the ORM and a
documented DB grant; PII scanning of audit free text before commit; HMAC
pseudonyms that throw rather than degrade on a missing pepper; no PII in logs
(one `Log::warning` in the whole app, structured, no identity); Stripe webhook
authenticated by HMAC over the raw body and failing **closed** with 503 on an
unconfigured secret.

---

## 17 · QAC/Tanzil attribution page — **GREEN**

```bash
cd v3/apps/web && npm test -- test/attribution.test.tsx   # 9 tests
```

Live at **`/attribution`**, prerendered static, **linked from the landing
footer** (an attribution page nobody can reach discharges no obligation — the
link is asserted by test).

Content is verified against `v1/data/raw/SOURCES.md` and the font's own name
table, not written from memory: QAC v0.4 (Kais Dukes, University of Leeds, GNU
GPL); Tanzil Project (Uthmani text + canonical numbering); Amiri v0.113 (SIL OFL
1.1, "The Amiri Project Authors" — the collective credit the font itself
carries). The test cross-checks the page's claims against SOURCES.md so the
assertions are not a closed loop with the copy module.

The page claims no endorsement by any source project, and asserts it renders no
Quranic text at all — structurally, by proving it imports no corpus or engine
module.

---

## 18 · v3-D24 QAC morphology is build-time only — **GREEN (was silently violated)**

```bash
cd v3/apps/web && node scripts/check-corpus-morphology.mjs
```

**This decision was ratified on 2026-08-10 and had never been implemented.**
`public/corpus/112.json` — a public, unauthenticated static asset inside a paid
bundle — carried GPL-licensed `lemma`, `root` and `class` on **all 15 of its
words**. The decision existed, was cited, and was wrong about its own codebase.

**Fixed:** `stage-corpus.mjs` now strips the three fields at the one boundary
where corpus data crosses into the browser. Safe: nothing outside the compiler
reads them (engine `types.ts` declares all three `| null`; no engine module, lib
or component dereferences them), and distractors arrive pre-computed. The
compiler's own `output/` legitimately keeps them — that is the build-time use
v3-D24 permits.

**New gate**, wired into both `gates` and `prebuild`, checks the *actual
artifacts in `public/`* structurally (a gloss containing the English word "root"
must not fail; a field named `root` must not pass). Mutation-proven: bypassing
the strip → red.

---

## 19 · PDPA export / delete / purge cascades — **BACKEND GREEN · NO FRONTEND SURFACE**

**Updated 2026-08-12 (v3-D79).** Was NOT BUILT; the backend half now is.

```bash
cd v3/api && TZ=UTC php artisan test --filter=AccountDeletionTest   # 14 passed
```

`GET/POST /api/account/deletion`, `POST /api/account/deletion/restore`,
`GET /api/account/export` (all self-service, `auth:sanctum`, scoped to the
caller's own `user_id`) + `php artisan pdpa:purge-due` (scheduled daily 02:00
UTC) is the endpoint gate 13's backup drill was built in anticipation of — its
own header said so explicitly: "when the PDPA endpoint lands, it writes to this
same ledger and this drill covers it unchanged." `purge_ledger` is that ledger,
now a real append-only table rather than the drill's throwaway JSON file.

Mutation-verified (v3-D79): dropping the restore token's `user_id` scope (same
shape as the M10 reveal-token finding S1) and disabling the admin-self-delete
guard each turn their own regression test red.

**Still open:**
- **No frontend surface exists.** `apps/web` has no settings screen calling any
  of these routes — a learner cannot reach this today, only an API client can.
- **The Postgres append-only grant for `purge_ledger` is documented
  (`docs/ADMIN-CONSOLE.md` §1b) but not applied** — gate 20, no production
  database exists.
- **`pdpa:purge-due` has never run on a live schedule** — same "no host runs
  `schedule:run`" gap as gate 20 names for the determinism nightly.

This is the dependency gate 13 names: the backup drill's reconciliation
mechanism now has a real writer. **A launch that ships this backend without the
frontend surface is still a PDPA exposure** — a learner who cannot find a
delete button cannot exercise a right that only an API call reaches.

---

## 20 · Hosting / staging environment — **BLOCKED-ON-INFRA**

**Nothing is deployed.** No staging host, no Postgres, no cron running
`schedule:run`, no pager. This single gap blocks gates 3, 4, 10 and the Postgres
half of 13 — i.e. it is the critical path for roughly half of everything still
open.

As of v3-D67 the nightly schedule *is defined in the repo* (`routes/console.php`,
03:00 UTC, visible via `php artisan schedule:list`) — but a Laravel schedule only
fires if something invokes `schedule:run` every minute, and no host does. The
gap is now precisely "one cron entry on a machine that exists", not "the
scheduling was never written".

Two named, still-open sub-gaps inside this gate:

- **The pager is not wired.** v3-D18 says a `fold_determinism` P1 "pages by
  email, not phone". `DeterminismCheckCommand` logs at error level and records
  the P1 permanently in the ledger, but **no mail dispatch exists** — there is
  no operational mailer configured. A P1 at 3am currently pages nobody.
- **Per-user advisory locks remain deferred** (v3-D32, restated in v3-D70).
  Single-flight is a run-level `Cache::lock`; sqlite has no `pg_advisory_lock`
  to test a per-user path against.

BUILD-PLAN Q12 is still open: self-managed VPS vs Forge + managed Postgres, and
**who carries the 3am pager** when `fold_determinism` pages a P1.

---

## 21 · Per-corpus Amiri glyph-subset check — **BLOCKED-ON-INFRA**

Codepoint coverage was verified **manually, once**, and recorded in
`public/fonts/FONTS.md` (Arabic U+0600–06FF: 254 mapped; Supplement: 48;
Presentation Forms-A: 611). `check-fonts.mjs` verifies the font **exists** and
hard-fails on missing Amiri — it does not verify per-corpus glyph coverage.

**To close:** a script that walks each compiled corpus's codepoints and asserts
every one is mapped by the shipped Amiri subset. Cheap to build; it needs the
final launch corpus set (gate 6) to be meaningful.

**Related, and loud:** `npm run gates` currently warns that **4 of 6 UI fonts are
absent** (Inter 400/500/600, Source Serif 4 400). By design this is a warning,
not a failure — they degrade to the fallbacks the locked token stacks already
name. Amiri, the one that matters, is present.

---

## 22 · Arabic visual QA screenshot-diff — **BLOCKED-ON-HUMAN**

**Who:** Firdaus. Edge case #197: Arabic rendering (ligatures, harakat, bidi) is
**unverifiable by agents** — an agent cannot see whether a ligature rendered
correctly. Human visual QA plus a screenshot-diff suite over Arabic surfaces on
every corpus/font change.

Neither the suite nor the human pass exists yet.

---

## 23 · v2 customs archived with no serving path — **GREEN (vacuous, and honestly so)**

v3 is greenfield-data (v3-D08 / BUILD-PLAN Q8 default): v2's data is **not
imported**. DECISIONS.md records v2 holds 8 users, 41 events, 0 overrides, 0
verifications — all dev data. There is no `custom` type in v3 (B1 is dead by
construction: typed overrides only).

There is therefore nothing to archive and no serving path to remove. Marked
green because the gate's *property* holds, with the reason stated so nobody
later reads it as "someone archived the customs".

---

## 24 · All social flags OFF — **GREEN**

`FlagRegistry` declares 11 flags, **all defaulting `false`**, and social code is
post-launch by construction (M11). Asserted by `FlagPlaneTest`; the ceremony
required to turn any of them on is gate 9.

---

## The critical path out of here

Ordered by what unblocks the most:

1. **Stand up staging** (gate 20) → unblocks 3, 4, 10, and Postgres-13.
2. **Start the Stripe MY application** (gate 12) — weeks of calendar, and it
   gates 11. Should already have started.
3. **Recruit the qari and the Malay reviewer** (gates 7, 8) — weeks of lead
   time; nothing engineering does shortens this.
4. **Build a frontend surface for the PDPA delete path** (gate 19) — the
   backend is done (v3-D79); a learner still cannot reach it without one.
5. **Content: MS decision → scene beats → distractor QA → freeze** (gate 6),
   then and only then book the qari sessions.
6. **Human passes**: a11y on real AT (14), Arabic visual QA (22).
7. **Then** start the 7-night window (gate 10) — and do not merge engine or
   selection code during it, because a confirmed P1 resets it to day zero.

**The honest summary:** every gate that engineering can close is closed. What
remains is one infrastructure gap that cascades into four gates, two human
recruitments with multi-week lead times, one endpoint with no frontend yet
wired to it, and seven
days of calendar that cannot start until the rest of it lands.

---

# §A · Security review — admin routes

**Scope:** every route under `/api/admin`, plus `/api/admin/login`, the
`EnsureIsAdmin` middleware, and the models they write. Reviewed against
BUILD-PLAN's four named properties: fails-closed auth, no admin-address oracle
(errors *and* timing), append-only audit, no PII in logs.

## A.1 Fails-closed authentication — PASS

`AdminAuthController::login` evaluates all four failure conditions and branches
**once, at the end**, so no path returns earlier than another:

- no such account · wrong password · not allowlisted · unverified email
- → identical status (403), identical body, identical headers, no signup or
  reset link.

`EnsureIsAdmin` is the outer gate: an **unverified email can never pass**, which
closes DEFECTS.md#B7 entirely (v2 let anyone who knew an `ADMIN_EMAILS` address
register it and become admin before the real admin signed in). An empty or unset
allowlist means nobody is admin — it fails closed, never open.

## A.2 No admin-address oracle — PASS, including timing

The subtle half is done correctly: **the password hash is verified even when the
account does not exist or is not allowlisted**, against a dummy bcrypt hash
generated once per boot at the app's configured cost. A naive early return would
take ~1ms against bcrypt's ~250ms — a 250× side channel that reintroduces in
timing the oracle carefully closed in the response body.

Login is rate-limited (`throttle:10,1`), as are password reset and email
verification (`throttle:6,1`).

## A.3 Append-only audit — PASS, two layers

1. **DB permission** (production): the app's Postgres role has INSERT/SELECT and
   not UPDATE/DELETE. The real guarantee — it survives raw queries and bypassed
   models. A grant cannot be tested from inside the app that lacks it.
2. **ORM guard**: `updating`/`deleting` hooks throw. This is the layer that
   holds in SQLite tests and gives a clear error in development.

**This was finding S4.** Layer 2 was real and tested; layer 1 pointed at
`docs/ADMIN-CONSOLE.md`, which **did not exist**, and at an `AdminAuditTest`
that also did not exist. The grant is now written (`api/docs/ADMIN-CONSOLE.md`
§1) with its verification query and a destructive staging proof, and a test
asserts the runnable statements are present. **It has not been applied to any
database, because no production or staging database exists** — the doc carries an
explicit "last verified" table with no rows in it. Until gate 20 closes, the
audit log's real guarantee is the ORM layer only.

The reveal path writes its audit row **first, inside the transaction**, and
audits *even for a missing or anonymous subject* — which is what makes user-id
probing visible rather than silent (edge case #148).

## A.4 No PII in logs — PASS

Exactly one `Log::` call exists in the entire app (`EventsController`, the daily
cap warning); it is structured and carries no identity. Audit free text is
scanned for email-, name- and MyKad-shaped strings **before commit**, and the
operator must explicitly acknowledge to proceed — because an append-only row
containing a real name is unpurgeable, and would make a future PDPA delete
impossible to honour without breaking the audit guarantee.

Identity leaves the system through exactly one path: the per-subject,
reason-required, server-TTL'd, audited `reveal`. The bulk CSV has **no parameter
that can reintroduce identity** — no config, no branch, no role-gated checkbox
that an operator could be socially engineered into ticking.

*(Hardened during this review: the drill command's error reporting strips bound
SQL from driver exceptions, because a `QueryException` echoes the failing INSERT
— and therefore a learner's email and bcrypt hash — into the console and CI log.)*

## A.5 The three findings

Detailed in gate 16 above (S1 reveal-token ownership, S2 unaudited bulk export,
S3 flag version default). Each is fixed, each has a regression test asserting
the observable outcome rather than the mechanism, and each test was **proven to
fail** against a deliberate reversion of its fix before being accepted.

## A.6 Not findings, recorded so the next reviewer does not re-litigate them

- **`/api/overrides`, `/api/verifications`, `/api/specs` are public reads.** This
  is deliberate and documented (v2-D21/D55, GATE-A): every client, including an
  anonymous device, needs them to build correct questions. They expose no
  identity.
- **The Stripe webhook is unauthenticated by design.** Stripe carries no session;
  the HMAC over the raw body *is* the authentication, and an unconfigured signing
  secret fails **closed** with 503 rather than accepting anything.
- **Bearer tokens, not cookies**, throughout — so there is no CSRF surface to
  guard on these routes.
- **`rebuild-atom-cache` is the only mutating action** on the health surface. It
  re-derives from the event log and never invents (WIREFRAME §16: staff may never
  edit graded state), behind a mutex so a second click queues rather than racing.

## A.7 Open, needing a human decision

- **Is there a second admin at launch?** (BUILD-PLAN Q9.) If solo, the degraded
  two-person rules — 24h delay instead of a second ack — must be recorded in
  DECISIONS.md *before* any flag ramp or notification send.
- **Break-glass.** The `admin` allowlist is env-driven, so recovery is an env fix
  plus restart (edge case #146). This is correct but assumes someone can reach
  the host — which is gate 20, which does not exist yet.
