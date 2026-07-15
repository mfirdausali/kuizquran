# Progress ledger — iman.app Yusuf Quiz Engine (v0.1 → v0.8)

Read this first on any fresh session. Resume at the first version not marked
**done**. One version at a time; do not advance until the prior exit criterion is
evidenced here. Status ∈ {pending, in-progress, done, blocked-on-human}.

**CURRENT POSITION (2026-07-15):** v0.1–v0.8 done & tagged (full PRD §10 plan
complete). **v0.9 added: a personal progress dashboard + training selector as the
HOME screen** (D36/D37) — the app now lands on a home base instead of a drill; all
training launches from it. Live on staging. Still **at GATE D** (final review before
testers; docs/final-report.md). Suite: 164 tests pass. Open follow-ups: DATA-1
multi-word gloss grouping; S3 dark-mode tile contrast (design-system).

Staging URLs: web https://iman-quiz.pages.dev · API (same-site) /api/* · /admin at
/api/admin (ADMIN_EMAILS-gated) · worker iman-worker-staging.firdaus.workers.dev ·
D1 iman-db (acct 5cc4…).

| Ver | Scope (PRD §10 FR set) | Exit criterion | Status | Evidence |
|-----|------------------------|----------------|--------|----------|
| v0.1 | FR1 corpus compiler + corpus.json | 111 ayat render; distractors spot-checked | **done** | see below |
| v0.2 | FR2 S1–S3 local, iman-ui.css | user zero encodes one real ayah (12:4) end-to-end | **done** ✓ (GATE B cleared) | see below |
| v0.3 | FR3 + FR5 scheduler, gates, start-stop | 7 consecutive real days survive interruptions | **done** ✓ | see below |
| v0.4 | FR2 S4 + FR4 chains/junctions | connections born and reviewed; FIRe credit works | **done** ✓ | see below |
| v0.5 | FR7 auth + sync | anonymous history adopted; events land in D1 | **done** ✓ (GATE C cleared, staging verified) | see below |
| v0.6 | FR8 /admin | all §3 metrics visible live | **done** ✓ | see below |
| v0.7 | FR6 free practice + FR10 placement | returning-hifz tester onboards in <5 min | **done** ✓ | see below |
| v0.8 | FR9 habit layer | anchor adherence measurable; floor session live | **done** ✓ → GATE D | see below |

---

## v0.1 — Corpus compiler — DONE

**Exit criterion:** corpus.json validates; distractors spot-checked in a report.

**Evidence:**
- `packages/corpus-compiler/` — compiler, validator, report generator.
- `pnpm -F corpus-compiler test` → **19 tests pass** (3 files: align, validate, prdRank).
- `pnpm -F corpus-compiler validate` → **exit 0**, RESULT: PASS (all hard checks).
- `public/corpus.json` (2.9 MB) — six PRD §9 tables: 111 verses, 1777 words
  (lemma/root/class from QAC), 8880 distractors (ranked + prd_rank), 110
  connections, 258 look-alikes, 19 scene beats (labels = TODO).
- `docs/corpus-report.md` — 10 sampled words + distractor sets + validation summary.

**Data reality note (differs from brief):** the promised Tanzil/QAC/gloss files in
`data/raw/` did not exist; real inputs were pre-fused JSON in `kuizquran/data/`
(one level above repo root) with **no morphology**. Morphology was sourced by
vendoring QAC into `data/raw/quran-morphology.txt` (aligns 1:1 by ayah,position).
See `docs/decisions.md` D1–D6.

**Open items carried into GATE A (human review required):**
1. Review `docs/corpus-report.md` for Arabic tokenization / gloss / distractor
   linguistic quality (cannot be self-certified).
2. Author/approve the 19 scene-beat labels (currently `TODO:` placeholders in
   `public/corpus.json`).
3. Note: ~14.8% of authored distractors are valid inflections not attested
   verbatim in the mushaf (flagged soft, listed in the report) — confirm this is
   acceptable or mark forms to re-author.
4. Note: 5 items dropped a self-colliding distractor (now at 4); backfill a 5th
   when convenient (v4:1, v8:9, v50:21, v56:8, v63:16).

## → GATE A — CLEARED (conditionally) 2026-07-14

Human decision: **proceed with placeholder scene beats; corpus report to be
reviewed separately, offline.** So v0.2 proceeds now; scene-beat labels remain
`TODO:` in corpus.json until the human authors them (does not block v0.2, which
encodes ayah 12:4 and does not surface scene-beat labels in the S1–S3 ladder).

Carried-forward items still open for the separate review (not blocking v0.2):
- Linguistic sign-off on `docs/corpus-report.md`.
- ~14.8% non-verbatim distractors — accept or mark for re-authoring.
- 5 dropped-collision items to backfill (v4:1, v8:9, v50:21, v56:8, v63:16).
- Author the 19 scene-beat labels.

## v0.2 — Learn ladder S1–S3 — CODE DONE, awaiting GATE B

**Exit criterion:** user zero encodes ayah 12:4 end-to-end (S1→S2→S3).

**Evidence (command output):**
- `pnpm -r test` → **35 tests pass** (corpus-compiler 19, engine 10, web 6).
- `pnpm typecheck` → exit 0 (all three tsconfigs).
- `pnpm -F web build` → PWA builds (44 modules); corpus.json + shell precached
  by `apps/web/public/sw.js` for offline drills.
- `pnpm -F web dev` → boots (localhost), serves app + /corpus.json + /iman-ui.css.
- **Exit criterion, proven headlessly** (`apps/web/src/session/encode.test.ts`):
  driving the real advance→append path over 12:4 persists `rung_complete×3` +
  `ayah_complete` in order, with monotonic seq. The human confirms the same flow
  on screen at GATE B.
- **Invariant #2 durability** (`apps/web/src/db/eventLog.test.ts`): `append`
  resolves only after `tx.done`; simulated mid-drill crash → exactly N events, in
  order, no dupes.

**Architecture:**
- `packages/engine` — pure TS: `options(strength)`, `pickOptions`, the S1→S2→S3
  ladder state machine (`ladder.ts`), event constructors. Zero DOM. All
  scheduling/selection logic here (invariant #6).
- `apps/web` — Vite+React+PWA. `db/eventLog.ts` (idb, commit-before-feedback),
  `session/useLadder.ts` (wires taps→append→feedback), `drills/S1–S3`, consuming
  `styles/iman-ui.css` verbatim (invariant #5 — no restyle; CSS byte-identical).

**Decisions:** D9 (options() pure fn, v0.2 uses strength=0), D10 (fake-indexeddb
durability test). See docs/decisions.md.

## → GATE B (blocked-on-human) — IN REVIEW, one design item open

**Verified working (automated Chrome pass + human run):** full S1→S2→S3 encode of
12:4 completes; 50 events persisted (rung_complete×3 + ayah_complete last, seq
monotonic); Arabic renders in Amiri, RTL, diacritics intact; coral only on slips;
no console errors. The completion screen (whole ayah as hero) looks right.

**RESOLVED — S1 hero (human GATE B feedback, screenshot 2026-07-14 10:25 → fix):**
The single-word S1 hero at the design system's fixed `.ayah--display` 28px read
as a tiny mark; the option buttons dominated, violating invariant #5's intent.
Human chose option (b): **render the word in its full-ayah context.** Implemented
`ContextAyah` — the whole ayah as the hero via `.ayah .ayah--dim`, with the target
word restored to `--text-primary` (lit) and siblings dimmed. Uses ONLY existing
iman-ui.css classes + tokens; `iman-ui.css` confirmed unmodified (no restyle).
Verified in Chrome: hero now dominates the card; lit word tracks the target as you
advance (إِذْ → قَالَ …); ayah still largest type (22px vs 14px options). See D14.

**GATE B CLEARED (2026-07-14):** human approved the in-context S1 hero and chose to
proceed to v0.3. One data issue surfaced during review and DEFERRED as a GATE A
follow-up (not v0.2 scope): DATA-1 multi-word vocab units (~52 runs) glossed as
split/duplicated single words — see docs/decisions.md DATA-1 and the corpus report's
"Multi-word vocab units" section. To be grouped after the human marks true units.

Full suite green (35 tests); build OK; iman-ui.css unmodified. v0.2 tagged.

## v0.3 — Scheduler + lifecycle + start-stop — DONE ✓

**Exit criterion:** 7 consecutive real days survive interruptions.

**Evidence (command output):**
- `pnpm -r test` → **72 tests pass** (engine 44, compiler 19, web 9).
- `pnpm typecheck` → exit 0. `pnpm -F web build` → OK. `pnpm -F web dev` → boots (200).
- **Exit criterion proven** by `packages/engine/test/sevenDays.test.ts`: a
  deterministic 7-learning-day simulation with injected interruptions (mid-drill
  kill, >1hr gap, a fully missed day) asserts — gates fire on the next day, the
  missed day yields a make-up merge on return, every session finishes same-day,
  no event loss (fold==replay), strengths stay within band rules.

**Architecture (all pure engine, invariant #6):**
- `update.ts` — the core `update(atom,outcome,ctx)`: errors full weight, massed
  same-day successes damped, pretest excluded (#3), structured-only (#5), post-
  lapse stability damped not zeroed. Property-tested.
- `atom.ts`/`strength.ts` — per-AYAH atoms (PRD §9: 221 atoms = 111 ayat + 110
  connections; word taps roll up), band 0–100, FSRS-shaped decay `exp(−Δt/S)`.
- `daybound.ts` — secular local rollover (D16), no Fajr calc.
- `gate.ts` — day-1 cold whole-bank gate + mastery-gate unlock.
- `scheduler.ts` — `assembleQueue` in exact FR3 order (make-up → gates → ranked
  reviews (connections weighted up) → time budget → interleave Learn); session
  always finishable.
- `resume.ts` — `resumePolicy(gap)`: resume/restart/replan/makeup (FR5).
- `rebuild.ts` — atoms rebuilt from the event log (invariant #2; fold==replay).
- app: `useSession` (queue-driven), `db/atoms.ts` (rebuildable cache),
  `gapClock` (visibility→resume). App now drives 12:4 through the scheduler.

**Decisions:** D15 (band-strength model), D16 (secular day boundary). See decisions.md.
No GATE this version. iman-ui.css untouched.

## v0.4 — S4 bridge + chains/junctions + FIRe — DONE ✓

**Exit criterion:** connections born and reviewed; FIRe credit works.

**Evidence (command output + browser):**
- `pnpm -r test` → **84 tests pass** (engine 54, compiler 19, web 11).
- `pnpm typecheck` → 0. `pnpm -F web build` → OK. iman-ui.css untouched.
- **Headless proof:** `apps/web/src/db/bridge.test.ts` — encode 12:4 → bridge →
  chain [4,5] event stream rebuilds a born, reviewed `connection:4` atom with
  FIRe credit on ayah 4, conn 4→5, ayah 5. `packages/engine/test/chain.test.ts`
  proves FIRe = breadth (every traversed atom credited; an error never raises).
- **Browser-verified** (screenshots): drove 12:4 S1→S2→S3 → S4 bridge (12:5
  opening, lit target) → chain (produce 4 → junction 4→5 → produce 5) → "encoded
  + bridged" banner. Durable log showed connection_born(4→5) + 3 chain_steps.

**Architecture:**
- engine `bridge.ts` (bridgeItems, birthConnection), `chain.ts` (chainSteps,
  junctionItem, applyChain FIRe), rebuild folds connection_born/junction_result/
  chain_step (fold==replay preserved). Rung += "S4"; new DrillItems/events.
- app `drills/S4Bridge.tsx` (reuses S1 in-context hero on the next ayah),
  `drills/ChainDrill.tsx` (tap-through: ayah steps as .bank/.tile, junction as
  .option--arabic). App flow: encode → bridge → chain → done.

**Decisions:** D17 (FIRe = breadth not extra weight), D18 (scope: single bridge
12:4→12:5 + chain [4,5]). See decisions.md. No GATE this version.

## v0.5 — Auth + sync — SCAFFOLD DONE, blocked at GATE C

**Exit criterion:** anonymous history adopted; events land in D1.

**Built + proven LOCALLY (no secrets):**
- `apps/worker` — Hono on Cloudflare Workers: `/auth/google` (JWKS verify iss/aud/
  exp, or dev mock), signed HttpOnly SameSite=Lax session cookie, `/events` batch
  (origin-checked, session-derived user_id) routed through a **per-user Durable
  Object** (`UserDO`, D22) that idempotently `INSERT OR IGNORE`s into D1. D1 schema
  in migrations/0001_init.sql (append-only, no free text).
- client: `db/eventLog` stamps a stable uuid `id` + `synced` flag;
  `sync/outbox.ts` flushes unsynced batches (credentials:include, retry-on-online);
  `sync/auth.ts` signs in + adopts (full-log flush); minimal `SignIn` control.

**Evidence:**
- `pnpm -r test` → **100 tests pass** (engine 54, compiler 19, worker 9, web 18).
- `pnpm typecheck` → 0 (all 4 packages). `pnpm -F web build` → OK.
- **Local end-to-end** (`wrangler dev` + local D1 + mock verify, verified via curl):
  sign-in → cookie; POST 3 events → `{accepted:3}`; `/events/count` → 3; re-POST
  → `{accepted:1,ignored:1}` (idempotent); bad origin → 403; no session → 401;
  D1 rows joined to the real user (user_id from session, spoof ignored).

## GATE C — CLEARED ✓ (2026-07-14)

Human provided Google OAuth client id + admin email, set the 3 staging secrets,
and did the real Google sign-in. Deployed + verified:
- Worker `iman-worker-staging` (real JWKS verify, GOOGLE_MOCK=0), D1 `iman-db`
  remote-migrated, per-user `UserDO` bound.
- Web on Cloudflare Pages `iman-quiz.pages.dev`; API served **same-site** at
  `/api/*` via a Pages `_worker.js` service-binding proxy → the standalone worker,
  so the `SameSite=Lax` session cookie works (PRD FR7) with no cross-site
  relaxation (D23).
- **Real Google sign-in verified:** user `mfirdaus12@gmail.com` created in remote
  D1 and a local event adopted/landed there. Exit criterion met.

Deploy-time fixes (D24, D25): the client API base resolves to `/api` when
VITE_WORKER_URL is empty (was dropping the prefix → 405); the offline service
worker was DISABLED and made self-unregistering (its aggressive precache trapped
testers on stale bundles during iteration) — proper PWA offline returns in v0.8.

## v0.6 — /admin monitor — DONE ✓

**Exit criterion:** all §3 metrics visible live.

**Evidence:**
- `pnpm -r test` → **119 tests pass** (engine 54, compiler 19, worker 28, web 18);
  metrics.test (9) computes each §3 metric from seeded D1; admin.test (5) proves
  401 no-session / 403 non-admin / 200 admin / read-only. typecheck 0.
- **Verified (local mock admin):** sign in as mfirdaus12@gmail.com → GET /admin →
  200 HTML with **all 7 §3 metric rows**; non-admin (joe@…) → 403.
- **Staging:** /admin deployed at `iman-quiz.pages.dev/api/admin`, ADMIN_EMAILS
  (=mfirdaus12@gmail.com) gated; migration 0002 applied remote.

**Instrumentation added (so the metrics compute for real, not placeholders):**
tap latency (time-per-word), interruption events via resumePolicy
(interruption→completion), users.anchor_hour (anchor adherence), wrong-tap choice
aggregation (look-alike slip rate). D30 retention is honestly time-gated ("accrues
from <date>") — cannot be faked. Decisions D26–D29.

**Admin page (FR8):** server-rendered HTML on the worker, consumes iman-ui.css
verbatim, §3 table + per-user drill-down (ayat encoded, gates, time-per-word,
active days, top confused choices). Read-only; no metric outside §3.

## v0.7 — Placement (FR10) + free-practice doors (FR6) — DONE ✓

**Exit criterion:** a returning-hifz tester onboards in <5 min.

**Evidence:**
- `pnpm -r test` → **145 tests pass** (engine 76, compiler 19, worker 28, web 22).
  placement.test: binary search converges ≤5 probes for every boundary 0..19,
  idk=unknown, carried map + start ayah correct. capacity.test, freeplay.test.
  typecheck 0; build OK; iman-ui.css untouched.
- **Browser-verified (exit criterion):** fresh user → "Have you memorized part of
  Surah Yusuf?" → 4 probes (acts 10,15,12,11 — a real binary search) → result
  "carry 10/19 scenes (34 ayat), start 12:35, ~1 ayah/day, ~77 days" → "Start
  learning" lands the session on **12:35** (the computed start ayah, NOT 12:4).
  Under 5 min. Deployed to staging (iman-quiz.pages.dev).

**Architecture:**
- engine `placement.ts` (binary-search over 19 act landmarks; nextProbe/answerProbe/
  placementResult), `capacity.ts` (Appendix A daily-plan math), `freeplay.ts`
  (3-door helpers: extraLearnGrant gate-intact, weakSpots, openPracticePick,
  coldSuccessAdoption, diminishingReturns). All pure + tested.
- client `onboarding/` (Placement + useOnboarding first-run gate feeding
  learnCandidates), `practice/` (Doors + OpenPractice, evidence-only structured:false).
  useSession now takes a start ayah → teaches arbitrary ayat.

**Decisions:** D31 (placement-first), D32 (arbitrary-ayah practice, no story-map yet),
D33 (binary search over acts). Bugfix: Probe remounts per probe (keyed) so the
answered-state doesn't freeze the flow.

## v0.8 — Habit layer (FR9) — DONE ✓

**Exit criterion:** anchor adherence measurable; floor session live.

**Evidence:**
- `pnpm -r test` → **163 tests pass** (engine 87, compiler 19, worker 32, web 25).
  habit.test (streak/floor/decay/heatmap), settings.test (anchor). typecheck 0;
  build OK; iman-ui.css untouched.
- **Browser-verified:** fresh user → placement → **anchor onboarding** ("When do
  you want your daily moment with the Qur'an?" — secular, no prayer names) → picked
  → persisted (anchorHour=8) → landed in session. **Open-into-drill logged at 1ms**
  (<3s target). No console errors.
- **Staging:** /api/settings gated (401); SW re-enabled as v0.8 network-first (no
  stale trap); anchor onboarding live; /api/auth healthy (no regression).

**Architecture (engine pure + tested):** streak.ts (pauses on miss, make-up repairs,
never zeroes), floor.ts (≤2-min never-empty queue), decay.ts (decay-visible numbers
reusing retrievability), heatmap.ts (111 rows + word diagnostics). Worker
settings.ts (anchor hour, session-gated). Client: Anchor onboarding, Streak pill
(quiet, no guilt), Heatmap, DecayLine, FloorSession, InstallPrompt; open-into-drill
timing (session_start latency); careful network-first SW re-enabled.

**Decisions:** D34 (anchor stays secular), D35 (careful network-first SW + PWA).

## → GATE D (blocked-on-human) — FINAL REVIEW

All 8 versions (v0.1–v0.8) are done, tagged, and deployed to staging. The full PRD
§10 release plan is complete. **docs/final-report.md** is written: what was built
per FR, every decision, known gaps vs the PRD, the tester-invitation checklist, and
the first week's §3 metric watch-list. Awaiting the human's final review before
inviting testers.

## v0.6 — after GATE C (FR8 /admin)

Exit: all §3 metrics visible live. ADMIN_EMAILS allow-list; read-only SQL views
over D1; the §3 table + per-user drill-down in iman-ui.css. Nothing else.
