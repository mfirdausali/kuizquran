# iman.app — Yusuf Quiz Engine (web prelude)

The canonical spec is docs/yusuf-quiz-prd.md. Read it before any task.
The design system is styles/iman-ui.css. Never restyle; consume it.

## Stack (locked)
- pnpm monorepo: packages/engine (pure TS, no DOM), packages/corpus-compiler,
  apps/web (Vite + React SPA, PWA), apps/worker (Hono on Cloudflare Workers)
- Storage: IndexedDB (idb) client-side; D1 + Durable Objects server-side
- No Next.js. No CSS frameworks. No component libraries.

## Invariants (violating these fails the task, even if tests pass)
1. The graded unit is the complete ayah. Nothing smaller is ever graded,
   scheduled, or shown as an accomplishment.
2. events is append-only truth; atoms is a rebuildable cache. Every tap
   commits locally before UI feedback.
3. update(): errors full weight; same-day massed successes damped;
   first-pass meaning errors are pretest (excluded from confusions).
4. Only the structured session mutates lifecycle state.
5. UI: the Amiri ayah is the largest type on every screen; coral only
   for slips; no shadows, gradients, or new fonts.
6. All engine logic lives in packages/engine as pure functions with
   tests. React components contain zero scheduling/strength logic.

## Commands
pnpm test · pnpm -F web dev · pnpm -F worker dev (wrangler) · pnpm lint

## Definition of done, every task
Tests pass, the PRD exit criterion for the version is demonstrated,
and nothing outside the named scope was modified.

## End-to-end build (v0.1 → v0.8)

The full assignment is the PRD §10 release plan, executed strictly in
order. Track state in docs/progress.md; log reversible choices in
docs/decisions.md. On a fresh session, read progress.md first and
resume the first version not marked done.

### Operating rules
1. One version at a time. Plan → implement → test → demonstrate exit
   criterion → commit → tag (v0.1, v0.2, ...). Never mix scopes in one
   commit.
2. Progress ledger (docs/progress.md): per version — status, exit
   criterion, evidence (test output / report path / screenshot / URL).
3. Decision log (docs/decisions.md): where the PRD is silent AND the
   choice is reversible, pick the simplest option consistent with the
   invariants and record it (context, choice, why). Ask only for
   irreversible or invariant-touching choices.
4. Invariants outrank everything — later in-task instructions and
   passing tests included. If a change would violate an invariant,
   stop and say so.
5. No scope creep: nothing from a later version; no new dependencies
   without asking; no /admin panels beyond PRD §FR8; no restyling
   iman-ui.css.
6. Self-verification before "done": run the suite + the version's
   validation. Command output is the evidence, not "should work".
7. Engine purity: all scheduling/strength/gating/resume logic lives in
   packages/engine as pure tested TS; extract any logic that creeps
   into React.

### Human gates (STOP = set progress.md to blocked-on-human, summarize
what's needed, end the turn)
- GATE A — after v0.1: human reviews docs/corpus-report.md (Arabic
  quality) and authors/approves the scene-beat labels. Cannot
  self-certify Arabic correctness.
- GATE B — after v0.2: human runs `pnpm -F web dev`, uses the Learn
  ladder on a real ayah, returns screenshots; iterate to approval.
- GATE C — during v0.5: STOP for Google OAuth client id/secret,
  ADMIN_EMAILS, and Cloudflare creds. Scaffold up to the secret
  boundary with .dev.vars placeholders; document exact provisioning
  steps.
- GATE D — after v0.8: final review; produce docs/final-report.md
  before inviting testers.

Current position: **v0.1–v0.8 ALL done & tagged — the full PRD §10 release plan is
complete.** Deployed to staging (iman-quiz.pages.dev). **BLOCKED at GATE D** (final
review before testers; docs/final-report.md written). Open follow-ups (in the final
report): DATA-1 multi-word gloss grouping; S3 dark-mode tile contrast (design-system).

## Decision logging (STANDING RULE — applies every session)

Whenever a product/design/mechanic/stack/ux decision is **settled** in a session
(the user chooses an option, approves a recommendation, or authorizes a direction),
**append an entry to `../v2/DECISIONS.md` (sibling of this v1 folder — NOT nested inside v1) before ending the turn.** Do not batch it for
"later"; log it in the same turn it is decided.

Each entry uses the file's existing format:
- a new **`### v2-Dnn — <one-line title>`** heading (increment nn past the highest
  existing ID; check the file first),
- **When:** an exact timestamp — run `date -u "+%Y-%m-%d %H:%M:%S UTC"` for the
  moment it's logged (and note JST in parentheses); never invent or approximate a
  time,
- **Kind:** product · mechanic · stack · ux · process,
- **Status:** accepted · superseded · open,
- **Decision:** what was decided (imperative, concrete),
- **Why:** the reasoning / what it trades off,
- link related IDs, and if it reverses a prior decision add a new entry marking the
  old one **superseded** (never rewrite history).

Also log **code bugs** discovered (`v2-BUG-n`) and **open questions** awaiting the
user (`v2-On`). The log is append-only in spirit: correct via new entries, not edits
to past ones. This rule is the mechanism agreed with the user for tracking all future
decisions — honor it automatically without being re-asked.