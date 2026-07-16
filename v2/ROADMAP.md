# iman.app v2 — Phased Build Roadmap

A sibling of `DECISIONS.md`. Where `DECISIONS.md` records *what* v2 is (the 26 locked
decisions, v2-D01…v2-D26), this file records the *order in which we build it* and *what we
reuse from v1 vs. rebuild*. It resolves the open decision **v2-O2 "Scaffold v2 now?"** into an
executable sequence.

_Generated: 2026-07-16._

## Context

`kuizquran/` holds two generations of a Surah-Yusuf memorization app. **v1** is shipped to
staging, 163 tests passing, sitting at its final human-review gate (Cloudflare Pages + Workers +
D1/DO stack). **v2** keeps v1's tested retention science but rebuilds *what the app is* and *how
the drills work* on a new stack (React+Vite front, Laravel+Sanctum back, local-first). Today the
only v2 code is `v2/src/pages/SystemExplorer.tsx` (an architecture visualization); the real app
is unscaffolded.

The build is sequenced so that (a) v1's crown-jewel engine and corpus are reused rather than
rewritten, (b) real recall events start flowing as early as possible (the thesis in
`../NEXT-STEPS.md` / `../tiktok-discussion.md`: *the data is the product* — maximize successful
retrievals per minute, optimize P(recalled in 10 years)), and (c) the three known live bugs are
fixed as the code is lifted, not carried forward.

---

## Guiding principles (carry-over vs rebuild)

| Asset | Path | Verdict |
|---|---|---|
| Retention engine (23 pure-TS modules + 16 test files) | `v1/packages/engine/src` | **Port as-is** — zero DOM/IO deps, `now` passed in everywhere. One fix: `chain.ts` BUG-3. |
| Compiled corpus (111 ayat / 1777 words / 8885 distractors) | `v1/public/corpus.json` | **Ship verbatim**; keep `packages/corpus-compiler` for regen only. |
| Design system (locked, invariant #5) | `v1/styles/iman-ui.css` | **Copy verbatim, do not restyle.** Amiri-first; teal=learn, coral=slips-only, purple=meaning; no shadows/gradients. |
| Append-only event log + atoms-rebuild pattern | `v1/apps/web/src/db/*`, `sync/outbox.ts` | **Port pattern with changes** — keep IndexedDB log + `rebuild()`; swap transport/auth to Laravel. |
| React surface (drills/session/home/onboarding/habit) | `v1/apps/web/src/*` | **Rebuild** per v2 mechanics — but mine for engine wiring (e.g. the `assembleQueue` call site). |
| Backend (Hono/CF Worker + D1 + DO) | `v1/apps/worker` | **Rebuild in Laravel** — reproduce the 10 routes, `WireEvent` contract, D1 schema, §3 metrics. |

**Three live bugs, fixed as we build (never carried into v2):**
- **BUG-1** pace dial decorative — `v1/apps/web/src/session/useSession.ts:115` hardcodes `budgetMin:8`. Fixed in Phase 2 (wire pace into `assembleQueue`, v2-D09).
- **BUG-2** make-up recovery dead — same caller passes `lastActiveDay:null`. Fixed in Phase 2 (wire `lastActiveDay` from the event log).
- **BUG-3** chains phantom un-learned ayat — `v1/packages/engine/src/chain.ts:70` inits+credits an un-encoded atom. **Genuine engine bug** — fixed in Phase 0 when the engine is lifted (add gap guard; bound chains to real ayah count).

---

## Phase 0 — Scaffold the foundation (v2-O2)

**Goal:** a runnable React+Vite+TS v2 project with the reused science wired in and green tests.
No new UI mechanics yet — just the skeleton everything hangs off.

- Turn `v2/` into a real Vite app: `react-dom` bootstrapping, a router (replace the dev-only hash
  route in `v2/src/main.tsx`), TS project references. Keep `SystemExplorer` reachable at
  `/system-explorer`.
- **Port `packages/engine`** into v2 (workspace package or `src/engine/`), lifting all 23 modules
  + 16 vitest files unchanged **except** `chain.ts` — apply the **BUG-3 gap guard** + regression test.
- **Ship `v1/public/corpus.json`** into `v2/public/`. Keep the compiler for regen.
- **Copy `iman-ui.css` verbatim** into v2, loaded globally.
- **Port the event layer:** append-only IndexedDB log (`db/eventLog.ts` pattern — `append()`
  resolves only after `tx.done`), `rebuildAtoms()` folding through engine `rebuild()`, optional
  snapshot. No sync yet (local-first).
- Set up `vitest` + a minimal test script.

**Exit:** dev server renders a shell; `vitest run` green (ported engine tests + BUG-3 test); an
event can be appended and atoms rebuilt from the log in a test.

## Phase 1 — Core drill vertical slice (v2-D05, v2-D23) — *the instrument*

**Goal:** the single most important build — **tap-to-reconstruct** end-to-end against real corpus
data, emitting real recall events. Front-loaded because everything downstream needs the stream.

- One drill screen: ayah with words progressively hidden (v2-D23 — always grounded *in the
  verse*); learner rebuilds by **tapping** bank words seeded with near-miss distractors from
  `distractorsFor()`. **No Arabic typing** (optional hard-mode typed-Arabic deferred).
- Difficulty auto-scales (more blanks as strength climbs) via `options.ts`/`pickOptions` + band
  from `atom.ts`.
- Wire outcomes through engine `update()`; emit new v2 events **`reconstruct_tap`**,
  **`ayah_produced`** (append-before-feedback, invariant #2).
- Use `iman-ui.css` classes (`.ayah`, `.gap-slot`, `.bank`, `.tile`) — no restyle.

**Exit:** play a real ayah, tap to reconstruct, see strength move, and confirm the two new event
types land in the append-only log.

## Phase 2 — Daily session loop + pace modes (v2-D07/D08/D09/D11) — *fix BUG-1 & BUG-2*

**Goal:** the real once-a-day loop the engine already models, with pace as a first-class mode.

- Home + session driven by `assembleQueue` (order: makeup→gate→review→learn), day-1 cold gate
  (`gate.ts`), resume/floor (`resume.ts`, `floor.ts`).
- **Pace modes Steady / Sprint / Maintain** (v2-D09), persisted + mid-surah editable — **fix
  BUG-1** (pass real `budgetMin`/mode into `assembleQueue`); **fix BUG-2** (feed `lastActiveDay`
  from the event log so make-up merges fire).
- **Unlock tolerance** (v2-D07): recompute `unlockPermitted` after an in-session gate pass +
  mode-scoped ≤1-pending-gate band.
- **Gate forgiveness** (v2-D08): re-scaffold to S2 after N fails, then offer "send back to Learn".
- **Chains** (v2-D11): default victory-lap (`structured:false`, no strength change) + separate
  graded weak-seam repair; junction retry before commit.

**Exit:** a multi-day simulated run advances ayat under each mode; BUG-1/BUG-2 regression tests
prove pace + make-up now fire live.

## Phase 3 — Onboarding & placement (v2-D12)

**Goal:** get a learner to their correct starting point.

- Returning-hifz **binary-search placement** over the 19 story landmarks (`placement.ts`, ≤5
  probes) → carried map + start ayah + daily plan (`capacity.planFor`).
- Anchor-hour onboarding; pace-mode selection.
- **"Not you? switch account"** affordance on Home (v2-D12 — guards shared-device corruption
  without building multi-profile).

**Exit:** a returning learner is placed in ≤5 probes and lands on a correctly-populated Home.

## Phase 4 — Learner progress surfaces + Test feature (v2-D13–D20, D24, D25)

**Goal:** the warm learner-facing read surfaces, all computed from the one event stream.

- **Progress Report** (v2-D17/D20): growth curve, streak calendar, Test history, export — from
  `heatmap.ts`, `strength.ts`, `sessionSummary.ts`.
- **Ring + flat grid heatmap** (v2-D24/D25): 12-movement chiastic ring (mirror pairs around the
  6↔7 pivot) as overview + linked mushaf-faithful 1→111 grid grouped/tinted by movement; tap a
  ring arc → drill into its grid cells.
- **`<InfoTip>`** reusable tooltip (v2-D19), first on "half-life".
- **Test feature** (v2-D13–D16): self-initiated, range defaults to carried (≥80 strength), mixed
  random questions incl. chaining-reorder; **read-only mirror** (`structured:false`, no strength/
  due-date movement); **purple** accent; optional "send to reviews" nudge. New events
  `test_start/answer/result`.

**Exit:** report renders from a seeded event log; a Test scores without moving any strength
(assert `structured:false`).

## Phase 5 — Laravel backend + sync (v2-D03, v2-D18)

**Goal:** durable multi-device identity and sync, still local-first (offline works).

- Laravel + **Sanctum**, anonymous-first with account adoption (v2-D03).
- Reproduce v1's **D1 schema in migrations**: `users`, append-only `events` (PK = client uuid =
  idempotency key), index `(user_id, ts)` — no free text (privacy).
- Idempotent **`POST /events`** / `GET /events` accepting the **`WireEvent`** contract; port
  `sync/outbox.ts` (`flush`/`hydrate`) to point at Laravel with Sanctum auth instead of the CF
  cookie. Plus `GET /me`, `/settings` (anchor hour).

**Exit:** events created offline sync idempotently on reconnect; a second device hydrates the same
history.

## Phase 6 — Admin console + question-bank override layer (v2-D18, D21, D22)

**Goal:** the operator surface and the qari/scholar editing path — kept strictly separate from the
learner Progress Report (v2-D17).

- **Admin/behaviour console**: recompute v1's §3 metrics (`gatePassRate`, `d30Retention`,
  `confusionPairs`, forgetting curve, per-user drill-down) from the same event columns
  (`worker/src/metrics.ts` as the spec). Resolve **v2-O1** (half-life tooltip here too?).
- **Question-bank override layer** (v2-D21): keep runtime auto-generation from corpus; add a
  persisted Laravel override table keyed by ayah+position+type; overrides win at build time.
- **Qari/scholar-friendly editor** (v2-D22): non-technical UI to fix a gloss, curate a distractor,
  group multi-word gloss units (gives DATA-1 a home), disable a bad question, add custom ones.

**Exit:** an editor overrides one generated question and the change surfaces in a drill without a
corpus rebuild; admin metrics match a hand-computed sample.

## Phase 7 — Hardening & gates (from v1 final-report + NEXT-STEPS)

**Goal:** the trust and polish gates before external testers.

- **Scholar distractor review (GATE-A)** — hard gate before any public release; the Phase-6 editor
  is the tool. Resolve DATA-1 (multi-word gloss grouping), the ~14.8% valid-but-attested
  distractors, scene-beat TODO labels, null MS/JA glosses.
- S3 dark-mode tile contrast fix.
- Deferred (post-proof, per NEXT-STEPS): feed-ranking engine (1b), audio/recitation (2b),
  short-surah pack (4a), parallel threads promotion (v2-D10).

**Exit:** GATE-A signed off; no open correctness/trust items block testers.

---

## Sequencing rationale

- **Phase 0 → 1 front-loads the event instrument.** `NEXT-STEPS.md` Part C is explicit: nothing
  (feed engine, learned model, dashboards, moat) can exist without real recall events, and
  retrofitting logging later loses irreplaceable early data. The drill that generates events ships
  right after the skeleton.
- **Backend (Phase 5) is deliberately late.** v2-D01 keeps it local-first "until solid"; the
  engine + IndexedDB log make a full single-device product possible with no server. Laravel adds
  durability/multi-device once the loop is proven — not a prerequisite to prove it.
- **Bugs are fixed at point-of-lift**, not as a separate pass: BUG-3 in Phase 0 (engine), BUG-1/2
  in Phase 2 (the new session caller).

## Verification (per phase, end-to-end)

Each phase is validated by *driving the real thing*, not just types:
- **Automated:** `vitest run` — ported engine suites stay green every phase; add regression tests
  for BUG-1/2/3 and for `structured:false` read-only invariants (Test, victory-lap chains).
- **Runtime:** launch the dev server and drive the affected flow — Phase 1: tap through a real
  ayah and inspect the log for `reconstruct_tap`/`ayah_produced`; Phase 2: simulate multi-day runs
  across Steady/Sprint/Maintain and confirm pace + make-up fire; Phase 4: render report/ring from a
  seeded log and assert no strength moved during a Test; Phase 5: create events offline, reconnect,
  confirm idempotent sync + second-device hydrate.
- **Trust gate:** Phase 7 GATE-A (scholar review) is a human sign-off, not a test.

## Open items to confirm before/at each phase

- **v2-O1** — half-life tooltip on the admin console too? (decide in Phase 6.)
- **Engine placement** — port as a pnpm workspace package (mirrors v1) vs. vendored `src/engine/`
  in the single v2 app. (Recommend: workspace package to keep tests + regen tidy.)
- **First shippable scope** — Surah Yusuf only (recommended, matches corpus) vs. add a short-surah
  onboarding pack (NEXT-STEPS 4a) later.
