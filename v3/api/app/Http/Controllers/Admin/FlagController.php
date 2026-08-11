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

        $current = Flag::where('key', $key)->first();
        $expectedVersion = (int) $request->input('version', $current->version ?? 0);

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
