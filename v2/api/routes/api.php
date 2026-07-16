<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\EventsController;
use App\Http\Controllers\SettingsController;
use Illuminate\Support\Facades\Route;

// v2-D03/D18/ROADMAP Phase 5. Bearer-token (Sanctum personal access token) auth
// throughout — no origin-check middleware needed the way v1's cookie session
// required (a bearer token is never auto-attached by the browser, so there's no
// CSRF surface to guard against on these routes).

Route::post('/auth/anonymous', [AuthController::class, 'anonymous']);
Route::post('/auth/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::get('/settings', [SettingsController::class, 'show']);
    Route::post('/settings', [SettingsController::class, 'update']);

    Route::post('/events', [EventsController::class, 'store']);
    Route::get('/events', [EventsController::class, 'index']);
    Route::get('/events/count', [EventsController::class, 'count']);
});
