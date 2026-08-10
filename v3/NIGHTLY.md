# Nightly agent brief

The scheduled cloud agent reads this file every run. It starts with **zero
context** — everything it needs is here or linked from here.

## Read first, in order

1. `v3/CLAUDE.md` — the rules. Non-negotiable.
2. `v3/INVARIANTS.md` — 6 invariants + purity + sacred-text. A change that breaks
   one is wrong, however well it satisfies the task.
3. `v3/DECISIONS.md` — v3-D08…D24. **Every open question already has a ratified
   default. Never block waiting for a human.**
4. `v3/DEFECTS.md` — B1–B9, E-01…E-08, each with its owning milestone.
5. `v3/docs/BUILD-PLAN.md` — the 32-step order and milestones M0…M11. **Sole
   authority on sequencing.**

## The job, each run

Work the **next incomplete step** of the 32-step corrected build order, end to
end. Determine what is done by reading the repo and `git log` — never by
guessing.

**Phase 0 is COMPLETE** as of `283dab8` (harness + foundation docs).

Do **one step per run**, fully, rather than starting several.

## Absolute rules

Violating any of these makes the run worthless:

- **Never edit `v1/**` or `v2/**`.** Frozen. v2 is the read-only port source;
  its parity SHA is `c34f5c3`. v3 is a new generation, not a migration.
- **Never write Quranic Arabic** — not in code, tests, or fixtures. Tests
  reference fixture *coordinates*. Arabic comes only from the compiled corpus.
- **Never regenerate a golden log, oracle, fixture or snapshot to make your own
  tests pass.** That is self-grading. If an oracle legitimately needs
  regenerating, STOP, commit what you have, and say so in the report — a human
  approves that.
- **E-01 surah-keying must land before any second-surah artifact exists**
  (corpus, fixture, enrollment, event). Afterwards the atom merge is
  unrepairable.
- **RED before green.** Commit failing tests and observe them fail before
  implementing.

## Distractors — decided

Distractors are **derived algorithmically**, not authored. The v1 compiler
ingests 8,885 LLM-authored rows from `data/yusuf-mcq-items.json`; scaling that to
43 surahs would mean ~56,555 authored entries.

Instead, implement **foil kernels** that compute distractors from corpus data.
The four authored types map onto computable strategies, measured on Yusuf:

| Authored type | Count | Kernel |
|---|---|---|
| visual | 3,348 | orthographic neighbour (1,008 distinct stripped forms) |
| semantic | 2,314 | same-root (169 roots with 2+ surface forms) + nearest-gloss |
| contextual | 2,021 | other words in the same surah |
| phonetic | 1,197 | rhyme / skeleton match |

Yusuf's authored distractors stay as an override layer where they exist. Kernels
are the baseline everywhere else.

## Working method

1. Identify the next step from `BUILD-PLAN.md` and `git log`.
2. Write failing tests first; observe them fail.
3. Implement the minimum that makes them pass.
4. Run the gates: `make build`, `make test` (v2's 255 vitest + v3's growing
   vitest suite — 23 as of build-plan step 3's corpus-compiler port — + 47
   PHPUnit must all stay green), plus any step-specific check.
5. Commit with a message naming the step and what was verified.
6. Push to `main`.

**Continue through failures.** If a gate fails, diagnose and fix it in the same
run rather than stopping — but never by weakening the gate, deleting a test, or
regenerating an oracle. If you genuinely cannot fix it, commit the work in
progress on a branch, do not push to `main`, and report what blocked.

## The report

End every run with:

- Which step you worked and whether it completed
- What you verified, with real numbers (test counts, not "tests pass")
- What you changed, by file
- Anything that blocked, and what a human must decide
- What the next run should pick up

Be honest about partial work. A truthful "step 5 half done, engine port green but
E-01 not started" is far more useful than a claim of completion.
