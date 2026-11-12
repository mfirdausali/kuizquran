<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * DEFECTS.md#B7 fix: v2's EnsureIsAdmin trusted `$request->user()->email`
 * with no ownership proof, so anyone who knew an ADMIN_EMAILS address could
 * register it and become admin before the real admin ever signed in. Here,
 * an unverified email can never pass — closing the race entirely, not just
 * narrowing it.
 *
 * Must run after `auth:sanctum` (needs $request->user()). Fails closed: an
 * empty/unset ADMIN_EMAILS allowlist means nobody is admin, never throws.
 */
class EnsureIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // v3-D403: the allowlist+verified-email test itself now lives on
        // User::isAdmin() so OverridesController/VerificationsController can
        // ask the identical question on their public GET routes without a
        // second, driftable copy of this logic.
        if (! $user || ! $user->isAdmin()) {
            return response()->json(['error' => 'forbidden'], 403);
        }

        return $next($request);
    }
}
