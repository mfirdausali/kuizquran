<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EventsController;
use App\Http\Controllers\OverridesController;
use App\Http\Controllers\SettingsController;
use Illuminate\Support\Facades\Route;

// v2-D03/D18/ROADMAP Phase 5. Bearer-token (Sanctum personal access token) auth
// throughout — no origin-check middleware needed the way v1's cookie session
// required (a bearer token is never auto-attached by the browser, so there's no
// CSRF surface to guard against on these routes).

Route::post('/auth/anonymous', [AuthController::class, 'anonymous']);
Route::post('/auth/login', [AuthController::class, 'login']);

// v2-D21/D55: public read of the question-bank override layer — every client
// (including an anonymous device) must resolve overrides at question-build
// time, so this is NOT behind auth:sanctum. Writes are admin-only, below.
Route::get('/overrides', [OverridesController::class, 'index']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::get('/settings', [SettingsController::class, 'show']);
    Route::post('/settings', [SettingsController::class, 'update']);

    Route::post('/events', [EventsController::class, 'store']);
    Route::get('/events', [EventsController::class, 'index']);
    Route::get('/events/count', [EventsController::class, 'count']);

    // v2-D54/ROADMAP Phase 6: operator admin console + qari override editor.
    // ADMIN_EMAILS-allowlist gated (fails closed); read-only metrics plus two
    // explicit operator write actions (mark-verified, create-override).
    Route::middleware('admin')->prefix('admin')->group(function () {
        Route::get('/metrics', [AdminController::class, 'metrics']);
        Route::get('/users', [AdminController::class, 'users']);
        Route::get('/users/{id}', [AdminController::class, 'user']);
        Route::get('/frontier', [AdminController::class, 'frontier']);
        Route::get('/verifications', [AdminController::class, 'verifications']);
        Route::post('/verifications', [AdminController::class, 'verify']);
        Route::post('/overrides', [AdminController::class, 'createOverride']);
    });
});
