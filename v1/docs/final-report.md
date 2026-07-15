# Final report — iman.app Yusuf Quiz Engine (prelude)

**Status:** the full PRD §10 release plan (v0.1 → v0.8) is complete, tagged, and
deployed to staging. This report is the **GATE D** deliverable — read it before
inviting testers.

- **Staging app:** https://iman-quiz.pages.dev
- **Admin:** https://iman-quiz.pages.dev/api/admin (ADMIN_EMAILS = mfirdaus12@gmail.com)
- **Tests:** 163 pass (engine 87, corpus-compiler 19, worker 32, web 25). typecheck 0.
- **Design invariant honored throughout:** `styles/iman-ui.css` is byte-for-byte
  unmodified across all 8 versions (consumed, never restyled).

---

## What was built, per FR

| FR | Version | What shipped |
|----|---------|--------------|
| **FR1 Corpus** | v0.1 | `packages/corpus-compiler` → `public/corpus.json`: 111 verses, 1777 words (lemma/root/class from vendored QAC morphology), 8880 ranked distractors, 110 connections, 258 look-alikes, 19 scene beats. Validated; spot-check report. |
| **FR2 Learn ladder** | v0.2, v0.4 | S1 meaning (in-context hero) → S2 fill → S3 whole-bank; **S4 bridge** (v0.4). Pure engine ladder; commit-before-feedback IndexedDB log. |
| **FR3 Scheduler + lifecycle** | v0.3 | `update()` (errors full weight, massed damped, pretest excluded, structured-only), band strength + FSRS-shaped decay, day-1 cold gate, `assembleQueue` (FR3 order), atoms rebuilt from the event log. |
| **FR4 Review drills** | v0.4 | Chains + junctions; **FIRe credit** (one traversal credits every verse + connection). |
| **FR5 Start-stop & offline** | v0.3, v0.8 | `resumePolicy(gap)` (resume/restart/replan/makeup); every tap commits locally first; offline drills via the network-first SW (re-enabled v0.8). |
| **FR6 Free practice** | v0.7 | Three doors (extra Learn gate-intact + cost, weak-spot gym, open practice any-ayah); cold-success adoption; diminishing-returns line. Evidence-only (structured:false). |
| **FR7 Identity & sync** | v0.5 | Google sign-in → JWKS verify (iss/aud/exp) → HttpOnly SameSite=Lax cookie; anonymous-history adoption; idempotent `/events` sync; per-user Durable Object; D1. |
| **FR8 Admin monitor** | v0.6 | `/admin` (ADMIN_EMAILS-gated, read-only, iman-ui.css) shows all 7 §3 metrics live + per-user drill-down. Metric instrumentation (latency, interruptions, anchor, confusions). |
| **FR9 Habit layer** | v0.8 | Anchor onboarding (secular), open-into-drill <3s, streak (pauses on miss / make-up / never zeroes), 2-min floor session, decay-visible numbers, 111-row mushaf heatmap, PWA install + network-first SW. |
| **FR10 Onboarding & placement** | v0.7 | "Memorized before?" → binary search over 19 act landmarks (≤5 probes, "I don't know" first-class) → carried map + start ayah + daily plan. Onboards in <5 min. |

**Architecture:** pure-TS `packages/engine` (all scheduling/strength/gating logic,
no DOM) · `packages/corpus-compiler` · `apps/web` (Vite+React+PWA) · `apps/worker`
(Hono on Cloudflare Workers + D1 + per-user Durable Object). Same-site API at
`/api/*` via a Pages `_worker.js` proxy so the SameSite=Lax cookie works.

## Every decision (see docs/decisions.md for full context)

- **D1–D8** (v0.1): real data differs from the brief; vendored QAC morphology
  (1:1 join); authored distractors kept + heuristic PRD-rank; distractor-attestation
  soft; self-collisions dropped; vitest; canonical doc paths; git init.
- **D9–D14** (v0.2): options() built with strength=0; fake-indexeddb durability;
  synced assets; hand-written SW; typescript tooling; **S1 hero renders in full-ayah
  context** (GATE B fix).
- **D15–D16** (v0.3): band-strength model (per-ayah, not per-word); **secular day
  boundary, no Fajr calc** (human direction).
- **D17–D18** (v0.4): FIRe = breadth of credit, not extra weight; single-bridge scope.
- **D19–D25** (v0.5): local-runnable scaffold + mock verifier; uuid event ids;
  adoption = full-log flush; **per-user Durable Object** (human); same-site Pages
  proxy (D23); /api-prefix fix (D24); **SW disabled** after stale-cache pain (D25).
- **D26–D33** (v0.6–v0.7): metric instrumentation; /admin server-rendered; placement
  binary search; arbitrary-ayah teaching; placement-first.
- **D34–D35** (v0.8): **anchor stays secular**; **network-first SW re-enabled** + PWA.

## Known gaps vs the PRD (deliberate, tracked)

1. **DATA-1 — multi-word gloss units (needs qari review).** ~52 phrases are split
   across adjacent Arabic tokens with duplicated/fragmentary glosses (e.g. أَحَدَ +
   عَشَرَ both "eleven"). These must be grouped so S1 lights/grades them as one unit.
   The compiler cannot infer the grouping — it needs your linguistic review. Listed
   in `docs/corpus-report.md`. **Fix before testers see those specific words.**
2. **~14.8% of distractors are valid inflections not attested verbatim in the mushaf**
   (e.g. أَبِيكَ). Flagged soft in the corpus report for qari review — strong traps,
   not errors, but confirm acceptable.
3. **Scene-beat labels are TODO strings** in corpus.json (you deferred authoring
   them; the S1–S3 ladder doesn't surface them, so non-blocking).
4. **MS/JA glosses null; mushaf page/line null** — columns exist (PRD i18n), values
   unsourced this prelude.
5. **D30 retention metric is time-gated** — shows "accrues from <date>" until cards
   reach 30 days + retention probes run. Physically cannot show data yet.
6. **S3 dark-mode tile contrast** — a design-system nit you spotted; a one-line
   `color: var(--text-primary)` on `.tile` in iman-ui.css (yours to make, invariant #5).
7. **Web push (P2)** — not built (platform-limited); anchor leans on the habit, not
   push. Native app out of scope (engine written to be inherited by RN later).
8. **PRD §12 open questions** (whole-bank sufficiency, deadline-planner default,
   MS/JA source, page-geometry, tester count) remain product decisions for you.

## Tester invitation checklist

Before inviting the first external tester:
- [ ] **Resolve DATA-1** for at least the ayat testers will first encounter (or
      accept the known imperfection and note it in the invite).
- [ ] **Add each tester's Google email** to `ADMIN_EMAILS`? No — testers are NOT
      admins. Only add your own. Testers just sign in normally.
- [ ] Confirm the **Google OAuth consent screen** lists your testers (it's in
      "Testing" mode) OR publish it — otherwise their sign-in is blocked.
- [ ] Sanity-run the **full flow yourself on staging**: placement → anchor → encode
      an ayah → sign in → confirm the event lands in D1 (`wrangler d1 execute
      iman-db --remote --command "SELECT COUNT(*) FROM events"`).
- [ ] Open **/api/admin** and confirm the §3 table renders (metrics will be sparse
      until testers accumulate data).
- [ ] Decide **tester count** (PRD §12 Q5: 5 vs 15) — 5+ gives a meaningful 30-day read.
- [ ] Send a short invite: the staging URL, "sign in with Google to sync," and that
      it's a 30-day prelude.

## First week — the §3 metric watch-list (check /admin daily)

The prelude passes/fails on the §3 table (docs §3). What to watch, and the tell:

| Metric | Target | If off, it means |
|--------|--------|------------------|
| **Day-1 gate pass rate** | 85–90% | Higher → ladder too easy; lower → daily dose too short. Tune the repetition constants. |
| **Anchor adherence** | ≥60% of active days | Low → the anchor time isn't sticking; revisit the anchor UX / reminders. |
| **Cycles-to-clean-pass** | converging | Not converging → the ladder or distractor difficulty needs tuning. |
| **Look-alike slip rate** | declining per pair | Not declining → tell-apart drills (P1, deferred) may be needed sooner. |
| **Interruption → completion** | ≥80% same day | Low → the resume/floor-session flow isn't recovering interrupted sessions. |
| **Time-per-word** | ~20 s (correct constant) | Feeds the capacity formula; correct the 20 s prior with the real median. |
| **D30 retention vs predicted** | ±10% FSRS calibration | Accrues at D30; the first real read of whether the scheduler is calibrated. Per-user fitting after ~2 weeks. |

**Daily habit:** open /admin, scan the 7 rows, and note any that drift from target.
The two most actionable early signals are **Day-1 gate pass rate** (tune the dose)
and **anchor adherence** (fix the habit). D30 retention is the verdict — it only
arrives at day 30.

---

*Prelude built v0.1 → v0.8, one version at a time, each with its exit criterion
evidenced. Awaiting your final review at GATE D before testers are invited.*
