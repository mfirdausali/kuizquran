<?php

namespace Tests\Feature\GlossDrafts;

use Tests\TestCase;

/**
 * Build-plan step 27 (M9) — THE STRUCTURAL GUARANTEE: a gloss draft cannot
 * reach a learner.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A GREP AND NOT A BEHAVIOURAL TEST
 * ---------------------------------------------------------------------------
 * A behavioural test can only prove that the endpoints which exist TODAY do not
 * serve a draft. The risk is the endpoint someone adds NEXT — a helpful join in
 * a corpus route, a "include drafts" query parameter, an export that scoops up
 * every table. That is edge case #189's actual shape ("agent machine-fills MS
 * glosses to be helpful"), and by the time it has behaviour it has already
 * shipped religious translation nobody reviewed.
 *
 * So the assertion is over the SOURCE: no file on a learner-serving path may
 * mention this table or its model. A new reader shows up here as a RED TEST
 * naming the file, before it has a behaviour to test.
 *
 * This mirrors check-boundaries.mjs's own method on the frontend (clause 3:
 * "indexedDB.open appears ONLY in lib/idb/db.ts"), which is the proven pattern
 * in this build for "one reader, enforced structurally".
 */
class GlossDraftIsolationTest extends TestCase
{
    /**
     * The ONLY files permitted to reference gloss drafts. Everything here is
     * admin tooling; none of it is on a path a learner's device can reach
     * without passing the `admin` env allowlist.
     */
    private const ALLOWED = [
        'app/Http/Controllers/GlossDraftsController.php',
        'app/Http/Controllers/ContentFreezeController.php',
        'app/Models/GlossDraft.php',
        'app/Models/GlossDraftReview.php',
    ];

    /**
     * Files that SERVE a learner. A reference to gloss drafts in any of these
     * would mean an unreviewed, unratified Malay gloss can be fetched by a
     * device.
     */
    private const SERVING_PATHS = [
        'app/Http/Controllers/EventsController.php',
        'app/Http/Controllers/OverridesController.php',
        'app/Http/Controllers/SpecsController.php',
        'app/Http/Controllers/VerificationsController.php',
        'app/Http/Controllers/AuthController.php',
    ];

    public function test_no_serving_controller_references_the_gloss_draft_table(): void
    {
        $base = dirname(__DIR__, 3);

        foreach (self::SERVING_PATHS as $rel) {
            $path = $base.'/'.$rel;
            if (! file_exists($path)) {
                continue;
            }
            $src = file_get_contents($path);
            $this->assertStringNotContainsString(
                'gloss_drafts',
                $src,
                "{$rel} references the gloss_drafts TABLE. Drafts are unreviewed religious ".
                'translation and must never be reachable from a learner-serving route (v3-D15, edge case #189).'
            );
            $this->assertStringNotContainsString(
                'GlossDraft',
                $src,
                "{$rel} references the GlossDraft MODEL. See v3-D15 / edge case #189."
            );
        }
    }

    /**
     * The whole app/ tree, minus the admin tooling that legitimately owns this
     * table. Catches a reader added somewhere SERVING_PATHS does not enumerate
     * — a new controller, a job, a resource, a middleware.
     */
    public function test_only_the_admin_authoring_surface_reads_gloss_drafts(): void
    {
        $base = dirname(__DIR__, 3);
        $appDir = $base.'/app';

        $offenders = [];
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($appDir));
        foreach ($iterator as $file) {
            if (! $file->isFile() || $file->getExtension() !== 'php') {
                continue;
            }
            $rel = str_replace($base.'/', '', $file->getPathname());
            if (in_array($rel, self::ALLOWED, true)) {
                continue;
            }
            $src = file_get_contents($file->getPathname());
            if (str_contains($src, 'GlossDraft') || str_contains($src, 'gloss_drafts')) {
                $offenders[] = $rel;
            }
        }

        $this->assertSame(
            [],
            $offenders,
            "These files read the non-shipping gloss-draft table: \n  ".implode("\n  ", $offenders).
            "\nIf one of them is legitimately part of the ADMIN authoring surface, add it to ".
            "GlossDraftIsolationTest::ALLOWED — deliberately, in a reviewed diff. If it is on a ".
            'learner-serving path, it must not read drafts at all (v3-D15 / edge case #189).'
        );
    }

    /**
     * The routes file: every gloss-draft route sits inside the admin group.
     * A route registered outside it would be publicly readable, which is the
     * "the app appears to publish an unreviewed Malay gloss" failure.
     */
    public function test_every_gloss_draft_route_is_admin_gated(): void
    {
        $routes = file_get_contents(dirname(__DIR__, 3).'/routes/api.php');

        // The admin group opens with `Route::middleware('admin')->prefix('admin')`
        // and every gloss-draft route must appear after it — and, being inside
        // the sanctum group too, behind both gates. Asserted by the resolved
        // route list rather than by brace-counting the source.
        $collection = app('router')->getRoutes();
        $found = 0;
        foreach ($collection as $route) {
            if (! str_contains($route->uri(), 'gloss-drafts')) {
                continue;
            }
            $found++;
            $middleware = $route->gatherMiddleware();
            $this->assertContains(
                'admin',
                $middleware,
                "Route {$route->uri()} is not behind the `admin` middleware."
            );
            $this->assertContains(
                'auth:sanctum',
                $middleware,
                "Route {$route->uri()} is not behind auth:sanctum."
            );
        }

        $this->assertGreaterThan(0, $found, 'no gloss-draft routes are registered at all');
        $this->assertStringContainsString('gloss-drafts', $routes);
    }
}
