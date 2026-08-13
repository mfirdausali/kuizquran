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
make test    # 1830 passing (+2 incomplete, PAY-1, by design), typechecks first.
             # 255 v2 vitest + 47 v2/api + 253 v3/api + 111 corpus-compiler
             # + 417 engine + 61 fold-runner + 686 apps/web. (v3-D85, 2026-08-13)
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
