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
        $allow = config('admin.emails', []);

        if (! $user || ! $user->hasVerifiedEmail()) {
            return response()->json(['error' => 'forbidden'], 403);
        }

        $email = strtolower(trim($user->email ?? ''));
        if ($email === '' || ! in_array($email, $allow, true)) {
            return response()->json(['error' => 'forbidden'], 403);
        }

        return $next($request);
    }
}
