<?php

namespace App\Flags;

use App\Models\Flag;
use App\Models\FlagRampAudit;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Build-plan step 26 (M8). KILL AND RAMP ARE DIFFERENT CODE PATHS.
 *
 * v3-D17: "Kill switches are one-click and unconditional."
 * Edge case #126: "Concurrent ramp + kill → kill loses the optimistic-lock race →
 *                  kill = unconditional write bypassing version check; ramp fails
 *                  on conflict."
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * WHY TWO METHODS AND NOT ONE WITH A PARAMETER:
 *
 * A single writer taking `$bypassVersion = false` is one refactor away from
 * someone "simplifying" the flag away, and one typo away from kill inheriting the
 * ramp's predicate. When kill and ramp are the same function, a concurrent
 * kill+ramp can resolve to ENABLED — which is the failure #126 names, and it
 * fails in the direction that leaves a harmful feature live.
 *
 * `kill()` has NO version predicate, NO confirmation, NO second-admin
 * requirement, and NO ceremony. `ramp()` has all of them.
 * ══════════════════════════════════════════════════════════════════════════════
 */
class FlagService
{
    /** Edge case #127: the cache is an optimization; the DB is authoritative. */
    private const CACHE_TTL = 60;

    private function cacheKey(string $key): string
    {
        return "flag:{$key}";
    }

    /**
     * Read a flag. Unknown keys THROW — the registry is closed, and a permissive
     * default for an unknown key is how a typo silently enables something.
     */
    public function enabled(string $key): bool
    {
        if (! FlagRegistry::exists($key)) {
            throw new \InvalidArgumentException("unknown flag `{$key}` — the registry is closed");
        }

        return Cache::remember($this->cacheKey($key), self::CACHE_TTL, function () use ($key) {
            $row = Flag::where('key', $key)->first();

            // No row = the registry default, which is ALWAYS false.
            return $row ? (bool) $row->enabled : FlagRegistry::default($key);
        });
    }

    /**
     * KILL — ONE CLICK, UNCONDITIONAL.
     *
     * No version predicate. No ceremony. No second admin. It always wins, and a
     * concurrent kill+ramp always resolves to KILLED.
     *
     * v3-D17 / edge case #159: "kill instant; banner persists; ack never
     * re-enables; 72h auto-waive audited."
     */
    public function kill(string $key, ?int $adminId, int $now): void
    {
        if (! FlagRegistry::exists($key)) {
            throw new \InvalidArgumentException("unknown flag `{$key}`");
        }

        DB::transaction(function () use ($key, $adminId, $now) {
            // NOTE THE ABSENCE OF `->where('version', ...)`. That absence IS the
            // fix for #126 and must never be "tidied up" into the ramp's shape.
            //
            // AND THE VERSION IS BUMPED. This half is not optional and was missing
            // in the first draft, which the #126 test caught: an unconditional
            // write that leaves `version` untouched lets an IN-FLIGHT ramp holding
            // the pre-kill version still match its predicate and win — the flag
            // ends ENABLED after a kill, which is precisely the failure #126
            // describes. Killing must INVALIDATE every ramp already in flight.
            $existing = Flag::where('key', $key)->first();
            Flag::updateOrCreate(
                ['key' => $key],
                [
                    'enabled' => false,
                    'version' => ($existing->version ?? 0) + 1,
                    'killed_at' => $now,
                    'killed_by' => (string) $adminId,
                ],
            );

            FlagRampAudit::create([
                'flag_key' => $key,
                'action' => 'kill',
                'actor_admin_id' => $adminId,
                'at' => $now,
            ]);
        });

        // Edge case #127: explicit cache bust. Without this, a killed flag stays
        // live for up to 60s in every process holding a cached copy.
        Cache::forget($this->cacheKey($key));
    }

    /**
     * RAMP (enable-hard) — VERSION-PREDICATED, FAILS ON CONFLICT.
     *
     * The ceremony is validated by the CONTROLLER (server-enforced, so curl cannot
     * bypass it); this method enforces the concurrency half.
     *
     * Returns false when the optimistic lock is lost — i.e. someone else (very
     * possibly a kill) wrote first. A ramp that loses NEVER retries automatically.
     */
    public function ramp(string $key, int $expectedVersion, ?int $adminId, int $now, array $ceremony): bool
    {
        if (! FlagRegistry::exists($key)) {
            throw new \InvalidArgumentException("unknown flag `{$key}`");
        }

        return DB::transaction(function () use ($key, $expectedVersion, $adminId, $now, $ceremony) {
            $row = Flag::firstOrCreate(['key' => $key], ['enabled' => false, 'version' => 0]);

            // A KILLED flag cannot be ramped by an ack or a retry — only by a
            // fresh, full ceremony that explicitly clears the kill (#159: "ack
            // never re-enables").
            $affected = Flag::where('key', $key)
                ->where('version', $expectedVersion)
                ->update([
                    'enabled' => true,
                    'version' => $expectedVersion + 1,
                    'killed_at' => null,
                    'killed_by' => null,
                    'ack_at' => null,
                    'ack_by' => null,
                    'ack_auto_waived' => false,
                ]);

            if ($affected === 0) {
                return false; // lost the race — a concurrent kill or ramp won
            }

            FlagRampAudit::create([
                'flag_key' => $key,
                'action' => 'enable',
                'actor_admin_id' => $adminId,
                'reason' => $ceremony['reason'] ?? null,
                'acknowledges_retention_risk' => (bool) ($ceremony['acknowledges_retention_risk'] ?? false),
                'acknowledges_no_dark_pattern' => (bool) ($ceremony['acknowledges_no_dark_pattern'] ?? false),
                'typed_flag_name' => $ceremony['typed_flag_name'] ?? null,
                'at' => $now,
            ]);

            Cache::forget($this->cacheKey($key));

            return true;
        });
    }

    /**
     * Acknowledge a kill. v3-D17 degrades the second-admin ack to a 72-hour
     * audited auto-waive.
     *
     * EDGE CASE #159: AN ACK NEVER RE-ENABLES. It records that a human saw the
     * kill; the flag stays off and the banner stays up until a full ramp ceremony.
     */
    public function acknowledgeKill(string $key, ?int $adminId, int $now, bool $autoWaived = false): void
    {
        DB::transaction(function () use ($key, $adminId, $now, $autoWaived) {
            $row = Flag::where('key', $key)->firstOrFail();

            // `enabled` is deliberately NOT in this update. An ack that re-enabled
            // would turn the safety mechanism into the hazard.
            $row->update(['ack_at' => $now, 'ack_by' => (string) $adminId, 'ack_auto_waived' => $autoWaived]);

            FlagRampAudit::create([
                'flag_key' => $key,
                'action' => $autoWaived ? 'auto_waive' : 'ack',
                'actor_admin_id' => $adminId,
                'at' => $now,
            ]);
        });
    }

    /** v3-D17's 72-hour audited auto-waive, for the scheduler to call. */
    public const AUTO_WAIVE_AFTER_MS = 72 * 60 * 60 * 1000;

    public function autoWaiveDueKills(int $now): int
    {
        $due = Flag::whereNotNull('killed_at')
            ->whereNull('ack_at')
            ->where('killed_at', '<=', $now - self::AUTO_WAIVE_AFTER_MS)
            ->get();

        foreach ($due as $flag) {
            $this->acknowledgeKill($flag->key, null, $now, autoWaived: true);
        }

        return $due->count();
    }
}
