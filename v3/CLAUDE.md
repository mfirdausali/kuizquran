# v3 — read this first

## Never touch these

- **`v1/**`** — frozen. Shipped to staging. Read-only source for
  `v1/styles/iman-ui.css` and `v1/packages/corpus-compiler/src/**`.
- **`v2/**`** — the working app and v3's port source. **Read-only.** v3 is a new
  generation (v3-D01), not a migration. Parity oracle SHA: **`c34f5c3`**.

CI hard-fails any diff touching either tree.

## The authorities

| File | What it settles |
|---|---|
| `v3/INVARIANTS.md` | The 6 invariants + purity + sacred-text. Injected at the top of every brief. |
| `v3/DECISIONS.md` | v3-D08…v3-D24. Every open question has a ratified default — **nothing blocks on a human.** |
| `v3/DEFECTS.md` | B1–B9, E-01…E-08. Each names its milestone and closing test. |
| `v3/docs/BUILD-PLAN.md` | The 32-step order and the milestones. **Sole authority** — it supersedes WIREFRAME §26. |
| `v3/docs/WIREFRAME.md` | The specification: what the product *is*. |

If two documents disagree, the order above wins.

## The rules that are not negotiable

1. **`v3/INVARIANTS.md` outranks the task.** A change that breaks an invariant is
   wrong, however well it satisfies the brief.
2. **Never write Quranic Arabic.** Not in code, not in a test, not in a fixture.
   Tests reference fixture *coordinates*. `CorpusRef` has no literal member.
3. **RED before green.** Tests are committed and observed failing in a separate
   step before implementation starts.
4. **Never regenerate an oracle to make your own tests pass.** Golden log,
   fixtures and snapshots are human-approved. That is self-grading (H14).
5. **The engine is pure.** No DOM, no IO, no `Date.now`, no `Math.random`, no
   zero-arg `new Date()`, no local-date getters. `now` and `tz` are passed in.

## Ordering that will corrupt data if violated

- **E-01 surah-keying lands before any second-surah artifact exists** — corpus,
  fixture, enrollment or event. Afterwards the merge is unrepairable.
- **B4 `(createdAt, id)` lands before the first verification hash row.**
- **B6 semantics freeze before the wire freezes** — `gradeClass` is a wire field.
- **The wire freezes once, complete** — three consumers read it.
- **Site / admit / visitOrdinal land before the question compiler** consumes them.
- **`selection_determinism_check` is green before any compiler merge.**
- **`AUTH-` closes before any `PAY-` task.** No password reset today; an RM500
  lifetime buyer who forgets their password loses everything.

Full list: `BUILD-PLAN.md` §5, H1–H15.

## Running it

```bash
make setup   # once
make dev     # SPA :5273, API :8000
make test    # 2541 passing (+2 incomplete, PAY-1, by design), typechecks first.
             # 255 v2 vitest + 47 v2/api + 351 v3/api + 118 corpus-compiler
             # + 420 engine + 61 fold-runner + 1289 apps/web. (v3-D170, 2026-09-03)
             # NOTE (v3-D170, 2026-09-03): `GlossDraftRow.note` — the
             # author's own note, captured by `GlossDraftsPanel.tsx`'s own
             # "Note (optional)" form field at draft time, persisted
             # (`gloss_drafts.note`), and sent on the wire on every row
             # (`GlossDraftsController.php:317`) — was never rendered
             # anywhere in the table. Only a REVIEW's own note (one layer
             # down, inside the History `<details>`, wired at v3-D156/D160)
             # was shown; the draft's own current note — where an author
             # flags e.g. "checked against Basmeih, unsure of register"
             # BEFORE a reviewer decides "Mark reviewed" — was invisible.
             # Same "written, wire-carried, zero read surface" shape this
             # build has closed on this SAME `GlossDraftsPanel.tsx` twice
             # already (`authorKind`/`authoredBy` at v3-D169, `textAtReview`
             # at v3-D160), one field over each time. Found by a fresh
             # Explore-agent sweep directed away from every already-known
             # instance of this bug class; the sweep also independently
             # surfaced (not fixed this run): `QuestionOverride.note` never
             # rendered in `OverrideEditor.tsx`'s history list (self-named
             # open since v3-D163); `FlagRow.ackAt` never rendered on
             # `FlagsPanel.tsx`'s own row (weaker — redundant with
             # `FlagAuditPanel.tsx`). Fixed, display-only, no server/wire
             # change: one new "Note" column between "Authored by" and
             # "Reviewed by", rendering `row.note ?? "—"` — the panel's own
             # existing null-fallback convention. RED confirmed directly
             # against the unmodified component (11 pre-existing cases in
             # `test/gloss-drafts-panel.test.tsx` untouched): a strengthened
             # assertion on the existing READY-state test
             # (`getAllByText("—")` expected to double from 1 to 2, since
             # DRAFT_ROW's own `note` is null) failed at 1; a new dedicated
             # case rendering a non-null note failed on `getElementError`
             # (no such node). Implemented, reran: 13/13 green (was 11).
             # `TZ=UTC make test`: 2541 passing (was 2540, +1 — exactly this
             # run's one net-new `it()` block; the em-dash-count assertion
             # was added to an EXISTING test, so it carries no separate
             # count; apps/web 1289, was 1288; no other suite moved).
             # `check-test-floor.mjs`: OK, 2541 >= floor 1899 (+642 margin,
             # unmoved). `TZ=UTC make build`: exit 0, 29 routes (unchanged —
             # edits inside the existing `/settings/gloss-drafts` component,
             # no new route). `npm run gates`: all green (boundaries 295
             # files, unchanged count — one existing production file edited
             # plus its one existing test file, no new production file;
             # fonts degraded-but-non-blocking, pre-existing; corpus-
             # morphology and corpus-glyphs unchanged). `npx tsc --noEmit`:
             # clean. Session start: fresh container, `make setup` run from
             # scratch; local `main` was found one branch-checkout away from
             # a stale ref (`68bf199`, v3-D159) versus `origin/main`'s real
             # tip (`f4197b5`, v3-D169) — the recurring "stale local main"
             # trap v3-D77/D91/D127/D138/D159/D167 each independently hit —
             # caught before any exploration via `git fetch` + `git checkout
             # main && git merge --ff-only origin/main`, no work lost or at
             # risk. No `v1/**`/`v2/**` edit (stray `v2/tsconfig.tsbuildinfo`
             # reverted before committing, same discipline as every prior
             # entry). No Arabic codepoint (the diff swept programmatically
             # over the Arabic, Arabic Supplement, Arabic Extended-A and
             # both Presentation Forms Unicode blocks, plus a `\u06xx`/
             # `\u08xx`-escape and `fromCharCode` sweep — zero matches;
             # every new string is a fixed English column header or a plain
             # English placeholder note, matching this file's own "NO MALAY
             # CONTENT ANYWHERE" header). NOT addressed:
             # `QuestionOverride.note` in `OverrideEditor.tsx`;
             # `FlagRow.ackAt` in `FlagsPanel.tsx`; `rhymeClassOf()`
             # (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution`
             # (v3-D148); `lib/pricing.ts#regionFromCountry()` (v3-D163);
             # `PaywallGate` as a whole class (v3-D88, v3-D151); multi-surah
             # enrollment; the operational mailer/7-night window; PAY-1's
             # Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); the late-arrival refold half of v3-D32;
             # `AccountDeletionRequest::isDue()` (v3-D146);
             # `lib/i18n/dictionaries.ts#isLocale()`; `BillingEventsPanel
             # .tsx`'s single-event detail view (v3-D166);
             # `SystemHealthController::METRICS`'s `atom_cache_coverage`/
             # `events_ingested_24h` (v3-D168) — all unchanged. See
             # DECISIONS.md v3-D170.
             # NOTE (v3-D169, 2026-09-02): `GlossDraftsPanel.tsx` fetched and
             # typed `authorKind`/`authoredBy` (`lib/admin/glossDrafts.ts
             # #GlossDraftRow`, required by `isGlossDraftRow()`'s own runtime
             # check) since the gloss-draft workflow shipped (v3-D145) —
             # `GlossDraftsController::toWire()` sends both on every row,
             # backed by real `author_kind`/`authored_by` columns
             # (`gloss_drafts` migration, `store()` sets both from the admin's
             # form input) — but the one screen that lists an ayah's drafts
             # never rendered either: six columns (Pos/Status/Text/Reviewed
             # by/History/Action), no seventh naming who — or what — wrote the
             # draft. Same "written, wire-carried, zero read surface" shape
             # this build has closed repeatedly on sibling review-workflow
             # surfaces (`Override::editor()` v3-D163, `gloss_draft_reviews`'
             # own history v3-D156/D160, `ayah_verifications`' per-row history
             # v3-D167) — here on the SAME `GlossDraftsPanel.tsx` those
             # entries already touched, one field over. Sharper consequence
             # than most instances of this class: the panel's own "Author"
             # form field exists precisely so a reviewer can later tell an
             # AI-drafted gloss from a human-authored one — v3-D15/D20's "LLM
             # MS... human review mandatory before `reviewed`" depends on
             # knowing which drafts came from an LLM batch — and a reviewer
             # could see WHO reviewed a draft but never who (or what) wrote it
             # in the first place. Fixed, display-only, no server/wire change:
             # one new "Authored by" column rendering `` `${authorKind ===
             # "ai" ? "AI draft" : "human"} · ${authoredBy ?? "—"}` `` — "—"
             # only for a null `authoredBy`, never a fabricated name, matching
             # the panel's existing "—" convention for `reviewedBy` exactly.
             # RED confirmed directly: reverting the component alone (both new
             # test cases kept — one assertion added to the existing
             # READY-state test, one new dedicated case for an AI-authored
             # row with a null `authoredBy`) failed exactly 2 of 12 in
             # `gloss-drafts-panel.test.tsx`, 10 pre-existing cases unaffected;
             # restored byte-identically, 12/12 green. The negative case
             # proves the null-author fallback is real (`AI draft · —` renders
             # and the human-author string does not) rather than merely
             # proving the happy path. `TZ=UTC make test`: 2540 passing (was
             # 2539, +1 — exactly this run's one net-new `it()` block; apps/web
             # 1288, was 1287; no other suite moved). `check-test-floor.mjs`:
             # OK, 2540 >= floor 1899 (+641 margin, unmoved). `TZ=UTC make
             # build`: exit 0, 29 routes (unchanged — edits inside the
             # existing `/settings/gloss-drafts` component). `npm run gates`:
             # all green (boundaries 295 files, unchanged count — one
             # existing production file edited plus its one existing test
             # file, no new production file; fonts degraded-but-non-blocking,
             # pre-existing). `npx tsc --noEmit`: clean. No `v1/**`/`v2/**`
             # edit (stray `v2/tsconfig.tsbuildinfo` reverted before
             # committing, same discipline as every prior entry). No Arabic
             # codepoint (the diff swept programmatically over the Arabic,
             # Arabic Supplement, Arabic Extended-A and both Presentation
             # Forms Unicode blocks, plus a `\u06xx`/`\u08xx`-escape and
             # `fromCharCode` sweep — zero matches; every new string is a
             # fixed English column header, the literal words "AI
             # draft"/"human"/"—", or the pre-existing fixture's synthetic
             # "admin@example.com" placeholder, never corpus or gloss
             # content). NOT addressed: `SystemHealthController::METRICS`'s
             # `atom_cache_coverage`/`events_ingested_24h` (v3-D168, a known,
             # reasoned omission); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate`
             # as a whole class (v3-D88, v3-D151); multi-surah enrollment;
             # the operational mailer/7-night window; PAY-1's Stripe
             # fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); the late-arrival refold half of v3-D32;
             # `AccountDeletionRequest::isDue()` (v3-D146);
             # `lib/i18n/dictionaries.ts#isLocale()`; `BillingEventsPanel
             # .tsx`'s single-event detail view (v3-D166) — all unchanged.
             # See DECISIONS.md v3-D169.
             # NOTE (v3-D168, 2026-09-02): `BillingAuditPanel.tsx`'s own
             # "EVERY FIELD IS RENDERED VERBATIM" header claim was false for
             # `providerEventId` — fetched, typed and validated
             # (`lib/admin/billingAudit.ts#BillingAuditEntry`) since
             # `AdminBillingController::index()` first put it on the wire
             # (v3-D147/D148 era), a genuine non-synthetic column
             # (`entitlement_transitions.provider_event_id`, written by
             # `EntitlementMachine::apply()` on every webhook-caused
             # transition), but never rendered by the one panel that exists
             # to show this history: the table had exactly 7 columns (When/
             # Learner/From/To/Cause/Actor/Reason), no eighth. Same
             # "docblock claims X, grep proves Y" / "fetched, typed, zero
             # read surface" shape this build has closed on sibling audit
             # panels (admin_audit's ip/requestId at v3-D164, the flag-kill
             # ceremony's booleans at v3-D165, BillingEventsPanel's own
             # providerCreatedAt/processedAt at v3-D166 — a DIFFERENT panel
             # reading billing_events, not entitlement_transitions —
             # ayah_verifications' own history at v3-D167) — here on the one
             # sibling panel none of those five touched. An operator
             # reconciling a webhook-caused entitlement flip against
             # Stripe's own dashboard had no way to find the specific event
             # that caused it, only the literal string "webhook". Fixed,
             # display-only, no server/wire change: one new "Provider event"
             # column between Cause and Actor, rendering `e.providerEventId
             # ?? "—"` — "—" for every non-webhook cause (trial_start,
             # admin_override, reconcile), matching this table's own
             # existing "—" convention for fromState/reason exactly. RED
             # confirmed directly: a new `screen.getByText("evt_1")`
             # assertion added to the pre-existing READY-state test (whose
             # own fixture already carried `providerEventId: "evt_1"` on the
             # webhook row, set at v3-D147/D148 and never previously
             # asserted on) failed against the unmodified component exactly
             # as predicted — the rendered DOM's row ran When→Learner→From→
             # To→Cause→Actor→Reason with no eighth cell; the same test's
             # em-dash count (previously 3) was updated to 4 in the same
             # edit, since trial-start's own `providerEventId` is also null
             # and the new column adds one more "—" cell. Implemented,
             # reran: 9/9 green, unchanged file count (no new `it()` block —
             # the RED was carried entirely by strengthening an existing
             # test's assertions, so the apps/web test count is +0 net).
             # `TZ=UTC make test`: 2539 passing (unchanged from v3-D167's own
             # count — no new test file or case; apps/web 1287, unchanged;
             # no suite moved). `check-test-floor.mjs`: OK, 2539 >= floor
             # 1899 (+640 margin, unmoved). `TZ=UTC make build`: exit 0, 29
             # routes (unchanged — edits inside the existing
             # `/settings/billing` component). `npm run gates`: all green
             # (boundaries 295 files, unchanged count — one existing
             # production file edited plus its one existing test file, no
             # new production file; fonts degraded-but-non-blocking,
             # pre-existing). `npx tsc --noEmit`: clean. No `v1/**`/`v2/**`
             # edit (stray `v2/tsconfig.tsbuildinfo` reverted before
             # committing, same discipline as every prior entry). No Arabic
             # codepoint (the diff swept programmatically over the Arabic,
             # Arabic Supplement, Arabic Extended-A and both Presentation
             # Forms Unicode blocks — zero matches; the only new string is a
             # fixed English column header, and the rendered values are
             # either the pre-existing fixture's synthetic "evt_1"
             # placeholder or the table's own existing "—" fallback, never
             # corpus text). Session start: this run began on a detached
             # HEAD one commit ahead of a stale local `main` — a leftover
             # from the PRIOR session's own v3-D167 recovery, not a fresh
             # trap — and `git fetch origin main` showed `origin/main`
             # already at that same tip (the prior session's push had
             # landed cleanly), so `git checkout main && git merge
             # --ff-only origin/main` fast-forwarded safely; the "stale
             # local main" shape v3-D77/D91/D127/D138/D159/D167 each
             # independently hit was checked for directly and did not
             # recur. NOT addressed: `SystemHealthController::METRICS`
             # declaring `atom_cache_coverage`/`events_ingested_24h` as
             # registered members `index()` never computes is already
             # self-documented as a deliberate, reasoned omission in
             # `SystemHealthPanel.tsx`'s own header, not a new finding;
             # `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution`
             # (v3-D148); `lib/pricing.ts#regionFromCountry()` (v3-D163);
             # `PaywallGate` as a whole class (v3-D88, v3-D151); multi-surah
             # enrollment; the operational mailer/7-night window; PAY-1's
             # Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); the late-arrival refold half of v3-D32;
             # `AccountDeletionRequest::isDue()` (v3-D146);
             # `lib/i18n/dictionaries.ts#isLocale()`; `BillingEventsPanel
             # .tsx`'s single-event detail view (v3-D166) — all unchanged.
             # See DECISIONS.md v3-D168.
             # NOTE (v3-D167, 2026-09-02): `/workbench`'s per-ayah verification
             # history (`ayah_verifications.verified_by`/`.note`/`.created_at`,
             # sent whole on `VerificationsController::index()`'s
             # `verifications` field since step 15) was fetched and typed
             # client-side (`lib/workbench/frontier.ts#VerificationRow`) and,
             # since v3-D152, reduced to ONE aggregate boolean via
             # `describeCertification()` — but no single row ever reached a
             # screen. An admin/qari opening an ayah saw today's chip and, for
             # a few seconds after their OWN submission, that one outcome —
             # never who signed a PRIOR verification, when, or their review
             # note. Same "written/fetched, zero read surface" shape closed
             # six times before on other tables (admin_audit, flag_ramp_audit,
             # entitlement_transitions, purge_ledger, gloss_draft_reviews,
             # billing_events) — here on `ayah_verifications` itself, GATE-A's
             # own launch-blocking table. Fixed, display-only, no server/wire
             # change: `verifications.ts#FrontierLoad`'s `ready` state gains a
             # `verifications: readonly VerificationRow[]` field (the same
             # array `certification` is already computed from);
             # `WorkbenchIsland.tsx` filters it to the open ayah and passes it
             # to `QariMode.tsx` as a new optional `history` prop, rendered as
             # a "Signature history for this ayah" list (tier, reviewer kind,
             # `verifiedBy ?? "—"`, `new Date(createdAt).toISOString()`, the
             # note when present) above the signing form. RED confirmed
             # directly: `git stash` of the three source files (every test
             # kept, plus nine pre-existing `FrontierNavigator`-only test
             # literals in `workbench-ui.test.tsx` that needed a
             # `verifications: []` field to satisfy the newly-required type)
             # failed exactly the 7 new cases — 2 in `loadFrontier` (the raw
             # array is carried through / defaults to `[]`), 1 real
             # `WorkbenchIsland`-level wiring test (renders ayah 1's own
             # reviewer, hides ayah 2's, re-scopes on an ayah change via the
             # real Ayah number input, against the frozen 12.json fixture),
             # and 4 in `QariMode` (renders all five fields; falls back to
             # "—" for a null `verifiedBy` and drops a null note rather than a
             # stray ": —"; says so honestly when history is empty; stays
             # crash-free with the prop omitted) — the other 34 cases in those
             # two files unaffected; restored byte-identically, all green.
             # `TZ=UTC make test`: 2539 passing (was 2532, +7 — exactly this
             # run's new tests; apps/web 1287, was 1280; no other suite
             # moved). `check-test-floor.mjs`: OK, 2539 >= floor 1899 (+640
             # margin, unmoved). `TZ=UTC make build`: exit 0, 29 routes
             # (unchanged — edits inside the existing `/workbench` component
             # tree). `npm run gates`: all green (boundaries 295 files,
             # unchanged count — no new production file, three existing files
             # edited plus their two existing test files; fonts
             # degraded-but-non-blocking, pre-existing). `npx tsc --noEmit`:
             # clean (making `verifications` REQUIRED, not optional, surfaced
             # nine pre-existing `FrontierNavigator`-only literals that needed
             # the field added — each is `FrontierNavigator`-scoped and never
             # touches `verifications`, so `[]` is the correct value, not a
             # workaround). No `v1/**`/`v2/**` edit (stray
             # `v2/tsconfig.tsbuildinfo` reverted before committing, same
             # discipline as every prior entry). No Arabic codepoint (full
             # diff swept over every Arabic block plus both Presentation
             # Forms blocks, plus a `\u06xx`/`\u08xx`-escape and
             # `fromCharCode` sweep — zero matches; every new string is a wire
             # field name, an ISO timestamp derived from a fixture integer, a
             # fixture coordinate, or a synthetic placeholder email/note,
             # never corpus text). PROCESS NOTE: this session hit the
             # identical "stale local `main` ref" trap v3-D77/D91/D127/D138/
             # D159 each named before — an early `git checkout main`, before
             # any exploration, silently moved HEAD from the real tip
             # (`b7535af`, v3-D166) onto a stale local `main` seven commits
             # behind (`68bf199`, v3-D159). Caught via `git log -- v3/
             # CLAUDE.md` disagreeing with this session's own earlier `git
             # log -1` — before any commit was made. Recovered with `git
             # stash` of the uncommitted fix, `git fetch origin main` + `git
             # merge --ff-only origin/main` (zero risk to work in progress),
             # `git stash pop`, then a full re-verification against the
             # corrected tree before writing this note or committing — see
             # DECISIONS.md v3-D167's own process note for the full account.
             # NOT addressed: `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate`
             # as a whole class (v3-D88, v3-D151); multi-surah enrollment;
             # the operational mailer/7-night window; PAY-1's Stripe
             # fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); the late-arrival refold half of v3-D32;
             # `AccountDeletionRequest::isDue()` (v3-D146);
             # `lib/i18n/dictionaries.ts#isLocale()`; `BillingEventsPanel.tsx`'s
             # single-event detail view (v3-D166) — all unchanged. See
             # DECISIONS.md v3-D167.
             # NOTE (v3-D166, 2026-09-02): `BillingEventsPanel.tsx` — named by
             # v3-D164's own "NOT addressed" list and repeated unchanged by
             # v3-D165's — fetched `providerCreatedAt`/`processedAt`
             # (`lib/admin/billingEvents.ts#BillingEventEntry`, sent in full
             # by `BillingEventsController::index()` since v3-D148) but
             # rendered neither; the table showed only `receivedAt` (when
             # this server first saw the delivery), a materially different
             # timestamp from Stripe's own `created` or from when processing
             # actually finished. The header's "EVERY FIELD IS RENDERED
             # VERBATIM" claim was false for two of eight fields — the same
             # shape as `FlagAuditPanel.tsx`'s (v3-D165) and
             # `AuditLogPanel.tsx`'s (v3-D164) own dropped fields, the third
             # and last of the three v3-D164's sweep found. `processedAt` is
             # the one field the journal's own docblock says it exists to
             # make visible ("a crash mid-handler leaves a replayable row
             # rather than a silently-lost event") — an operator had no way
             # to see it at all. Fixed, display-only, no server/wire change:
             # two new columns, "Provider created" and "Processed", next to
             # the existing "Received" column, each an ISO-8601 string or
             # the table's existing "—" placeholder when null (both fields
             # are genuinely nullable) — never a fabricated timestamp.
             # RED confirmed directly: `git stash` of
             # `BillingEventsPanel.tsx` alone (both new tests kept, 6
             # pre-existing cases untouched) failed exactly the 2 new cases
             # in `billing-events-panel.test.tsx`, 6 unaffected; restored
             # byte-identically, 8/8 green. The positive case's
             # `processedAt` fixture value is 100ms off `receivedAt` so
             # `getByText` cannot match the wrong column; the null case's
             # fixture keeps `subjectPseudonym`/`error`/`outcome` non-null so
             # its two counted "—"s can only come from the two new columns.
             # `TZ=UTC make test`: 2532 passing (was 2530, +2 — exactly this
             # run's new tests; apps/web 1280, was 1278; no other suite
             # moved). `check-test-floor.mjs`: OK, 2532 >= floor 1899 (+633
             # margin, unmoved, same discipline as every prior entry).
             # `TZ=UTC make build`: exit 0, 29 routes (unchanged — no new
             # route; edits inside an existing component on the existing
             # `/settings/billing` route). `npm run gates`: all green
             # (boundaries 294 files, unchanged count — one existing file
             # edited plus its test, no new production file; fonts
             # degraded-but-non-blocking, pre-existing; corpus-morphology
             # and corpus-glyphs unchanged). `npx tsc --noEmit`: clean. No
             # `v1/**`/`v2/**` edit (stray `v2/tsconfig.tsbuildinfo`
             # reverted before committing, same discipline as every prior
             # entry). No Arabic codepoint (full diff swept over every
             # Arabic block plus both Presentation Forms blocks, plus a
             # `\u06xx`/`\u08xx`-escape and `fromCharCode` sweep — zero
             # matches; every new string is a fixed English column header or
             # an ISO timestamp derived from a fixture integer, never corpus
             # text). With this, all three sibling gaps v3-D164's sweep
             # found are closed — a future sweep should look elsewhere for
             # the next instance of this bug class. NOT addressed:
             # `BillingEventsPanel.tsx` still has no single-event detail
             # view (the raw `payload` is deliberately never sent at all —
             # a different, smaller follow-up); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148);
             # `lib/pricing.ts#regionFromCountry()` (v3-D163); `PaywallGate`
             # as a whole class (v3-D88, v3-D151); multi-surah enrollment;
             # the operational mailer/7-night window; PAY-1's Stripe
             # fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127); `packages/engine/src/placement.ts`
             # (v3-D111/D113/D123); the late-arrival refold half of v3-D32;
             # `AccountDeletionRequest::isDue()` (v3-D146);
             # `lib/i18n/dictionaries.ts#isLocale()` — all unchanged. See
             # DECISIONS.md v3-D166.
             # NOTE (v3-D165, 2026-09-01): `FlagAuditPanel.tsx` — v3-D164's own
             # "NOT addressed" list named this exactly — fetched all four of
             # the enable-hard ceremony's inputs (`lib/admin/flagAudit.ts
             # #FlagAuditEntry`: `reason`, `acknowledgesRetentionRisk`,
             # `acknowledgesNoDarkPattern`, `typedFlagName`, all sent by
             # `FlagAuditController::index()`) but rendered only `reason` —
             # the same "fetched and discarded" shape v3-D164 fixed for
             # `BillingEventsPanel.tsx`'s `processedAt`/`providerCreatedAt`,
             # here one surface over. The panel's own header claimed "EVERY
             # FIELD IS RENDERED VERBATIM" — false for the two safety
             # checkboxes and the typed-name confirmation, the three fields
             # `FlagController::store()`'s ceremony validation actually
             # requires (`>=20-char reason` *and* both booleans `true` *and*
             # `typed_flag_name` matching the flag key exactly) before an
             # "enable" row can exist at all — an operator reviewing "who
             # ramped this flag back on" could see the reason but not
             # whether the two ethics acknowledgements or the typed
             # confirmation were ever genuinely made. Fixed, display-only,
             # no server change: three new columns ("Retention ack", "No
             # dark pattern ack", "Typed name"). `flag_ramp_audit`'s two
             # boolean columns default `false` and `typed_flag_name` is
             # `null` for every OTHER action (`kill`/`ack`/`auto_waive` —
             # `FlagService::kill()`/`acknowledgeKill()` never touch the
             # ceremony fields at all) — rendering `false` there as a literal
             # "no" would read as a person's real answer to a ceremony that
             # was never presented, so all three cells fall back to "—"
             # (never a fabricated "no") whenever `action !== "enable"`,
             # matching this table's own existing "system" (never a blank
             # cell) and `AuditLogPanel`'s v3-D164 "—" convention for
             # `ip`/`requestId` exactly. RED confirmed directly: `git stash`
             # of `FlagAuditPanel.tsx` alone (the new test kept) reran
             # `flag-audit-panel.test.tsx` — exactly the new ceremony-fields
             # case failed (`Unable to find an element with the text: yes`),
             # the 5 pre-existing cases in the file unaffected; restored
             # byte-identically (`git diff` empty), reran: 6/6 green. The
             # test's own auto_waive-row assertion (`queryByText("yes")` is
             # `null`) proves the "—" fallback is real, not merely that the
             # enable row happens to render "yes" somewhere on the page.
             # `TZ=UTC make test`: 2530 passing (was 2529, +1 — exactly this
             # run's one net-new test; apps/web 1278, was 1277; no other
             # suite moved: 255 v2 vitest, 47 v2/api, 351 v3/api, 118
             # corpus-compiler, 420 engine, 61 fold-runner). `check-test-
             # floor.mjs`: OK, 2530 >= floor 1899 (+631 margin, unmoved,
             # same discipline as every prior entry). `TZ=UTC make build`:
             # exit 0, 29 routes (unchanged — no new route; this edits
             # inside an existing `/settings/flags` component). `npm run
             # gates`: all green (boundaries 295 files, unchanged count —
             # no new production file, two existing files edited; fonts
             # degraded-but-non-blocking, pre-existing). `npx tsc --noEmit`:
             # clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff produced by
             # running the suite was reverted before committing, same
             # discipline as every prior entry — `git status --porcelain --
             # v1 v2` empty immediately before commit). No Arabic codepoint
             # (the full diff swept over every Arabic block plus both
             # Presentation Forms blocks, plus a `\u06xx`/`\u08xx`-escape
             # and `fromCharCode` sweep — zero matches; every new string is
             # a wire field label or the literal words "yes"/"no"/"—", never
             # corpus text). NOT addressed, named so a future run doesn't
             # re-discover it as new: this run's own scope was scoped to the
             # single item v3-D164 named for `FlagAuditPanel.tsx` alone —
             # the sync layer's own zero-caller sweep (v3-D88 onward) and
             # every other item on v3-D164's own longer "NOT addressed" list
             # (`rhymeClassOf()`, `EntitlementMachine::merge()`,
             # `App\Billing\TrialAttribution`, `PaywallGate`, multi-surah
             # enrollment, the operational mailer/7-night window, PAY-1's
             # Stripe fixtures, surah 67's scene beats,
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift,
             # `packages/engine/src/placement.ts`, the late-arrival refold
             # half of v3-D32, `AccountDeletionRequest::isDue()`) are
             # unchanged. See DECISIONS.md v3-D165.
             # NOTE (v3-D164, 2026-09-01): `admin_audit.ip`/`.request_id` were
             # stamped by all four writers (`AdminRevealController::reveal`,
             # `AdminUsersController::exportCsv`,
             # `SystemHealthController::rebuildAtomCache`,
             # `StripeSettingsController::test`) but `AdminAuditController
             # ::index()`'s wire map dropped both before the response left the
             # server — `AuditLogPanel.tsx`'s own "EVERY FIELD IS RENDERED
             # VERBATIM" header claim was false for the one detail that ties an
             # audit row to a concrete HTTP request. Fixed: the controller's
             # map gains `ip`/`requestId`; `lib/admin/audit.ts#AuditEntry` +
             # its validator require both; `AuditLogPanel.tsx` gains two
             # columns, each falling back to the existing "—" placeholder.
             # Neither is pseudonymized (an admin's own IP, not learner PII).
             # RED confirmed at both layers, each via `git stash` of the
             # source alone, tests kept: backend failed exactly the new
             # `test_ip_and_request_id_reach_the_wire` case (`Undefined array
             # key "ip"`), 5 others unaffected; frontend failed exactly 2 of
             # 14 vitest cases (the new missing-fields-become-unavailable
             # case, and the existing READY case updated to expect a second
             # "—" placeholder), 12 unaffected; both restored byte-identically
             # and reran green. `TZ=UTC make test`: 2529 passing (was 2526,
             # +3 — exactly this run's new tests: 1 + 2; v3/api 351, was 350;
             # apps/web 1277, was 1275; no other suite moved). `check-test-
             # floor.mjs`: OK, 2529 >= floor 1899 (+630 margin, unmoved).
             # `TZ=UTC make build`: exit 0, 29 routes (unchanged — edits
             # inside an existing `/settings/audit` component). `npm run
             # gates`: all green (boundaries 294 files, unchanged count — two
             # existing files edited, no new production file; fonts
             # degraded-but-non-blocking, pre-existing). `npx tsc --noEmit`:
             # clean. No `v1/**`/`v2/**` edit (stray `v2/tsconfig.tsbuildinfo`
             # reverted before committing, same discipline as every prior
             # entry). No Arabic codepoint (full diff swept over every Arabic
             # block plus both Presentation Forms blocks, plus a
             # `\u06xx`/`\u08xx`-escape and `fromCharCode` sweep — zero
             # matches; every new string is a wire field name or a synthetic
             # IP/request-id test fixture, never corpus text). NOT addressed:
             # `FlagAuditPanel.tsx` fetches all four kill-ceremony inputs but
             # renders only `reason` — the two safety checkboxes and the
             # typed-name confirmation are fetched and discarded, same shape,
             # separate scope; `BillingEventsPanel.tsx` similarly drops
             # `processedAt`/`providerCreatedAt`. Both real, both left for a
             # future run. See DECISIONS.md v3-D164.
             # NOTE (v3-D163, 2026-09-01): `App\Models\Override::editor()` — a
             # `BelongsTo<User>` relation, existing since the override layer
             # shipped (v2-D21/D55), its own docblock naming its purpose ("for
             # the editor's audit list") — had zero callers anywhere, not even
             # a test (`grep -rn "->editor\b" app tests` returned nothing
             # beyond the declaration). `OverridesController::toWire()` sent
             # only the raw `editor_id` integer as `editorId`, and
             # `OverrideEditor.tsx` (the one screen that lists an ayah's
             # override history, wired at v3-D125) never rendered it — an
             # admin correcting a gloss today and reopening the same ayah's
             # history tomorrow could not tell whether they, another admin,
             # or a qari made a given row. Fixed on the exact convention
             # `AyahVerification.verified_by` already set for "who did this"
             # display: `toWire()` gains `editorEmail` (`$r->editor?->email`,
             # `index()` eager-loading `with('editor')`, `store()` setting
             # the relation directly from `$request->user()`), the wire type
             # (`overrides.ts#QuestionOverride`) gains a matching
             # `editorEmail?: string | null`, and `OverrideEditor.tsx`
             # renders `{summarize(o)} — by {o.editorEmail ?? "—"}` — `"—"`
             # for a pre-fix row or a deleted editor account, never a guess.
             # RED confirmed directly: `git stash` of the three source files
             # only (both test files, including the new cases, kept) failed
             # exactly the new cases — backend 1, frontend 2 — 8 and 12 other
             # cases respectively unaffected; restored byte-identically,
             # 9/9 + 14/14 green. `TZ=UTC make test`: 2526 passing (was 2523,
             # +3 — exactly this run's new tests: 1 + 2; v3/api 350, was 349;
             # apps/web 1275, was 1273; no other suite moved). `check-test-
             # floor.mjs`: OK, 2526 >= floor 1899 (+627 margin, unmoved).
             # `TZ=UTC make build`: exit 0, 29 routes (unchanged — no new
             # route; edits inside an existing `/workbench` component). `npm
             # run gates`: all green (boundaries 295 files, unchanged count —
             # no new production file, three existing files edited; fonts
             # degraded-but-non-blocking, pre-existing). `npx tsc --noEmit`:
             # clean. No `v1/**`/`v2/**` edit (stray `v2/tsconfig.tsbuildinfo`
             # reverted before committing, same discipline as every prior
             # entry). No Arabic codepoint (full diff swept over every Arabic
             # block plus both Presentation Forms blocks, plus a
             # `\u06xx`/`\u08xx`-escape and `fromCharCode` sweep — zero
             # matches; every new string is a fixed English label or a
             # synthetic placeholder email, never corpus text). NOT
             # addressed: the same `<li>` never renders a row's own `note`
             # field either — a smaller, separate, adjacent gap left alone;
             # `lib/pricing.ts#regionFromCountry()` — also found unit-tested
             # with zero production callers this run, but only because the
             # checkout flow that would call it doesn't exist yet, the
             # identical blocked-on-live-Stripe scope as `TrialAttribution`,
             # not an independent gap; `lib/i18n/dictionaries.ts#isLocale()`
             # — confirmed a deliberate pre-launch scaffold seam, not a gap.
             # See DECISIONS.md v3-D163.
             # NOTE (v3-D162, 2026-09-01): `lib/sync/token.ts#isTokenDead()` —
             # v3-D161's own "NOT addressed" list named this exactly as "the
             # more complete follow-up to this entry, not a separate new
             # finding" — had answered "has a 401 been observed and not yet
             # recovered from" since B8 closed, unit-tested, with zero
             # production callers anywhere. `apiFetch.ts`'s 401 interceptor
             # calls `clearToken()` (marking the token dead) then attempts a
             # re-mint; if that mint ALSO fails (the endpoint down, or BRAKE
             # 3's 60s cooldown blocking a second attempt), the token stays
             # dead indefinitely with nothing on screen saying so — a learner
             # in this state saw the identical quiet "N waiting to sync"
             # caption an ordinary offline learner sees, with no way to learn
             # that "wait for network" would never be enough on its own.
             # Fixed on the exact template v3-D161 established one layer
             # over: `lib/sync/summary.ts#SyncSummary` gains a third field,
             # `authDead: boolean`; `SyncTrigger.tsx` reads `isTokenDead()`
             # directly (not derivable from `CycleResult`, which carries no
             # token-liveness field) at the moment each cycle finishes and
             # reports it alongside the existing two counts;
             # `SyncStatus.tsx` gains a matching optional `authDead?:
             # boolean` prop, defaulting to the live value via `??` (an
             # explicit `false` still wins over a live `true`). Unlike a
             # #110 quarantine, a dead token recovers on its own once a
             # later re-mint succeeds, so — like the other two fields —
             # it is reported as the CURRENT state every cycle, never
             # latched.
             #
             # RED confirmed directly: `git stash` of the three source files
             # only (every test file, including the pre-existing v3-D161
             # ones whose `toEqual` now expects a third key, kept) and
             # rerunning `lib/sync/summary.test.ts` + `test/sync-status
             # .test.tsx` + `test/sync-trigger.test.tsx` failed exactly 11 of
             # 31 cases (the new authDead-only cases plus the pre-existing
             # v3-D161 wiring assertion), 20 others unaffected; restored
             # byte-identically (`git diff` empty), reran: 31/31 green. The
             # `SyncTrigger` wiring test reproduces a REAL unrecovered 401
             # (a mocked `/api/events` 401 plus a mocked `/api/auth
             # /anonymous` 500, so the actual `clearToken()`/`mintAnonymous()`
             # chain runs and genuinely fails), not a stubbed flag; its
             # "clears again" companion needed one iteration — a first draft
             # dispatched a manual `focus` event moments after the failure
             # and expected immediate recovery, which failed on BRAKE 3's
             # real 60-second mint cooldown rather than on the fix itself,
             # fixed by switching to fake timers and letting the component's
             # own already-proven backoff-retry loop carry a later cycle
             # past the real cooldown.
             #
             # `TZ=UTC make test`: 2523 passing (was 2516, +7 — exactly this
             # run's new tests: 2 + 3 + 2; apps/web 1273, was 1266; no other
             # suite moved: 255 v2 vitest, 47 v2/api, 349 v3/api, 118
             # corpus-compiler, 420 engine, 61 fold-runner).
             # `check-test-floor.mjs`: OK, 2523 >= floor 1899 (+624 margin,
             # unmoved, same discipline as every prior entry). `TZ=UTC make
             # build`: exit 0, 29 routes (unchanged — no route/UI surface
             # added; both edited components are existing background/status
             # modules already mounted). `npm run gates`: all green (fonts
             # degraded-but-non-blocking, pre-existing; boundaries 295
             # files — no new production file, three existing files edited
             # plus their three existing test files; corpus-morphology and
             # corpus-glyphs unchanged by this diff). `npx tsc --noEmit`:
             # clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff produced by
             # running the suite was reverted before committing, same
             # discipline as every prior entry — `git status --porcelain --
             # v1 v2` empty immediately before commit). No Arabic codepoint
             # (the full diff swept programmatically over the Arabic,
             # Arabic Supplement, Arabic Extended-A and both Presentation
             # Forms Unicode blocks, plus a `\u06xx`/`\u08xx`-escape and
             # `fromCharCode` sweep — zero matches; every new string is a
             # fixed English status phrase, a boolean, or a plain fixture
             # token, never corpus text).
             #
             # NOT addressed, named so a future run doesn't re-discover it
             # as new: `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution`
             # (v3-D148); `PaywallGate` as a whole class /
             # `permitsIssuance`/`permitsReview` (v3-D88, v3-D151 — still a
             # genuine open product-design question, not a wiring gap);
             # multi-surah enrollment; the operational mailer/7-night window
             # (still needs a live host/SMTP/seven real nights); PAY-1's
             # Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127, deliberately not restructured);
             # `packages/engine/src/placement.ts` (a design choice,
             # v3-D111/D113/D123); the late-arrival refold half of v3-D32
             # (no automatic refold-on-ingest pipeline exists yet — real,
             # separate, larger scope); `AccountDeletionRequest::isDue()`
             # (v3-D146, a zero-caller convenience method deliberately left
             # alone) — all unchanged. With this, the sync layer's own
             # zero-caller sweep (v3-D88, D89, D90, D93, D94, D161, D162) is,
             # as far as this run could find, exhausted. See DECISIONS.md
             # v3-D162.
             # NOTE (v3-D161, 2026-08-31): `SyncStatus.tsx`'s own two
             # escalation props — `cannotSync` (#110, a permanently
             # quarantined oversize event) and `divergences` (#50, a payload
             # divergence found on pull) — have existed, been unit-tested,
             # and defaulted to `0` since build-plan step 21. Both counts are
             # computed for real on every single sync cycle
             # (`lib/sync/sync.ts#syncCycle`'s `CycleResult.quarantined`/
             # `.divergences`, fed by `outbox.ts#selectPending` and
             # `merge.ts#mergeFromServer`), but `SyncTrigger.tsx` — the ONE
             # place a real cycle ever runs — collapsed the whole result to
             # a single `degraded` boolean and discarded both arrays
             # entirely, and `home/page.tsx` mounts `<SyncStatus />` with no
             # props at all. So the escalation branch SyncStatus's own header
             # was built specifically to show ("'waiting' and 'cannot' are
             # different facts and must not share a number") could never
             # paint outside a test that hand-fed it a literal — a learner
             # whose device produced an oversize event, or whose pull hit a
             # genuine #50 divergence, saw the identical quiet "N waiting to
             # sync" caption an ordinary offline learner sees, forever, with
             # no way to learn that specific event will never sync. Found by
             # an Explore agent's fresh sweep for this build's recurring
             # "mechanism built and tested, zero production caller" class
             # (v3-D82 onward), directed away from ~30 already-closed
             # instances and the handful of named genuine non-gaps
             # (`rhymeClassOf`, `EntitlementMachine::merge`, `PaywallGate`,
             # etc.) so it would not re-report one of those.
             #
             # Fixed with a new module, not a prop-threading change through
             # a server component (`home/page.tsx` is a Server Component and
             # cannot hold live client state to pass down): `lib/sync/
             # summary.ts#syncSummary`, a module-level singleton with the
             # same `.current`/`.subscribe()` shape `lib/idb/writeLock.ts`'s
             # `WriteLock` already established for exactly this
             # cross-component-without-cross-importing problem.
             # `SyncTrigger` calls `syncSummary.report(result)` once per
             # completed cycle (a synchronous, side-effect-free write —
             # #103's "never blocks" contract is unchanged, this adds no
             # network call); `SyncStatus` reads it via a new
             # `useSyncSummary()` hook and falls back to the live value only
             # when its own `cannotSync`/`divergences` PROPS are omitted
             # (`??`, not a default-parameter `= 0`), so every existing test
             # that hands it a literal for isolated rendering is unaffected
             # and an explicit prop still wins. Neither component imports
             # the other, matching `SyncTrigger`'s own header ("no session,
             # drill or grading path may... read its state, because it has
             # none to read") — this is a dedicated side-channel for the one
             # user-facing purpose #103/#50/#110 already named, not an
             # exception to that rule.
             #
             # RED confirmed directly: `git stash` of the two component
             # files only (`SyncStatus.tsx`, `SyncTrigger.tsx` — the new
             # `lib/sync/summary.ts` module and all new tests kept) and
             # rerunning `test/sync-trigger.test.tsx` + `test/sync-status
             # .test.tsx` failed exactly the two new wiring-proof cases (a
             # real cycle over a genuinely oversize appended event — padded
             # via `specSnapshot`, over `EVENT_BYTE_MAX`, no Arabic anywhere
             # — never reached `syncSummary`; a bare `<SyncStatus />` mount
             # never painted the live count), 16 other cases in those two
             # files unaffected; restored byte-identically (`git diff`
             # empty), reran: 24/24 green (9 new: 6 in the new
             # `lib/sync/summary.test.ts` for the store primitive itself, 1
             # in `sync-trigger.test.tsx`, 2 in `sync-status.test.tsx`). The
             # store-level tests also pin the load-bearing "overwrite, never
             # accumulate" property directly (`outbox.ts#selectPending`
             # re-scans and re-reports every still-quarantined row on every
             # cycle, so a LATER cycle with fewer quarantined rows must
             # drop the old count, never add to it) and that an unchanged
             # report is a no-op for subscribers (no re-render on an
             # identical value).
             #
             # `TZ=UTC make test`: 2516 passing (was 2507, +9 — exactly this
             # run's new tests; apps/web 1266, was 1257; no other suite
             # moved: 255 v2 vitest, 47 v2/api, 349 v3/api, 118
             # corpus-compiler, 420 engine, 61 fold-runner).
             # `check-test-floor.mjs`: OK, 2516 >= floor 1899 (+617 margin,
             # unmoved, same discipline as every prior entry). `TZ=UTC make
             # build`: exit 0, 29 routes (unchanged — no route/UI surface
             # added; both edited files are existing background/status
             # components already mounted). `npm run gates`: all green
             # (fonts degraded-but-non-blocking, pre-existing; boundaries
             # 294 files, up from 293 — exactly the one new production file,
             # `lib/sync/summary.ts`; corpus-morphology and corpus-glyphs
             # unchanged). `npx tsc --noEmit`: clean. No `v1/**`/`v2/**` edit
             # (a stray `v2/tsconfig.tsbuildinfo` build-cache diff produced
             # by running the suite was reverted before committing, same
             # discipline as every prior entry — `git status --porcelain --
             # v1 v2` empty immediately before commit). No Arabic codepoint
             # (every new/changed file swept programmatically over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks, plus a `\u06xx`/`\u08xx`-
             # escape and `fromCharCode` sweep — zero matches; the one
             # oversize test fixture pads with a plain ASCII filler string,
             # never Arabic, and every fixture coordinate is a plain surah/
             # ayah integer matching this file's own established
             # convention).
             #
             # NOT addressed, named so a future run doesn't re-discover it
             # as new: `lib/sync/token.ts#isTokenDead()` has the identical
             # zero-caller shape one layer over — no UI distinguishes "sync
             # is stuck because the device's token died and hasn't recovered
             # yet" from ordinary pending/offline, and is partially subsumed
             # by `sync.ts`'s own `degraded: "auth"` reason, which
             # `SyncTrigger` also still discards; `rhymeClassOf()`
             # (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution`
             # (v3-D148); `PaywallGate` as a whole class /
             # `permitsIssuance`/`permitsReview` (v3-D88, v3-D151 — still a
             # genuine open product-design question, not a wiring gap);
             # multi-surah enrollment; the operational mailer/7-night window
             # (still needs a live host/SMTP/seven real nights); PAY-1's
             # Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127, deliberately not restructured);
             # `packages/engine/src/placement.ts` (a design choice,
             # v3-D111/D113/D123); the late-arrival refold half of v3-D32
             # (no automatic refold-on-ingest pipeline exists yet — real,
             # separate, larger scope); `AccountDeletionRequest::isDue()`
             # (v3-D146, a zero-caller convenience method deliberately left
             # alone) — all unchanged. See DECISIONS.md v3-D161.
             # NOTE (v3-D160, 2026-08-31): `GlossDraftReview.text_at_review` —
             # the field the model's own docblock says exists for exactly the
             # B3 reason ("snapshots the bytes a reviewer actually approved...
             # an approval that does not name what was approved silently
             # survives an edit that invalidated it") — was captured on every
             # transition (`GlossDraftsController::review()` and `store()`'s
             # auto-un-review branch), threaded onto the wire as
             # `textAtReview` (`toWire()`), and typed client-side
             # (`lib/admin/glossDrafts.ts#GlossDraftReviewRow`), but
             # `GlossDraftsPanel.tsx` — the one screen v3-D156 built
             # specifically to surface this review history — never rendered
             # it: its history `<li>` printed `fromStatus`/`toStatus`/
             # `actor`/`note` only. One night after v3-D156 closed the
             # "history is written, never read" gap for this table, the
             # richest field of that same history repeated the identical
             # mistake one layer down: a reviewer can approve a gloss draft,
             # the row can later be edited (which `store()`'s own un-review
             # branch handles by returning it to `draft`), and the admin
             # looking at the History column would see that an edit
             # happened (via the note) but never what the ORIGINAL approved
             # bytes actually were — the exact anti-corruption guarantee the
             # field's own docblock names, silently unmet by the one UI that
             # exists to check it. Fixed: `GlossDraftsPanel.tsx`'s history
             # `<li>` now also renders `rev.textAtReview` (labelled "approved
             # text: ...") whenever it is non-null, alongside the existing
             # transition/actor/note line — no server-side change, this was
             # a display-only gap. RED confirmed directly: reverted just the
             # component (`git stash` of `GlossDraftsPanel.tsx` only, test
             # kept) and reran — exactly the new test failed (`current
             # draft text needs recheck` — the row's CURRENT text — rendered,
             # but `originally approved wording before the edit` — the
             # historical approved bytes from an EARLIER review entry, now
             # different from the row's current text — did not), the other
             # 10 cases in the file unaffected; restored byte-identically
             # (`git diff` empty), reran: 11/11 green. The new test
             # deliberately uses a row whose CURRENT text differs from every
             # review's `textAtReview`, so the assertion could not pass
             # vacuously by reading the Text column instead of the history
             # (the pre-existing "renders each row's review-history note"
             # test from v3-D156 could not have caught this: its fixture's
             # `textAtReview` values happened to equal the row's own current
             # `text`, so `screen.getByText("first draft text")` was
             # satisfied by the Text column alone regardless of whether the
             # history rendered `textAtReview` at all). `TZ=UTC make test`:
             # 2507 passing (was 2506, +1 — exactly this run's new test;
             # apps/web 1257, was 1256; no other suite moved: 255 v2 vitest,
             # 47 v2/api, 349 v3/api, 118 corpus-compiler, 420 engine, 61
             # fold-runner). `check-test-floor.mjs`: OK, 2507 >= floor 1899
             # (+608 margin, unmoved, same discipline as every prior entry).
             # `TZ=UTC make build`: exit 0, 29 routes (unchanged — no
             # route/UI surface added, this edits inside an existing
             # component on the existing `/settings/gloss-drafts` route).
             # `npm run gates`: all green (fonts degraded-but-non-blocking,
             # pre-existing; boundaries 293 files, unchanged count — no new
             # production file, one existing file edited; corpus-morphology
             # and corpus-glyphs unchanged). `npx tsc --noEmit`: clean. No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff produced by running the suite was reverted
             # before committing, same discipline as every prior entry —
             # `git status --porcelain -- v1 v2` empty immediately before
             # commit). No Arabic codepoint (the full diff — both the
             # component and the test file — swept programmatically over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks, plus a `\u06xx`/
             # `\u08xx`-escape and `fromCharCode` sweep — zero matches; every
             # new string is workflow-review prose an admin might type, or a
             # plain English test fixture placeholder, never gloss or corpus
             # content — this surface authors Malay prose, and every value
             # in the new test is a synthetic English placeholder matching
             # the file's own established convention).
             #
             # NOT addressed, named so a future run doesn't re-discover it
             # as new: `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution`
             # (v3-D148); `PaywallGate` as a whole class /
             # `permitsIssuance`/`permitsReview` (v3-D88, v3-D151 — still a
             # genuine open product-design question, not a wiring gap);
             # multi-surah enrollment; the operational mailer/7-night
             # window (still needs a live host/SMTP/seven real nights);
             # PAY-1's Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127, deliberately not restructured); `packages/engine/
             # src/placement.ts` (a design choice, v3-D111/D113/D123); the
             # late-arrival refold half of v3-D32 (no automatic
             # refold-on-ingest pipeline exists yet — real, separate, larger
             # scope); `AccountDeletionRequest::isDue()` (v3-D146, a
             # zero-caller convenience method deliberately left alone — the
             # query-level check it duplicates is not misleading) — all
             # unchanged. See DECISIONS.md v3-D160.
             # NOTE (v3-D159, 2026-08-31): `lib/sync/digest.ts#digestsMatch()`
             # — the exported, documented function built to answer "whether
             # two events carry the same wire payload" (edge case #50) — had
             # zero callers anywhere: `merge.ts`'s own #50 comparison
             # (`mergeFromServer`'s skip-on-idempotent-replay check) called
             # `eventDigest(existing) === eventDigest(row)` directly instead,
             # re-deriving the identical comparison inline rather than using
             # the dedicated function built for exactly this question — the
             # same "tested/documented helper exists, the one call site that
             # needs it re-derives it inline" shape as v3-D83
             # (`gradeClassToWire`) and v3-D113 (`lastActiveDayMs`), found by
             # a function-export sweep of `apps/web/lib` after the usual
             # "mechanism built and tested, zero production caller" sweep
             # came back clean everywhere else checked this run (an Explore
             # agent's earlier pass this run had flagged `billing_events` as
             # zero-caller too, but that was a stale-checkout false positive
             # — v3-D148 already built and shipped its admin viewer; see the
             # process note below). A SECOND, sharper gap surfaced alongside
             # it: `digest.ts` — despite being the shared spine `eventDigest`
             # depends on and the one module whose own docblock states two
             # load-bearing obligations by name ("ABSENT === NULL ===
             # UNDEFINED"; "KEY ORDER IS IRRELEVANT") — had **no test file of
             # its own** (`find apps/web/lib/sync -iname "*.test.*"` listed
             # `outbox.test.ts`/`merge.test.ts`/`auth.test.ts`/`pull.test.ts`,
             # never `digest.test.ts`); both obligations were only ever
             # exercised INCIDENTALLY through `merge.test.ts`'s realistic
             # event fixtures, never pinned directly. Fixed: new
             # `lib/sync/digest.test.ts` (12 tests) proves both obligations
             # directly (including the recursive/nested case and the array
             # case, where null/undefined collapse to the same sentinel but
             # POSITION is never dropped — arrays are meaning-bearing order,
             # never sorted) plus `digestsMatch`'s own equality/inequality
             # behavior and its agreement with a direct `eventDigest`
             # comparison; `merge.ts:236` now calls `digestsMatch(existing,
             # row)` instead of the inline double `eventDigest(...)` call
             # (the individual digest strings are still computed separately
             # a few lines below, for the `Divergence` record itself, which
             # needs the actual digest strings, not just the boolean).
             # Mutation-verified directly: `digestsMatch` temporarily forced
             # to always return `true` failed exactly 2 of
             # `merge.test.ts`'s 23 pre-existing divergence-detection
             # cases (`expected [] to have a length of 1 but got +0`, both on
             # the #50 divergence-record assertions) — proving the wiring is
             # real, not merely a renamed no-op; reverted byte-identically
             # (`git diff lib/sync/digest.ts` empty), 35/35 green again (23
             # merge + 12 new digest). `TZ=UTC make test`: 2506 passing (was
             # 2494, +12 — exactly this run's new tests; apps/web 1256, was
             # 1244; no other suite moved: 255 v2 vitest, 47 v2/api, 349
             # v3/api, 118 corpus-compiler, 420 engine, 61 fold-runner).
             # `check-test-floor.mjs`: OK, 2506 >= floor 1899 (+607 margin,
             # unmoved, same discipline as every prior entry). `TZ=UTC make
             # build`: exit 0, 29 routes (unchanged — no route/UI touched,
             # this is a sync-layer-internal fix). No `v1/**`/`v2/**` edit (a
             # stray `v2/tsconfig.tsbuildinfo` build-cache diff produced by
             # running the suite was reverted before committing, same
             # discipline as every prior entry — `git status --porcelain --
             # v1 v2` empty immediately before commit). No Arabic codepoint
             # (the new test file and the merge.ts diff swept programmatically
             # over the Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks — zero matches; every string
             # in the new file is a plain-object fixture key/value, a fixture
             # coordinate (surah 12 ayah 1, matching this file's own
             # established convention), or English prose, never corpus text).
             #
             # A process note, recorded because it cost real time early this
             # run: the session started on a completely uninitialized
             # checkout (no `node_modules`/`vendor` anywhere — `make setup`
             # had never been run in this container) with `HEAD` briefly
             # landing on a stale cached `main` ref one `git checkout main`
             # away from the real tip — the exact "detached HEAD, stale
             # local `main`" shape v3-D77 Finding 0 named and v3-D91/D127/D138
             # each re-hit since. `git fetch origin main` followed by `git
             # merge --ff-only origin/main` recovered the real tip (`471c785`,
             # v3-D158) cleanly, with zero risk of losing work (a fast-forward
             # merge, not a reset) — but an Explore agent dispatched to sweep
             # for the next zero-caller mechanism BEFORE that fetch reported
             # `billing_events`' admin viewer as missing, which was already
             # built and shipped at v3-D148. Verified directly against the
             # corrected tree (`ls api/app/Http/Controllers/Admin/
             # BillingEventsController.php` and `lib/admin/billingEvents.ts`
             # both present) before trusting the agent's finding, per
             # NIGHTLY.md's own rule to re-derive from the repo rather than
             # any prior claim — caught before any duplicate work was
             # attempted, unlike the "hours of reconciliation" v3-D77's
             # original finding cost.
             #
             # NOT addressed, named so a future run doesn't re-discover it as
             # new: `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution`
             # (v3-D148); `PaywallGate` as a whole class /
             # `permitsIssuance`/`permitsReview` (v3-D88, v3-D151 — still a
             # genuine open product-design question, not a wiring gap);
             # multi-surah enrollment; the operational mailer/7-night window
             # (still needs a live host/SMTP/seven real nights); PAY-1's
             # Stripe fixtures; surah 67's scene beats;
             # `worker/fold-runner/src/severity.ts`'s taxonomy drift
             # (v3-D127, a real cross-runtime duplication but deliberately
             # not restructured — see that entry); `packages/engine/src/
             # placement.ts` (a design choice, v3-D111/D113/D123); the
             # "late-arrival refold" half of v3-D32 (this build has no
             # automatic refold-on-ingest pipeline at all yet — real,
             # separate, larger scope, re-confirmed still open this run) —
             # all unchanged. See DECISIONS.md v3-D159.
             # NOTE (v3-D158, 2026-08-31): `PricingConstantsTest.php` and
             # `test/pricing.test.ts` — the CI pricing clause BUILD-PLAN.md's
             # own gate list names — each assert their OWN file's price
             # amounts against the same hardcoded v3-D07 prose string, but
             # neither reads the other file, unlike the identical mirror-drift
             # shape v3-D149/D150 already guarded for `offline_ttl_days`/
             # `OFFLINE_TTL_MS` and `trial.days`/`TRIAL_DAYS_MS` via a
             # dedicated `*-config-agreement.test.ts`. The actual money
             # amounts — `config/pricing.php`'s `MY`/`INTL` `monthly`/
             # `lifetime`/`currency`/`rails`, the numbers Stripe will actually
             # charge — never got the same guard, confirmed via `grep -rln
             # "PRICING_CONFIG_PATH\|config/pricing.php" apps/web`: only the
             # two OTHER agreement tests and the two files themselves, no
             # third guard covering price amounts. `config/pricing.php`'s own
             # docblock names the intended web-side enforcement,
             # `check-pricing.mjs` — that script does not exist anywhere in
             # the tree; the real mechanism (`check-boundaries.mjs` clause 10)
             # only stops a SECOND price literal appearing outside
             # `lib/pricing.ts`, it never compares `lib/pricing.ts`'s values
             # against `config/pricing.php`'s. Concretely: a future edit to
             # the real charged amount in `config/pricing.php` that is not
             # mirrored into `lib/pricing.ts`'s DISPLAY amount would leave
             # both existing suites green — each independently matches its
             # own hardcoded copy of the v3-D07 text — while a learner sees
             # one price on the landing/billing screen and is charged
             # another, a direct billing-trust bug, strictly worse in
             # consequence than the two amounts already guarded. Fixed:
             # `apps/web/lib/pricing-config-agreement.test.ts` (new, colocated
             # with `pricing.ts` matching the two precedent files' own
             # placement in `lib/entitlement/`), which reads
             # `config/pricing.php`'s raw text via regex (same technique
             # `PricingConstantsTest::
             # test_no_price_literal_exists_outside_the_pricing_config`
             # already uses) and asserts `PRICING.MY`/`PRICING.INTL`'s
             # `currency`/`monthly`/`lifetime` and both regions'
             # `monthlyRails`/`lifetimeRails` all match the parsed PHP source
             # exactly. No production code path changed — this is a guard
             # test only, the same shape as v3-D150. RED confirmed twice,
             # directly: mutating `config/pricing.php`'s `MY.monthly` from
             # 2000 to 2500 failed the new test exactly (`expected 2000 to be
             # 2500`); separately, mutating `MY.lifetime`'s rails to drop
             # `grabpay` failed the rails case exactly (`+ "grabpay"` in the
             # diff). Both reverted byte-identically (`git status --porcelain
             # config/pricing.php` empty before committing) and reran green,
             # 3/3. `TZ=UTC make test`: 2494 passing (was 2491, +3 — exactly
             # this run's new tests; apps/web 1244, was 1241; no other suite
             # moved: 255 v2 vitest, 47 v2/api, 349 v3/api, 118
             # corpus-compiler, 420 engine, 61 fold-runner).
             # `check-test-floor.mjs`: OK, 2494 >= floor 1899 (+595 margin,
             # unmoved). `TZ=UTC make build`: exit 0, 29 routes (unchanged —
             # no new route, this is a test-only file). `npm run gates`: all
             # green (fonts degraded-but-non-blocking, pre-existing;
             # boundaries 292 files, up from 291 — exactly the one new file;
             # corpus-morphology and corpus-glyphs unchanged). `npx tsc
             # --noEmit`: clean (this run's first draft tripped
             # `noUncheckedIndexedAccess` on five separate regex
             # capture-group accesses — fixed with explicit `=== undefined`
             # narrowing and a type-predicate filter, never a non-null
             # assertion). No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted first, same
             # discipline as every prior entry — `git status --porcelain --
             # v1 v2` empty immediately before commit). No Arabic codepoint
             # (the new file swept programmatically over the Arabic, Arabic
             # Supplement, Arabic Extended-A and both Presentation Forms
             # Unicode blocks, plus a `\u06xx`/`fromCharCode` sweep — zero
             # matches; every line addresses a minor-unit integer, a
             # currency/rail by closed-set string, or a file path, never
             # corpus text). NOT addressed: `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148); `PaywallGate` as a
             # whole class / `permitsIssuance`/`permitsReview` (v3-D88,
             # v3-D151 — a genuine open product-design question, not a wiring
             # gap); multi-surah enrollment; the operational mailer/7-night
             # window; PAY-1's Stripe fixtures; surah 67's scene beats — all
             # unchanged. See DECISIONS.md v3-D158.
             # NOTE (v3-D156, 2026-08-30): `gloss_draft_reviews` — the MS gloss
             # workflow's own APPEND-ONLY review history, declared via
             # `GlossDraft::reviews()` since the table's migration landed —
             # had zero readers anywhere: `grep -rn "->reviews(\|::reviews("
             # api/app api/routes api/tests` returned nothing. `review()`/
             # `store()`'s auto-un-review branch both write a real
             # `GlossDraftReview` row on every transition, including a
             # reviewer's rejection NOTE — the one thing an author needs to
             # act on — but `toWire()` had no `reviews` field, so that note
             # was durably recorded and then permanently invisible from the
             # one screen (`GlossDraftsPanel.tsx`) a human looks at. Same
             # "written, populated, zero read surface" shape closed six times
             # before (`admin_audit` v3-D129, `flag_ramp_audit` v3-D130,
             # `entitlement_transitions` v3-D141, `purge_ledger` v3-D142,
             # `billing_events` v3-D148) — found one layer under v3-D145's own
             # general gloss-drafts wiring pass. Fixed: `toWire()` gained a
             # chronological `reviews` array (queried via the already-declared
             # relation, `$r->reviews()->orderBy('id')->get()`); the frontend
             # (`glossDrafts.ts`, `GlossDraftsPanel.tsx`) gained a matching
             # optional `reviews?` field and a "History" column rendering each
             # transition + note, empty only when genuinely no history exists
             # yet. RED confirmed at both layers, independently reverted and
             # reproduced, then restored byte-identically: backend (2 new
             # `GlossDraftsTest` cases against the unmodified controller
             # failed on a missing `reviews` key), frontend (`git stash` of
             # the three source files reproduced the identical failure on the
             # positive "renders the rejection note" case). `TZ=UTC make
             # test`: 2487 passing (was 2482, +5 — exactly this run's new
             # tests: 2 PHPUnit + 1 + 2 vitest; v3/api 347, was 345; apps/web
             # 1239, was 1236; no other suite moved). `check-test-floor.mjs`:
             # OK, 2487 >= floor 1899 (+588 margin, unmoved). `TZ=UTC make
             # build`: exit 0, 29 routes (unchanged — no new route). `npm run
             # gates`: all green (boundaries 291 files, unchanged count — no
             # new file, three existing files edited; fonts degraded-but-non-
             # blocking, pre-existing; corpus-glyphs 206 codepoints,
             # unchanged). `npx tsc --noEmit`: clean. No `v1/**`/`v2/**` edit
             # (stray `v2/tsconfig.tsbuildinfo` reverted first, same
             # discipline as every prior entry). No Arabic codepoint (every
             # changed file swept over every Arabic block plus both
             # Presentation Forms blocks, plus a `\u06xx`/`fromCharCode`
             # sweep — zero matches; every new line addresses a status, an
             # actor identifier, a note string, or a timestamp, never gloss
             # content — test fixture notes are plain English placeholders,
             # matching this file's own established convention). NOT
             # addressed: `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148); `PaywallGate` as a
             # whole class / `permitsIssuance`/`permitsReview` (v3-D88,
             # v3-D151 — a genuine open product-design question, not a wiring
             # gap); multi-surah enrollment; the operational mailer/7-night
             # window; PAY-1's Stripe fixtures; surah 67's scene beats — all
             # unchanged. See DECISIONS.md v3-D156.
             # NOTE (v3-D155, 2026-08-30): `EmailVerificationController::verify()`'s
             # own signed-link route — v3-D153's own "NOT addressed" list named
             # this exactly, and v3-D154 (the reset-password confirmation
             # screen, this same night's earlier sibling gap) re-named it again
             # — had no in-app landing page. Left at Laravel's default, the
             # notification's link pointed at the BACKEND'S OWN
             # `email/verify/{id}/{hash}` route directly — a route that sits
             # behind BOTH `signed` AND `auth:sanctum`
             # (`EmailVerificationController`'s own docblock), so a bare click
             # from an email client, carrying no Bearer header, would 401
             # before a learner saw anything. `grep -rln "email/verify"
             # apps/web/lib apps/web/app apps/web/components` (excluding
             # `auth.ts`'s own docblock references to the gap) returned
             # nothing. Fixed: `AppServiceProvider`'s new
             # `VerifyEmail::createUrlUsing` closure routes the link through
             # the frontend instead, carrying the same four pieces
             # (`id`, `hash`, `expires`, `signature`) `URL::temporarySignedRoute`
             # would have put on the backend URL — read back by
             # `lib/account/verifyLink.ts#parseVerifyLinkParams` (the
             # `?id=&hash=&expires=&signature=` query contract, degrading a
             # missing/malformed set to `null` rather than a throw, edge case
             # #78, same convention as `resetLink.ts`) — plus
             # `confirmEmailVerification()` in `lib/account/auth.ts` (GETs
             # `/api/email/verify/{id}/{hash}?expires=&signature=` through
             # `apiFetch`, so THIS device's own Bearer token is attached —
             # the route is deliberately device-bound: the currently
             # authenticated device must be the SAME user the link names,
             # per `EmailVerificationTest::test_link_cannot_verify_a_different_users_email`,
             # which this fix does not relax) + `components/account
             # /VerifyEmailScreen.tsx` (fires automatically on mount — unlike
             # `ResetPasswordForm`, the link itself is the credential, no form
             # to submit — with four states: verifying / verified /
             # already-verified / failed, the last naming the device-mismatch
             # possibility honestly rather than as a generic error) + a new
             # top-level `app/verify-email/page.tsx`, outside every route
             # group like `/reset-password` and `/attribution` — reachable
             # from an email client, not from inside the authenticated `(app)`
             # shell. RED confirmed at both layers: the backend
             # (`AppServiceProvider.php`'s closure reverted via `git stash`)
             # failed exactly the new `EmailVerificationTest` case (the real,
             # unfaked notification's action URL still pointed at the bare
             # API host, not the frontend); the frontend (the four new/
             # changed source files moved aside, tests kept) failed all 3 new
             # `confirmEmailVerification` cases in `auth.test.ts` on
             # `confirmEmailVerification is not a function` and both new test
             # files (`verifyLink.test.ts`, `verify-email-screen.test.tsx`) on
             # module-resolution errors; every file restored byte-identically,
             # 31/31 green (20 in `auth.test.ts` — 17 pre-existing + 3 new —
             # plus 7 in `verifyLink.test.ts` plus 4 in
             # `verify-email-screen.test.tsx`) and `EmailVerificationTest`
             # 6/6 (was 5/5). `TZ=UTC make test`: 2482 passing (was 2467,
             # +15 — exactly this run's new tests: 1 PHPUnit + 14 vitest — 3
             # + 7 + 4; apps/web 1236, was 1222; v3/api 345, was 344; no
             # other suite moved). `check-test-floor.mjs`: OK, 2482 >= floor
             # 1899 (+583 margin, unmoved). `TZ=UTC make build`: exit 0, 29
             # routes (was 28 — `/verify-email` is new, dynamic like
             # `/reset-password`). `npm run gates`: all green (fonts
             # degraded-but-non-blocking, pre-existing; boundaries 291 files,
             # up from 285 — the five new apps/web files; corpus-glyphs 206
             # codepoints, unchanged). `npx tsc --noEmit`: clean, `Version
             # 5.9.3` confirmed. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted first, same
             # discipline as every prior entry — `git status --porcelain --
             # v1 v2` empty immediately before commit). No Arabic codepoint
             # (every new/changed file swept programmatically over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks, plus a `\u06xx`/
             # `fromCharCode` sweep — zero matches; every new line addresses
             # an id, a hash, an expiry timestamp, a signature, a boolean, an
             # HTTP path, or English prose, never corpus text).
             #
             # NOT addressed, named so a future run doesn't re-discover it as
             # new: `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `App\Billing\TrialAttribution`
             # (v3-D148); `PaywallGate` as a whole class (v3-D151);
             # multi-surah enrollment; the operational mailer/7-night window
             # (still needs a live host/SMTP/seven real nights); PAY-1's
             # Stripe fixtures; surah 67's scene beats — all unchanged.
             # NOTE (v3-D154, 2026-08-30): the reset-password CONFIRMATION
             # screen — v3-D153's own "NOT addressed" list named this exactly
             # as "the more urgent half of the RM500-buyer-forgets-their-
             # password risk" — did not exist. `PasswordResetController::reset()`
             # (`POST /api/reset-password`) and `requestPasswordReset()` (the
             # send-link half, wired into `AccountAuthPanel` at v3-D153) were
             # both real, but nothing let a learner who clicked the emailed
             # link actually finish: `grep -rln "reset-password" apps/web/lib
             # apps/web/app apps/web/components` (excluding `auth.ts`'s own
             # not-yet-built reference) returned nothing. Fixed: new
             # `lib/account/resetLink.ts#parseResetLinkParams` (the
             # `?token=&email=` query contract `AppServiceProvider.php`'s
             # `ResetPassword::createUrlUsing` closure actually emits, ported
             # 1:1 from that closure's own string template) +
             # `confirmPasswordReset()` in `lib/account/auth.ts` (posts to
             # `/api/reset-password`, adopts the fresh post-reset token via
             # `setAuthenticatedIdentity` exactly like `loginAccount` — a
             # completed reset signs this device in) +
             # `components/account/ResetPasswordForm.tsx` (checks password-
             # confirmation match CLIENT-SIDE before ever spending the
             # one-time reset token on a doomed request) + a new top-level
             # `app/reset-password/page.tsx`, outside every route group like
             # `/attribution` — reachable from an email client, not from
             # inside the authenticated `(app)` shell. RED confirmed
             # directly: all three new/changed test files were run against
             # the tree before their source existed and failed on
             # `confirmPasswordReset is not a function` / module-resolution
             # errors; implemented after, 12/12 new tests green (3 in
             # `auth.test.ts` + 5 in `resetLink.test.ts` + 4 in
             # `reset-password-form.test.tsx`). `TZ=UTC make test`: 2467
             # passing (was 2455, +12 — exactly this run's new tests; apps/web
             # 1222, was 1210; no other suite moved). `check-test-floor.mjs`:
             # OK, 2467 >= floor 1899 (+568 margin, unmoved). `TZ=UTC make
             # build`: exit 0, 28 routes (was 27 — `/reset-password` is new).
             # `npm run gates`: all green (fonts degraded-but-non-blocking,
             # pre-existing; boundaries 285 files, up from 280 — exactly the
             # four new apps/web files; corpus-glyphs 206 codepoints,
             # unchanged). `npx tsc --noEmit`: clean. No `v1/**`/`v2/**` edit
             # (a stray `v2/tsconfig.tsbuildinfo` build-cache diff reverted
             # first, same discipline as every prior entry — `git status
             # --porcelain -- v1 v2` empty immediately before commit). No
             # Arabic codepoint (every new/changed file swept programmatically
             # over the Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms Unicode blocks, plus a `\u06xx`/
             # `fromCharCode` sweep — zero matches; every new line addresses
             # an email string, a password field, a boolean, an HTTP path, or
             # English prose, never corpus text).
             #
             # NOT addressed, named so a future run doesn't re-discover it as
             # new: `EmailVerificationController::verify()`'s own signed-link
             # route still has no in-app landing page — a smaller, separate
             # gap named at v3-D153. `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `App\Billing\TrialAttribution` (v3-D148); `PaywallGate` as a
             # whole class (v3-D151); multi-surah enrollment; the operational
             # mailer/7-night window (still needs a live host/SMTP/seven real
             # nights); PAY-1's Stripe fixtures; surah 67's scene beats — all
             # unchanged.
             # NOTE (v3-D153, 2026-08-29): the learner account flow —
             # `AuthController` (register/login/logout/me),
             # `PasswordResetController` and `EmailVerificationController` —
             # has existed, routed and fully server-tested since build-plan
             # step 13 with ZERO frontend callers anywhere: `grep -rln
             # "auth/register\|auth/login\|auth/logout\|forgot-password\|
             # email/verify" apps/web/lib apps/web/app apps/web/components`
             # returned nothing. CLAUDE.md's own corruption-risk ordering
             # names this exactly: "AUTH- closes before any PAY- task... an
             # RM500 lifetime buyer who forgets their password loses
             # everything" — and PAY- work (PaywallGate, TrialAttribution)
             # is already under active construction (v3-D147..D151). Fixed:
             # new `lib/account/auth.ts` (mirrors `lib/admin/session.ts`'s
             # login/logout shape) + `components/settings/AccountAuthPanel.tsx`
             # (checking / anonymous-with-create-or-sign-in / named-with-
             # verify-and-sign-out), wired into `/settings` as a new "YOUR
             # ACCOUNT" card. A second, real defect surfaced while writing
             # the RED test for login: `AuthController::login()`'s 401 (a
             # public, unauthenticated route) was being caught by
             # `apiFetch`'s B8 401-interceptor, silently clearing a live
             # device token and attempting a re-mint on a WRONG-PASSWORD
             # response — the exact "a 401 from X triggering a remint IS the
             # loop" shape `ANONYMOUS_PATH`'s own exemption already named.
             # Fixed by generalizing it: `apiFetch.ts` gained
             # `NO_REMINT_PATHS` (currently `{"/api/auth/login"}`). RED
             # confirmed at three independent points (auth.ts moved aside,
             # the NO_REMINT_PATHS check reverted, AccountAuthPanel.tsx moved
             # aside), each restored byte-identically. `TZ=UTC make test`:
             # 2455 passing (was 2432, +23 — exactly this run's new tests:
             # 14 + 8 + 1; apps/web 1210, was 1187; no other suite moved).
             # `check-test-floor.mjs`: OK, 2455 >= floor 1899 (+556 margin,
             # unmoved). `TZ=UTC make build`: exit 0, 27 routes (unchanged —
             # renders inside the existing `/settings` page). `npm run
             # gates`: all green (boundaries 280 files, up from 276 —
             # exactly the four new apps/web files; fonts degraded-but-non-
             # blocking, pre-existing; corpus-glyphs 206 codepoints,
             # unchanged). `npx tsc --noEmit`: clean. No `v1/**`/`v2/**`
             # edit (stray `v2/tsconfig.tsbuildinfo` reverted first, same
             # discipline as every prior entry). No Arabic codepoint (every
             # new/changed file swept over every Arabic block plus both
             # Presentation Forms blocks, plus a `\u06xx`/`fromCharCode`
             # sweep — zero matches; every new line addresses an email
             # string, a boolean, an HTTP path, or English prose, never
             # corpus text). NOT addressed: the reset-password CONFIRMATION
             # screen (a new public route consuming the emailed token —
             # `requestPasswordReset`, the send-link half, is wired, but
             # nothing yet lets a learner complete a reset; the more urgent
             # half of the very risk this fix's own motivating rule names,
             # left for a near-future run); `EmailVerificationController
             # ::verify()`'s signed-link route still has no in-app landing
             # page; `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `TrialAttribution` (v3-D148);
             # `PaywallGate` as a whole class (v3-D151); multi-surah
             # enrollment; the 7-night window; PAY-1's Stripe fixtures;
             # surah 67's scene beats. See DECISIONS.md v3-D153.
             # NOTE (v3-D152, 2026-08-29): `lib/workbench/sign.ts
             # #describeCertification()` — v3-D22's own claim rule, "the ONE
             # function built to answer 'may this UI say a scholar verified
             # this'" — had zero callers anywhere, unit-tested since it
             # landed but never wired into the `/workbench` frontier pane
             # that is its one natural home. Sharper than this build's usual
             # zero-caller shape: `check-boundaries.mjs` clause 15 already
             # existed, written by a prior run specifically anticipating
             # this gap, and its own header said so: "no shipped surface
             # renders a certification claim today, so the invariant
             # currently holds VACUOUSLY." An admin looking at the
             # `VERIFICATION FRONTIER` pane, even 100% green, had no
             # on-screen way to tell whether any row was ever signed by a
             # human qari versus AI-only — the API already sent the raw
             # `verifications` rows needed to answer that (step 15), and
             # every client reader discarded them. Fixed by moving
             # `Tier`/`ReviewerKind`/`VerificationRow` into `frontier.ts`
             # (the wire-contract module, re-exported from `sign.ts` for
             # `QariMode.tsx`'s existing import), adding `verifications?:
             # VerificationRow[]` to `FrontierResponse`, and having
             # `loadFrontier` compute `describeCertification(rows ?? [],
             # worklist.allGreen)` once and carry it as a new required
             # `certification` field on `FrontierLoad`'s ready state.
             # `FrontierNavigator.tsx` prints `.sentence` verbatim beneath
             # the header — the component still decides nothing about WHAT
             # may be claimed. Deliberately renamed the CSS modifier from
             # the obvious `wb-cert--scholar` to `wb-cert--affirmed` after
             # confirming (both by replaying clause 15's own regex and by
             # re-running the real gate) that the obvious name would NOT
             # have tripped it on this line, but a future edit easily could.
             # RED confirmed directly: `git stash` of the five source files
             # (test kept) reran `workbench-ui.test.tsx` — exactly 5 of 26
             # failed (`getByTestId` misses, `Cannot read properties of
             # undefined` crashes), 21 unaffected; restored byte-identically,
             # 26/26 green. `TZ=UTC make test`: 2432 passing (was 2427, +5 —
             # exactly this run's new tests; apps/web 1187, was 1182; no
             # other suite moved). `check-test-floor.mjs`: OK, 2432 >= floor
             # 1899 (+533 margin, unmoved). `TZ=UTC make build`: exit 0, 27
             # routes (unchanged — renders inside the existing `/workbench`
             # page). `npm run gates`: all green, including the clause this
             # run closes (boundaries 277 files, up from 276; fonts
             # degraded-but-non-blocking, pre-existing; corpus-glyphs 206
             # codepoints, unchanged). `npx tsc --noEmit`: clean. No
             # `v1/**`/`v2/**` edit (stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff reverted first, same discipline as every
             # prior entry). No Arabic codepoint (the full diff swept
             # programmatically over every Arabic block plus both
             # Presentation Forms blocks — zero matches; every new line
             # addresses a boolean, a wire field name, a CSS class, or
             # English prose, never corpus text). NOT addressed:
             # `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `TrialAttribution` (v3-D148);
             # `PaywallGate` as a whole class (v3-D151); multi-surah
             # enrollment; the 7-night window (still needs a live
             # host/SMTP/seven real nights); PAY-1's Stripe fixtures; surah
             # 67's scene beats. See DECISIONS.md v3-D152.
             # NOTE (v3-D151, 2026-08-29): v3-D07, verbatim: "a limited free
             # trial (one surah, OR 14 days)". `PaywallGate::permitsIssuance()`
             # (PHP) and its client mirror `lib/entitlement/gate.ts` had only
             # ever checked the SURAH half — `trial_started_at` (written since
             # 2026-08-10 by `TrialAttribution::apply()`) had zero readers
             # anywhere, and `GET /api/entitlement` never even put it on the
             # wire. Concretely: once M7's checkout ships, a real trial learner
             # 200 days in would be treated identically to one 2 minutes in —
             # only choosing a SECOND surah ever ended their trial. Fixed both
             # sides: `PaywallGate`'s Trial branch now denies (code
             # `trial_expired`) once `now - trial_started_at >=
             # config('pricing.trial.days') * 86400000`, even for the trial
             # surah itself; an unstarted trial (`trial_started_at === null`)
             # has no clock to violate. `EntitlementController::show()` now
             # carries `trialStartedAt`; the client mirror gained the
             # identical check against a new `TRIAL_DAYS_MS` constant, kept in
             # agreement with `config/pricing.php` by a new
             # `trial-config-agreement.test.ts` (the same raw-PHP-scan pattern
             # v3-D150 established for `OFFLINE_TTL_MS`). Caught while writing
             # the client test: `permitsIssuance`'s offline-cache staleness
             # check (7-day `OFFLINE_TTL_MS`) runs BEFORE the trial branch, so
             # a test that advanced only `now` (not `cachedAt`) past the
             # 14-day mark went stale-but-owned first and passed vacuously —
             # fixed by advancing `cachedAt` alongside `now`, matching this
             # file's own pre-existing "denied identically at day 1 and year
             # 10" convention. RED confirmed at every layer (PHP, controller,
             # TS gate), each reverted byte-identically. `TZ=UTC make test`:
             # 2427 passing (was 2419, +8 — exactly this run's new tests: 3
             # PHPUnit + 5 vitest; no other suite moved). `check-test-floor
             # .mjs`: OK, 2427 >= floor 1899 (+528 margin, unmoved). `TZ=UTC
             # make build`: exit 0, 27 routes (unchanged). `npx tsc --noEmit`:
             # clean. No `v1/**`/`v2/**` edit. No Arabic codepoint (full diff
             # + the one new file swept over every Arabic block plus both
             # Presentation Forms blocks — zero matches; every new line
             # addresses a day count, a millisecond constant, a config key, or
             # PHP/TS prose, never corpus text). NOT addressed:
             # `PaywallGate` as a WHOLE class still has zero production
             # callers — this fixes what it COMPUTES, not whether anything
             # calls it; wiring it into session assembly needs Firdaus's
             # still-open call on review-vs-new-content in one mixed queue
             # (v3-D88, unresolved). `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # `TrialAttribution` (v3-D148); multi-surah enrollment; the
             # 7-night window (still needs a live host/SMTP/seven real
             # nights); PAY-1's Stripe fixtures; surah 67's scene beats. See
             # DECISIONS.md v3-D151.
             # NOTE (v3-D150, 2026-08-29): `config('pricing.offline_ttl_days')`
             # had zero Laravel-side readers (confirmed again this run) while
             # `apps/web/lib/entitlement/cache.ts#OFFLINE_TTL_MS` independently
             # hardcoded the identical value — v3-D149's own "not addressed"
             # list named this exactly. Unlike most of this build's config/
             # zero-caller gaps, the fix is NOT a live wire: the TTL is a pure
             # client-side cache-staleness policy with no server-side use
             # (`GET /api/entitlement` correctly carries no TTL field), so
             # inventing an HTTP config-fetch path for one integer would be
             # the exact speculative new pattern v3-D149 declined to build.
             # Fixed on the v3-D137 `MacroFacts` mirror-agreement template
             # instead: new `apps/web/lib/entitlement/cache-config-agreement
             # .test.ts` reads `api/config/pricing.php`'s raw text (the same
             # raw-file-scan technique `PricingConstantsTest
             # ::test_no_price_literal_exists_outside_the_pricing_config`
             # already uses, here run in reverse — a vitest test reading PHP
             # source) and asserts `OFFLINE_TTL_MS === parsedDays * 24 * 60 *
             # 60 * 1000`. Both docblocks now point at the real guard instead
             # of merely claiming agreement in prose. RED confirmed both
             # directions independently, each reverted byte-identically:
             # mutating `offline_ttl_days` 7→14 failed the new test exactly
             # (`- 1209600000 / + 604800000`); separately, mutating
             # `OFFLINE_TTL_MS` to 3 days failed it again on the same
             # assertion with the new numbers (`- 604800000 / + 259200000`).
             # `TZ=UTC make test`: 2419 passing (was 2418, +1 — exactly this
             # run's new test; apps/web alone 1177, was 1176). `check-test-
             # floor.mjs`: OK, 2419 >= floor 1899 (+520 margin, unmoved).
             # `TZ=UTC make build`: exit 0, 27 routes (unchanged — no route/UI
             # touched). `npm run gates`: all green (fonts degraded-but-non-
             # blocking, pre-existing; boundaries 276 files, up from 275 —
             # exactly the one new test file; corpus-glyphs 206 codepoints,
             # unchanged). No `v1/**`/`v2/**` edit (stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted first, same
             # discipline as every prior entry). No Arabic codepoint (all
             # three changed/new files swept over the Arabic, Arabic
             # Supplement, Arabic Extended-A and both Presentation Forms
             # blocks — zero matches; every new line addresses a day count, a
             # millisecond constant, a file path, or PHP/TS prose, never
             # corpus text). NOT addressed: this run's sweep did not extend
             # beyond the one item v3-D149 already named —`rhymeClassOf()`
             # (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `TrialAttribution` (v3-D148);
             # multi-surah enrollment; the 7-night window itself (still needs
             # a live host/SMTP/seven real nights); PAY-1's Stripe fixtures;
             # surah 67's scene beats. See DECISIONS.md v3-D150.
             # NOTE (v3-D149, 2026-08-28): `config('nightly.sample_size')`
             # ("How many learners the fold check samples per night") was
             # written, documented, and never read by anything —
             # `DeterminismCheckCommand`'s own signature hardcoded a SECOND,
             # independent default (`{--sample=50}`), and the scheduled
             # nightly invocation (`routes/console.php`) never passes
             # `--sample` at all. So `NIGHTLY_SAMPLE_SIZE` had ZERO effect on
             # the run that actually feeds the 7-consecutive-green-nights
             # launch-gate ledger every night — a config knob silently
             # doing nothing, one layer up from this build's usual
             # "controller never built" gap (found by extending the
             # zero-caller sweep to config KEYS, not just classes/routes).
             # Fixed: the signature's hard default is removed; `runFold()`
             # now falls back to `config('nightly.sample_size', 50)` only
             # when `--sample` is genuinely absent — an explicit `--sample`
             # still wins (the existing `PerUserFoldLockWiringTest` cases,
             # which always pass it explicitly, are unaffected). RED
             # confirmed directly: a new test seeds 3 clean learners, sets
             # `config(['nightly.sample_size' => 2])`, runs the command with
             # NO `--sample` flag (exactly what the schedule does), and
             # asserts `report['usersChecked'] === 2` — against the
             # untouched command this failed exactly as predicted (`3` vs
             # `2`, all three sampled, config ignored); mutation-verified via
             # `git stash` of the source file alone, tests kept — identical
             # RED reproduced, reverted byte-identically, 13/13 green again.
             # `php artisan test`: 341 passing (was 339, +2). `TZ=UTC make
             # test`: 2418 passing (was 2416, +2; no other suite moved).
             # `check-test-floor.mjs`: OK, 2418 >= floor 1899 (+519 margin,
             # unmoved). `TZ=UTC make build`: exit 0, 27 routes (unchanged —
             # backend-only fix, no route/UI touched). No `v1/**`/`v2/**`
             # edit (stray `v2/tsconfig.tsbuildinfo` reverted first, same
             # discipline as every prior entry). No Arabic codepoint (both
             # changed files swept over the Arabic, Arabic Supplement,
             # Arabic Extended-A and both Presentation Forms blocks — zero
             # matches; every new line addresses a learner count, a config
             # key, or a PHP identifier, never corpus text). NOT addressed:
             # `config('pricing.offline_ttl_days')` has the identical
             # zero-Laravel-reader shape but a matching hardcoded value
             # already lives in `apps/web/lib/entitlement/cache.ts` with no
             # established Next→Laravel config-sharing pattern to fix it
             # through (smaller, less clean-cut, left for a future run);
             # `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); `TrialAttribution` (v3-D148);
             # multi-surah enrollment; the 7-night window itself (still
             # needs a live host/SMTP/seven real nights); PAY-1's Stripe
             # fixtures; surah 67's scene beats. See DECISIONS.md v3-D149.
             # NOTE (v3-D148, 2026-08-28): `billing_events` — the RAW webhook
             # journal `WebhookHandler::ingest()` writes on every inbound
             # Stripe delivery, `insertOrIgnore`-first-then-`outcome`-updated
             # — had a fully-cast model (`App\Models\BillingEvent`, a
             # `user()` relation) since step 23 with ZERO readers anywhere:
             # `grep -rln "BillingEvent::" app/Http` returned nothing. A
             # DIFFERENT table than the one v3-D141/D147's admin billing
             # surface already wired — `AdminBillingController::index()`
             # reads `entitlement_transitions` (the DERIVED state-change
             # log, which only gains a row when a webhook actually changes
             # state); a delivery that fails to parse, hits an unhandled
             # type, or throws mid-`process()` leaves NOTHING there — only a
             # row in the raw journal, with `outcome: "ignored_unhandled"`
             # or `outcome: "error"` and the real exception message. Same
             # "written, populated, zero read surface" shape this build has
             # closed four times before (`admin_audit` v3-D129,
             # `flag_ramp_audit` v3-D130, `entitlement_transitions` v3-D141,
             # `purge_ledger` v3-D142), missed here because each of those
             # four looked only at the table its own ticket named. Fixed:
             # new `Admin\BillingEventsController::index()` (`GET
             # /api/admin/billing/events`, read-only, no write route
             # registered) + `lib/admin/billingEvents.ts` +
             # `BillingEventsPanel` added beneath the existing
             # `BillingAuditPanel` on `/settings/billing` (no new route).
             # `userId`/`outcome` filters and `user_id` pseudonymization
             # mirror every other admin audit viewer.
             #
             # A SECOND, DEEPER BUG surfaced while writing the RED test for
             # pseudonymization: `billing_events.user_id` (nullable,
             # `nullOnDelete`, with a full `user()` relation) was NEVER
             # WRITTEN by anything — `WebhookHandler::ingest()`'s
             # `insertOrIgnore` and both later `->update()` calls all
             # omitted it, so every journal row in production has been
             # permanently `user_id: null` since step 23, defeating the
             # `?userId=` filter and the one correlation an operator would
             # actually want. Not hypothetical — the first RED run of
             # `test_the_subject_is_pseudonymized_not_the_raw_user_id`
             # failed genuinely (null where a real pseudonym was expected)
             # against the untouched `WebhookHandler`. Fixed in the same
             # file: `resolveEntitlement($event)` now runs ONCE in
             # `ingest()` itself (`process()` takes it as a parameter,
             # avoiding a second DB read) and its `user_id` is threaded into
             # both `update()` calls, including the error path.
             #
             # RED confirmed at three independent layers: backend
             # (`BillingEventsController.php` moved aside + the route
             # addition reverted) — all 9 new PHPUnit cases failed on 404;
             # restored, then 2 of 9 STILL failed genuinely before
             # `WebhookHandler.php` was touched (the `user_id` bug, proving
             # the test caught a real gap, not a tautology); frontend
             # (`billingEvents.ts`/`BillingEventsPanel.tsx` never existed
             # before this run, so their absence was the RED signal) — 8 + 6
             # cases, all green after. `TZ=UTC make test`: 2416 passing (was
             # 2393, +23 — exactly this run's new tests: 9 PHPUnit + 8 + 6
             # vitest; no other suite moved). `check-test-floor.mjs`: OK,
             # 2416 >= floor 1899 (+517 margin, unmoved). `TZ=UTC make
             # build`: exit 0, 27 routes (unchanged — renders inside the
             # existing `/settings/billing` page). `npm run gates`: all
             # green (fonts degraded-but-non-blocking, pre-existing;
             # boundaries 275 files, up from 271 — exactly the four new
             # apps/web files). `npx tsc --noEmit`: clean, `Version 5.9.3`
             # confirmed. No `v1/**`/`v2/**` edit (`git status --porcelain
             # -- v1 v2` empty immediately before commit — a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted first,
             # same discipline as every prior entry). No Arabic codepoint
             # (every changed/new file swept over the Arabic, Arabic
             # Supplement, Arabic Extended-A and both Presentation Forms
             # blocks — zero matches; every new line addresses a provider
             # event id, an outcome by closed-set string, a PHP-identifier
             # error message, or a user id, never corpus text). NOT
             # addressed: a single-event detail view (the raw `payload`,
             # deliberately withheld from the list) is real, separate,
             # smaller follow-up work; `App\Billing\TrialAttribution` is a
             # fully-built, zero-caller class found during this same sweep,
             # traced to the identical root cause v3-D147 already named (no
             # code path creates the first `Entitlement` row — a real,
             # separate, Stripe-checkout-gated M7 scope item, not a new
             # gap); `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); multi-surah enrollment; the
             # operational mailer/7-night window; PAY-1's Stripe fixtures;
             # surah 67's scene beats. See DECISIONS.md v3-D148.
             # NOTE (v3-D147, 2026-08-28): `EntitlementMachine::CAUSE_ADMIN_OVERRIDE`
             # (one of four declared transition causes, alongside
             # CAUSE_WEBHOOK/CAUSE_TRIAL_START/CAUSE_RECONCILE — all three of
             # which have real callers) existed since M7 shipped with zero
             # callers anywhere. `AdminBillingController`'s own header said
             # "READ-ONLY BY CONSTRUCTION" — true, and also the entire gap: a
             # test (v3-D141) had already manufactured an EntitlementTransition
             # row with this cause directly via Eloquent, specifically to prove
             # the READ side's actor-pseudonymization was "ready for that day"
             # that never arrived — the same "tests the read side, no write
             # side exists" shape as v3-D129/D130/D141/D142/D143. Fixed: new
             # `AdminBillingController::override()` (`POST
             # /api/admin/billing/{userId}/override`, admin-gated, >=10-char
             # reason, optional state/tier via EntitlementState::tryFrom/
             # EntitlementTier::tryFrom, at least one required) routes through
             # the SAME guarded `EntitlementMachine::apply()` every webhook
             # uses — never a raw `Entitlement::update()` — passing the calling
             # admin's own id as `actor` for the first time ever (every other
             # cause still passes 'system'). Deliberately scoped to
             # state/tier only — no provider/period/grace fields, which would
             # let an admin fabricate or backdate a real payment relationship.
             # `lib/admin/billingAudit.ts` gained `submitBillingOverride()` +
             # `BillingStateValue`/`BillingTierValue`/`BillingOverrideInput`/
             # `BillingOverrideOutcome` (named WITHOUT the word
             # check-boundaries.mjs clause 9 forbids outside its allowlist —
             # the first draft used `EntitlementStateValue`/
             # `overrideEntitlement` and tripped 18 real violations on `make
             # build`, renamed and reran clean); `BillingAuditPanel.tsx` gained
             # the override form beneath the existing read table.
             #
             # ALSO FOUND, real but genuinely out of scope, named so a future
             # run doesn't re-discover it: no code path anywhere in `v3/api`
             # ever creates the FIRST `Entitlement` row for a real user — no
             # checkout route/controller exists at all. Row provisioning is
             # M7's still-unbuilt checkout flow, the same Stripe-account-gated
             # scope PAY-1 already names. `override()` requires an EXISTING
             # row (404 otherwise) rather than guessing defaults for one.
             #
             # RED confirmed at all three layers before implementing: 7 new
             # `AdminBillingTest` cases all failed (404s — the route did not
             # exist), 5 new `billingAudit.test.ts` cases all failed
             # (`submitBillingOverride is not a function`), 3 new
             # `billing-audit-panel.test.tsx` cases all failed (no such
             # label). Mutation-verified both layers: a fake-success backend
             # response (skipping `apply()` entirely) failed exactly the
             # load-bearing state-changed assertion; a fake-success frontend
             # handler (skipping `submitBillingOverride()` entirely) failed
             # both the success- and rejection-wiring cases. Both reverted
             # byte-identically. `TZ=UTC make test`: 2393 passing (was 2378,
             # +15 — exactly this run's new tests: 7 PHPUnit + 5 + 3 vitest;
             # no other suite moved). `check-test-floor.mjs`: OK, 2393 >=
             # floor 1899 (+494 margin, unmoved). `TZ=UTC make build`: exit 0,
             # 27 routes (unchanged — renders inside the existing
             # `/settings/billing` page). `npm run gates`: all green (fonts
             # degraded-but-non-blocking, pre-existing; boundaries 271 files,
             # unchanged count). `npx tsc --noEmit`: clean. No
             # `v1/**`/`v2/**` edit. No Arabic codepoint (all seven changed
             # files swept over every Arabic block plus both Presentation
             # Forms blocks — zero matches; every new line addresses a
             # state/tier by closed-set string, a user id, a reason string,
             # or an identifier, never corpus text). NOT addressed: the
             # missing checkout-flow entitlement provisioning above;
             # `rhymeClassOf()` (v3-D136); `EntitlementMachine::merge()`
             # (v3-D88..D94/D144/D145); multi-surah enrollment; the mailer/
             # 7-night window; PAY-1's Stripe fixtures; surah 67's scene
             # beats. See DECISIONS.md v3-D147.
             # NOTE (v3-D146, 2026-08-28): `test/shell.test.ts`'s "the
             # dashboard's log-derived line is an exhaustively-stated client
             # island" test verified `components/home/LogSummary.tsx`'s shape
             # correctly but never checked it was reachable from a real
             # route — and it wasn't. `TodaySession.tsx` superseded it as
             # `/home`'s real due-count island back at build-plan step
             # 18/19 (v3-D74); nothing was ever repointed. A fresh sweep (an
             # Explore agent, excluding every already-named deferred item —
             # rhymeClassOf, EntitlementMachine::merge, multi-surah
             # enrollment, the mailer, the 7-night window, PAY-1, scene
             # beats) found this: a structurally sound, well-tested
             # component with zero wiring, the "tests pass, wiring unproven"
             # shape this build has caught before (B6, v3-D83) — here on the
             # test side. Deleted `LogSummary.tsx`; corrected `home/page.tsx`'s
             # stale doc-comment; retargeted the test to the real live file
             # (`TodaySession`'s five-way state union, a superset of
             # `LogSummary`'s four) plus a new permanent wiring assertion
             # (`home/page.tsx` must render `<TodaySession/>`) and a new
             # test asserting `LogSummary.tsx` no longer exists at all. RED
             # confirmed directly: a temporary probe asserting `/home`
             # rendered `<LogSummary/>` failed exactly as predicted (1
             # failed, 43 passed) before any fix; folded into the real fix
             # rather than left running. `TZ=UTC make test`: 2378 passing
             # (was 2377, +1 — exactly this run's net new test). `check-
             # test-floor.mjs`: OK, 2378 >= floor 1899 (+479 margin, unmoved).
             # `TZ=UTC make build`: exit 0, 27 routes (unchanged). `npm run
             # gates`: all green (fonts degraded-but-non-blocking,
             # pre-existing; boundaries 271 files, down from 272 — exactly
             # the one deleted file). `npx tsc --noEmit`: clean. No
             # `v1/**`/`v2/**` edit. No Arabic codepoint (the two changed
             # files swept over every Arabic block plus both Presentation
             # Forms blocks — zero matches). NOT addressed: the sweep's
             # other candidate, `AccountDeletionRequest::isDue()` (a
             # zero-caller convenience method; `PurgeDueAccountsCommand`
             # already does the equivalent check at the query level, so
             # nothing is misleading about it — left alone deliberately, see
             # DECISIONS.md v3-D146); `rhymeClassOf()` (v3-D136);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144/D145);
             # multi-surah enrollment (a product decision, not a wiring
             # gap); the mailer/7-night window (infra/calendar); PAY-1
             # (needs a real Stripe account); surah 67's scene beats
             # (human-only). See DECISIONS.md v3-D146.
             # NOTE (v3-D145, 2026-08-27): `GlossDraftsController` (the MS
             # gloss authoring workflow, live and tested since build-plan
             # step 27) had been mislabeled "ratification-gated" wholesale
             # in every nightly note since v3-D125. Re-read the actual gate
             # (BUILD-PLAN's agent-deployment rule, the migration's own
             # header, the controller's own header): ratification is scoped
             # to AUTHORING MALAY CONTENT, not to building the workflow tool
             # a human authors through — the table still ships empty, and
             # `merged` (the one transition that would ship content) stays
             # refused unconditionally server-side regardless of who calls
             # it. Wired the missing scaffold: `lib/admin/glossDrafts.ts`
             # (load/save/review, never throws) + `GlossDraftsPanel.tsx`
             # (per-surah worklist, a coordinate-keyed draft form — never a
             # corpus-word picker, since this authors words the corpus
             # doesn't have yet — and exactly two review actions,
             # deliberately NO merge button anywhere) + new
             # `/settings/gloss-drafts` route. A fresh zero-caller sweep
             # this run also extended to `worker/fold-runner/src` (clean,
             # matches v3-D127) and `corpus-compiler/src` (6 candidates, all
             # verified internal-only uses, not gaps) — the two packages no
             # prior sweep had named explicitly — plus a re-check of
             # `/surah/[surah]` (new since v3-D139, added after v3-D132's
             # SSR-override fix) confirming it renders no gloss/distractor
             # text, so the SSR override gap stays not-a-live-bug. One real
             # gate catch along the way: the panel's first caption draft
             # ("cannot amber a qari signature") tripped
             # `check-boundaries.mjs`'s scholar-claim guard (v3-D22) despite
             # being a negation the guard can't parse — reworded to "cannot
             # move any ayah's verified frontier," same claim, no trigger
             # phrase. `TZ=UTC make test`: 2377 passing (was 2359, +18 —
             # exactly this run's new tests: 10 + 8; no other suite moved).
             # `check-test-floor.mjs`: OK, 2377 >= floor 1899 (+478 margin,
             # unmoved). `TZ=UTC make build`: exit 0, 27 routes (was 26 —
             # `/settings/gloss-drafts` is new). `npm run gates`: all green
             # (fonts degraded-but-non-blocking, pre-existing; boundaries
             # 272 files, up from 266 — exactly the six new files — green
             # only after the caption reword, a real RED from the gate
             # itself). `npx tsc --noEmit`: clean. No `v1/**`/`v2/**` edit.
             # No Arabic codepoint (all five new files swept over every
             # Arabic block plus both Presentation Forms blocks — zero
             # matches; every string is workflow prose, a coordinate
             # integer, or a closed-set value, never gloss content). NOT
             # addressed: `rhymeClassOf()` (v3-D136); the SSR override
             # gap's other leftover items (v3-D132, unchanged);
             # `EntitlementMachine::merge()` (v3-D88..D94/D144, correctly
             # deferred — real M6 scope); the operational mailer's live-SMTP
             # gap and the 7-night window (both infra/calendar, unchanged).
             # See DECISIONS.md v3-D145.
             # NOTE (v3-D144, 2026-08-27): `LAUNCH-CHECKLIST.md` gate 20 and
             # `routes/console.php`'s own `onFailure` comment both still said
             # "no mail dispatch exists... no operational mailer configured"
             # for the P1 pager — false since v3-D82 (2026-08-13), which built
             # `DeterminismCheckCommand::record()`'s real `pageOnCall()` +
             # `App\Mail\DeterminismP1Alert`, proven by
             # `DeterminismP1PagerTest.php`. Both documents corrected to say
             # what actually remains: a live SMTP account/config in
             # production and BUILD-PLAN Q12 (who is on call), not the
             # send-mail code. Documentation-only; test/build numbers
             # unchanged. A fresh zero-caller sweep across engine/api/apps-web
             # found nothing else safely in scope (see DECISIONS.md v3-D144
             # for the full write-up, incl. a ruled-out B6-shaped hypothesis
             # on `test.ts#isCorrectChoice` and the confirmed-real-but-out-
             # of-scope `EntitlementMachine::merge()` gap).
             # NOTE (v3-D143): the 7-consecutive-green-nights window
             # (BUILD-PLAN M10's launch gate, `NightlyWindowLedger::status()`)
             # was readable only via `php artisan nightly:window` on a
             # machine with SSH access — no HTTP route, no admin screen, ever
             # read `NightlyCheckRun`/`NightlyWindow` back, the same "built +
             # populated + zero read surface" shape v3-D129/D130/D141/D142
             # each closed for `admin_audit`/`flag_ramp_audit`/
             # `entitlement_transitions`/`purge_ledger`. HANDOVER.md's own C5
             # names the consequence directly: a human has to check the CLI
             # daily by hand, and (H5) nobody is paged on a P1 either — that
             # manual daily check was the ENTIRE safety net for the one gate
             # that blocks public launch. Fixed on the same template:
             # `Admin\NightlyWindowController::index()` (`GET
             # /api/admin/nightly-window`, read-only, a thin pass-through of
             # `NightlyWindowLedger::status()` — no second implementation of
             # the streak arithmetic) + `lib/admin/nightlyWindow.ts` +
             # `NightlyWindowPanel.tsx`, added beneath the existing
             # `SystemHealthPanel` on `/settings/health` (already hosts "the
             # two nightly determinism checks" this window is derived from —
             # no new route needed). A confirmed P1 renders as an explicit,
             # visible alert naming the night and the check, not just a lower
             # streak number. READ-ONLY BY CONSTRUCTION: this screen may
             # never declare or reset the window — that stays
             # `nightly:window --start`, BUILD-PLAN's own required human CLI
             # action. RED confirmed at all three layers (backend
             # route+controller moved aside, fetch client moved aside, panel
             # component moved aside; each failed on 404 or module
             # resolution, each restored byte-identically and reran green).
             # `TZ=UTC make test`: 2359 passing (was 2340, +19 — exactly this
             # run's new tests: 6 PHPUnit + 7 + 6 vitest). `check-test-floor.mjs`:
             # OK, 2359 >= floor 1899 (+460 margin). `TZ=UTC make build`: exit
             # 0, 26 routes (unchanged — `/settings/health` already existed).
             # `npm run gates`: all green (boundaries 266 files). `npx tsc
             # --noEmit`: clean. No `v1/**`/`v2/**` edit. No Arabic codepoint
             # (every new/changed file swept over the Arabic, Arabic
             # Supplement, Arabic Extended-A and both Presentation Forms
             # blocks — zero matches). NOT addressed: `rhymeClassOf()`
             # (v3-D136); `GlossDraftsController` (ratification-gated); the
             # SSR override gap's leftover items (v3-D132); the
             # account-adoption frontend (v3-D88..D94, deliberately
             # deferred); the operational mailer gap (HANDOVER.md C5/gate
             # 20 — a confirmed P1 is now visible on this screen but still
             # pages nobody); the TEST-FLOOR margin (left unmoved on
             # purpose). See DECISIONS.md v3-D143.
             # NOTE (v3-D142): a fresh sweep for this build's recurring
             # "mechanism built and tested, zero production caller" class
             # (v3-D82 onward) found `purge_ledger` — the PDPA hard-purge
             # audit trail `pdpa:purge-due` (scheduled nightly since v3-D79)
             # writes to on every hard delete — had a real writer and zero
             # admin-facing readers, the same "written, never read" shape
             # v3-D129/D130/D141 each closed for `admin_audit`/
             # `flag_ramp_audit`/`entitlement_transitions`. An operator asked
             # "was learner X actually purged, and when" had a database
             # console and nothing else. Fixed on the same template:
             # `Admin\PurgeLedgerController::index()` (`GET
             # /api/admin/purge-ledger`, read-only) + `lib/admin/purgeLedger.ts`
             # + `PurgeLedgerPanel.tsx`, added beneath the existing
             # `PrivacyPanel` on `/settings/privacy` (no new route needed —
             # that page already hosts the other privacy-plane tools). RED
             # confirmed at all three layers (backend route+controller moved
             # aside, fetch client moved aside, panel component moved aside;
             # each failed on 404 or module resolution, each restored
             # byte-identically and reran green). `TZ=UTC make test`: 2340
             # passing (was 2320, +20 — exactly this run's new tests: 7
             # PHPUnit + 7 + 6 vitest). `check-test-floor.mjs`: OK, 2340 >=
             # floor 1899 (+441 margin). `TZ=UTC make build`: exit 0, 26
             # routes (unchanged — `/settings/privacy` already existed).
             # `npm run gates`: all green (fonts degraded-but-non-blocking,
             # pre-existing; boundaries 263 files, up from 259 — exactly the
             # four new apps/web files). `npx tsc --noEmit`: clean. No
             # `v1/**`/`v2/**` edit. No Arabic codepoint (every new/changed
             # file swept over the Arabic, Arabic Supplement, Arabic
             # Extended-A and both Presentation Forms blocks — zero matches).
             # NOT addressed: `rhymeClassOf()` (v3-D136);
             # `GlossDraftsController` (ratification-gated); the SSR override
             # gap's leftover items (v3-D132); the account-adoption frontend
             # (v3-D88..D94, deliberately deferred); the TEST-FLOOR margin
             # (left unmoved on purpose, v3-D95 onward). See DECISIONS.md
             # v3-D142.
             #
             # NOTE (v3-D141 — backfilled): commit `57cb7c3` wired the admin
             # billing surface (`Admin\AdminBillingController`, `GET
             # /api/admin/billing`, `lib/admin/billingAudit.ts`,
             # `BillingAuditPanel`, new `/settings/billing` route) closing
             # `entitlement_transitions`'s own "written, never read" gap —
             # same shape as v3-D129/D130. That commit's own message cited
             # "DECISIONS.md v3-D141 for the full writeup," but no such entry
             # was ever written, and this running comment was never updated
             # to the 2320 the commit itself reported. This note and a short
             # DECISIONS.md entry ("v3-D141 documentation gap") record that
             # the gap exists and point at the commit's own diff and test
             # file (`AdminBillingTest.php`, 8 cases) as the honest record of
             # what that run did, rather than fabricating a RED-confirmation
             # narrative this run did not itself perform.
             # NOTE (v3-D140): the daily anchor hour (`daybound.ts#anchorTime()`,
             # `User.anchor_hour`, `AuthController`'s `anchorHour` field on every
             # identity response) has existed since build-plan steps 5/13 with no
             # write path anywhere in `v3/api` and no reader anywhere in
             # `apps/web` — the value was silently discarded on arrival
             # (`apiFetch.ts#mintAnonymous` parses it into `AnonymousIdentity`
             # and never reads it again). Found by a fresh sweep of areas the
             # prior ~50 "built and tested, zero production caller" runs
             # (v3-D82 through v3-D139) had not explicitly checked clean:
             # `corpus-compiler/src`, `api/app` outside `Http/Controllers`, and
             # a full export sweep of `apps/web/lib`+`components`. Confirmed
             # via grep that `cfg.anchorHour` has exactly one reader anywhere in
             # `packages/engine/src` (`anchorTime()` itself) — it genuinely does
             # not change what the scheduler does tomorrow, which is why this
             # stayed OUT of onboarding: `lib/onboarding/choices.ts`'s own
             # header requires every captured field to "name the engine
             # function that consumes it," and this one doesn't.
             #
             # Fixed as a Settings-only preference, deliberately not a new
             # onboarding screen or a notification feature (the landing page's
             # own FAQ promises "no guilt notifications... a reminder that they
             # failed" — this run built no delivery mechanism of any kind, only
             # a stored preference and a display of it): new
             # `SettingsController` (`GET`/`POST /api/settings`, a near-verbatim
             # port of v2's own controller of the same name) +
             # `lib/settings/anchorHour.ts` (the `apiFetch`-only client,
             # mirroring `lib/account/api.ts`'s never-throws discipline) + a new
             # `AnchorHourPanel` card added to the existing `/settings` page.
             # `ANCHOR_CHOICES` (six secular, no-prayer-name time labels) is
             # ported verbatim from v2's `session/anchor.ts`.
             #
             # RED confirmed at all three layers: backend (`SettingsController`
             # moved aside + the two new route lines reverted, test kept) —
             # 404 on all 7 new PHPUnit cases; the fetch client (`anchorHour.ts`
             # moved aside, test kept) — module-resolution failure on all 6; the
             # component (`AnchorHourPanel.tsx` moved aside, the 5 new cases in
             # `test/settings-ui.test.tsx` kept) — module-resolution failure on
             # all 5. Each restored byte-identically and reran green. The
             # load-bearing component case proves a rejected save keeps
             # reporting the PREVIOUS confirmed value, never the failed
             # attempt — a bug this run's own first draft had, caught and fixed
             # during authoring before any test ran against it.
             #
             # `TZ=UTC make test`: 2299 passing (was 2281, +18 — exactly this
             # run's new tests: 7 PHPUnit + 6 + 5 vitest; no other suite moved).
             # `check-test-floor.mjs`: OK, 2299 >= floor 1899 (+400 margin).
             # `TZ=UTC make build`: exit 0, 25 routes (unchanged — `/settings`
             # already existed, this adds a card not a route). `npm run gates`:
             # locked-css OK, fonts degraded-but-non-blocking (pre-existing),
             # boundaries OK (253 files, up from 250 — exactly the three new
             # apps/web files), corpus-morphology OK, corpus-glyphs OK (206
             # codepoints, unchanged). `npx tsc --noEmit`: clean. No
             # `v1/**`/`v2/**` edit (stray `v2/tsconfig.tsbuildinfo` reverted
             # before committing). No Arabic codepoint (every new/changed file
             # swept over the Arabic, Arabic Supplement, Arabic Extended-A and
             # both Presentation Forms blocks — zero matches; every new line
             # addresses an hour, an English label ported verbatim from v2's
             # own copy, a boolean, or an href/testid string, never corpus
             # text). NOT addressed: `rhymeClassOf()` (v3-D136);
             # `GlossDraftsController` (ratification-gated); the SSR override
             # gap's leftover items (v3-D132); v2's "anchor adherence" admin
             # metric — v3 has no `AdminMetrics` equivalent at all, porting one
             # is real, separate, larger scope. See DECISIONS.md v3-D140.
             # NOTE (v3-D139): `/surah/[surah]`'s AYAT section rendered exactly
             # one hardcoded row, "Ayah 1", regardless of which surah was open
             # or how many ayat it has — a real, currently-reachable defect
             # (this route is linked from the dashboard's "MY SURAHS" list and
             # the library). `lib/progress/rows.ts#rowAtomKey`'s own docblock
             # already named the intended caller ("Exported for the surah
             # page's own use") that never existed. Also closed, negatively:
             # v3-D138's own flagged-but-unconfirmed `glossLang` worry —
             # traced directly, `/test` IS gloss-language's sole consumer BY
             # DESIGN (`ladder.ts`'s own header: S1 meaning items never grade
             # strength, and `s1Options`'s only caller anywhere is
             # `test.ts#vocabItem`), not an unwired gap.
             #
             # Fixed: new `components/surah/SurahAyahListIsland.tsx`
             # (island + exported pure `SurahAyahListView`, the same split
             # `AyahStatsIsland.tsx#AyahStatsView` already established) reuses
             # `buildProgressRows()` — the one place `/progress/list` and the
             # ayah-detail route already trust for stage/strength — filtered
             # to `kind === "ayah"` (seams stay the macro panel's job, not a
             # second rendering of the same joints). Three states: pending →
             # skeletons never zeros (#73); empty → every ayah still gets its
             # own honest "Not started" row, never omitted; broken → says so,
             # names the reason. The page drops its hardcoded Link/StageBadge/
             # StubNote and passes the real corpus + a server-resolved `now`.
             #
             # RED confirmed directly: the new (untracked) component file
             # moved aside, test kept — `Failed to resolve import
             # ".../SurahAyahListIsland"`; restored byte-identically, 9/9
             # green. The load-bearing case seeds 9 real `ayah_produced`
             # events through the actual `rebuild()`/`buildProgressRows`
             # pipeline and asserts the rendered row does NOT read "Not
             # started" and carries a real stage dot/label/value — proving
             # the wiring, not a fixture shortcut; a second case asserts the
             # row COUNT equals the corpus's real `ayahCount` (parametrized
             # 1/4/7/10), so a regression to a different hardcoded constant
             # still fails.
             #
             # `TZ=UTC make test`: 2281 passing (was 2272, +9 — exactly this
             # run's new test file; no other suite moved). `check-test-floor.mjs`:
             # OK, 2281 >= floor 1899 (+382 margin). `TZ=UTC make build`: exit
             # 0, 25 routes (unchanged — `/surah/[surah]` already existed).
             # `npm run gates`: locked-css OK, fonts degraded-but-non-blocking
             # (pre-existing), boundaries OK (251 files, up from 250 — exactly
             # the one new component file), corpus-morphology OK, corpus-
             # glyphs OK (206 codepoints, unchanged). `npx tsc --noEmit`
             # (via next build): clean. No `v1/**`/`v2/**` edit (stray
             # `v2/tsconfig.tsbuildinfo` reverted before committing). No
             # Arabic codepoint (full diff swept over every Arabic block plus
             # both Presentation Forms blocks and a `\u06xx`/`fromCharCode`
             # sweep — zero matches; every new line addresses an ayah number,
             # a boolean, or an href/testid string; the test's own Arabic
             # comes from the real `packages/engine/test/fixtures/12.json`
             # fixture, addressed by coordinate). NOT addressed: `rhymeClassOf()`
             # (v3-D136); `GlossDraftsController` (ratification-gated); the
             # SSR override gap's leftover items (v3-D132) — all unchanged.
             # See DECISIONS.md v3-D139.
             # NOTE (v3-D138): a fresh sweep for the recurring "mechanism built
             # and unit-tested, zero production caller" bug class (v3-D82
             # onward) found `packages/engine/src/pace.ts` — the Steady/
             # Sprint/Maintain pace dial, v2-BUG-1's own fix ("v1's
             # useSession.ts hardcoded budgetMin:8, so Steady and Sprint
             # collapsed to the same drip") — had its READ half (onboarding
             # screen 6 -> `commitOnboarding`) wired but its CONSUMING half
             # missing: `lib/session/run.ts#assembleFor` built
             # `assembleQueue`'s `cfg` with `learnCandidates` only, never
             # `budgetMin`/`gateTolerance`, and never called
             # `candidatesForPace()` at all — so `choices.ts`'s own docblock
             # claim ("Every field is consumed by the scheduler") was false
             # for `pace`. A Maintain learner ("doesn't unlock at all") still
             # got new Learn items; a Sprint learner never got the 16-minute
             # budget or the looser 1-gate tolerance; and on the small 112
             # surah, Steady's own newAyahCeiling:1 was never enforced either
             # — a virgin learner's first session silently unlocked all 4
             # ayat at once, hiding in this file's own pre-existing test
             # comments as "a fact about the corpus being small."
             #
             # Fixed end to end: `assembleFor`/`StartInput` gain an optional
             # `pace` (default `DEFAULT_PACE_MODE`, so an unmigrated caller is
             # unchanged), feeding `paceConfig(pace)`'s three fields into
             # `assembleQueue` together so they cannot drift apart;
             # `lib/home/queue.ts#buildHomeSurah` (the dashboard's due-count,
             # which must equal what the session actually serves — this
             # module's own header says so) takes the same parameter;
             # `SessionGate.tsx`/`TodaySession.tsx` read `choices.pace` and
             # thread it through `SessionIsland` to `startSession`.
             #
             # RED confirmed directly: `git stash` of the six source files
             # (tests kept) failed 4 of 6 new `run.test.ts` cases exactly as
             # predicted (Steady queued 4 learn items not 1; Maintain queued
             # one at all; Sprint capped at 4 not 3; Sprint's looser gate
             # tolerance never actually unlocked); restored, 6/6 green. Two
             # PRE-EXISTING tests broke on the (correct) behavior change and
             # were updated, not weakened: a Door-1 test whose own comment
             # admitted it relied on "a single natural session already learns
             # every one of its 4 ayat" now seeds all four directly via the
             # same public `append()` a real completion uses; and
             # `test/home-today.test.tsx`'s own independent second
             # implementation of the scheduler call (`engineDueCount` — kept
             # deliberately separate from `lib/home/queue.ts` so the test
             # proves agreement with the ENGINE, not with itself) now applies
             # the same pace ceiling, so it stays an honest oracle rather than
             # a re-legitimized copy of the old bug.
             #
             # `TZ=UTC make test`: 2272 passing (was 2266, +6 — exactly this
             # run's six new cases; the two rewritten tests are net +0, no
             # other suite moved). `check-test-floor.mjs`: OK, 2272 >= floor
             # 1899 (+373 margin). `TZ=UTC make build`: exit 0, 25 routes
             # (unchanged — a data-flow fix inside existing components/lib
             # modules, no new route). `npm run gates`: locked-css OK, fonts
             # degraded-but-non-blocking (pre-existing), boundaries OK (248
             # files, unchanged — zero new files this run), corpus-morphology
             # OK, corpus-glyphs OK (206 codepoints, unchanged). `npx tsc
             # --noEmit`: clean (`Version 6.0.2` confirmed). No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff reverted before committing). No Arabic
             # codepoint (full diff swept programmatically over every Arabic
             # block plus both Presentation Forms blocks — zero matches;
             # every changed line addresses a pace-mode string literal, an
             # ayah number, a minute count, or a boolean). NOT addressed:
             # `rhymeClassOf()` (v3-D136); `GlossDraftsController`
             # (ratification-gated); the SSR override gap's leftover items
             # (v3-D132); a possible parallel gap in `glossLang` flagged but
             # NOT independently confirmed by this run's sweep (the `/test`
             # route may legitimately be gloss-language's only consumer if
             # `/session` never renders a meaning-question type) — all
             # unchanged/unconfirmed. See DECISIONS.md v3-D138.
             # NOTE (v3-D137): v3-D136's own "not addressed" list named this
             # exactly: `components/macro/facts.ts`'s docblock claimed "the
             # test suite asserts these two declarations [the compiler's
             # `MacroFacts` and the UI's structural mirror of it] stay in
             # agreement" — grep-verified false, no such test existed
             # anywhere. Every other item on BUILD-PLAN's 32-step order is
             # DONE or human/calendar-blocked (27/28 need surah 67's scene
             # beats + the qari sessions; PAY-1 needs a live Stripe account;
             # step 30's remainder needs a staging host, live SMTP, and seven
             # real elapsed nights), so this run continued the v3-D82-onward
             # pattern of closing a real, narrowly-scoped, already-named gap.
             #
             # `MacroFacts` is erased at compile time, so "the two
             # declarations agree" has no runtime object to `expect()` — the
             # only place it is checkable is inside the type checker. New
             # `apps/web/lib/macro/facts-agreement.test.ts` type-only-imports
             # both declarations and feeds them into the standard strict
             # type-equality trick (`(<T>() => T extends A ? 1 : 2) extends
             # (<T>() => T extends B ? 1 : 2)`, which also catches a lone
             # field's optionality flipping); a divergence fails `tsc
             # --noEmit` (`typecheck-v3`, already part of `make test`) right
             # on that line, naming both declarations. The import is
             # `type`-only, so — unlike `lib/macro/facts.ts`'s existing,
             # deliberate, server-only VALUE import of `classify` — it
             # produces zero runtime bytes and never risks shipping the
             # classifier to the browser, the exact risk
             # `components/macro/facts.ts`'s own header warns against.
             #
             # RED confirmed directly: added a throwaway
             # `__drift_probe_v3D137?: string` field to the UI's `MacroFacts`
             # only, ran `npx tsc --noEmit` — exactly one error, on the
             # guard's own line (`TS2344: Type 'false' does not satisfy the
             # constraint 'true'`); reverted byte-identically (`git diff`
             # empty), clean again. `npx vitest run
             # lib/macro/facts-agreement.test.ts`: 1/1 green.
             #
             # `TZ=UTC make test`: 2266 passing (was 2265, +1 — exactly this
             # run's one new test; no other suite moved). `check-test-floor.mjs`:
             # OK, 2266 >= floor 1899 (+367 margin). `TZ=UTC make build`: exit
             # 0, 25 routes (unchanged — no new route, no production source
             # file touched). `npm run gates`: locked-css OK, fonts
             # degraded-but-non-blocking (pre-existing), boundaries OK (249
             # files, up from 248 — exactly the one new file), corpus-
             # morphology OK, corpus-glyphs OK (206 codepoints, unchanged —
             # this change carries no corpus data). `npx tsc --noEmit`:
             # clean. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted before
             # committing). No Arabic codepoint (the new file and the
             # temporary mutation both swept over every Arabic block plus
             # both Presentation Forms blocks — zero matches; every string in
             # the new file is a TypeScript identifier, a docblock, or the
             # `"@/components/macro/facts.ts"` import specifier already used
             # verbatim by `apps/web/test/macro-facts.test.ts`). NOT
             # addressed: `rhymeClassOf()` (v3-D136's own deferred LITANY
             # rhyme-share limb); `GlossDraftsController` (still
             # ratification-gated); the SSR override gap's leftover items
             # (v3-D132: six other `loadCorpus` callers, `API_BASE_URL`,
             # E-07) — all unchanged. See DECISIONS.md v3-D137.
             # NOTE (v3-D136): v3-D43 (2026-08-11) built `macro.ts#classify()`
             # (v3-D21's ATOMIC/RING/LITANY/ARC panel classifier) and its own
             # closing note said so explicitly: "only ATOMIC was decidable...
             # every non-ATOMIC surah would silently fall to ARC." Two weeks
             # and 90+ later decisions swept this codebase for exactly this
             # bug class ("mechanism built and tested, zero production
             # caller") and never found this one, because the real caller —
             # `apps/web/lib/macro/facts.ts#macroFactsFor`, whose own header
             # already documented the gap ("WHEN THE COMPILER EMITS
             # meta.macro... this module reads it directly and the fallback
             # below stops being reachable. That is the one-line change;
             # nothing else moves") — lives in a DIFFERENT package than
             # `classify()`, importing it directly from source across the
             # monorepo boundary. Every prior sweep grepped for callers
             # WITHIN the defining package, so a cross-package caller that
             # exists but supplies no real inputs read as "wired" when it
             # was still degenerating to the classifier's own worst case.
             # Concretely, for the real launch corpus: surah 12 (Yusuf, 111
             # ayat, 12 ruku) was rendering its macro panel as ARC — the
             # exact failure mode v3-D43's own motivating example named —
             # while it should be RING.
             #
             # Fixed the RING half completely: vendored each launch surah's
             # real Tanzil ruku count (`data/raw/{12,67,103,112}-ruku.json`,
             # fetched via `curl .../verses/by_chapter/<N>?fields=ruku_number`
             # and reduced to a per-surah COUNT of distinct global ruku
             # numbers — 12/2/1/1 respectively, cross-checked against the
             # well-known Yusuf/Al-Mulk divisions) and wired it through
             # `io.ts#loadInputs` -> `buildFromInputs` -> `buildCorpus.ts`,
             # which now calls `classify({ ayahCount, rukuCount, verseTexts
             # })` unconditionally and stamps the result on a new, always-
             # present `CorpusMeta.macro` field (`types.ts`). Verse texts are
             # threaded through too, so verbatim-refrain LITANY (the
             # classifier's OTHER decidable-without-new-data limb) is also
             # now live, at no extra cost. The rhyme-share LITANY limb needs
             # a `rhymeClassOf()` this run did NOT build — no vendored rhyme
             # data or transliteration table exists yet, and inventing one
             # is real, separate scope (see below) — so a surah that is
             # genuinely LITANY-by-rhyme still degrades honestly to ARC
             # (`authored: false`) exactly as before; nothing regresses,
             # nothing is silently claimed. `evenSegments()`'s existing
             # ring-geometry choice (even partitions, not real per-ruku
             # ayah boundaries) is unchanged — this fix supplies the COUNT
             # classify() already knew how to consume, not a new algorithm.
             #
             # `macroFactsFor` needed zero changes — its own `if (meta.macro)
             # return meta.macro` branch, previously unreachable in
             # production (every real corpus lacked the field), is now the
             # live path for every compiled surah; the fallback `classify()`
             # call is now reachable only via the frozen pre-emission engine
             # fixture (`packages/engine/test/fixtures/12.json`,
             # `test/ayah-detail.test.tsx`'s own deliberately-stable source,
             # never regenerated). Also fixed in passing: that file's own
             # docblock claimed "the test suite asserts these two
             # declarations [the compiler's and the UI's mirrored
             # `MacroFacts` types] stay in agreement" — grep-verified false,
             # no such test exists anywhere. Left unfixed and named rather
             # than silently absorbed into this run's scope: it is a real,
             # separate, small gap, and this run's job was the classifier
             # wiring, not an audit of every docblock claim it touched.
             #
             # RED confirmed directly: the new `corpus-compiler/test/
             # macro-wiring.test.ts` (7 cases) was run against the tree
             # before `buildCorpus.ts`/`io.ts`/`types.ts` were touched and
             # failed all 7 on `corpus.meta.macro` being `undefined`;
             # implemented after, 7/7 green, 118/118 in the full compiler
             # suite (was 111). A companion `apps/web/test/macro-facts.test.ts`
             # (3 cases, previously ZERO coverage on this function) proves
             # `macroFactsFor` returns a present `meta.macro` OBJECT-IDENTICAL
             # (not a re-derived copy) and still falls back correctly to
             # ATOMIC/ARC when it is absent; `test/ayah-detail.test.tsx`'s
             # 42 pre-existing cases (which load the frozen engine fixture,
             # so exercise the fallback path) are unaffected — reran
             # 42/42 green, unchanged.
             #
             # `TZ=UTC make test`: 2265 passing (was 2255, +10 — exactly
             # this run's new tests: 7 corpus-compiler + 3 apps/web; no
             # other suite moved). `check-test-floor.mjs`: OK, 2265 >= floor
             # 1899 (+366 margin). `TZ=UTC make build`: exit 0, 25 routes
             # (unchanged — no new route, this is a compiler+data change).
             # `npm run gates`: locked-css OK, fonts degraded-but-non-
             # blocking (pre-existing), boundaries OK (up by one test file
             # over v3-D135's own count), corpus-morphology OK, corpus-glyphs
             # OK (206 codepoints, unchanged — `meta.macro` carries no
             # Arabic). No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted before
             # committing). No Arabic codepoint (the full diff plus all five
             # new files swept over the Arabic, Arabic Supplement, Arabic
             # Extended-A and both Presentation Forms Unicode blocks — zero
             # matches; the vendored ruku files are bare integers and a
             # documented curl URL, never corpus text).
             #
             # KNOWN SIDE EFFECT, not a defect: every compiled corpus's
             # file-level content hash (`corpusHash`, `manifest.ts
             # #corpusContentHash16`) changes, because it hashes the whole
             # serialized artifact and `meta.macro` is a genuinely new field
             # on every surah. The per-ayah qari/admin VERIFICATION hashes
             # (`hash.ts#ayahQariHash`/`ayahAdminHash`, DEFECTS.md#B3) are
             # UNCHANGED — they hash specific verse/word/gloss/distractor
             # fields only, never the meta object — so this cannot amber an
             # existing sign-off. `docs/qa-samples/*.json`'s committed
             # `corpusHash` values will read STALE on the next
             # `make content-freeze` after a recompile, the same expected,
             # already-designed-for consequence AL-MULK-SCENE-BEATS.md
             # documents for scene-beat authoring — the gate reports this
             # honestly rather than lying, and it is not something to route
             # around.
             #
             # NOT addressed, named so a future run doesn't re-discover it
             # as new: `rhymeClassOf()` (the LITANY rhyme-share limb) is
             # real, separate, scope — needs a vendored per-ayah rhyme
             # profile (not currently fetched anywhere) and a transliteration
             # scheme designed carefully enough to stay inside Absolute B
             # (a rhyme LABEL must be a transliteration, never Arabic
             # bytes); `components/macro/facts.ts`'s untested "mirror"
             # docblock claim (above); `GlossDraftsController` remains
             # gated on the unrecorded ratification (v3-D125 era); the SSR
             # override gap's own leftover items (v3-D132) are unchanged.
             # See DECISIONS.md v3-D136.
             # NOTE (v3-D135): `OverrideEditor` (v3-D125/D126/D134) still had
             # no write surface for `group` (multi-word idiom grouping) — the
             # LAST of the four override fields left unbuilt, named across
             # v3-D126/D129/D130/D131/D134's own "not addressed" lists every
             # time this file was touched. The READ side was never the gap:
             # `applyOverrides` has resolved `group` overrides (stamping
             # `CorpusWord.groupPositions`, read by `ladder.ts`'s S1 pass)
             # since DATA-1 landed; only `POST /api/overrides` with
             # `field: "group"` had zero frontend callers. Needs no word-tap,
             # same proof as distractor's own closure last run: `GroupPayload
             # #groupWith` is same-ayah-only member positions, narrower than
             # distractor's whole-surah pool, so the picker is an anchor-word
             # dropdown plus `GROUP_SLOTS` (3) "group with" dropdowns, both
             # sourced from THIS AYAH's own `words` — never a free-text
             # field, never `surahWords`. Fixed: `lib/overrides/write.ts
             # #groupOverride` (mirrors glossOverride/disableOverride/
             # distractorOverride, stamps `questionType: "s1"` matching
             # `ladder.ts`'s S1 consumer) + a new "Group words (idiom)"
             # fieldset in `OverrideEditor.tsx`, self-excluding the anchor
             # from its own replacement pool (same discipline
             # `distractorCandidates` already applies); `summarize()`'s
             # existing but previously-unreachable `group` branch now also
             # reports the member count. RED confirmed directly: `git stash`
             # of the two source files alone (5 new tests kept — 2 in
             # `write.test.ts`, 3 in `workbench-override-editor.test.tsx`)
             # failed all 5, the 19 pre-existing cases in those files
             # unaffected; restored byte-identically, 24/24 green. `TZ=UTC
             # make test`: 2255 passing (was 2250, +5 — exactly this run's
             # new tests; no other suite moved). `check-test-floor.mjs`: OK,
             # 2255 >= floor 1899 (+356 margin). `TZ=UTC make build`: exit 0,
             # 25 routes (unchanged — renders inside the existing
             # `/workbench` page). `npx tsc --noEmit`: clean. `npm run
             # gates`: all green (fonts degraded-but-non-blocking,
             # pre-existing; boundaries 246 files, unchanged count — no new
             # production file). `make doctor`: clean. No `v1/**`/`v2/**`
             # edit. No Arabic codepoint (full diff swept over every Arabic
             # block + presentation forms via a codepoint-aware scan, zero
             # matches; every new line addresses a word position, an
             # anchor/member integer, or a compound key string, never corpus
             # text — test fixtures use synthetic placeholders
             # "target"/"other"/"member"/"third", matching the file's own
             # convention). With this, **all four** override fields
             # (`gloss`, `disable`, `distractor`, `group`) have a real
             # admin/qari write surface — the override authoring layer named
             # across v3-D125/D126/D129/D130/D131/D134 is now complete. NOT
             # addressed: `GlossDraftsController` (ratification-gated); the
             # SSR override gap's own leftover items (v3-D132: six
             # `loadCorpus` callers, `API_BASE_URL`, E-07). See
             # DECISIONS.md v3-D135.
             # NOTE (v3-D134): `OverrideEditor` (v3-D125/D126) was scoped to
             # `gloss`/`disable` only — `distractor`'s own header named the
             # gap three times over ("needs a word-tap CorpusRef picker...
             # real, separate future work", repeated verbatim by v3-D132)
             # without noticing gloss/disable's OWN picker — a `<select>`
             # built from `words[].text_uthmani`, never a free-text field or
             # a tap — already satisfies the "no typed Arabic" guarantee for
             # exactly this shape; `WorkbenchIsland`'s "cannot type Arabic
             # into any answer field" is about the SPEC EDITOR's still-
             # unbuilt answer picker (§22b, a genuinely different surface),
             # not about override authoring. Fixed: `lib/overrides/write.ts
             # #distractorOverride` (mirrors glossOverride/disableOverride)
             # + a new "Replace distractors" fieldset in `OverrideEditor.tsx`
             # — a target-word dropdown (this ayah's `words`) plus 4
             # replacement-word dropdowns sourced from a new `surahWords`
             # prop (the WHOLE surah, threaded from `WorkbenchIsland`'s
             # existing `corpus.words`), keyed `${ayah}:${position}` since
             # `CorpusWord.position` is only unique within an ayah and a
             # useful replacement may come from elsewhere in the surah (the
             # foil-kernel table above: same-root, same-surah). Rank =
             # pick order; the target word is excluded from its own
             # replacement pool. `group` (idiom grouping) stays deferred —
             # smaller, rarer, real separate work. RED confirmed directly:
             # `git stash` of the three source files alone (5 new tests
             # kept — 2 in `write.test.ts`, 3 in
             # `workbench-override-editor.test.tsx`) failed all 5, the 14
             # pre-existing cases in those files unaffected; restored
             # byte-identically, 19/19 green. `TZ=UTC make test`: 2250
             # passing (was 2245, +5 — exactly this run's new tests; no
             # other suite moved). `check-test-floor.mjs`: OK, 2250 >= floor
             # 1899 (+351 margin). `TZ=UTC make build`: exit 0, 25 routes
             # (unchanged — renders inside the existing `/workbench` page).
             # `npx tsc --noEmit`: clean. `npm run gates`: all green (fonts
             # degraded-but-non-blocking, pre-existing; boundaries 246
             # files, unchanged count — no new production file). No
             # `v1/**`/`v2/**` edit. No Arabic codepoint (full diff swept
             # over every Arabic block + presentation forms, zero matches;
             # every new line addresses a word position, a rank integer, or
             # a compound key string, never corpus text — test fixtures use
             # synthetic placeholders "target"/"other"/"third", matching the
             # file's own convention). NOT addressed: `group` override
             # authoring; `GlossDraftsController` (ratification-gated); the
             # SSR override gap's own leftover items (v3-D132: six
             # `loadCorpus` callers, `API_BASE_URL`, E-07). See
             # DECISIONS.md v3-D134.
             # NOTE (v3-D133): B11's own closing note (v3-D101, 2026-08-17)
             # named a gap it deliberately left open — "a session whose only
             # work was a passed gate now shows 0 ayat completed on the
             # summary screen... a small, separate UI question" — and it sat
             # untouched through 30+ later decisions (confirmed by grepping
             # every DECISIONS.md entry since for `ayatCompleted`).
             # `packages/engine/src/sessionSummary.ts#summarizeSession`
             # counted `ayatCompleted` only from `ayah_complete`/
             # `ayah_produced` events; a completed cold gate commits
             # `gate_result` INSTEAD (by design, v3-D101/D107), so a queue
             # whose only due item was a gate (real and reachable — a due
             # gate is `floorQueue`'s own top priority, v3-D108) credited
             # nothing on `SessionIsland.tsx:591`'s real "{N} ayat" summary
             # line for a learner who had just passed their scheduling-
             # critical cold check. Fixed: a third fold branch — a PASSED
             # `gate_result` pushes its ayah onto `ayatRefs` exactly like
             # `ayah_produced`/`ayah_complete` already do, deduped against a
             # same-session rescaffold warm-up's own S2 completion for the
             # same ayah (v3-D109); a FAILED gate still counts as nothing.
             # RED confirmed twice, independently: reverting the engine
             # source alone failed the new positive `sessionSummary.test.ts`
             # case (`expected +0 to be 1`) while two same-file edge cases
             # passed vacuously against the unfixed code — proof that a
             # well-chosen positive case, not just edge cases, was
             # load-bearing here; separately, a new `run.test.ts` case drives
             # a REAL `startFloorSession` → gate completion through
             # `answerCurrent` → `sessionSummaryOf`, the exact function
             # `SessionIsland` calls, and failed identically against the
             # reverted source. That second test deliberately does NOT reuse
             # this file's own shared `playThrough` helper, which hardcodes
             # taps at a fixed `T0`-anchored `now` — harmless for every OTHER
             # assertion in the file (all read the raw log unfiltered by
             # time) but wrong for anything that depends on
             # `sessionSummaryOf`'s own `ts >= run.startedAt` slice, since a
             # real tap's `now` is always at or after its own session's
             # start; a local, correctly time-ordered loop was used instead,
             # rather than widening this fix into the 29 other call sites
             # that already rely on the helper's current shape. `TZ=UTC make
             # test`: 2245 passing (was 2241, +4 — exactly this run's new
             # tests: 3 + 1 net; no other suite moved). `check-test-floor.mjs`:
             # OK, 2245 >= floor 1899 (+346 margin). `TZ=UTC make build`: exit
             # 0, 25 routes (unchanged — no new route, no new UI, a pure
             # logic fix inside an already-wired function). `npx tsc
             # --noEmit`: clean. `npm run gates`: all green (fonts
             # degraded-but-non-blocking, pre-existing; boundaries 247 files,
             # unchanged count — no new production file). No `v1/**`/`v2/**`
             # edit. No Arabic codepoint (every new/changed file swept over
             # the Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms blocks, plus a `\u06xx`/`\u08xx`-escape and
             # `fromCharCode` sweep — zero matches; every new line addresses
             # an ayah number, a boolean, or a millisecond timestamp, never
             # corpus text). NOT addressed: the `playThrough` helper's
             # fixed-T0 timing quirk itself (real, separate, wider-reaching);
             # v3-D132's own "not addressed" list (six other `loadCorpus`
             # callers, `API_BASE_URL`, E-07) is unchanged. See DECISIONS.md
             # v3-D133.
             # NOTE (v3-D132): the SSR corpus loader (`lib/corpus/load.ts`)
             # never applied overrides — a qari/admin gloss correction
             # written through the already-shipped `POST /api/overrides`
             # reached the CLIENT drill session (v3-D96) but never a
             # server-rendered page. `/surah/[surah]/[ayah]` prints
             # `wordGloss(word)` straight from the raw corpus; `/workbench`'s
             # `explain(corpus, spec)` traces a preview against it too, so an
             # admin judging whether a correction is needed — or verifying
             # one already made — saw stale, pre-correction text from the
             # very tool built to review it. v3-D96/D110 both named this SSR
             # half explicitly and left it, reasoning the codebase "has no
             # established pattern for the Next.js server to call the
             # Laravel API over HTTP" — still mostly true, but
             # `GET /api/overrides` carries no `admin` middleware (verified
             # against `routes/api.php`), so no bearer token or 401
             # interceptor needed reinventing server-side; what remained was
             # a small, narrowly-scoped fetch. Fixed: new
             # `lib/overrides/fetchServer.ts#fetchServerOverrides` (the SSR
             # counterpart to `lib/overrides/fetch.ts`, duplicated rather
             # than imported — a `"use client"` module's plain function
             # exports do not resolve across the RSC boundary, the same
             # failure `lib/corpus/staged.ts` documents for a constant) +
             # `lib/corpus/load.ts#loadEffectiveCorpus` (mirrors
             # `lib/corpus/client.ts#EffectiveCorpus`; delegates to the
             # existing cached `loadCorpus` for the raw read, but does NOT
             # cache the override merge itself — `loadCorpus`'s cache lives
             # for the server PROCESS lifetime, and overrides are
             # admin-mutable, so caching the merge would hide a correction
             # until restart). `loadCorpus` itself is UNCHANGED; six other
             # callers (`/plan`, `/progress`, `/progress/list`, `/drill`,
             # `/practice`, `lib/library/rows.ts`) still read it directly,
             # verified by grep to render no `gloss`/`distractor` text. RED
             # confirmed by reverting the tracked source files (new files
             # moved aside, tests kept): 9 of 72 apps/web test files failed —
             # module resolution on `loadEffectiveCorpus`, plus two wiring
             # assertions against the unmodified page sources. `TZ=UTC make
             # test`: 2241 passing (was 2231, +10 — exactly this run's new
             # tests: 8 + 1 + 1; no other suite moved). `check-test-floor.mjs`:
             # OK, 2241 >= floor 1899 (+342 margin). `TZ=UTC make build`:
             # exit 0, 25 routes (unchanged — no new route). `npx tsc
             # --noEmit`: clean. `npm run gates`: all green (fonts
             # degraded-but-non-blocking, pre-existing; boundaries 246 files,
             # up from 244, two new files — `check-boundaries.mjs` clause 6
             # gained a narrowly-justified second egress exemption for
             # `fetchServer.ts`, explained in its own comment). No
             # `v1/**`/`v2/**` edit. No Arabic codepoint (every new/changed
             # file swept over the Arabic, Arabic Supplement, Arabic
             # Extended-A and both Presentation Forms blocks, plus a
             # `\u06xx`/`\u08xx`-escape and `fromCharCode` sweep — zero
             # matches; the test marker is a plain English constant over a
             # fixture coordinate). NOT addressed: the six other-callers list
             # above (none currently render override-sensitive text, so this
             # is not a partial pass); `API_BASE_URL`'s
             # `http://localhost:8001` default is a local-dev placeholder —
             # gate 20's real hosting shape is still open and should set it
             # explicitly once decided; DEFECTS.md#E-07 (per-surah corpus
             # fetch unguarded) is untouched. See DECISIONS.md v3-D132.
             # NOTE (v3-D131): `QariMode` offered the qari-tier signature to
             # every admin regardless of role — role-based UI gating,
             # named unaddressed since v3-D127 and repeated through
             # v3-D128/D129/D130's own "NOT addressed" lists.
             # `VerificationsController::store` has required
             # `AdminRole::QARI` for `tier: qari` since v3-D92,
             # server-enforced correctly; the gap was that `GET
             # /api/admin/whoami`'s own `roles` field, returned since
             # v3-D127, was read in exactly one place — the session-bar
             # string in `AdminGate` — so every admin saw "Qari tier" as a
             # live option, defaulted to it, and only learned from a 403
             # after filling in the whole form that they were never
             # eligible. Fixed: new `lib/admin/identity-context.tsx`
             # (`AdminIdentityProvider`/`useAdminRoles()`, deny-by-default —
             # `[]` with no provider, never a throw) threads the identity
             # `AdminGate` already fetches down via React context, no
             # second `/whoami` call. `QariMode` disables the qari-tier
             # radio (with a caption explaining why, never a silent hide),
             # defaults the initial selection to `admin` when the caller
             # cannot sign qari, and folds the check into the sign button's
             # own `canSign` gate. The admin tier stays ungated (v3-D13
             # never conditioned it on scholarship). Nothing about what the
             # SERVER accepts changed — this is entirely what the UI
             # honestly offers before a request is sent. RED confirmed two
             # ways: moving the new context module aside failed the whole
             # test file on import resolution; separately, restoring the
             # context module but reverting only `AdminGate`/`QariMode`
             # (old ungated `QariMode` against the new context) failed 5 of
             # 8 new tests genuinely — the disabled state, the caption and
             # the tier default were all absent — while 3 passed vacuously
             # (the admin-tier-never-gated assertions). `TZ=UTC make test`:
             # 2231 passing (was 2223, +8 — exactly this run's new tests in
             # `test/workbench-qari-mode.test.tsx`). `check-test-floor.mjs`:
             # OK, 2231 >= floor 1899 (+332 margin). `TZ=UTC make build`:
             # exit 0, 25 routes (unchanged — no new route). `npx tsc
             # --noEmit`: clean. `npm run gates`: all green (fonts
             # degraded-but-non-blocking, pre-existing; boundaries 244
             # files, up from 242, two new files). No `v1/**`/`v2/**` edit.
             # No Arabic codepoint (every new/changed file swept over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms blocks, plus a `\u06xx`/`\u08xx`-escape
             # and `fromCharCode` sweep — zero matches). A server-side
             # grep (`hasAdminRole`/`AdminRole::`) confirms `tier: qari` is
             # the ONLY role-gated action in the app today, so this closes
             # the gap completely for the current surface rather than
             # partially covering a longer list. NOT addressed:
             # `GlossDraftsController` (still ratification-gated);
             # `distractor`/`group` override authoring (v3-D126) — both
             # unchanged. See DECISIONS.md v3-D131.
             # NOTE (v3-D130): `FlagRampAudit` had three writers
             # (`FlagService::kill`/`ramp`/`acknowledgeKill`, the last also
             # called unattended by the nightly `autoWaiveDueKills`
             # scheduler) and zero readers — the exact gap v3-D125 named for
             # this table and v3-D129 explicitly deferred ("picking one
             # audit trail and doing it well... was the scope choice").
             # Fixed: new `Admin\FlagAuditController::index()` (`GET
             # /api/admin/flags/audit`, read-only — no write route
             # registered at all) + `lib/admin/flagAudit.ts` (mirrors
             # `lib/admin/audit.ts`'s three-state discipline) +
             # `components/admin/FlagAuditPanel.tsx`, wired directly into
             # the existing `/settings/flags` page beneath `FlagsPanel`
             # (unlike `admin_audit`, this trail is scoped entirely to the
             # flag plane, so it gets no second nav destination). The actor
             # is pseudonymized on the way out, same as `AdminAuditController`
             # — but `flag_ramp_audit.actor_admin_id` IS NULLABLE (the
             # scheduler's auto-waive has no admin at all), so the naive
             # port of that one-liner would have fataled on the first
             # auto-waive row; `FlagAuditController` special-cases the null
             # actor explicitly and a dedicated test seeds exactly that row
             # and asserts a 200 with `actor: null`, not a 500. RED
             # confirmed at every layer: the backend route did not exist
             # (all 7 new PHPUnit cases 404'd against unmodified
             # `routes/api.php`; one iteration needed — the controller's
             # first draft omitted `use App\Http\Controllers\Controller;`
             # and fataled on `Class "App\Http\Controllers\Admin\Controller"
             # not found`, fixed, reran clean); `lib/admin/flagAudit.ts` and
             # `FlagAuditPanel.tsx` were each moved aside with their tests
             # kept and `vitest run` re-executed — both failed on module
             # resolution; every file restored byte-identically, all green
             # after. `TZ=UTC make test`: 2223 passing (was 2204, +19 —
             # exactly this run's new tests: 7 PHPUnit + 7 + 5 vitest).
             # `check-test-floor.mjs`: OK, 2223 >= floor 1899 (+324 margin).
             # `TZ=UTC make build`: exit 0, 25 routes (unchanged — no new
             # route). `npx tsc --noEmit`: clean. `npm run gates`: all green
             # (fonts degraded-but-non-blocking, pre-existing; boundaries 242
             # files, up from 238, four new files). No `v1/**`/`v2/**` edit.
             # No Arabic codepoint (every new/changed file swept over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms blocks, plus a `\u06xx`/`\u08xx`-escape and
             # `fromCharCode` sweep — zero matches). NOT addressed:
             # `GlossDraftsController` (still ratification-gated);
             # `distractor`/`group` override authoring (v3-D126); role-based
             # UI gating within the admin console (v3-D127) — all unchanged.
             # With this, both audit trails BUILD-PLAN M8 names have a real
             # reader; the "built + populated + zero read surface" sweep
             # that produced v3-D129/D130 has exhausted the two known
             # append-only audit tables. See DECISIONS.md v3-D130.
             # NOTE (v3-D129): `admin_audit` had four writers
             # (`AdminRevealController::reveal`, `AdminUsersController
             # ::exportCsv`, `SystemHealthController::rebuildAtomCache`,
             # `StripeSettingsController::test`) and zero readers — no
             # controller anywhere ever read the append-only audit trail
             # back, so the `AdminAudit::booted()` update/delete guard was
             # unverifiable by any human short of a database console.
             # BUILD-PLAN M8 names this exact gap: "nav homes for
             # flags/reports/templates/audit viewer." v3-D128's own closing
             # claim ("every admin controller with a real read surface has
             # a frontend caller, the sweep is exhausted") was true of
             # *controllers* and false of the *model* four of them wrote
             # to. Fixed: new `Admin\AdminAuditController::index()` (`GET
             # /api/admin/audit`, read-only — no write route registered at
             # all) + `lib/admin/audit.ts` (mirrors `lib/admin/flags.ts`'s
             # three-state discipline) + `components/admin/AuditLogPanel.tsx`,
             # wired into a new standalone `/settings/audit` route. The
             # ACTOR is pseudonymized on the way out too — `actor_admin_id`
             # is a raw FK that had never been read back anywhere; returning
             # it verbatim would have made this the one screen that
             # deanonymizes an admin's own identity to their peers, so the
             # same `Pseudonymizer` HMAC every other admin surface uses is
             # applied here too (dedicated test asserts the response never
             # carries the raw integer id). Capped at 200 recent entries,
             # not paginated — a review surface, not a table browser,
             # matching `AdminUsersController`'s own "no browse-all-learners
             # picker" scope discipline (v3-D128); a `subject` query param
             # narrows to one pseudonym. RED confirmed at every layer: the
             # backend route did not exist (all 5 new PHPUnit cases 404'd
             # against unmodified `routes/api.php`); `lib/admin/audit.ts`
             # and `AuditLogPanel.tsx` were each moved aside with their
             # tests kept and `vitest run` re-executed — both failed on
             # module resolution; every file restored byte-identically, all
             # green after. `TZ=UTC make test`: 2204 passing (was 2187, +17
             # — exactly this run's new tests: 5 PHPUnit + 7 + 5 vitest).
             # `check-test-floor.mjs`: OK, 2204 >= floor 1899 (+305 margin).
             # `TZ=UTC make build`: exit 0, 25 routes (was 24 —
             # `/settings/audit` is new). `npx tsc --noEmit`: clean. `npm
             # run gates`: all green (fonts degraded-but-non-blocking,
             # pre-existing; boundaries 238 files, up from 233, five new
             # files). No `v1/**`/`v2/**` edit (stray
             # `v2/tsconfig.tsbuildinfo` reverted before committing). No
             # Arabic codepoint (every new/changed file swept over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms blocks, plus a `\u06xx`/`\u08xx`-escape and
             # `fromCharCode` sweep — zero matches). NOT addressed:
             # `FlagRampAudit` (v3-D125) has the identical "written, never
             # read" shape and its own audit viewer is still unbuilt;
             # `GlossDraftsController` remains ratification-gated;
             # `distractor`/`group` override authoring (v3-D126) and
             # role-based UI gating within the admin console (v3-D127) are
             # both unchanged. See DECISIONS.md v3-D129.
             # NOTE (v3-D128): `Admin\RevealController` and
             # `Admin\AdminUsersController::exportCsv` — WIREFRAME §16's
             # reveal-identity and bulk-CSV-export surfaces, two of the three
             # zero-caller admin controllers v3-D125 named and twice deferred
             # ("its own careful UI pass") — had zero frontend callers, the
             # same "built + tested + zero production callers" shape as
             # v3-D100/D124/D125/D126/D127. Fixed: new `lib/admin/reveal.ts`
             # (`revealIdentity`/`checkRevealToken`, mirroring
             # `lib/admin/flags.ts`'s "the server decides everything"
             # discipline — reason-code set, >=10-char minimum, the PII-scan-
             # then-acknowledge flow and the reveal TTL are all server-decided
             # and rendered verbatim) + `lib/admin/users.ts`
             # (`downloadUsersCsv`, driving a real authenticated browser
             # download via an object URL since the endpoint needs a Bearer
             # token a plain `<a href>` cannot carry) + new
             # `components/admin/PrivacyPanel.tsx`, wired into a new
             # standalone `/settings/privacy` route. Deliberately no
             # "browse all learners" picker — `AdminUsersController` exposes
             # no JSON listing, only the identity-free CSV, so the reveal
             # form takes a typed user id the way an operator already has it
             # (a support ticket), matching v3-D110's own scope discipline
             # rather than inventing a second backend surface. Edge cases
             # #148 (an anonymous subject renders a distinct `anonymous`
             # state, never conflated with `not-found`) and #149 (a
             # PII-shaped reason renders the server's own `detected[]`/`hint`
             # and re-submits only on an explicit acknowledgement) are
             # rendered exactly as the server decided them, never re-derived
             # client-side. `GlossDraftsController`, the third surface
             # v3-D125 named, stays untouched — gated on Firdaus's
             # unrecorded ratification. RED confirmed three times (one per
             # new file pair): each new source file was moved aside with its
             # test kept and `vitest run` re-executed — all three failed on
             # module resolution; restored byte-identically, all green.
             # `TZ=UTC make test`: 2187 passing (was 2165, +22 — exactly this
             # run's new tests: 11 + 4 + 7). `check-test-floor.mjs`: OK, 2187
             # >= floor 1899 (+288 margin). `TZ=UTC make build`: exit 0, 24
             # routes (was 23 — `/settings/privacy` is new). `npm run gates`:
             # all green (fonts degraded-but-non-blocking, pre-existing;
             # boundaries 233 files, up from 230, three new production
             # files). No `v1/**`/`v2/**` edit. No Arabic codepoint. NOT
             # addressed: `GlossDraftsController` (the last v3-D125 surface,
             # still ratification-gated); `distractor`/`group` override
             # authoring (v3-D126); role-based UI gating within the admin
             # console (v3-D127) — this panel is reachable by any
             # allowlisted admin regardless of role. With this, every admin
             # controller with a real write/read surface has a frontend
             # caller — see DECISIONS.md v3-D128.
             # NOTE (v3-D127): the admin client-side auth gate — named unbuilt
             # since v3-D92 and repeated through v3-D100/D124/D125/D126, each
             # quoting the same reason: "a redirect with no server
             # enforcement behind it would be security theatre." The missing
             # half was a real login+check round-trip, not a backend gap —
             # `POST /api/admin/login` (`AdminAuthController`) has existed,
             # timing-oracle-hardened, since build-plan step 24, with zero
             # frontend callers. Fixed: new `GET /api/admin/whoami` (same
             # `admin` middleware chain every write already sits behind) +
             # `lib/admin/session.ts` (checkAdminSession/adminLogin/
             # adminLogout) + `components/admin/AdminGate.tsx`, wired into
             # `(admin)/layout.tsx` around `{children}` — gates all five
             # admin screens (`/workbench`, `/settings/health`, `/settings/
             # flags`, `/settings/content-freeze`, `/settings/stripe`) with
             # one change, since they share this layout. Changes NOTHING
             # about what data an unauthorized REQUEST can reach (every
             # admin write was already `EnsureIsAdmin`-gated); it only stops
             # an unauthorized VISITOR from seeing staff chrome instead of a
             # real login form. This run also swept `v3/worker/fold-runner/src`
             # (the layer v3-D126 named as the next unswept one) and found it
             # genuinely clean — see DECISIONS.md v3-D127 for both the
             # negative fold-runner finding and the gate fix's full write-up.
             # `TZ=UTC make test`: 2165 passing (was 2144, +21 — exactly this
             # run's new tests: 5 PHPUnit + 16 vitest). `check-test-floor.mjs`:
             # OK, 2165 >= floor 1899 (+266 margin). `TZ=UTC make build`: exit
             # 0, 23 routes (unchanged — no new route). `npm run gates`: all
             # green (fonts degraded-but-non-blocking, pre-existing;
             # boundaries 226 files, up from 223, three new production
             # files). No `v1/**`/`v2/**` edit. No Arabic codepoint. NOT
             # addressed: `distractor`/`group` override authoring; role-based
             # UI gating within the admin console (AdminGate proves ADMIN,
             # not WHICH admin role); the three other zero-caller admin
             # surfaces v3-D125 named. See DECISIONS.md v3-D127.
             # NOTE (v3-D126): `OverridesController::store` (`POST
             # /api/overrides`, the admin WRITE path B1/B3's closures depend
             # on) had zero frontend callers — v3-D125's own closing note
             # named this exact gap: "there is still no UI anywhere for an
             # admin/qari to actually correct a gloss or distractor...
             # workbench signs verifications only, never writes an
             # override." Scoped to the two fields that need no typed
             # Arabic: `gloss` (an EN/MS text correction) and `disable` (a
             # toggle over an existing word position, chosen from a
             # dropdown, never typed). `distractor` needs a word-tap
             # CorpusRef picker — the same reason `WorkbenchIsland`'s own
             # spec editor leaves its answer picker unbuilt rather than
             # stubbed with a free-text field, since that field's payload is
             # raw Arabic — and `group` (multi-word idiom grouping) is
             # deferred alongside it, both real separate future work. Fixed:
             # new `lib/overrides/write.ts` (mirrors `lib/workbench/sign.ts`'s
             # never-throws discipline) + `components/workbench/OverrideEditor.tsx`,
             # wired into `WorkbenchIsland` beside `QariMode`. Lists existing
             # overrides for the open ayah (reusing
             # `lib/overrides/fetch.ts#fetchOverrides`, the same function the
             # learner corpus loader calls), a gloss-correction form, and a
             # disable/re-enable form (question-type dropdown mirrors
             # `lib/test/build.ts#TestItemKind`, the actual set
             # `isQuestionDisabled` is checked against). Re-enable posts a
             # NEW row with `disabled: false` — never an edit in place,
             # matching `DisablePayload`'s own append-only contract. RED
             # confirmed directly: both new test files were run against the
             # tree before either source file existed and failed on
             # module-resolution errors; implemented after, 14/14 green.
             # `TZ=UTC make test`: 2144 passing (was 2130, +14 — exactly this
             # run's new tests). `check-test-floor.mjs`: OK, 2144 >= floor
             # 1899 (+245 margin). `TZ=UTC make build`: exit 0, 23 routes
             # (unchanged — no new route, renders inside the existing
             # `/workbench` route). `npm run gates`: all green (fonts
             # degraded-but-non-blocking, pre-existing; boundaries 223 files,
             # up from 218, four new files). No `v1/**`/`v2/**` edit (stray
             # `v2/tsconfig.tsbuildinfo` reverted before committing). No
             # Arabic codepoint (every new/changed file swept over the
             # Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms blocks, zero matches). NOT addressed:
             # `distractor`/`group` override authoring (needs the word-tap
             # CorpusRef picker); the admin client-side auth gate
             # (pre-existing, named gap). The other three zero-caller
             # surfaces v3-D125 named (`AdminRevealController`/
             # `AdminUsersController`, `GlossDraftsController`) are
             # unchanged. `v3/worker/fold-runner/src` remains entirely
             # unswept. See DECISIONS.md v3-D126.
             # NOTE (v3-D125): `Admin\FlagController` (build-plan step 26/M8,
             # the flag plane) had zero frontend callers — BUILD-PLAN's own M8
             # line names "nav homes for flags/reports/templates/audit viewer"
             # as a deliverable never built, and `grep -rln "admin/flags"
             # apps/web` (excluding this run's new files) returned nothing.
             # Same "built + tested, zero production caller" shape as
             # v3-D100/D124, found by continuing v3-D124's own named next
             # step: the sweep of `v3/api/app/Http/Controllers`. Fixed: new
             # `lib/admin/flags.ts` (mirrors `lib/admin/health.ts`'s
             # three-state discipline) + `components/admin/FlagsPanel.tsx` +
             # a new standalone `/settings/flags` route (mirrors
             # `/settings/health`'s and `/settings/content-freeze`'s shape).
             # Kill stays one click (no ceremony); enable renders the full
             # ceremony form but validates none of it client-side beyond
             # making the form usable — every rule (>=20-char reason, verbatim
             # typed name, both ethics booleans, the version-conflict check)
             # is asserted only by the server and its response rendered
             # verbatim, per BUILD-PLAN's own "SERVER-ENFORCED" requirement.
             # Also resolved, not just noted: v3-D124's own "worth a future
             # run's attention" 401-vs-403 finding turned out to be NOT a bug.
             # `SystemHealthTest::setUp()` authenticates every test in the
             # class (incl. `test_health_requires_admin`, which merely empties
             # the admin allowlist) — so that test hits `EnsureIsAdmin`'s
             # allowlist check and correctly gets 403; `ContentFreezeTest
             # ::test_the_freeze_report_requires_admin` never authenticates at
             # all, so `auth:sanctum` itself correctly returns 401 before
             # `EnsureIsAdmin` runs. No middleware inconsistency exists; the
             # two tests exercise different scenarios and both status codes
             # are textbook-correct for their own case. No code changed for
             # this finding — recorded so it is not re-opened as live. RED
             # confirmed directly: both new test files were run against the
             # tree before either source file existed and failed on
             # module-resolution errors; implemented after, 20/20 green.
             # `TZ=UTC make test`: 2130 passing (was 2110, +20 — exactly this
             # run's new tests). `check-test-floor.mjs`: OK, 2130 >= floor
             # 1899 (+231 margin). `TZ=UTC make build`: exit 0, 23 routes (was
             # 22 — `/settings/flags` is new). `npm run gates`: all green
             # (fonts degraded-but-non-blocking, pre-existing; boundaries 218
             # files, up from 214, four new files). No `v1/**`/`v2/**` edit
             # (stray `v2/tsconfig.tsbuildinfo` reverted before committing).
             # No Arabic codepoint (full diff swept over every Arabic block +
             # both Presentation Forms blocks, zero matches). NOT addressed:
             # the flag plane's "reports/templates/audit viewer" nav homes
             # (FlagRampAudit rows have no viewer anywhere); the admin
             # client-side auth gate (pre-existing, named gap). Sweep of
             # `v3/api/app/Http/Controllers` is now fully READ (not fully
             # wired) — three more zero-caller surfaces found and
             # deliberately left, each for a stated reason, not a quick fix:
             # `AdminRevealController`/`AdminUsersController` (§16
             # privacy-reveal tooling, deserves its own careful UI pass),
             # `GlossDraftsController` (gated on Firdaus's ratification, none
             # recorded), and — most consequential — `OverridesController
             # ::store` (`POST /api/overrides`, the ADMIN WRITE path,
             # distinct from the public GET path `lib/overrides/fetch.ts`
             # already calls): there is still no UI anywhere for an admin/
             # qari to actually write a gloss/distractor override; workbench
             # signs verifications only. `v3/worker/fold-runner/src` remains
             # entirely unswept. See DECISIONS.md v3-D125.
             # NOTE (v3-D124): `Admin\ContentFreezeController` (build-plan step
             # 28/M9's freeze gate) had zero frontend callers — its own
             # docblock claimed "the workbench shows them together", false
             # from the day it was written (`grep -rn` for it across
             # apps/web/app/(admin)/workbench and components/workbench
             # returned nothing). Same "docblock says X, reality is Y" shape
             # as v3-D90/D110/D123. Fixed: new `lib/admin/contentFreeze.ts`
             # (mirrors `lib/admin/health.ts#loadHealth`'s three-state
             # discipline) + `components/admin/ContentFreezePanel.tsx`,
             # rendered at a new standalone `/settings/content-freeze` route
             # (mirrors `/settings/health`'s shape — this endpoint spans every
             # launch surah at once, so a per-surah `/workbench` screen is the
             # wrong shape for it). No freeze/book button, matching the
             # controller's own "freezing is a human act." Both stale
             # docblocks (the controller's, and the route comment in
             # `routes/api.php`) corrected in place. RED confirmed directly:
             # both new test files were run against the tree before either
             # source file existed and failed on module-resolution errors;
             # implemented after, 13/13 green. Also surfaced, not fixed: the
             # route's own "requires admin" test asserts 401 while
             # `SystemHealthTest`'s structurally identical test asserts 403 —
             # an `auth:sanctum`/`EnsureIsAdmin` inconsistency between the two
             # controllers, worth a future run's attention. `TZ=UTC make
             # test`: 2110 passing (was 2097, +13 — exactly this run's new
             # tests). `check-test-floor.mjs`: OK, 2110 >= floor 1899 (+211
             # margin). `TZ=UTC make build`: exit 0, 22 routes (was 21 —
             # `/settings/content-freeze` is new). `npm run gates`: all green
             # (fonts degraded-but-non-blocking, pre-existing; boundaries 214
             # files, up from 208, five new files). No `v1/**`/`v2/**` edit
             # (stray `v2/tsconfig.tsbuildinfo` reverted before committing).
             # No Arabic codepoint (full diff swept over every Arabic block +
             # both Presentation Forms blocks, zero matches). NOT addressed:
             # the 401/403 inconsistency above; the admin client-side auth
             # gate remains unbuilt across every admin screen (pre-existing,
             # named gap); the freeze gate's build-artifact half
             # (`scripts/content-freeze.mjs`) still has no UI, run by hand.
             # Next unswept layer for this bug class:
             # `v3/api/app/Http/Controllers` beyond this one controller (not
             # exhaustively checked) and `v3/worker/fold-runner/src` (not
             # swept at all). See DECISIONS.md v3-D124.
             # NOTE (v3-D123): `backup:restore-drill`'s PURGE-AWARE property
             # (build-plan step 30/M10) was fabricated — it called
             # `$doomed->delete()` directly and hand-wrote a JSON file shaped
             # like a ledger row, sharing no code with the REAL PDPA purge
             # path (`PurgeDueAccountsCommand`/`AccountDeletionRequest`/
             # `PurgeLedgerEntry`, build-plan step 23) that shipped hours
             # after this drill was first written and was never wired in.
             # Two OTHER files' docblocks (`PurgeLedgerEntry`,
             # `AccountDeletionTest`) both separately claimed this drill
             # already reconciled against/exercised the real thing — also
             # false, same "docblock says X, reality is Y" shape as v3-D90/
             # D110. Fixed: the purge step now creates a real
             # `AccountDeletionRequest` and calls
             # `$this->call(PurgeDueAccountsCommand::class)` — the exact
             # command that runs nightly — and the JSON file the drill writes
             # is now a CAPTURE of the real `PurgeLedgerEntry` row that
             # command wrote, not an authored fabrication. `find tests
             # -iname "*Backup*"` returned nothing before this run — the
             # command had zero test coverage in either direction; new
             # `tests/Feature/Backup/BackupRestoreDrillTest.php` (3 tests).
             # RED confirmed directly: `git stash` of the source file alone
             # (tests kept) reran against the original fabrication — 2 of 3
             # new tests failed, exactly on `assertArrayHasKey('id', ...)`
             # (a fabricated ledger has no Eloquent primary key) and on the
             # literal string `pdpa:purge-due — purged 1, skipped 0` never
             # appearing in the drill's own console output (the real command
             # was never called). Reverted byte-identically; 3/3 green again.
             # This was found by a fresh sweep for this build's recurring
             # "built + tested, zero real caller" bug class after the ENGINE
             # layer (`packages/engine/src`, every exported function) came
             # back genuinely clean — a real negative finding, same shape as
             # v3-D95's own empty sweep, recorded so a future run does not
             # re-walk that file list; `placement.ts`/FR10 remains the one
             # deliberately-unwired exception (v3-D111).
             # `TZ=UTC make test`: 2097 passing (was 2094, +3 — exactly this
             # run's new tests; no other suite moved). `check-test-floor.mjs`:
             # OK, 2097 >= floor 1899 (+198 margin, TEST-FLOOR unmoved).
             # `TZ=UTC make build`: exit 0, 21 routes (unchanged — no new
             # route). `npm run gates`: locked-css OK, fonts degraded-but-
             # non-blocking (pre-existing), boundaries OK (208 files,
             # unchanged), corpus-morphology and corpus-glyphs OK. No
             # `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff reverted before committing). No Arabic
             # codepoint introduced: every changed/new file swept
             # individually over the Arabic, Arabic Supplement, Arabic
             # Extended-A and both Presentation Forms blocks — zero matches
             # in the diff (three pre-existing matches elsewhere in
             # DECISIONS.md, from earlier entries, are untouched by this
             # change). NOT addressed, named so a future run doesn't
             # re-discover it as new: the drill still runs SQLite-only in
             # this sandbox — the staging-Postgres restore run remains a
             # separate, still-open LAUNCH-CHECKLIST line, unchanged by this
             # fix. See DECISIONS.md v3-D123.
             # NOTE (v3-D119..D122, same night as D118): the REAL GitHub
             # Actions CI had been `failure` on every commit for at least nine
             # commits running (back through dfa2f76/D115) — nothing before
             # this run ever checked the actual CI status of a just-pushed
             # commit, only local `make build`/`make test`. Four INDEPENDENT
             # gaps, found one at a time by reading each real run's job logs
             # after fixing the previous one: (1) `node-version: 20` in
             # `.github/workflows/ci.yml` couldn't run `compile.ts`'s
             # `--experimental-strip-types` (needs Node >=22.6) — bumped to 22;
             # (2) `v3/api`'s `composer.lock` had resolved packages (symfony
             # 8.1.x, nesbot/carbon 3.13.2) needing PHP >=8.4.1, but CI pinned
             # `php-version: "8.3"` — bumped to 8.4 (v2/api's own `^8.3`
             # constraint is unaffected); (3) `v3/api`'s default sqlite test
             # DB (phpunit.xml deliberately does NOT override to `:memory:`,
             # unlike v2/api's) was never migrated in CI — only the SEPARATE
             # throwaway Postgres wiring-test DB was — added `php artisan
             # migrate --force` against the default connection, v3/api only;
             # (4) `worker/fold-runner` (the sole server-side fold,
             # `AtomCacheRebuilder`/the DB-sampling determinism path both
             # shell out to it) was never `npm install`ed in this CI job —
             # added that step. Each fix was verified against the REAL next
             # GitHub Actions run (not locally — this sandbox's own node/php/
             # fold-runner state was never the broken one, which is exactly
             # why none of this was caught by nine straight nights of
             # `make test` reporting green). Final run (commit `c4057bd`):
             # all four jobs `success` — first fully green `main` in this
             # investigation's whole visible history. No test's expectations
             # changed, no gate weakened; every fix made an existing,
             # already-written assertion reachable for the first time. See
             # DECISIONS.md v3-D119 through v3-D122 for the full, individually
             # reproduced root-cause chain.
             # NOTE (v3-D118): `packages/engine/src/freeplay.ts#coldSuccessAdoption`
             # — the LAST of FR6's five exported functions to reach a learner —
             # had zero production callers, exactly the gap v3-D117's own header
             # named: "the offer itself is a genuine separate write path...
             # deserves its own night." A learner who free-drilled an untaught
             # ayah cold and hard through Door 3 had no way to actually adopt it
             # into their memorization — the pass is deliberately free-play
             # (`structured:false`), so nothing about it ever touches the atom,
             # by construction. WIREFRAME.md's own event table already settles
             # that `adoption` itself is evidence-only ("Logged, no strength
             # signal") — `rebuild.ts` correctly has no fold branch for it, the
             # same structural absence `session_start`/`rung_start` already use.
             # So the real encode is an ordinary structured `ayah_produced`
             # (`rung: gradeClassToWire("s3_full")`, never a literal); `adoption`
             # rides alongside it purely as the audit trail, the same division
             # `gate_demote`'s own `sentToReviews` field draws.
             #
             # `lib/session/run.ts` gains `SessionRun.openPracticeDrill` (the
             # learner's CHOSEN Door 3 difficulty, stored verbatim — `run.machine`
             # carries no `full` field once a pass completes, so this is the one
             # place the choice survives to session-end), `adoptionOfferFor(run)`
             # (re-derives the fold, calls `coldSuccessAdoption(atoms, ayah,
             # run.openPracticeDrill, run.slips === 0)` — a Door 3 queue is always
             # exactly one item, so `run.slips` at completion is scoped to
             # precisely that pass, the "cold" signal), and `acceptAdoption(run,
             # ctx)` (re-verifies the offer before committing anything, commits
             # the encode then the audit event as two chained retry-safe
             # commits). No "accepted" flag anywhere: `adoptionOfferFor` is
             # SELF-CLOSING — once the atom is genuinely encoded,
             # `coldSuccessAdoption`'s own `untaught` check reads false on the
             # next call. `SessionIsland.tsx` gains the matching offer effect +
             # "Adopt ayah N" button, mirroring Doors 1/2 exactly.
             #
             # Mutation-verified: `git stash` of the two SOURCE files alone
             # (`run.ts`, `SessionIsland.tsx`; every test kept) failed exactly
             # the 8 new test cases (7 in `run.test.ts`, 1 in
             # `session-island.test.tsx`), 80 other cases in those two files
             # unaffected; restored byte-identically, 88/88 green again. The
             # component-level "offers the CTA" test deliberately does NOT use
             # `completeSession()`'s trial-and-error tile clicking — a coin-flip
             # wrong tap before the right one would be a genuine slip, silently
             # falsifying the "cold pass" the offer requires. Instead it
             # precomputes, PURELY (`advanceReconstruct` is a pure engine
             # function — no DB write, so it never double-commits against the
             # on-screen run), the exact correct DISPLAY index at each blank,
             # then clicks exactly those tiles.
             #
             # `TZ=UTC make test`: 2094 passing (was 2085, +9 — exactly this
             # run's new tests: 7 in `run.test.ts` + 2 in
             # `session-island.test.tsx`; no other suite moved).
             # `check-test-floor.mjs`: OK, 2094 >= floor 1899 (+195 margin,
             # `TEST-FLOOR` left unmoved). `TZ=UTC make build`: exit 0, 21 routes
             # (unchanged — no new route). `npm run gates`: locked-css OK, fonts
             # degraded-but-non-blocking (pre-existing), boundaries OK (208
             # files, unchanged — no new file), corpus-morphology and
             # corpus-glyphs OK. `npx tsc --noEmit`: clean, `Version 5.9.3`
             # confirmed. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff reverted before
             # committing). No Arabic codepoint introduced: every changed file
             # swept individually over the Arabic, Arabic Supplement, Arabic
             # Extended-A and both Presentation Forms blocks, plus a
             # `\u06xx`/`\u08xx`-escape and `fromCharCode` sweep — zero matches;
             # every new line addresses an ayah number, a strength value, a
             # slip count, or a closed-set difficulty ("S2"/"S3"), never corpus
             # text.
             #
             # NOT addressed, named so a future run doesn't re-discover it as
             # new: the diminishing-returns nudge stays wired onto Door 2 only
             # (v3-D111) — Door 3 has no equivalent, though the case for one is
             # weaker (open practice never damages a strong atom regardless of
             # rep count). The SSR override gap (`lib/corpus/load.ts`,
             # v3-D96/D110) and late-arrival refold (v3-D32/D116) are
             # unchanged. With this, all five of `freeplay.ts`'s FR6 exports
             # have a real production caller — the "built and tested, zero
             # callers" sweep that produced v3-D82 through D117 has exhausted
             # this file; a future run should look elsewhere for the next
             # instance. See DECISIONS.md v3-D118.
             # NOTE (v3-D117): FR6 Door 3 ("open practice") — the last of
             # freeplay.ts's three doors — had zero production callers, named
             # out of scope by v3-D98, D106, D111, D112 and D113 alike for the
             # identical reason: "needs an any-ayah picker route that does not
             # exist." That route now exists: new `/practice`
             # (`components/practice/PracticePicker.tsx` +
             # `app/(app)/practice/page.tsx`), a new `lib/practice/handoff.ts`
             # URL contract mirroring `lib/drill/handoff.ts`'s own shape, and
             # `lib/session/run.ts#startOpenPractice` — always free-play
             # (`structured:false`, unconditionally; freeplay.ts's own header:
             # "weak-spot gym is the exception" and Door 3 gets none), so an
             # untaught ayah practiced here can never accidentally encode and a
             # strong one can never be damaged, true by construction via
             # `update.ts:71`'s guard rather than by caller discipline. Unlike
             # every other entry point in `run.ts`, Door 3 forces the LEARNER'S
             # chosen difficulty (S2 partial / S3 full — narrowed from
             # `openPracticePick`'s own `Drill` type, which also admits "S1"
             # and "chain": S1/pretest is a first-ENCOUNTER property, not a
             # repeatable exercise, and "chain" needs `bridge.ts`, atticked at
             # the engine port, DEFECTS.md#E-08) rather than the atom's real
             # strength — a new `startFromQueue` `initialMachine` override,
             # used only by Door 3. `SessionIsland`'s summary screen gains an
             # unconditional "Practice any ayah freely" link (never an
             # engine-computed grant like Doors 1/2 — a learner can always
             # freely practice, so nothing gates it behind a fetch).
             #
             # Mutation-verified: `git stash` of every changed/new SOURCE file
             # (tests kept) failed exactly the 9 new Door-3 test cases across
             # four files, 70 other cases in those same files unaffected;
             # restored byte-identically, 88/88 green again. The load-bearing
             # "S2 forces PARTIAL blanking" test seeds a genuinely CARRY-band
             # atom by spacing real S3 completions across different learning
             # days until the fold itself reports strength >=80 — confirming
             # its own precondition rather than assuming a rep count reaches
             # it (a single S3 append only reaches ~26 strength from a fresh
             # atom, comfortably inside "learn" band, not "carry").
             #
             # `TZ=UTC make test`: 2085 passing (was 2071, +14 net across all
             # suites — 18 new apps/web tests across four files, no other
             # suite moved). `check-test-floor.mjs`: OK, 2085 >= floor 1899
             # (+186 margin, `TEST-FLOOR` left unmoved). `TZ=UTC make build`:
             # exit 0, 21 routes (was 20 — `/practice` is new). `npm run
             # gates`: locked-css OK, fonts degraded-but-non-blocking
             # (pre-existing), boundaries OK (208 files, up from 203 — five
             # new files, no violation), corpus-morphology and corpus-glyphs
             # OK. No `v1/**`/`v2/**` edit (a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff reverted before committing). No Arabic
             # codepoint introduced: every changed/new file swept individually
             # over the Arabic, Arabic Supplement, Arabic Extended-A and both
             # Presentation Forms blocks — zero matches; every new line
             # addresses an ayah number, a strength value, or a closed-set
             # difficulty ("S2"/"S3"), never corpus text.
             #
             # NOT addressed, named so a future run doesn't re-discover it as
             # new: `coldSuccessAdoption` remains unwired — Door 3 now gives it
             # a real surface to attach to (an untaught ayah's hard-drill pass)
             # but the offer itself is a genuine separate, tap-gated write path
             # and deserves its own night. The SSR override gap
             # (`lib/corpus/load.ts`, v3-D96/D110) and late-arrival refold
             # (v3-D32/D116) are unchanged. With this, FR6's "three doors
             # after session complete" is fully wired — only the adoption
             # offer and surfacing the diminishing-returns nudge beyond Door 2
             # remain as intentionally scoped-out refinements, not gaps. See
             # DECISIONS.md v3-D117.
             # NOTE (v3-D116): v3-D32/v3-D70's deferred per-user Postgres advisory
             # lock, closed. Both `AtomCacheRebuilder::rebuild()` (writes
             # `atom_cache`, admin-triggered) and `DeterminismCheckCommand`'s
             # DB-sampling path (reads `atom_cache`, nightly-triggered) are two
             # entirely separate lock keys with no relationship to each other —
             # `DeterminismCheckCommand`'s own header already named the gap: its
             # `Cache::lock` is RUN-level (two nightlies cannot overlap) but does
             # nothing to stop a nightly reading a learner's cache mid-rebuild via
             # the completely separate `REBUILD_LOCK` path. v3-D32 deferred a
             # per-user fix for exactly this because "sqlite, this repo's dev DB,
             # has no `pg_advisory_lock` to test against" — no longer true: this
             # sandbox has a real Postgres 16 server (confirmed installed but
             # stopped; started it), and this build's actual deployment target
             # (DECISIONS.md: Forge + managed Postgres) is Postgres in production
             # regardless. New `App\Support\PerUserFoldLock::withLocks(userIds,
             # fn)` acquires a SESSION-level `pg_advisory_lock` (not
             # transaction-scoped — the critical sections it guards span an
             # external Node subprocess call, and holding a DB transaction open
             # for that long is its own hazard) per user id, in a fixed sorted
             # order (deadlock avoidance across callers wanting overlapping id
             # sets), always released in a `finally`. No-ops on any non-Postgres
             # connection (sqlite, this repo's dev/test default) — single-process,
             # nothing to interleave with; stated in the class's own header, not
             # hidden. Wired into `AtomCacheRebuilder::rebuild()` (locks every
             # candidate user for the full span: event read, the fold-runner
             # call, and the delete+insert) and `DeterminismCheckCommand
             # ::sampleFromDatabase()` (locks exactly the one learner being read,
             # for exactly as long as the read takes, via a new
             # `sampleOneUserLocked()` extracted from the loop body).
             #
             # VERIFIED AGAINST REAL POSTGRES, NOT A MOCK. v3-D32's own
             # deferral reasoning ruled out exactly the shortcut of testing this
             # against sqlite or a fake lock — that would prove nothing about
             # whether Postgres actually serializes two callers on it, the same
             # vacuous-verification shape this build has shipped nine times
             # (HANDOVER.md's own count). `PerUserFoldLockTest` (5 tests) opens a
             # real Postgres connection and: proves `isSupported()` reflects the
             # driver; proves the sqlite no-op path never issues a Postgres-only
             # statement; proves a lock is released after success AND after the
             # callback throws (via a SEPARATE raw PDO session's non-blocking
             # `pg_try_advisory_lock`); and — the load-bearing case — forks a
             # genuinely separate OS process (`pcntl_fork`) that holds the
             # advisory lock for one user id for 450ms while the parent proves a
             # DIFFERENT id returns in <200ms (no cross-user contention) and the
             # SAME id blocks for >250ms (genuine waiting, not a coincidental
             # pass). `PerUserFoldLockWiringTest` (2 tests) proves the two real
             # CALLERS route through it, against a second throwaway migrated
             # Postgres database (`imanapp_lock_test`): a fork holds the lock for
             # 1800ms and each caller's elapsed time is asserted against its OWN
             # freshly-measured unlocked baseline (~390-410ms of pure Node
             # subprocess-startup overhead on this machine) plus a 1200ms margin
             # — a fixed threshold like "250ms" would have passed on the UNWIRED
             # tree too, on subprocess overhead alone, which is exactly what the
             # first draft of this test did before being caught and rewritten.
             #
             # RED confirmed at every layer, each by reverting only the source
             # (tests kept): the mutation stub (`isSupported()` hardcoded false,
             # `withLocks` a bare passthrough) failed exactly the two load-bearing
             # `PerUserFoldLockTest` assertions (`assertTrue(isSupported())` and
             # the same-id timing floor); reverting ONLY the two call sites (each
             # caller invoking its locked-body method directly, skipping
             # `PerUserFoldLock::withLocks`) failed exactly
             # `PerUserFoldLockWiringTest`'s two margin assertions, with the
             # actual measured numbers in the failure message (e.g. "baseline
             # 379ms, locked run 366ms, expected at least 1579ms") — proving the
             # unwired tree races straight past the other session's held lock.
             # Both reverted byte-identically and reran green.
             #
             # Also added: a `postgres:16` service to `.github/workflows/ci.yml`'s
             # `php` job (both matrix legs declare it; only `v3/api` uses it) plus
             # a migrated `imanapp_lock_test` database for the wiring suite — a
             # test that only ever runs on a machine that happens to have
             # Postgres would make "skips cleanly when unreachable" into CI's
             # silent, permanent, unnoticed default, the same shape as every
             # other vacuous-verification finding this build has caught. Env var
             # defaults (`PGSQL_LOCK_TEST_*`) match the official `postgres` image's
             # own defaults, so the two test files and the CI service agree
             # without any file needing to know about the other.
             #
             # `TZ=UTC make test`: 2071 passing (was 2064, +7 — exactly this run's
             # new tests: 5 in `PerUserFoldLockTest` + 2 in
             # `PerUserFoldLockWiringTest`; no other suite moved).
             # `check-test-floor.mjs`: OK, 2071 >= floor 1899 (+172 margin,
             # `TEST-FLOOR` left unmoved). `TZ=UTC make build`: exit 0, 20 routes
             # (unchanged). `npm run gates`: locked-css OK, fonts
             # degraded-but-non-blocking (pre-existing), boundaries OK (203
             # files), corpus-morphology OK, corpus-glyphs OK. `npx tsc --noEmit`:
             # clean, `Version 5.9.3` confirmed. No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff was reverted before
             # committing, same discipline as every prior entry — `git status
             # --porcelain -- v1 v2` empty immediately before commit). No Arabic
             # codepoint introduced: every changed/new file swept over the Arabic,
             # Arabic Supplement, and both Presentation Forms blocks — zero
             # matches; every new line addresses a user id, a millisecond count,
             # or a config key, never corpus text.
             #
             # NOT addressed, named so a future run doesn't re-discover it as
             # new: late-arrival refold (v3-D32's other deferred half) remains
             # open — this build has no automatic refold-on-ingest at all today
             # (atom_cache is populated only by the admin's manual rebuild), so
             # "late-arrival" presupposes a normal-arrival refold pipeline that
             # does not exist yet; building one is real, separate, larger scope,
             # not a lock-shaped fix. `AtomCacheRebuilder::rebuild()` also now
             # holds ALL candidate users' locks for the full rebuild span (event
             # read + subprocess call + write) rather than one user at a time —
             # correct for the race it closes, but means a whole-database rebuild
             # will make every OTHER user's nightly read wait for the whole
             # rebuild to finish, not just their own turn; acceptable for a rare,
             # admin-triggered, whole-cache action, but worth knowing if rebuild
             # frequency ever changes. See DECISIONS.md v3-D116.
             # NOTE (v3-D115): edge case #130's OTHER half — `AtomCacheRebuilder`
             # (the admin "rebuild atom cache" action) shares the EXACT same
             # json_encode batching wedge v3-D114 fixed for the nightly check, but
             # is sharper: because this rebuilder REPLACES (delete-then-reinsert,
             # WIREFRAME §16), a naive fix that dead-lettered a poisoned learner's
             # ENCODING but still deleted their existing atom_cache rows before
             # excluding them from re-insert would silently WIPE their cache with
             # nothing to replace it — strictly worse than today's whole-rebuild
             # failure, exactly the trap v3-D114 named and deferred. Fixed by
             # reconciling both halves together: each candidate user's entry is
             # now json_encode()-tested in isolation before joining the batch; a
             # user that fails is dead-lettered and excluded, and the subsequent
             # `DELETE ... WHERE user_id IN (...)` is scoped to exactly the user
             # IDs actually sent to the runner — never the original candidate
             # list — so a dead-lettered learner's existing row is never touched.
             # `SystemHealthController`/`lib/admin/health.ts`/`SystemHealthPanel.tsx`
             # thread the dead-letter count through so an admin who clicks
             # "rebuild" is told a learner was skipped, never a bare "complete."
             # RED confirmed three times, one per layer (`git stash` of the
             # backend pair, then `health.ts` alone, then `SystemHealthPanel.tsx`
             # alone, tests kept each time): the backend case reproduced the
             # exact live wedge (`Expected... 200 but received 500`); both
             # frontend cases failed on exactly the new assertions, siblings
             # unaffected; each reverted byte-identically and re-ran green. The
             # load-bearing backend assertion `assertEquals`s the poisoned
             # learner's PRE-rebuild row (seeded via a real prior `rebuild()`
             # call through the actual fold-runner, then corrupted afterward)
             # against its POST-rebuild row, byte for byte — proving "never
             # wiped," not merely "still present." `TZ=UTC make test`: 2064
             # passing (was 2059, +5 — exactly this run's new tests: 1 PHPUnit +
             # 2 + 2 vitest; no other suite moved). `check-test-floor.mjs`: OK,
             # 2064 >= floor 1899 (+165 margin, TEST-FLOOR unmoved). `TZ=UTC make
             # build`: exit 0, 20 routes (unchanged). `npm run gates`: all green
             # (fonts degraded-but-non-blocking, pre-existing; boundaries 204
             # files). `npx tsc --noEmit` clean. No v1/v2 edit (stray
             # v2/tsconfig.tsbuildinfo build-cache diff reverted before
             # committing). No Arabic codepoint (full diff swept over every
             # Arabic block + presentation forms + \u06xx/fromCharCode, zero
             # matches). With this, both known fold-runner stdin callers
             # (`grep -rn "FoldRunnerProcess::run" app/` — exactly two) are
             # dead-letter-safe. Per-user Postgres advisory locks (v3-D32) and
             # late-arrival refold remain open, unchanged by this run. See
             # DECISIONS.md v3-D115.
             # NOTE (v3-D114): DEFECTS.md/edge case #130 — `sampleFromDatabase()`
             # batched every sampled learner into ONE envelope and `json_encode()`d
             # it whole; that call fails ATOMICALLY on the first invalid-UTF8 byte
             # (or NaN/Infinity float — Postgres can store either in `strength`)
             # anywhere in it, so ONE learner's corrupted `device_id` silently
             # blanked the stdin payload and reported "no input on stdin" as an
             # ERROR night for every OTHER, perfectly clean, learner sampled
             # alongside them — indefinitely, with no hint which learner or field
             # was actually broken. `rebuild()`/`applyEvent()` are fully total (no
             # malformed-but-typed event makes them throw, verified by reading
             # every branch), so this — not an engine exception — is the real
             # "poison event wedges fold" shape in this codebase. Fixed:
             # `sampleFromDatabase()` now `json_encode()`-tests each learner's own
             # slice in isolation before merging it into the shared envelope; a
             # learner that fails is dead-lettered (`{userId, error}`) and excluded
             # — "log intact," the row is never touched, only skipped for tonight's
             # run. `runFold()` merges PHP-side dead letters into the report and
             # upgrades an otherwise-green exit to WARN (report.severity kept in
             # step with the exit code that decides it) — never silently green over
             # a quarantined learner, never a P1 from a dead letter alone.
             # `record()` now writes `health:dead_letter_depth`, giving
             # `SystemHealthController::METRICS`'s long-registered-but-unimplemented
             # `dead_letter_depth` (in `METRICS` since M8, zero producer until now)
             # a real backend; `index()` returns it as a third check, and
             # `SystemHealthPanel.tsx`'s stale header comment ("no dead-letter
             # mechanism anywhere in this codebase") is corrected — the render
             # table is already generic over `checks.length`, so no frontend code
             # change was needed. RED confirmed directly: `git stash` of the two
             # source files (test kept) reran the new test against the unmodified
             # command — `Expected status code 0 but received 1`, the wedge
             # reproduced live; `git stash pop` restored the fix byte-identically.
             # The test needed one iteration to be trustworthy: an early draft gave
             # the "clean" learner no matching `atom_cache` row, which
             # `foldCheck.ts`'s own contract correctly reads as a genuine P1
             # divergence — a different bug that would have made the RED proof
             # ambiguous. Fixed by seeding both learners' caches via the real
             # `AtomCacheRebuilder` from their still-clean events, THEN corrupting
             # the poisoned learner's row afterward. `TZ=UTC make test`: 2059
             # passing (was 2058, +1 — exactly this run's one new PHPUnit test; no
             # other suite moved). `check-test-floor.mjs`: OK, 2059 >= floor 1899
             # (+160 margin, TEST-FLOOR unmoved). `TZ=UTC make build`: exit 0, 20
             # routes (unchanged). `npm run gates`: all green (fonts
             # degraded-but-non-blocking, pre-existing; boundaries 204 files).
             # `npx tsc --noEmit` clean. No v1/v2 edit (a stray
             # v2/tsconfig.tsbuildinfo build-cache diff was reverted before
             # committing). No Arabic codepoint (full diff swept over every Arabic
             # block + presentation forms + \u06xx/fromCharCode, zero matches).
             # NOT addressed, named so a future run doesn't re-discover it as new:
             # `App\Support\AtomCacheRebuilder` shares the EXACT same json_encode
             # wedge (it also batches every learner into one envelope) — but unlike
             # the nightly check, it DELETEs a rebuilt user's whole atom_cache row
             # set before reinserting only what the runner returns, so excluding a
             # poisoned learner from its batch while still deleting their existing
             # rows would silently WIPE their cache with nothing to replace it, a
             # strictly worse outcome than today's whole-rebuild failure. Fixing it
             # needs the delete and the dead-letter set reconciled together — a
             # real, separate, small task, not a copy of tonight's fix. Per-user
             # Postgres advisory locks (v3-D32, deferred as untestable against
             # sqlite-only) and late-arrival refold remain open too — this sandbox
             # now has a real Postgres 16 server installed, so that premise no
             # longer holds, but building and proving it is separate, larger scope.
             # See DECISIONS.md v3-D114.
             # NOTE (v3-D113): `packages/engine/src/activity.ts#lastActiveDayMs`
             # (the v2-BUG-2 fix — derives the learner's last-active day from the
             # append-only log so the make-up merge fires; its own header: derived
             # there "so the session caller has no excuse to hardcode it again")
             # had ZERO production callers. `lib/session/run.ts#assembleFor` — the
             # ONE queue-assembly seam every start path AND the /home due-count
             # route funnel through — hardcoded it anyway, an inline
             # `prior.reduce((max,e)=>(e.ts>max?e.ts:max),0)`. The "re-derive
             # instead of import" shape v3-D107/D108 twice named and deferred, and
             # the same shape as v3-D83's gradeClassToWire finding. Not a live
             # bug (the two agree for every positive-ts log) but the inline copy
             # also floored at 0 vs the engine's -Infinity — the exact latent
             # divergence one source of truth forecloses. Fixed: `assembleFor`
             # now calls `lastActiveDayMs(prior)`; one line, one import, one place.
             # RED-first mirrors the gradeClassToWire wiring proof (v3-D83): new
             # `lib/session/assemble-lastactive.test.ts` mocks `@engine/scheduler`
             # to capture the `lastActiveDay` assembleQueue receives + spies
             # `@engine/activity`; against unmodified run.ts the captured value was
             # the inline max-ts (T0), not the spy's sentinel — RED
             # (`expected 1786438800000 to be 1786352400000`); wired → GREEN, and
             # a companion proves the real un-overridden derivation still carries
             # the true max-ts through. `TZ=UTC make test`: 2058 passing (was
             # 2056, +2 — exactly this run's two new tests; no other suite moved).
             # `check-test-floor.mjs`: OK, 2058 >= floor 1899 (+159 margin,
             # TEST-FLOOR unmoved). `TZ=UTC make build`: exit 0, 20 routes
             # (unchanged). `npm run gates`: all green (fonts degraded-but-non-
             # blocking, pre-existing; boundaries 203 files). `npx tsc --noEmit`
             # clean. No v1/v2 edit (stray v2/tsconfig.tsbuildinfo reverted). No
             # Arabic codepoint (both files swept over every Arabic block +
             # \u06xx/fromCharCode, zero matches). With this the "built, tested,
             # zero-caller mechanism with an existing home" seam is exhausted;
             # what remains (FR6 Door 3/coldSuccessAdoption, the SSR override gap,
             # placement/FR10, the unrendered greeting) is design/architecture/
             # human-gated, not one-night wiring. See DECISIONS.md v3-D113.
             # NOTE (v3-D112): build-plan step 20 (`/drill`, continuous drill)
             # dead-ended — `components/drill/DrillPicker.tsx` rendered a live
             # preview of what a chosen range/page would drill but had NO Start
             # button and no handoff into the session loop, so the whole
             # continuous-drill surface was a step marked DONE on a component no
             # route could run. Coupled second half: the picker's own "Victory
             # lap — nothing can be damaged" radio had nothing behind it, because
             # every emit site in `lib/session/run.ts` hardcoded
             # `structured: true`, so the `structured:false` free-play path the
             # victory lap needs (invariant #5 / `update.ts:71`'s structured
             # guard) had zero production reach — shipping Start without the flag
             # would have made that radio a dark pattern. Fixed both, end to end:
             # `run.ts` gained `startDrillSession` (folds the log, filters the
             # chosen ayat to the ENCODED ones off the fold — a not-yet-learned
             # ayah is a guess, `lib/drill/preview.ts`'s BUG-3 gap guard — orders
             # them ascending, runs them as ordinary `review` items through the
             # EXACT same answerCurrent/answerAfterTap/settleAnswer path, no
             # second grading rule so B2's "gradeClassToWire is the ONE function"
             # holds); `SessionRun` gained a `structured` field the shared
             # `startFromQueue` carries onto the `reconstruct_tap` and
             # `ayah_produced` emits (`run.structured`, not a literal); a new
             # `none-ready` unavailable reason. `startExtraLearn`/
             # `startWeakSpotDrill` now set `structured:true` EXPLICITLY (a
             # victory-lap drill reaches the summary too, and its false must not
             # leak into a granted Learn or the full-weight weak-spot gym).
             # `lib/drill/sites.ts` gained `ayatForSelection` (range/page → ayah
             # numbers; seams dropped, E-08 — no reconstruct surface in v3);
             # `lib/drill/handoff.ts` (new) is the `/drill`→`/session` URL
             # contract both directions (`victory` the only opt-in to the lap; a
             # mistyped grade stays graded; a hand-edited out-of-range URL
             # degrades to `none-ready`, never a 500, #78). `DrillPicker` gained
             # a Start LINK shown only when a READY ayah exists (`ayahCount`, not
             # `stepCount` — a page whose only ready step is a seam never offers
             # a drill that would dead-end); `SessionPage`→`SessionGate`→
             # `SessionIsland` thread the parsed `DrillSpec`, the drill runs
             # within the ENROLLED surah. RED confirmed by `git stash` of `run.ts`
             # only (5 new `run.test.ts` cases kept): all failed on exactly
             # `startDrillSession is not a function`; pop → 5/5 green. The
             # load-bearing case runs a victory-lap drill to completion and
             # asserts every fresh `ayah_produced` AND `reconstruct_tap` is
             # `structured:false` and the atom's strength is byte-identical to
             # before — "nothing can be damaged" against the real fold; a
             # companion proves a WRONG tap in a victory lap still damages
             # nothing. `TZ=UTC make test`: 2056 passing (was 2037, +19 — exactly
             # this run's new tests: 5 run.test.ts + 3 session-island + 3
             # drill-picker + 8 drill-handoff; no other suite moved).
             # `check-test-floor.mjs`: OK, 2056 >= floor 1899 (+157 margin,
             # TEST-FLOOR unmoved). `TZ=UTC make build`: exit 0, 20 routes
             # (unchanged — `/drill` and `/session` both already existed).
             # `npm run gates`: all green (fonts degraded-but-non-blocking,
             # pre-existing; boundaries 202 files). `npx tsc --noEmit` clean. No
             # v1/v2 edit, no Arabic codepoint (every added line addresses an
             # ayah/range/page by number or a mode by closed-set value). SEAM
             # drilling remains out of reach (E-08, same as floor/weak-spot);
             # Door 3 (`openPracticePick`)/`coldSuccessAdoption` remain unwired
             # (need the any-ayah picker route that does not exist). See
             # DECISIONS.md v3-D112.
             # NOTE (v3-D111): FR6's diminishing-returns nudge
             # (`packages/engine/src/freeplay.ts#diminishingReturns`) — an
             # honest line for a learner who keeps massing the SAME atom in one
             # day — was real and unit-tested since freeplay landed but had ZERO
             # production callers. v3-D106's own header named it out of scope
             # alongside Door 3 and the cold-success-adoption offer ("each needs
             # its own UI surface"). Of the three FR6 remainders it is the only
             # one with an EXISTING home: FR6 Door 2, the weak-spot gym
             # (`weakSpotOfferFor`, wired v3-D106), which re-offers whichever
             # encoded atom is riskiest — so a learner tapping "Practice your
             # weakest spot" repeatedly drills the same ayah, and past the
             # threshold invariant #4's ×0.35 massed-same-day damping makes the
             # next rep worth ~a third of a spaced one. `lib/session/run.ts`
             # gained `diminishingReturnsNudge(run, ayah, now)` (counts the
             # fold's own same-learning-day structured `ayah_produced`
             # completions of the ayah — the reps the damping penalizes;
             # `structured:false` free-play echoes excluded, invariant #5;
             # same-day scoped under DEFAULT_DAY_CONFIG, matching
             # `weakSpotOfferFor`'s own `rebuild(prior)`), and
             # `SessionIsland.tsx` renders the engine's string as a
             # `role="status"` caption BENEATH the Door 2 button — never instead
             # of it; the learner keeps the choice, the component decides neither
             # count, threshold nor words (invariant #6, check-boundaries clause
             # 5 still green at 200 files: the engine call lives in `lib/`).
             # RED confirmed by `git stash` of the two source files only (tests
             # kept): all 5 new `run.test.ts` cases failed on exactly
             # `diminishingReturnsNudge is not a function`, and the positive
             # component case failed on the missing `diminishing-returns-nudge`
             # testid; `git stash pop` restored both byte-identically, 60/60
             # green across the two files. `TZ=UTC make test`: 2037 passing (was
             # 2030, +7 — exactly this run's new tests: 5 + 2; no other suite
             # moved). `check-test-floor.mjs`: OK, 2037 >= floor 1899 (+138
             # margin, TEST-FLOOR unmoved). `TZ=UTC make build`: exit 0, 20
             # routes (unchanged). `npm run gates`: all green (fonts
             # degraded-but-non-blocking, pre-existing). `npx tsc --noEmit`
             # clean. No v1/v2 edit, no Arabic codepoint (every added line
             # addresses an ayah/rep-count by number). Door 3 (open practice)
             # and `coldSuccessAdoption` remain unwired (each needs the any-ayah
             # picker route that does not exist); the placement binary-search
             # onboarding (FR10, `placement.ts`) remains a deliberate design
             # choice, not a wiring gap. See DECISIONS.md v3-D111.
             # NOTE (v3-D110): DEFECTS.md#B13 — the `disable` override field
             # reached NO learner, for two reasons that hid each other.
             # `applyOverrides()` returns `{corpus, disabled, groups}` but
             # `lib/corpus/client.ts#fetchCorpus` took only `.corpus`, so
             # `overrides.ts#isQuestionDisabled()` had ZERO production callers;
             # and v3's port of `v2/src/pages/Test.tsx#buildItems` into
             # `lib/test/build.ts#buildTestItems` dropped that function's
             # `disabled` parameter, its post-generation filter AND its
             # `itemDisableKey` helper — all three. An admin/qari disabling a
             # broken question through the already-shipped, already-admin-gated
             # `POST /api/overrides` changed nothing a learner ever saw.
             # Fixed both halves: new `fetchEffectiveCorpus()` +
             # `EffectiveCorpus {corpus, disabled}` (with `fetchCorpus`
             # delegating to it, object-identity asserted so every existing
             # caller is unchanged by construction); `itemDisableKey` ported
             # verbatim and exported; `buildTestItems` takes `disabled` as a
             # REQUIRED parameter — a default `[]` would re-create the defect
             # by omission, which is exactly how it was lost. Scope matches the
             # port source deliberately: v2's own `Drill.tsx` does not consult
             # `isQuestionDisabled` either, because the session loop's graded
             # surface is a reconstruct pass over ONE ayah's own words, not a
             # question-bank draw, so there is no per-question selection for a
             # `disable` row to act on (named in `fetchCorpus`'s docblock so a
             # future run doesn't misread the narrower call site as an
             # oversight). RED confirmed TWICE by `git stash` of the three
             # source files only, every new test kept: 23 of 30 unit tests
             # failed on exactly `fetchEffectiveCorpus is not a function` and
             # the missing filter/helper; separately, the component test failed
             # on exactly its `testKind === "vocab"` assertion with the
             # cache-reset already in place, proving the RED is the WIRING, not
             # test isolation. That component test disables "vocab" ayah-wide
             # across all four ayat of 112 and cannot pass vacuously (vocab is
             # KIND_ORDER slot 0, so an unfiltered Test always contains one).
             # `TZ=UTC make test`: 2030 passing (was 2016, +14 — exactly this
             # run's new tests: 9 + 4 + 1; no other suite moved).
             # `check-test-floor.mjs`: OK, 2030 >= floor 1899 (+131 margin,
             # TEST-FLOOR left unmoved). `TZ=UTC make build`: exit 0, 20 routes
             # (unchanged). `npm run gates`: all green (fonts degraded-but-
             # non-blocking, pre-existing). `npx tsc --noEmit` clean. No
             # v1/v2 edit, no Arabic codepoint (all 429 added lines swept
             # directly across Arabic/Supplement/Extended-A/both Presentation
             # Forms blocks). ALSO FIXED: `test/test-island.test.tsx` never
             # reset `lib/corpus/client.ts`'s module cache — harmless while
             # that cache held only parsed bytes, NOT harmless once it holds a
             # resolved override DECISION, since one test's override-free
             # corpus then leaks into the next test's override-carrying one.
             # NOT addressed, named so a future run doesn't re-discover it:
             # the SSR override gap (`lib/corpus/load.ts`, v3-D96's own
             # deferral) is unchanged. With this entry every field of the
             # override layer reaches a learner. See DECISIONS.md v3-D110.
             # `make test` enforces v3-D95's test-count floor (`v3/TEST-FLOOR`,
             # currently 1899, so the margin above is intentionally not yet
             # banked into the floor) — a suite that silently shrinks (deleted
             # test file, stray `.skip`) now fails the build even though every
             # test that DID run still passed.
             # NOTE (v3-D109): `packages/engine/src/gate.ts#RESCAFFOLD_AFTER_FAILS`/
             # `gateForgiveness()`'s "rescaffold" rung (v2-D08's gate-forgiveness
             # ladder) was real and engine-tested since the port but had never
             # been wired into the real session loop — DEFECTS.md#B12's own
             # "explicitly not addressed" note named it exactly: "wiring it here
             # would mean a queue item that transitions between two
             # `ReconstructState` machines mid-item... a real (small)
             # state-machine extension this run chose not to make." Built that
             # extension. `lib/session/run.ts` gained `machineForItem()` (builds
             # the reconstruct machine for a queue item AND decides the
             # rescaffold phase together, consulting `gateForgiveness()` off the
             # SAME atom the queue item's own fold produced) and
             # `settleRescaffoldWarmup()` (the in-place transition, same cursor,
             # same ayah, from the warm-up's completed `ayah_produced` to the
             # real cold check's fresh `full:true` machine) — mirroring v2's
             # `pages/Gate.tsx` exactly: `stage: "rescaffold"` commits an
             # ordinary graded S2 `ayah_produced` then re-arms the SAME ayah as
             # `stage: "cold"`, never a `gate_result` for the warm-up itself. A
             # new `SessionRun.rescaffolding` field (mirroring `gateSlipped`'s
             # own "true only for the CURRENT queue item, reset on every
             # advance" discipline) tracks the phase; a wrong tap during the
             # warm-up is deliberately NEVER remembered as a gate slip — only
             # `!run.rescaffolding` gates count toward `gate_result.correct`,
             # matching `Gate.tsx`'s own `stage === "cold" && !correct` rule for
             # when `slipped` may be set. `SessionIsland.tsx` gained a small
             # read-only hint ("A lighter warm-up first — then the real cold
             # check.") when `run.rescaffolding` is true — presentation of a
             # decision `run.ts` already made, never a decision made in the
             # component (check-boundaries.mjs clause 5 still holds).
             #
             # RED confirmed directly: reran the 4 new `run.test.ts` cases
             # against a `git stash` of `run.ts` + `SessionIsland.tsx` alone
             # (keeping the new tests) — all 4 failed on exactly
             # `started.run.rescaffolding` being `undefined` instead of the
             # expected boolean; `git stash pop` restored the fix byte-
             # identically, `git diff` empty, 4/4 green again, no regression on
             # the other 34 cases in the file. The four cases prove: (1) a gate
             # at the rescaffold rung opens in the warm-up phase and, once both
             # the warm-up and the real cold check are completed cleanly,
             # commits exactly ONE S2 `ayah_produced` (the warm-up) then exactly
             # ONE passing `gate_result` (the cold check) — never a second
             # gate_result, never an S3 warm-up; (2) a slip DURING the warm-up
             # is recorded as an ordinary wrong tap but never sets
             # `gateSlipped`, and the eventual cold-check pass still reads
             # `correct:true`; (3) a slip during the REAL cold check (after a
             # clean warm-up) still fails the gate and increments `gateFails`
             # past the two seeded fails; (4) an ordinary gate below the
             # rescaffold threshold still opens straight into the cold check,
             # unchanged from v3-D107's own behavior — no regression on the
             # non-rescaffold path.
             #
             # `TZ=UTC make test` (full monorepo, all seven suites, from a
             # fully completed `make setup`): **2016 passing** (was 2012, +4 —
             # exactly this run's 4 new `run.test.ts` cases; no other suite's
             # count moved). `check-test-floor.mjs`: OK, 2016 >= floor 1899
             # (+117 margin, `TEST-FLOOR` left unmoved, same discipline as
             # every prior entry). `TZ=UTC make build`: exit 0, 20 routes
             # (unchanged — no route added or removed). `npm run gates`:
             # locked-css OK, fonts degraded-but-non-blocking (pre-existing,
             # unrelated), boundaries OK (200 files checked), corpus-morphology
             # and corpus-glyphs OK. `npx tsc --noEmit`: clean (`Version
             # 5.9.3` confirmed).
             #
             # No `v1/**`/`v2/**` edit: `git status --porcelain -- v1 v2`
             # empty before committing. No Arabic codepoint introduced:
             # checked directly against the diff with a Unicode-range sweep
             # (Arabic block, Arabic Supplement, Arabic Presentation Forms
             # A/B — zero matches) in addition to `npm run gates`' own grep,
             # which passed — every new line addresses an ayah/rung/fail-count
             # by number or closed-set value, never corpus text.
             #
             # NOT addressed, named so a future run doesn't re-discover it as
             # new: `activity.ts#lastActiveDayMs()`'s inline re-derivation
             # (named by v3-D107, still untouched — out of this step's scope);
             # `floorQueue`'s cross-surah forgetting-risk read (named by
             # v3-D108, unchanged); Door 3 (open practice)/
             # `coldSuccessAdoption`/`diminishingReturns`/the SSR override
             # gap/`isQuestionDisabled()` all remain exactly as open as
             # v3-D106/D107/D108 left them — this run's scope was the
             # rescaffold rung alone.
             # NOTE (v3-D108): `packages/engine/src/floor.ts#floorQueue`/
             # `floorMinutes` (FR9, "the 2-minute floor session" — a due cold
             # gate, else the riskiest due review, else a guaranteed-win
             # warm-up, capped at ~2 minutes, never empty once anything is due
             # or encoded) were real and engine-tested (`habit.test.ts`,
             # `e01.test.ts`) since they landed but had ZERO production
             # callers — v3-D107's own sweep found this and deliberately
             # deferred it, named exactly as "needs its own `/home` CTA and a
             # reduced-queue entry point into the session loop." Built both.
             # `lib/session/run.ts` gained `startFloorSession` (mirroring
             # `startSession`'s exact `session_start`/resume discipline via a
             # new shared `startFromQueue` helper both now call) and a
             # `SessionMode` ("full" | "floor"). `FloorItem.kind: "warmup"` has
             # no `QueueItemKind` of its own, so it is graded as an ordinary
             # `"review"` — full-weight, `structured:true`, through the exact
             # same `answerCurrent`/`settleAnswer` path every other queue item
             # uses, never a second grading rule (same discipline v3-D106's
             # `startWeakSpotDrill` already follows). Atoms are filtered to
             # `kind === "ayah"` before reaching `floorQueue`, mirroring
             # `weakSpotOfferFor`'s own E-08 reasoning — a "connection" atom
             # has no reconstruct surface in v3. `/session` now takes a
             # `?mode=floor` search param (`SessionGate`/`SessionIsland` both
             # thread a `mode` prop down to it, defaulting to `"full"`), and
             # `lib/home/queue.ts#buildHomeSurah` gained `floorOffer` —
             # computed from the SAME fold `assembleFor` already produced, no
             # second log read — surfaced on `/home` as a quiet "Short on
             # time? Do a quick N-minute check-in instead" link, shown
             # INDEPENDENTLY of `ctaEnabled`/`dueCount`: a learner with ten
             # items due but two minutes to spare should see it too, not only
             # a learner with nothing due — `floor.ts`'s own "worst days"
             # framing is about short-on-time days, not only empty-queue days.
             # RED confirmed three ways: `git stash` of `run.ts` alone failed
             # exactly the 4 new `run.test.ts` cases (`startFloorSession is
             # not a function`), 30/34 others unaffected; `git stash` of
             # `lib/home/queue.ts` + `TodaySession.tsx` failed exactly the 2
             # new floor-offer assertions in `home-today.test.tsx`, 11/13
             # others unaffected. `TZ=UTC make test`: 2012 passing (was 2003,
             # +9 — exactly this run's new tests: 4 in `run.test.ts`, 3 in
             # `home-today.test.tsx`, 2 in `session-island.test.tsx`).
             # `check-test-floor.mjs`: OK, 2012 >= floor 1899 (+113 margin).
             # `TZ=UTC make build`: exit 0, 20 routes (unchanged — `/session`
             # moved from static to dynamic rendering since it now reads a
             # search param, but no route was added or removed). `npm run
             # gates`: all green (locked-css, fonts degraded-but-non-blocking,
             # boundaries 201 files — this run added no new file — corpus-
             # morphology, corpus-glyphs). No `v1/**`/`v2/**` edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff was reverted before
             # committing, same discipline as every prior entry). No Arabic
             # codepoint introduced (checked directly against the diff with a
             # Unicode-range sweep, and via `npm run gates`' own grep, which
             # passed): every new line addresses an ayah/minute/count by
             # number, never corpus text. NOT addressed, named so a future run
             # doesn't re-discover it as new: the "rescaffold" ladder rung and
             # `activity.ts#lastActiveDayMs()`'s inline re-derivation (both
             # named by v3-D107, untouched by this run — out of this step's
             # scope); FR9's `floorQueue`'s own review/warm-up branches read
             # forgetting-risk off ANY encoded ayah atom regardless of which
             # surah the learner is enrolled in TODAY — moot at single-surah
             # launch scope (`assembleFor`/`getEventsForSurah` already scope
             # the fold to one surah before this module ever sees it), but
             # worth re-checking once multi-surah enrollment (HANDOVER.md's
             # own still-open gap) exists. See DEFECTS.md and DECISIONS.md
             # v3-D108.
             # NOTE (v3-D107): DEFECTS.md#B12 — the day-1 cold gate (FR3,
             # gate.ts) could never actually FAIL through the real session
             # loop, which is the root cause of a second, deeper problem:
             # `gate.ts#gateForgiveness()`/`demoteToLearn()` (v2-D08's
             # forgiveness ladder) were real, unit-tested and fold-safe but
             # structurally UNREACHABLE, not merely unwired.
             # `advanceReconstruct` never advances on a wrong tap — a
             # learner just retries the same blank until right — so
             # `adv.correct` at the moment a pass completes is
             # unconditionally `true`. `answerAfterTap`'s gate branch (post-
             # B11, v3-D101) stamped `gate_result.correct: adv.correct` —
             # always `true` — so a cold gate started with a slip and
             # doggedly retried into completion recorded as a clean pass.
             # `AtomState.gateFails` only ever increments on a REAL
             # `gate_result:false`, so it could never exceed 0 in
             # production and the ladder's `gateForgiveness()` could never
             # return anything but `"cold"`. v2's own `pages/Gate.tsx` (read,
             # never touched) has the missing piece — a local `slipped` flag
             # deciding `passed = !slipped` at completion — never ported
             # when the session loop landed. Fixed: `SessionRun` gained
             # `gateSlipped`, set by any wrong tap while the current item is
             # a due gate and reset per fresh queue item; `gate_result.
             # correct` is now `!run.gateSlipped`. Also wired the demote half
             # of the ladder on top of the now-reachable `gateFails`: new
             # `lib/session/run.ts#demoteOfferFor`/`acceptGateDemote` +
             # `SessionIsland.tsx`'s "send it back to Learn" surface,
             # mirroring v2's `Gate.tsx#stage === "demote-offer"` exactly.
             # RED confirmed at both the `run.ts` level (a deliberate mid-
             # gate slip, recovered by retrying, previously recorded
             # `correct: true`; now `false`) and the component level (the
             # demote-offer UI tests failed against the unmodified
             # `SessionIsland.tsx` before the wiring landed). `TZ=UTC make
             # test`: 2003 passing (was 1995, +8 — exactly this run's new
             # tests). `TZ=UTC make build`: exit 0, 20 routes (unchanged).
             # `npm run gates`: all green. No v1/v2 edit, no Arabic
             # codepoint introduced. NOT addressed, named so a future run
             # doesn't re-discover it as new: the "rescaffold" ladder rung
             # (`RESCAFFOLD_AFTER_FAILS = 2`, a lighter ungraded S2 warm-up
             # pass before the next cold attempt) — v2's `Gate.tsx` runs it
             # as a second reconstruction phase within the same gate visit,
             # which `SessionRun`'s one-machine-per-item shape does not
             # support without a real, separate state-machine extension; a
             # learner with 2-3 consecutive fails still gets the ordinary
             # full cold check today, not the lighter warm-up. Also found by
             # this run's sweep and deliberately left for a future run:
             # `floor.ts`'s entire FR9 2-minute floor session
             # (`floorQueue`/`floorMinutes`, zero callers, needs its own
             # `/home` CTA and a reduced-queue session entry point) and
             # `activity.ts#lastActiveDayMs()` being re-derived by hand in
             # `run.ts` instead of imported (harmless — the inline copy is
             # byte-identical — but the same "re-derive instead of import"
             # shape as v3-D83's `gradeClassToWire` finding). See
             # DEFECTS.md#B12 and DECISIONS.md v3-D107.
             # NOTE (v3-D106): `packages/engine/src/freeplay.ts#weakSpots` (FR6
             # Door 2, "weak-spot gym") had ZERO production callers — v3-D98's
             # own header named it out of scope, pending "a real UI surface of
             # its own (a ranked list)." That surface now exists on the
             # `/session` summary screen, alongside Door 1's own CTA: new
             # `lib/session/run.ts#weakSpotOfferFor`/`startWeakSpotDrill`
             # (mirroring `extraLearnOfferFor`/`startExtraLearn`'s exact
             # shape) + a "Practice your weakest spot" button in
             # `SessionIsland.tsx`. Unlike Door 1's fresh candidate
             # (strength definitionally 0), a weak spot is something already
             # encoded, so its reconstruction is sized off its REAL current
             # strength; it commits through the same `answerCurrent`/
             # `settleAnswer` path as an ordinary scheduled review
             # (`kind: "review"`), so it is full-weight/`structured:true` by
             # construction, never a second grading rule. Only "ayah"-kind
             # weak spots are offered — a "connection" atom has no reconstruct
             # surface in v3 (`bridge.ts` atticked, DEFECTS.md#E-08). RED
             # confirmed by `git stash` of `run.ts`+`SessionIsland.tsx` only:
             # `run.test.ts` failed all 3 new tests, `session-island.test.tsx`
             # failed its CTA-appears test; `git stash pop` restored both to
             # green. `TZ=UTC make test`: 1995 passing (was 1990, +5 — exactly
             # this run's new tests). `TZ=UTC make build`: exit 0, 20 routes
             # (unchanged). No v1/v2 edit, no Arabic codepoint introduced.
             # Door 3 (open practice) and `coldSuccessAdoption`/
             # `diminishingReturns` remain unwired — each needs a free-play
             # surface that does not exist yet, named in DECISIONS.md v3-D106
             # so a future run doesn't re-discover them as new.
             # NOTE (v3-D105): `packages/engine/src/test.ts#testHistory` (v2-D17
             # Progress Report's per-Test history list) had ZERO production
             # callers — v3-D104's own header named this precisely: "a learner
             # who completes a Test sees the immediate score screen but no
             # later record of it on /progress... the natural next increment,
             # not a correctness gap... only a new small `lib/progress` panel
             # in the same shape as `RetentionPanel`/`GrowthPanel`." That panel
             # now exists: new `lib/progress/testHistory.ts`
             # (`buildTestHistorySummary` — the same "component never
             # computes, it only prints" split `retention.ts`/`growth.ts`
             # already follow) + `components/progress/TestHistoryPanel.tsx`
             # (presentational only) + `TestHistoryIsland.tsx` (mirrors
             # `GrowthIsland`'s four-state discipline, edge cases #72/#73),
             # wired into `/progress` as a new TEST HISTORY card, placed after
             # the existing TEST call-to-action card.
             #
             # One real decision: `score` on a `test_result` event is
             # documented (`types.ts`) and actually written
             # (`TestIsland.tsx#finishTest`) as `correct ÷ total`, a 0..1
             # ratio — never a raw count, unlike what v2's own `Progress.tsx`
             # rendering implied by dividing `h.score / h.total` again. The
             # correct COUNT is recovered once, in `testHistory.ts`
             # (`Math.round(score * total)`), so no view re-derives it or
             # repeats v2's own reading. Every row's score sentence
             # (`"4 / 5 correct (80%)"`) mirrors `TestIsland.tsx`'s own
             # result-screen wording exactly, so a learner reads the identical
             # sentence on the day of a Test and later on /progress. The date
             # label is `tz`-explicit (`Intl.DateTimeFormat` with `timeZone:
             # tz`, `tz` resolved once server-side and passed down), the same
             # convention `/plan`'s page and `lib/plan/forecast.ts#dateLabel`
             # already use — never the machine's ambient zone (Absolute A's
             # spirit, applied outside the engine where it isn't mandatory but
             # is still the established house style).
             #
             # RED confirmed directly: `git stash` on
             # `app/(app)/progress/page.tsx` only (kept the test file and all
             # three new library/component files, each a legitimate
             # standalone unit) and reran — 1 of 16 failed, exactly the
             # `toMatch(/TestHistoryIsland/)` wiring assertion; `git stash
             # pop` restored the fix, 16/16 green again.
             #
             # `TZ=UTC make test` (full monorepo, all seven suites, fresh
             # dependency install from a clean checkout): **1990 passing**
             # (was 1974) — 255 v2 vitest + 47 v2/api + 272 v3/api + 111
             # corpus-compiler + 417 engine + 61 fold-runner + **827** apps/web
             # (was 811, +16 — exactly this run's new tests).
             # `check-test-floor.mjs`: OK, 1990 >= floor 1899 (+91 margin,
             # `TEST-FLOOR` left unmoved, same discipline as every prior
             # entry). `TZ=UTC make build`: exit 0, 20 routes (unchanged — no
             # new route file, only an existing page section and two new
             # client-side modules). `npm run gates`: locked-css OK,
             # boundaries OK (200 files, up from 196 — no violation),
             # corpus-morphology and corpus-glyphs OK.
             #
             # No `v1/**`/`v2/**` edit — a stray `v2/tsconfig.tsbuildinfo`
             # build-cache diff produced by running the suite was reverted
             # before committing, same as v3-D104. No Arabic codepoint
             # introduced: every new line addresses a surah/ayah by number, a
             # score by `correct`/`total` (integers), or a timestamp by `ts`
             # (a number) — every rendered string is composed from those,
             # never from corpus text.
             #
             # Explicitly not addressed, named so a future run doesn't
             # re-discover it as new: the `disable` field /
             # `isQuestionDisabled()` (a qari-disabled question can still
             # surface in a Test or the real session loop) remains unwired —
             # unchanged since v3-D95's/v3-D104's own retrace, and not
             # something this card introduced or was scoped to fix.
             # NOTE (v3-D104): `packages/engine/src/test.ts` (v2 Phase 4, the
             # Test self-quiz feature — vocab/cloze/junction/locate/produce +
             # chaining-reorder over a learner-chosen range, read-only by
             # construction: rebuild.ts has no fold branch for any test_*
             # event) had 11 exported functions, unit-tested since it landed,
             # and ZERO production callers — v3-D102/D103's own named,
             # twice-deferred finding ("needs a whole new route end-to-end").
             # That route now exists: new `lib/test/build.ts` (pure item
             # selection, shuffle INJECTED for testability — one deliberate
             # fix over v2's own algorithm: a reorder item's span is now
             # bounded by the CHOSEN pool length too, not just the corpus
             # tail, so a single-ayah range can no longer quiz ayat outside
             # it) + `components/test/TestIsland.tsx`/`TestGate.tsx` (mirrors
             # SessionIsland/SessionGate's split) + `app/(app)/test/page.tsx`,
             # entry point on `/progress` (a new TEST card — v3-D05 already
             # closed the 4-tab bar). Every rendered option bank uses the
             # SAME seeded `displayOrder` every other quiz surface uses
             # (never Math.random, unlike v2's `Test.tsx`) and every tap is
             # followed by an explicit "Continue" (mirrors SessionIsland's
             # own reveal discipline, never v2's `setTimeout(450)` auto-
             # advance) — both chosen for consistency with this build's own
             # established conventions, not because v2 was wrong to differ.
             # A "produce" item nests a full reconstruct pass through the
             # SAME engine functions the real session loop uses, but never
             # appends a per-tap `reconstruct_tap` — only the whole pass
             # becomes ONE `test_answer`, verified directly (a dedicated test
             # drives every blank via trial-and-error and asserts zero
             # `reconstruct_tap` events land anywhere in the log). Every
             # `rung` is `gradeClassToWire("ungraded")`, never a literal —
             # DEFECTS.md#B2's clause 14 gate passes on the first commit, not
             # as a follow-up fix. `lib/test/build.test.ts` (13 tests) +
             # `test/test-island.test.tsx` (4 tests, incl. folding the whole
             # post-Test log and asserting zero atoms — invariant #5, proven
             # against the real component's real log, not asserted in the
             # abstract). `TZ=UTC make test`: 1974 passing (was 1957, +17 —
             # exactly this run's new tests). `TZ=UTC make build`: exit 0, 20
             # routes (was 19 — `/test` is new). No v1/v2 edit (a stray
             # `v2/tsconfig.tsbuildinfo` build-cache diff was reverted before
             # committing), no Arabic codepoint introduced. NOT addressed,
             # named so a future run doesn't rediscover it: `testHistory()`
             # (v2-D17's per-Test history on `/progress`) stays unwired — a
             # learner sees the immediate score but no later record of it;
             # the events are already durable, this is a new small panel, not
             # a correctness gap. See DECISIONS.md v3-D104.
             # NOTE (v3-D103): `packages/engine/src/heatmap.ts#growthCurve`
             # (v2-D17/D20's Progress Report growth curve — one point per
             # learning-day with a newly-encoded ayah, cumulative count) had
             # ZERO production callers, unit-tested since the heatmap landed
             # (habit.test.ts) but never wired — v3-D102's own sweep found it
             # the previous run and deliberately deferred it, scoped exactly
             # as "needs an actual chart/sparkline on /progress — a genuinely
             # new rendering surface." That surface: new `lib/progress/growth.ts`
             # (`buildGrowthSummary` — the same "component never computes, it
             # only prints" split `retention.ts` already follows) +
             # `components/progress/GrowthIsland.tsx` (a client island mirroring
             # `RetentionIsland`'s four-state discipline, edge cases #72/#73) +
             # `GrowthPanel.tsx`, wired into `/progress` as a new GROWTH card.
             # Every bar carries a real, checkable `.sr-only` label ("3 encoded
             # by day 2") beside its `aria-hidden` height — never colour/shape
             # alone (§15/#87's rule, applied to a trend rather than a
             # category) — and height is scaled off the curve's OWN maximum,
             # floored at 6% so a small nonzero day is never rounded invisible
             # (same discipline as `.dist-bar__fill`'s data-driven widths).
             # RED confirmed: reverting just the page wiring (kept the new
             # `growth.ts`/`GrowthPanel`/`GrowthIsland` files, all legitimate
             # standalone units) failed 1 of 17 new `progress-growth.test.tsx`
             # tests, exactly the wiring assertion; reverted byte-identically,
             # 17/17 green again. `packages/engine/src/test.ts`'s entire Test
             # self-quiz feature (11 exported functions, real coverage, no
             # `/test` route anywhere) remains deliberately unwired — it needs
             # a whole new route, not a card on an existing one. `TZ=UTC make
             # test`: 1957 passing (was 1940, +17 — exactly this run's new
             # tests). `TZ=UTC make build`: exit 0, 19 routes (unchanged). No
             # v1/v2 edit, no Arabic codepoint introduced — every new line
             # addresses a word by `position` (an integer) or a day by
             # `ordinal`/`cumulativeEncoded` (integers derived from the event
             # log), never corpus text.
             # NOTE (v3-D102): `packages/engine/src/heatmap.ts#wordDiagnostics`
             # (the ayah-detail route's "one tap deeper" per-word accuracy
             # diagnostic, invariant #1: words are diagnostics, never the
             # graded atom) had ZERO production callers, unit-tested since the
             # heatmap landed (habit.test.ts) but never wired. Fixed:
             # `AyahStatsIsland.tsx` now computes `wordDiagnostics()` alongside
             # its existing row read and renders a "Tap accuracy, word by
             # word" list via the new `lib/progress/wordAccuracy.ts` (rows.ts's
             # own discipline: the component prints, never computes). A word
             # never tapped is DROPPED, never printed as "0%" — the same
             # unmeasured-vs-zero rule `rows.ts` already applies to the ayah
             # figures above it. RED confirmed by reverting just the wiring
             # (kept the new lib file, a legitimate standalone unit): 3 of 42
             # `ayah-detail.test.tsx` tests failed on exactly the new
             # assertions; reverted byte-identically, 42/42 green again.
             # `growthCurve()` (heatmap.ts's other unwired export, a Progress
             # Report growth-over-time curve, v2-D17/D20) and
             # `packages/engine/src/test.ts`'s entire Test self-quiz feature
             # (11 exported functions, real coverage, no `/test` route
             # anywhere) were found by the same sweep and deliberately left
             # for a future run — each needs its own UI surface, not a wiring
             # fix. `TZ=UTC make test`: 1940 passing (was 1935), floor 1899
             # satisfied (+41 margin). `TZ=UTC make build`: exit 0, 19 routes
             # (unchanged). No v1/v2 edit, no Arabic codepoint introduced.
             # NOTE (v3-D101): DEFECTS.md#B11 — the day-1 cold gate (FR3,
             # gate.ts) could never actually be PASSED on the shipped
             # `/session` route. `lib/session/run.ts#answerAfterTap` always
             # emitted `ayah_produced` for a completed reconstruction pass,
             # even when the completed queue item was a due gate
             # (`run.queue[cursor].kind === "gate"`, read once by `machineFor`
             # to size the reconstruction, never checked again at commit
             # time). `gate.ts#applyGateResult()` — the only place
             # `gatePassed` is ever set true — is folded exclusively from a
             # dedicated `gate_result` event; the mis-emitted S3
             # `ayah_produced` instead re-armed the SAME gate for the next
             # learning-day (rebuild.ts's ordinary rung-S3 branch calls
             # `scheduleGate()` again). Since `unlockPermitted()`'s default
             # tolerance is 0, a default-pace learner who completed one
             # ayah's Learn could NEVER unlock a second ayah — the gate
             # reappeared, was answered correctly, and silently rescheduled
             # itself forever, with no error surfaced anywhere. Same shape as
             # B10/B2: a caller re-deriving/misrouting a grading decision
             # instead of the dedicated resolver. Fixed: `answerAfterTap` now
             # emits `gate_result` (`correct: adv.correct`) instead of
             # `ayah_produced` when the completed item's kind is "gate".
             # Verified RED (reverting just the source, keeping the new
             # test, reproduced the failure on exactly `gateResults.length
             # === 0`) then green. NOT addressed: `sessionSummary.ts` still
             # only counts `ayah_produced`/`ayah_complete` toward
             # `ayatCompleted`, so a gate-only session shows 0 ayat completed
             # on the summary screen — a small, separate UI question. See
             # DEFECTS.md#B11 and DECISIONS.md v3-D101.
             # NOTE (v3-D100): `Admin\SystemHealthController` (build-plan step
             # 24 — "System Health: both checks, coverage alerts, degraded
             # banner, rebuild with mutex") had a fully-tested backend and ZERO
             # frontend callers — `find "app/(admin)" -type f` returned only
             # `/workbench` and `/settings/stripe`. New `lib/admin/health.ts` +
             # `components/admin/SystemHealthPanel.tsx` +
             # `app/(admin)/settings/health/page.tsx` give it a face, mirroring
             # `loadFrontier`'s three-state discipline (#167: unknown is never
             # painted as 0) and #168's queued-vs-failed rebuild distinction.
             # Adjacent finding while building it: `StripeSettingsPanel.tsx`
             # (zero prior test coverage) called `apiFetch("/admin/stripe")` —
             # missing the `/api` prefix every other call site in this app
             # uses — so the shipped Stripe settings screen 404'd before
             # Laravel ever saw the request. Fixed both call sites; a
             # regression test reproduces the bug against the unfixed
             # component first (RED), then confirms the fix. This run also
             # swept every other `onAnswer`-shaped wiring v3-D99 flagged as
             # unaudited (`FirstRecall`, `ExplainTrace`) for B10's exact drift
             # and found none — a genuine, verified negative. See
             # DECISIONS.md v3-D100.
             # NOTE (v3-D99): DEFECTS.md#B10, found while wiring v3-D98 (below).
             # `lib/session/run.ts#answerCurrent` graded a tap against the
             # ENGINE'S RAW, unshuffled `[correct, ...distractors]` order
             # (`currentItem(...).options`), but the index a real tap reports
             # is into the SHUFFLED display bank `lib/onboarding/pass.ts
             # #assemblePass` builds and `SessionIsland` actually renders —
             # the identical drift v3-D57/D58 already found and fixed once in
             # onboarding/the landing demo (`lib/demo/reconstruct.ts#applyTap`
             # is the already-correct precedent). A standalone diagnostic
             # against the real 112 corpus found 0 of 4 blanks of 112:1 where
             # the raw slot the old code read agreed with what the learner was
             # actually shown as correct — tapping the DISPLAYED correct tile
             # was graded against whichever face the shuffle happened to leave
             # at raw slot 0. This is the ONLY graded path in the product.
             # Fixed: `answerCurrent` now resolves the tapped surface via the
             # SAME `assemblePass` call `SessionIsland` renders from, mirroring
             # `applyTap` exactly. Confirmed with a genuine RED: reverting the
             # fix and re-running `run.test.ts` failed 10 of 21 tests,
             # including sessions that never reached `done` — a correct tap
             # graded wrong stalls the reconstruction outright, since a
             # wrong-graded tap never advances. Nothing caught this for five
             # days because `run.test.ts`'s own `playThrough` always submitted
             # raw index 0 (bypassing the shuffle entirely), the e2e suite's
             # one `/session` tap explicitly doesn't check correctness, and
             # `quiz.test.tsx` tests the cards in isolation with mocked
             # `onAnswer`. See DEFECTS.md#B10 and DECISIONS.md v3-D99.
             # NOTE (v3-D98): `packages/engine/src/freeplay.ts` (FR6, "three
             # doors after session complete" — extra Learn, weak-spot gym,
             # open practice, plus cold-success adoption and a
             # diminishing-returns nudge) had ZERO production callers, in v2
             # or v3, despite being fully unit-tested (17 assertions). Scoped
             # to Door 1 only (`extraLearnGrant`) — the one piece that slots
             # into the existing post-session summary screen with no new
             # route or picker UI. `lib/session/run.ts` gained
             # `extraLearnOfferFor`/`startExtraLearn`; `SessionIsland` offers
             # "Learn one more ayah (~N min)" once the assembled queue is
             # done and the engine's own fold still grants it. Doors 2/3, the
             # adoption offer and the diminishing-returns nudge are
             # deliberately NOT done — each needs its own UI surface. See
             # DECISIONS.md v3-D98.
             # NOTE (v3-D97): `packages/engine/src/streak.ts#computeStreak()`/
             # `completedDayIndices()` (FR9 — pause-on-miss, never zeroes,
             # 19 tests) had ZERO production callers. Unlike prior nights this
             # wasn't silent data corruption — it was a marketing claim with
             # nothing behind it: the landing page's own FAQ answers "Is this
             # another streak app?" in the present tense ("There is a streak,
             # and it is deliberately unimportant... no leaderboard, no
             # ranking..."), and nothing in the shipped app ever showed a
             # streak anywhere. Fixed, scoped narrowly: `lib/home/queue.ts`
             # now computes a quiet `${n}-day streak` (or null on zero — never
             # a nagging "0-day streak") from the SAME event log the due-count
             # already reads; `TodaySession.tsx` renders it via the locked
             # `.pill-streak` class (existed, unused, since the v1 port).
             # Deliberately NOT done: `atRisk`/`pausedOnMiss`/`makeupAvailable`
             # stay unsurfaced, and the rich streak-calendar/freeze-token UI
             # WIREFRAME/BUILD-PLAN name is v3-D06's flag-gated M11 social
             # scope, OFF by default — this fix backs the FAQ's own minimal,
             # private claim, not that larger surface. See DECISIONS.md v3-D97.
             # NOTE (v3-D96): `packages/engine/src/overrides.ts#applyOverrides()`
             # — "the ONE place override precedence is decided," closing
             # DEFECTS.md#B1/#B4 — was unit-tested three times but had ZERO
             # production callers. Both halves of the write/read API were real
             # and independently tested (`POST /api/overrides` admin-gated write,
             # `GET /api/overrides` public read), but `lib/corpus/client.ts
             # #fetchCorpus` — what `SessionIsland.tsx` actually drills a real
             # learner against — served the raw compiled corpus straight
             # through. A qari/admin correcting a wrong gloss or a bad
             # distractor via the already-shipped write path had that
             # correction silently never reach the learner being graded on it.
             # Fixed: new `lib/overrides/fetch.ts#fetchOverrides()` (mirrors
             # `lib/entitlement/sync.ts`'s never-throws/never-blocks discipline,
             # routed through `apiFetch`, the sole `/api` egress) + `fetchCorpus`
             # now applies the result via `applyOverrides()` before caching.
             # Deliberately NOT done: `lib/corpus/load.ts` (the SSR loader
             # behind `/plan`/`/progress`/`/surah/[surah]`/`/workbench`) still
             # serves the raw corpus — this codebase has no established
             # pattern for the Next.js server to call the Laravel API over
             # HTTP (every other live server state is client-fetched), so
             # inventing one is real scope, not tonight's wiring fix; and
             # `isQuestionDisabled()`/the `disable` field remains unconsumed
             # anywhere in the selection engine. See DECISIONS.md v3-D96.
             # NOTE (v3-D95): eight straight nights (v3-D82..D94) mined the
             # same bug class — "mechanism built and unit-tested, zero
             # production callers." This run's fresh sweep came back empty
             # against that same bar for the first time (see DECISIONS.md
             # v3-D95 for the full retrace of near-misses ruled out). Picked
             # up HANDOVER.md's own still-open E10 instead: nothing summed
             # the seven `make test` suites and compared against a floor, so
             # DEFECTS.md#B9's "build gate that can never fail" had a live
             # sibling — a suite could shrink and `make test` would still
             # exit 0. Built `v3/scripts/check-test-floor.mjs` (RED before
             # green, 9 new tests), wired into the root `Makefile`'s `test`
             # target. Mutation-verified 3 ways incl. a LIVE-FIRE proof: a
             # temporarily `.skip`'d real test in `sync-trigger.test.tsx`
             # left the vitest suite itself green (735 passed | 1 skipped)
             # but made `make test` exit 2 — proving the gate catches
             # exactly the silent-shrink case it was built for. See
             # DECISIONS.md v3-D95.
             # NOTE (v3-D94): `lib/idb/append.ts#retryAppend()`/`RetryableAppendError`
             # — edge case #74's "QuotaExceeded on tap write... card blocks with
             # retry banner; tap never silently dropped" — had ZERO production
             # callers. `lib/session/run.ts#answerCurrent` let a retryable commit
             # failure propagate raw, and `SessionIsland.tsx`'s only catch turned
             # EVERY failure into a static alert with no button — the retry banner
             # edge case #74 names did not exist; a learner who hit a real quota
             # error mid-drill was stuck on a dead end. Fixed: `answerCurrent` now
             # throws a new `SessionCommitFailure` (carrying a `resume()` that
             # retries the SPECIFIC failed commit via `retryAppend`, reusing its
             # id/deviceSeq, then continues exactly where it left off — never by
             # re-invoking `answerCurrent`, which would double-append an
             # already-landed event under a fresh id); `SessionIsland.tsx` renders
             # a real "Retry" button wired to `resume()`. A second candidate this
             # run's sweep found, `EntitlementMachine::merge()` (edge case #113),
             # was traced and left alone: account adoption has no UI or client
             # contract at all yet (per DECISIONS.md, `DeviceReset.tsx`'s own
             # comment), so wiring `merge()` is real M6 scope, not a one-night fix.
             # See DECISIONS.md v3-D94.
             # NOTE (v3-D93): `WriteLock.subscribe()`/`useWriterStatus()`
             # (lib/idb/writeLock.ts, lib/idb/useLogState.ts) — edge case #75's
             # multi-tab writer-takeover mechanism — had ZERO production callers.
             # `SessionIsland.tsx` took one `writeLock.acquire()` snapshot at
             # mount and never learned of a LATER promotion, even though
             # `WriteLock.release()`'s own docblock promises "a queued tab is
             # promoted without a reload." A learner who closed the other tab
             # stayed stuck on "This session is open in another tab... reload
             # this page" with no way back short of a manual reload. Fixed:
             # the mount effect now subscribes to `writeLock` and starts the
             # session the moment status flips to writer, no remount needed.
             # `useWriterStatus()` itself remains unconsumed (a separate,
             # smaller gap — see DECISIONS.md v3-D93). `TrialAttribution`
             # (v3-D91) and `permitsIssuance`/`permitsReview` (v3-D88) are
             # unchanged, still open product questions, not wiring gaps.
             # NOTE (v3-D92): `POST /api/verifications` gated `tier: qari` on the
             # generic `admin` allowlist only — `AdminRole::QARI` (build-plan step
             # 24) existed and its own migration docblock said roles "refine what
             # an already-allowlisted admin may do," but nothing ever checked one,
             # and no code path anywhere could even GRANT it. Any operator or
             # moderator admin could sign a scholar's qari-tier row undetected —
             # confirmed live: the existing test suite exercised this exact path
             # with a roleless admin fixture and passed. Fixed: `store()` now
             # requires `hasAdminRole(AdminRole::QARI)` for the qari tier; new
             # CLI-only `admin:grant-role {email} {role}` is the missing grant
             # path (roles refine an allowlisted admin, they never admit one).
             # Admin-tier writes (distractors/specs) stay open to any admin —
             # v3-D13 never gated them on scholarship. See DECISIONS.md v3-D92
             # and LAUNCH-CHECKLIST.md gate 16 (S5).
             # NOTE (v3-D91): `App\Flags\FlagService::autoWaiveDueKills()` (v3-D17's
             # 72h audited auto-waive, LAUNCH-CHECKLIST gate 9) was built and
             # unit-tested since the flag plane shipped but had ZERO production
             # callers — `routes/console.php` scheduled only the determinism
             # nightly and the PDPA purge, never this. A killed flag's admin
             # banner never actually auto-cleared after 72h on a real host. Fixed:
             # `flags:auto-waive` (`AutoWaiveKillsCommand`), scheduled daily
             # 04:00 UTC. See DECISIONS.md v3-D91. Still fires only once gate 20
             # (a host running `schedule:run`) exists.
             # NOTE (v3-D90): `lib/entitlement/sync.ts`'s own header CLAIMED
             # `refreshEntitlementSnapshot` was already "fire-and-forget from
             # every caller ... see lib/session/run.ts#startSession" — false;
             # `run.ts` has no React and nothing called it. This is the OTHER
             # unwired half of v3-D88 (the cache-WARM, not the gate — that
             # question is still open, see below). `components/session/
             # SessionIsland.tsx`'s mount effect now calls it fire-and-forget.
             # `permitsIssuance`/`permitsReview` STILL have zero gating
             # callers — only the cache warm moved. See DECISIONS.md v3-D90.
             # NOTE (v3-D89): `lib/sync/sync.ts#syncCycle()` — B5's actual fix
             # (merge.ts) reached via `pullFromServer` — had ZERO production
             # callers anywhere in apps/web since build-plan step 21: a
             # learner's second device never actually pulled their events.
             # `components/shell/SyncTrigger.tsx` now calls it on mount +
             # window `online`/`focus` (v2/src/sync/useBackgroundSync.ts's own
             # precedent for this exact question), gives `shouldAttemptSync()`
             # and `backoffMs()` their first real callers too, and is mounted
             # in app/(app)/layout.tsx beside <TabBar/>. See DECISIONS.md
             # v3-D89. `permitsIssuance`/`permitsReview` (v3-D88) remain
             # untouched — still a stop-and-report product question, not
             # resolved by this run's precedent.
             # NOTE (v3-D88): `PaywallGate::permitsIssuance()` and its client
             # mirror `lib/entitlement/gate.ts#permitsIssuance()` had ZERO
             # production callers, on EITHER side, six days after the session
             # loop (step 18) made the reason for deferring them stale.
             # `GET /api/entitlement` + `lib/entitlement/sync.ts` now give the
             # client a real snapshot to call `permitsIssuance` WITH — but the
             # actual call inside `lib/session/run.ts#startSession` is still
             # NOT wired, on purpose: doing so naively would deny REVIEW for a
             # lapsed learner too, since `/session` issues one mixed queue and
             # v3-D16 (this build's "single ethical commitment") requires
             # review to stay open forever. See DECISIONS.md v3-D88 for the
             # two ways to resolve that and why picking one needs Firdaus.
             # NOTE (v3-D87): LAUNCH-CHECKLIST gate 21 (per-corpus Amiri glyph
             # coverage) was mislabeled BLOCKED-ON-INFRA on a reason that had
             # already stopped applying once the launch surah set closed
             # (v3-D59). `check-corpus-glyphs.mjs` (no new dependency — a
             # from-scratch WOFF2/cmap parser, self-verified against
             # FONTS.md's independently-verified codepoint counts) now runs in
             # `npm run gates`/`prebuild` and reports zero uncovered
             # codepoints across all four launch surahs.
             # NOTE (v3-D50): v3/api/tests/Unit/.gitkeep is LOAD-BEARING.
             # NOTE (v3-D77): `make test`/`make build` both depend on `compile-corpus`
             # now — do not hand-run compile-corpus first and assume that's why it's green.
             # NOTE (v3-D82): v3-D77's compile-corpus fix missed `test-api3` itself —
             # OverrideHashRecomputeTest reads the real compiled 112/hashes.json with
             # no fixture fallback, so `test-api3` (and CI's `php` job for v3/api) was
             # red on a genuinely clean checkout. Both now compile the corpus first.
             # NOTE (v3-D83): DEFECTS.md#B2 was reborn outside JSX — `lib/session/run.ts`
             # (the real session loop, step 18) re-derived the exact `full ? S3 : S2`
             # ternary; `gradeClassToWire()` had ZERO callers anywhere. Fixed, and
             # check-boundaries.mjs clause 14 now greps app/+components/+lib/ for a
             # literal Rung on `rung:` so this cannot silently return.
             # NOTE (v3-D85): the admin "rebuild atom cache" button (step 24) never
             # actually rebuilt anything — no Process call, no queued job, and the
             # lock it acquired was never released; both its tests passed only
             # because they manually force-released that lock. Fixed SYNCHRONOUSLY
             # (matching v3-D81's CorpusHashRecomputer precedent) via the new
             # App\Support\AtomCacheRebuilder + worker/fold-runner/bin/rebuild-atom-cache.ts —
             # a queued job would have reproduced the same "nothing runs it" defect,
             # since nothing on this deployment runs a queue worker either.
             # Steps 1-26 + 29 done. 27/28 blocked on human content/qari (HANDOVER.md C1-C4).
             # 30's engineering: the P1 pager is now wired (v3-D82) — a confirmed P1
             # emails config('nightly.pager_emails') (defaults to ADMIN_EMAILS); still
             # needs a live SMTP account to actually deliver (gate 20). LAUNCH-CHECKLIST
             # gate 19 (PDPA delete/purge) landed its backend in v3-D79 and its frontend
             # surface (/settings) in v3-D80 — still open: the Postgres append-only grant
             # and a live nightly `pdpa:purge-due` run (gate 20, no staging host).
             # See LAUNCH-CHECKLIST.md's "critical path out of here" for what's
             # genuinely still open — re-verify against the repo, don't trust this
             # comment's numbers past their next change.
make build   # must pass — CI no longer tolerates failure (B9)
make doctor  # what's missing
```

`composer dev` starts the **wrong** Vite. Use `make dev`. See `LOCAL-SETUP.md`.

## Where things go

```
v3/api/            Laravel (its own app — v3-D08)
v3/apps/web/       Next.js App Router
v3/packages/engine/  the pure engine, ported from v2
v3/worker/         Node fold-runner — the ONLY server-side fold
v3/docs/           spec + plan
```
