# Kuiz Quran — Engineering Complexity, End to End

_How hard is the real thing — auth, per-user data, scheduling, sync, scale — from prototype to completion?_

**Short answer:** the *content* is done and the *hard-looking* part (the SRS math, the MCQ engine)
is medium difficulty. The genuinely hard part is what makes it a **Memory OS rather than a quiz**:
capturing every recall event per user, forever, reliably, and turning that data into a scheduler
that improves. That's a data-engineering problem, not a UI one.

Complexity is rated per component: 🟢 easy · 🟡 medium · 🔴 hard.

---

## 1 · The layers, and what each demands

```
   ┌─────────────────────────────────────────────────────────────┐
   │  CLIENT (the app the learner taps)                            │  🟡
   │  screens, MCQ rendering, offline queue, RTL Arabic            │
   ├─────────────────────────────────────────────────────────────┤
   │  AUTH & IDENTITY                                              │  🟡
   │  who is this? attach every event to one durable account      │
   ├─────────────────────────────────────────────────────────────┤
   │  API / BACKEND                                                │  🟡
   │  serve cards, accept recall events, run the scheduler         │
   ├─────────────────────────────────────────────────────────────┤
   │  CONTENT DB (shared, read-mostly)                             │  🟢
   │  surah · act · ayah · word · card · distractor_pool          │
   ├─────────────────────────────────────────────────────────────┤
   │  PER-USER STATE (read+write, the heart)                      │  🔴
   │  user_card_state · user_act_progress · streak · session     │
   ├─────────────────────────────────────────────────────────────┤
   │  EVENT LOG (append-only, the product/moat)                   │  🔴
   │  review — every tap, forever, immutable                      │
   ├─────────────────────────────────────────────────────────────┤
   │  SCHEDULER (FSRS-implicit)                                    │  🟡
   │  grade from correctness+latency → next due date              │
   ├─────────────────────────────────────────────────────────────┤
   │  SYNC & OFFLINE                                               │  🔴
   │  study on the LRT with no signal → reconcile later           │
   └─────────────────────────────────────────────────────────────┘
```

---

## 2 · AUTH & IDENTITY — 🟡 medium (but decide early)

The whole product premise is "your memory, tracked over years." That means **every recall event
must attach to one durable account** from day one. You cannot bolt this on later without losing the
early data (which is the asset).

**What's needed**
- Email/password + social login (Google/Apple — Apple is mandatory if you ship iOS).
- Email verification, password reset, session tokens (JWT or server sessions).
- **Guest → account upgrade**: let someone try a scene before signing up, then migrate their few
  events into a real account (reduces onboarding friction for the casual ICP).
- Later: **household/roles** — a parent linked to a child's account (read-only dashboard), a teacher
  linked to a class. This is a real modelling task, not a checkbox.

**Complexity drivers**
- 🟢 With Laravel: **Sanctum** (API tokens) or **Fortify/Breeze** gives you 80% out of the box.
- 🟡 Social login (Socialite) + Apple Sign-In review requirements.
- 🟡 Guest-account merge logic (edge cases: same email, duplicate progress).
- 🔴 (later) multi-tenant roles for teacher/institution — deferred to Stage 3.

**Verdict:** a well-trodden path. Use the framework's auth; don't hand-roll. The only *design*
decision that matters now: **accounts from day one, guest-trial optional.**

---

## 3 · PER-USER DATA STORAGE — 🔴 the hard core

This is where the difficulty actually lives. Two very different kinds of per-user data:

### 3a · Mutable memory state (`user_card_state`)
One row **per user, per card**. For Surah Yusuf that's **1,777 rows per user**. Each row holds the
FSRS state (stability, difficulty, due_at, reps, lapses, tier, personal median latency).

```
  10,000 users × 1,777 cards            = ~18 million state rows   (Yusuf only)
  + more surahs later                    → tens of millions
  hot path: "what's due for THIS user now?" → indexed query on (user_id, due_at)
```
- 🟡 The schema is simple; the **volume and the hot query** are what need care (indexing,
  partitioning by user as you grow).
- 🟡 Every answer **writes** to this row (state changes). High write throughput.

### 3b · Immutable event log (`review`) — the product itself
One row **per tap, forever**. This is the "data is the product" asset.

```
  20,000 users × 40 recalls/day          = 800,000 rows/day
  1 year                                 ≈ 300 million rows
  → this table only ever grows; never updated, never deleted
```
- 🔴 This is a **big-data table**. Options escalate with scale:
  - early: same Postgres, a partitioned/append-only table.
  - later: stream to a warehouse (BigQuery / ClickHouse) for the analytics + model training,
    keep Postgres lean for the hot path.
- 🔴 You must get the **event schema right on day one** — you can't recover latency/distractor/
  time-of-day for events you logged thinly. Rich events from the first tap.

**Verdict:** the *code* to write a row is trivial. The *discipline* — capturing rich events,
never losing them, and keeping the hot per-user query fast as rows hit the hundreds of millions —
is the real engineering. This is normal for a data product, but it is genuinely 🔴.

---

## 4 · THE SCHEDULER (FSRS-implicit) — 🟡 medium

Given a recall event, compute the grade (from correctness + latency) and the next due date.

- 🟢 FSRS is **open-source** with reference implementations; you don't invent the math.
- 🟡 The *implicit grading* (latency → Again/Hard/Good/Easy vs personal median) is custom but small.
- 🟡 The *question-tier escalation* (T1→T5) layered on top is your own logic.
- 🟢 It's a pure function: `(state, answer) → (new_state, due_at)`. Easy to unit-test.
- 🔴 (Stage 5, far later) replacing FSRS with a **learned model** trained on your event log — this is
  the moat, and it's a real ML project. **Not needed to launch.** FSRS is plenty for v1.

**Verdict:** medium now, because you adapt (not invent) FSRS. The learned-model upgrade is a
future research effort, deliberately deferred.

---

## 5 · SYNC & OFFLINE — 🔴 hard (and easy to underestimate)

Your own day-in-the-life has Danish studying **on the LRT with no signal**. That means the app must
work offline and reconcile later — the classic hard problem of any serious learning app.

**What's needed**
- Cache the user's due cards + content locally on the device.
- Queue recall events offline; replay them when connectivity returns.
- **Conflict resolution**: the same card studied on phone + tablet before either synced. The
  append-only event log helps (events are commutative-ish), but `user_card_state` must be
  recomputed deterministically by **replaying events in timestamp order** — not last-write-wins.

**Complexity drivers**
- 🔴 Offline-first is a known-hard category. Doing it well is a meaningful chunk of the build.
- 🟡 *Mitigation:* v1 can be **online-first** (require connectivity, cache read-only content only).
  Full offline sync is a Phase-2 feature. Be honest that "works on the subway" is not free.

**Verdict:** the single most under-estimated piece. Recommend **online-first for v1**, offline sync
as a fast follow — but design the event log now so offline replay is possible later.

---

## 6 · SCALE — where numbers bite

| Metric | 1k users | 20k users | 200k users |
|---|---:|---:|---:|
| `user_card_state` rows (Yusuf) | ~1.8M | ~35M | ~355M |
| `review` events / day | ~40k | ~800k | ~8M |
| `review` events / year | ~15M | ~300M | ~3B |
| DB shape | single Postgres 🟢 | Postgres + partitioning 🟡 | Postgres hot path + warehouse 🔴 |

- 🟢 **Up to a few thousand users**, a single managed Postgres + a normal web app handles everything.
  Don't over-engineer for scale you don't have.
- 🟡 Growth pain is **the review table and the "due now" query**, not traffic. Solve with indexing,
  partitioning, and moving analytics off the hot DB — standard moves, applied when the numbers demand.

---

## 7 · The honest build sequence (crawl → walk → run)

```
  ┌── PHASE A · PROTOTYPE ─────────────────────────────── weeks ──┐  effort: 🟢🟡
  │ • Content DB seeded from data/*.json (done — just import)      │
  │ • Simple auth (framework default)                             │
  │ • Play screen: Story Map → Scene → MCQ loop (the wireframe)   │
  │ • FSRS-implicit scheduler, online-only                        │
  │ • Write EVERY recall event richly from day one  ← non-neg     │
  │ Goal: real people, real data. KPI = D30 retention.            │
  └───────────────────────────────────────────────────────────────┘
  ┌── PHASE B · REAL PRODUCT ─────────────────────── 2–4 months ──┐  effort: 🟡🔴
  │ • Robust auth (social, guest-merge, verification)             │
  │ • Streaks, garden, satiety cap, session summary              │
  │ • Offline sync + conflict resolution (event replay)          │
  │ • Short-surah onboarding pack                                 │
  │ • Analytics pipeline (events → warehouse)                     │
  └───────────────────────────────────────────────────────────────┘
  ┌── PHASE C · THE MOAT & BUSINESS ─────────────── 6–12 months ──┐  effort: 🔴
  │ • Parent dashboard (confidence) · teacher dashboard (predict) │
  │ • Multi-tenant roles (household, class, institution)          │
  │ • Learned retention model trained on the event log           │
  │ • B2B / research surfaces                                     │
  └───────────────────────────────────────────────────────────────┘
```

---

## 8 · The one-paragraph truth

Building **a working Surah-Yusuf memorization app** (auth + per-user progress + FSRS scheduling +
the wireframe screens, online-only) is a **normal, very achievable web-app project** — the content
is already generated, the schema is already designed, and the framework gives you auth for free.
The complexity that separates this from a weekend quiz is **(a)** treating the recall event log as a
first-class, rich, never-lost asset from the very first tap, **(b)** offline sync if you want it to
work on a commute, and **(c)** eventually the learned memory model. None of (a)/(b)/(c) is required
to *launch and validate*; but (a) is a decision you must make **now**, because you can't retrofit
data you never captured.

**Two decisions this forces today:**
1. **Accounts from day one** (guest-trial optional) — so every event has an owner.
2. **Rich event schema from the first tap** — the moat is the data; log it fully or lose it forever.

Everything else can be phased.
```
