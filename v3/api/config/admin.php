<?php

return [

    // v2-D54 (inherited): comma-separated admin allowlist, mirrors v1's
    // ADMIN_EMAILS. Empty allowlist = nobody is admin (fail closed).
    'emails' => array_values(array_filter(array_map(
        fn ($e) => strtolower(trim($e)),
        explode(',', env('ADMIN_EMAILS', ''))
    ))),

];
