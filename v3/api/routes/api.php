<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\Auth\EmailVerificationController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\Admin\AdminAuditController;
use App\Http\Controllers\Admin\AdminAuthController;
use App\Http\Controllers\Admin\AdminRevealController;
use App\Http\Controllers\Admin\AdminUsersController;
use App\Http\Controllers\Admin\FlagAuditController;
use App\Http\Controllers\Admin\FlagController;
use App\Http\Controllers\Admin\StripeSettingsController;
use App\Http\Controllers\Admin\SystemHealthController;
use App\Http\Controllers\Billing\EntitlementController;
use App\Http\Controllers\Billing\StripeWebhookController;
use App\Http\Controllers\ContentFreezeController;
use App\Http\Controllers\EventsController;
use App\Http\Controllers\GlossDraftsController;
use App\Http\Controllers\OverridesController;
use App\Http\Controllers\SpecsController;
use App\Http\Controllers\VerificationsController;
use Illuminate\Support\Facades\Route;

// v2-D03 (inherited)/v2-D18/step 13. Bearer-token (Sanctum personal access
// token) auth throughout — no origin-check middleware needed the way a
// cookie session would (a bearer token is never auto-attached by the
// browser, so there's no CSRF surface to guard against on these routes).

Route::post('/auth/anonymous', [AuthController::class, 'anonymous']);
Route::post('/auth/login', [AuthController::class, 'login']);

Route::post('/forgot-password', [PasswordResetController::class, 'sendResetLink'])
    ->middleware('throttle:6,1');
Route::post('/reset-password', [PasswordResetController::class, 'reset'])
    ->middleware('throttle:6,1');

// Build-plan step 15: public read (v2-D21/D55 — every client needs these
// to build correct questions, including an anonymous device).
Route::get('/overrides', [OverridesController::class, 'index']);
// Public read (GATE-A frontier — the admin console's not-yet-built worklist
// view and any future public transparency page both need this un-gated).
Route::get('/verifications', [VerificationsController::class, 'index']);
// Public read (build-plan step 16's question compiler consumes this).
Route::get('/specs', [SpecsController::class, 'index']);

// Build-plan step 23 (M7). UNAUTHENTICATED BY DESIGN — Stripe carries no session.
// The HMAC signature over the raw body IS the authentication, and an unconfigured
// signing secret fails CLOSED with a 503 rather than accepting anything.
Route::post('/billing/stripe/webhook', StripeWebhookController::class);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::get('/email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
        ->middleware(['signed', 'throttle:6,1'])
        ->name('verification.verify');
    Route::post('/email/verification-notification', [EmailVerificationController::class, 'resend'])
        ->middleware('throttle:6,1');

    // Build-plan step 14: ingestion + cursored pull.
    Route::post('/events', [EventsController::class, 'store']);
    Route::get('/events', [EventsController::class, 'index']);

    // Build-plan step 23 (M7): PDPA export/delete/restore(-with-token).
    // SELF-SERVICE ONLY — scoped to $request->user() throughout, never a
    // route parameter, so there is no id to swap for another learner's.
    Route::get('/account/export', [AccountController::class, 'export']);
    Route::get('/account/deletion', [AccountController::class, 'deletionStatus']);
    Route::post('/account/deletion', [AccountController::class, 'requestDeletion']);
    Route::post('/account/deletion/restore', [AccountController::class, 'restoreDeletion']);

    // Build-plan step 23 (M7): the client's only source for its own
    // entitlement snapshot — see EntitlementController's docblock for why
    // this was the missing wire, not the PaywallGate class itself.
    Route::get('/entitlement', [EntitlementController::class, 'show']);

    // Build-plan step 15: override write path (DEFECTS.md#B1's own gate).
    Route::post('/overrides', [OverridesController::class, 'store'])->middleware('admin');

    // Build-plan step 15: verification write path (DEFECTS.md#B3 / v3-D22).
    Route::post('/verifications', [VerificationsController::class, 'store'])->middleware('admin');

    // Build-plan step 15: spec write path (v3-D33).
    Route::post('/specs', [SpecsController::class, 'store'])->middleware('admin');

    // ---- Build-plan steps 24 & 26 (M8): the admin console. ----
    // Every route behind BOTH gates: `admin` (the env allowlist — the OUTER gate,
    // whose break-glass is an env fix + restart, per edge case #146) and Sanctum.
    Route::middleware('admin')->prefix('admin')->group(function () {
        // The client-side admin gate's own check (DECISIONS.md — named
        // unbuilt since v3-D92, closed here): "is THIS token actually
        // admin?", answered by the real gate, not a client-invented flag.
        Route::get('/whoami', [AdminAuthController::class, 'whoami']);

        // Privacy / reveal (WIREFRAME §16, edge cases #147/#148).
        Route::post('/users/{userId}/reveal', [AdminRevealController::class, 'reveal']);
        Route::get('/reveal/{token}', [AdminRevealController::class, 'check']);
        Route::get('/users/export.csv', [AdminUsersController::class, 'exportCsv']);

        // The audit viewer (BUILD-PLAN M8's own "nav homes for ... audit
        // viewer"). Read-only — see AdminAuditController's own header.
        Route::get('/audit', [AdminAuditController::class, 'index']);

        // System Health (step 24). #167: a failed probe renders `unknown`,
        // never 0 — the console must distinguish "healthy" from "blind".
        Route::get('/health', [SystemHealthController::class, 'index']);
        // The ONLY mutating action on this surface. It RE-DERIVES from the event
        // log and never invents (WIREFRAME §16: staff may never edit graded state).
        Route::post('/health/rebuild-atom-cache', [SystemHealthController::class, 'rebuildAtomCache']);

        // Flag plane (step 26). KILL is deliberately the lightest route here.
        Route::get('/flags', [FlagController::class, 'index']);
        Route::post('/flags/{key}/kill', [FlagController::class, 'kill']);
        Route::post('/flags/{key}/enable', [FlagController::class, 'enable']);
        Route::post('/flags/{key}/ack', [FlagController::class, 'acknowledge']);

        // The flag ramp audit viewer (BUILD-PLAN M8's own "nav homes for
        // ... audit viewer", the FlagRampAudit half v3-D125 deferred and
        // v3-D130 closed). Read-only — see FlagAuditController's own header.
        // Registered AFTER the {key} routes above so a literal "audit" path
        // segment can never be captured by {key}'s wildcard.
        Route::get('/flags/audit', [FlagAuditController::class, 'index']);

        // ---- Build-plan step 27 (M9): the MS gloss authoring surface. ----
        // ADMIN-ONLY EVEN FOR READS, unlike /verifications (which is a public
        // read because the verified frontier is a transparency fact). These
        // rows are UNREVIEWED, NON-SHIPPING drafts of religious translation;
        // a public read of them is exactly the "app appears to publish an
        // unreviewed Malay gloss" failure v3-D15 exists to prevent.
        //
        // The table ships EMPTY (see the migration): BUILD-PLAN allows agents
        // to draft into a flagged non-shipping table only with Firdaus's
        // ratification, and none is recorded in DECISIONS.md.
        Route::get('/gloss-drafts', [GlossDraftsController::class, 'index']);
        Route::post('/gloss-drafts', [GlossDraftsController::class, 'store']);
        Route::post('/gloss-drafts/{id}/review', [GlossDraftsController::class, 'review']);

        // Stripe credentials (step 23's operational half). READ + PROBE only:
        // `index` reports presence/mode/fingerprint and never a secret value,
        // `test` authenticates against Stripe with a read-only balance call,
        // and `store` refuses on purpose (501, with the reason) because a live
        // secret key in the database is readable from every backup and replica
        // and cannot be un-leaked. See the controller header.
        Route::get('/stripe', [StripeSettingsController::class, 'index']);
        Route::post('/stripe', [StripeSettingsController::class, 'store']);
        Route::post('/stripe/test', [StripeSettingsController::class, 'test']);

        // Build-plan step 28 (M9): the content-freeze gate, read as JSON by
        // /settings/content-freeze so "is this corpus bookable for a qari
        // session" is answered on a screen, not only in a terminal.
        Route::get('/content-freeze', [ContentFreezeController::class, 'index']);
    });
});

// Admin login is OUTSIDE the sanctum group — it MINTS the token.
// Fails closed with one generic error for all four failure cases (WIREFRAME §16).
Route::post('/admin/login', [AdminAuthController::class, 'login'])->middleware('throttle:10,1');
