// System-Explorer graph data — v2-D26 / VISUALIZE.md.
//
// Every identifier here is HARVESTED from the real codebase, not invented:
//   - v1/apps/worker/migrations/0001_init.sql .. 0003_structured.sql  (events/users columns)
//   - v1/apps/web/src/db/eventLog.ts                                  (IndexedDB "iman-events"/"events")
//   - v1/apps/web/src/sync/outbox.ts, sync/auth.ts                    (flush/hydrate, credentials:'include')
//   - v1/packages/engine/src/*.ts                                     (rebuild/assembleQueue/strength/…)
//   - v2/DECISIONS.md                                                 (v2-D09/D11/D14/D17/D21/D22 etc.)
//
// The v2 backend is Laravel (v2-D01/D03), superseding v1's Cloudflare Worker + D1.
// Column names are carried forward from the shipped v1 events table; the two v2
// additions (mode, question_overrides) are marked as such per DECISIONS.md.

export type NodeCategory =
  | "db-truth" // source-of-truth persistence (append-only events)
  | "db-cache" // rebuildable / derived cache (NOT source of truth)
  | "actor-human" // blue circle — a person
  | "actor-system" // amber diamond — automated/system agent
  | "ingress" // green rect — a user action → event
  | "egress" // red rect — sync / side-effect / computed output
  | "engine"; // pure ported v1 function (../v1/packages/engine)

export interface SchemaField {
  name: string;
  type: string;
  note?: string;
}

export interface ExplorerNode {
  id: string;
  label: string;
  category: NodeCategory;
  /** One-line role, shown under the title in the inspector. */
  summary: string;
  /** DECISIONS.md ids or source paths this node is grounded in. */
  refs: string[];
  /** Real schema / structural shape (table columns, event fields, store keys). */
  schema?: SchemaField[];
  /** Real code signature (function name + params → return). */
  signature?: string;
  /** Source file the identifier was harvested from. */
  source?: string;
  /** structured:false surfaces (Test / victory-lap) — recorded, non-mutating (v2-D11/D14). */
  nonMutating?: boolean;
}

export type EdgeKind =
  | "learn" // teal — the learning / strength path
  | "sideEffect" // coral — error / side-effect edge
  | "actor" // amber — actor / consistency edge
  | "nonMutating" // dashed purple — recorded but does NOT mutate strength
  | "neutral"; // slate — plumbing

export interface ExplorerEdge {
  from: string;
  to: string;
  label: string;
  kind: EdgeKind;
}

// ─────────────────────────────────────────────────────────────────────────────
// NODES
// ─────────────────────────────────────────────────────────────────────────────

export const NODES: ExplorerNode[] = [
  // ── 1. DATA RELATIONS ──────────────────────────────────────────────────────
  {
    id: "tbl_events",
    label: "events (Laravel)",
    category: "db-truth",
    summary: "Append-only truth. Every action is one immutable row (v2-D18).",
    refs: ["v2-D04", "v2-D18"],
    source: "v1/apps/worker/migrations/0001_init.sql (+0002,+0003) → ported to Laravel (v2-D01)",
    schema: [
      { name: "id", type: "TEXT PRIMARY KEY", note: "client-generated uuid → idempotency key" },
      { name: "user_id", type: "INTEGER NOT NULL", note: "FK → users(id); from session, never body" },
      { name: "type", type: "TEXT NOT NULL", note: "event type (reconstruct_tap, review_outcome, …)" },
      { name: "ts", type: "INTEGER NOT NULL", note: "client event time (ms)" },
      { name: "surah", type: "INTEGER" },
      { name: "ayah", type: "INTEGER" },
      { name: "position", type: "INTEGER", note: "word position for a tap" },
      { name: "correct", type: "INTEGER (0/1)" },
      { name: "latency", type: "INTEGER", note: "item-shown → tap ms (v0.6)" },
      { name: "structured", type: "INTEGER (0/1/NULL)", note: "0 = Test/victory-lap (non-mutating); NULL = legacy default true" },
      { name: "mode", type: "TEXT", note: "v2 add: Steady/Sprint/Maintain at event time (v2-D09)" },
      { name: "to_ayah", type: "INTEGER", note: "'to' — n+1 for connection/junction/chain" },
      { name: "received_at", type: "INTEGER NOT NULL", note: "server ingest time" },
    ],
  },
  {
    id: "tbl_users",
    label: "users (Laravel)",
    category: "db-truth",
    summary: "Account identity. Sanctum-authed; anonymous-first with adoption (v2-D03).",
    refs: ["v2-D03", "v2-D12"],
    source: "v1/apps/worker/migrations/0001_init.sql → Laravel + Sanctum",
    schema: [
      { name: "id", type: "INTEGER PRIMARY KEY" },
      { name: "google_sub / provider", type: "TEXT UNIQUE", note: "social sign-in subject" },
      { name: "email", type: "TEXT" },
      { name: "created_at", type: "INTEGER" },
    ],
  },
  {
    id: "tbl_question_overrides",
    label: "question_overrides (Laravel)",
    category: "db-truth",
    summary: "Editor override layer. Overrides win over auto-generated questions (v2-D21).",
    refs: ["v2-D21", "v2-D22", "DATA-1"],
    source: "v2 NEW table (v2-D21) — no v1 equivalent (v1 admin was read-only)",
    schema: [
      { name: "ayah", type: "INTEGER", note: "composite key part" },
      { name: "position", type: "INTEGER", note: "composite key part" },
      { name: "type", type: "TEXT", note: "question-type — composite key part (ayah·position·type)" },
      { name: "gloss", type: "TEXT", note: "corrected gloss (qari edit)" },
      { name: "distractors", type: "JSON", note: "curated/swapped distractors" },
      { name: "group", type: "JSON", note: "multi-word gloss grouping (DATA-1)" },
      { name: "disabled", type: "BOOLEAN", note: "disable a bad generated question" },
      { name: "custom", type: "TEXT", note: "hand-written question, overrides generator" },
    ],
  },
  {
    id: "idb_eventlog",
    label: "IndexedDB: iman-events / events",
    category: "db-truth",
    summary: "On-device mirror of events. Local-first: written BEFORE feedback (v2-D18).",
    refs: ["v2-D18", "local-first"],
    source: "v1/apps/web/src/db/eventLog.ts",
    schema: [
      { name: "DB_NAME", type: '"iman-events"' },
      { name: "STORE", type: '"events"', note: "keyPath: seq, autoIncrement" },
      { name: "index", type: '"synced"', note: "0 = unsynced, 1 = acked by /events" },
      { name: "…DrillEvent fields", type: "id, seq, type, ts, surah, ayah, position, correct, latency, structured, to, …" },
    ],
    signature:
      "append(event: DrillEvent): Promise<number>  ·  getUnsynced(): Promise<StoredEvent[]>  ·  mergeFromServer(events): Promise<number>  ·  markSynced(ids: string[])",
  },
  {
    id: "cache_atoms",
    label: "atoms map (rebuildable cache)",
    category: "db-cache",
    summary: "Derived strength/band/gate per ayah. NOT truth — folded from events by rebuild().",
    refs: ["invariant #2", "v2-D18"],
    source: "v1/packages/engine/src/atom.ts · rebuild.ts",
    schema: [
      { name: "kind", type: '"ayah" | "connection"' },
      { name: "ref", type: "number", note: "ayah number (or 'from' for a connection)" },
      { name: "strength", type: "number 0–100", note: "<40 learn · <80 reinforce · ≥80 carry" },
      { name: "stability", type: "number", note: "FSRS-shaped, in learning-days" },
      { name: "difficulty", type: "number 0–1" },
      { name: "lastRetrieval", type: "number | null" },
      { name: "reps / lapses", type: "number" },
      { name: "encoded", type: "boolean", note: "S3 whole-bank done → gate eligible" },
      { name: "gateDueAt", type: "number | null" },
      { name: "gatePassed", type: "boolean" },
    ],
    signature: "AtomsMap = Map<string, AtomState>  (key = atomKey('ayah', ayah))",
  },

  // ── 2. AGENTS & ACTORS ─────────────────────────────────────────────────────
  {
    id: "actor_learner",
    label: "Learner",
    category: "actor-human",
    summary: "Taps to reconstruct the ayah; each tap produces an event (v2-D05).",
    refs: ["v2-D05", "v2-D04"],
    source: "v1/apps/web/src/drills/*, session/useSession.ts",
  },
  {
    id: "actor_qari",
    label: "Qari / scholar editor",
    category: "actor-human",
    summary: "Edits the question-bank override layer in a non-technical UI (v2-D22).",
    refs: ["v2-D22", "v2-D21", "GATE-A"],
    source: "v2 admin override editor (v2-D22)",
  },
  {
    id: "actor_operator",
    label: "Operator / admin",
    category: "actor-human",
    summary: "Reads the behaviour console — READ-ONLY retention KPIs (v2-D17).",
    refs: ["v2-D17"],
    source: "v2 Admin/behaviour console (v2-D17), separate from learner Progress Report",
  },
  {
    id: "agent_sync",
    label: "Sync agent",
    category: "actor-system",
    summary: "Flushes the local outbox to Laravel on focus/online. Idempotent by event id.",
    refs: ["v2-D18", "local-first"],
    source: "v1/apps/web/src/sync/outbox.ts",
    signature:
      "flush(signedIn: boolean): Promise<number>  →  POST /events {credentials:'include'}  ·  hydrate(signedIn): Promise<number>  →  GET /events",
  },
  {
    id: "agent_qgen",
    label: "Question generator",
    category: "actor-system",
    summary: "Builds questions from the corpus at build-time; overrides win (v2-D21/D23).",
    refs: ["v2-D21", "v2-D23"],
    source: "v1/packages/engine/src/corpus.ts (distractorsFor)",
    signature:
      "distractorsFor(corpus: Corpus, ayah: number, position: number, …): CorpusDistractor[]  ·  ayahWords(corpus, ayah): CorpusWord[]",
  },
  {
    id: "agent_scheduler",
    label: "Scheduler (assembleQueue)",
    category: "actor-system",
    summary: "Moded planner (Steady/Sprint/Maintain) that builds today's queue from atoms (v2-D09).",
    refs: ["v2-D09", "v2-BUG-1"],
    source: "v1/packages/engine/src/scheduler.ts",
    signature:
      "assembleQueue(input: AssembleInput): QueueItem[]  —  { atoms, now, lastActiveDay, wordCounts, cfg:{ budgetMin, connectionWeight, learnCandidates } }",
  },

  // ── 3. E2E IN & OUT — INGRESS (user action → event) ────────────────────────
  {
    id: "ev_reconstruct_tap",
    label: "reconstruct_tap",
    category: "ingress",
    summary: "A tap placing a word during tap-to-reconstruct (v2-D05). Graded.",
    refs: ["v2-D05", "v2-D18"],
    source: "v2 event type (v2-D18); v1 base type 'tap' (types.ts EventType)",
    schema: [
      { name: "type", type: '"reconstruct_tap"' },
      { name: "ayah / position", type: "number", note: "which word slot" },
      { name: "choice", type: "string", note: "tapped word (Arabic surface / gloss)" },
      { name: "correct", type: "boolean" },
      { name: "latency", type: "number", note: "shown → tap ms" },
    ],
  },
  {
    id: "ev_ayah_produced",
    label: "ayah_produced",
    category: "ingress",
    summary: "Whole ayah rebuilt from blank — the encode signal (v2-D05/D18).",
    refs: ["v2-D18", "v2-D05"],
    source: "v2 event type (v2-D18); rolls up like v1 rung_complete(S3)/ayah_complete",
    schema: [
      { name: "type", type: '"ayah_produced"' },
      { name: "ayah", type: "number" },
      { name: "rung", type: '"S3"', note: "whole-bank produced → encoded → schedule day-1 gate" },
    ],
  },
  {
    id: "ev_review_outcome",
    label: "review_outcome",
    category: "ingress",
    summary: "A due-review retrieval result — moves strength (v2-D18).",
    refs: ["v2-D18"],
    source: "v2 event type (v2-D18)",
    schema: [
      { name: "type", type: '"review_outcome"' },
      { name: "ayah", type: "number" },
      { name: "correct", type: "boolean", note: "graded → update() applies strength delta" },
    ],
  },
  {
    id: "ev_gate_result",
    label: "gate_result",
    category: "ingress",
    summary: "Day-1 cold-gate attempt outcome; drives encoded→carried (v2-D07/D08).",
    refs: ["v2-D07", "v2-D08"],
    source: "v1/packages/engine/src/types.ts (EventType 'gate_result')",
    schema: [
      { name: "type", type: '"gate_result"' },
      { name: "ayah", type: "number" },
      { name: "correct", type: "boolean", note: "pass/fail → applyGateResult()" },
    ],
  },
  {
    id: "ev_chain_step",
    label: "chain_step",
    category: "ingress",
    summary: "One traversed step of a chain. Default victory-lap = structured:false (v2-D11).",
    refs: ["v2-D11"],
    source: "v1/packages/engine/src/types.ts (EventType 'chain_step')",
    nonMutating: true,
    schema: [
      { name: "type", type: '"chain_step"' },
      { name: "ayah (from) / to", type: "number", note: "n → n+1 traversal" },
      { name: "stepKind", type: '"ayah" | "junction"' },
      { name: "structured", type: "false", note: "victory-lap: streak/heatmap only, NO strength change" },
    ],
  },
  {
    id: "ev_test",
    label: "test_start / test_answer / test_result",
    category: "ingress",
    summary: "Self-initiated Test over a proficient range. Read-only mirror (v2-D13/D14).",
    refs: ["v2-D13", "v2-D14", "v2-D15"],
    source: "v2 event types (v2-D18)",
    nonMutating: true,
    schema: [
      { name: "type", type: '"test_start" | "test_answer" | "test_result"' },
      { name: "structured", type: "false", note: "scores + flags weak spots; does NOT move strength or due-dates" },
      { name: "range", type: "ayat span", note: "defaults to carried (≥80), overridable (v2-D15)" },
    ],
  },
  {
    id: "ev_mode_change",
    label: "mode_change",
    category: "ingress",
    summary: "Learner switches pace mode mid-surah (v2-D09).",
    refs: ["v2-D09"],
    source: "v2 event type (v2-D18)",
    schema: [
      { name: "type", type: '"mode_change"' },
      { name: "to", type: '"Steady" | "Sprint" | "Maintain"' },
    ],
  },
  {
    id: "ev_session",
    label: "session_start / session_end",
    category: "ingress",
    summary: "App-open → first drill; latency = open-into-drill ms (v0.8).",
    refs: ["v2-D18"],
    source: "v1/packages/engine/src/types.ts (EventType 'session_start')",
    schema: [
      { name: "type", type: '"session_start" | "session_end"' },
      { name: "latency", type: "number", note: "open → first drill ms" },
    ],
  },

  // ── 3. E2E IN & OUT — EGRESS / side-effects & computed outputs ──────────────
  {
    id: "eg_laravel_events",
    label: "POST /events (Laravel)",
    category: "egress",
    summary: "Batch insert into the append-only events table. Idempotent by id.",
    refs: ["v2-D18", "v2-D01"],
    source: "v1/apps/web/src/sync/outbox.ts → Laravel retention API (v2-D01)",
    signature: "POST /events  {events: WireEvent[]}  credentials:'include'  → 2xx acks → markSynced(ids)",
    schema: [
      { name: "method", type: "POST" },
      { name: "body", type: "{ events: WireEvent[] }", note: "user_id from session cookie, never body" },
      { name: "auth", type: "Sanctum session cookie" },
      { name: "hydrate", type: "GET /events", note: "server→client pull, merge by id (fresh device)" },
    ],
  },
  {
    id: "eg_sanctum",
    label: "Sanctum session cookie",
    category: "egress",
    summary: "HttpOnly session cookie set at sign-in; no tokens stored client-side (v2-D03).",
    refs: ["v2-D03"],
    source: "v1/apps/web/src/sync/auth.ts (credentials:'include') → Laravel Sanctum (v2-D03)",
    schema: [
      { name: "set by", type: "POST /auth/* (social credential)" },
      { name: "storage", type: "HttpOnly cookie", note: "sent via credentials:'include'; no JS-readable token" },
    ],
  },
  {
    id: "out_strength",
    label: "strength / streak (computed)",
    category: "egress",
    summary: "Derived outputs — currentStrength & computeStreak read the atoms cache.",
    refs: ["v2-D18"],
    source: "v1/packages/engine/src/strength.ts · streak.ts",
    signature:
      "currentStrength(atom, now, cfg?): number  ·  retrievability(atom, now): number  ·  computeStreak(dayIndices, …): StreakState",
  },
  {
    id: "out_progress_report",
    label: "Progress Report (learner)",
    category: "egress",
    summary: "Warm learner surface: growth curve, 111-ayah map, streak, Test history (v2-D17).",
    refs: ["v2-D17", "v2-D19", "v2-D24", "v2-D25"],
    source: "v2 Progress Report (v2-D17); heatmap from engine ayahHeatmap()",
    signature: "ayahHeatmap(...): HeatmapRow[]  ·  ring = 12 movements (v2-D24) ⇄ flat 1→111 grid (v2-D25)",
  },
  {
    id: "out_admin_metrics",
    label: "Admin behaviour metrics",
    category: "egress",
    summary: "Dense operator KPIs: retention, forgetting curve, per-user drill-down (v2-D17).",
    refs: ["v2-D17"],
    source: "v2 Admin/behaviour console (v2-D17) — same event stream, different audience",
    signature: "forgettingRisk(atom, now): number feeds the forgetting-curve KPI",
  },

  // ── SHARED ENGINE (the pure ported v1 functions) ───────────────────────────
  {
    id: "engine_rebuild",
    label: "engine.rebuild()",
    category: "engine",
    summary: "Folds the ordered event stream into the atoms cache. Pure (invariant #2).",
    refs: ["invariant #2"],
    source: "v1/packages/engine/src/rebuild.ts",
    signature: "rebuild(events: DrillEvent[], cfg?: DayConfig): AtomsMap  —  update() is the single strength-math source",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// EDGES — directed 'to' arrows tracing the exact data flightpath
// ─────────────────────────────────────────────────────────────────────────────

export const EDGES: ExplorerEdge[] = [
  // Canonical learning loop (teal) ────────────────────────────────────────────
  { from: "actor_learner", to: "ev_reconstruct_tap", label: "tap", kind: "learn" },
  { from: "ev_reconstruct_tap", to: "idb_eventlog", label: "commit (local-first)", kind: "learn" },
  { from: "ev_ayah_produced", to: "idb_eventlog", label: "commit", kind: "learn" },
  { from: "ev_review_outcome", to: "idb_eventlog", label: "commit", kind: "learn" },
  { from: "ev_gate_result", to: "idb_eventlog", label: "commit", kind: "learn" },
  { from: "ev_mode_change", to: "idb_eventlog", label: "commit", kind: "learn" },
  { from: "ev_session", to: "idb_eventlog", label: "commit", kind: "learn" },

  { from: "idb_eventlog", to: "agent_sync", label: "getUnsynced()", kind: "actor" },
  { from: "agent_sync", to: "eg_laravel_events", label: "flush() POST /events", kind: "actor" },
  { from: "eg_sanctum", to: "eg_laravel_events", label: "authenticates", kind: "actor" },
  { from: "actor_learner", to: "eg_sanctum", label: "signs in", kind: "actor" },
  { from: "eg_laravel_events", to: "tbl_events", label: "insert (idempotent by id)", kind: "learn" },
  { from: "tbl_events", to: "tbl_users", label: "user_id FK", kind: "neutral" },

  { from: "tbl_events", to: "engine_rebuild", label: "rebuild(events)", kind: "learn" },
  { from: "idb_eventlog", to: "engine_rebuild", label: "rebuild(events) [offline]", kind: "learn" },
  { from: "engine_rebuild", to: "cache_atoms", label: "folds → atoms", kind: "learn" },
  { from: "cache_atoms", to: "out_strength", label: "computes", kind: "learn" },
  { from: "out_strength", to: "out_progress_report", label: "renders", kind: "learn" },
  { from: "out_strength", to: "out_admin_metrics", label: "aggregates", kind: "learn" },

  // Scheduler loop (amber actor) ───────────────────────────────────────────────
  { from: "agent_scheduler", to: "cache_atoms", label: "reads atoms", kind: "actor" },
  { from: "agent_scheduler", to: "actor_learner", label: "assembles today's queue", kind: "actor" },

  // Question bank (amber actor) ────────────────────────────────────────────────
  { from: "actor_qari", to: "tbl_question_overrides", label: "edits", kind: "actor" },
  { from: "tbl_question_overrides", to: "agent_qgen", label: "overrides win", kind: "actor" },
  { from: "agent_qgen", to: "actor_learner", label: "served question", kind: "actor" },

  // Admin read-only (amber) ────────────────────────────────────────────────────
  { from: "out_admin_metrics", to: "actor_operator", label: "reads (read-only)", kind: "actor" },
  { from: "out_progress_report", to: "actor_learner", label: "reads", kind: "learn" },

  // structured:false — recorded but does NOT mutate strength (dashed purple) ────
  { from: "actor_learner", to: "ev_chain_step", label: "victory-lap recite", kind: "nonMutating" },
  { from: "actor_learner", to: "ev_test", label: "runs Test", kind: "nonMutating" },
  { from: "ev_chain_step", to: "idb_eventlog", label: "commit (structured:false)", kind: "nonMutating" },
  { from: "ev_test", to: "idb_eventlog", label: "commit (structured:false)", kind: "nonMutating" },

  // Side-effect / non-mutation guard (coral) ───────────────────────────────────
  { from: "ev_chain_step", to: "cache_atoms", label: "does NOT mutate strength", kind: "sideEffect" },
  { from: "ev_test", to: "cache_atoms", label: "does NOT move strength / due-dates", kind: "sideEffect" },
];
