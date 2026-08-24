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
make test    # 2245 passing (+2 incomplete, PAY-1, by design), typechecks first.
             # 255 v2 vitest + 47 v2/api + 295 v3/api + 111 corpus-compiler
             # + 420 engine + 61 fold-runner + 1056 apps/web. (v3-D133, 2026-08-24)
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
