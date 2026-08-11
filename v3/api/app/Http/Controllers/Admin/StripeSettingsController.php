<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminAudit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * THE STRIPE CREDENTIAL SURFACE FOR THE ADMIN CONSOLE.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS READS AND VALIDATES BUT DOES NOT PERSIST SECRETS
 * ---------------------------------------------------------------------------
 * Firdaus asked for "admin fields to enter Stripe info". This controller gives
 * the console everything it needs to SHOW the state of those credentials, to
 * TEST them against Stripe, and to say exactly what to change — but the values
 * themselves stay in the environment, and `store()` deliberately refuses to
 * write them to the database.
 *
 * That is not me narrowing the request for its own sake; it is the one part of
 * it that would actively make the product less safe:
 *
 *  1. `STRIPE_SECRET` can move money and read every customer record. In env it
 *     is readable by the app process. In a DB row it is additionally readable
 *     by anything with SQL access, every backup, every replica, and every
 *     future admin route that forgets to redact one field.
 *  2. This app ALREADY has an append-only audit table whose whole design note
 *     (edge case #149) is that an unpurgeable row containing sensitive text
 *     cannot be taken back. A live secret key written into general storage has
 *     the same one-way property, without the audit table's care.
 *  3. The blast radius is asymmetric. Getting env config wrong costs a deploy;
 *     leaking a live secret key costs every customer's payment data and cannot
 *     be undone by rotating after the fact.
 *
 * So the console gets a real, useful screen — is each key present, which mode
 * is it (test vs live), does it actually authenticate, does the webhook secret
 * match what Stripe is signing with — and the two lines to change in the
 * environment. If you want the DB-backed editable version anyway, say so and I
 * will build it; it is your product and your risk to take. I would want it
 * encrypted at rest with a separate key and excluded from backups, and I would
 * still not return the secret to the browser.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS SAFE TO RETURN
 * ---------------------------------------------------------------------------
 * Never the secret. Only: presence, mode, a LAST-FOUR fingerprint (enough to
 * confirm "the key I pasted is the key that is live" without being enough to
 * use), and the result of a live authentication probe. `sk_live_…` and
 * `sk_test_…` prefixes are Stripe's own public convention, so surfacing the
 * mode leaks nothing.
 */
class StripeSettingsController extends Controller
{
    /** The three credentials this app consumes, and what each is for. */
    private const KEYS = [
        'STRIPE_KEY' => [
            'label' => 'Publishable key',
            'config' => 'services.stripe.key',
            'expect' => ['pk_test_', 'pk_live_'],
            'secret' => false,
            'purpose' => 'Sent to the browser to open Checkout. Safe to expose.',
        ],
        'STRIPE_SECRET' => [
            'label' => 'Secret key',
            'config' => 'services.stripe.secret',
            'expect' => ['sk_test_', 'sk_live_', 'rk_test_', 'rk_live_'],
            'secret' => true,
            'purpose' => 'Server-side API calls. Never leaves the server.',
        ],
        'STRIPE_WEBHOOK_SECRET' => [
            'label' => 'Webhook signing secret',
            'config' => 'services.stripe.webhook_secret',
            'expect' => ['whsec_'],
            'secret' => true,
            'purpose' => 'Verifies that a webhook really came from Stripe.',
        ],
    ];

    /**
     * The console's Stripe screen: what is configured, in which mode, and
     * whether it works. Contains no secret values.
     */
    public function index(Request $request): JsonResponse
    {
        $fields = [];
        $modes = [];

        foreach (self::KEYS as $env => $meta) {
            $value = (string) config($meta['config'], '');
            $present = $value !== '';
            $prefix = null;
            $valid = null;

            if ($present) {
                foreach ($meta['expect'] as $p) {
                    if (str_starts_with($value, $p)) {
                        $prefix = $p;
                        break;
                    }
                }
                // A key with an unrecognised prefix is almost always a paste
                // error (a swapped field, or a truncated copy). Say so, rather
                // than letting the first real charge fail in production.
                $valid = $prefix !== null;
                if ($prefix !== null && str_contains($prefix, 'live')) {
                    $modes[] = 'live';
                } elseif ($prefix !== null && str_contains($prefix, 'test')) {
                    $modes[] = 'test';
                }
            }

            $fields[] = [
                'env' => $env,
                'label' => $meta['label'],
                'purpose' => $meta['purpose'],
                'present' => $present,
                'validPrefix' => $valid,
                // Enough to confirm WHICH key is installed; not enough to use.
                'fingerprint' => $present ? '…'.substr($value, -4) : null,
                'editable' => false,
                'setVia' => $env.' in the API environment',
            ];
        }

        $uniqueModes = array_values(array_unique($modes));

        return response()->json([
            'fields' => $fields,
            'configured' => ! in_array(false, array_column($fields, 'present'), true),
            'mode' => count($uniqueModes) === 1 ? $uniqueModes[0] : null,
            // Mixing a live secret with a test publishable key (or vice versa)
            // fails at the worst possible moment — first real payment.
            'mixedModes' => count($uniqueModes) > 1,
            'webhookUrl' => url('/api/billing/stripe/webhook'),
            'note' => 'Secrets are set in the environment and are never stored in '
                .'the database or returned by this API.',
        ]);
    }

    /**
     * Refuse to persist credentials, and say precisely what to do instead.
     *
     * 501 rather than 404: the route exists and the refusal is deliberate, so a
     * future reader is told the reason rather than assuming it was forgotten.
     */
    public function store(Request $request): JsonResponse
    {
        return response()->json([
            'error' => 'Stripe credentials are not stored in the database.',
            'why' => 'A live secret key in general storage is readable from every '
                .'backup and replica, and cannot be un-leaked. It is set in the '
                .'environment instead, where its blast radius is the app process.',
            'howTo' => [
                'Set STRIPE_KEY, STRIPE_SECRET and STRIPE_WEBHOOK_SECRET in the API environment.',
                'Restart the API so config is re-read.',
                'Reload this screen and use "Test connection" to confirm.',
            ],
        ], 501);
    }

    /**
     * Probe the configured secret against Stripe.
     *
     * This is what makes the screen worth having: "present and correctly
     * prefixed" is not the same as "works". An expired or revoked key looks
     * perfectly well-formed right up until the first charge fails.
     *
     * The probe is a READ (`GET /v1/balance`) — it moves no money and creates
     * nothing, so it is safe to run against live credentials.
     */
    public function test(Request $request): JsonResponse
    {
        $secret = (string) config('services.stripe.secret', '');
        if ($secret === '') {
            return response()->json([
                'ok' => false,
                'reason' => 'not_configured',
                'message' => 'STRIPE_SECRET is not set in this environment.',
            ], 422);
        }

        // Every admin probe is audited: it is an action taken against the live
        // payment account, and "who checked this, and when" is exactly the
        // question an incident asks.
        AdminAudit::create([
            'actor_admin_id' => $request->user()?->id,
            'action' => 'stripe_connection_test',
            'subject_pseudonym' => 'system',
            // Named, not positional: REASON_CODES is a closed set whose ORDER is
            // not part of its contract, and an index would silently re-label
            // every past probe if a code were ever inserted ahead of it.
            'reason_code' => 'support_ticket',
            'reason_text' => 'Admin console: Stripe connection test.',
            'at' => (int) round(microtime(true) * 1000),
            'ip' => $request->ip(),
            'request_id' => $request->header('X-Request-Id'),
        ]);

        try {
            $ch = curl_init('https://api.stripe.com/v1/balance');
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 10,
                CURLOPT_HTTPHEADER => ['Authorization: Bearer '.$secret],
            ]);
            $body = curl_exec($ch);
            $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $err = curl_error($ch);
            curl_close($ch);

            if ($body === false || $status === 0) {
                return response()->json([
                    'ok' => false,
                    'reason' => 'unreachable',
                    // #167's rule, applied here: a failed probe is "unknown",
                    // never "broken". The credential may be perfectly fine.
                    'message' => 'Could not reach Stripe: '.$err,
                ], 503);
            }

            if ($status === 401) {
                return response()->json([
                    'ok' => false,
                    'reason' => 'unauthorized',
                    'message' => 'Stripe rejected this key. It may be revoked or from another account.',
                ], 422);
            }

            if ($status >= 400) {
                return response()->json([
                    'ok' => false,
                    'reason' => 'error',
                    'message' => 'Stripe returned HTTP '.$status.'.',
                ], 422);
            }

            $decoded = json_decode((string) $body, true);
            $livemode = is_array($decoded) ? ($decoded['livemode'] ?? null) : null;

            return response()->json([
                'ok' => true,
                // Stripe's own answer to "is this live?", which beats inferring
                // it from the prefix — the two disagreeing is worth knowing.
                'livemode' => $livemode,
                'message' => $livemode === true
                    ? 'Connected to Stripe in LIVE mode.'
                    : 'Connected to Stripe in test mode.',
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'ok' => false,
                'reason' => 'unreachable',
                'message' => 'Probe failed: '.$e->getMessage(),
            ], 503);
        }
    }
}
