<?php

namespace Tests\Feature\Backup;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * BUILD-PLAN step 30 / M10 — `backup:restore-drill`'s PURGE-AWARE property
 * (v3-D123).
 *
 * Until this fix, the drill's "purge" step called `$doomed->delete()`
 * directly and hand-wrote a JSON file shaped like a ledger row
 * (`{user_id, purged_at, reason}`) — sharing no code, no column names, and no
 * transaction with the REAL PDPA purge path (`PurgeDueAccountsCommand` →
 * `AccountDeletionRequest` → `PurgeLedgerEntry`, build-plan step 23, shipped
 * hours after this drill was first written, `93ce02a` following `75ac0bb`).
 * The drill's own docblock, `PurgeLedgerEntry`'s own docblock, and
 * `AccountDeletionTest`'s own docblock all claimed this drill exercised or
 * reconciled against the real thing — all three were false. `make test`
 * never caught it because no test of `backup:restore-drill` existed at all,
 * in either direction, until this file.
 *
 * This suite runs the REAL command end to end — safe inside
 * `RefreshDatabase`: the drill's own dump/wipe/restore all execute inside
 * this test's transaction and are rolled back when the test ends, the same
 * as any other write in this suite.
 */
class BackupRestoreDrillTest extends TestCase
{
    use RefreshDatabase;

    /** The drill must still pass end to end — this command had zero test
     *  coverage before this file; this is the first proof it runs clean. */
    public function test_the_drill_passes_end_to_end_against_sqlite(): void
    {
        $dir = storage_path('app/backup-drill-test-'.bin2hex(random_bytes(4)));

        $this->artisan('backup:restore-drill', ['--dir' => $dir])
            ->assertSuccessful();
    }

    /** Load-bearing: the captured ledger must carry the REAL
     *  `PurgeLedgerEntry` shape (`id`, `purged_at_ms`) — not the fabricated
     *  shape (`purged_at`, no `id`) the unfixed drill wrote by hand. Against
     *  the unfixed source these keys are simply absent (RED); against the
     *  fix they are present because the row was captured from the real
     *  model's own `create()` + `toArray()`, not authored by this command. */
    public function test_the_captured_ledger_carries_the_real_model_shape_not_a_fabrication(): void
    {
        $dir = storage_path('app/backup-drill-test-'.bin2hex(random_bytes(4)));

        $this->artisan('backup:restore-drill', ['--dir' => $dir, '--keep' => true])
            ->assertSuccessful();

        $ledgerPath = $dir.'/purge-ledger.json';
        $this->assertFileExists($ledgerPath, 'the drill must persist the captured ledger when --keep is passed');

        $rows = json_decode(file_get_contents($ledgerPath), true);
        $this->assertNotEmpty($rows, "the captured ledger must contain the doomed subject's real purge_ledger row");
        $this->assertArrayHasKey('id', $rows[0], 'a fabricated ledger entry has no primary key — this one must, because it is a real Eloquent row');
        $this->assertArrayHasKey(
            'purged_at_ms',
            $rows[0],
            'the real PurgeLedgerEntry column is purged_at_ms; the old fabricated ledger used purged_at instead',
        );
        $this->assertSame('pdpa_delete', $rows[0]['reason']);
    }

    /** Load-bearing: the drill's own console output must show the REAL
     *  `pdpa:purge-due` command actually ran (it prints its own "purged N,
     *  skipped N" line) — never true against the unfixed drill, which never
     *  called it at all. */
    public function test_the_drill_actually_invokes_the_real_purge_command(): void
    {
        $dir = storage_path('app/backup-drill-test-'.bin2hex(random_bytes(4)));

        $this->artisan('backup:restore-drill', ['--dir' => $dir])
            ->expectsOutputToContain('pdpa:purge-due — purged 1, skipped 0')
            ->assertSuccessful();
    }
}
