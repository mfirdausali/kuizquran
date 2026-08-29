<?php

/**
 * THE ONE PLACE PRICES ARE WRITTEN (edge case #196: "config constants in ONE
 * file + a test quoting v3-D07").
 *
 * v3-D07, verbatim:
 *
 *   "A limited free trial (one surah, or 14 days), then payment is required to
 *    continue.
 *      Monthly:  RM20 (Malaysian IP) · USD10 (international)
 *      Lifetime: RM500 (Malaysian IP) · USD200 (international)
 *    IP sets the default region; the learner can change it. The chosen region is
 *    stored on the account, not per session, so travelling never reprices anyone."
 *
 * `tests/Feature/Billing/PricingConstantsTest.php` asserts every number here and
 * quotes that decision text in its failure messages. `check-pricing.mjs` (web)
 * and the same test's second half assert no price is written ANYWHERE ELSE —
 * because a test over this file alone cannot catch a hardcoded "RM20" in a
 * template, and #196's "ONE file" requirement is otherwise unenforced.
 *
 * Amounts are in the currency's MINOR UNIT (sen / cents), integers only. Never
 * floats — a float price is a rounding bug waiting for a specific total.
 */
return [

    // Edge case #119: region affects FUTURE purchases only. A mid-subscription
    // region change never reprices an active subscription, and VPN arbitrage is
    // an accepted rounding error (v3-D07: "not a threat").
    'regions' => ['MY', 'INTL'],
    'default_region' => 'INTL',

    'MY' => [
        'currency' => 'MYR',
        'monthly' => 2000,    // RM20.00
        'lifetime' => 50000,  // RM500.00
    ],

    'INTL' => [
        'currency' => 'USD',
        'monthly' => 1000,    // USD10.00
        'lifetime' => 20000,  // USD200.00
    ],

    /*
     * Edge case #120: FPX cannot recur. Monthly in MY is CARD-ONLY at launch, and
     * the pricing copy must not claim otherwise. Entitlements themselves stay
     * rail-agnostic — this constrains the CHECKOUT surface, not the state machine.
     */
    'rails' => [
        'MY' => [
            'monthly' => ['card'],
            'lifetime' => ['card', 'fpx', 'grabpay'],
        ],
        'INTL' => [
            'monthly' => ['card'],
            'lifetime' => ['card'],
        ],
    ],

    // v3-D07: "a limited free trial (one surah, or 14 days)".
    'trial' => [
        'surahs' => 1,
        'days' => 14,
    ],

    /*
     * Offline entitlement TTL (M7 ships: "PaywallGate at session assembly with
     * offline entitlement TTL+grace").
     *
     * This is a STALENESS BOUND ON NEW GRANTS, never a kill switch. An expired
     * cache degrades locked content to review-only; it NEVER locks a learner out
     * of content they already own because their network failed. See
     * `EntitlementCache` on the web side.
     *
     * This value has NO Laravel-side reader — the TTL is enforced entirely
     * client-side (`apps/web/lib/entitlement/cache.ts#OFFLINE_TTL_MS`, a
     * separately-declared mirror; nothing crosses the wire for it, since the
     * server has no reason to know how long a client trusts its own cache).
     * `apps/web/lib/entitlement/cache-config-agreement.test.ts` reads this
     * file's raw text and asserts the two numbers agree, so a change here
     * without a matching change there fails loudly instead of silently.
     */
    'offline_ttl_days' => 7,
];
