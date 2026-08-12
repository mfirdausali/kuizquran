<?php

return [

    /*
     * BUILD-PLAN M7 names "PDPA export/delete/restore(-with-token)" but never
     * prices the grace window itself — Q10 (DECISIONS.md/BUILD-PLAN.md) asks
     * "full purge or anonymize-and-retain", not "how many days to undo it".
     *
     * 14 days is the ratified default (DECISIONS.md, this step): long enough
     * that a learner who deletes in anger or by mis-tap has a real week-plus
     * to reconsider and find the email/token, short enough that "indefinite"
     * (v3-D16's posture for a LAPSED account) is never confused with this —
     * a deletion request is the one thing in this product that is meant to
     * become irreversible.
     */
    'deletion_grace_days' => (int) env('PDPA_DELETION_GRACE_DAYS', 14),

];
