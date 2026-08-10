# iman.app v3 — End-to-End Build Plan

_Generated 2026-08-10 by a 19-agent Fable workflow: six layers planned independently, each red-teamed twice (completeness + edge cases), then synthesized._

Companion to `v3-wireframe.excalidraw` (26 sections) and `WIREFRAME.md` (the decision log).
This file is the **execution** plan; the wireframe is the **specification**.

---

## Verdict

This build is one engine spine with everything else hanging off it, plus a content calendar that no amount of engineering can compress. The corrected shape: freeze the decisions and the event wire format once (with every field the red-teams proved missing — device_seq, tz, corpusHash, positional answers, selection snapshots), port the engine verbatim to a pinned v2 SHA, surah-key it, fix B2/B4/B6 and the multi-surah defects in the port itself, land the Site/admit/ordinal substrate and BOTH determinism checks before the question compiler, and only then build the UI against RenderItem. The backend is v3's own Laravel app with a Node fold-runner as the sole server-side fold — no PHP re-implementation of anything, including the B3 hash, which is computed once in TS and tiered so the qari certifies text+glosses+beats while distractors and specs live under an admin-gated chip that can churn without invalidating scholar sign-offs. Payments move onto the main line (Stripe MY application on day 1, entitlements before any social code); social moves entirely post-launch behind the flag plane. The true long poles are human: gloss.ms authoring/review and scene-beat authoring must FREEZE before the qari sessions (the hash covers them), and the qari's calendar — recruit on day 0 — bounds the launch date more than any engineering item. Honest total: ~40 engineer-weeks of build compressed to ~16-18 calendar weeks by an agent factory with a hard invariant firewall and one human merger, landing a paid, qari-verified, EN-first launch of Yusuf + Al-Ikhlas + Al-Asr + one revenue surah, with social and learning-science dashboards following behind flags.

---

## Milestones

## M0 — Decisions, Scaffold, Firewall (week 0–1)
**Goal:** nothing merges ungated; every calendar clock starts. **Ships:** monorepo scaffold (`apps/web` Next.js pinned major, `packages/engine`, `v3/api` Laravel 11, `worker/fold-runner`); CI invariant-gate phase 1 (arch tests, purity lints incl. zero-arg `new Date()`/local-date getters, closed-union type tests, Arabic-codepoint diff grep incl. presentation forms and .php/.json surfaces, v1/v2 path guard); INVARIANTS.md / DEFECTS.md / GLOSSARY.md / CLAUDE.md (naming the corrected order as sole authority); v2 baseline SHA pinned + golden log cut from it; decision batch v3-D08..D2x ratified (own backend; wire format; GradeClass set; canonical order `(ts, deviceId, deviceSeq, uuid)`; per-device ordinal namespace; B6 = surface-equivalence-at-position; tiered verification hash; verified = any-row-matches-current; `/`=landing `/home`=dashboard; EN-only-vs-MS; lapsed = review-only). Day-1 calendar starts: Stripe MY application, qari recruitment, MS-reviewer recruitment. **Exit:** a deliberately violating PR fails every phase-1 clause; a fresh agent given only CLAUDE.md states all 6 invariants. ~1 week.

## M1 — Corpus Factory (weeks 1–3, parallel)
**Goal:** surah-parameterized compiler that survives degenerate surahs. **Ships:** FULL v1 compiler port (compile/buildCorpus/parseQac/prdRank/validate/io **plus normalize/connections/lookalikes/sceneBeats/report/types**); `surah` on every row (corpus half of E-01); geometry merge incl. word-level line_number; two artifacts (learner minified no-`why`, admin full) with cross-artifact hash-equality assertion; content-addressed files (16-hex) + manifest with per-surah schemaVersion (build facts only — frontier/review state served by API, never static); per-ayah tiered hash tables emitted at compile; compiles of **12, 103, 112** (+ chosen second surah); validate.ts extensions (structural-basmalah flag — never text matching; Arabic-in-gloss rejection; min-live-variants via the ENGINE's imported admit; duplicate-gloss stats per language); everything vendored (curl, never urllib); fixtures (103, 112, 12-slice in compiler fixture-mode, golden log) regenerated from the compiler; runbook draft + attribution page content. **Exit:** `pnpm compile 12|103|112` green; Yusuf byte-parity vs v2 under a defined strip-new-keys diff. ~3 eng-weeks.

## M2 — Engine Substrate (weeks 1–5, THE SPINE)
**Goal:** pure engine, surah-keyed, defect-free, deterministic. **Order (fixing the internal contradiction):** verbatim port green (24 test files, attic ladder/bridge/chain with retired-test mapping published) → golden-log parity vs pinned v2 SHA → **E-01** as one mechanical commit → tz-explicit daybound rewrite → **B2** (GradeClass + `gradeClassToWire`, lane→class table) → **B6** (surface-equivalence-at-position; 26-ayat sweep) → **B4** `(createdAt, id)` → multi-surah fixes **E-02/E-03/E-05/E-06/E-08** → Site/ledger/admit (4 clauses + minimum-entropy floor, per-locale stats, overrides-aware ledger)/rotation/**per-device visitOrdinal** → `replaySelection` + snapshot-based selection_determinism_check (varying seeds, failure-seed pinning, 2-device-merge scenario) → **DrillEvent frozen ONCE** (surah, siteKey, visitOrdinal, deviceId, deviceSeq, tz, corpusHash, locale, denormalized spec snapshot, positional answer, gradeClass). Admit stats re-measured on 103/112. **Exit:** all checks green; degenerate-surah admit measured; wire format published to backend + sync lanes. ~3.5 eng-weeks.

## M3 — Backend Core (weeks 2–6, parallel after wire freeze)
**Goal:** ingestion, fold truth, content integrity. **Ships:** Laravel 11 skeleton + Sanctum + **password reset/email verification + mail infra**; events table PK `(user_id, uuid)`, frozen wire columns, cap log-only-then-enforced, pull protocol cursored on server ingest-sequence (late-arrival safe); **Node fold-runner sidecar** (sole server-side fold) + `atom_cache` (engine_version) + **fold_determinism_check** + selection-check nightly harness + per-user advisory locks + dead-letter quarantine + late-arrival refold; corpus hash-table ingest command (Laravel never computes hashes); specs (immutable, versioned, tombstone-as-flip) / typed overrides (**no `custom`** — B1 dead; B4 ordering) / verifications (**tiered hash**: qari tier = text+glosses+beats, admin tier = distractors+specs; TOCTOU sign-time recompute; any-row-matches predicate; id ordering; hashSpecVersion per row; red rejected state + per-ayah serving kill); v2 customs archived read-only (if v2 data in scope). **Exit:** both checks green nightly in staging against deliberately corrupted inputs; override on verified ayah flips the frontier; one week burn-in for flake. ~4.5 eng-weeks.

## M4 — Question Compiler (weeks 5–8, spine tail)
**Goal:** §22 closed-kernel compiler, parity-fenced. **Ships:** spec.ts / corpusRef.ts (5 coordinate variants, no literal) / faces.ts / kernels / buildQuestion / render.ts (4 closed shapes) / **explain()**; fold-safety tests (delete-all-specs replay invariance, full-corpus Face provenance sweep on 12+103+112); DoD = reconstruct + 6 test builders re-expressed byte-identical under FROZEN B6 semantics. Merge blocked until selection check green (it is, per order). ~4 eng-weeks, hard-fenced.

## M5 — Learner App Core (weeks 4–9; shell parallel with M4, quiz UI after M4 types)
**Ships:** shell/routes/route groups; locked CSS byte-diff-gated + ext layer; **self-hosted @font-face** (not next/font — hashed family names can't match locked tokens) with bounded font wait + per-corpus subset check; client islands (IDB open-failure screen, quota-retry banner preserving commit-before-paint, Web Locks single-writer, skeletons-vs-true-empty-vs-broken three-state); quiz loop 4 shapes consuming RenderItem (position-keyed tiles, RTL-aware cursor/locate); full session lifecycle (create → drill → summary → completion celebration → quit/resume); macro panel; ring + flat-strip fallback **rendering connection atoms**; progress table (§15 a11y, connection rows); plan calendar (3 fidelity zones); continuous drill range + page (boundary-seam ownership, foreign-lines greyed); i18n provider; Playwright e2e suite. **Exit:** full-Yusuf offline session e2e; airplane-mode drill; Lighthouse ≥95 + human VoiceOver/NVDA pass booked. ~5 eng-weeks.

## M6 — Sync, Onboarding, Dashboard (weeks 8–11)
**Ships:** chunked outbox (≤200) + pull + mergeFromServer preserving deviceSeq (**B5 dies here, owned by sync-builder**) + pending-N indicator; anonymous→account adoption + merge job (mutex, both-in-trial rule, social-edge dedupe); onboarding 7 screens (uses M1's 112 corpus; 'connect once to begin'); dashboard content (MY SURAHS manifest without N corpus fetches, Continue CTA, due counts, zero state); ayah detail; makeup messaging; forgiveness-ladder dialog; reset confirm; add-surah recomputed ETAs. **Exit:** two-device determinism e2e; fresh-device hydration; onboarding→first-session offline path. ~3 eng-weeks.

## M7 — Monetization (weeks 8–12, parallel; Stripe account from M0)
**Ships:** entitlements state machine (trial/active/**grace**/**lapsed_review_only** — all four in schema); Cashier + full webhook set incl. monthly refund, partial refund, dispute-won-reinstate; Stripe CLI replay suite; nightly reconcile; checkout (card monthly; FPX/GrabPay lifetime; email capture before purchase); CF-IPCountry region default, account-stored, editable; PaywallGate at session assembly with offline entitlement TTL+grace; trial = first learner-CHOSEN surah_started (recomputed on late arrival); entitlement-gated corpus route for non-trial surahs; PDPA export/delete/restore(-with-token) + purge cascades; admin billing surface. **Exit:** replay suite green; degenerate one-compiled-surah trial tested. ~3 eng-weeks.

## M8 — Admin Console & Workbench (weeks 9–13)
**Ships:** fails-closed auth (identical errors, allowlist, break-glass documented) + roles (operator/qari/moderator) + append-only audit (structured pseudonym reasons); users/reveal (server TTL) /privacy; System Health (both checks, coverage alerts, degraded banner, rebuild with mutex); §22b workbench (word-picker CorpusRef only, three-strength preview via explain(), green/amber/**red** chips, qari mode with sign-time hash recompute); flag plane (kill = unconditional write; enable-hard ceremony; 72h ack auto-waive; all flags OFF); nav homes for flags/reports/templates/audit viewer; console security review. ~4 eng-weeks.

## M9 — Content Freeze → Qari Gate (weeks 11–15; calendar-bound, booked from M0)
**HARD ORDER:** MS decision executed (EN-only-with-ms-excluded-from-hash-v1, OR draft→review→merge FIRST) → scene beats/macro content authored for EVERY launch surah → distractor QA 10% sample → hashSpecVersion frozen → corpus + spec freeze → qari sessions. Scope = ALL launch-serving surahs (12 + 112 + 103 + second surah), including seam renders; honest budget 15–25h scholar time. **Exit:** frontier 100% green hash-current on every launch surah.

## M10 — Launch Hardening (weeks 14–16)
**Ships:** THE landing page (single step — merged old 17/29 — built now because the inline 112:1 demo needs M5 components + M1 corpus); a11y human pass; backup restore drill (encrypted, purge-aware); security review of admin routes; QAC/Tanzil attribution page; **7-consecutive-green-nights** window starting after the last engine/selection merge (P1 resets it, WARN does not); LAUNCH-CHECKLIST.md all green → **PUBLIC LAUNCH**.

## M11 — Post-launch: Social & Science (week 16+)
Social tables/endpoints behind the already-live flag plane (friends, invites, XP server-ledger-truth, streak covers, together-streak with pre-committed shutdown rule + minimum-cohort n), web-push + email transport, notification governance, streak calendar; learning-science page (k-anon progressive disclosure); recommender. ~4 eng-weeks.

---

## Corrected build order

1. **Decision batch + repo scaffold + CI invariant-gate (phase 1)** — nothing merges ungated; every later contradiction traces to an unratified decision.
2. **Pin v2 SHA; cut golden log + fixtures from it** — v2 is drifting in the working tree right now; the parity oracle must be frozen before it moves.
3. **Corpus compiler port, surah-parameterized, E-01 fields, compiles 12+103+112** — degenerate surahs are the ICP's common case and the fixture source; hand-written Arabic is forbidden.
4. **Corpus versioning: 16-hex content addressing, manifest, tiered per-ayah hash tables** — cache invalidation and B3's hash are compile-time artifacts, computed once in TS.
5. **Engine verbatim port green** — you cannot surah-key code that hasn't been ported (fixes the WS-2-before-WS-1 contradiction).
6. **Golden-log fold-parity snapshot** — the behavioral-drift gate every subsequent engine commit passes through.
7. **E-01 surah keying, one mechanical commit** — before ANY second surah exists anywhere; afterwards it is an unrepairable migration.
8. **B2 + B4 + B6 + tz-explicit daybound in the port** — bugs fixed where they live, not deferred to old step 23; B4 must precede the first B3 hash; B6 must precede the wire freeze.
9. **Multi-surah engine fixes E-02/E-03/E-05/E-06/E-08** — the wireframe's own step-5 instruction; without them the dashboard and forecast ship lying.
10. **DrillEvent wire freeze, ONCE, complete** (surah/siteKey/ordinal/deviceId/deviceSeq/tz/corpusHash/locale/snapshot/positional-answer/gradeClass) — freezing twice means two Laravel migrations and a log the fold special-cases forever.
11. **Site model + admit() + rotation + per-device recorded visitOrdinal** — old steps 26–27 pulled BEFORE the compiler that consumes them (the headline inversion fix).
12. **selection_determinism_check (snapshot-based, varying seeds, 2-device merge case)** — hard precondition for any compiler merge.
13. **Laravel skeleton + auth + password reset + mail infra** — a paid product cannot lock out an RM500 buyer forever.
14. **Ingestion + pull protocol + Node fold-runner + atom_cache + fold_determinism_check** — invariant #2 becomes a monitored fact; the check does not exist today anywhere.
15. **Specs / typed overrides (B1 dead) / tiered verifications (B3 fixed)** — old step 23's B1–B4 pulled forward ~10 steps; must exist before the workbench and before any qari row.
16. **Question compiler §22 + explain()** — old step 24, now correctly AFTER Site/ordinal/checks; parity-fenced at 4 weeks.
17. **App shell + design system + client islands** — parallel with 16; consumes only published types.
18. **Quiz loop (4 shapes) + full session lifecycle** — the product core, built against real RenderItems, no throwaway adapter.
19. **Macro panel, ring (with connection atoms), progress table, plan calendar** — the visible memory graph, both halves of it.
20. **Continuous drill: range + mushaf page (boundary-seam ownership)** — geometry data landed at step 3–4.
21. **Sync outbox + pull + merge preserving deviceSeq** — B5's actual fix, owned, in its real module.
22. **Onboarding (7 screens) + dashboard content + ayah detail** — the only path from landing to first session; was entirely unassigned before.
23. **Entitlements + Stripe + paywall + PDPA** — old step 28 pulled onto the main line; the revenue path cannot trail all of social.
24. **Admin console + health + audit + roles** — the checks need a face before the burn-in window starts.
25. **Workbench + qari mode (TOCTOU-proof signing)** — the qari gate's tooling, ready before the scholar's booked sessions.
26. **Flag plane, all OFF** — must exist before any social code ever ships; social itself is post-launch.
27. **Content ops: MS execution, scene beats, distractor QA sample** — the human long poles, sequenced BEFORE the freeze because the hash covers them.
28. **Corpus + spec freeze → qari sessions (all launch surahs incl. 112/103)** — the hard gate, over content that will not change under the scholar's signature.
29. **Landing page (single step — old 17 and 29 merged)** — built LAST because its conversion engine is the live 112:1 demo, which needs steps 16–18.
30. **Launch hardening: 7 green nights, a11y pass, security review, backup drill, checklist → LAUNCH.**
31. *(post-launch)* **Social suite behind flags** (old 19–22) — governed by 26's plane and the ethics ceremony.
32. *(post-launch)* **Learning-science dashboards + recommender** (old 30) — needs cohort volume to show anything anyway.

---

## Critical path

**The engineering critical path:** M0 scaffold+decisions → engine verbatim port green → golden parity → E-01 → B2/B4/B6+tz → Site/admit/per-device ordinal → wire freeze → selection check → question compiler → quiz loop + session lifecycle → sync/merge → onboarding → landing demo → 7-green-nights tail → launch. Roughly 14–16 weeks; the compiler (4w) and the frontend session/sync block (5–6w) are the widest segments, and the 7-night burn-in is a hard serial tail behind the LAST engine/selection merge — so freeze the engine early and resist late substrate changes.

**The calendar critical path (usually the real one):** qari recruitment (weeks of lead, starts day 0) → MS decision → MS authoring+review (~11h review + drafting) and scene-beat authoring for every launch surah → distractor QA → corpus+spec freeze → qari sessions (15–25h scholar time, booked when M8 starts, not after) → 100% green. If the scholar's calendar slips, launch slips — no engineering parallelism recovers it.

**What runs in parallel:** M1 corpus factory (weeks 1–3) beside the engine port; M3 backend (weeks 2–6) beside the spine once the wire freezes at week ~3; M5 shell/design-system beside the compiler; M7 payments beside M6 sync (they share only auth); M8 admin console beside M6/M7. Stripe account approval, qari recruitment, and MS reviewer recruitment are pure calendar and run from day 1. Social (M11) and learning-science are fully off the launch path.

**The two synchronization points everyone waits on:** (1) the DrillEvent wire freeze — backend ingestion, sync outbox, and Laravel validation all consume it, which is why it happens once, complete, at week ~3; (2) the RenderItem/4-shape type surface — quiz UI waits for the compiler's types (not its internals), which is why the shell and non-quiz surfaces proceed while the compiler is fenced.

---

## Gates & checks

**CI invariant-gate (every PR, fails red, never advisory).** Clauses: engine arch isolation; purity lints (Date.now, Math.random, crypto, zero-arg new Date(), local-date getters); closed-union type tests (Rung, CorpusRef-no-literal); Arabic-codepoint diff grep (incl. presentation forms, escapes, .php/.json/.sql) — blocks any keyboard path to Arabic (B1's lesson); v1/v2 path guard — blocks any touch of frozen trees; locked-CSS byte-diff vs v1 (modulo the documented @import strip); pricing-constants test quoting v3-D07; invariants-1/3/4/5 property pack (per-word-atom detector, pretest exclusion, damping/spacing, freeplay-lifecycle) once the fold lands. Blocks: every merge.

**Golden-log fold-parity gate.** Fold of the pinned-v2-SHA golden log must match the committed oracle (regenerated only via the human-reviewed protocol). Blocks: E-01, every engine behavioral change, every migration.

**fold_determinism_check (built in M3 — it does not exist anywhere today).** Node fold-runner (sole server-side fold, pinned engine version) re-folds sampled users' server logs in canonical order, byte-compares against atom_cache. Divergence = P1; version skew = WARN. Runs nightly + in CI against the shuffled golden log. Blocks: trust in invariant #2, the 7-night launch window, and (via staging burn-in) M3 exit.

**selection_determinism_check (M2, snapshot-based).** Replays a shuffled log (commit-derived seeds, failure-seed pinning) and asserts recorded selection snapshots (siteKey, per-device ordinal, lane/variant) are reproduced; includes the two-device-merge scenario. Blocks: any question-compiler merge (hard precondition), any selection/rotation change, the 7-night window.

**E-01-before-second-surah gate (CI-enforced).** No second-surah corpus, fixture, enrollment path, or event may merge until the E-01 keying commit is an ancestor. Blocks: M1's 103/112 shipping to the app, onboarding (which serves 112), everything multi-surah. Afterwards the damage is an unrepairable migration — this is the one gate with no appeal.

**Content-freeze-before-qari gate (M9 entry criteria).** MS decision executed (authored+reviewed, or excluded from hash v1); scene beats authored for every launch surah; distractor QA sampled; hashSpecVersion frozen; corpus + specs frozen. Blocks: booking-confirmed qari sessions — a sign-off collected before this gate WILL be invalidated and re-paid in scholar hours.

**Qari review (the hard gate, human, calendar-bound).** Scope = ALL launch-serving surahs (12, 112, 103, second surah) including seam renders; every ayah green under the tiered content hash, TOCTOU-proof signing (shown-hash carried, server recomputes at commit), any-row-matches-current predicate, red rejection state with per-ayah serving kill. Blocks: PUBLIC LAUNCH, absolutely.

**Dark-pattern / ethics gate (M8 flag plane).** Enable-hard ceremony (reason ≥20 chars + two ethics booleans + verbatim flag name, server-enforced); kill-easy (one click, unconditional write, second-admin ack or 72h audited auto-waive); notification templates author≠approver (solo degradation = 24h delay, recorded); pre-committed shutdown rule (retention/P(recall@10y) delta ≤ −1pp sustained 28 days with minimum cohort n → kill without debate) written into DECISIONS.md before any ramp. Blocks: every flag ramp, every notification send, all of M11.

**7-consecutive-green-nights window (M10).** Both determinism checks green nightly; confirmed P1 resets the window, WARN does not; starts only after the last engine/selection merge. Blocks: launch (a hard +7-day serial tail — schedule it).

**Remaining launch-checklist gates:** Stripe webhook replay suite green (blocks M7 exit); backup restore drill on encrypted, purge-aware backups; human VoiceOver/NVDA a11y pass (§15 — Lighthouse alone insufficient); security review over admin routes; per-corpus Amiri glyph-subset check; Arabic visual QA screenshot-diff; QAC/Tanzil attribution page live; customs archived with no serving path; all social flags OFF.

---

## Agent deployment strategy

**Operating thesis.** Agents produce; mechanical gates prove; one human merges. Every invariant that can be a red CI becomes one, so Firdaus's review is product judgment, not defect hunting. The two failure modes the red-teams exposed — fixture circularity and unowned server work — are fixed structurally below.

**Phase 0 — Substrate (M0, ~3 days, pays for itself at the first engine PR).**
Four frozen docs in `v3/`: INVARIANTS.md (6 invariants + purity + sacred-text as testable assertions, PLUS explicit statements of invariants 1/3/4/5's property tests), DEFECTS.md (B1–B6 verbatim, each naming its regression test and its owner milestone — B5 explicitly owned by the sync-builder role in M6, killing the "everyone cites it, nobody fixes it" hole), GLOSSARY.md (atom, site, lane, fibre, variant, rung, seam, visitOrdinal, **and 'day'** — the tz-explicit definition three lanes would otherwise invent independently), CLAUDE.md (never touch v1/v2; the corrected build order is the SOLE authority, superseding WIREFRAME §26; fixture map; file-ownership map). **Fixture circularity resolved:** the engine port starts against a Yusuf fixture cut from v2's corpus at the pinned SHA (no new Arabic enters the world); the 103/112/12-slice fixtures are produced by M1's compiler in fixture mode (boundary seams marked unconstructible, external refs pruned) — never hand-written, satisfying both the regenerate-from-compiler rule and the sacred-text chain of custody. Briefs carry ONE wireframe section + ONE fixture + INVARIANTS.md re-injected at top; no agent ever loads the 2.8MB corpus or all 26 sections.

**Phase 0 — Two-phase invariant firewall.** Phase 1 at M0: arch tests (engine imports nothing from react/next/dom); purity lint banning Date.now, Math.random, crypto, zero-arg `new Date()` AND local-date getters (the actual daybound leak the naive grep misses); closed-union type tests for Rung and CorpusRef; Arabic-codepoint diff grep extended to presentation forms (U+FB50–FDFF, U+FE70–FEFF), \u-escapes, fromCharCode, and .php/.json/.sql surfaces, with the convention "tests reference fixture coordinates, never inline Arabic"; v1/v2 path guard; each clause proven by a deliberately violating PR. Phase 2 wired as its subjects land: golden-log fold check at engine-port merge; the invariants-1/3/4/5 property pack as the fold stabilizes (golden log deliberately contains a pretest event, a massed/spaced pair, a free-play event, and a day-boundary pair so each property has a triggering input); selection_determinism_check at the ordinal merge, with commit-derived seeds + failure-seed pinning and a two-device-merge scenario — and it is a hard precondition for any compiler merge.

**Eight roles (`.claude/agents/`, scoped tools).** The original six, corrected, plus the two the red-team proved missing:
1. **engine-porter** — verbatim-or-documented port per an explicit manifest (ladder/bridge/chain atticked by recorded decision); vitest only; never edits v2.
2. **test-writer** — failing tests from defect/spec briefs, committed and observed RED in a separate dispatch before any implementation run.
3. **migration-writer** — Laravel + IndexedDB migrations, always up/down, always a golden-log rebuild-equivalence proof, preconditions asserted loudly. Its target repo exists because M0 DECIDED v3 gets its own Laravel app — the path-guard paradox is dissolved, not worked around.
4. **backend-builder** *(new)* — Laravel controllers, routes, FormRequests, webhook handlers, Pest suites; owns M3 ingestion, M7 payments, M8 console APIs. Without this role, Lanes D/E were staffed by nobody.
5. **sync-builder** *(new)* — outbox, pull, mergeFromServer (preserving deviceSeq — **owns B5's actual fix**), IDB modules, Web Locks; the module the engine layer couldn't legally touch and the frontend layer punted.
6. **ui-builder** — Next.js pages from one section + locked tokens; consumes RenderItem only; success = grep-clean JSX for rung/schedule/selection conditionals (B2 impossible by construction).
7. **corpus-runner** — compiler/geometry scripts (curl, never urllib), checksum validation, fixture-mode generation; never hand-edits Arabic.
8. **invariant-guard** — adversarial verifier: FRESH instance, given only the diff + INVARIANTS.md + DEFECTS.md, never the implementer transcript; posts a per-invariant verdict table and attempts one concrete violating input. To CONFIRMED-block it must produce that input; otherwise it files a follow-up test task and the human decides — EXCEPT determinism/cross-device findings, which escalate to human review even at PLAUSIBLE, because that is precisely the class where single-run counter-examples are structurally hard and "tests pass" is never sufficient.
Human-only forever: qari review, Malay gloss shipping content (agents may draft into a flagged non-shipping table only if Firdaus ratifies that; scaffold-empty otherwise), pricing/paywall policy, LOCKED-decision amendments, merges, oracle approvals, Arabic visual QA.

**Lanes (git worktrees, 3–4 concurrent max — the honest ceiling for one merger).**
- **Spine (serial, exclusive owner of engine types + event schema):** port → parity → E-01 → B-fixes/tz → E-02..E-08 → Site/admit/ordinal → wire freeze → selection check → compiler (M2→M4). Roles: test-writer + engine-porter alternating, invariant-guard on every merge.
- **Lane B (corpus, M1):** corpus-runner + test-writer. Feeds fixtures to everyone; unblocks the spine's degenerate-surah tests by week 3.
- **Lane C (backend, M3):** backend-builder + migration-writer. Starts at the wire freeze — a cross-lane milestone CLAUDE.md names explicitly, so the fold-runner's engine-package dependency is a scheduled handoff, not a hope.
- **Lane D (app shell/UI, M5):** ui-builder. Shell and non-quiz surfaces immediately; quiz components only after the compiler's type surface publishes.
- **Lane E (payments, M7):** backend-builder + ui-builder, after auth + wire freeze.
- **Lane F (admin, M8):** backend-builder + ui-builder; its checks-dependent widgets are scheduled after the spine's check harness exists — the lane starts with auth/audit/users, never idles against missing substrate.
Lockfile changes spine-only; all other lanes install frozen.

**Acceptance protocol (every PR).** Full suite (never scoped, for engine diffs) + invariant-gate green. High-risk set — engine, grading, fold, selection, migrations, Arabic-rendering surfaces, admin write paths, webhooks/entitlements — additionally requires an invariant-guard pass with verdicts. Oracle files (golden log, fixtures, snapshots) carry a human-review label; **oracle regeneration is a first-class protocol**: a script regenerates, the human reviews the diff, the new oracle is versioned — and it is a scheduled step inside E-01, the engine port, and the ordinal change, because each legitimately invalidates the committed fold output (the plan that forgot this had its spine deadlocked on its own gate). Snapshot updates by the implementing agent are rejected by default.

**Worked example — E-01, corrected order.** (1) Spine: verbatim port merges green; golden parity snapshot committed against pinned v2 SHA. (2) test-writer (separate dispatch): red tests — `atomKey(12,…)≠atomKey(67,…)`, AtomState.surah present, seam key shape, fold-semantics preservation. (3) engine-porter: ONE mechanical keying commit through atom/rebuild/heatmap/scheduler + the 24 fixture files. (4) Oracle regen protocol: script re-folds golden log under new keys; human diffs (expects exactly the key-shape delta); new oracle committed. (5) Determinism run: legacy log through the IDB upgrade path vs natively-keyed log — byte-identical states. (6) invariant-guard, fresh: attacks with ref containing ":", surah "007" vs 7, seam-at-last-ayah, two-corpus load. (7) Firdaus merges. Only after this merge may ANY lane compile, enroll, or fixture a second surah — the E-01 gate is a CI check (second-surah artifacts rejected until the E-01 commit is an ancestor), not a convention.

**Budget and cadence.** ~25% verification overhead on the high-risk half; ordinary review for chrome, copy, marketing. Expect the spine at 2–3 agent-days per step with adversarial rounds; the compiler fenced at 4 weeks with a byte-parity DoD that is pinned only AFTER B6 semantics froze (surface-equivalence), so the fence doesn't chase a moving baseline. Weekly: audit-log review, lane rebalance, and a standing check that no lane has invented a contract the spine never ratified.

---

## Effort

**Honest engineering total: ~40 engineer-weeks to public launch, +4 post-launch.** Breakdown: M0 substrate+firewall ~1w; M1 corpus factory ~3w (the port list now includes normalize/connections/sceneBeats/lookalikes and three surah compiles — the original 3w held only because it undercounted); M2 engine substrate ~3.5w (verbatim port, E-01, five bug classes, multi-surah fixes, Site/admit/ordinal, checks); M3 backend core ~4.5w (fold-runner and check harness are new infrastructure, not a '+1 day'); M4 compiler ~4w (hard-fenced); M5 learner app ~5w; M6 sync/onboarding/dashboard ~3w (the work the frontend layer's 8-week claim silently omitted); M7 payments ~3w; M8 admin+workbench ~4w; M9 content-ops engineering ~1w (tooling; the hours are human); M10 hardening ~2w; integration/e2e/slack ~2w. Post-launch M11 social+science ~4w.

**Human (calendar-bound, cannot be parallelized away):** qari recruitment lead time (weeks — start day 0) + 15–25 hours of scholar time across sessions for the four launch surahs, honestly budgeted for render sampling and seams, not the naive 3-min/ayah; MS review ~11h (Yusuf) + ~2h (second surah) plus drafting, IF bilingual ships — and it must complete BEFORE the qari pass; scene-beat/macro authoring for every launch surah (days, owner: Firdaus or a hired writer); distractor spot-checks ~10% per new surah; Stripe MY business verification (weeks, day-0 start).

**Solo developer (Firdaus) + agent factory:** the constraint is merge/review bandwidth, not production. At 3–4 concurrent lanes with the mechanical gates absorbing defect-hunting, expect ~16–18 calendar weeks to launch if the qari calendar cooperates — the spine (~8w serial through the compiler) overlaps corpus/backend/UI lanes, then sync/payments/admin overlap each other, then the content freeze and 7-night tail serialize at the end. The three things that blow this up: late engine changes (each resets the 7-night tail), content landing after sign-offs (re-buys scholar hours), and lane count creeping past what one merger can honestly review.

**Small team (2–3, e.g. Firdaus + one engineer + a content owner):** a second merger roughly doubles safe lane count and takes calendar to ~10–12 weeks; the content owner (MS + beats + qari logistics) is worth more than a third engineer, because after week 10 the critical path is almost entirely human content and scholar scheduling. A third engineer mostly compresses M5–M8 overlap, saving ~2 weeks. Nobody compresses the qari.

---

## Top risks

1. 1. Qari calendar + scope (the real launch gate). Scholar hours are scarce, lead time is weeks, and every content change after sign-off re-buys them. Mitigations: recruit day 0; tiered hash so distractor/spec churn never ambers scholar rows; hard content-freeze gate before sessions; honest 15–25h budget covering seams and render samples; book sessions when M8 starts, not after it ends.
2. 2. Content-after-hash sequencing bomb. gloss.ms, scene beats, or spec changes landing after verification ambers the entire frontier at once — three separate layer plans made this exact mistake in their own calendars. Mitigation: the M9 entry criteria are a gate, not a guideline; the MS decision has a deadline (before M3's verification schema ships) because it changes the hash schema itself.
3. 3. Question-compiler scope blowout. The wireframe prices it at 4 weeks paying off around the twelfth question type. Mitigations: hard fence — DoD is byte-parity re-expression of reconstruct + the 6 builders under FROZEN B6 semantics; any new question type is post-launch; it merges only behind a green selection check.
4. 4. Solo-merger bottleneck. One human reviews everything, including oracle regenerations the spine repeatedly requires. Mitigations: 3–4 lane cap; mechanical gates make review product-judgment; oracle regen is a scripted, diffable protocol; weekly lane rebalance; consider a second merger before M5–M8 overlap peaks.
5. 5. Local-first + RSC hydration and storage failure modes. The classic minefield, plus IDB open-failure/quota/multi-tab paths that hold the log — the app's truth. Mitigations: one-sentence boundary rule enforced by lint; three-state loading model; Web Locks; commit-before-paint preserved under quota errors; Playwright e2e as a first-class M5 deliverable, not an afterthought.
6. 6. Determinism-check false alarms training deafness before a real invariant-#2 breach. Version-skew, late-arriving offline events, merge races, and float noise all page falsely as designed by the naive plans. Mitigations: engine-version-tagged comparisons; refold-on-late-arrival; per-user job mutexes; integer-stable fold outputs; WARN vs P1 taxonomy; one week of staging burn-in before anyone trusts or ignores it.
7. 7. Stripe MY rails and approval. Business verification is weeks of calendar; FPX cannot do recurring, so MY monthly is card-only at launch — a conversion risk. Mitigations: application day 0; rail-agnostic entitlements table so Curlec/DuitNow is a second webhook surface, not a redesign; webhook replay suite + nightly reconcile because entitlement bugs are revenue-and-trust bugs.
8. 8. Effort denial. The layer plans summed to ~28 weeks by silently omitting onboarding, sync-pull, session lifecycle, mail infra, the fold-runner, and all content ops. This plan says ~40. Mitigations: social and learning-science are post-launch by construction; the compiler is fenced; scope adds require removing something visible from a milestone.
9. 9. Hard paywall vs public content. A local-first client with content-addressed public corpus files means the paid product is scrapeable. Mitigations: entitlement-gated corpus route for non-trial surahs; issuance-side enforcement; explicit acceptance that a determined pirate exists and the product optimizes for honest users — recorded as a decision so it stops being an ambush.
10. 10. Legal/compliance tail: QAC's GPL in a paid bundle, PDPA purge vs 7-year invoice retention vs append-only audit reasons, analytics consent vs the no-dark-patterns footer. Mitigations: attribution page regardless; strip morphology from the learner artifact if counsel says so; structured pseudonym-only audit reasons; consent posture decided before the landing page instruments anything.

---

## Open questions — decisions only Firdaus can make

1. Q1 (blocks everything, week 0): Ratify the corrected build order and the M0 decision batch — own Laravel backend; wire format fields; canonical event order (ts, deviceId, deviceSeq, uuid); per-device visitOrdinal namespace; GradeClass closed set {pretest, ungraded, s2_partial, s3_full, rc, gate}; B6 = surface-equivalence-at-position; verified = any-row-matches-current; tiered hash (qari tier = text+glosses+beats, admin tier = distractors+specs); '/'=landing, '/home'=dashboard.
2. Q2 (blocks M3 schema + M9 calendar): Malay glosses — launch EN-only with gloss.ms EXCLUDED from hash v1 and the MS toggle hidden, or author+review MS before the qari pass? Who is the named Malay reviewer with doctrinal authority? This must be decided before the verification migration ships, not before the qari arrives.
3. Q3 (blocks M1 scope + M7 trial economics + M9 booking): Launch surah set — the fixed floor is 12 + 112 + 103; is the revenue-path second surah Al-Mulk (narrative-adjacent, 333 words) or a Juz Amma batch (the ICP's actual repertoire and the true stress test of degenerate cases)?
4. Q4 (blocks M9 booking size): Qari identity, terms, credential to cite publicly — and the certified scope: text+glosses+beats with sampled renders and seam renders (recommended), or full variant review (~3× the hours)? Does the gate re-run per surah as the library grows?
5. Q5 (blocks M7): Lapsed entitlement — review-only INDEFINITELY (strongest never-hostage reading, recommended default) or review-only for 7 days then hard stop? Also: refund policy numbers for lifetime and monthly.
6. Q6 (blocks M1/M7): Corpus delivery for non-trial surahs — entitlement-gated route (recommended, breaks offline purity for locked content only) or public-with-accepted-piracy? Must be answered before the manifest and SW precache design harden.
7. Q7 (blocks M7 scope): Accept card-only monthly for MY at launch, or add Curlec (Razorpay MY) for FPX/DuitNow recurring — a second provider and webhook surface? Also: are RM prices SST-inclusive?
8. Q8 (blocks migration-writer scope + M6): Does v3 import v2 learners' event logs (needs a transcoder with its own determinism proof and a pre-selection-era stance) or launch greenfield-data (recommended given v2's arrival-order seq ambiguity)? Related: are B1–B4 ever fixed in live v2, or v3-only (default: v3-only, v2 untouched)?
9. Q9 (blocks M8 governance): Is there a second admin at launch? If solo: confirm the degraded two-person rules (24h delay instead of second ack; notification templates therefore require the delay path or remain unsendable) recorded in DECISIONS.md.
10. Q10 (blocks M7/M11 metrics): PDPA delete — full purge including the learning event log (current safe default, which biases retention metrics upward) or offer anonymize-and-retain for cohort aggregates? And the analytics consent posture on the pre-account landing page (anonymous PostHog severs the demo→D30 join; first-party counters recommended).
11. Q11 (blocks launch artifact): QAC GPL exposure — ship lemma/root/class in the paid client bundle with attribution, strip morphology from the learner artifact (build-time-only use, cheapest safe answer), or seek counsel?
12. Q12 (blocks M3 infra): Hosting — self-managed VPS via the Kickoff deploy pattern vs managed (Forge + managed Postgres); who carries the 3am pager when fold_determinism pages a P1, and what is the accepted response time for a solo operator?
13. Q13 (blocks v3-D02 compliance for non-narrative surahs): Who authors macro-panel mental models per surah, and may a surah ever ship with a generic fallback panel — or is authored content a per-surah launch requirement?
14. Q14 (tuning, before M2 admit freeze): Ratify the Arabic option-distinctness normalization (NFC + tatweel-strip, harakat-sensitive) and the minimum-entropy floor values — both are calibrated on Yusuf and re-measured on 103/112 in M2, but the thresholds are product judgment.
15. Q15 (process): Confirm the 3–4 concurrent-lane cap and whether invariant-guard adversarial passes run on every engine diff or only the high-risk set as proposed (recommended: high-risk set + all webhooks/entitlements).

---

## Edge-case register

| # | Case | Layer | Trigger | Resolution | Milestone |
|---|------|-------|---------|------------|-----------|
| 1 | Waqf marks glued to words (12:1 "الٓر ۚ") | data | hash vs comparison diverge | hash raw NFC bytes; distinctness+grading compare under compiler-emitted symbol-stripped normalization | M1 |
| 2 | One-word ayah 103:1 | data | supply + degenerate shapes | ranks 1–4 required for the single position; validate.ts asserts min live variants via the ENGINE's imported admit (no second implementation) | M1/M2 |
| 3 | Muqatta'at glosses | data | translation impossible | Latin transliteration EN+MS; Arabic-in-gloss validator whitelists nothing | M1 |
| 4 | Muqatta'at gloss identical across EN/MS | data | clause-3 false defect | per-language duplicate stats; cross-language transliteration equality not flagged | M1 |
| 5 | Duplicate EN glosses in ayah (175/1777) | data | two-correct prompts | duplicate stats per language; clause 3 drops variants; MS profile recomputed, never assumed from EN | M1/M2 |
| 6 | Repeated Arabic surface (63/1777; 12:87 مِن ×3) | data | dedupe breaks B6 fix | corpus preserves position identity; word rows never deduped | M1 |
| 7 | Distractor == target | data | recurs in every LLM batch | compiler drops + reports per surah | M1 |
| 8 | Unattested distractor (~14.8%) | data | quality risk | soft warn; per-surah review artifact in runbook | M1 |
| 9 | Distractor ≡ sibling word under normalization | data | two-correct options | compiler emits normalized forms; clause 2 filters client-side | M1/M2 |
| 10 | Ayah spans page break (105/111) | data | verse.page ambiguous | page=first + lines[]; line drill uses word-level line_number (fetch gains word fields) | M1 |
| 11 | Surah starts mid-page (12:1 = p235 l11) | data | cross-surah page | page drill = within-surah slice; foreign lines greyed/labeled; cross-surah pages deferred decision | M1/M5 |
| 12 | Bismillah: 1:1 real ayah; INSIDE 27:30; absent in surah 9 | data | text-matching corrupts An-Naml, mis-emits surah 9 | key on Tanzil structural basmalah flag, never text; display string is a corpus display-only field | M1 |
| 13 | Ayah numbering basis | data | QAC join misaligns | Tanzil numbering locked in SOURCES.md; never mix per surah | M1 |
| 14 | Override tombstone reverts hash A→B→A | data/ops | latest-row predicate deadlocks | verified = ANY row's hash matches CURRENT; append-only ordered by id; no unique-hash constraint deadlock | M3 |
| 15 | Legacy pre-hash verification rows | data | unverifiable (B3) | all stale, full re-verify; no trusted backfill (needs qari buy-in) | M3/M9 |
| 16 | Corpus updated mid-offline-session | data | wrong text risk | session pinned to IDB corpus by hash; events stamp corpusHash; swap at session boundary only | M1/M5 |
| 17 | Manifest fetch fails offline | data | drill blocked | last cached manifest+corpus; never block drilling on network | M5 |
| 18 | NFC/NFD + JSON canonicalization TS vs PHP | data | hash flicker | ONE hash implementation (TS: compiler + fold-runner); Laravel stores hash tables, never computes; combining-mark fixtures | M1/M3 |
| 19 | Partial gloss.ms rollout | data | blank MS UI | per-surah glossMs manifest status gates bilingual UI; draft MS excluded from qari-tier hash | M1 |
| 20 | LLM MS: Arabic codepoints / Indonesian false friends | data | doctrinal error | compiler rejects Arabic in glosses; human review mandatory before `reviewed` | M9 |
| 21 | 'why' strings reach learners | data | rationale leak | two artifacts; test asserts zero 'why' keys; cross-artifact hash-equality one-liner in validate.ts | M1 |
| 22 | Surah with no mental-model (non-narrative) | data | v3-D02 mandates panel | macro authoring = budgeted M9 item per launch surah; fallback panel only by explicit decision | M9 |
| 23 | meta.surah ≠ row.surah | data | cross-surah collision | loader hard-fails | M1 |
| 24 | Quran.com 403 / API drift | data | pipeline break | curl only; responses vendored day-of-fetch; rebuilds offline forever | M1 |
| 25 | Absent vs null vs draft fields in hash | data | 3 hashes, same content | canonicalization spec defines absent-key handling; draft ms excluded; cases in hash-fixtures | M3 |
| 26 | Hash-spec change / E-01 field add re-hashes all | data | mass amber | hashSpecVersion in meta AND on each verification row; spec changes land before qari pass | M3/M9 |
| 27 | hash8 collision under immutable cache | data | old corpus served as new, forever | 16-hex filenames | M1 |
| 28 | Manifest schemaVersion skew across surahs | data | partial recompile bricks a surah | per-surah schemaVersion + atomic deploy rule | M1 |
| 29 | IDB corpus version accumulation / Safari eviction | data | current corpus evicted offline | keep-latest-2 eviction; storage.persist(); keep N prior versions deployed for stragglers | M5 |
| 30 | verifiedFrontier/glossMs in static manifest go stale | data | B3 one layer up | runtime state served from Laravel API; manifest carries build facts only | M3 |
| 31 | Corpus world-readable vs hard paywall | data/be | product scrapeable | non-trial corpus behind entitlement-gated route; trial surah public; residual risk accepted in DECISIONS.md | M7 |
| 32 | Fixture slice (12:80–90) breaks integrity | data | dangling seams, refs | compiler fixture-mode marks boundary seams unconstructible, prunes refs; never hand-written | M1 |
| 33 | 3-ayah surah crashes narrative-shaped modules | data | sceneBeats/connections assume 111 ayat | 103+112 compiles are M1 done-criteria; modules made total over degenerate inputs | M1 |
| 34 | Juz Amma: 3 surahs on one physical page (604) | data | page-drill degenerates | within-surah slice at launch; product decision flagged before Juz Amma ships | post |
| 35 | Draft→reviewed MS edit stales admit stats | data | shipped stats wrong | stats recomputed at the ingesting compile; hash change forces client refresh | M1/M9 |
| 36 | Yusuf 5 vs Al-Mulk 5 | engine | atom collision | `${surah}:${kind}:${ref}` + surah field; synthetic-999 + real-103 collision regression | M2 |
| 37 | Last-ayah seam | engine | bridge.ts OOB | expand emits seams a..b−1 only; seam:N unconstructible, asserted | M2 |
| 38 | Adjacent page ranges orphan boundary seams (zero-emission) | engine | 13 crossesPage seams never drilled | boundary seam owned by the range containing its FROM ayah | M2/M5 |
| 39 | 1-word ayah lane set | engine | s1/cloze empty; padded slates | honest degradation; entropy floor bars 1-tile/1-blank shapes; real lane count may be 1 — allowed, never padded | M2 |
| 40 | Tiny lane counts (112:2, 3-ayah surahs) | engine | immediate repeats | rotation not swap; L=2 property test; L=1×V=1 explicit carve-out (forced repeat legal, logged) | M2 |
| 41 | Seam ladder vs 2-word successor (112:1→2) | engine | width 3 unsatisfiable | ladder clamps at successor length; never spills to N+2; sub-floor seam falls back to cued-recall variant | M2 |
| 42 | Zero-entropy free successes | engine | strength inflation | admit clause 5: minimum-entropy floor | M2 |
| 43 | "[that]"/"That"; "before " trailing space | engine | near-dups survive | normalization = case-fold + bracket-strip + whitespace-trim, spec'd + fixture-tested | M2 |
| 44 | Arabic near-dups (مِن/مَن, ٱ/ا, tatweel) | engine | uncounted option collisions | Arabic distinctness normalization decided (NFC + tatweel strip; harakat kept distinct) with fixtures | M2 |
| 45 | Strict position grading on identical tiles | engine | coin-flip FALSE NEGATIVE (worse than B6) | grade by surface-equivalence-at-position: any tile whose normalized surface equals expected consumes it; 26-ayat sweep | M2 |
| 46 | gloss.ms 0/1777 for MS locale | engine/fe | empty prompts | admit counts MS supply; compiler returns null; UI shows EN + '(EN)' marker (locked) | M2/M5 |
| 47 | visitOrdinal on empty/wedged IDB | engine | NaN | max(∅)+1 = 1 | M2 |
| 48 | Two offline devices emit same ordinal | engine | replay forks (B5 reborn) | per-device ordinal namespace; canonical (ordinal, deviceId, id); events carry selection SNAPSHOT — snapshot is truth, replay verifies | M2 |
| 49 | Cold 2nd device signs in offline pre-pull | engine | mass low ordinals | per-device namespace makes them non-colliding; rotation resumes from union post-pull | M2/M6 |
| 50 | merge sees existing id | sync | divergent payload silently dropped | skip only on payload-digest match; mismatch alerts | M6 |
| 51 | ts ties / clock skew ordering | engine/be | fold divergence | never order by ts alone; canonical (ts, deviceId, deviceSeq, uuid); overrides (createdAt, id) | M2/M3 |
| 52 | Pretest first-pass meaning errors | engine | strength pollution | excluded (inv 3); golden log CONTAINS a pretest event so checks can see breakage | M2 |
| 53 | Massed ×0.35 damping through E-01 | engine | silent drift | golden log contains massed/spaced pair; parity gate | M2 |
| 54 | Free-play | engine | lifecycle/rotation contamination | evidence only; never consumes structured ordinals; arch test | M2 |
| 55 | test_* events | engine | fold branch temptation | fold no-op asserted; spec grading clamped ungraded | M2 |
| 56 | Spec declaring S3 | engine | grading via data | spec schema has no grading field; type-level + server clamp | M2/M4 |
| 57 | v2 customs[] rows | engine/be | retroactive learner visibility | v3 overrides drop the customs branch; rows archived, no serving path, POST rejects kind=custom forever | M2/M3 |
| 58 | Pre-selection-era events | engine | fold/selection confusion | fold ignores extra fields; site treated unvisited; check reports coverage window | M2 |
| 59 | buildQuestion null after ladder | engine | empty card | selection skips to next lane in lapPerm; never throws | M2/M4 |
| 60 | Ordinal at serve vs emit; abandoned question | engine | burned ordinals or re-serve | stamp at result-emit; abandoned re-serves; resume policies documented per case | M2 |
| 61 | TZ/DST day boundary; daybound host-TZ leak; KL→London | engine | damping/streak diverge client vs UTC server | daybound rewritten tz-explicit (IANA passed in); events carry tz; arch test bans local-date getters; 23:50/00:10 pair in golden log | M2 |
| 62 | Locale or corpusHash shifts mid-lap | engine | ordinal→variant remap | locale + corpusHash snapshotted on event; replay scoped per epoch against snapshots | M2 |
| 63 | Geometry missing for new surah | engine | expand() crash | ledger carries geometry presence; declared degraded mode; §13 page drill feature-gated per surah | M2/M5 |
| 64 | Migrated v2 learner rotation reset | engine | re-serves recent variants | if import happens: pre-selection-era stance + lapPerm offset from fold state; else N/A (open Q) | M6 |
| 65 | 1-word rc grants s3 gain | engine | inflated strength on ICP surahs | gain scaled by observed coverage/entropy on degenerate ayat (recorded tuning decision) | M2 |
| 66 | 3 surahs, one budget (E-02) | engine | starvation or triple session | per-surah risk-weighted assembly + merge; AssembleInput = Site[] + per-surah budgets | M2 |
| 67 | Pending gate in A blocks learning in B (E-03) | engine | cross-surah lock | unlockPermitted scoped per surah | M2 |
| 68 | Per-learner pace (E-05) / ETA division (E-06) | engine | forecast lies | pace + planFor surah-scoped; add-surah UI shows recomputed ETAs | M2/M6 |
| 69 | Terminal ayah, no outbound chain (E-08) | engine/fe | implied missing atom | N−1 connections rendered as structural fact | M2/M5 |
| 70 | Churned learner returns after months | engine | queue explosion | makeup caps queue + says what deferred; month-scale decay tests; scheduler input carries entitlement, never queues locked content | M2/M7 |
| 71 | '/' claimed by landing AND dashboard | fe | routing collision | '/'=landing stateless, '/home'=dashboard; client-side guard duplicates middleware (SW bypasses it); IDB is truth, cookie a 7-day-ITP hint | M5 |
| 72 | SSR of log-derived values | fe | hydration mismatch | corpus=server, log=client islands; skeletons never zeros; lint bans IDB in RSC | M5 |
| 73 | True-empty vs pending vs IDB-broken | fe | eternal skeletons for new users | three explicit states; empty log → zero-state UI; IDB open failure → hard-fail screen w/ sync recovery | M5 |
| 74 | QuotaExceeded on tap write | fe | commit-before-paint broken | card blocks with retry banner; tap never silently dropped | M5 |
| 75 | Two tabs, one session | fe | double-committed events (B5 on one device) | Web Locks single-writer; second tab read-only takeover | M5 |
| 76 | Tab killed mid-session | fe | lost taps | every tap committed pre-paint; reload rebuilds from log; interrupted latencies discarded | M5 |
| 77 | Unknown/foreign sessionId | fe | crash | redirect to dashboard | M5 |
| 78 | Garbage route params (/ayah/0, /abc) | fe | 500 via App Router default | validated; explicit notFound(); dynamicParams handled | M5 |
| 79 | Library 'coming' tiles → 404 | fe | broken links | locked rows are not links; deep links → graceful notFound | M5 |
| 80 | Arabic inside LTR rows | fe | bidi reorder | dir=rtl lang=ar + bidi isolation; gap-slot min-width holds in RTL flex | M5 |
| 81 | RTL cursor / locate tap mirroring | fe | grades the mirror position | cursor advances in logical reading order; tap→logical index RTL-aware; explicit tests | M5 |
| 82 | 44px targets vs locked ~32px .tile | fe | a11y vs locked CSS | transparent .tile-hit wrapper in ext layer; locked file CI byte-diffed | M5 |
| 83 | next/font can't match locked font tokens; @import breaks offline | fe | unimplementable 'only delta' | self-hosted @font-face; @import strip is the one documented delta; bounded (~3s) font wait then fallback — never infinite block | M5 |
| 84 | Amiri subset tofu | fe | missing Quranic codepoints | build-time glyph check over EVERY compiled corpus, per surah | M1/M5 |
| 85 | FOUT reflows tiles under thumb | fe | mis-taps | preload + metrics-adjusted fallback; block first drill paint on Arabic font (bounded) | M5 |
| 86 | prefers-reduced-motion kills error shake | fe | wrongness in motion only | colour+border+banner text carry the error state | M5 |
| 87 | Deuteranopia teal/coral | fe | colour-only stage | StageBadge (dot+label+number) is the ONLY stage renderer | M5 |
| 88 | 8-long-tile widened banks | fe | layout break | bank tested at width 8 with long glosses | M5 |
| 89 | Ring on ≤9-ayat surahs | fe | meaningless arcs | flat 1→N strip with identical stage semantics; threshold ratified | M5 |
| 90 | Connection atoms invisible (40% of Al-Asr's atoms) | fe | half the memory graph unrendered | seams rendered as joints in ring/strip; /progress/list gains connection rows | M5 |
| 91 | Offline before first precache | fe | onboarding dead-end | explicit 'connect once to begin' screen | M6 |
| 92 | PWA start_url bypasses middleware; offline serves cached '/' | fe | onboarded user sees marketing page | client-side steering in app shell; start_url=/home | M5 |
| 93 | bfcache restores stale card | fe | stale state | pageshow re-reads session from IDB | M5 |
| 94 | Dark mode toggle | fe | not in locked system | prefers-color-scheme only; toggle requires a new logged decision | M5 |
| 95 | Amber/purple pill misuse | fe | semantics drift | PillStreak/PillMeaning sole token consumers | M5 |
| 96 | Paywall expiring mid-session | fe/be | interrupted drill | gate at assembly only; in-flight events always ingested | M7 |
| 97 | Zero-state dashboard | fe | empty box | leads with recommender + library (§12) | M6 |
| 98 | Returning after weeks | fe | silent queue cap | makeup messaging says what was deferred | M6 |
| 99 | Surah completion | fe | biggest emotional beat absent | distinct celebration state in session flow | M5/M6 |
| 100 | Repeated gate failure | fe | forced demotion | forgiveness-ladder OFFER dialog — accept/decline, never forced | M6 |
| 101 | Gate-pending lock opacity | fe | learner confusion | gate-armed/due states + why-locked explanation | M5 |
| 102 | Basmala across surahs | fe | dedupe confusion | rendered distinct, never deduped; display-only outside 1:1 | M5 |
| 103 | Outbox growth offline-for-days | fe | invisible risk | quiet 'N pending' indicator; never blocks a session | M6 |
| 104 | Device reset / new learner | fe | destructive action | confirm enumerates N surahs of loss | M6 |
| 105 | Landing demo needs quiz components + 112 corpus | fe | dependency inversion | landing is M10, after M5 + M1; demo IS the conversion engine | M10 |
| 106 | Trial='one surah' when one surah is the product | fe/be | degenerate paywall | explicitly tested; second surah on revenue path | M7 |
| 107 | Mixed-language multi-surah queue | fe | MS/EN interleave | session language = UI locale; per-surah glossMs gates; served locale snapshotted on events | M5 |
| 108 | Partial batch retry | be | duplicates | PK (user_id, uuid) insertOrIgnore; ignored-with-matching-digest = success | M3 |
| 109 | Same uuid under two users (bad RNG / replay) | be | silent cross-user drop | scoped PK makes it impossible; merge reassigns by uuid within the merging pair only | M3 |
| 110 | Batch >200 / event >8KB | be | permanently wedged sync | client chunking ships FIRST; server cap log-only → then enforced; oversize split/quarantine policy client-side | M3/M6 |
| 111 | Far-future client ts | be | permanent spacing poison | accept + flag; fold clamps spacing at received_at; skew measured client-now vs server-now, not per-event | M3 |
| 112 | Merge: settings/trial/social on both sides | be | nondeterministic outcome | named settings win; trial = earliest by canonical order (no double trial); edges deduped; self-friendship dropped; one streak per partner; XP re-capped | M6/M7 |
| 113 | Anonymous lifetime buyer → existing account | be | entitlement loss; Stripe needs email | max(tier) survives; email captured at checkout (register-before-purchase decision); customer id moves | M7 |
| 114 | Lifetime refund/chargeback after months | be | data hostage | → lapsed_review_only; data never deleted | M7 |
| 115 | Dispute WON | be | customer stuck lapsed | dispute.closed handler reinstates | M7 |
| 116 | Monthly / partial refund | be | unhandled webhooks | explicit handlers; state machine covers all transitions | M7 |
| 117 | invoice.payment_failed | be | premature lockout | grace through Smart Retries; only subscription.deleted lapses | M7 |
| 118 | Webhooks out-of-order/duplicated | be | state corruption | provider+event-id unique; guarded transitions, never last-write-wins | M7 |
| 119 | VPN region arbitrage; mid-sub region change | be | pricing games | accepted rounding error; region affects future purchases only | M7 |
| 120 | FPX cannot recur | be | copy lies | monthly MY card-only at launch; pricing copy constraint; entitlements rail-agnostic | M7 |
| 121 | Onboarding 112 consumes trial | be | trial burned on demo | trial_surah = first learner-CHOSEN surah_started (flagged field); recomputed on late arrival by canonical ts | M7 |
| 122 | Learner CHOOSES Al-Ikhlas as first surah | be | ambiguity | explicit rule: choosing 112 as the real first surah DOES consume the trial | M7 |
| 123 | Trial expires mid-session | be | interruption | issuance-only check; in-flight events always ingested | M7 |
| 124 | Events for out-of-entitlement surah | be | evidence rejected | ALWAYS accept — log is truth; enforcement at issuance/corpus only | M3 |
| 125 | Spec tombstoned, old events reference it | be | forensics break | immutable versions; tombstone = status flip; admin inspector resolves old versions | M3 |
| 126 | Concurrent ramp + kill | be | kill loses the optimistic-lock race | kill = unconditional write bypassing version check; ramp fails on conflict | M8 |
| 127 | Kill during Redis 60s TTL | be | stale window | explicit cache-bust + server-side flag checks 403 stale clients | M8 |
| 128 | Fold-runner vs client engine version skew | be | false P1 | atom_cache rows record engine_version; same-version compares; skew = WARN; re-fold-all job per engine release, runtime-bounded | M3 |
| 129 | Weeks-offline device syncs old events | be | false P1 next night | server refolds from canonical order whenever inserts land behind cursor; check compares post-refold only | M3 |
| 130 | Malformed/unparseable snapshot | be | poison event wedges fold | dead-letter quarantine; fold skips + alerts; log intact | M3 |
| 131 | Fold job races merge job | be | torn atom_cache | per-user advisory lock serializes merge/fold/ingest-fold | M3/M6 |
| 132 | Pull cursor vs late-arriving older-ts events | be | events skipped forever | cursor = server-assigned monotonic ingest sequence, not (ts,uuid); fold re-sorts canonically | M3/M6 |
| 133 | Delete while subscribed | be | billing zombie | cancel Stripe immediately, then 30-day clock; export available in window | M7 |
| 134 | Re-register during deletion window | be | insecure restore | 409 + restore authenticated by emailed token | M7 |
| 135 | Hard-purge vs partner's social rows | be | dangling refs, leaks | cascade spec: friendships/invites deleted; together_streak → 'ended' (no reason); XP rows anonymized; notif log purged | M7/M11 |
| 136 | Purge vs backups in R2 | be | purged data retained | encrypted backups; documented retention lag; purge propagation on restore | M3/M7 |
| 137 | Purge vs 7-year MY invoice retention | be | PDPA conflict | invoices retained PII-minimized; documented | M7 |
| 138 | Notification caps across tz change / DST | be | 2 sends in 24h | tz stamped on EACH log row at send; caps evaluated against send-time tz | M11 |
| 139 | XP: client event vs server ledger | be | double truth | server xp_ledger is sole truth; client xp events are evidence-only telemetry | M11 |
| 140 | XP cap on late-synced events | be | multi-device penalty | retroactive grant with per-local-day cap over canonical order | M11 |
| 141 | Forgotten password on RM500 account | be | permanent lockout | password reset + email verification + mail infra (absent from v2) built in M3 | M3 |
| 142 | Notification prefs with no transport | be | undeliverable | web push (VAPID + subscription endpoint) + transactional email provider, with social layer | M11 |
| 143 | Events table growth | be | query collapse | (user_id,ts,id) index; monthly partitioning before ~100M rows; no ORM lazy-loading near it | M3 |
| 144 | Anonymous trial reset via reinstall/incognito | be | infinite trials | accepted residual risk for honest users; hard enforcement at account-required purchase | M7 |
| 145 | Allowlisted email, no account yet | ops | login oracle | identical generic error; fails closed | M8 |
| 146 | Empty/malformed ADMIN_EMAILS | ops | total lockout | boot-time allowlist count logged; documented break-glass (env fix + restart) | M8 |
| 147 | Reveal TTL / concurrent reveals / CSV mid-reveal | ops | privacy leak | server-side 15-min token TTL; independent audits; CSV strips identity unconditionally | M8 |
| 148 | Reveal on anonymous account | ops | nothing to return | defined 'anonymous — no identity held' response, still audited | M8 |
| 149 | Reveal reason free-text stores real names in append-only audit | ops | unpurgeable PII | reasons reference pseudonym ids; free-text scanned/warned; audit retention policy documented | M8 |
| 150 | Override lands after qari sign-off | ops | lying frontier (B3) | hash mismatch flips amber instantly; frontier counts hash-current only | M3/M8 |
| 151 | TOCTOU between qari's read and click | ops | green over unseen content | sign request carries shown hash; server recomputes at commit, rejects mismatch | M8 |
| 152 | Qari edits then signs, same session | ops | race is the COMMON case | workbench refreshes hash after every edit; server always recomputes | M8 |
| 153 | Qari finds an error | ops | no rejection state | red 'rejected' chip + per-ayah serving kill + fix workflow; qari role can flag | M8 |
| 154 | Spec/variant/distractor changed after sign-off | ops | unreviewed content under green chip | two-tier attestation: qari chip (text+glosses+beats) vs admin chip (specs+distractors); each flips independently | M3/M8 |
| 155 | gloss.ms lands after the qari pass | ops | ALL sign-offs amber at once | HARD ORDER: MS decision → (author+review OR exclude ms from hash v1) → freeze → qari; M9 entry criterion | M9 |
| 156 | Routine distractor fix on verified ayah | ops | frontier churn faster than scholar calendar | distractors in admin tier, never the qari hash | M3 |
| 157 | First hash computed while B4 unfixed | ops | nondeterministic hash | B4 (createdAt,id) lands in M2/M3 BEFORE any verification row | M2/M3 |
| 158 | Bulk re-verify same-millisecond rows | ops | 'latest' ambiguity = B4 reborn | order by autoincrement id; UTC verified_at; any-row-matches predicate | M3 |
| 159 | Kill with one admin online | ops | ack impossible | kill instant; banner persists; ack never re-enables; 72h auto-waive audited | M8 |
| 160 | Author self-approves via alias; solo founder = zero sends | ops | two-person rules break | id+email compare + weekly audit; solo degradation = 24h delay, recorded in DECISIONS.md | M8/M11 |
| 161 | Auto-pause on tiny denominators | ops | noise kills templates | ≥100 sends required; below → manual review flag | M11 |
| 162 | Midnight-cram amber vs post-Isha ICP norm | ops | permanent amber → deafness | threshold calibrated against launch-cohort baseline; coverage-loss itself alerts | M11 |
| 163 | k=5 suppression at launch scale | ops | science page blank for months | progressive disclosure: surah-level aggregates until n≥5; page states its coverage | M11 |
| 164 | Shutdown rule on 4-person cohorts | ops | fires on noise | rule includes minimum cohort n; ramps deferred until base supports it | M11 |
| 165 | Qari offboards | ops | attribution | verifications permanently attributed; account disabled, never deleted | M8 |
| 166 | P(recall@10y) revisions; purge survivorship bias | ops | proxy drift; metric flatters churn | model-versioned; definition published on-page; paired with measured D30; bias documented | M11 |
| 167 | Laravel down, console up | ops | zeros look healthy | explicit degraded-state banner | M8 |
| 168 | Rebuild-cache during ingest or nightly check | ops | torn compare, 3am false P1 | snapshotted log cursor; job mutex between rebuild and both checks; second click queues | M3/M8 |
| 169 | 7-green-nights arithmetic | ops | contested gate | defined: confirmed P1 resets the window; WARN (version skew) does not | M10 |
| 170 | Fold-check float flake | ops | alarm deafness | integer/decimal-stable outputs; one week staging burn-in | M3 |
| 171 | Seams + geometry outside '111 green' | ops | unverified learner-visible renders | qari worklist includes seam renders (budgeted); geometry mechanically validated + spot visual QA | M9 |
| 172 | Qari reviews 13 variants × 3 strengths per ayah | ops | 10h estimate off by an integer multiple | scope decision: qari certifies content surface + SAMPLES renders; honest budget 15–25h | M9 |
| 173 | Streak monitor coverage ~0% on old events | ops | monitor measures nothing | greenfield events carry tz from day one; coverage-below-threshold alert | M3 |
| 174 | Stall map not surah-keyed | ops | E-01 collision in analytics | all analytics keys carry surah; asserted | M11 |
| 175 | Next admin console vs Laravel auth glue | ops | hand-waved cross-stack session | Sanctum same-site cookie domain decided at M8 start; step-up auth for reveal/kill | M8 |
| 176 | Launch gate scoped to Yusuf while first screens serve 112/103/second surah | ops | unverified Quran on the landing page | qari gate scope = ALL launch-serving surahs incl. onboarding + landing demo content | M9/M10 |
| 177 | Agent edits v1/v2 | agent | corrupts frozen trees | CI path guard hard-fails; v2 fixes are a separate human decision | M0 |
| 178 | Arabic literals via escapes, presentation forms, PHP/JSON | agent | B1 keyboard path reopened | grep covers U+0600–06FF, U+0750+, U+FB50–FDFF, U+FE70–FEFF, \u-escapes, fromCharCode, across .ts/.tsx/.php/.json/.sql; tests reference fixture coordinates, never inline Arabic | M0 |
| 179 | Verifier context contamination / PLAUSIBLE-block abuse | agent | rubber-stamp or infinite block | fresh instance, diff+INVARIANTS+DEFECTS only; CONFIRMED needs a concrete violating input; determinism-class findings escalate to human even when PLAUSIBLE | M0 |
| 180 | Agent edits oracle to pass its own tests; spine legitimately invalidates oracle | agent | self-grading / stale oracle | oracles label-gated; scripted regeneration + human diff is a SCHEDULED step in E-01/port/ordinal items | M0/M2 |
| 181 | Two lanes edit engine types | agent | schema races | ownership map: spine lane exclusive on engine types + event schema | M0 |
| 182 | Purity leak via local-date getters (the daybound class) | agent | tz-dependent fold | lint bans Date.now, Math.random, crypto, zero-arg new Date() AND getFullYear-class getters in engine | M0/M2 |
| 183 | Rung widened / CorpusRef literal member | agent | authenticity break | type-level compile-error-on-widen tests | M0 |
| 184 | Quiz/compiler work tested only on Yusuf | agent | degenerate ICP breaks in prod | 103+112 fixtures mandatory in every quiz/compiler brief; full-corpus admit run in CI | M0/M4 |
| 185 | Fixed seeds = 3 frozen permutations forever | agent | determinism theater | commit-derived varying seeds + failure-seed pinning; 2-device merge scenario in suite | M2 |
| 186 | test-writer and implementer collapsed | agent | tests written to fit code | separate dispatches; red observed before implementation starts | M0 |
| 187 | Migration precondition false on a dev DB | agent | silent guessing | upgrade asserts precondition, aborts loudly | M2 |
| 188 | Worktrees corrupt shared lockfile | agent | broken installs | lockfile changes spine-only; others frozen-lockfile | M0 |
| 189 | Agent machine-fills MS glosses to be helpful | agent | doctrinal risk | scaffold-empty only; populated MS outside the flagged draft table fails review | M9 |
| 190 | UI re-derives engine decisions (B2 pattern) | agent | invariant 6 leak | ui-builder success = grep-clean JSX for rung/schedule/selection conditionals | M5 |
| 191 | Invariants 1/3/4/5 have no mechanical check | agent | silent erosion — the existential risk | property pack in invariant-gate: per-word-atom detector, pretest-exclusion, damping/spacing, freeplay-lifecycle; golden log contains a triggering event for EACH | M0/M2 |
| 192 | Compiler merged during the selection-check gap | agent | blind merge of hardest artifact | selection check is a hard merge precondition; corrected order lands it first anyway | M2/M4 |
| 193 | Agents follow the stale 30-step order | agent | known flaws rebuilt | CLAUDE.md names the corrected order as sole authority | M0 |
| 194 | Social code before the flag plane | agent | §20 violation | CI guard: social paths require flag-provider import; social is post-launch regardless | M8/M11 |
| 195 | Landing built early without its demo | agent | old 17/29 bug reintroduced | landing is M10, after M5 components + M1 112 corpus | M10 |
| 196 | Pricing hardcoded wrong | agent | v3-D07 drift | config constants in ONE file + a test quoting v3-D07 | M7 |
| 197 | Arabic rendering (ligatures/harakat/bidi) unverifiable by agents | agent | sacred-text rendering defect ships | human visual QA gate + screenshot-diff suite over Arabic surfaces on every corpus/font change | M5/M9 |
