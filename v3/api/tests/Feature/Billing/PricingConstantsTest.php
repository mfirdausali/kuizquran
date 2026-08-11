<?php

namespace Tests\Feature\Billing;

use Tests\TestCase;

/**
 * THE CI PRICING CLAUSE — BUILD-PLAN.md's own gate list names it:
 * "pricing-constants test quoting v3-D07".
 *
 * Edge case #196: "config constants in ONE file + a test quoting v3-D07."
 *
 * Every assertion carries the decision text in its failure message, so someone
 * changing a price sees WHICH decision they are contradicting rather than a bare
 * "expected 2000, got 2500".
 */
class PricingConstantsTest extends TestCase
{
    /** v3-D07, quoted verbatim. The single source for every message below. */
    private const V3_D07 = <<<'TEXT'
    v3-D07 — Hard paywall; supersedes the waqf/donation model:
      "A limited free trial (one surah, or 14 days), then payment is required to
       continue.
         Monthly:  RM20 (Malaysian IP) · USD10 (international)
         Lifetime: RM500 (Malaysian IP) · USD200 (international)
       IP sets the default region; the learner can change it. The chosen region is
       stored on the account, not per session, so travelling never reprices anyone."
    TEXT;

    public function test_monthly_prices_match_v3_d07(): void
    {
        $this->assertSame(2000, config('pricing.MY.monthly'), self::V3_D07."\n\nMonthly (MY) must be RM20 = 2000 sen.");
        $this->assertSame('MYR', config('pricing.MY.currency'), self::V3_D07);
        $this->assertSame(1000, config('pricing.INTL.monthly'), self::V3_D07."\n\nMonthly (INTL) must be USD10 = 1000 cents.");
        $this->assertSame('USD', config('pricing.INTL.currency'), self::V3_D07);
    }

    public function test_lifetime_prices_match_v3_d07(): void
    {
        $this->assertSame(50000, config('pricing.MY.lifetime'), self::V3_D07."\n\nLifetime (MY) must be RM500 = 50000 sen.");
        $this->assertSame(20000, config('pricing.INTL.lifetime'), self::V3_D07."\n\nLifetime (INTL) must be USD200 = 20000 cents.");
    }

    public function test_trial_matches_v3_d07(): void
    {
        $this->assertSame(1, config('pricing.trial.surahs'), self::V3_D07."\n\n\"one surah, or 14 days\".");
        $this->assertSame(14, config('pricing.trial.days'), self::V3_D07."\n\n\"one surah, or 14 days\".");
    }

    /**
     * Edge case #120: "FPX cannot recur → monthly MY card-only at launch; pricing
     * copy constraint; entitlements rail-agnostic."
     *
     * MUTATION: add 'fpx' to MY.monthly rails. A recurring FPX subscription cannot
     * exist, so offering one is copy that lies.
     */
    public function test_monthly_my_is_card_only_because_fpx_cannot_recur(): void
    {
        $this->assertSame(['card'], config('pricing.rails.MY.monthly'), 'Edge case #120: FPX cannot recur — monthly MY is card-only at launch.');
        $this->assertContains('fpx', config('pricing.rails.MY.lifetime'), 'FPX is fine for a ONE-OFF lifetime purchase.');
        $this->assertContains('grabpay', config('pricing.rails.MY.lifetime'));
    }

    /** Prices are integers in minor units. A float price is a rounding bug. */
    public function test_every_price_is_an_integer_in_minor_units(): void
    {
        foreach (['MY', 'INTL'] as $region) {
            foreach (['monthly', 'lifetime'] as $plan) {
                $value = config("pricing.{$region}.{$plan}");
                $this->assertIsInt($value, "pricing.{$region}.{$plan} must be an integer number of minor units, never a float.");
                $this->assertGreaterThan(0, $value);
            }
        }
    }

    /** v3-D07: "IP sets the DEFAULT region; the learner can change it." */
    public function test_both_regions_exist_and_default_is_intl(): void
    {
        $this->assertSame(['MY', 'INTL'], config('pricing.regions'), self::V3_D07);
        $this->assertSame('INTL', config('pricing.default_region'), self::V3_D07);
    }

    /**
     * EDGE CASE #196's OTHER HALF, which a constants test alone cannot cover:
     * prices must appear in exactly ONE file.
     *
     * A hardcoded "RM20" in a Blade template or a controller stays invisible to
     * every assertion above, and lies the day pricing changes. This scans the PHP
     * source tree the same way `check-boundaries.mjs` clause 10 scans the web app.
     */
    public function test_no_price_literal_exists_outside_the_pricing_config(): void
    {
        $root = dirname(__DIR__, 3);
        $violations = [];

        foreach ([$root.'/app', $root.'/config', $root.'/resources', $root.'/routes'] as $dir) {
            if (! is_dir($dir)) {
                continue;
            }
            $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir));
            foreach ($it as $file) {
                if (! $file->isFile() || ! in_array($file->getExtension(), ['php', 'blade.php'], true)) {
                    continue;
                }
                $rel = str_replace($root.'/', '', $file->getPathname());
                if ($rel === 'config/pricing.php') {
                    continue; // THE one allowed home
                }
                // Strip comments — a doc comment quoting v3-D07 is documentation,
                // not a second source of truth.
                $src = preg_replace('!/\*[\s\S]*?\*/!', '', file_get_contents($file->getPathname()));
                $src = preg_replace('!^\s*//.*$!m', '', $src);

                foreach (explode("\n", $src) as $i => $line) {
                    if (preg_match('/\bRM\s?\d|\bUSD\s?\d/', $line)) {
                        $violations[] = sprintf('%s:%d — %s', $rel, $i + 1, trim($line));
                    }
                }
            }
        }

        $this->assertSame([], $violations, implode("\n", array_merge(
            ['A price literal outside config/pricing.php.',
                'Edge case #196: pricing constants live in ONE file.',
                'A second copy is a copy that lies the day prices change.',
                ''],
            $violations,
        )));
    }
}
