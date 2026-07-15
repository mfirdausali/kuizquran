# v2/VISUALIZE.md — System Explorer (living architecture map)

A refined, project-accurate prompt for generating an interactive **System Explorer**:
a graph dashboard of iman.app v2's real infrastructure — its data relations, actors,
and end-to-end flightpaths. Use this prompt with Claude Code from the `kuizquran/v2/`
root once v2 is scaffolded (or now, in fallback mode — see §Fallback).

> **Why this file exists.** The original draft of this prompt assumed a **Next.js**
> app harvesting existing `schemas/routes/services`. Neither matches us: v2's stack is
> **React (Vite) + Laravel** (ADR `DECISIONS.md` → **v2‑D01, v2‑D03**), and v2 is
> **not scaffolded yet** (`v2‑O2` open). This prompt is corrected to our reality and
> logged as **v2‑D26**. Keep it in sync with `DECISIONS.md`.

---

## The prompt (paste into Claude Code, run from `kuizquran/v2/`)

```
Analyze our local codebase to build an interactive, living-documentation dashboard —
a "System Explorer" that maps iman.app v2's real infrastructure as a physics graph.

STACK (authoritative — from our ADR, v2/DECISIONS.md):
- Frontend: React + Vite (NOT Next.js — that was a draft error). Vitest for tests.
- Backend: Laravel (Sanctum auth, the append-only events table, the retention API).
- Shared engine: v1's pure, tested retention functions ported into the React app
  (../v1/packages/engine — strength/decay/scheduling/corpus).
- Local-first: every action commits to on-device storage BEFORE feedback, then syncs.

Generate the dashboard as a client-side React route:
- If a router exists, add `src/routes/system-explorer.tsx` (or wire it into the
  existing route table). Otherwise create `src/pages/SystemExplorer.tsx` and a dev-only
  entry so it renders at `/system-explorer`.
- It must be client-side and self-contained; no server round-trip to render the graph.

This dashboard fulfils our alignment agreements and adheres to DECISIONS.md.

[VISUALIZATION LIBRARY]
- Use vis-network (Vis.js) for the physics graph; D3.js is an acceptable alternative.
- If vis-network / lucide-react (icons) are missing from package.json, print the exact
  install commands and, if permitted, run them:
      npm i vis-network vis-data lucide-react
  (Do NOT add a Next.js dependency — we are Vite + React.)

[VISUAL LAYOUT]
- Split-screen. LEFT: a full-bleed graph canvas on a slate-900 (#0f172a) background,
  with physics stabilization and draggable nodes. RIGHT: a collapsible
  "Context Inspector & Payload Panel" that, on node click, shows that node's real
  schema / structural properties / code signature (function name, table columns,
  event fields, endpoint shape).
- Honour our design language where it doesn't fight legibility: Amiri only if an ayah
  literally appears; teal (#1d9e75) for the learning/strength path; coral (#d85a30)
  ONLY for error/side-effect edges; amber (#ba7517) for actors/consistency.

[THE THREE DATA DIMENSIONS — mapped to OUR real entities, not generic ones]

1. DATA RELATIONS  (shape: pink cylinders / database nodes)
   Our persistence + derived state. Harvest the REAL names:
   - Laravel: the `events` table (append-only truth) with its real columns
     (id, user_id, type, ts, ayah, position, correct, latency, structured, mode, to,
     received_at), the `users` table, and the v2 `question_overrides` table
     (keyed by ayah · position · type — v2‑D21).
   - Client: the IndexedDB event log (the local mirror of `events`).
   - Derived/rebuildable caches (NOT source of truth): the atoms map
     (strength/band/gate per ayah), computed by ../v1/packages/engine's rebuild().
   Mark source-of-truth (events) vs rebuildable cache (atoms) distinctly.

2. AGENTS & ACTORS  (blue circles = humans; amber diamonds = automated/system)
   Harvest our REAL actors, not placeholders:
   - Learner (blue) — taps produce events.
   - Qari / scholar editor (blue) — edits the question bank overrides (v2‑D22).
   - Operator / admin (blue) — reads the behaviour console (read-only).
   - Sync agent (amber diamond) — flushes the local outbox to Laravel on
     focus/online, idempotent by event id.
   - Question generator (amber diamond) — builds questions from the corpus at
     question-build time; overrides win (v2‑D21).
   - Scheduler (amber diamond) — the moded assembleQueue (Steady/Sprint/Maintain,
     v2‑D09) that plans the day from atoms.

3. E2E IN & OUT  (green rectangles = ingress; red rectangles = egress/side-effects)
   Trace the REAL flightpaths, using our actual event-type names:
   - INGRESS: a user action → an event (reconstruct_tap, ayah_produced,
     review_outcome, gate_result, chain_step, test_start/answer/result, mode_change,
     session_start/end). Read-only surfaces (Test, victory-lap chains) carry
     structured:false and MUST be visually flagged as non-mutating (v2‑D14, v2‑D11).
   - EGRESS / side-effects: sync → Laravel events insert; the Sanctum session cookie;
     the computed outputs — strength update, streak, the learner Progress Report
     (v2‑D17), and the admin behaviour metrics.

[EDGES — directed 'to' arrows tracing the exact data flightpath]
Model the canonical loop as directed edges, e.g.:
   Learner ──tap──▶ reconstruct_tap (event) ──commit──▶ IndexedDB log
     ──flush(Sync)──▶ Laravel /events (Sanctum) ──insert──▶ events table
     ──rebuild(engine)──▶ atoms cache ──computes──▶ strength / streak
     ──renders──▶ Progress Report  ·and·  Admin metrics
   Qari ──edits──▶ question_overrides ──(overrides win)──▶ Question generator ──▶ served question
   Scheduler ──reads──▶ atoms ──assembles──▶ today's queue ──▶ Learner
Colour a structured:false path (Test / victory-lap) distinctly so it reads as
"recorded, but does NOT mutate strength."

[EXECUTION STEPS]
1. Scan the workspace for REAL names — Laravel migrations/models/controllers, the React
   src (routes, hooks, sync/outbox, db/eventLog), and ../v1/packages/engine exports.
   Do NOT invent generic mock strings; use the actual identifiers.
2. If a needed dep is missing, print (and, if permitted, run) the npm install command.
   Never introduce Next.js.
3. Build the React component: nodes for the harvested infrastructure, directed edges for
   the flightpaths above, physics stabilization, draggable nodes, and the right-side
   Context Inspector that shows a clicked node's real schema/signature.
4. Confirm the local route/path once it compiles, and print how to view it
   (e.g. `npm run dev` → open /system-explorer).

Generate the file now and confirm its local path once the build is ready.
```

---

## Fallback — v2 is not scaffolded yet

`v2‑O2` (scaffold v2) is still open, so there may be no `src/` or Laravel app to scan.
In that case, instruct the tool to **build the graph from the design corpus instead of
live code**, so it's useful today and becomes live-accurate after scaffolding:

- Source the nodes/edges from: this repo's **`v2/DECISIONS.md`** (the ADR), the v1
  engine exports (`../v1/packages/engine/src/index.ts`) for the retention functions,
  and the v1 worker for the real event schema (`../v1/apps/worker/src/db.ts`,
  `types.ts`) and metrics (`../v1/apps/worker/src/metrics.ts`).
- Emit a single typed data file (e.g. `system-graph.ts`) — `{ nodes, edges }` with the
  real names above — that the React page renders. When v2 is scaffolded, a scan step
  replaces the hand-seeded data file with harvested identifiers; the page component
  stays the same.

This keeps the visualization **data-driven** (v2‑D18 spirit: everything computed from a
described source), so scaffolding later swaps the data, not the UI.

---

## Guardrails (must hold)

- **Never Next.js.** Our stack is React + Vite + Laravel (v2‑D01/D03). Any generated
  code, dep, or path assuming Next.js is a defect.
- **Real names only.** Harvest actual identifiers (event types, table columns, engine
  fn names); no generic mock strings (execution step 1).
- **Truth vs cache.** `events` (Laravel + IndexedDB) is append-only source of truth;
  `atoms` is a rebuildable cache — the graph must distinguish them (invariant #2).
- **Flag non-mutating paths.** `structured:false` flows (Test, victory-lap chains) are
  recorded but never move strength — colour them so that reads at a glance
  (v2‑D11, v2‑D14).
- **Read-only where v1 was.** The admin/behaviour console is read-only; only the
  question-bank editor writes (v2‑D21/D22), and those edges should be marked as the
  admin's sanctioned write path.
- Respect `prefers-reduced-motion` (pause physics), keyboard focus on nodes, and the
  CSP if this ever ships as an artifact (inline everything; no external hosts).

_Logged as v2‑D26. Keep this file in step with DECISIONS.md as the architecture evolves._
