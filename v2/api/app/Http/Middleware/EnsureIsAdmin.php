<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * v2-D54: ports v1's `requireAdmin`/`isAdmin` (v1/apps/worker/src/middleware.ts)
 * onto the Sanctum bearer-token guard. Must run AFTER `auth:sanctum` (needs
 * $request->user()). Fails closed: an empty/unset ADMIN_EMAILS allowlist means
 * nobody is admin, never throws.
 */
class EnsureIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $email = $request->user()?->email;
        $allow = config('admin.emails', []);

        if (! $email || ! in_array(strtolower(trim($email)), $allow, true)) {
            return response()->json(['error' => 'forbidden'], 403);
        }

        return $next($request);
    }
}
