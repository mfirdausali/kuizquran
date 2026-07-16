# iman.app v2 — Decision Log

A durable, timestamped record of every product/design decision made while planning
v2. Append-only in spirit: never rewrite a past entry; if a decision is reversed,
add a new entry that supersedes it and link back.

**Timestamps** are the exact moment each decision was *settled* by the user, taken
from the real conversation transcript (ISO‑8601 UTC, with JST — the user's local
zone — in parentheses). Where a decision was made by the assistant under standing
authorization (e.g. "go with your recommendations"), that is noted.

_Generated: 2026‑07‑16 06:54 JST (2026‑07‑15 21:54 UTC)._

---

## Legend

- **Status** — `accepted` (locked) · `superseded` (replaced by a later entry) · `open` (awaiting input)
- **Kind** — `product` (what the app is) · `mechanic` (how training works) · `stack` (tech) · `ux` (surface/copy) · `process` (how we work)
- IDs prefixed **v2‑Dnn**. (Distinct from v1's D1–D38 in `../v1/docs/decisions.md`.)
- This file lives at `kuizquran/v2/DECISIONS.md` — a **sibling** of `v1/`, not nested inside it. Code paths below are relative to the `kuizquran/` root (e.g. `v1/apps/…`).

---

## Foundational pivot

### v2‑D01 — Rebuild as v2 on a new stack, keeping the retention science
- **When:** 2026‑07‑15 14:20:24 UTC (2026‑07‑15 23:20 JST)
- **Kind:** stack · product · **Status:** accepted
- **Decision:** Build **v2** locally with a **React** frontend and a **Laravel** backend (auth + tracking), **local‑first** until solid. Keep v1's tested retention engine (strength/decay/scheduling, corpus) and rebuild the surface + backend.
- **Why:** The user's dissatisfaction was with **what the app is and how the drills work** (see v2‑D02), *not* the infrastructure. A health check confirmed Cloudflare was fine (Pages 123 ms, Worker 97 ms), so the stack change is a product/ownership choice, not a fix.
- **Supersedes:** the v1 Cloudflare Pages + Workers + D1 + DO stack (for v2 only; v1 stays as shipped).

### v2‑D02 — The mismatch is the product + the drills, not the stack
- **When:** 2026‑07‑15 14:05:54 UTC (23:05 JST) — clarified via AskUserQuestion
- **Kind:** product · **Status:** accepted
- **Decision:** The parts to rethink are **"what the app IS"** and **"how the drills work."** Backend/hosting and the memory model are sound and carry over.
- **Why:** User selected exactly these two when asked where the mismatch lived; explicitly not the infra.

### v2‑D03 — Authentication via Laravel
- **When:** 2026‑07‑15 14:20:24 UTC (23:20 JST)
- **Kind:** stack · **Status:** accepted
- **Decision:** Auth is handled by **Laravel** (Sanctum), anonymous‑first with account adoption; email or social sign‑in.

### v2‑D04 — Track every user action to build a personal retention model + behavioral understanding
- **When:** 2026‑07‑15 14:20:24 UTC (23:20 JST)
- **Kind:** product · **Status:** accepted
- **Decision:** Every user action is a timestamped, append‑only event; the stream feeds (a) a **personal retention‑algorithm management screen** and (b) behavioral understanding of users.
- **Related:** v2‑D19 (recording pipeline), v2‑D20 (learner Progress Report), the admin console.

---

## The learning mechanic

### v2‑D05 — Core drill = tap‑to‑reconstruct (Monoxer‑style), typing optional
- **When:** 2026‑07‑15 14:20:24 UTC (23:20 JST) — settled 2026‑07‑15 21:42 UTC when the direction was accepted
- **Kind:** mechanic · **Status:** accepted
- **Decision:** Replace v1's word‑by‑word multiple‑choice (which the user flagged) with **tap‑to‑reconstruct**: the ayah shows with words progressively hidden; the learner rebuilds it by **tapping** missing words from a bank seeded with near‑miss distractors. Difficulty auto‑scales (more blanks as strength climbs) until the whole ayah is produced from blank. **No Arabic typing required**; an optional "hard mode" accepts typed Arabic (diacritics forgiven).
- **Why:** True recall (not recognition), without the Arabic‑keyboard tax; answers the user's "will the user need to type exact vocab?" — no.

### v2‑D06 — UI is an amalgam: Duolingo warmth · Monoxer discipline · our calm
- **When:** 2026‑07‑15 14:20:24 UTC (23:20 JST)
- **Kind:** ux · **Status:** accepted
- **Decision:** Derive the best of three: **Duolingo** (warmth/reward, no guilt/hype), **Monoxer** (recall discipline, auto‑scaling difficulty), and **our** calm Amiri‑first system (the verse is always the largest type; coral only for slips; no shadows/gradients/new fonts).

---

## The six scenario‑planning decisions

_Context: deep persona analysis (Steady / Sprinter / Chainer) surfaced 41 edge cases,
3 live code bugs, and 6 decisions only the user could make. Tabulated with a
recommendation each; the user chose "Go with your recommendations."_

- **Decisions surfaced:** 2026‑07‑15 21:35:38 UTC (2026‑07‑16 06:35 JST) — "tabulate decisions and your recommendation"
- **All six accepted:** 2026‑07‑15 21:42:30 UTC (06:42 JST) — user: **"Go with your recommendations."**

### v2‑D07 — Unlock tolerance: band + in‑session re‑check
- **Kind:** mechanic (touches retention contract) · **Status:** accepted (assistant recommendation, user‑authorized)
- **Decision:** Recompute `unlockPermitted` **after** an in‑session gate pass (so a gate‑day still delivers today's ayah), **and** add a small tolerance band — unlock while **≤1 gate pending** — scoped by mode (looser for Sprint, strict for Steady).
- **Why:** Kills the "nothing new on day 2" hole and the one‑gate freeze without loosening durability where it matters. Smallest change that unblocks the shared chokepoint.

### v2‑D08 — Gate forgiveness: re‑scaffold, then demote (never silently drop)
- **Kind:** mechanic (touches retention contract) · **Status:** accepted
- **Decision:** After N cold‑gate fails, drop to a lighter S2 re‑teach; after more, offer **"send this verse back to Learn"** (re‑learned, not abandoned). No auto‑fade / silent rot.
- **Why:** Struggling on a verse should feel like help arriving; "carried" stays meaningful because a demoted verse still earns a fresh gate later.

### v2‑D09 — Pace as a real mode: Steady / Sprint / Maintain
- **Kind:** mechanic · **Status:** accepted
- **Decision:** Three wired, persisted, mid‑surah‑editable modes: **Steady** (1/day ceiling + reserved slot, review cap) · **Sprint** (raised budget + learn window + gate‑wall disclosure) · **Maintain** (0 new, reviews + chains only). Kill the hardcoded `budgetMin:8` (see bug v2‑BUG‑1).
- **Why:** Named modes carry guardrails a bare slider can't; three is the fewest that honestly covers all three personas.

### v2‑D10 — Parallel threads: latent now, promote later
- **Kind:** mechanic · **Status:** accepted
- **Decision:** Ship v2 with Sprint mode as the throughput lever; keep parallel non‑adjacent threads possible under the hood but **don't surface** them until real sprinters hit Sprint's ceiling.
- **Why:** Sprint answers "I want more" for ~95%; parallel threads are a heavy concept (two gate queues). Ship the 80%, defer the 20%.

### v2‑D11 — Chains: two modes — victory‑lap (default) + weak‑seam repair
- **Kind:** mechanic · **Status:** accepted
- **Decision:** Default free chain = **victory lap** (`structured:false` — records the run for streak/heatmap, **no** strength change, **no** lapse). A separate **weak‑seam repair** chain is graded, built around the riskiest junctions. Junctions get a real retry before committing.
- **Why:** The Chainer's signature act (reciting a run beautifully) should feel triumphant, never risky; a slip must not lapse a strong verse. Preserves chaining as a real repair tool when deliberately chosen.

### v2‑D12 — Shared device: out of scope for v2, but guard against corruption
- **Kind:** stack/product · **Status:** accepted
- **Decision:** Don't build multi‑profile. Because Laravel auth is per‑account, each learner signs into their own account; add a "not you? switch account" affordance on Home to prevent accidental cross‑contamination.
- **Why:** Near‑free safety without profile infrastructure v2 doesn't need yet. Full multi‑profile deferred (classroom product).

---

## The Test feature

### v2‑D13 — Add a self‑initiated "Test" over a proficient range
- **When:** 2026‑07‑15 21:42:30 UTC (06:42 JST) — proposed by user alongside "go with your recommendations"
- **Kind:** product · **Status:** accepted
- **Decision:** A new on‑demand surface: the learner picks a proficient range (e.g. ayat 1–10) and the app pulls **random mixed questions** across it — vocab, cloze, locate‑the‑ayah, junction, **chaining reorder** (drag shuffled ayat back into order), and produce‑from‑cold.

### v2‑D14 — Test is a read‑only mirror
- **When:** 2026‑07‑15 21:42→21:48 UTC (settled via AskUserQuestion)
- **Kind:** mechanic · **Status:** accepted
- **Decision:** A Test shows a score and flags weak spots but **does NOT move strength or due‑dates** (`structured:false`). An optional "send these to my reviews" nudge requires a tap.
- **Why:** Consistent with v2‑D11 (victory‑lap) and v2‑D08 (no punishment); a bad test day can't lapse verses the learner knows.

### v2‑D15 — Test range: smart default (carried) + override to any span
- **When:** 2026‑07‑15 21:48 UTC (settled via AskUserQuestion)
- **Kind:** ux · **Status:** accepted
- **Decision:** Range defaults to the learner's **carried** ayat (≥80 strength), overridable to any span (1–10, 1–20, whole surah, custom).

### v2‑D16 — Test uses its own accent (purple)
- **When:** 2026‑07‑15 21:48 UTC — assistant design call, flagged for user review
- **Kind:** ux · **Status:** accepted (pending user objection)
- **Decision:** Test uses **purple** (v1 reserves purple for meaning/connection work), distinct from the teal learning loop.

---

## Recording & progress surfaces

### v2‑D17 — Learner Progress Report is separate from the operator Admin console
- **When:** 2026‑07‑15 21:48:12 UTC (06:48 JST) — "How are they recorded? Progress report page?"
- **Kind:** ux/product · **Status:** accepted
- **Decision:** Two audiences, two pages from the **same** event stream: a warm, learner‑facing **Progress Report** ("your Yūsuf" — growth curve, 111‑ayah map, streak calendar, Test history, self‑insight, export) and a dense operator **Admin/behaviour console** (retention KPIs, forgetting curve, per‑user drill‑down). Never merge them.

### v2‑D18 — Recording is the same append‑only stream, no separate analytics system
- **When:** 2026‑07‑15 21:48:12 UTC (06:48 JST)
- **Kind:** stack · **Status:** accepted
- **Decision:** Every action → a timestamped event, committed locally **before** feedback, then synced to Laravel (idempotent, append‑only). Strength, streak, curves, reports, and admin metrics are all **computed** from the stream. Read‑only actions (Test, victory‑lap chains) carry `structured:false`. New v2 event types: `reconstruct_tap`, `ayah_produced`, `review_outcome`, `test_start/answer/result`, `mode_change` (alongside v1's existing types).

### v2‑D19 — Plain‑language tooltip for jargon (starting with "half‑life")
- **When:** 2026‑07‑15 21:52:30 UTC (06:52 JST) — "add tooltip for half‑life"
- **Kind:** ux · **Status:** accepted
- **Decision:** Jargon terms on learner‑facing pages get a plain‑language ⓘ tooltip. First applied to **half‑life** on the Progress Report: *"How long a verse stays in your memory before you'd forget half of it without review. Longer is better…"* When v2 is built, make this a reusable `<InfoTip>` component; extend to other terms (retrievability, cold gate). Admin console (operator audience) may keep the raw term — **open** whether to add there too.

---

## Question bank (admin-editable)

### v2‑D21 — Question bank = generate + override layer
- **When:** 2026‑07‑15 22:06:37 UTC (2026‑07‑16 07:06 JST)
- **Kind:** product · mechanic · **Status:** accepted
- **Context:** Today there is **no question bank** — questions are generated at runtime from the compiled corpus (`distractorsFor()`), and the admin is read‑only (no mutation routes). Fixing a bad question requires editing corpus data + a rebuild.
- **Decision:** v2 keeps **auto‑generation** from the corpus (all 111 ayat covered from day one, no manual authoring backlog) but adds a persisted **override layer**: the admin surfaces every generated question and lets an editor **override** any of them — fix a gloss, swap/curate a distractor, group a multi‑word gloss unit, disable a bad question, or add a hand‑written custom question. **Overrides win**; anything not overridden stays automatic. Overrides live in the Laravel DB, keyed by ayah + position + question‑type, and apply at question‑build time.
- **Why:** Full coverage without authoring thousands of questions, yet everything is editable where it matters. Gives **DATA‑1** (multi‑word gloss grouping, `../v1` open follow‑up) a first‑class home instead of a corpus rebuild.
- **Related:** v2‑D22 (editor UX), DATA‑1.

### v2‑D22 — The bank editor is qari/scholar‑friendly (non‑technical)
- **When:** 2026‑07‑15 22:06:37 UTC (07:06 JST)
- **Kind:** ux · **Status:** accepted
- **Decision:** The override editor is a **non‑technical admin UI** — show the ayah, its words, their glosses, and the generated distractors in plain forms; a qari/scholar edits meaning/Arabic correctness and groups multi‑word units without touching code or JSON.
- **Why:** Fits the GATE‑A qari‑review need (Arabic correctness cannot be self‑certified); makes the person best placed to fix a gloss able to actually do it.

### v2‑D23 — Questions are asked *from the ayah* (grounded in the verse)
- **When:** 2026‑07‑15 22:16:50 UTC (2026‑07‑16 07:16 JST)
- **Kind:** mechanic · **Status:** accepted
- **Decision:** Every generated question is anchored to the **ayah as the frame** — the verse (or its immediate context) is shown, and the question probes a word/gap/junction *within it*, rather than a decontextualized flashcard. Vocab shows the word lit inside its ayah; cloze/junction/locate/chain all present the actual verse text. Reinforces invariant #1 (the ayah is the unit) and gives every question its scene.
- **Related:** v2‑D21 (question bank), invariant #1.

### v2‑D24 — Heatmap modeled by the surah's symmetry phases (12‑point ring), not a flat 1→111 grid
- **When:** 2026‑07‑15 22:16:50 UTC (07:16 JST)
- **Kind:** ux · product · **Status:** accepted
- **Context:** Sūrat Yūsuf has a **chiastic ring structure** (already documented in `../JOURNEY-MAP.md` and the 19‑act `../kuizquran-vision.html`). The user's reference image is the tighter **12‑point ring**.
- **Decision:** The progress heatmap groups the 111 ayat into the **12 narrative movements**, arranged to show the **mirror pairs** (1↔12 dream→fulfilled, 2↔11 plot→lesson, 3↔10 seduce→confess, 4↔9 ladies→confess, 5↔8 jail→released) around the **pivot (6↔7, the king's dream)**. Real ayah ranges (cover all 111): **1**=12:1‑6, **2**=12:7‑20, **3**=12:21‑29, **4**=12:30‑34, **5**=12:35‑42, **6**=12:43‑45, **7**=12:46‑49, **8**=12:54‑57, **9**=12:50‑51, **10**=12:52‑53, **11**=12:58‑98, **12**=12:99‑111. (Movements 9/10 sit at 50‑53, narratively before release #8 at 54‑57 — the women confess during the recall block; narrative order ≠ strict ayah order at the pivot, which is a property of the ring.)
- **Why:** Tells the learner *where in the story* they are and reveals the mirror structure as a mnemonic — "recalling one side cues its mirror" (JOURNEY‑MAP). Grounds progress in the surah's meaning, not an arbitrary grid. The 12 movements fold the 19 acts (`kuizquran-vision.html`), which remain the finer granularity.
- **Related:** v2‑D17 (progress report), the 19‑act decomposition in `../kuizquran-vision.html`.

### v2‑D25 — Ring and flat grid COEXIST as two linked views (not either/or)
- **When:** 2026‑07‑15 22:22:20 UTC (2026‑07‑16 07:22 JST)
- **Kind:** ux · **Status:** accepted — **supersedes** the "ring beats grid" framing in the earlier symmetry‑heatmap artifact (v2‑D24), which was a false choice.
- **Decision:** The progress map has **two linked views of the same data**: the **ring** (12 movements — "where am I in the story?", the overview/mnemonic) and the **flat 1→111 grid** (mushaf‑faithful, verse‑precise — "which exact ayat do I hold?", the detail). They are **zoom levels of one map**: tap a movement arc on the ring → drill into that movement's ayah cells in the grid; the grid is grouped/tinted **by movement** so both truths (story position + per‑ayah precision) live together. Default view = ring (overview‑first); grid is one tap deeper, and a plain full‑surah grid is always available for verse‑level scanning.
- **Why:** They answer different questions — the ring can't address "ayah 47" (only 12 arcs), the grid can't convey the arc. Overview → detail is standard information design; grouping the grid by movement keeps the symmetry visible even at verse granularity.
- **Related:** v2‑D24 (the ring), v2‑D17 (progress report).

### v2‑D26 — System-explorer (living architecture visualization) spec lives in `v2/VISUALIZE.md`
- **When:** 2026‑07‑15 22:30:33 UTC (2026‑07‑16 07:30 JST)
- **Kind:** process · **Status:** accepted
- **Decision:** A refined prompt/spec for an interactive **system-explorer** dashboard (graph of our infrastructure — data relations, actors, E2E in/out) is stored at `v2/VISUALIZE.md`. It is **corrected to our real stack: React (Vite) + Laravel**, NOT Next.js (the original draft assumed Next.js). Data dimensions are mapped to our real entities: the **append-only event stream** (reconstruct_tap → … → Laravel events table), the **actors** (learner, qari/scholar editor, sync, corpus/question-bank generator), and the **E2E boundaries** (local‑first commit → Sanctum‑authed sync → computed strength/report). Because v2 is **not yet scaffolded** (`v2‑O2` open), the spec sources from the design corpus + v1 engine + this DECISIONS.md, with a fallback to a data‑file‑driven graph.
- **Why:** The original prompt hardcoded Next.js and assumed existing schemas/routes/services to harvest — neither matches our reality. Refined to be accurate and runnable when v2 is scaffolded.

---

## v2 framework & reach (i18n · mobile · multi‑surah)

### v2‑D27 — Bilingual glosses (EN/MS); learner picks language at onboarding
- **When:** 2026‑07‑16 00:35:30 UTC (2026‑07‑16 09:35 JST)
- **Kind:** product · ux · **Status:** accepted
- **Context:** The corpus already carries a three‑slot gloss (`{en, ms, ja}`), but MS and JA are null (unsourced in v1). All meaning‑probe questions (S1, S4 bridge) currently hardcode `gloss.en`.
- **Decision:** Make **Bahasa Melayu** a first‑class gloss language alongside English. The learner **chooses EN or MS during onboarding**; the choice persists and drives every gloss‑based question and any meaning text. Neither is hardcoded default. Gloss generation is parameterized by the selected language (`gloss[lang] ?? gloss.en ?? text_uthmani`). MS glosses are **sourced machine‑first, then qari/scholar‑verified through the Phase‑6 override editor** (v2‑D21/D22) — the same layer that already owns gloss corrections. JA stays deferred (column remains).
- **Why:** kuizquran's audience is Malaysian; MS is a primary comprehension language, not a nice‑to‑have. Onboarding‑time choice avoids forcing a default and keeps the meaning layer honest for both audiences. Reuses the override editor instead of a corpus rebuild.
- **Related:** v2‑D21/D22 (override editor is MS's sourcing/verification home), v2‑D05/D23 (meaning questions), DATA‑1.

### v2‑D28 — Mobile‑first across the whole app (non‑negotiable)
- **When:** 2026‑07‑16 00:35:30 UTC (2026‑07‑16 09:35 JST)
- **Kind:** ux · **Status:** accepted
- **Decision:** Every v2 surface is **designed mobile‑first and verified on a phone viewport** — the drill, Home/session, onboarding, Progress Report (ring + grid), Test, and the admin console all reflow to small screens. Touch is the primary input (tap‑to‑reconstruct is a thumb interaction): tap targets ≥44px, single‑column reflow, no hover‑only affordances, the Amiri ayah stays the largest type at every breakpoint (invariant #5), and horizontal page overflow is never allowed (wide content — ring, heatmap grid — scrolls inside its own container). Desktop is the enhancement, not the baseline.
- **Why:** The learner uses this in 2‑minute floor sessions on a phone; a desktop‑first build would fail the real usage context. Made a standing requirement so every phase's exit criteria includes a phone check, not an end‑of‑project retrofit.
- **Related:** invariant #5 (Amiri largest), v2‑D06 (calm system), every phase.

### v2‑D29 — Surah‑agnostic framework: ship Yusuf, architecture‑ready for any surah
- **When:** 2026‑07‑16 00:35:30 UTC (2026‑07‑16 09:35 JST)
- **Kind:** stack · product · **Status:** accepted
- **Context:** Today everything is Surah Yusuf (surah 12) only: one `corpus.json` and a Yusuf‑specific 12‑point chiasmus ring (v2‑D24/D25). The engine already threads `surah` through most signatures and events, so the dimension is half‑present.
- **Decision:** Build v2 so **surah is a first‑class parameter end‑to‑end** — no hardcoded `12`. Specifically: (a) a **corpus loader keyed by surah** (per‑surah `corpus.json` from the existing compiler), (b) **per‑surah structure maps** for the progress view, with a **generic flat 1→N grid fallback** when a surah has no authored ring/chiasmus (Yusuf keeps its ring; other surahs start on the grid), (c) surah carried on every atom / event / override key, (d) placement landmarks (scene‑beats) sourced per surah. **v2 still ships Yusuf only**; adding a surah later = run the compiler (+ optionally author a structure map), **no code changes**.
- **Why:** The moat (the learned retention model) generalizes across scripture; locking the framework to one surah would force a rewrite to grow. Parameterizing now is cheap (the engine is already mostly surah‑keyed) and irreversible‑if‑skipped. Deferring the *content* (other surahs' corpora + scholar review) keeps the first release focused. Enables NEXT‑STEPS 4a (short‑surah pack) with no re‑architecture.
- **Related:** v2‑D24/D25 (the ring becomes one per‑surah structure map; flat grid is the universal fallback), NEXT‑STEPS 4a, corpus‑compiler (already surah‑parameterized).

---

## Release gating

### v2‑D30 — Rolling scholar verification: ship after early movements, verify/override as learners advance
- **When:** 2026‑07‑16 00:49:38 UTC (2026‑07‑16 09:49 JST)
- **Kind:** process · product · **Status:** accepted — refines v1's GATE‑A ("verify all before testers") into a rolling gate for v2.
- **Context:** All 111 ayat are mechanically covered from day one (auto‑generation, v2‑D21), but coverage ≠ qari‑verified trust. v1's GATE‑A required verifying everything before any tester.
- **Decision:** Release does **not** wait for full‑surah scholar review. Verify the **early movements** first (e.g. movements 1–2, ayat 1–20), ship, and **verify/override later ayat just‑in‑time** through the Phase‑6 override editor as learners approach them. The **verified frontier must stay ahead of the fastest learner**: because unlock is gated (~1 new ayah/day, faster in Sprint) and the scheduler paces progression, a small verified buffer ahead of the frontier is enough. Track the **verified line vs. the learner frontier** as an operator metric on the admin console.
- **Why:** Fastest path to real recall data (the strategic priority in `../NEXT-STEPS.md`) without blocking on a full 1,777‑word review. Trades a **real, knowingly‑accepted risk** — a fast learner could reach an unverified ayah before scholar review — mitigated by the gated pace, the required verified buffer, and the just‑in‑time override editor. Chosen over the safer tiered / all‑111 options.
- **Related:** v1 GATE‑A (refined here), v2‑D21/D22 (the override editor is the JIT verification tool), v2‑D07/D09 (gated pace bounds how fast the frontier moves), Roadmap Phase 6/7.

### v2‑D31 — Build v2 via a fully-autonomous GitHub Actions loop (merge-everything)
- **When:** 2026‑07‑16 01:33:58 UTC (2026‑07‑16 10:33 JST)
- **Kind:** process · **Status:** accepted (user chose "fully autonomous, merge everything" over the safer autonomous-until-gate and wait-on-limit-only options, after being shown the drift risk).
- **Decision:** Execute the ROADMAP autonomously in GitHub's cloud — no local machine, no per-phase human gate. Three workflows: `v2-autobuild.yml` (orchestrator: reads `v2/.build-state` → posts `@claude execute Phase N` → enables GitHub auto-merge → loops on PR-merge, hourly cron, and dispatch), `claude.yml` (the Claude GitHub-app builder), `ci.yml` (the **required merge gate**: build + vitest + `php artisan test`). Auto-merge is conditioned on CI green. Phase progress is tracked in `v2/.build-state`. Wait-on-limit is handled by the hourly cron re-poking the current phase.
- **Why:** Fastest hands-off path to a candidate v2; the operator explicitly accepted the tradeoff — an AI approving its own architectural PRs across 7 phases can drift silently, so review happens at the END, not per phase.
- **Guardrails / accepted risks:** (a) CI is the only thing preventing merge-of-broken-code — no CI, no auto-merge. (b) Safe failure = a stall (a phase whose CI keeps failing never merges) rather than corruption. (c) CI green ≠ vision-correct; the human judgment that caught earlier design errors is deliberately traded for speed. (d) Requires `ANTHROPIC_API_KEY` secret + Actions write/PR perms + auto-merge enabled (operator one-time setup in `v2/RUNNING.md`).
- **Related:** `v2/RUNNING.md` (operator guide), `v2/ROADMAP.md` (what gets built), the standing decision-logging rule (the builder appends new decisions here per phase).

---

## Live code bugs to fix in v2 (surfaced during scenario planning)

These are confirmed in the current v1 source and must not carry into v2.

### v2‑BUG‑1 — The pace dial is decorative
- `v1/apps/web/src/session/useSession.ts:115` hardcodes `budgetMin:8`; the live session never reads the stored pace. Steady and Sprint collapse to the same drip. **Fix:** wire pace/mode into `assembleQueue` (v2‑D09).

### v2‑BUG‑2 — Make‑up recovery is dead code
- `v1/apps/web/src/session/useSession.ts:113` passes `lastActiveDay:null`, so the make‑up merge never fires live; the "never dropped" guarantee exists only in tests. **Fix:** wire `lastActiveDay` from the event log.

### v2‑BUG‑3 — Chains materialize un‑learned ayat as phantoms
- `v1/packages/engine/src/chain.ts:70` inits + credits an un‑encoded ayah as "reviewed" (strength ~18, no gate), corrupting the shared atom model that all personas read. **Fix:** gap guard — refuse or bridge‑skip un‑encoded atoms; bound chains to the real ayah count.

---

## Open — awaiting the user (not yet decided)

- **v2‑O1 — Half‑life tooltip on the admin console too?** (operator audience — raw term may be fine.) _Raised 2026‑07‑15 21:52 UTC._
- **v2‑O2 — Scaffold v2 now?** The design corpus is complete (screens, onboarding, admin, ecosystem, atomic map, scenarios, decisions, Test, recording/progress). Awaiting "scaffold v2" to begin the real React + Laravel project.

---

## Design artifacts produced (reference)

Published design artifacts backing these decisions (claude.ai/code/artifact/…):
screens & workflow · onboarding · admin console · training ecosystem · atomic function
map · scenario planning · decision table · Test feature · recording & Progress Report.
_(URLs live in the conversation; not reproduced here as they're session‑scoped.)_
