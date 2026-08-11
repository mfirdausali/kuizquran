<?php

namespace App\Http\Controllers\Admin;

use App\Flags\FlagRegistry;
use App\Flags\FlagService;
use App\Http\Controllers\Controller;
use App\Models\Flag;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Build-plan step 26 (M8). The flag plane's HTTP surface.
 *
 * BUILD-PLAN's ethics gate: "Enable-hard ceremony (reason >= 20 chars + two
 * ethics booleans + verbatim flag name, SERVER-ENFORCED); kill-easy (one click,
 * unconditional write...)".
 *
 * SERVER-ENFORCED means this controller validates all four. A ceremony enforced
 * only in the admin UI is bypassable with one curl command, which makes it
 * theatre rather than a gate.
 */
class FlagController extends Controller
{
    public function __construct(private readonly FlagService $flags) {}

    public function index(): JsonResponse
    {
        $rows = Flag::all()->keyBy('key');

        $out = [];
        foreach (FlagRegistry::keys() as $key) {
            $row = $rows->get($key);
            $out[] = [
                'key' => $key,
                'description' => FlagRegistry::description($key),
                'enabled' => $row ? (bool) $row->enabled : FlagRegistry::default($key),
                'version' => $row->version ?? 0,
                'killedAt' => $row->killed_at ?? null,
                'bannerVisible' => $row ? $row->bannerVisible() : false,
                'ackAt' => $row->ack_at ?? null,
                'ackAutoWaived' => (bool) ($row->ack_auto_waived ?? false),
            ];
        }

        return response()->json(['flags' => $out]);
    }

    /**
     * KILL — one click, unconditional.
     *
     * Deliberately requires NOTHING but the key: no reason, no confirmation, no
     * second admin, no version. Anything else is friction on the safety path, and
     * friction on the safety path is how a harmful feature stays live for an extra
     * ten minutes while someone hunts for the ceremony text.
     */
    public function kill(Request $request, string $key): JsonResponse
    {
        if (! FlagRegistry::exists($key)) {
            return response()->json(['error' => 'unknown flag'], 404);
        }

        $this->flags->kill($key, $request->user()?->id, (int) round(microtime(true) * 1000));

        return response()->json(['killed' => true, 'key' => $key]);
    }

    /**
     * ENABLE-HARD — the full ceremony, all four inputs, server-side.
     */
    public function enable(Request $request, string $key): JsonResponse
    {
        if (! FlagRegistry::exists($key)) {
            return response()->json(['error' => 'unknown flag'], 404);
        }

        $reason = trim((string) $request->input('reason', ''));
        $typedName = (string) $request->input('typed_flag_name', '');
        $retention = $request->boolean('acknowledges_retention_risk');
        $darkPattern = $request->boolean('acknowledges_no_dark_pattern');

        $errors = [];

        if (mb_strlen($reason) < 20) {
            $errors['reason'] = 'reason must be at least 20 characters';
        }

        // VERBATIM, not a substring and not case-insensitive. Typing "social" to
        // enable "social.leaderboard" is exactly the slip this guards against.
        if (! hash_equals($key, $typedName)) {
            $errors['typed_flag_name'] = "must exactly match the flag name `{$key}`";
        }

        // Named commitments, not a checkbox labelled "I agree" — an operator who
        // must assert these two specific things has read them.
        if (! $retention) {
            $errors['acknowledges_retention_risk'] = 'required';
        }
        if (! $darkPattern) {
            $errors['acknowledges_no_dark_pattern'] = 'required';
        }

        if ($errors !== []) {
            return response()->json(['error' => 'ceremony incomplete', 'errors' => $errors], 422);
        }

        // ══════════════════════════════════════════════════════════════════════
        // THE VERSION MUST COME FROM THE CLIENT (M10 security review).
        //
        // This previously defaulted to `$current->version` — the version READ
        // BACK from the database one line earlier. An omitted `version` therefore
        // compared the row against itself and could never conflict, which
        // silently converted the optimistic-concurrency check into a no-op for
        // any caller that left the field out. The 409 below became unreachable
        // by the exact path most likely to hit it: a hand-rolled curl, or a
        // console that forgot to round-trip the field.
        //
        // Edge case #126 is "kill = unconditional write; ramp fails on
        // conflict". `FlagService::ramp()` implements that faithfully and
        // `FlagPlaneTest` proves it AT THE SERVICE LEVEL — passing version 3
        // explicitly. Nothing tested the HTTP layer, which is where the default
        // lived, so a green suite coexisted with a ramp that could overwrite a
        // kill it never saw.
        //
        // Now: no version, no ramp. Enabling a flag is the ceremony path, where
        // one more required field is the correct trade against re-enabling a
        // feature another operator killed seconds ago.
        // ══════════════════════════════════════════════════════════════════════
        if (! $request->has('version')) {
            return response()->json([
                'error' => 'ceremony incomplete',
                'errors' => ['version' => 'required — the flag version you read, so a concurrent kill cannot be overwritten'],
            ], 422);
        }
        $expectedVersion = (int) $request->input('version');

        $ok = $this->flags->ramp($key, $expectedVersion, $request->user()?->id, (int) round(microtime(true) * 1000), [
            'reason' => $reason,
            'acknowledges_retention_risk' => $retention,
            'acknowledges_no_dark_pattern' => $darkPattern,
            'typed_flag_name' => $typedName,
        ]);

        if (! $ok) {
            // #126: the ramp fails on conflict. Very possibly a kill won.
            return response()->json(['error' => 'version conflict — the flag changed underneath you. Re-read and retry.'], 409);
        }

        return response()->json(['enabled' => true, 'key' => $key]);
    }

    /** Acknowledge a kill. Never re-enables (#159). */
    public function acknowledge(Request $request, string $key): JsonResponse
    {
        if (! Flag::where('key', $key)->exists()) {
            return response()->json(['error' => 'unknown flag'], 404);
        }

        $this->flags->acknowledgeKill($key, $request->user()?->id, (int) round(microtime(true) * 1000));

        $flag = Flag::where('key', $key)->first();

        return response()->json([
            'acknowledged' => true,
            'enabled' => (bool) $flag->enabled,
            'bannerVisible' => $flag->bannerVisible(),
        ]);
    }
}
