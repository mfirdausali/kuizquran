<?php

return [
    /*
     * Where the Node fold-runner lives, and how to execute a .ts entrypoint
     * in it. v3-D08: the fold-runner is the SOLE server-side fold, so
     * Laravel invokes it rather than re-implementing anything.
     *
     * `base_path()` here is v3/api, so the default resolves to
     * v3/worker/fold-runner. A deployed host that lays the tree out
     * differently overrides via NIGHTLY_FOLD_RUNNER_PATH rather than by
     * patching code.
     */
    'fold_runner_path' => env('NIGHTLY_FOLD_RUNNER_PATH', base_path('../worker/fold-runner')),

    'vite_node' => env(
        'NIGHTLY_VITE_NODE',
        base_path('../worker/fold-runner/node_modules/.bin/vite-node'),
    ),

    /*
     * The pinned engine version this deployment folds under — BUILD-PLAN's
     * "sole server-side fold, pinned engine version". Atom-cache rows
     * carrying a DIFFERENT version whose values diverge are WARN (skew);
     * rows carrying THIS version that diverge are P1.
     *
     * Bump it in the same deploy that changes engine semantics, or the
     * first post-deploy night pages a P1 for a difference that is really
     * just a stale cache.
     */
    'engine_version' => env('NIGHTLY_ENGINE_VERSION', 'v3-engine-0.1.0'),

    /*
     * UTC time the nightly runs. Fixed and explicit rather than "whenever
     * cron fires": the ledger counts UTC calendar nights, so a run that
     * drifts across midnight local time would land two runs in one UTC
     * night and none in the next — which the ledger correctly reports as a
     * GAP, i.e. a broken streak. Keeping the schedule in UTC keeps the two
     * definitions aligned.
     */
    'run_at_utc' => env('NIGHTLY_RUN_AT_UTC', '03:00'),

    /* How many learners the fold check samples per night. */
    'sample_size' => (int) env('NIGHTLY_SAMPLE_SIZE', 50),
];
