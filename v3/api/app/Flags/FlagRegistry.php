<?php

namespace App\Flags;

/**
 * Build-plan step 26 (M8). THE FLAG REGISTRY — ALL FLAGS OFF.
 *
 * Every flag the product knows about is declared here with `false`. The registry
 * is CLOSED: a flag not in this list does not exist, and `FlagService::enabled()`
 * throws on an unknown key rather than returning a permissive default.
 *
 * `FlagPlaneTest::test_every_flag_in_the_registry_defaults_to_off` iterates this
 * ENTIRE array. A spot-check of three remembered flags survives a fourth being
 * added enabled — enumeration is what makes the assertion real.
 */
class FlagRegistry
{
    /**
     * key => [default, description].
     *
     * All social flags are here BEFORE any social code, which is exactly what
     * edge case #194 and build-plan step 26 require: "Social code before the flag
     * plane → CI guard: social paths require flag-provider import."
     */
    public const FLAGS = [
        // ---- social (M11, post-launch, all OFF at launch) ----
        'social.friends' => [false, 'Friend graph and mutual visibility.'],
        'social.leaderboard' => [false, 'Ranked leaderboard. v3-D06 forbids ranking at launch.'],
        'social.streak_sharing' => [false, 'Sharing streaks to a partner.'],
        'social.study_groups' => [false, 'Group memorization cohorts.'],
        'social.activity_feed' => [false, 'Peer activity feed.'],

        // ---- notifications ----
        'notifications.push' => [false, 'Web push reminders. Requires template approval.'],
        'notifications.email_digest' => [false, 'Weekly email digest.'],

        // ---- experiments ----
        'experiments.scheduler_v2' => [false, 'Alternate scheduling parameters.'],
        'experiments.new_onboarding' => [false, 'Onboarding variant.'],

        // ---- monetization ----
        'billing.checkout_live' => [false, 'Live Stripe checkout. OFF until an account exists (v3-D56).'],
        'billing.lifetime_fpx' => [false, 'FPX/GrabPay lifetime rail. Needs per-method activation.'],
    ];

    /** @return string[] */
    public static function keys(): array
    {
        return array_keys(self::FLAGS);
    }

    public static function exists(string $key): bool
    {
        return array_key_exists($key, self::FLAGS);
    }

    public static function default(string $key): bool
    {
        if (! self::exists($key)) {
            throw new \InvalidArgumentException("unknown flag `{$key}` — the registry is closed");
        }

        return self::FLAGS[$key][0];
    }

    public static function description(string $key): string
    {
        return self::FLAGS[$key][1] ?? '';
    }
}
