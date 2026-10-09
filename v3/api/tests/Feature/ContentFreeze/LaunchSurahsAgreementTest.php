<?php

namespace Tests\Feature\ContentFreeze;

use ReflectionClass;
use Tests\TestCase;

/**
 * The launch surah set `[12, 67, 103, 112]` (v3-D59) is hand-declared
 * independently in at least four PRODUCTION files, with no shared source and
 * — until this test — no agreement check between any of them:
 *
 *   - `v3/scripts/content-freeze.mjs#LAUNCH_SURAHS` (the canonical source,
 *     per every other copy's own comment)
 *   - `ContentFreezeController::LAUNCH_SURAHS` (this class)
 *   - `apps/web/scripts/check-corpus-glyphs.mjs#LAUNCH_SURAHS`
 *   - the root `Makefile`'s `compile-corpus` target (four `npm run compile
 *     -- N` lines)
 *
 * This is the exact "two (here, four) independent implementations of one
 * decision, no shared source, no agreement test" shape this build has
 * repeatedly closed elsewhere (v3-D137, v3-D150/151/158, v3-D261,
 * v3-D263-266, v3-D288, v3-D291) — and this particular pair already
 * drifted for real: `ContentFreezeController::LAUNCH_SURAHS` sat at
 * `[12, 103, 112]` (missing 67) for weeks while `content-freeze.mjs` was
 * already correct, silently making the one admin screen built to answer
 * "may I book the qari" never check surah 67's own criteria at all
 * (v3-D224, 2026-09-17). That run corrected the VALUE but added no guard,
 * so the identical drift can recur silently on any future launch-set
 * change. This is a drift-risk fix, not a live divergence — all four
 * copies already agree today.
 */
class LaunchSurahsAgreementTest extends TestCase
{
    private function v3Root(): string
    {
        // this file: v3/api/tests/Feature/ContentFreeze/LaunchSurahsAgreementTest.php
        return dirname(__DIR__, 4);
    }

    private function rawFile(string $relativeToV3Root): string
    {
        $path = $this->v3Root().'/'.$relativeToV3Root;
        $this->assertFileExists($path, "{$relativeToV3Root} is missing — update this test.");

        return (string) file_get_contents($path);
    }

    /** @return array<int,int> */
    private function parseJsArrayLiteral(string $source, string $pattern, string $label): array
    {
        $this->assertMatchesRegularExpression($pattern, $source, "could not locate {$label} in its own source.");
        preg_match($pattern, $source, $m);
        $parsed = array_map(static fn (string $n) => (int) trim($n), explode(',', $m[1]));
        sort($parsed);

        return $parsed;
    }

    public function test_content_freeze_mjs_is_the_canonical_launch_set(): void
    {
        // Independent of ContentFreezeController's own copy — this just
        // pins what the canonical source currently says, so the other
        // assertions below have a known-good value to compare against.
        $parsed = $this->parseJsArrayLiteral(
            $this->rawFile('scripts/content-freeze.mjs'),
            '/const LAUNCH_SURAHS = \[([\d,\s]+)\];/',
            'scripts/content-freeze.mjs#LAUNCH_SURAHS'
        );

        $this->assertSame([12, 67, 103, 112], $parsed);
    }

    public function test_this_controllers_launch_surahs_agrees_with_content_freeze_mjs(): void
    {
        $canonical = $this->parseJsArrayLiteral(
            $this->rawFile('scripts/content-freeze.mjs'),
            '/const LAUNCH_SURAHS = \[([\d,\s]+)\];/',
            'scripts/content-freeze.mjs#LAUNCH_SURAHS'
        );

        $reflection = new ReflectionClass(\App\Http\Controllers\ContentFreezeController::class);
        $ours = $reflection->getConstant('LAUNCH_SURAHS');
        sort($ours);

        $this->assertSame(
            $canonical,
            $ours,
            'ContentFreezeController::LAUNCH_SURAHS has drifted from the canonical '.
            'scripts/content-freeze.mjs#LAUNCH_SURAHS — this is exactly the v3-D224 '.
            'drift (missing surah 67) recurring.'
        );
    }

    public function test_check_corpus_glyphs_mjs_agrees_with_content_freeze_mjs(): void
    {
        $canonical = $this->parseJsArrayLiteral(
            $this->rawFile('scripts/content-freeze.mjs'),
            '/const LAUNCH_SURAHS = \[([\d,\s]+)\];/',
            'scripts/content-freeze.mjs#LAUNCH_SURAHS'
        );

        $theirs = $this->parseJsArrayLiteral(
            $this->rawFile('apps/web/scripts/check-corpus-glyphs.mjs'),
            '/const LAUNCH_SURAHS = \[([\d,\s]+)\];/',
            'apps/web/scripts/check-corpus-glyphs.mjs#LAUNCH_SURAHS'
        );

        $this->assertSame($canonical, $theirs);
    }

    public function test_makefiles_compile_corpus_target_agrees_with_content_freeze_mjs(): void
    {
        $canonical = $this->parseJsArrayLiteral(
            $this->rawFile('scripts/content-freeze.mjs'),
            '/const LAUNCH_SURAHS = \[([\d,\s]+)\];/',
            'scripts/content-freeze.mjs#LAUNCH_SURAHS'
        );

        $makefile = (string) file_get_contents($this->v3Root().'/../Makefile');
        preg_match('/compile-corpus:.*?(?=\n\S|\z)/s', $makefile, $block);
        $this->assertNotEmpty($block, 'could not locate the compile-corpus target in the root Makefile.');

        preg_match_all('/npm run compile -- (\d+)/', $block[0], $matches);
        $surahs = array_map('intval', $matches[1]);
        sort($surahs);

        $this->assertSame(
            $canonical,
            $surahs,
            "the root Makefile's compile-corpus target has drifted from ".
            'scripts/content-freeze.mjs#LAUNCH_SURAHS.'
        );
    }
}
