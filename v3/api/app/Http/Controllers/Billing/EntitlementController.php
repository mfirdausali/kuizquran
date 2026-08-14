<?php

namespace App\Http\Controllers\Billing;

use App\Http\Controllers\Controller;
use App\Models\Entitlement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * GET /api/entitlement — build-plan step 23 (M7). THE MISSING WIRE.
 *
 * `App\Billing\PaywallGate::permitsIssuance()` has existed, tested and
 * mutation-verified since 2026-08-10 — but nothing in the shipped product
 * ever called it, on either side. `check-boundaries.mjs` clause 9's own
 * comment names the reason: session assembly (`app/(app)/session/page.tsx`)
 * was "still a STUB at this step" when that clause was written, so an
 * allowlist entry for it would have been "an unreviewed hole waiting for the
 * real code". Step 18 (v3-D67) made the session page real; that comment was
 * never revisited, and `lib/entitlement/gate.ts`'s client-side mirror of
 * `PaywallGate` sat with zero callers because there was nowhere for it to
 * even fetch a snapshot FROM. This route is that source.
 *
 * SELF-SERVICE READ ONLY, scoped to `$request->user()->id` — same discipline
 * `AccountController` already established for PDPA export/delete. There is
 * no user-id route parameter to swap for another learner's paywall state.
 *
 * The "no entitlement row" branch mirrors `PaywallGate::permitsIssuance()`
 * exactly: a learner who has never been billed reads as `trial` with
 * `trialSurah: null` (the trial has not been consumed, so whichever surah
 * they open first is theirs) — never a bespoke "none" state the client-side
 * `EntitlementState` union does not even have a member for.
 */
class EntitlementController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $entitlement = Entitlement::where('user_id', $request->user()->id)->first();

        if (! $entitlement) {
            return response()->json([
                'state' => 'trial',
                'tier' => 'none',
                'region' => 'INTL',
                'trialSurah' => null,
            ]);
        }

        return response()->json([
            'state' => $entitlement->state->value,
            'tier' => $entitlement->tier->value,
            'region' => $entitlement->region,
            'trialSurah' => $entitlement->trial_surah,
        ]);
    }
}
