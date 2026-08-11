<?php

namespace Tests\Feature\Flags;

use App\Flags\FlagRegistry;
use App\Flags\FlagService;
use App\Models\Flag;
use App\Models\FlagRampAudit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Build-plan step 26 (M8). THE FLAG PLANE.
 *
 * Each test names the mutation it must survive; each was applied on disk and
 * observed RED before this file was reported as covering anything.
 */
class FlagPlaneTest extends TestCase
{
    use RefreshDatabase;

    private function flags(): FlagService
    {
        return app(FlagService::class);
    }

    private function admin(): User
    {
        $user = User::factory()->create(['email' => 'ops@example.com', 'email_verified_at' => now()]);
        config(['admin.emails' => ['ops@example.com']]);
        Sanctum::actingAs($user);

        return $user;
    }

    // ═══════════════════════════ ALL FLAGS OFF ═════════════════════════════════

    /**
     * "flag plane, all OFF."
     *
     * ITERATES THE WHOLE REGISTRY. A spot-check of three remembered flags stays
     * green when a fourth is added enabled — enumeration is what makes this real.
     *
     * MUTATION: default any one flag to `true` in FlagRegistry::FLAGS.
     */
    public function test_every_flag_in_the_registry_defaults_to_off(): void
    {
        $this->assertNotEmpty(FlagRegistry::keys(), 'an empty registry would make this test vacuous');

        foreach (FlagRegistry::keys() as $key) {
            $this->assertFalse(FlagRegistry::default($key), "flag `{$key}` must default to OFF");
            $this->assertFalse($this->flags()->enabled($key), "flag `{$key}` must evaluate to OFF in a clean environment");
        }
    }

    /** Every social flag exists BEFORE any social code (step 26 precedes M11). */
    public function test_the_social_flags_exist_before_any_social_code(): void
    {
        foreach (['social.friends', 'social.leaderboard', 'social.streak_sharing'] as $key) {
            $this->assertTrue(FlagRegistry::exists($key));
            $this->assertFalse($this->flags()->enabled($key));
        }
    }

    /** The registry is CLOSED — an unknown key throws, never defaults permissive. */
    public function test_an_unknown_flag_throws_rather_than_defaulting_open(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->flags()->enabled('social.not_a_real_flag');
    }

    // ═══════════════════ #126 — KILL WINS THE RACE, ALWAYS ═════════════════════

    /**
     * EDGE CASE #126: "kill = unconditional write bypassing version check; ramp
     * fails on conflict."
     *
     * MUTATION: give `FlagService::kill()` the ramp's `->where('version', ...)`
     * predicate. The kill then loses the race and the flag stays ENABLED — the
     * failure that leaves a harmful feature live.
     */
    public function test_a_concurrent_kill_and_ramp_always_resolves_to_killed(): void
    {
        $admin = $this->admin();
        $key = 'social.leaderboard';
        $now = 1_700_000_000_000;

        // The flag is live at version 3.
        Flag::create(['key' => $key, 'enabled' => true, 'version' => 3]);

        // A ramp is in flight holding version 3. A kill lands FIRST.
        $this->flags()->kill($key, $admin->id, $now);

        // The in-flight ramp now tries to commit against its stale version.
        $rampWon = $this->flags()->ramp($key, 3, $admin->id, $now + 1, [
            'reason' => 'a perfectly good reason of sufficient length',
            'acknowledges_retention_risk' => true,
            'acknowledges_no_dark_pattern' => true,
            'typed_flag_name' => $key,
        ]);

        $this->assertFalse($rampWon, 'the ramp must LOSE to a kill');
        $this->assertFalse($this->flags()->enabled($key), '#126: a concurrent kill+ramp always resolves to KILLED');
    }

    /**
     * Kill is UNCONDITIONAL — it works against any version, with no ceremony.
     *
     * MUTATION: add a second-admin requirement, or a version predicate, to kill.
     */
    public function test_kill_is_unconditional_and_requires_no_ceremony(): void
    {
        $admin = $this->admin();
        $key = 'social.friends';
        Flag::create(['key' => $key, 'enabled' => true, 'version' => 99]);

        // No reason, no booleans, no typed name, no version — just the key.
        $response = $this->postJson("/api/admin/flags/{$key}/kill");

        $response->assertOk();
        $this->assertFalse($this->flags()->enabled($key));
        $this->assertNotNull(Flag::where('key', $key)->first()->killed_at);
    }

    /** Edge case #127: an explicit cache bust, so a killed flag dies immediately. */
    public function test_kill_busts_the_cache_immediately(): void
    {
        $admin = $this->admin();
        $key = 'notifications.push';
        Flag::create(['key' => $key, 'enabled' => true, 'version' => 1]);

        $this->assertTrue($this->flags()->enabled($key)); // now cached as TRUE
        $this->flags()->kill($key, $admin->id, 1_700_000_000_000);

        $this->assertFalse($this->flags()->enabled($key), '#127: a stale cache must not keep a killed flag alive');
    }

    // ═════════════ the enable-hard ceremony, SERVER-ENFORCED ═══════════════════

    /**
     * MUTATION: move the >=20-char reason check to the client (i.e. delete it
     * here). This test POSTs directly with a 5-char reason and expects 422.
     */
    public function test_the_ceremony_is_enforced_server_side_not_in_the_ui(): void
    {
        $this->admin();
        $key = 'experiments.scheduler_v2';

        $response = $this->postJson("/api/admin/flags/{$key}/enable", [
            'reason' => 'short',
            'typed_flag_name' => $key,
            'acknowledges_retention_risk' => true,
            'acknowledges_no_dark_pattern' => true,
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.reason', 'reason must be at least 20 characters');
        $this->assertFalse($this->flags()->enabled($key));
    }

    /**
     * MUTATION: change the verbatim flag-name check to a substring or
     * case-insensitive match. Typing "social" to enable "social.leaderboard" is
     * exactly the slip this guards against.
     */
    public function test_the_typed_flag_name_must_match_verbatim(): void
    {
        $this->admin();
        $key = 'social.leaderboard';

        // NOTE: a TRAILING-SPACE variant is deliberately NOT tested here.
        // Laravel's global `TrimStrings` middleware strips it before this
        // controller ever runs, so `'social.leaderboard '` arrives byte-identical
        // to the real key and correctly succeeds. Asserting a 422 for it would be
        // asserting behaviour the framework makes impossible — a test that can
        // only be made green by defeating the framework is a test about the wrong
        // thing. The cases below are the ones a human actually mistypes.
        foreach (['social', 'Social.Leaderboard', 'social.leaderboards', 'leaderboard'] as $wrong) {
            $response = $this->postJson("/api/admin/flags/{$key}/enable", [
                'reason' => 'ramping the leaderboard for a considered reason',
                'typed_flag_name' => $wrong,
                'acknowledges_retention_risk' => true,
                'acknowledges_no_dark_pattern' => true,
            ]);
            $response->assertStatus(422);
            $this->assertFalse($this->flags()->enabled($key), "`{$wrong}` must not satisfy the verbatim check");
        }
    }

    /** Both ethics booleans are required, individually. */
    public function test_both_ethics_booleans_are_required(): void
    {
        $this->admin();
        $key = 'experiments.new_onboarding';

        foreach ([
            ['acknowledges_retention_risk' => false, 'acknowledges_no_dark_pattern' => true],
            ['acknowledges_retention_risk' => true, 'acknowledges_no_dark_pattern' => false],
        ] as $combo) {
            $response = $this->postJson("/api/admin/flags/{$key}/enable", array_merge([
                'reason' => 'a sufficiently long and considered reason here',
                'typed_flag_name' => $key,
            ], $combo));
            $response->assertStatus(422);
            $this->assertFalse($this->flags()->enabled($key));
        }
    }

    /** The happy path — and the ceremony is STORED, not merely validated. */
    public function test_a_complete_ceremony_enables_and_records_every_input(): void
    {
        $admin = $this->admin();
        $key = 'experiments.scheduler_v2';
        $reason = 'ramping to 5% to measure retention effect over 28 days';

        $response = $this->postJson("/api/admin/flags/{$key}/enable", [
            'reason' => $reason,
            'typed_flag_name' => $key,
            'acknowledges_retention_risk' => true,
            'acknowledges_no_dark_pattern' => true,
        ]);

        $response->assertOk();
        $this->assertTrue($this->flags()->enabled($key));

        $audit = FlagRampAudit::where('flag_key', $key)->where('action', 'enable')->first();
        $this->assertNotNull($audit);
        $this->assertSame($reason, $audit->reason, 'the ceremony inputs are STORED — "we checked at the time" is unverifiable');
        $this->assertTrue($audit->acknowledges_retention_risk);
        $this->assertTrue($audit->acknowledges_no_dark_pattern);
        $this->assertSame($key, $audit->typed_flag_name);
    }

    // ═══════════════ #159 — an ack NEVER re-enables ════════════════════════════

    /**
     * EDGE CASE #159: "kill instant; banner persists; ack never re-enables; 72h
     * auto-waive audited."
     *
     * MUTATION: make `acknowledgeKill` clear `killed_at` or set `enabled = true`.
     */
    public function test_acknowledging_a_kill_never_re_enables_the_flag(): void
    {
        $admin = $this->admin();
        $key = 'social.activity_feed';
        Flag::create(['key' => $key, 'enabled' => true, 'version' => 1]);

        $this->flags()->kill($key, $admin->id, 1_700_000_000_000);
        $this->postJson("/api/admin/flags/{$key}/ack")->assertOk();

        $flag = Flag::where('key', $key)->first();
        $this->assertFalse((bool) $flag->enabled, '#159: an ack must NEVER re-enable');
        $this->assertFalse($this->flags()->enabled($key));
        $this->assertNotNull($flag->ack_at);
        $this->assertTrue($flag->bannerVisible(), 'the banner persists until an explicit new ramp');
    }

    /**
     * v3-D17's 72-hour audited auto-waive.
     *
     * MUTATION: waive without writing an audit row.
     */
    public function test_the_72h_auto_waive_is_audited(): void
    {
        $admin = $this->admin();
        $key = 'social.study_groups';
        $killedAt = 1_700_000_000_000;
        Flag::create(['key' => $key, 'enabled' => true, 'version' => 1]);
        $this->flags()->kill($key, $admin->id, $killedAt);

        // 71 hours later — not yet due.
        $this->assertSame(0, $this->flags()->autoWaiveDueKills($killedAt + (71 * 3600 * 1000)));

        // 73 hours later — due.
        $waived = $this->flags()->autoWaiveDueKills($killedAt + (73 * 3600 * 1000));
        $this->assertSame(1, $waived);

        $flag = Flag::where('key', $key)->first();
        $this->assertTrue($flag->ack_auto_waived);
        $this->assertFalse((bool) $flag->enabled, 'an auto-waive must not re-enable either');

        $audit = FlagRampAudit::where('flag_key', $key)->where('action', 'auto_waive')->first();
        $this->assertNotNull($audit, 'v3-D17: the auto-waive is AUDITED');
    }

    /** A ramp AFTER a kill clears the banner — the only thing that may. */
    public function test_only_a_full_ramp_clears_the_kill_banner(): void
    {
        $admin = $this->admin();
        $key = 'notifications.email_digest';
        Flag::create(['key' => $key, 'enabled' => true, 'version' => 1]);
        $this->flags()->kill($key, $admin->id, 1_700_000_000_000);

        $flag = Flag::where('key', $key)->first();
        $this->assertTrue($flag->bannerVisible());

        $this->postJson("/api/admin/flags/{$key}/enable", [
            'reason' => 'the issue is resolved and this is a considered re-ramp',
            'typed_flag_name' => $key,
            'acknowledges_retention_risk' => true,
            'acknowledges_no_dark_pattern' => true,
            'version' => $flag->version,
        ])->assertOk();

        $this->assertFalse(Flag::where('key', $key)->first()->bannerVisible());
    }
}
