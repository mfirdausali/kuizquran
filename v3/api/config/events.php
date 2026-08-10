<?php

return [

    // Build-plan step 14 (M3 ships list): "cap log-only-then-enforced" — a
    // per-user daily ingest cap that today only LOGS when crossed
    // (EventsController::store). Enforcement (actually rejecting a batch)
    // is a future toggle, not built here — do not add a rejection path
    // without a corresponding decision entry.
    'daily_cap' => (int) env('EVENTS_DAILY_CAP', 2000),

    // Pull protocol page size (EventsController::index).
    'pull_default_limit' => (int) env('EVENTS_PULL_DEFAULT_LIMIT', 500),
    'pull_max_limit' => (int) env('EVENTS_PULL_MAX_LIMIT', 1000),

];
