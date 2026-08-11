<?php

namespace App\Http\Controllers\Billing;

use App\Billing\StripeSignature;
use App\Billing\WebhookHandler;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Build-plan step 23. The webhook endpoint.
 *
 * Unauthenticated by design — Stripe carries no session. The SIGNATURE is the
 * authentication, verified against the RAW body before anything is parsed.
 * `$request->getContent()` (not `->all()`) because re-encoding the JSON changes
 * the bytes and the HMAC would never match.
 */
class StripeWebhookController extends Controller
{
    public function __construct(private readonly WebhookHandler $handler) {}

    public function __invoke(Request $request): JsonResponse
    {
        $secret = config('services.stripe.webhook_secret');
        if (! is_string($secret) || $secret === '') {
            // Fails CLOSED. An unconfigured secret must never mean "accept
            // everything" — that would make the endpoint a public state-machine
            // remote control.
            return response()->json(['error' => 'webhook not configured'], 503);
        }

        $payload = $request->getContent();
        $header = $request->header('Stripe-Signature', '');

        if (! StripeSignature::verify($payload, $header, $secret, time())) {
            return response()->json(['error' => 'invalid signature'], 400);
        }

        $event = json_decode($payload, true);
        if (! is_array($event)) {
            return response()->json(['error' => 'invalid payload'], 400);
        }

        $outcome = $this->handler->ingest($event);

        // 200 for every outcome INCLUDING duplicates and stale events — they are
        // correctly-handled cases, and a non-2xx makes Stripe retry forever.
        return response()->json(['outcome' => $outcome]);
    }
}
