<?php

namespace App\Billing;

/**
 * Stripe webhook signature verification — the real thing, offline.
 *
 * v3-D56: this needs NO Stripe account and NO network. Stripe's scheme is
 * HMAC-SHA256 over `"{timestamp}.{raw body}"` with a shared endpoint secret, and
 * the `Stripe-Signature` header carries `t=` plus one or more `v1=` signatures.
 * Tests SIGN fixtures with a test secret and verify them, so this class is fully
 * exercised without a live account — it is the one part of the Stripe integration
 * that is genuinely complete today.
 *
 * Re-implemented rather than pulled from the SDK deliberately: Cashier is not yet
 * installed (that needs the live account decision), and this is ~20 lines of
 * well-specified HMAC. When Cashier lands, replace this with
 * `Webhook::constructEvent` and keep the tests.
 */
class StripeSignature
{
    /**
     * @param  string  $payload  the RAW request body, byte-for-byte
     * @param  int  $tolerance  seconds; rejects replayed old signatures
     */
    public static function verify(string $payload, string $header, string $secret, int $now, int $tolerance = 300): bool
    {
        if ($secret === '' || $header === '') {
            return false;
        }

        $timestamp = null;
        $signatures = [];
        foreach (explode(',', $header) as $part) {
            $kv = explode('=', trim($part), 2);
            if (count($kv) !== 2) {
                continue;
            }
            [$k, $v] = $kv;
            if ($k === 't') {
                $timestamp = (int) $v;
            } elseif ($k === 'v1') {
                $signatures[] = $v;
            }
        }

        if ($timestamp === null || $signatures === []) {
            return false;
        }

        // Replay window. A captured webhook re-POSTed a week later must not pass.
        if ($tolerance > 0 && abs($now - $timestamp) > $tolerance) {
            return false;
        }

        $expected = hash_hmac('sha256', "{$timestamp}.{$payload}", $secret);

        foreach ($signatures as $candidate) {
            // hash_equals, never `===` — a timing-variable compare on a signature
            // is a genuine oracle.
            if (hash_equals($expected, $candidate)) {
                return true;
            }
        }

        return false;
    }

    /** Test helper: produce a header the way Stripe would. Used only by tests. */
    public static function sign(string $payload, string $secret, int $timestamp): string
    {
        $sig = hash_hmac('sha256', "{$timestamp}.{$payload}", $secret);

        return "t={$timestamp},v1={$sig}";
    }
}
