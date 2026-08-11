<?php

return [

    // v2-D54 (inherited): comma-separated admin allowlist, mirrors v1's
    // ADMIN_EMAILS. Empty allowlist = nobody is admin (fail closed).
    'emails' => array_values(array_filter(array_map(
        fn ($e) => strtolower(trim($e)),
        explode(',', env('ADMIN_EMAILS', ''))
    ))),

    // Build-plan step 24 (M8). Server-side pepper for learner pseudonyms
    // (WIREFRAME §16's `u_7f3a…`). MUST be set in every environment — an unset
    // pepper makes pseudonyms reversible by brute force over small integer user
    // ids, so `Pseudonymizer` throws rather than degrading silently.
    'pseudonym_pepper' => env('ADMIN_PSEUDONYM_PEPPER', ''),

    // WIREFRAME §16: "auto-re-masking after 15 minutes". The TTL is enforced
    // SERVER-SIDE (edge case #147) — a client-side timer is a suggestion.
    'reveal_ttl_seconds' => (int) env('ADMIN_REVEAL_TTL', 900),

];
