<?php

use App\Http\Controllers\Auth\EmailVerificationController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EventsController;
use App\Http\Controllers\OverridesController;
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

    // Build-plan step 15: override write path (DEFECTS.md#B1's own gate).
    Route::post('/overrides', [OverridesController::class, 'store'])->middleware('admin');
});
