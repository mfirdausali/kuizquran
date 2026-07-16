# v2/RUNNING.md — the autonomous build loop

How the v2 build runs itself to completion in GitHub's cloud — **no local machine, no
babysitting** (operator-chosen: fully autonomous, merge-everything). Logged as **v2-D27**.

## The loop (what happens)

```
 ┌─ workflow_dispatch "start"  OR  a phase PR merges  OR  hourly cron ─┐
 │                                                                     │
 ▼                                                                     │
 v2-autobuild.yml reads v2/.build-state → next phase N                 │
 │                                                                     │
 ▼                                                                     │
 opens an issue "@claude execute Phase N …"                            │
 │                                                                     │
 ▼                                                                     │
 claude.yml (Claude GitHub app) builds Phase N → opens a PR            │
 │  (PR title starts "v2 Phase N:", appends last_completed=N           │
 │   to v2/.build-state)                                               │
 ▼                                                                     │
 ci.yml runs (build + vitest + php artisan test) ── green? ──▶ auto-merge ─┘
                                                     └─ red ──▶ stalls here (safe)
```

- **ci.yml is the gate.** Auto-merge only fires when CI is green — the one thing keeping
  "merge everything" from merging *broken* everything.
- **Wait-on-limit is automatic.** If a run stalls (usage limit, timeout), the hourly cron
  re-pokes the current phase; it resumes when the limit resets.
- **Safe failure = a stall, not corruption.** A phase whose CI keeps failing never merges;
  the loop parks on it. You'll see "no progress" rather than a broken main.

## One-time setup (you must do these — cannot be scripted)

1. **Add the API key secret:** repo → **Settings → Secrets and variables → Actions →
   New repository secret** → name `ANTHROPIC_API_KEY`, paste your key.
   *(This is real API spend — a 7-phase autonomous build can be substantial.)*
2. **Actions permissions:** Settings → **Actions → General** →
   - Workflow permissions: **Read and write**.
   - Check **Allow GitHub Actions to create and approve pull requests**.
3. **Enable auto-merge:** Settings → **General → Pull Requests** → check **Allow auto-merge**.
4. **(Recommended) Branch protection on `main`:** require the **CI** status check to pass
   before merge — this makes the CI gate real (auto-merge waits for it).
5. Ensure the **Claude GitHub app** is installed on this repo (it is — you did this).

## Start / stop / resume

- **Start:** Actions → **v2 Autobuild (orchestrator)** → **Run workflow** (leave
  `start_phase` blank to begin from the state file, which is `-1` → Phase 0).
- **Watch:** the **Actions** tab (runs), **Pull requests** (one per phase, auto-merging),
  and **Issues** (the `@claude execute Phase N` requests + the final "build complete").
- **Resume a specific phase:** Run workflow with `start_phase` = N.
- **Pause:** disable the **v2 Autobuild** workflow (Actions → ⋯ → Disable workflow), or
  remove `ANTHROPIC_API_KEY`. Re-enable to continue.
- **Stop condition:** when phase advances past `LAST_PHASE` (7), it opens a
  **"🎉 v2 build complete"** issue and halts.

## Honest expectations

- **Review happens at the END, by you.** The loop yields a *candidate* v2, not a
  guarantee. When you see "build complete," the first job is to read the diff and run it
  locally before trusting it — autonomy can drift across phases even with CI green.
- **CI green ≠ vision-correct.** Tests gate *correctness of code*, not *fidelity to what
  you wanted*. The human judgment that caught earlier design errors is deliberately
  traded away here for hands-off speed; that's the accepted tradeoff.
- **Phase 0 has weak gating** (scaffolding, few tests) — its merge leans on "does it
  build". Real test-gating kicks in from Phase 1.

## Note on the current `v2/` layout

The cloud session already committed the **System Explorer** app (v2-D26) at the `v2/`
root (`iman-v2-web`, vis-network). The roadmap's Phase 0 expects `v2/web`, `v2/api`,
`v2/engine` subdirs. Phase 0's builder should reconcile this (e.g. move the explorer to
`v2/web/src/pages/` or keep it as a tool) — flagged so it isn't a surprise. CI is written
to tolerate whatever JS/PHP projects actually exist under `v2/`.
