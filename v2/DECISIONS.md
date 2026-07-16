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

## Phase 0 build decisions (executed under v2‑D31 autonomous authorization)

### v2‑D32 — Resolve v2‑O2: scaffold v2 now
- **When:** 2026‑07‑16 02:03:50 UTC (2026‑07‑16 11:03 JST)
- **Kind:** process · **Status:** accepted (assistant decision under the v2‑D31 standing autonomous-loop authorization — "the loop is fully autonomous by operator choice")
- **Decision:** Execute ROADMAP Phase 0 now. v2‑O2 is resolved: yes, scaffold.
- **Why:** v2‑D31 commits to a fully-autonomous, no-per-phase-gate build; Phase 0 is next in `.build-state` (`last_completed=-1`) and the design corpus is complete. Stalling on a question the operator already pre-authorized would contradict v2‑D31.
- **Related:** v2‑O2 (superseded by this), v2‑D31.

### v2‑D33 — Engine placement: vendored `v2/src/engine/`, not a pnpm workspace package
- **When:** 2026‑07‑16 02:03:50 UTC (11:03 JST)
- **Kind:** stack · **Status:** accepted (resolves the ROADMAP "Engine placement" open item)
- **Context:** ROADMAP.md flagged two options — a pnpm workspace package (mirrors v1) vs. a vendored `src/engine/` in the single v2 app — and recommended the workspace package "to keep tests + regen tidy."
- **Decision:** Go with vendored `v2/src/engine/{src,test}` (mirroring `v1/packages/engine`'s own internal `src`/`test` split exactly, so all 24 ported source files + 16 test files needed **zero import-path edits** beyond the corpus fixture path). An `"engine"` alias (`vite.config.ts` `resolve.alias` + `tsconfig.json` `paths`) resolves `import ... from "engine"` for every ported/app file, exactly matching what v1's pnpm workspace `engine` package provided.
- **Why:** v2 was scaffolded as a single npm app (`package-lock.json`, no `pnpm-workspace.yaml`, no sibling packages) — introducing a pnpm workspace now would be a second, unrelated stack change (npm→pnpm) bundled into "port the engine," and Phase 0's own scope note says port "unchanged" where possible. The alias gives the same ergonomics (bare `"engine"` import, no relative-path spaghetti) without the tooling switch. Regen (`corpus-compiler`) stays in `v1/` per ROADMAP — not part of Phase 0.
- **Related:** ROADMAP.md "Open items to confirm" (Engine placement), v2‑D01 (React+Vite, not a monorepo statement either way).

### v2‑D34 — Router = react-router-dom; per-surah corpus files at `public/corpus/<surah>.json`
- **When:** 2026‑07‑16 02:03:50 UTC (11:03 JST)
- **Kind:** stack · **Status:** accepted
- **Decision:** (a) Replace the dev-only hash router in `main.tsx` with `react-router-dom` (`createBrowserRouter`/`RouterProvider`); routes today are `/` (shell Home) and `/system-explorer`. (b) The surah-keyed corpus loader (v2‑D29) fetches `/corpus/<surah>.json`; `v1/public/corpus.json` ships verbatim to `v2/public/corpus/12.json`.
- **Why:** ROADMAP.md Phase 0 calls for "a router" without naming one; `react-router-dom` is the standard choice for a React+Vite SPA and needs no other scaffolding. The per-surah file path is the simplest layout that satisfies "no hardcoded 12" (v2‑D29) — adding a surah later is dropping a new `<n>.json` next to it, no loader changes.
- **Related:** v2‑D29 (surah-agnostic framework), ROADMAP Phase 0.

### v2‑D35 — BUG‑3 fix scope extended to the live `rebuild.ts` chain_step fold
- **When:** 2026‑07‑16 02:03:50 UTC (11:03 JST)
- **Kind:** mechanic · **Status:** accepted
- **Context:** v2‑BUG‑3 (below) names `chain.ts:70`'s `applyChain`. While porting, `applyChain` turned out to be **dead code in v1** — grep shows it's called only from its own test; the live app instead drives chains through `ChainDrill.tsx` → `chain_step` events → `rebuild.ts`'s `applyEvent`/`getAtom`, which has the **identical phantom-materialization flaw** (`atoms.get(key) ?? initAtom(...)` for an ayah chain step, regardless of whether that ayah was ever encoded).
- **Decision:** Fix both: `chain.ts`'s `applyChain` (as named in v2‑BUG‑3) AND `rebuild.ts`'s `chain_step` branch (the actual live path) get the same gap guard — an ayah step only credits an atom that already exists **and** is `encoded`; a junction step only credits a connection that already exists (born via S4). A step whose atom doesn't qualify is skipped (no map mutation); the triggering event still lands in the append-only log (invariant #2) — it just carries no strength signal. Regression tests added in both `chain.test.ts` and `rebuild.test.ts`.
- **Why:** Fixing only the dead function would leave the real bug live in v2 exactly where the ROADMAP says it must not carry forward ("fixed as the code is lifted"). Same root cause, same minimal guard, no new mechanics — in scope for "one fix: chain.ts BUG‑3" in spirit even though the surface area is one file wider than literally named.
- **Related:** v2‑BUG‑3, ROADMAP Phase 0 ("One fix: `chain.ts` BUG‑3").

---

## Phase 1 build decisions (executed under v2‑D31 autonomous authorization)

### v2‑D36 — Tap-to-reconstruct: blank-count-by-band formula, tail-first blanking, and grading reuse
- **When:** 2026‑07‑16 02:24:17 UTC (11:24 JST)
- **Kind:** mechanic · **Status:** accepted (assistant decision under the v2‑D31 standing autonomous-loop authorization)
- **Context:** ROADMAP Phase 1 / Appendix A specifies the v2 mechanic in shape ("words progressively hidden," "auto-scales blanks with strength," "generalizes S2+S3") but not the exact blank-count-per-band formula, which positions get blanked, or how the new event types (`reconstruct_tap`, `ayah_produced`) should fold into the existing `update()`/`rebuild()` grading machinery.
- **Decision:** (a) **Blank count by band** (`reconstruct.ts` `blankCountFor`): Learn → 1 blank, Reinforce → `ceil(total/2)`, Carry → the whole ayah (full production, matching old S3 exactly). (b) **Which positions**: the LAST `blankCount` positions in reading order — the ayah's opening stays visible as scaffold, the hidden tail grows toward the front as strength climbs, until Carry band gives nothing (pure production). Blanks always fill in ascending (reading) order, one at a time, invariant #1's graded unit staying the whole ayah (one `ayah_produced` per pass, not per blank). (c) **Grading reuse, no new RetrievalKind**: a reconstruct pass's `DrillEvent.rung` is stamped directly with its grading equivalence class — `"S2"` for a partial pass, `"S3"` for a full-ayah pass — never a literal `"RC"` on the wire. `rebuild.ts` treats `reconstruct_tap` exactly like the old `tap` (negative-only grading) and `ayah_produced` exactly like `rung_complete` (positive grading + S3 gate-scheduling), reusing `RUNG_KIND`/`update()` unchanged. `Rung` gained an `"RC"` member solely for the `DrillItem` UI-facing discriminant (`reconstruct.ts`'s own `ReconstructItem` type); it is never assigned to a `DrillEvent`.
- **Why:** Reusing the exact S2/S3 grading path (rather than inventing new `RetrievalKind`s or new `update()` branches) keeps invariant #6 (logic lives in the engine, and there's exactly one scheduling function) intact with zero changes to `update.ts`/`atom.ts`, and keeps the "generalizes S2+S3" framing in the ROADMAP literally true at the grading layer, not just the UI layer. Tail-first blanking was chosen over front-first because it gives the Learn-band single blank a natural place (the last word) without special-casing position 1, and scales smoothly to "produce everything" at Carry.
- **Related:** ROADMAP Phase 1 (mechanic spec + Appendix A), v2‑D05 (tap-to-reconstruct), v2‑D23 (grounded in the ayah), invariant #1 (graded unit = whole ayah), invariant #6 (logic in engine).

### v2‑D37 — Phase 1 Drill screen: single-ayah, prev/next navigation, no queue yet
- **When:** 2026‑07‑16 02:24:17 UTC (11:24 JST)
- **Kind:** ux · **Status:** accepted (assistant decision under the v2‑D31 standing autonomous-loop authorization)
- **Decision:** The new `/drill?ayah=N` screen (`src/pages/Drill.tsx`) drills exactly one ayah per visit, chosen by the learner via Prev/Next ayah buttons (bounded to the corpus's ayah count) — there is no daily queue, pace mode, or `assembleQueue` wiring yet. Tile display order is shuffled client-side per item (the engine's option set stays deterministic/rank-ordered per v2-D23/Appendix A §E); every tap commits its `reconstruct_tap` event before any tile animates (invariant #2), and the completion banner shows the before/after strength read back from a fresh `rebuildAtoms()`.
- **Why:** ROADMAP Phase 1's scope is explicitly the drill mechanic + event instrument ("the single most important build... front-loaded because everything downstream needs the stream"); `assembleQueue`, pace modes, and the daily-session loop are named Phase 2 work. Building session/queue logic now would be scope creep ahead of its own phase and duplicate work once Phase 2 replaces the ayah picker with the real queue.
- **Related:** ROADMAP Phase 1 exit criterion, ROADMAP Phase 2 (`assembleQueue`, pace modes — where this picker gets replaced).

---

## Phase 2 build decisions (executed under v2‑D31 autonomous authorization)

### v2‑D38 — Pace mode concrete values: Steady 8min/1-ayah, Sprint 16min/3-ayah, Maintain 8min/0-ayah
- **When:** 2026‑07‑16 02:45:46 UTC (11:45 JST)
- **Kind:** mechanic · **Status:** accepted (assistant decision under the v2‑D31 standing autonomous-loop authorization)
- **Context:** ROADMAP Phase 2 / v2‑D09 names the three pace modes and their qualitative shape (Steady = 1/day ceiling + reserved slot; Sprint = raised budget + learn window + gate‑wall disclosure; Maintain = 0 new, reviews/chains only) but not concrete numbers.
- **Decision:** `engine/src/pace.ts`'s `PaceConfig` fixes: **Steady** `{budgetMin:8, newAyahCeiling:1, gateTolerance:0}` (matches the PRD's original ~6–8 min default, now genuinely wired rather than hardcoded at the call site — v2‑BUG‑1). **Sprint** `{budgetMin:16, newAyahCeiling:3, gateTolerance:1}` (2× the budget, up to 3 new ayat/session, tolerates one pending gate per v2‑D07). **Maintain** `{budgetMin:8, newAyahCeiling:0, gateTolerance:0}` (same budget as Steady but `learnCandidates` is always clipped to `[]` via `candidatesForPace`, so only reviews/chains ever queue).
- **Why:** The ROADMAP's own cost model (Appendix A: ~0.33 min/word, Yusuf ≈16 words/ayah) puts one ayah's Learn cost at ~5 min, so Steady's 8 min budget covers exactly one new ayah with review room — matching "1/day ceiling" literally rather than just capping candidates. Sprint's 16 min / 3-ayah ceiling is the smallest jump that's meaningfully faster without requiring the deferred parallel-threads mechanic (v2‑D10). Numbers are a reversible, non‑invariant‑touching choice — adjustable later without an architecture change (only `pace.ts`'s constants move).
- **Related:** v2‑D09 (pace modes), v2‑D10 (parallel threads deferred), v2‑BUG‑1 (fixed here).

### v2‑D39 — Gate forgiveness thresholds + a new `gate_demote` event
- **When:** 2026‑07‑16 02:45:46 UTC (11:45 JST)
- **Kind:** mechanic · **Status:** accepted
- **Context:** v2‑D08 names the forgiveness shape ("after N cold‑gate fails, drop to a lighter S2 re‑teach; after more, offer 'send this verse back to Learn'") but not N, and the engine had no field tracking consecutive gate fails or a way to durably record a demote (invariant #2: events are truth, not a client‑side atom mutation).
- **Decision:** `AtomState` gains `gateFails: number` (reset on a pass, incremented on a fail, via `applyGateResult`). `gate.ts`'s `gateForgiveness(atom)` ladder: **<2 fails → `"cold"`** (the normal day‑1 whole‑bank check, no warm‑up) · **2–3 fails → `"rescaffold"`** (a lighter S2 re‑teach pass first, still graded) · **≥4 fails → `"demote"`** (offer, never force, "send back to Learn"). A new append‑only event type **`gate_demote`** (only committed when the learner taps to accept the offer) folds via `demoteToLearn()` in `rebuild.ts`, which clears `encoded`/`gateDueAt`/`gatePassed`/`gateFails` but leaves `strength`/`stability`/history untouched — the same "damped, never zeroed" spirit as `update()`'s lapse path (sabr jameel), so a demoted verse re‑earns encoding and a fresh gate through the normal Learn path rather than starting from absolute zero.
- **Why:** N=2/4 gives two full learning‑days of "just retry" before any UI intervention (matches the existing gate‑retry‑next‑day cadence) and two more with a lighter path before the demote offer — proportionate escalation, never a silent drop. A dedicated event (vs. mutating the atom client‑side) keeps invariant #2 intact: the demotion is itself durable, replayable evidence, not a cache‑only side effect.
- **Related:** v2‑D08 (gate forgiveness), invariant #2 (append‑only truth), invariant #4 (damped, never zeroed).

### v2‑D40 — Unlock tolerance is a pace‑scoped parameter; "recompute after in‑session gate pass" is the caller's re‑plan, not new engine state
- **When:** 2026‑07‑16 02:45:46 UTC (11:45 JST)
- **Kind:** mechanic · **Status:** accepted
- **Context:** v2‑D07 asks for two things: (a) a small unlock tolerance band scoped by mode, and (b) recomputing `unlockPermitted` after an in‑session gate pass so a gate‑day still delivers today's ayah.
- **Decision:** (a) `gate.ts`'s `unlockPermitted(atoms, now, maxPendingGates = 0)` gained a third parameter — the count of still‑due gates tolerated before blocking new Learn. Default `0` preserves Phase 0/1 behavior exactly (no existing caller regresses); `scheduler.ts`'s `assembleQueue` threads it from `cfg.gateTolerance` (itself sourced from `PaceConfig.gateTolerance` — Sprint=1, Steady/Maintain=0). (b) Recompute‑after‑gate‑pass is **not** new engine state — `assembleQueue` was already pure and stateless, so "recompute" just means the caller (the session hook / a same‑day simulation) calls it AGAIN after appending the gate‑pass event(s) and rebuilding atoms, rather than caching the first call's verdict. This is proven in `phase2-session.test.ts`'s multi‑day simulation, which passes due gates then re‑assembles from the post‑gate atoms before offering Learn — without this second call, Steady's 1/day ceiling silently degrades to "learn every OTHER day" (a gate‑day would otherwise show zero Learn items, since the pre‑gate atoms still show the gate as due).
- **Why:** Keeping the tolerance a plain parameter (not a new gate.ts concept) means one function, one behavior, callable with different bands per mode — invariant #6 (one scheduling function) stays intact. Treating "recompute" as a caller re‑plan rather than engine memory keeps `assembleQueue` pure and testable; the alternative (engine‑side session state) would need its own invalidation rules for no real benefit.
- **Related:** v2‑D07 (unlock tolerance), v2‑D09 (pace modes carry `gateTolerance`), invariant #6 (logic in engine, one scheduler).

### v2‑D41 — Chain modes: `structured` flag on `applyChain` (not a new function family); junction retry decides via last‑attempt‑wins
- **When:** 2026‑07‑16 02:45:46 UTC (11:45 JST)
- **Kind:** mechanic · **Status:** accepted
- **Context:** v2‑D11 asks for two free‑chain modes (victory‑lap default, weak‑seam repair opt‑in) and "junctions get a real retry before committing," none of which existed yet — Phase 0 only fixed the phantom‑credit bug (v2‑BUG‑3) on the single existing `applyChain`.
- **Decision:** `applyChain` gained an `opts?: {structured?: boolean}` param (default `true`, so every existing Phase 0 test call is unaffected byte‑for‑byte) — `structured:false` relies on `update()`'s EXISTING invariant‑#5 guard (already a no‑op on `structured:false`) to give victory‑lap chains zero strength/lapse risk with no new grading branch. Two named wrappers, `applyVictoryLapChain`/`applyWeakSeamChain`, are the only call sites the UI should use. `riskiestJunctions()`/`weakSeamChainRange()` select the weak‑seam chain's range by forgetting‑risk on connection atoms (highest first), giving "built around the riskiest junctions" a concrete, testable selection rule. Junction retry: `junctionOutcome(attempts: boolean[])` — a first pass commits immediately; a first fail earns exactly one retry, and whichever of the (at most two) attempts is LAST is what commits (never blended/averaged, matching invariant #4's "no partial credit" spirit).
- **Why:** Reusing `applyChain` + the existing `structured` guard (rather than a parallel `applyChainVictoryLap` reimplementation) means the FIRe‑credit walking logic — including the v2‑BUG‑3 gap guard — is written and tested exactly once; the two modes are a one‑line difference in what gets passed to `update()`. Last‑attempt‑wins (vs. e.g. "pass if either attempt passes") keeps a junction retry an honest re‑test, not a second free roll that inflates the connection atom's evidence.
- **Related:** v2‑D11 (chain modes), v2‑BUG‑3 (the shared gap guard both modes inherit), invariant #4/#5.

### v2‑D42 — Session UI split: `useSession` hook (engine wiring only) + `Home`/`Drill`/`Gate` pages; BUG‑1/BUG‑2 fixed at this exact caller
- **When:** 2026‑07‑16 02:45:46 UTC (11:45 JST)
- **Kind:** ux · stack · **Status:** accepted
- **Decision:** `src/session/useSession.ts` is the ONE place `assembleQueue` is called from the UI — it rebuilds atoms, derives `lastActiveDay` via the new `lastActiveDayMs(events)` (never a hardcoded `null` — v2‑BUG‑2), and sources `budgetMin`/`gateTolerance` from `paceConfig(mode)` where `mode` is persisted in `localStorage` via `src/session/pace.ts` and mid‑surah editable (v2‑BUG‑1). `Home.tsx` renders the assembled queue + a 3‑way pace selector and routes "Start" to `/gate?ayah=N` for `makeup`/`gate` items or `/drill?ayah=N` for `review`/`learn` items. `Gate.tsx` is a new page implementing the cold whole‑bank check (`initReconstruct(..., {full:true})`, a Phase 2 addition to `reconstruct.ts`) plus the v2‑D08/v2‑D39 forgiveness UI (rescaffold warm‑up → cold check; demote offer). `Drill.tsx` (Phase 1, unchanged mechanically) gained a "← Back to session" link on completion so the queue flow closes the loop back to `Home`, which re‑plans on remount.
- **Why:** v1's BUG‑1/BUG‑2 lived in exactly one file (`useSession.ts`) because it was the one caller of `assembleQueue` — mirroring that shape in v2 (one hook, one call site) makes the fix auditable at a glance and prevents a second hardcoded caller from reintroducing either bug later. Splitting Gate into its own page (rather than a mode flag on Drill) keeps Drill's Phase 1 contract (partial‑credit reconstruct, per‑tap grading) untouched while the gate's very different contract (forced full blank, single pass/fail verdict, no partial credit) gets its own state machine.
- **Related:** v2‑BUG‑1, v2‑BUG‑2 (both fixed here), v2‑D37 (Drill.tsx's Phase 1 scope, now extended not rewritten), ROADMAP Phase 2 exit criterion.

### v2‑D43 — Gloss‑language resolution lives in the engine (`wordGloss`), threaded through every gloss‑generating function; no new gloss UI added this phase
- **When:** 2026‑07‑16 03:05:12 UTC (12:05 JST)
- **Kind:** mechanic · stack · **Status:** accepted
- **Context:** v2‑D27 requires "every gloss‑based question" to read `gloss[lang] ?? gloss.en ?? text_uthmani` and be driven by the learner's onboarding EN/MS choice. `ladder.ts`'s `s1Options`/`nextItem` and `bridge.ts`'s `bridgeItems` (S1 meaning MCQ, S4 bridge) hardcoded `.gloss.en`. Neither S1 nor S4 currently has a live v2 React consumer — Phase 1 shipped only tap‑to‑reconstruct (`reconstruct.ts`/`Drill.tsx`), which is pure Arabic‑tile, no gloss text on screen at all.
- **Decision:** Added `wordGloss(word, lang = "en")` to `engine/src/corpus.ts` as the ONE fallback‑chain implementation (invariant #6), and gave `s1Options`, `nextItem` (ladder.ts), `advance` (ladder.ts), and `bridgeItems` (bridge.ts) an optional trailing `lang: GlossLang = "en"` parameter that calls it — default preserves every existing test call site byte‑for‑byte. Did **not** build new S1/S4 drill screens this phase (out of ROADMAP Phase 3 scope — that's Phase 4's Test feature territory); the onboarding‑captured choice (`session/glossLang.ts`) is ready to thread into those screens whenever they're wired to the UI.
- **Why:** Satisfies "driving every gloss‑based question" at the only place invariant #6 allows (the engine) without inventing UI that isn't in this phase's scope. Building the parameter now (rather than deferring to whichever phase adds the UI) means no gloss‑generating function is ever written with a hardcoded `.en` in v2, matching how v2‑D29 (surah‑agnostic) was threaded early rather than retrofitted.
- **Related:** v2‑D27 (bilingual glosses), invariant #6, ROADMAP Appendix A §B/E.

### v2‑D44 — "Switch account" (v2‑D12) is a local‑only device reset until Phase 5 auth lands
- **When:** 2026‑07‑16 03:05:12 UTC (12:05 JST)
- **Kind:** product · ux · **Status:** accepted
- **Context:** v2‑D12's rationale ("each learner signs into their own account" via Laravel Sanctum) presumes the Phase 5 backend, which doesn't exist yet — but ROADMAP Phase 3 explicitly scopes the "not you? switch account" affordance into THIS phase, on Home.
- **Decision:** `session/resetAccount.ts`'s `resetForNewLearner()` wipes this device's local state — the IndexedDB event log (`db/eventLog.ts`'s new `clearAll()`), the atoms snapshot cache (`db/atoms.ts`'s new `clearSnapshot()`), and every persisted setting (placement cache, anchor hour, gloss language, pace mode reset to default) — then routes to `/onboarding`. Home's button gates the call behind a native `confirm()` (deliberate one extra tap of friction against an accidental wipe). No account/identity concept is introduced; this is purely a shared‑device corruption guard, exactly as v2‑D12 scoped it ("without building multi‑profile").
- **Why:** Simplest reasonable default consistent with v2‑D12's intent that doesn't require pulling Phase 5 (Laravel + Sanctum) forward. When Phase 5 ships, this local wipe composes naturally with account switching (sign out locally, sign into the other account, hydrate) — it doesn't need to be rebuilt, only supplemented.
- **Related:** v2‑D12, v2‑D01 (local‑first until Phase 5), ROADMAP Phase 5.

### v2‑D45 — Onboarding sequence is placement → anchor → pace → gloss language; the placement cache is written LAST, gating "ready"
- **When:** 2026‑07‑16 03:05:12 UTC (12:05 JST)
- **Kind:** ux · mechanic · **Status:** accepted
- **Context:** ROADMAP Phase 3 lists four onboarding pieces (placement, anchor, pace, gloss language) without prescribing order or how "onboarding done" is detected across a possible mid‑flow exit.
- **Decision:** Fixed order placement → anchor → pace → gloss language (each choice persists to its own `localStorage` key as soon as it's made — `session/anchor.ts`, `session/pace.ts`, `session/glossLang.ts` — via the same pattern as the existing pace persistence). The placement result itself (`session/placement.ts`'s `StoredPlacement`, the "ready" signal `useOnboarding.ts` checks first) is only cached at the very END of the whole flow, after gloss language is chosen — so a learner who closes the tab after placement but before finishing anchor/pace/lang re‑enters onboarding from the top next time, rather than landing on a "ready" Home with unset settings. Separately, `useSession.ts`'s learn‑window start (`learnWindowStart()`, now a pure exported/tested function) falls back to the placement's `startAyah` — not a hardcoded `1` — whenever nothing is encoded yet, so a returning‑hifz learner's carried ayat are actually honored by the first real session, not just displayed on the placement result screen.
- **Why:** Placement first because it changes the OTHER steps' framing (a learner who carries 60 ayat is a different conversation than a fresh start); gloss language last as the lowest‑stakes choice. Deferring the cache write closes a real gap the ROADMAP didn't call out — v1's equivalent (`onboarding/useOnboarding.ts`) had the same shape (placement‑only, cached once, at the end of ITS one step) but v2 has three more steps after placement, so the "cache last" rule had to be stated explicitly to avoid a partial‑onboarding false‑ready state.
- **Related:** v2‑D27 (gloss language), v2‑D12 (anchor/pace already‑established patterns), ROADMAP Phase 3 exit criterion.

---

## Phase 4 build decisions (executed under v2‑D31 autonomous authorization)

### v2‑D46 — Test is read‑only BY CONSTRUCTION: no rebuild.ts branch at all for test_* events
- **When:** 2026‑07‑16 03:28:04 UTC (12:28 JST)
- **Kind:** mechanic · stack · **Status:** accepted (assistant decision under the v2‑D31 standing autonomous‑loop authorization)
- **Context:** v2‑D14 requires a Test to "generate and score questions but never move strength or due‑dates." The obvious implementation would route `test_answer`/`test_result` through `update()` with `structured:false` (the same guard victory‑lap chains already use, v2‑D41) — which would work, since `update()` already no‑ops on `structured:false`.
- **Decision:** Go further: `rebuild.ts`'s `applyEvent` gets **no branch at all** for `test_start`/`test_answer`/`test_result` — they fall through exactly like `rung_start`/`ayah_complete` already do (events with no strength signal of their own). Three new event types (`test_start`, `test_answer`, `test_result`) and four new optional `DrillEvent` fields (`testKind`, `score`, `total`, `sentToReviews`) were added to `types.ts`/`events.ts`. New engine module `engine/src/test.ts` holds all Test‑specific pure logic: item generators (`vocabItem`/`clozeItem`/`produceItem`/`junctionTestItem`/`locateItem`/`reorderItem`), grading helpers (`isCorrectChoice`/`isCorrectLocate`/`isCorrectReorder`), `carriedAyat()` (the v2‑D15 smart default range) and `testHistory()` (the Progress Report's read of the log). A dedicated `rebuild.test.ts`‑style assertion in `engine/test/test.test.ts` proves `rebuild(events)` is byte‑identical with and without a full Test's worth of `test_*` events spliced in.
- **Why:** A missing branch is a stronger, more auditable guarantee than a branch that computes a no‑op — a future engineer extending `rebuild.ts` sees no `test_*` case to "helpfully" wire up, and the read‑only invariant can't regress via a change to `update()`'s guard logic (which chains and reviews also depend on). Keeping all Test generation logic in `test.ts` — reusing `ladder.ts`'s `s1Options`, `options.ts`'s `pickOptions`, `chain.ts`'s `junctionItem`, and `reconstruct.ts`'s `initReconstruct` verbatim — honors invariant #6 (no new distractor logic) exactly as the ROADMAP's Appendix A reuse note calls for.
- **Related:** v2‑D14 (Test is a read‑only mirror), v2‑D41 (the `structured:false` guard chains already use), invariant #6, ROADMAP Phase 4 exit criterion ("a Test scores without moving any strength").

### v2‑D47 — Test's mixed question set is exactly v2‑D13's six named types; chaining‑reorder is TAP‑to‑order, not drag‑and‑drop; selection randomness lives in the UI, not the engine
- **When:** 2026‑07‑16 03:28:04 UTC (12:28 JST)
- **Kind:** mechanic · ux · **Status:** accepted
- **Context:** v2‑D13 names six sub‑types (vocab, cloze, locate‑the‑ayah, junction, chaining‑reorder, produce‑from‑cold); Appendix A's table additionally gestures at "the above" (implying S4 bridge too) without a firm list. Separately, "no RNG in the engine" (Appendix A §E) is stated for the deterministic Learn/Reinforce/Carry path, but a Test's entire premise is an unpredictable quiz over a chosen range — a tension the ROADMAP doesn't resolve.
- **Decision:** (a) Scope: implement precisely v2‑D13's six named types — S4 bridge is NOT included in Test this phase (out of the locked‑decision text, in scope for a later phase if wanted). (b) Chaining‑reorder is **tap‑to‑order**, not literal drag‑and‑drop: v2 has no drag primitive in `package.json`, and every other drill (tap‑to‑reconstruct, gate, junction/placement MCQs) is already tap‑based (v2‑D28: "tap‑to‑reconstruct is a thumb interaction"). The learner taps shuffled ayat in the order they believe is correct; `test.ts`'s `isCorrectReorder` requires the full sequence to match exactly (no partial credit, matching invariant #1's whole‑unit spirit). (c) The "no RNG in the engine" invariant is honored for item CONSTRUCTION (every `test.ts` builder — `vocabItem`, `clozeItem`, etc. — is pure and deterministic for a given `(kind, ayah)` input) but NOT for item SELECTION: which `(kind, ayah)` pairs appear in a given Test and their display order is decided by `Test.tsx` (`buildItems`/`shuffledArr`), using the exact same "UI shuffles, engine doesn't" split the codebase already uses for tile display order (Drill.tsx/Gate.tsx/Placement.tsx's own `shuffled()` helpers).
- **Why:** Matches the locked decision text exactly rather than a broader reading of the descriptive Appendix A table. Tap‑to‑order reuses an established, tested interaction pattern instead of introducing a new touch gesture and a drag library dependency the app doesn't have. Splitting "deterministic construction" from "random selection" resolves the RNG tension the same way the codebase already resolves it for display‑order shuffling — a Test without real unpredictability wouldn't be a meaningful self‑check.
- **Related:** v2‑D13 (the Test feature), v2‑D28 (tap‑first mobile interaction), Appendix A §E (no RNG in the engine — construction only), v2‑D46.

### v2‑D48 — The 12‑movement ring lives in the APP layer (`src/progress/movements.ts`), not the engine; rendered as 12 circular tap targets, not an SVG pie
- **When:** 2026‑07‑16 03:28:04 UTC (12:28 JST)
- **Kind:** stack · ux · **Status:** accepted
- **Context:** v2‑D24 locks Yūsuf's exact 12 movement ayah ranges and mirror pairs; v2‑D29 requires the engine itself to carry no hardcoded surah. Neither decision says which LAYER owns the movement‑to‑ayah lookup, and the ROADMAP doesn't specify a rendering technique for "the ring."
- **Decision:** The movement table (`YUSUF_MOVEMENTS`, keyed by surah number in a `SURAH_MOVEMENTS` record) lives in `v2/src/progress/movements.ts` — application code, not `engine/src/*` — so the engine (which already threads `surah` as a plain parameter per v2‑D29) never gains a second, narrative‑structure notion of "surah‑specific." A surah with no entry returns `null` from `movementsFor()`, and `Grid.tsx` already renders correctly with `selectedMovement` forced to "show everything" in that case — the flat grid fallback (v2‑D29) falls out of the same code path, not a separate branch. The Ring itself (`src/progress/Ring.tsx`) is rendered as 12 real `<button>` tap targets (≥44px, v2‑D28) placed on a circle via plain trigonometry (`cos`/`sin` on a fixed radius), tinted by each movement's average decayed strength through the same `color-mix()`‑over‑teal‑ramp approach the flat grid and `.meter` bars already use — not a hand‑rolled SVG arc‑path pie chart.
- **Why:** Keeps `engine/*` strictly surah‑agnostic (the movement table is exactly the kind of surah‑specific authored content v2‑D29 says "adding a surah later" should not require engine changes for). Circular button placement is far simpler and more robust to get right than SVG arc‑path math for a first cut, ships the same information (12 tappable, strength‑tinted arcs) and the same interaction (tap → drill into the grid, v2‑D25), and reuses the existing strength‑tinting convention instead of inventing new ring‑specific colors (respecting invariant #5 — no new decorative colors beyond the locked teal/coral/purple/amber system).
- **Related:** v2‑D24 (the ring's ayah ranges), v2‑D25 (ring+grid as two zoom levels), v2‑D29 (surah‑agnostic engine, flat‑grid fallback), invariant #5.

### v2‑D49 — "Send to reviews" nudge (v2‑D14) is a durable audit‑trail flag only, this phase; wiring flagged ayat into `assembleQueue` is deferred
- **When:** 2026‑07‑16 03:28:04 UTC (12:28 JST)
- **Kind:** product · **Status:** accepted
- **Context:** v2‑D14 specs the nudge only as "an optional 'send these to my reviews' nudge requires a tap" — it doesn't say what "sent to reviews" actually DOES to the learner's next session.
- **Decision:** Tapping "Send weak ayat to reviews" on the Test result screen commits the test's `test_result` event with `sentToReviews:true` (vs. `false` for "Done") — a durable, auditable fact surfaced in the Progress Report's Test history. It does **not** feed into `scheduler.ts`'s `assembleQueue` review candidates or otherwise touch atom state — Test stays strictly read‑only per v2‑D46, and no atom exists to attach "please review this" to without inventing new mutable state outside the append‑only event/atoms‑cache model. The `test_result` event itself is committed once, at whichever button (`Done` or the nudge) the learner taps to leave the result screen — deferred slightly past the individual `test_answer` commits (each of which already lands before its own item's feedback, satisfying invariant #2 at the question level) — so a single summary event carries the final, tap‑confirmed `sentToReviews` value rather than needing a second event to amend the first (events are append‑only; nothing is ever updated in place).
- **Why:** Simplest reasonable default consistent with v2‑D14's literal ask (record that the tap happened) without scope‑creeping into scheduler changes the ROADMAP doesn't ask for this phase. A future phase can read `testHistory()`'s `sentToReviews` flag to seed extra review candidates without any schema change here.
- **Related:** v2‑D14 (the Test feature's read‑only mirror + optional nudge), v2‑D46, invariant #2 (append‑only, commit‑before‑feedback — honored per‑item; the session‑level summary commits once, at exit).

### v2‑D50 — Growth curve / streak calendar / half‑life extensions land in `heatmap.ts` / `streak.ts` / `strength.ts` respectively, matching the ROADMAP's named sources
- **When:** 2026‑07‑16 03:28:04 UTC (12:28 JST)
- **Kind:** mechanic · **Status:** accepted
- **Context:** ROADMAP Phase 4 names `heatmap.ts`, `strength.ts`, `sessionSummary.ts` as the Progress Report's data sources but doesn't specify which new pure functions go where, and two of the three needed computations (a growth curve, a streak calendar) didn't exist in any form yet — `streak.ts`'s own doc comment for `computeStreak` already presupposed a "set of learning‑day indices on which a session was completed" that no function actually produced.
- **Decision:** `heatmap.ts` gains `growthCurve(events, cfg)` — one point per learning‑day with a newly‑encoded ayah, cumulative count, deduplicated per ayah at its FIRST encode. `streak.ts` gains `completedDayIndices(events, cfg)`, filling the gap its own doc comment implied; deliberately NOT gated on `structured` — a victory‑lap chain or a Test still marks a day "active" for streak/heatmap purposes even though neither moves strength (consistent with v2‑D11's "records the run for streak/heatmap, no strength change" and v2‑D14's Test parity). `strength.ts` gains `halfLifeDays(atom) = stability·ln(2)` — the exact point retrievability crosses 0.5 — feeding the Progress Report's first `<InfoTip>` (v2‑D19), using the copy already specified in that decision.
- **Why:** Keeps each pure function next to the concept it's a derivative of (a growth curve is a heatmap over time; a streak calendar's activity set belongs with `computeStreak`; half‑life is strength.ts's own `retrievability` inverted) rather than inventing a new `progress.ts` engine module that would fragment the "one source per concern" pattern every other engine file already follows.
- **Related:** ROADMAP Phase 4 ("from heatmap.ts, strength.ts, sessionSummary.ts"), v2‑D19 (half‑life InfoTip copy), v2‑D11 (victory‑lap chains count for streak/heatmap).

---

## Phase 5 build decisions (executed under v2‑D31 autonomous authorization)

### v2‑D51 — Sanctum auth uses bearer personal-access tokens, not the stateful cookie/SPA guard
- **When:** 2026‑07‑16 03:50:35 UTC (12:50 JST)
- **Kind:** stack · **Status:** accepted (assistant decision under the v2‑D31 standing autonomous-loop authorization)
- **Context:** Sanctum ships two authentication modes: (a) the stateful "SPA" guard — session cookies + CSRF, meant for a first-party frontend served from the same top-level domain as the API; (b) stateless bearer personal-access tokens, meant for decoupled clients. ROADMAP Phase 5 says "Laravel + Sanctum" without naming which. v1's worker used an HttpOnly session cookie (FR7) precisely because Pages+Worker were same-site; v2's Vite SPA (`v2/`) and Laravel API (`v2/api/`) are two separate processes/origins in dev (`:5273` vs `:8000`) and may stay on different domains in production.
- **Decision:** Use Sanctum's bearer-token guard exclusively (`Route::middleware('auth:sanctum')`, `User::createToken()`/`HasApiTokens`). The token is stored client-side in `localStorage` (`sync/auth.ts`'s `iman-auth-token` key) and sent as `Authorization: Bearer <token>` — never a cookie. `config/cors.php`'s `supports_credentials` stays `false` and `allowed_origins` defaults to `*` (env-overridable via `ALLOWED_ORIGINS`), which is safe specifically because a browser never auto-attaches a bearer token cross-origin the way it does a cookie — so unlike v1, there is no CSRF surface and no `originCheck` middleware is needed on state-changing routes.
- **Why:** The stateful SPA guard needs first-party-domain cookies + a CSRF-cookie handshake (`/sanctum/csrf-cookie`) to work at all; forcing that onto a Vite dev server and a Laravel API on different ports (and possibly different production domains) is extra ceremony for no security benefit here, since the whole point of a bearer token is that it sidesteps the cookie/CSRF threat model. Token-based auth also composes naturally with "anonymous-first" (v2‑D03): minting an anonymous identity is just "call an endpoint, get a token," no cookie/session bootstrapping required.
- **Related:** v2‑D03 (Sanctum auth), v2‑D52 (anonymous-first mechanics), ROADMAP Phase 5.

### v2‑D52 — Anonymous-first mechanics: mint-on-demand device row, claim-in-place adoption, email-only sign-in (social deferred)
- **When:** 2026‑07‑16 03:50:35 UTC (12:50 JST)
- **Kind:** product · mechanic · **Status:** accepted
- **Context:** v2‑D03 says "anonymous-first with account adoption; email or social sign-in" but doesn't specify the exact mechanics — whether adoption creates a second row and merges, whether sign-in on a new device requires abandoning the first device's identity, or which sign-in method(s) ship first.
- **Decision:** (a) **Mint-on-demand**: `POST /auth/anonymous` creates one `users` row (`is_anonymous:true`, `name`/`email`/`password` all nullable — see the `0001_01_01_000000_create_users_table` migration) and a bearer token, called lazily by the client's `ensureDevice()` the first time anything needs to sync — no signup screen blocks first use (matches v2‑D01's local-first spirit: the app is fully usable before any server round-trip). (b) **Claim-in-place, not merge**: `POST /auth/register` (auth:sanctum-gated) updates the CURRENTLY authenticated row's `email`/`password`/`is_anonymous` — same user id, same `events` rows, zero migration needed, because the anonymous row already owns the full history. (c) **Sign-in switches identity, doesn't merge**: `POST /auth/login` issues a token for a *different*, pre-existing account; the client swaps its stored token and must `hydrate()` to pull that account's history down. Any local events not yet flushed under the OLD identity will sync under whichever account is active when `flush()` next runs — the server never accepts a client-supplied user id (matching v1's session-derived `uid`), so this is a deliberate, accepted simplification: true cross-device event *merging* (reconciling two divergent local logs into one account) is out of scope for Phase 5. (d) **Email/password only this phase** — Google/social sign-in (which v1 had via GIS) is deferred; `AuthController`'s `register`/`login` are the full surface today.
- **Why:** Claim-in-place is the simplest correct answer to "adoption" because the anonymous account IS the eventual account (no merge logic, no dual-row bookkeeping). Treating login as identity-switch-not-merge avoids building event-log reconciliation (last-write-wins vs. union vs. conflict UI) that nothing in the ROADMAP or DECISIONS asks for yet — the exit criterion is "a second device hydrates the same history," which claim-in-place + switch-and-hydrate satisfies without it. Social sign-in is a separate, later-addable `AuthController` method (e.g. `google()`) that doesn't change this shape — deferring it keeps Phase 5 scoped to the sync mechanism the ROADMAP actually names.
- **Related:** v2‑D03 (the foundational decision this refines), v2‑D51 (token mechanics), v2‑D12/D44 (device-scoped "switch account," which this composes with per v2‑D44's own forward note), ROADMAP Phase 5 exit criterion.

### v2‑D53 — Laravel app lives at `v2/api`; idempotency via `insertOrIgnore` keyed by the client uuid PK
- **When:** 2026‑07‑16 03:50:35 UTC (12:50 JST)
- **Kind:** stack · **Status:** accepted
- **Context:** ROADMAP Phase 5 doesn't name a path for the new Laravel app. `.github/workflows/ci.yml`'s `php` job (already present before this phase, part of the v2‑D31 autobuild scaffolding) checks `v2/api/artisan` to decide whether to run `php artisan test` — so the path was already load-bearing infrastructure, just unbuilt.
- **Decision:** Scaffold the Laravel 13 app at `v2/api` (`composer create-project laravel/laravel v2/api`, then `composer require laravel/sanctum` + `php artisan install:api`), matching the CI script's expectation exactly. The `events` table's primary key is the client-generated uuid itself (`$table->string('id')->primary()`, not an autoincrement id) with a separate `(user_id, ts)` index — `EventsController::store` uses Eloquent's `insertOrIgnore()` (returns the count of newly-inserted rows on every driver Laravel supports) so a re-sent batch after a dropped connection is a true no-op, and `accepted`/`ignored` in the response are computed from that count without a separate before/after `COUNT(*)` round-trip (v1's D1 approach, kept simpler here since `insertOrIgnore`'s return value already gives the accepted count directly).
- **Why:** Matches already-committed CI expectations rather than introducing a second, conflicting path; using the wire-supplied uuid as the literal primary key (rather than a server-side autoincrement id plus a unique index on a separate "client_id" column) is the more direct reading of ROADMAP Phase 5's own wording ("PK = client uuid = idempotency key") and needs no extra unique-constraint indirection.
- **Related:** ROADMAP Phase 5 ("Reproduce v1's D1 schema... PK = client uuid = idempotency key"), v1's `apps/worker/src/db.ts` (the `INSERT OR IGNORE` pattern this ports).

---

## Phase 6 build decisions (executed under v2‑D31 autonomous authorization)

### v2‑D54 — Admin auth: `ADMIN_EMAILS` allowlist middleware over the existing Sanctum guard, not a new role column
- **When:** 2026‑07‑16 03:56:59 UTC (12:56 JST)
- **Kind:** stack · **Status:** accepted (assistant decision under the v2‑D31 standing autonomous‑loop authorization)
- **Context:** ROADMAP Phase 6 needs an operator‑only surface (admin console + override editor) but neither the ROADMAP nor DECISIONS specify how an admin is identified. v1 already solved this exact problem (`v1/apps/worker/src/middleware.ts`'s `isAdmin`/`requireAdmin`): a comma‑separated `ADMIN_EMAILS` env allowlist, checked against the authenticated user's email, failing closed (empty allowlist ⇒ nobody is admin) — no separate roles/permissions system.
- **Decision:** Port the same shape onto Sanctum: `config/admin.php` reads `ADMIN_EMAILS` (comma‑separated) into `emails`; a new `App\Http\Middleware\EnsureIsAdmin` runs after `auth:sanctum`, 403s unless `$request->user()->email` (lower‑cased, trimmed) is in the allowlist, and fails closed exactly like v1. Registered as the `admin` middleware alias in `bootstrap/app.php`. Since anonymous users have a null email, they can never match — an operator must first `POST /auth/register` (adopt an email) before being allow‑listed, which is the correct shape (admin identity should be a real, durable account).
- **Why:** Reuses a decision the user already implicitly approved for v1 rather than inventing a heavier roles/permissions model the ROADMAP doesn't ask for; fail‑closed matches v1's explicit security posture ("Fails closed... never throws").
- **Related:** v1's `middleware.ts` (`isAdmin`/`requireAdmin`, ported), v2‑D51 (bearer‑token auth this middleware runs after), ROADMAP Phase 6.

### v2‑D55 — Question‑bank overrides are one append‑only table; resolution is latest‑`created_at`‑wins per field‑scoped key; `group`/`custom` are stored and editable but not generation‑wired this phase
- **When:** 2026‑07‑16 03:56:59 UTC (12:56 JST)
- **Kind:** stack · mechanic · **Status:** accepted
- **Context:** ROADMAP Appendix A §D specifies the override row shape (`{surah, ayah, position, question_type, field, payload, editor_id, note, created_at}`, explicitly "append‑only audit") and §E's precedence rule ("a matching override replaces the generated field... unmatched stays automatic") but not how a REPEAT edit to the same question resolves, nor which of the five `field` values (`gloss`/`distractor`/`group`/`disable`/`custom`) get real generation‑time effect this phase.
- **Decision:** (a) **One table, never updated/deleted** (`question_overrides` migration — mirrors the `events` table's own append‑only shape) — correcting a prior edit means inserting a NEW row for the same key, never mutating the old one; "undo a disable" is a new `disable` row with `payload:{disabled:false}`. (b) **Resolution key varies by field, computed in `applyOverrides()`** (engine/src/overrides.ts, new): `gloss` resolves latest‑wins per `(ayah, position, payload.lang)`; `distractor` resolves latest‑wins per `(ayah, position)` (a full replacement set, not a merge); `disable` resolves latest‑wins per `(ayah, position, question_type)` and is exposed as a `disabled` list the APP layer (not the engine) filters against, since "which items to show" is Test.tsx/Drill.tsx's concern, not the engine's. (c) **`group` and `custom` are fully modeled in the schema, the API, and the qari editor UI** (create/list/view — satisfying v2‑D22's "group multi‑word gloss units... add custom ones" as an editor AFFORDANCE and giving DATA‑1 its schema home, as v2‑D21 promises) **but are not resolved by `applyOverrides()` into live question generation this phase** — grouping changes the ladder's S1 unit‑of‑probe (a mechanic change beyond a corpus‑data patch) and a fully custom question needs new render branches in Drill/Test; both are real engine/UI work the exit criterion doesn't require ("an editor overrides ONE generated question" — satisfied by `gloss`/`distractor`).
- **Why:** Matches the "append‑only audit" wording literally (same pattern already proven for `events`) rather than inventing update/delete semantics the schema doc doesn't ask for. Scoping live generation effect to `gloss`/`distractor` is the same kind of deliberate, stated scope‑narrowing v2‑D49 already set a precedent for (store the full audit trail; wire only what the exit criterion needs) — full `group`/`custom` generation wiring is real scope for a later pass, not silently dropped (the data model and editor already carry it).
- **Related:** v2‑D21/D22 (the override layer + editor), v2‑D49 (precedent for phased wiring), ROADMAP Appendix A §D/E, Roadmap Phase 6 exit criterion.

### v2‑D56 — Override resolution is a pure corpus‑patching function in the engine (`applyOverrides`), not per‑generator parameters
- **When:** 2026‑07‑16 03:56:59 UTC (12:56 JST)
- **Kind:** mechanic · stack · **Status:** accepted
- **Context:** v2‑D21 says overrides "apply at question‑build time" and "merged in `pickOptions`/gloss lookup." The literal reading would thread a new `overrides` parameter through `pickOptions`, `s1Options`, `wordGloss`, every `test.ts` builder, etc. — a signature change to nearly every generator in the engine.
- **Decision:** Instead, `applyOverrides(corpus: Corpus, overrides: QuestionOverride[]): { corpus: Corpus; disabled: DisabledQuestion[] }` returns a NEW `Corpus` with `gloss`/`distractor` overrides already patched into `words[]`/`distractors[]` — every existing pure generator (`wordGloss`, `distractorsFor`, `pickOptions`, `s1Options`, `ladder.nextItem`, every `test.ts` builder, `reconstruct.ts`) keeps its exact current signature and is simply called with the PATCHED corpus instead of the raw one. The app layer (Drill/Test/Gate/Placement) calls `loadCorpus()` then `applyOverrides()` once per screen mount and uses the result everywhere it currently uses `corpus`.
- **Why:** Zero signature changes to any tested generator (all 16+ existing engine test files stay byte‑for‑byte valid) and the override‑application logic lives in exactly ONE new pure, tested engine function — invariant #6 ("all engine logic lives in packages/engine as pure functions with tests... no scheduling/strength logic in React") is honored more strongly this way, not less, since "gloss[lang] ?? gloss.en" and "the top‑ranked distractors" are already corpus‑shaped reads; patching the corpus is the minimal‑surface‑area way to make "overrides win" true everywhere at once, matching how v2‑D43 threaded `lang` in the smallest way that worked.
- **Related:** v2‑D21 (override layer), v2‑D43 (the precedent for a minimal, additive engine change), invariant #6.

### v2‑D57 — Verified‑frontier‑vs‑learner‑frontier (v2‑D30's operator metric) is a new `ayah_verifications` table, admin‑marked; frontier = max ayah with an S3‑equivalent completion event, any user
- **When:** 2026‑07‑16 03:56:59 UTC (12:56 JST)
- **Kind:** product · stack · **Status:** accepted
- **Context:** v2‑D30 commits to tracking "the verified line vs. the learner frontier... as an operator metric on the admin console" but no prior phase built either half: there was no notion of "this ayah has been scholar‑verified" anywhere in the schema, and "learner frontier" (the furthest any learner has actually reached) isn't one of v1's §3 metrics either.
- **Decision:** New migration `ayah_verifications` (`surah`, `ayah`, unique together, `verified_by` nullable string, `note` nullable, `created_at`) — an admin action (`POST /admin/verifications`) marks one ayah verified; `GET /admin/frontier` returns `{ verifiedThrough, learnerFrontier, bufferAyat, surahAyahCount }` where `verifiedThrough` = the highest ayah `N` such that every ayah `1..N` has a verification row (a verified PREFIX, not just a max — matching "the verified frontier stays ahead of the learner" literally, since one verified ayah deep in the surah with gaps before it wouldn't actually cover a learner working through in order) and `learnerFrontier` = `MAX(ayah)` across all users' `ayah_produced`/`rung_complete` events with `rung='S3'` (the same "encoded" signal v1's `admin.ts` already used server‑side). The admin console renders both lines plus the buffer and a per‑ayah verify toggle grouped by the 12 movements (reusing `src/progress/movements.ts` client‑side for display grouping only — the table itself stays ayah‑granular and surah‑agnostic, keyed by `(surah, ayah)`).
- **Why:** A prefix‑verified count is the only shape that makes "verified frontier stays ahead of the learner frontier" a meaningful single number to compare — a scattered set of verified ayat can't be safely summarized as "verified through N." Reusing the existing S3 completion signal for learner frontier avoids inventing a second definition of "encoded" alongside the one `rebuild.ts`/the client atoms cache already use.
- **Related:** v2‑D30 (the decision this fulfills), v2‑D24 (the 12 movements, reused for display grouping), ROADMAP Phase 6 exit criterion (admin metrics), ROADMAP Phase 7 (GATE‑A, which reads this same metric).

### v2‑D58 — Resolves v2‑O1: no `<InfoTip>` on the admin console; jargon stays raw for the operator audience
- **When:** 2026‑07‑16 03:56:59 UTC (12:56 JST)
- **Kind:** ux · **Status:** accepted — resolves the open item v2‑O1
- **Context:** v2‑O1 asked whether the half‑life `<InfoTip>` (v2‑D19, built for the learner‑facing Progress Report) should also appear on the admin console, explicitly flagging "operator audience — raw term may be fine" as the likely answer.
- **Decision:** No. The admin console keeps §3 metric labels and any half‑life‑adjacent numbers (e.g. per‑user average retrievability) as raw technical terms, with the PRD target text already doing the explanatory work (exactly as v1's `admin.ts` did — target column, no tooltip). `<InfoTip>` remains exclusively a Progress Report (learner‑facing) component.
- **Why:** Simplest reasonable default consistent with the ROADMAP's own parenthetical steer, v2‑D17's hard separation of learner vs. operator surfaces (an operator‑friendly affordance leaking onto the warm learner page would be the worse direction; the reverse — a technical page staying technical — costs nothing), and avoids stretching `<InfoTip>`'s copy (written for a warm, reassuring voice) onto a dense metrics table it wasn't designed for.
- **Related:** v2‑O1 (resolved by this entry), v2‑D19 (`<InfoTip>`, stays learner‑only), v2‑D17 (learner/operator separation), ROADMAP Phase 6 ("Resolve v2‑O1").

---

## Live code bugs to fix in v2 (surfaced during scenario planning)

These are confirmed in the current v1 source and must not carry into v2.

### v2‑BUG‑1 — The pace dial is decorative
- `v1/apps/web/src/session/useSession.ts:115` hardcodes `budgetMin:8`; the live session never reads the stored pace. Steady and Sprint collapse to the same drip. **Fix:** wire pace/mode into `assembleQueue` (v2‑D09). **Status: fixed in Phase 2** — see v2‑D38 (concrete PaceConfig values) and v2‑D42 (the one real caller, `session/useSession.ts`, sources `budgetMin` from `paceConfig(mode)`; regression tests in `phase2-session.test.ts` prove Steady ≠ Sprint on identical atom state, and a real dev‑server run confirms the pace selector changes the live queue).

### v2‑BUG‑2 — Make‑up recovery is dead code
- `v1/apps/web/src/session/useSession.ts:113` passes `lastActiveDay:null`, so the make‑up merge never fires live; the "never dropped" guarantee exists only in tests. **Fix:** wire `lastActiveDay` from the event log. **Status: fixed in Phase 2** — see v2‑D42; `engine/src/activity.ts`'s `lastActiveDayMs(events)` derives the real value from the append‑only log, and `phase2-session.test.ts` demonstrates the concrete behavioral gap (make‑up fires with the real log, never fires with the old hardcoded `null`) plus a live dev‑server confirmation (a seeded overdue gate surfaced as "1 make‑up · Start — Make‑up 12:2" on Home and routed correctly).

### v2‑BUG‑3 — Chains materialize un‑learned ayat as phantoms
- `v1/packages/engine/src/chain.ts:70` inits + credits an un‑encoded ayah as "reviewed" (strength ~18, no gate), corrupting the shared atom model that all personas read. **Fix:** gap guard — refuse or bridge‑skip un‑encoded atoms; bound chains to the real ayah count. **Status: fixed in Phase 0** — see v2‑D35 (guard applied in both `chain.ts` and the live `rebuild.ts` chain_step fold, with regression tests).

---

## Open — awaiting the user (not yet decided)

- **v2‑O1 — Half‑life tooltip on the admin console too?** (operator audience — raw term may be fine.) _Raised 2026‑07‑15 21:52 UTC._ **Resolved 2026‑07‑16 — see v2‑D58 (no).**
- **v2‑O2 — Scaffold v2 now?** The design corpus is complete (screens, onboarding, admin, ecosystem, atomic map, scenarios, decisions, Test, recording/progress). Awaiting "scaffold v2" to begin the real React + Laravel project. **Resolved 2026‑07‑16 — see v2‑D32.**

---

## Design artifacts produced (reference)

Published design artifacts backing these decisions (claude.ai/code/artifact/…):
screens & workflow · onboarding · admin console · training ecosystem · atomic function
map · scenario planning · decision table · Test feature · recording & Progress Report.
_(URLs live in the conversation; not reproduced here as they're session‑scoped.)_
