<?php

namespace Tests\Feature\Boundaries;

use Tests\TestCase;

/**
 * THE ENTITLEMENT-READ ALLOWLIST, PHP side (v3-D55).
 *
 * The counterpart of `apps/web/scripts/check-boundaries.mjs` clause 9. Edge case
 * #124 says events are ALWAYS ingested and enforcement lives at issuance/corpus
 * only — and prose has failed this build five times (v3-D38, D45, D49, D50, D53),
 * so the rule is enforced statically instead of remembered.
 *
 * This is a STRUCTURAL test: it reads source files, not behaviour. That is
 * deliberate — a behavioural test proves the paywall is absent from ingestion
 * TODAY; this one makes it fail the moment someone WRITES it, naming the file.
 */
class EntitlementBoundaryTest extends TestCase
{
    /** The three enforcement points, plus the billing island itself. */
    private const ALLOWLIST = [
        'app/Billing/EntitlementMachine.php',
        'app/Billing/EntitlementState.php',
        'app/Billing/EntitlementTier.php',
        'app/Billing/PaywallGate.php',
        'app/Billing/PaywallDecision.php',
        'app/Billing/TransitionResult.php',
        'app/Billing/TrialAttribution.php',
        'app/Billing/WebhookHandler.php',
        'app/Models/Entitlement.php',
        'app/Models/EntitlementTransition.php',
        'app/Http/Controllers/Billing/EntitlementController.php',
        'app/Http/Controllers/Admin/AdminBillingController.php',
        'app/Console/Commands/ReconcileEntitlementsCommand.php',
    ];

    /**
     * THE INGESTION PATH. Named explicitly so the inverse mutation has something
     * to prove against — a clause that only ever passes proves nothing (v3-D49).
     */
    private const FORBIDDEN = [
        'app/Http/Controllers/EventsController.php',
        'app/Models/Event.php',
    ];

    private const TOKENS = '/\bEntitlement|\bentitlement|\bPaywall/';

    private function appRoot(): string
    {
        return dirname(__DIR__, 3);
    }

    /** @return string[] every .php file under app/ */
    private function sourceFiles(): array
    {
        $root = $this->appRoot();
        $out = [];
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root.'/app'));
        foreach ($it as $file) {
            if ($file->isFile() && $file->getExtension() === 'php') {
                $out[] = str_replace($root.'/', '', $file->getPathname());
            }
        }
        sort($out);

        return $out;
    }

    /** Strip comments so the clause inspects CODE, not prose ABOUT the code. */
    private function stripComments(string $src): string
    {
        $src = preg_replace('!/\*[\s\S]*?\*/!', '', $src);

        return preg_replace('!^\s*//.*$!m', '', $src);
    }

    public function test_no_file_outside_the_allowlist_reads_entitlement(): void
    {
        $root = $this->appRoot();
        $violations = [];

        foreach ($this->sourceFiles() as $rel) {
            if (in_array($rel, self::ALLOWLIST, true)) {
                continue;
            }
            $src = $this->stripComments(file_get_contents($root.'/'.$rel));
            foreach (explode("\n", $src) as $i => $line) {
                if (preg_match(self::TOKENS, $line)) {
                    $violations[] = sprintf('%s:%d — %s', $rel, $i + 1, trim($line));
                }
            }
        }

        $this->assertSame([], $violations, implode("\n", array_merge(
            ['Entitlement read outside the allowlist.',
                'Edge case #124: events are ALWAYS ingested — the log is truth.',
                'Enforcement lives at session assembly, corpus delivery and checkout ONLY.',
                'A paywall that drops evidence is the worst failure mode in this product.',
                ''],
            $violations,
        )));
    }

    /**
     * THE INVERSE DIRECTION. Every allowlisted file must ACTUALLY read
     * entitlement, and every forbidden file must actually exist.
     *
     * Without this, the allowlist rots: an entry for a file that no longer reads
     * entitlement (or no longer exists) is an unreviewed hole waiting for the next
     * person who re-creates that path. This is the check that failed on the web
     * side and exposed a regex that was guarding almost nothing.
     */
    public function test_every_allowlisted_file_actually_reads_entitlement(): void
    {
        $root = $this->appRoot();
        $stale = [];

        foreach (self::ALLOWLIST as $rel) {
            $path = $root.'/'.$rel;
            if (! file_exists($path)) {
                // Not yet built is legitimate at this step — but it must not be
                // silently permitted, so it is asserted separately below.
                continue;
            }
            $src = $this->stripComments(file_get_contents($path));
            if (! preg_match(self::TOKENS, $src)) {
                $stale[] = $rel;
            }
        }

        $this->assertSame([], $stale, 'Allowlisted files that do not read entitlement are stale entries — remove them: '.implode(', ', $stale));
    }

    public function test_the_ingestion_path_exists_and_is_guarded(): void
    {
        $root = $this->appRoot();

        foreach (self::FORBIDDEN as $rel) {
            $this->assertFileExists(
                $root.'/'.$rel,
                "FORBIDDEN names {$rel}, which does not exist — the clause is not guarding the ingestion path.",
            );
            $this->assertNotContains($rel, self::ALLOWLIST, "{$rel} is in BOTH lists. Edge case #124 forbids it.");

            $src = $this->stripComments(file_get_contents($root.'/'.$rel));
            $this->assertDoesNotMatchRegularExpression(
                self::TOKENS,
                $src,
                "{$rel} is on the ingestion path and must never read entitlement (#124).",
            );
        }
    }
}
