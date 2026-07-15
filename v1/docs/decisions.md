# Decision log

Reversible choices made where the PRD is silent/ambiguous, per operating rule 3.
Format: context → choice → why. Irreversible/invariant-touching choices are taken
to the human instead.

## v0.3 — scheduler + lifecycle + start-stop

- **D15 — band-strength model (not full FSRS-4.5).** The graded/scheduled atom is
  the complete AYAH (invariant #1; PRD §9 "atoms ≤221/user" = 111 ayat + 110
  connections — NOT the 1777 per-word FSRS cards in srs-engine.json, which are from
  the superseded pipeline doc). update() operates on ayah atoms carrying
  strength(0–100 = Learn/Reinforce/Carry bands) + stability + lastRetrieval + reps
  + lapses; decay is FSRS-shaped `R=exp(−Δt/S)` so PRD §3's "±10% FSRS calibration"
  stays meetable. Chose this over porting full FSRS-4.5 (19 word-tuned weights,
  heavier, per-user fitting not until ~2 weeks per PRD §11). Human-confirmed.

- **D16 — secular day boundary, not Fajr calc (human direction 2026-07-14).** For
  v0.3 the "day begins at Fajr" invariant is a general local rollover
  (`dayStart(now,{rolloverHour≈4.5})`, user-adjustable) — no prayer-time calc, no
  location, no dependency. Neutral copy ("a new day", "your daily anchor"); no
  prayer names, no notifications. Real prayer-anchored UX deferred to v0.8 (FR9).
  Human: "no need Fajr-specific notification; general, secular but Islamically
  appreciable." See memory: kuizquran-day-boundary-secular.

## v0.1 — corpus compiler

- **D1 — Raw data location & format.** Brief assumed `data/raw/` held Tanzil +
  QAC + gloss files; none existed. Actual inputs are pre-fused JSON in
  `kuizquran/data/` (one level above repo root). → Read those directly; treat the
  brief's file list as aspirational. Why: inspecting real data beats assuming.

- **D2 — Missing morphology.** The fused inputs have no lemma/root/class. →
  Vendored QAC morphology (`mustafa0x/quran-morphology` mirror, Arabic
  ROOT:/LEM:) into `data/raw/quran-morphology.txt`, joined 1:1 by (ayah,position)
  after collapsing QAC segments to word level (verified zero mismatch: 1777
  words / 111 ayat). Why: highest-fidelity, offline, reproducible; user chose
  fetch-QAC over null placeholders.

- **D3 — Distractor ranking.** PRD wants a 5-level rank
  (suffix-variant > look-alike-verse > same-root > synonym > class-neighbor); the
  data carries a 4-way authored type (visual/semantic/contextual/phonetic)+why. →
  Preserve authored order as `rank` 1..5; add a heuristic `prd_rank` label; keep
  original `src_type`/`why`. Why: honors hand-authored quality the PRD §11 relies
  on; strict re-derivation needs morphology the source lacks.

- **D4 — Distractor attestation check.** PRD validation "all distractor text
  exists in the Quran" fails for ~14.8% of authored distractors — they are valid
  Arabic inflections not attested verbatim in the mushaf (e.g. أَبِيكَ,
  فَيَكِيدُونَ). → Made this a SOFT review flag (count + sample in report), not a
  hard failure. Why: user decision; matches PRD §11 mandate for a qari/teacher
  review before testers; these are strong traps, not errors.

- **D5 — Self-collisions.** 5 items had a distractor == target. → Compiler drops
  the colliding distractor (item ends at 4), lists them in the report for
  backfill. Why: PRD forbids distractor==target; auto-fix + surface beats
  hard-failing on 5 known cases.

- **D6 — Test runner & TS execution.** → vitest (matches the locked Vite stack);
  CLI runs on Node's built-in `--experimental-strip-types` (no extra runtime dep,
  no build step). Why: user chose vitest; zero additional dependencies.

## Repo setup

- **D7 — Canonical doc paths.** CLAUDE.md references `docs/yusuf-quiz-prd.md` and
  `styles/iman-ui.css`, but the files sat at repo root (`quiz-prd.md`,
  `iman-ui.css`). → Moved them to the referenced paths. Why: makes CLAUDE.md's
  own pointers correct; the compiler doesn't reference either file so nothing
  breaks. Reversible.

- **D8 — git init.** Repo was not under version control; the build plan requires
  commit + tag per version. → `git init`, author = Firdaus /
  mfirdaus12@gmail.com. Committing/tagging happens per operating rule 1.

## v0.2 — Learn ladder S1–S3

- **D9 — options(strength) built now, called with strength=0.** The scheduler
  (v0.3) doesn't exist yet, so S2's `options(strength)→(count,maxRank)` is built
  as a pure engine function now and v0.2 always passes strength=0 (Learn band →
  4 options, maxRank 4). Reinforce/Carry rows exist for v0.3 to feed real
  strength. Why: builds the real API boundary without pulling v0.3 scope forward.

- **D10 — durability proven with fake-indexeddb.** Invariant #2's "commit before
  feedback / no loss on interruption" is tested against fake-indexeddb (real IDB
  semantics, in-memory) in vitest: `append` resolves only after `tx.done`; a
  simulated crash leaves exactly N events in order. Why: real persistence
  semantics in CI without a browser; 1 devDep, lighter than Playwright.

- **D11 — assets synced into apps/web/public.** `iman-ui.css` (canonical:
  `styles/`) and `corpus.json` (canonical: repo `public/`) are copied into
  `apps/web/public/` by a `sync-assets` script (pre-dev/pre-build) and gitignored.
  Why: Vite serves from its own publicDir; a sync script keeps a single source of
  truth without committing duplicates. Reversible.

- **D12 — hand-written service worker, no PWA plugin.** Offline precache is a
  ~30-line `public/sw.js` (cache-first, shell + corpus). Why: keeps the
  dependency surface minimal per the locked stack; a plugin is unnecessary for a
  single-cache precache.

- **D13 — dev tooling: typescript + @types/node at root.** Added for `pnpm
  typecheck` (CLAUDE.md lists lint/typecheck as commands). Not runtime deps.

## v0.4 — S4 bridge + chains/junctions + FIRe

- **D17 — FIRe = breadth of credit, not extra weight.** A chain drill traverses
  ayat + connections; each traversed atom gets a normal `review` outcome through
  the EXISTING v0.3 update() (same damping/error rules). One clean chain reviews
  many atoms (the efficiency), but no atom is over-credited. No new weight knob.
  Human-confirmed.

- **D18 — v0.4 demonstrable scope: single bridge 12:4→12:5 + chain [4,5].** The
  engine is fully general (any adjacent pair / any run); the app wires exactly the
  4→5 path on real corpus data (both ayat populated; connection 4→5 exists). Human
  -confirmed.

## v0.5 — auth + sync

- **D19 — full local-runnable scaffold; GATE C only for real secrets.** The worker
  runs end-to-end locally via `wrangler dev` (local D1 + .dev.vars placeholders +
  a DEV-ONLY mock Google verifier gated by `GOOGLE_MOCK=1`). GATE C stops only for
  the real Google/Cloudflare creds needed to deploy staging. Human-confirmed.

- **D20 — client-generated stable event id (uuid) + idempotent D1 upsert.** Each
  event gets `id = crypto.randomUUID()` at append; `/events` does
  `INSERT OR IGNORE` by id so re-sends are no-ops. user_id from the session cookie,
  never the body. Human-confirmed.

- **D21 — anon adoption = flush the full local log on first sign-in.** Pre-sign-in
  events live only in IndexedDB; on first sign-in the client flushes its whole log
  to `/events`; the server stamps each with the authenticated user_id. No anon-user
  table / merge. Human-confirmed.

- **D22 — per-user Durable Object NOW (human direction).** PRD §9 names "DO per
  user". `UserDO` serializes each user's event writes (single-threaded per id → no
  races) and persists to D1 idempotently. D1 remains the durable, admin-queryable
  store; the DO is the per-user coordinator and the future home for per-user state
  (atoms/streak, v0.8). Human said "include DO now".

- **Tooling deps (locked stack):** `hono`, `wrangler`,
  `@cloudflare/vitest-pool-workers@^0.8.71` (matches wrangler 4.x + vitest 2.x),
  `@cloudflare/workers-types`. uuid via `crypto.randomUUID()` (no dep).

- **D23 — same-site API via a Pages `_worker.js` service-binding proxy (human
  choice).** Web app (iman-quiz.pages.dev) and API worker (…workers.dev) are
  different sites, so the PRD's SameSite=Lax cookie wouldn't survive cross-site
  sync. Resolved by serving the API same-site at `/api/*`: a Pages advanced-mode
  `_worker.js` forwards /api/* to the standalone worker via a Service Binding
  (`WORKER`). Keeps the standalone worker's Durable Object + D1 unchanged; the
  browser only ever talks to one origin → SameSite=Lax works, PRD unchanged.

- **D24 — client API base resolves to `/api` when unset.** `WORKER_URL` uses
  `?.trim() || "/api"` (not `?? "/api"`), because an EMPTY VITE_WORKER_URL (used to
  override the local-dev value in production) is defined-but-empty and would drop
  the prefix → POST /auth/google → static 405. Local dev sets it explicitly to
  `http://localhost:8787/api`.

- **D25 — offline service worker DISABLED for v0.5.** The v0.2 SW's aggressive
  cache-first precache repeatedly trapped the tester on stale bundles during rapid
  staging iteration (manifested as 405 / localhost / old-UI). Removed the SW and
  made the app actively unregister any installed SW + clear its caches on load.
  Proper offline-first PWA caching (network-first HTML, hashed-asset cache)
  returns, done carefully, in v0.8. Reversible.

## v0.6 — /admin monitor + metric instrumentation

- **D26 — tap latency captured client-side.** useLadder records item-shown→tap ms
  per item; the tap event carries `latency`. Interrupted/walk-away taps (>5 min)
  excluded from time-per-word (matches "interrupted latencies discarded").

- **D27 — anchor stored as users.anchor_hour (default 4.5 = secular rollover).**
  Enables anchor-adherence now; the user-set anchor UI is FR9/v0.8. Until then the
  default is the day-rollover hour.

- **D28 — interruption events from resumePolicy.** useSession emits an
  `interruption` event (tagged with the resumePolicy action) on any non-"resume"
  re-entry, so interruption→completion computes. Reuses the v0.3 classifier.

- **D29 — confusions computed by aggregation, no new table.** Wrong-tap `choice`
  is already in D1; the look-alike slip rate + top-confusion pairs are SQL
  aggregations over events (GROUP BY ayah,position,choice). A rollup table wasn't
  needed at prelude scale.

- **D30-note — D30 retention stays time-gated.** No amount of instrumentation can
  populate it this version (needs 30 real days + probes); the panel shows an honest
  "accrues from <date>" instead of a fabricated number. Real retention probes land
  when cards age (later).

- **/admin served on the worker (FR8), reached same-site at /api/admin.** Server-
  rendered HTML consuming iman-ui.css; ADMIN_EMAILS-gated (fails closed if the list
  is empty); read-only (GET only, no mutation routes).

## v0.7 — placement + free-practice doors

- **D31 — placement-first.** Full FR10 onboarding (the exit criterion); FR6's three
  doors reuse the existing S1–S3/chain drills in lean form (no new drill types).

- **D32 — arbitrary-ayah placement/practice; no story-map nav UI yet.** Placement
  + practice run on any ayah; placement's carried map + start ayah feed the v0.3
  scheduler via learnCandidates (useSession gained a startAyah param). The 19-act
  filmstrip / mushaf heatmap navigation is v0.8. Human-confirmed.

- **D33 — binary search over the 19 act landmarks.** Junction/opening-recognition
  probe at the mid act; correct → later half, wrong/"I don't know" → earlier half;
  ≤⌈log2(19)⌉=5 probes → the carried boundary. "I don't know" is first-class
  (= not carried). Human-confirmed. (Linear scan rejected — too slow, not binary.)

- **Bugfix (UI):** the placement Probe component is keyed by act so each probe
  REMOUNTS with fresh state — otherwise the local `answered` flag froze the buttons
  after the first probe. The engine binary search was always correct; the freeze
  was UI-only.

## v0.8 — habit layer (FR9)

- **D34 — anchor stays secular.** FR9's "anchor prayer" question is implemented as a
  daily TIME anchor ("When do you want your daily moment with the Qur'an?" → Early
  morning / After breakfast / … / Before sleep), NOT a prayer name — consistent with
  D16's secular day boundary. Prayer-anchored reminders remain a deliberate future
  choice. Human-confirmed.

- **D35 — careful network-first SW re-enabled + PWA install.** The service worker
  disabled in v0.5 (D25) returns in v0.8 with the correct strategy: network-first
  HTML (no stale-bundle trap — the v0.5 root cause), cache-first hashed /assets/*,
  stale-while-revalidate corpus/css, /api never cached, versioned (iman-v0.8.0).
  Plus a beforeinstallprompt install button. Offline drills work again. Human-confirmed.

- **Open-into-drill timing:** a `session_start` event carries app-open→first-drill
  latency (<3s target); verified at 1ms locally. Feeds a future /admin panel.

## v0.9 — personal dashboard + training selector (home base)

- **D36 — the dashboard is the HOME screen.** The app now lands on a personal
  progress dashboard (status + a training selector) instead of dropping straight
  into a drill. Every training screen launches from it and returns to it. This
  deliberately supersedes FR9's "open-into-drill <3s" fast-start (the dashboard
  itself renders instantly). Human-directed.

- **D37 — full first version of the dashboard.** Panels: Today (hero ayah + est
  minutes from Σ queue estMin), Your Yusuf (carry-band meter + ETA + quiet streak),
  Fading (top-3 weak ayah atoms via the existing DecayLine), and the "Where to
  next?" selector (Continue today / Weak-spot gym / Two minutes / Open practice /
  Review the map) with per-tile WHY subtext and enable/disable from real state.

- **Design via an ultracode workflow** (3 lenses → critique → synthesis):
  skeleton = action-first single Home screen; priority = calm status order; hero =
  a real Amiri ayah. PURE ASSEMBLY — zero engine/CSS edits. New: `home/Home.tsx`;
  edited: App.tsx `Session` router (view union home/session/gym/open/floor/heatmap,
  default home). Existing screens (Heatmap/FloorSession/Doors/OpenPractice/
  DecayLine/Streak) reused as-is. Invariant #1 honored (weakSpots filtered to
  kind==="ayah"); no-guilt copy; quiet streak; iman-ui.css untouched.

## D38 — session-end screen carve-out from calm-only invariant #5 (human-directed)

- **Context.** The user explicitly requested a Duolingo-style session close with a
  prominent streak flame/counter, a confetti burst, and a completion sound — the
  two things the v0.9 session-end design study deliberately left out. CLAUDE.md
  invariant #5 ("coral only for slips; no shadows/gradients/new fonts") and the
  earlier "de-emphasize the streak" framing pull against this. Note: the PRD (FR9)
  itself only requires "Streak counts completed sessions … No guilt copy" — the
  "streak-as-idol" anti-pattern was our framing, not the PRD's.
- **Decision (irreversible-flavored, so asked and confirmed).** The **session-end
  screen only** is exempt from the calm-only reading of invariant #5: it may show a
  large animated streak flame + count, a confetti burst (canvas), and a synthesized
  chime (Web Audio). Intensity: "Duolingo-loud" per the user. Sound is synthesized
  (no asset, CSP/offline-safe).
- **Still binding, even here.** (a) The Amiri ayah remains the largest type. (b) Only
  whole-ayah tallies (invariant #1). (c) Recall/duration arithmetic lives in the pure
  engine helper `summarizeSession` (invariant #6). (d) **No guilt copy** — a paused or
  at-risk streak reads neutral, never punished. (e) Coral is still never decorative;
  confetti uses teal + amber only. (f) All effects self-disable under
  `prefers-reduced-motion`. (g) The REST of the app stays calm — this is a
  single-screen carve-out, not app-wide gamification.
- **Reversible.** Removing the celebration restores the calm screen; the engine helper
  and stat row are independent of it.

## Known data issue (open, needs human/qari grouping)

- **DATA-1 — multi-word vocab units split into duplicated single-word glosses.**
  Human-caught at GATE B (2026-07-14): ayah 12:4 pos 8–9 `أَحَدَ`+`عَشَرَ` are BOTH
  glossed "eleven" — wrong per token (أَحَدَ="one", عَشَرَ="ten"; only together =
  "eleven"). Systemic: ~53 adjacent word-pairs across the surah share an identical
  gloss (number compounds + fixed expressions like `مَعَاذَ ٱللَّهِ`,
  `قُرْءَٰنًا عَرَبِيًّۭا`). These are single vocab/idiom units that must LIGHT and
  be GRADED together in S1, never probed as separate meaning items with the same
  answer. The compiler cannot infer the grouping (no knowledge that أَحَدَ alone ≠
  "eleven") — it requires the human's linguistic review (GATE A / qari pass).
  **Fix (deferred, not v0.2 scope):** add a multi-word-unit grouping to the corpus
  (a `unitId`/span on words or a `phrases` table) so S1 treats the real vocab unit
  as atomic. Tracked in docs/corpus-report.md for the review. Until then S1 still
  renders per-token; the highlight/gloss on split units is known-imperfect.

- **D14 — S1 hero renders the word in full-ayah context (GATE B fix).** The
  single-word S1 hero at the fixed `.ayah--display` 28px was visually tiny and the
  options dominated (invariant #5 intent). Human chose to show the whole ayah as
  the hero with the target word lit and siblings dimmed (`ContextAyah`, using
  `.ayah .ayah--dim` + `--text-primary` on the target). Engine S1 DrillItem gained
  `ayahWords`. Why: satisfies "the ayah is the largest type; nothing competes" AND
  teaches position (PRD pairing strategy), using only existing design-system
  classes/tokens — iman-ui.css untouched.
